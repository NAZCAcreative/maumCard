insert into public.card_prompt_templates (
  code,
  purpose,
  name,
  description,
  template,
  style,
  is_active,
  sort_order
)
values (
  'COMPOSE_PROMPT_HAND',
  'system',
  'Compose prompt (손편지)',
  'Admin-managed prompt for handwritten letter composition',
  'This is a Korean emotional greeting card background image.
Add handwritten Korean calligraphy (brush calligraphy) text onto this background to create a complete handwritten letter card.
Calligraphy text to write:
- Header (upper center area): "{name}님께" with soft, warm Korean brush calligraphy
- Body (centered, multi-paragraph): "{message}" handwritten-style Korean brush calligraphy with natural paragraph breaks
Calligraphy style requirements:
- The card should feel like a real handwritten letter placed on premium hanji paper
- Use a calm, intimate composition with enough empty space around the text
- Ink color: deep warm brown-black (#3b1f10) with soft variation
- Add subtle paper texture, a gentle shadow, and minimal decorative edges
- The text area must remain highly legible and emotionally warm
- Portrait orientation 3:4 ratio, no digital font appearance, must look hand-written
- No watermarks, no borders, no UI elements',
  'system',
  true,
  2
)
on conflict (code) do update set
  purpose = excluded.purpose,
  name = excluded.name,
  description = excluded.description,
  template = excluded.template,
  style = excluded.style,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
