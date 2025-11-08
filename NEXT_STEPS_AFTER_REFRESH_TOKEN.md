# Next Steps After Getting Refresh Token

## ✅ You Got the Refresh Token!

Now you need to set it as an environment variable so the app can use it.

---

## Step 1: Copy the Refresh Token

From the success page, copy the entire refresh token (it's a long string).

---

## Step 2: Set Environment Variable

### For Local Development (.env.local)

1. Open your `.env.local` file in the project root
2. Add this line:

```env
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token_here
```

**Example:**
```env
GOOGLE_DRIVE_REFRESH_TOKEN=1//0gabcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ
```

3. **Save** the file
4. **Restart** your development server:
   ```bash
   npm run dev
   ```

### For Vercel (Production)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. **Name**: `GOOGLE_DRIVE_REFRESH_TOKEN`
6. **Value**: Paste your refresh token (the entire string)
7. Select environments: **Production**, **Preview**, **Development** (all of them)
8. Click **Save**
9. **Redeploy** your application (or wait for auto-deploy)

---

## Step 3: Verify Your Environment Variables

Make sure you have all these set:

### Required Environment Variables:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://ims.prepservicesfba.com/api/drive/callback
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token
```

---

## Step 4: Test Upload

1. Go to your application's **Labels** page
2. Click **Upload Labels**
3. Select a PDF file
4. Click **Upload**
5. Check your Google Drive - the file should appear!

---

## ✅ That's It!

Your Google Drive OAuth integration is now complete! Files will be uploaded to your personal Google Drive using your 2TB quota.

---

## 🐛 Troubleshooting

### "No refresh token found"

**Solution**: 
- Make sure `GOOGLE_DRIVE_REFRESH_TOKEN` is set in your environment variables
- Restart your dev server after adding it
- Check Vercel environment variables if in production

### "Failed to refresh access token"

**Solution**:
- Your refresh token may be expired or invalid
- Re-authenticate by going to `/admin/drive-connect` again
- Get a new refresh token

### Upload still fails

**Solution**:
- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Make sure you restarted your dev server after adding the token

---

## 🎉 Success!

Once you've set the refresh token and tested the upload, you're all set! Users can now upload labels, and files will be stored in your personal Google Drive.

