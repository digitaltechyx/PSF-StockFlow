# Fix for Personal Google Account - Service Account Issue

Since you're using a **personal Google account**, service accounts have storage quota limitations. Here's how to fix it:

## Quick Fix: Verify Folder Sharing

1. **Double-check the folder is shared:**
   - Open "PSF Labels" folder in Google Drive
   - Click "Share" button
   - Verify the service account email (from your JSON file, `client_email` field) is listed
   - Make sure it has **"Editor"** permission (not just Viewer)
   - If not listed, add it with Editor permission

2. **Verify the service account email:**
   - Open `credentials/google-drive-credentials.json`
   - Find the `client_email` field
   - This email should match exactly what's in the folder sharing

3. **Try uploading again**

## If That Doesn't Work

For personal Google accounts, service accounts have strict limitations. The recommended solution is to use **OAuth 2.0** instead, which allows direct access to your Google Drive.

See `GOOGLE_DRIVE_OAUTH_SETUP.md` for OAuth 2.0 setup instructions.

## Alternative: Use Your Personal Drive

If you want to keep using service accounts, you could:
1. Create a folder in your personal Google Drive
2. Share it with the service account
3. Upload files there

But this still has limitations with personal accounts.


