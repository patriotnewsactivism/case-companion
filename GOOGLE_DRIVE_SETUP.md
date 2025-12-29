# Google Drive Integration Setup Guide

This guide explains how to set up Google Drive folder import functionality for the Case Companion application.

## Features

The Google Drive integration allows you to:
- **Recursively import entire folders** from Google Drive
- **Support for multiple file types**: Documents (PDF, Word, TXT), Images (JPG, PNG, GIF, WebP), Audio (MP3, WAV, M4A), and Video (MP4, MOV, AVI)
- **Track import progress** with real-time updates
- **Batch processing** of hundreds or thousands of files
- **Automatic OCR and AI analysis** of imported documents

## Prerequisites

1. A Google Cloud Project
2. Google Drive API enabled
3. OAuth 2.0 credentials configured

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter a project name (e.g., "Case Companion")
4. Click "Create"

## Step 2: Enable Google Drive API

1. In your Google Cloud Project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"
4. Also enable "Google Picker API" (search and enable)

## Step 3: Create OAuth 2.0 Credentials

### Create OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (unless you have a Google Workspace)
3. Click "Create"
4. Fill in the required fields:
   - App name: "Case Companion"
   - User support email: Your email
   - Developer contact information: Your email
5. Click "Save and Continue"
6. On "Scopes" page, click "Add or Remove Scopes"
7. Add the following scope: `https://www.googleapis.com/auth/drive.readonly`
8. Click "Update" and then "Save and Continue"
9. Add test users (your email) if in testing mode
10. Click "Save and Continue"

### Create OAuth 2.0 Client ID

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Name it "Case Companion Web Client"
5. Add authorized JavaScript origins:
   ```
   http://localhost:5173
   http://localhost:3000
   https://your-production-domain.com
   ```
6. Click "Create"
7. **Save the Client ID** - you'll need this for the next step

### Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API key"
3. **Save the API Key** - you'll need this for the next step
4. (Optional but recommended) Click "Restrict Key":
   - Under "API restrictions", select "Restrict key"
   - Select "Google Drive API" and "Google Picker API"
   - Click "Save"

## Step 4: Configure Environment Variables

Add the following to your `.env` file in the project root:

```env
# Google Drive Integration
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
```

Replace:
- `your-client-id.apps.googleusercontent.com` with your OAuth 2.0 Client ID
- `your-api-key` with your API Key

## Step 5: Deploy Supabase Migrations

Run the database migrations to add support for import jobs and media types:

```bash
# If using Supabase CLI
supabase db push

# Or apply migrations manually through Supabase dashboard
# Upload the following migration files:
# - supabase/migrations/20251228000000_add_media_support.sql
# - supabase/migrations/20251228000001_create_import_jobs.sql
```

## Step 6: Deploy Edge Function

Deploy the Google Drive import edge function to Supabase:

```bash
supabase functions deploy import-google-drive
```

## How to Use

### Importing a Google Drive Folder

1. Navigate to a case in Case Companion
2. Go to the "Documents" tab
3. Click **"Import from Google Drive"** button
4. Click **"Select Google Drive Folder"**
5. Sign in to your Google account (if not already signed in)
6. Grant permissions to access your Google Drive
7. Select the folder you want to import
8. Review the file count preview
9. Click **"Start Import"**

### Monitoring Import Progress

- Import jobs appear in the **"Import Jobs"** section above your documents
- Progress bars show real-time updates
- Click the chevron to expand and see details
- Failed files are listed with error messages
- Imports auto-refresh every 3 seconds while processing

### Supported File Types

#### Documents
- PDF (`.pdf`)
- Microsoft Word (`.doc`, `.docx`)
- Text files (`.txt`)

#### Images
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)

#### Audio
- MP3 (`.mp3`)
- WAV (`.wav`)
- M4A (`.m4a`)
- AAC (`.aac`)
- OGG (`.ogg`)

#### Video
- MP4 (`.mp4`)
- MOV (`.mov`)
- AVI (`.avi`)
- WebM (`.webm`)
- MKV (`.mkv`)

## File Size Limits

- Maximum file size: **500MB** per file
- No limit on total folder size
- Large folders are processed in batches of 5 files at a time

## Processing Details

### Documents & Images
- Automatic OCR (Optical Character Recognition)
- AI-powered analysis with summaries and key findings
- Text extraction for searchability

### Audio & Video (Coming Soon)
- Audio transcription using Whisper AI
- Video frame extraction and analysis
- Full-text search of transcriptions

## Troubleshooting

### "Failed to load Google API"
- Check that your environment variables are set correctly
- Ensure your domain is added to authorized JavaScript origins
- Clear browser cache and try again

### "Unauthorized" or "Invalid credentials"
- Verify your OAuth Client ID and API Key in `.env`
- Make sure the OAuth consent screen is properly configured
- Check that Google Drive API is enabled in your project

### "Failed to import files"
- Check Supabase logs for the `import-google-drive` function
- Verify storage bucket has correct permissions
- Ensure file types are in the allowed MIME types list

### Import stuck at "Processing"
- Check Supabase Edge Function logs
- Verify your Google Drive access token hasn't expired
- Try a smaller folder first to test

## Security Considerations

1. **Read-only access**: The integration only requests `drive.readonly` scope
2. **User-specific**: Each user authenticates with their own Google account
3. **No permanent storage**: Access tokens are used only during import
4. **RLS enabled**: Row-level security ensures users only see their own imports

## Future Enhancements

- [ ] Audio transcription support
- [ ] Video transcription support
- [ ] Folder sync (auto-import new files)
- [ ] Incremental imports (skip already imported files)
- [ ] Dropbox and OneDrive integration
- [ ] Background job queue for very large folders

## Support

For issues or questions, please file an issue in the repository or contact support.
