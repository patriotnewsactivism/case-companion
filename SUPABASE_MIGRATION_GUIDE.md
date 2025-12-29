# Migrating from Lovable's Supabase to Your Own

## Why Migrate?

**Benefits:**
- ✅ Direct database access via Supabase Dashboard
- ✅ Full control over edge function deployments
- ✅ Access to real-time logs and monitoring
- ✅ Ability to run SQL queries directly
- ✅ Custom database extensions and optimizations
- ✅ Your own backup and disaster recovery

**What You Keep:**
- ✅ Lovable's hosting and deployment pipeline
- ✅ Git-based deployments on push
- ✅ Environment variable management
- ✅ All your existing code and migrations

## Prerequisites

- [ ] Supabase account at https://supabase.com
- [ ] New Supabase project created (Free tier is fine)
- [ ] Your project's credentials handy
- [ ] Supabase CLI installed: `npm install -g supabase`

## Migration Steps

### Phase 1: Setup Your Supabase Project (30 min)

#### 1.1 Get Your Supabase Credentials

From your Supabase Dashboard → Settings → API:
```
Project URL: https://YOUR_PROJECT.supabase.co
anon/public key: eyJhbGc...
service_role key: eyJhbGc... (keep secret!)
Project Reference ID: YOUR_PROJECT_REF
```

#### 1.2 Link Your Local Project

```bash
cd C:\case-companion
npx supabase link --project-ref YOUR_PROJECT_REF
```

Enter your database password when prompted.

#### 1.3 Apply Schema Migrations

**Option A: Via CLI** (recommended)
```bash
# Apply all migrations from _already_applied folder
cd supabase/migrations/_already_applied
for file in *.sql; do
  npx supabase db execute -f "$file" --project-ref YOUR_PROJECT_REF
done

# Apply new migrations
cd ..
npx supabase db push --project-ref YOUR_PROJECT_REF
```

**Option B: Via Supabase Dashboard** (if CLI fails)
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of each migration file from `supabase/migrations/_already_applied/`
3. Run them in chronological order (by filename timestamp)
4. Then run the new migrations:
   - `20251229050124_secure_storage_bucket.sql`
   - `20251229051925_add_performance_indexes.sql`

### Phase 2: Deploy Edge Functions (15 min)

```bash
# Deploy all edge functions
npx supabase functions deploy create-video-room --project-ref YOUR_PROJECT_REF
npx supabase functions deploy join-video-room --project-ref YOUR_PROJECT_REF
npx supabase functions deploy ocr-document --project-ref YOUR_PROJECT_REF
npx supabase functions deploy transcribe-media --project-ref YOUR_PROJECT_REF
npx supabase functions deploy import-google-drive --project-ref YOUR_PROJECT_REF
npx supabase functions deploy recording-webhook --project-ref YOUR_PROJECT_REF
npx supabase functions deploy transcribe-recording --project-ref YOUR_PROJECT_REF
```

**Verify Deployment:**
```bash
npx supabase functions list --project-ref YOUR_PROJECT_REF
```

### Phase 3: Configure Secrets (10 min)

Set all required environment variables for edge functions:

```bash
# Required for video conferencing
npx supabase secrets set DAILY_API_KEY=014694b5bd863357ff00347ebddd8914465ef71411fac8b48288f921aaa313c8 --project-ref YOUR_PROJECT_REF

# Required for OCR and AI
npx supabase secrets set LOVABLE_API_KEY=YOUR_LOVABLE_KEY --project-ref YOUR_PROJECT_REF

# Required for audio transcription
npx supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_KEY --project-ref YOUR_PROJECT_REF

# Supabase credentials (for edge functions)
npx supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co --project-ref YOUR_PROJECT_REF
npx supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY --project-ref YOUR_PROJECT_REF
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY --project-ref YOUR_PROJECT_REF
```

**Verify Secrets:**
```bash
npx supabase secrets list --project-ref YOUR_PROJECT_REF
```

### Phase 4: Update Frontend Configuration (5 min)

#### 4.1 Update Lovable Environment Variables

In Lovable Dashboard → Settings → Environment Variables:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```

#### 4.2 Update Local .env (for development)

Create/update `.env` file:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF

# Keep your existing Google Drive settings
VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_API_KEY=your-api-key
```

### Phase 5: Data Migration (OPTIONAL - 30 min to 2 hours)

**Only if you have existing data in Lovable's Supabase that you want to keep.**

#### Option A: Fresh Start (Recommended for Testing)
- Skip this phase
- Start with clean database
- Lovable's data remains accessible for reference

#### Option B: Manual Data Export/Import

**Export from Lovable's Supabase:**
1. Go to Lovable's Supabase Dashboard
2. Table Editor → Select table → Export as CSV
3. Repeat for: `cases`, `documents`, `profiles`, `timeline_events`, `import_jobs`, `video_rooms`

