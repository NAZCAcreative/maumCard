-- Production scaling foundation:
-- 1. Idempotent, atomic credit mutations.
-- 2. Durable generation queue that can be consumed by external workers.

alter table public.credit_transactions
  add column if not exists idempotency_key text;

create unique index if not exists credit_transactions_user_idempotency_idx
  on public.credit_transactions (user_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  job_type text not null check (job_type in ('ai_background')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  idempotency_key text not null,
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  priority integer not null default 100,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists generation_jobs_claim_idx
  on public.generation_jobs (status, available_at, priority, created_at);

create index if not exists generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);

alter table public.generation_jobs enable row level security;

drop policy if exists "generation_jobs_select_own" on public.generation_jobs;
create policy "generation_jobs_select_own"
  on public.generation_jobs for select
  using (auth.uid() = user_id);

create or replace function public.change_my_credits(
  p_amount integer,
  p_reason text,
  p_idempotency_key text
)
returns table(balance integer, applied boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_amount = 0 or nullif(trim(p_reason), '') is null
     or nullif(trim(p_idempotency_key), '') is null then
    raise exception 'invalid_credit_transaction' using errcode = '22023';
  end if;

  select credits into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.credit_transactions
    where user_id = v_user_id and idempotency_key = p_idempotency_key
  ) then
    return query select v_balance, false;
    return;
  end if;

  if v_balance + p_amount < 0 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  update public.profiles
  set credits = credits + p_amount
  where id = v_user_id
  returning credits into v_balance;

  insert into public.credit_transactions (user_id, amount, reason, idempotency_key)
  values (v_user_id, p_amount, p_reason, p_idempotency_key);

  return query select v_balance, true;
end;
$$;

create or replace function public.enqueue_generation_job(
  p_job_type text,
  p_payload jsonb,
  p_idempotency_key text,
  p_credit_cost integer default 1
)
returns table(job_id uuid, job_status text, balance integer, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_job public.generation_jobs%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_job_type not in ('ai_background')
     or nullif(trim(p_idempotency_key), '') is null
     or p_credit_cost < 0 then
    raise exception 'invalid_generation_job' using errcode = '22023';
  end if;

  select credits into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  select * into v_job
  from public.generation_jobs
  where user_id = v_user_id and idempotency_key = p_idempotency_key;

  if found then
    return query select v_job.id, v_job.status, v_balance, false;
    return;
  end if;

  if v_balance < p_credit_cost then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  if p_credit_cost > 0 then
    update public.profiles
    set credits = credits - p_credit_cost
    where id = v_user_id
    returning credits into v_balance;

    insert into public.credit_transactions (user_id, amount, reason, idempotency_key)
    values (
      v_user_id,
      -p_credit_cost,
      'generation_reserve:' || p_job_type,
      'generation-reserve:' || p_idempotency_key
    );
  end if;

  insert into public.generation_jobs (
    user_id, job_type, payload, idempotency_key, reserved_credits
  )
  values (
    v_user_id, p_job_type, coalesce(p_payload, '{}'::jsonb),
    p_idempotency_key, p_credit_cost
  )
  returning * into v_job;

  return query select v_job.id, v_job.status, v_balance, true;
end;
$$;

create or replace function public.claim_generation_jobs(p_limit integer default 5)
returns setof public.generation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimable as (
    select id
    from public.generation_jobs
    where status = 'queued'
      and available_at <= now()
      and attempts < max_attempts
    order by priority asc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  )
  update public.generation_jobs jobs
  set status = 'processing',
      attempts = jobs.attempts + 1,
      started_at = now(),
      updated_at = now()
  from claimable
  where jobs.id = claimable.id
  returning jobs.*;
end;
$$;

create or replace function public.refund_generation_job(p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.generation_jobs%rowtype;
  v_balance integer;
  v_refund_key text;
begin
  select * into v_job
  from public.generation_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'generation_job_not_found' using errcode = 'P0002';
  end if;

  select credits into v_balance
  from public.profiles
  where id = v_job.user_id
  for update;

  v_refund_key := 'generation-refund:' || v_job.id::text;

  if v_job.reserved_credits > 0 and not exists (
    select 1 from public.credit_transactions
    where user_id = v_job.user_id and idempotency_key = v_refund_key
  ) then
    update public.profiles
    set credits = credits + v_job.reserved_credits
    where id = v_job.user_id
    returning credits into v_balance;

    insert into public.credit_transactions (user_id, amount, reason, idempotency_key)
    values (
      v_job.user_id,
      v_job.reserved_credits,
      'generation_refund:' || v_job.job_type,
      v_refund_key
    );
  end if;

  return v_balance;
end;
$$;

revoke all on function public.claim_generation_jobs(integer) from public, anon, authenticated;
revoke all on function public.refund_generation_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_generation_jobs(integer) to service_role;
grant execute on function public.refund_generation_job(uuid) to service_role;
grant execute on function public.change_my_credits(integer, text, text) to authenticated;
grant execute on function public.enqueue_generation_job(text, jsonb, text, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-assets',
  'generated-assets',
  true,
  15728640,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

