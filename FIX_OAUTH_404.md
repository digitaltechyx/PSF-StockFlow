# Fix OAuth 404 Error

## Problem
You're getting a 404 error after signing in with Google. This means the callback route isn't being found.

## Solutions

### Solution 1: Check Redirect URI in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your **OAuth 2.0 Client ID**
4. Check **Authorized redirect URIs**
5. Make sure you have **exactly** this URL:
   ```
   https://yourdomain.com/api/drive/callback
   ```
   (Replace `yourdomain.com` with your actual domain)

6. For local development, also add:
   ```
   http://localhost:3000/api/drive/callback
   ```

7. Click **Save**

### Solution 2: Verify Route is Deployed

Make sure the callback route file exists:
- `src/app/api/drive/callback/route.ts`

After pushing to git, make sure it's deployed to your hosting platform (Vercel).

### Solution 3: Check Environment Variables

Make sure `GOOGLE_REDIRECT_URI` matches exactly:

**For Production:**
```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/drive/callback
```

**For Local:**
```env
GOOGLE_REDIRECT_URI=http://localhost:3000/api/drive/callback
```

### Solution 4: Test the Route Directly

Try accessing the callback route directly:
- Production: `https://yourdomain.com/api/drive/callback`
- Local: `http://localhost:3000/api/drive/callback`

If you get a 404, the route isn't deployed. If you see a message, the route is working.

## Quick Checklist

- [ ] Redirect URI added in Google Cloud Console
- [ ] Redirect URI matches exactly (no trailing slash, correct protocol)
- [ ] Route file exists: `src/app/api/drive/callback/route.ts`
- [ ] Changes pushed to git
- [ ] Deployed to production
- [ ] `GOOGLE_REDIRECT_URI` environment variable set correctly

## Common Mistakes

1. **Trailing slash**: 
   - ❌ `https://yourdomain.com/api/drive/callback/`
   - ✅ `https://yourdomain.com/api/drive/callback`

2. **Wrong protocol**:
   - ❌ `http://yourdomain.com/api/drive/callback` (for production)
   - ✅ `https://yourdomain.com/api/drive/callback` (for production)

3. **Route not deployed**:
   - Make sure you've pushed changes and they're deployed

## After Fixing

1. Go to `/admin/drive-connect` (or `/api/drive/auth`)
2. Click "Connect Google Drive"
3. Sign in with Google
4. You should be redirected to `/api/drive/callback` (not 404)
5. You'll see a success page with your refresh token

