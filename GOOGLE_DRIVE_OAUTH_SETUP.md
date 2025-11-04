# Google Drive OAuth 2.0 Setup for Personal Google Accounts

Since you're using a **personal Google account**, service accounts have storage quota limitations. We'll use **OAuth 2.0** instead, which allows direct access to your Google Drive.

---

## Important Note

**For personal Google accounts**, OAuth 2.0 is the recommended approach. Service accounts can work but have limitations with storage quota.

---

## Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **"APIs & Services"** → **"Credentials"**
4. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
5. If prompted, configure the OAuth consent screen first:
   - Choose **"External"** (for personal accounts)
   - Fill in the required information:
     - App name: `PSF StockFlow`
     - User support email: Your email
     - Developer contact: Your email
   - Click **"SAVE AND CONTINUE"**
   - Add scopes: `https://www.googleapis.com/auth/drive.file`
   - Click **"SAVE AND CONTINUE"**
   - Add test users (your email) if needed
   - Click **"SAVE AND CONTINUE"**
   - Click **"BACK TO DASHBOARD"**

6. Now create OAuth client ID:
   - Application type: **"Web application"**
   - Name: `PSF StockFlow Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)
   - Click **"CREATE"**

7. **Copy the Client ID and Client Secret** - you'll need these for your `.env.local` file

---

## Step 2: Update Environment Variables

Add these to your `.env.local` file:

```bash
GOOGLE_DRIVE_CLIENT_ID=your_client_id_here
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret_here
GOOGLE_DRIVE_FOLDER_ID=1cnz3Uv-CdReOq9zbfqoPhQOelwVIxtmW
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google
```

---

## Step 3: Install Required Packages

```bash
npm install next-auth @auth/google-provider
```

---

## Alternative: Try Service Account Workaround

If you want to stick with service accounts, try this workaround:

1. **Ensure the folder is properly shared:**
   - Open "PSF Labels" folder in Google Drive
   - Click "Share"
   - Add the service account email (from JSON file, `client_email` field)
   - Grant **"Editor"** permission
   - Make sure "Notify people" is unchecked

2. **Verify folder permissions:**
   - The service account should be able to see the folder when accessing it directly

3. **Try uploading again**

If this still doesn't work, OAuth 2.0 is the recommended solution for personal Google accounts.

---

## Which Approach Should I Use?

- **Service Account**: Works best with Google Workspace accounts, has limitations with personal accounts
- **OAuth 2.0**: Works with both personal and Workspace accounts, requires user authentication

For personal accounts, **OAuth 2.0 is recommended**.


