create table if not exists public.curated_phrases (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  phrase_type text not null default 'short',
  content text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.curated_phrases enable row level security;

create policy "Public read active phrases"
  on public.curated_phrases
  for select
  using (is_active = true);

-- Seed short phrases (messagesByPurpose)
insert into public.curated_phrases (category, phrase_type, content, sort_order) values
  ('birthday','short','생일을 진심으로 축하합니다. 오늘 하루 누구보다 행복하게 보내세요.',0),
  ('birthday','short','당신이 태어난 오늘이 참 고맙습니다. 오래오래 건강하고 웃어주세요.',10),
  ('birthday','short','새로운 한 해에는 더 많은 기쁨과 따뜻한 순간이 함께하길 바랍니다.',20),
  ('birthday','short','소중한 당신의 생일에 마음 가득 축하를 보냅니다.',30),
  ('birthday','short','오늘만큼은 모든 걱정 내려놓고 사랑받는 하루 보내세요.',40),

  ('love','short','오늘도 당신의 하루가 따뜻한 햇살처럼 빛나길 바랍니다.',0),
  ('love','short','별일 없이 잘 지내고 있는지 문득 생각났어요. 늘 평안하길 바랍니다.',10),
  ('love','short','바쁜 하루 속에서도 잠깐 웃을 수 있는 순간이 찾아오길 바라요.',20),
  ('love','short','멀리 있어도 마음은 늘 곁에 있습니다. 오늘도 응원합니다.',30),
  ('love','short','당신은 세상에서 가장 소중한 사람입니다. 늘 건강하고 행복하세요.',40),

  ('health','short','무엇보다 건강이 제일입니다. 오늘도 몸과 마음을 잘 챙기세요.',0),
  ('health','short','천천히 쉬어가도 괜찮습니다. 건강한 하루가 되길 바랍니다.',10),
  ('health','short','몸도 마음도 편안해지는 시간이 당신 곁에 머물길 바라요.',20),
  ('health','short','따뜻한 밥 잘 챙겨 드시고, 오늘도 무리하지 마세요.',30),
  ('health','short','건강한 웃음이 오래도록 함께하길 진심으로 바랍니다.',40),

  ('thanks','short','늘 곁에 있어서 고맙습니다. 당신의 마음을 오래 기억하겠습니다.',0),
  ('thanks','short','말로 다 표현하지 못했지만, 언제나 깊이 감사하고 있습니다.',10),
  ('thanks','short','당신이 건네준 따뜻함 덕분에 많은 날을 잘 지나왔습니다.',20),
  ('thanks','short','작은 배려 하나하나가 제게 큰 힘이 되었습니다. 고맙습니다.',30),
  ('thanks','short','고마운 마음을 담아 이 카드를 보냅니다. 늘 행복하세요.',40),

  ('comfort','short','힘든 날도 지나가고, 다시 웃는 날이 꼭 찾아올 거예요.',0),
  ('comfort','short','지금 충분히 잘하고 있습니다. 너무 스스로를 몰아붙이지 마세요.',10),
  ('comfort','short','오늘은 잠시 쉬어도 괜찮습니다. 당신의 마음이 먼저입니다.',20),
  ('comfort','short','혼자 견디고 있다고 느껴질 때도, 당신을 응원하는 마음이 있습니다.',30),
  ('comfort','short','천천히 가도 괜찮아요. 결국 따뜻한 날이 다시 올 거예요.',40),

  ('congrats','short','풍성한 마음과 따뜻한 웃음이 함께하는 명절 보내세요.',0),
  ('congrats','short','소중한 사람들과 평안하고 넉넉한 시간 보내시길 바랍니다.',10),
  ('congrats','short','멀리서나마 감사와 안부를 전합니다. 건강한 명절 되세요.',20),
  ('congrats','short','가정에 웃음과 평안이 가득하길 진심으로 기원합니다.',30),
  ('congrats','short','오랜만의 쉼 속에서 마음까지 넉넉해지는 명절 보내세요.',40),

  ('morning','short','좋은 아침입니다. 오늘 하루도 기분 좋게 시작하시길 바랍니다.',0),
  ('morning','short','따뜻한 햇살처럼 밝고 편안한 하루가 되길 바라요.',10),
  ('morning','short','오늘도 작은 기쁨을 많이 만나는 하루 보내세요.',20),
  ('morning','short','새로운 아침이 당신에게 좋은 소식을 데려오길 바랍니다.',30),
  ('morning','short','무리하지 말고 천천히, 그래도 기분 좋게 시작해요.',40),

  ('night','short','오늘 하루도 수고 많았습니다. 편안한 밤 보내세요.',0),
  ('night','short','고단했던 마음을 내려놓고 깊이 쉬는 밤이 되길 바랍니다.',10),
  ('night','short','내일은 오늘보다 조금 더 가벼운 하루가 찾아오길 바라요.',20),
  ('night','short','따뜻한 꿈 꾸시고, 몸과 마음 모두 편히 쉬세요.',30),
  ('night','short','오늘도 잘 버텨낸 당신에게 조용한 응원을 보냅니다.',40),

  ('custom','short','마음을 담아 직접 문구를 적어보세요.',0),
  ('custom','short','전하고 싶은 말이 있다면 그대로 적어도 충분히 따뜻합니다.',10),
  ('custom','short','짧은 한마디라도 진심이면 오래 남습니다.',20),
  ('custom','short','당신만의 표현으로 소중한 마음을 전해보세요.',30),
  ('custom','short','평소 하지 못했던 말을 카드에 담아보세요.',40);
