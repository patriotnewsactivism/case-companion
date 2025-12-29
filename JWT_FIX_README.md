# Video Room JWT Validation Fix

## Problem
The video room edge functions (`create-video-room` and `join-video-room`) were returning 401 "Invalid JWT" errors due to a **project ID mismatch** between the database, frontend configuration, and edge functions.

## Root Cause
- The `DATABASE_URL` was pointing to project `czrqlvvjrwizwdyefldo`
- All frontend Supabase configuration (`VITE_SUPABASE_*`) was pointing to project `usyxikgqkcnlzobnqhtz`
- The `config.toml` was configured for project `usyxikgqkcnlzobnqhtz`
- This caused JWTs issued by the frontend to be invalid when verified by the edge functions

## Changes Made

### 1. Updated `.env` file
- Changed `DATABASE_URL` from `czrqlvvjrwizwdyefldo` to `usyxikgqkcnlzobnqhtz` to align with frontend configuration
- All Supabase-related environment variables now consistently use project `usyxikgqkcnlzobnqhtz`

### 2. Updated `CLAUDE.md`
- Changed current project ID from `czrqlvvjrwizwdyefldo` to `usyxikgqkcnlzobnqhtz` for documentation accuracy

### 3. Enhanced `src/hooks/useAuth.tsx`
- Added error handling to detect and clear invalid sessions automatically
- When a session validation error occurs (e.g., JWT from wrong project), the hook now:
  - Logs the error
  - Signs out the user
  - Clears the session state
  - Forces re-authentication

### 4. Enhanced `src/hooks/useVideoRoom.ts`
- Added specific error handling for authentication errors (401/Unauthorized/Invalid JWT)
- Provides user-friendly error messages suggesting to log out and log back in
- Extended toast notification duration for auth errors to ensure visibility

## Testing Steps

### 1. Clear Local Storage (Important!)
If users have cached JWT tokens from the old project, they need to clear them:
```javascript
// In browser console:
localStorage.clear();
```
Or simply **log out and log back in**.

### 2. Restart Development Server
Since we changed `VITE_*` environment variables, rebuild is required:
```bash
npm run dev
```

### 3. Test Video Room Creation
1. Log in to the application
2. Navigate to a case
3. Go to the "Video Rooms" tab
4. Click "Create Video Room"
5. Fill in room details and submit
6. **Expected**: Room should be created successfully without 401 errors

### 4. Test Video Room Joining
1. After creating a room, try to join it
2. **Expected**: Should receive a join token and access the room without errors

## Technical Details

### JWT Verification Flow
1. Frontend calls `supabase.functions.invoke('create-video-room', ...)`
2. Supabase client automatically includes JWT in `Authorization: Bearer <token>` header
3. Edge function has `verify_jwt = false` in `config.toml`, so manual verification is used
4. Edge function extracts token and validates it using `supabase.auth.getUser(token)`
5. Validation succeeds only if:
   - Token is not expired
   - Token was issued by the same Supabase project
   - Token format is valid

### Why the Fix Works
- All components now use the same project (`usyxikgqkcnlzobnqhtz`)
- JWTs issued by frontend authentication are for the correct project
- Edge functions can successfully validate these JWTs
- Session management automatically clears invalid tokens

## Deployment Notes

### For Production Deployment
1. Ensure environment variables are updated on the hosting platform
2. Rebuild the application to incorporate new `VITE_*` variables
3. Consider deploying edge functions to ensure `config.toml` changes are applied
4. Monitor logs for any authentication errors
5. Users may need to log out and back in after deployment

### Edge Function Deployment
If edge functions need to be redeployed:
```bash
supabase functions deploy create-video-room
supabase functions deploy join-video-room
```

## Related Files
- `.env` - Environment configuration
- `supabase/config.toml` - Edge function configuration
- `src/hooks/useAuth.tsx` - Authentication hook with session validation
- `src/hooks/useVideoRoom.ts` - Video room operations with enhanced error handling
- `src/integrations/supabase/client.ts` - Supabase client initialization
- `supabase/functions/create-video-room/index.ts` - Edge function that validates JWTs
- `supabase/functions/join-video-room/index.ts` - Edge function that validates JWTs

## Troubleshooting

### If 401 errors persist:
1. **Clear browser localStorage** completely
2. **Log out and log back in** to get a fresh JWT
3. **Restart the dev server** to ensure new env vars are loaded
4. **Check browser console** for specific error messages
5. **Verify .env file** has correct project ID in all fields

### If users can't log in at all:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct for project `usyxikgqkcnlzobnqhtz`
2. Check that the database is accessible at the new URL
3. Ensure RLS policies allow user authentication

## Additional Notes
- The `verify_jwt = false` setting in `config.toml` is intentional - it disables Supabase's automatic JWT verification to allow manual verification in the edge function code
- This provides more control over error handling and logging
- The edge functions still validate JWTs, just manually using `supabase.auth.getUser(token)`
