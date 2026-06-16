create table if not exists public.card_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  purpose text not null,
  name text not null,
  description text not null,
  template text not null,
  style text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.card_prompt_templates enable row level security;

drop policy if exists "card_prompt_templates_public_read" on public.card_prompt_templates;
create policy "card_prompt_templates_public_read"
  on public.card_prompt_templates
  for select using (is_active = true);

drop trigger if exists card_prompt_templates_updated_at on public.card_prompt_templates;
create trigger card_prompt_templates_updated_at
  before update on public.card_prompt_templates
  for each row execute procedure public.set_updated_at();

insert into public.card_prompt_templates (
  code,
  purpose,
  name,
  description,
  template,
  style,
  sort_order
) values (
  'COMPOSE_PROMPT',
  'system',
  'Compose prompt',
  'Admin-managed prompt for AI card composition',
  'This is a Korean emotional greeting card background image. Add handwritten Korean calligraphy (brush calligraphy) text onto this background to create a complete, artistic greeting card. Calligraphy text to write: - Header (upper center area): "{name}님께" large, expressive Korean brush calligraphy, flowing strokes - Body (below header, centered): "{message}" elegant Korean brush calligraphy, multi-line if needed Calligraphy style requirements: - Authentic Korean brush calligraphy style with visible ink brush stroke texture, natural ink flow and slight bleeding at stroke edges - Ink color: deep warm brown-black (#3b1f10) with ink wash variation - Behind the calligraphy area: soft parchment or hanji paper-textured translucent panel - Thin ink brush decorative lines or minimal floral motifs framing the text area - The background scene must remain beautifully visible around the calligraphy panel - Portrait orientation 3:4 ratio, no digital font appearance, must look hand-painted - Korean characters must be perfectly legible and correctly formed - No watermarks, no borders, no UI elements',
  'system',
  0
)
on conflict (code) do update set
  purpose = excluded.purpose,
  name = excluded.name,
  description = excluded.description,
  template = excluded.template,
  style = excluded.style,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
