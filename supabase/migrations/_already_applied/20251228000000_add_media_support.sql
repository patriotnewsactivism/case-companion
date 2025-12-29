-- Add support for audio and video files to case-documents bucket
-- Increase file size limit to 500MB for video files

-- Update the bucket to support audio and video MIME types and increase size limit
UPDATE storage.buckets
SET
  file_size_limit = 524288000, -- 500MB limit for video files
  allowed_mime_types = ARRAY[
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',

    -- Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',

    -- Audio
    'audio/mpeg',           -- MP3
    'audio/mp4',            -- M4A
    'audio/wav',            -- WAV
    'audio/x-wav',          -- WAV (alternative)
    'audio/wave',           -- WAV (alternative)
    'audio/webm',           -- WebM audio
    'audio/ogg',            -- OGG
    'audio/aac',            -- AAC
    'audio/x-m4a',          -- M4A (alternative)

    -- Video
    'video/mp4',            -- MP4
    'video/mpeg',           -- MPEG
    'video/quicktime',      -- MOV
    'video/x-msvideo',      -- AVI
    'video/webm',           -- WebM video
    'video/x-matroska',     -- MKV
    'video/3gpp',           -- 3GP
    'video/x-flv'           -- FLV
  ]
WHERE id = 'case-documents';
