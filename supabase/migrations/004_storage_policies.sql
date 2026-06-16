-- =============================================
-- Supabase Storage: backgrounds bucket public read
-- =============================================

-- 버킷이 없으면 생성, 있으면 public으로 업데이트
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  true,
  10485760,  -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true;

-- 공개 읽기 정책 (이미 존재하면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'backgrounds_public_read'
  ) THEN
    CREATE POLICY "backgrounds_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'backgrounds');
  END IF;
END $$;

-- 관리자 업로드/삭제 (service_role key 사용 시 자동 bypass, 일반 authenticated도 허용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'backgrounds_auth_write'
  ) THEN
    CREATE POLICY "backgrounds_auth_write"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'backgrounds' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'backgrounds_auth_delete'
  ) THEN
    CREATE POLICY "backgrounds_auth_delete"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'backgrounds' AND auth.role() = 'authenticated');
  END IF;
END $$;
