# Google Cloud Setup Guide for Google Drive Integration

This guide will walk you through setting up Google Cloud credentials to enable PDF uploads to Google Drive from your application.

---

## Prerequisites
- A Google account (Gmail account)
- Access to Google Cloud Console

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click on the project dropdown at the top of the page (next to "Google Cloud")
4. Click **"NEW PROJECT"**
5. Fill in the project details:
   - **Project name**: `PSF StockFlow` (or any name you prefer)
   - **Organization**: Leave as default (if applicable)
   - **Location**: Leave as default
6. Click **"CREATE"**
7. Wait for the project to be created (this may take a few seconds)
8. Select your new project from the project dropdown at the top

---

## Step 2: Enable Google Drive API

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Library"** (left sidebar)
2. In the search bar, type: **"Google Drive API"**
3. Click on **"Google Drive API"** from the results
4. Click the **"ENABLE"** button
5. Wait for the API to be enabled (this may take a few seconds)

---

## Step 3: Create a Service Account

A Service Account allows your application to access Google Drive without requiring user authentication.

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Credentials"** (left sidebar)
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"Service Account"** from the dropdown
4. Fill in the service account details:
   - **Service account name**: `psf-drive-uploader` (or any name)
   - **Service account ID**: Will auto-populate (leave as is)
   - **Description**: `Service account for uploading PDFs to Google Drive`
5. Click **"CREATE AND CONTINUE"**
6. **Skip** the "Grant this service account access to project" step (click **"CONTINUE"**)
7. Click **"DONE"**

---

## Step 4: Create and Download Service Account Key

1. You should now see your service account in the credentials list
2. Click on your service account name (e.g., `psf-drive-uploader@your-project.iam.gserviceaccount.com`)
3. Go to the **"KEYS"** tab
4. Click **"ADD KEY"** → **"Create new key"**
5. Select **"JSON"** as the key type
6. Click **"CREATE"**
7. A JSON file will automatically download to your computer
8. **IMPORTANT**: Save this file securely and rename it to `google-drive-credentials.json`
9. **DO NOT** commit this file to Git (it contains sensitive credentials)

---

## Step 5: Create "PSF Labels" Folder in Google Drive

1. Go to [Google Drive](https://drive.google.com/)
2. Click **"+ New"** → **"Folder"**
3. Name the folder: **"PSF Labels"**
4. Click **"CREATE"**
5. Open the **"PSF Labels"** folder you just created

---

## Step 6: Share "PSF Labels" Folder with Service Account

1. While inside the **"PSF Labels"** folder in Google Drive, click the **"Share"** button (top right)
2. In the "Share" dialog, find the email address of your service account:
   - It should look like: `psf-drive-uploader@your-project-name.iam.gserviceaccount.com`
   - You can find this email in the JSON file you downloaded (field: `client_email`)
   - Or go back to Google Cloud Console → Credentials → Service Accounts → Your service account
3. Paste the service account email in the "Add people and groups" field
4. Set the permission to **"Editor"** (or **"Viewer"** if Editor is not available, but Editor is recommended)
5. **Uncheck** "Notify people" (we don't need to notify the service account)
6. Click **"Share"**
7. You should see a confirmation that the folder is shared

---

## Step 7: Get Your Folder ID

1. In Google Drive, navigate to the **"PSF Labels"** folder
2. Look at the URL in your browser's address bar
   - It should look like: `https://drive.google.com/drive/folders/1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV`
3. The long string after `/folders/` is your **Folder ID**
   - Example: `1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV`
4. Copy this Folder ID - you'll need it for your application

---

## Step 8: Save Credentials in Your Project

1. Create a folder called `credentials` in your project root (if it doesn't exist)
2. Place your `google-drive-credentials.json` file inside the `credentials` folder
3. **Add to .gitignore** (if not already there):
   ```
   credentials/
   *.json
   google-drive-credentials.json
   ```
4. **IMPORTANT**: Make sure `.gitignore` includes these entries so credentials are NOT committed to Git

---

## Step 9: Install Required Packages

Run this command in your project directory:

```bash
npm install googleapis
```

Or if using yarn:

```bash
yarn add googleapis
```

---

## What You Need to Provide

After completing these steps, you'll need:

1. ✅ **Service Account JSON file**: `google-drive-credentials.json` (in `credentials/` folder)
2. ✅ **Folder ID**: The ID of your "PSF Labels" folder from Google Drive
3. ✅ **Project ID**: Your Google Cloud Project ID (found in the JSON file or Cloud Console)

---

## Verification Checklist

- [ ] Google Cloud Project created
- [ ] Google Drive API enabled
- [ ] Service Account created
- [ ] Service Account JSON key downloaded and saved
- [ ] "PSF Labels" folder created in Google Drive
- [ ] "PSF Labels" folder shared with Service Account email (Editor permission)
- [ ] Folder ID copied and ready
- [ ] Credentials file placed in `credentials/` folder
- [ ] `.gitignore` updated to exclude credentials
- [ ] `googleapis` package installed

---

## Troubleshooting

### Issue: "Permission denied" when uploading
- **Solution**: Make sure the "PSF Labels" folder is shared with the service account email with at least "Editor" permission

### Issue: "API not enabled" error
- **Solution**: Go back to Step 2 and ensure Google Drive API is enabled for your project

### Issue: Can't find service account email
- **Solution**: Open the JSON file you downloaded, look for the `client_email` field - that's your service account email

### Issue: Folder ID not working
- **Solution**: Make sure you copied the entire Folder ID from the URL (it's the long string after `/folders/`)

---

## Next Steps

Once you've completed all the steps above, let me know and I'll help you:
1. Set up environment variables
2. Create the backend API route for file upload
3. Implement the PDF upload feature in the user dashboard
4. Add the admin dashboard view for uploaded PDFs

---

## Security Notes

⚠️ **IMPORTANT SECURITY REMINDERS:**
- Never commit the JSON credentials file to Git
- Never share your service account credentials publicly
- Keep your credentials file secure and backed up
- Only share the "PSF Labels" folder with the service account (don't share your entire Drive)
- Regularly rotate credentials if compromised

---

If you encounter any issues during setup, let me know and I'll help you troubleshoot!



