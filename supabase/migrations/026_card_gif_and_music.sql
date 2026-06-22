-- 카드 공유: 움직이는 GIF + 랜덤 배경음악 페이지 지원
-- 1) card_library 에 GIF 공유 이미지 URL 컬럼 추가
ALTER TABLE card_library ADD COLUMN IF NOT EXISTS gif_image_url TEXT;

-- 2) card-images 버킷에서 GIF 업로드 허용 (기존 png/jpeg/webp 에 image/gif 추가)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'card-images',
  'card-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
