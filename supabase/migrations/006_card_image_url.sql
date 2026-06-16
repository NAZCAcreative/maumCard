-- Add card_image_url column to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_image_url TEXT;

-- Create card-images storage bucket for composed card images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('card-images', 'card-images', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read of card images
DROP POLICY IF EXISTS "card-images public read" ON storage.objects;
CREATE POLICY "card-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-images');

-- Allow authenticated users to upload card images
DROP POLICY IF EXISTS "card-images auth insert" ON storage.objects;
CREATE POLICY "card-images auth insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'card-images' AND auth.role() = 'authenticated');

-- Allow users to delete their own card images
DROP POLICY IF EXISTS "card-images auth delete" ON storage.objects;
CREATE POLICY "card-images auth delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'card-images' AND auth.role() = 'authenticated');



-- 수정본
    ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_image_url TEXT;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('card-images', 'card-images', true, 10485760, ARRAY['image/png', 'image/jpeg',
  'image/webp'])
  ON CONFLICT (id) DO UPDATE SET public = true;

  DROP POLICY IF EXISTS "card-images public read" ON storage.objects;
  CREATE POLICY "card-images public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'card-images');

  DROP POLICY IF EXISTS "card-images auth insert" ON storage.objects;
  CREATE POLICY "card-images auth insert"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'card-images' AND auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "card-images auth delete" ON storage.objects;
  CREATE POLICY "card-images auth delete"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'card-images' AND auth.role() = 'authenticated');
