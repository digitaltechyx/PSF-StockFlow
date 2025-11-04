# Fix Redirect URI Mismatch Error

## Error: 400: redirect_uri_mismatch

This error occurs when the redirect URI in your OAuth request doesn't match what's configured in Google Cloud Console.

## Current Configuration

Your `.env.local` has:
- Redirect URI: `http://ims.prepservicesfba.com/api/auth/callback/google`

## Solution

You need to add **all possible redirect URIs** to Google Cloud Console:

### Step 1: Go to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **psf test** (or your project name)
3. Navigate to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (the one ending with `...apps.googleusercontent.com`)
5. Click on it to edit

### Step 2: Add Authorized Redirect URIs

Under **"Authorized redirect URIs"**, add these URIs:

**For Production:**
```
http://ims.prepservicesfba.com/api/auth/callback/google
https://ims.prepservicesfba.com/api/auth/callback/google
```

**For Development (if testing locally):**
```
http://localhost:3000/api/auth/callback/google
```

**Important Notes:**
- URLs are **case-sensitive**
- Must match **exactly** (including `/api/auth/callback/google`)
- Use `http://` for development, `https://` for production if you have SSL
- No trailing slashes

### Step 3: Save and Wait

1. Click **"SAVE"**
2. Wait 1-2 minutes for changes to propagate
3. Try uploading PDF again

### Step 4: Verify Your Current Setup

Your current redirect URI is: `http://ims.prepservicesfba.com/api/auth/callback/google`

Make sure this **exact** URI is in your Google Cloud Console's Authorized redirect URIs list.

## Alternative: Use Localhost for Testing

If you're testing locally, you can temporarily change your `.env.local`:

```bash
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
```

Then add `http://localhost:3000/api/auth/callback/google` to Google Cloud Console.

## Quick Checklist

- [ ] Redirect URI in `.env.local` matches exactly
- [ ] Same URI added to Google Cloud Console
- [ ] Saved changes in Google Cloud Console
- [ ] Waited 1-2 minutes after saving
- [ ] Restarted your dev server (if using localhost)

