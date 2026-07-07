# CaseBuddy Professional

AI-powered legal case management and trial preparation platform for litigation teams.

## Features

- **AI-Powered Discovery Analysis** - Upload documents and let AI extract key facts, identify inconsistencies, and surface favorable evidence
- **Courtroom Simulator** - 9 simulation modes including cross-examination, depositions, voir dire, and more
- **Trial Prep Checklist** - Track witnesses, exhibits, jury instructions, and motions in limine
- **Document OCR** - Triple-tier OCR with Azure Vision, OCR.space, and Google Gemini fallback
- **Case Timeline** - Auto-generated timeline events from document analysis
- **Video Conferencing** - Built-in Jitsi Meet integration for team collaboration
- **Google Drive Import** - Import discovery documents directly from Google Drive

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI:** OpenAI GPT-4o-mini, Azure Computer Vision, Google Gemini
- **Integrations:** Google Drive, Jitsi Meet, OpenAI Whisper

## Getting Started

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd case-companion

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Anon/public key
- `VITE_SUPABASE_URL` - Supabase API URL
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_GOOGLE_API_KEY` - Google API key

## Deployment

Build for production:

```sh
npm run build
```

Deploy the `/dist` directory to your preferred hosting provider (Vercel, Netlify, etc.).

## Custom Domain

Configure your custom domain through your hosting provider's dashboard and update the Supabase CORS settings accordingly.
