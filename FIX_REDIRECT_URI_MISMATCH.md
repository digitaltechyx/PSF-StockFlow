# Fix redirect_uri_mismatch Error

## Problem
You're getting `Error 400: redirect_uri_mismatch` from Google. This means the redirect URI in your authorization request doesn't match what's registered in Google Cloud Console.

## Solution

### Step 1: Check Current Redirect URI

From the error, Google is trying to redirect to:
```
https://ims.prepservicesfba.com/api/drive/callback
```

### Step 2: Add Exact Redirect URI in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your **OAuth 2.0 Client ID**
4. Scroll down to **Authorized redirect URIs**
5. Click **+ ADD URI**
6. Add **exactly** this (copy-paste to avoid typos):
   ```
   https://ims.prepservicesfba.com/api/drive/callback
   ```
7. **Important checks:**
   - ✅ Must start with `https://` (not `http://`)
   - ✅ No trailing slash at the end
   - ✅ Exact match: `/api/drive/callback` (not `/api/auth/callback`)
   - ✅ No extra spaces before or after
8. Click **Save**

### Step 3: Wait a Few Minutes

After saving, wait 2-3 minutes for Google to update the settings.

### Step 4: Try Again

1. Go to `/admin/drive-connect` or `/api/drive/auth`
2. Click "Connect Google Drive"
3. Sign in with Google
4. The redirect should work now!

---

## Common Issues

### Issue 1: Typo in Redirect URI
- ❌ `https://ims.prepservicesfba.com/api/drive/callback/` (trailing slash)
- ❌ `https://ims.prepservicesfba.com/api/auth/callback` (wrong path)
- ✅ `https://ims.prepservicesfba.com/api/drive/callback` (correct)

### Issue 2: HTTP vs HTTPS
- ❌ `http://ims.prepservicesfba.com/api/drive/callback` (HTTP)
- ✅ `https://ims.prepservicesfba.com/api/drive/callback` (HTTPS)

### Issue 3: Not Saved
- Make sure you clicked **Save** after adding the URI
- Wait a few minutes for changes to propagate

### Issue 4: Multiple OAuth Clients
- Make sure you're editing the **correct** OAuth client ID
- Check that the `client_id` in your environment variable matches

---

## Verify Your Setup

1. **Google Cloud Console:**
   - Redirect URI: `https://ims.prepservicesfba.com/api/drive/callback` ✅

2. **Vercel Environment Variable:**
   - `GOOGLE_REDIRECT_URI=https://ims.prepservicesfba.com/api/drive/callback` ✅

3. **Authorization URL:**
   - Should include: `redirect_uri=https%3A%2F%2Fims.prepservicesfba.com%2Fapi%2Fdrive%2Fcallback` ✅

---

## Still Not Working?

1. **Double-check the exact URI:**
   - Copy the redirect URI from the error message
   - Paste it exactly into Google Cloud Console

2. **Check for multiple entries:**
   - Remove any old/incorrect redirect URIs
   - Keep only the correct one

3. **Verify OAuth Client ID:**
   - Make sure `GOOGLE_CLIENT_ID` in your environment matches the one in Google Cloud Console

4. **Clear browser cache:**
   - Sometimes cached redirects cause issues
   - Try in incognito/private mode

---

## Quick Checklist

- [ ] Redirect URI added in Google Cloud Console: `https://ims.prepservicesfba.com/api/drive/callback`
- [ ] No trailing slash
- [ ] Using `https://` (not `http://`)
- [ ] Clicked **Save** in Google Cloud Console
- [ ] Waited 2-3 minutes after saving
- [ ] `GOOGLE_REDIRECT_URI` set in Vercel
- [ ] Tried authenticating again

---

After fixing, try authenticating again. The `redirect_uri_mismatch` error should be resolved!

