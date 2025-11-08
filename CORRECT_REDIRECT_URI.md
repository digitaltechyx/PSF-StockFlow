# Correct Redirect URI for Google OAuth

## ❌ Wrong Redirect URI
```
https://ims.prepservicesfba.com/api/auth/callback
```

## ✅ Correct Redirect URI
```
https://ims.prepservicesfba.com/api/drive/callback
```

---

## 🔧 How to Fix

### Step 1: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your **OAuth 2.0 Client ID**
4. Under **Authorized redirect URIs**, find:
   - `https://ims.prepservicesfba.com/api/auth/callback` ❌
5. **Remove** the wrong one
6. **Add** the correct one:
   - `https://ims.prepservicesfba.com/api/drive/callback` ✅
7. Click **Save**

### Step 2: Update Environment Variable

In **Vercel** (or your hosting platform):

1. Go to **Settings** → **Environment Variables**
2. Find `GOOGLE_REDIRECT_URI`
3. Update it to:
   ```
   https://ims.prepservicesfba.com/api/drive/callback
   ```
4. **Save** and **Redeploy**

### Step 3: Test

1. Go to `/admin/drive-connect` (or `/api/drive/auth`)
2. Click "Connect Google Drive"
3. Sign in with Google
4. You should be redirected to `/api/drive/callback` (not 404!)

---

## 📝 Summary

- **Wrong**: `/api/auth/callback` ❌
- **Correct**: `/api/drive/callback` ✅

The callback route is located at:
- File: `src/app/api/drive/callback/route.ts`
- URL: `https://ims.prepservicesfba.com/api/drive/callback`

---

## ✅ After Fixing

Once you update the redirect URI in Google Cloud Console and Vercel, try authenticating again. The 404 error should be resolved!