**Import to Your Supabase:**
1. Go to YOUR Supabase Dashboard
2. Table Editor → Select table → Insert → Import from CSV
3. Upload each CSV file

#### Option C: Database Dump (Advanced)

If you have direct database access to Lovable's instance:
```bash
# Export
pg_dump -h LOVABLE_HOST -U postgres -d postgres --data-only > backup.sql

# Import
psql -h YOUR_HOST -U postgres -d postgres -f backup.sql
```

### Phase 6: Storage Bucket Setup (10 min)

Your migrations already created the `case-documents` bucket, but verify:

1. Go to Supabase Dashboard → Storage
2. Verify `case-documents` bucket exists
3. Check RLS policies are active
4. **If migrating existing files:**
   - Download from Lovable's Storage (via API or Dashboard)
   - Upload to your Storage bucket

### Phase 7: Testing & Verification (15 min)

#### 7.1 Test Authentication
```bash
npm run dev
```
- Visit http://localhost:8080
- Try logging in
- Verify session persists

#### 7.2 Test Database Operations
- Create a new case
- Upload a document
- Verify data appears in Supabase Dashboard

#### 7.3 Test Edge Functions
- Try OCR on a document
- Create a video room
- Check edge function logs in Supabase Dashboard → Edge Functions → Logs

#### 7.4 Test Storage
- Upload a file
- Verify it appears in Storage bucket
- Download the file

### Phase 8: Deploy to Production (5 min)

```bash
git add .
git commit -m "Switch to own Supabase instance"
git push
```

Lovable will auto-deploy with your new Supabase credentials.

## Post-Migration Checklist

- [ ] All edge functions deployed and working
- [ ] Secrets configured correctly
- [ ] Database schema matches expected structure
- [ ] Storage bucket has correct RLS policies
- [ ] Authentication working (login/logout)
- [ ] Document upload working
- [ ] OCR processing working
- [ ] Video conferencing working
- [ ] Google Drive import working

## Rollback Plan

If something goes wrong, you can instantly rollback:

1. Revert environment variables in Lovable Dashboard to old Supabase
2. Or update `.env` locally with old credentials
3. Push to trigger redeployment

Your Lovable-managed Supabase remains untouched during migration.

## Ongoing Maintenance

### Deploying Edge Functions
After migration, deploy edge functions manually when changed:
```bash
npx supabase functions deploy FUNCTION_NAME --project-ref YOUR_PROJECT_REF
```

### Database Migrations
Apply new migrations:
```bash
npx supabase db push --project-ref YOUR_PROJECT_REF
```
Or via SQL Editor in Supabase Dashboard.

### Monitoring
- **Logs**: Supabase Dashboard → Edge Functions → Logs
- **Database**: Supabase Dashboard → Database → Query Performance
- **Storage**: Supabase Dashboard → Storage → Usage
- **Auth**: Supabase Dashboard → Authentication → Users

## Cost Comparison

**Lovable's Supabase (Managed):**
- Included in Lovable subscription
- Limited access and control
- Auto-scaled by Lovable

**Your Own Supabase:**
- **Free Tier**: 500MB database, 1GB file storage, 2GB bandwidth
- **Pro ($25/mo)**: 8GB database, 100GB storage, 250GB bandwidth
- **Team ($599/mo)**: Higher limits + priority support

**Recommendation**: Start with Free tier, upgrade when needed.

## Support & Troubleshooting

**Common Issues:**

1. **"Migration failed"** - Apply migrations via SQL Editor instead
2. **"Function deployment failed"** - Check function syntax with `deno check`
3. **"Authentication not working"** - Verify VITE_SUPABASE_* env vars are correct
4. **"Storage upload fails"** - Check RLS policies in Storage settings

**Get Help:**
- Supabase Discord: https://discord.supabase.com
- Supabase Docs: https://supabase.com/docs
- GitHub Issues: https://github.com/patriotnewsactivism/case-companion/issues

## Summary

**Total Time: 2-3 hours**
- Setup & Schema: 30 min
- Edge Functions: 15 min
- Secrets: 10 min
- Frontend Config: 5 min
- Data Migration: 0-120 min (optional)
- Storage: 10 min
- Testing: 15 min
- Deploy: 5 min

**Difficulty: 🟢 Easy**
- Your codebase is migration-ready
- All migrations in repo
- Minimal code changes needed
- Can rollback instantly

**Impact on Lovable: ⚠️ Minimal**
- Hosting: No change
- Deployments: No change
- CI/CD: No change
- You just point to different Supabase

**Benefits:**
- Full database control
- Direct access to logs
- SQL query capability
- Custom optimizations
- Better debugging
