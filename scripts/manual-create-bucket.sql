-- Manual script to create case-documents bucket
-- Run this directly in Supabase SQL Editor

-- First, check if bucket exists
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'case-documents';

-- Delete bucket if it exists (to start fresh)
DELETE FROM storage.buckets WHERE id = 'case-documents';

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-documents',
  'case-documents',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'audio/mp4',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo'
  ]
);

-- Verify it was created
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'case-documents';
