# OneDrive Integration - Credentials Needed

## ✅ Implementation Complete!

The OneDrive integration has been successfully implemented. All labels will now be uploaded to the admin's OneDrive account with the same folder structure as before.

## ⚠️ Important: Microsoft Update

**Microsoft has deprecated creating applications outside of a directory.** You **must have an Azure Active Directory (tenant/directory)** to register your application.

If you don't have an Azure directory yet:
- **Option 1**: Sign up for Azure (free): https://portal.azure.com/
- **Option 2**: Join M365 Developer Program (free): https://developer.microsoft.com/microsoft-365/dev-program

See `MICROSOFT_UPDATE_NOTICE.md` for more details.

## 📋 Credentials You Need to Get

To complete the setup, you need to obtain the following **4 credentials** from Azure Portal:

### 1. **ONEDRIVE_CLIENT_ID** (Application/Client ID)
- **Where to find**: Azure Portal → App registrations → Your app → Overview
- **What it is**: The Application (client) ID of your registered app
- **Example**: `12345678-1234-1234-1234-123456789abc`

### 2. **ONEDRIVE_CLIENT_SECRET** (Client Secret Value)
- **Where to find**: Azure Portal → App registrations → Your app → Certificates & secrets
- **What it is**: The **Value** (not the Secret ID) of a client secret
- **Important**: You must create this secret and copy the **Value** immediately (you won't see it again)
- **Example**: `abc123~xyz789...`

### 3. **ONEDRIVE_TENANT_ID** (Directory/Tenant ID)
- **Where to find**: Azure Portal → App registrations → Your app → Overview
- **What it is**: The Directory (tenant) ID
- **Example**: `87654321-4321-4321-4321-cba987654321`

### 4. **ONEDRIVE_REFRESH_TOKEN** (OAuth Refresh Token)
- **Where to find**: This requires a one-time OAuth flow to get
- **What it is**: A refresh token that allows the app to get new access tokens
- **How to get**: Follow Step 6 in `ONEDRIVE_SETUP_GUIDE.md`
- **Example**: `0.abc123def456...`

## 📝 Quick Setup Steps

1. **Register App in Azure Portal** (5 minutes)
   - Go to https://portal.azure.com/
   - Create a new app registration
   - Get Client ID and Tenant ID

2. **Create Client Secret** (2 minutes)
   - Go to Certificates & secrets
   - Create new secret
   - **Copy the Value immediately**

3. **Configure API Permissions** (3 minutes)
   - Add Microsoft Graph permissions:
     - `Files.ReadWrite`
     - `Files.ReadWrite.All`
     - `offline_access`
     - `User.Read`
   - Grant admin consent

4. **Get Refresh Token** (5 minutes)
   - Follow the OAuth flow (see `ONEDRIVE_SETUP_GUIDE.md` Step 6)
   - Exchange authorization code for tokens
   - Copy the `refresh_token`

5. **Add to Environment Variables** (1 minute)
   - Add all 4 credentials to your `.env.local` file:
   ```env
   ONEDRIVE_CLIENT_ID=your_client_id_here
   ONEDRIVE_CLIENT_SECRET=your_client_secret_here
   ONEDRIVE_TENANT_ID=your_tenant_id_here
   ONEDRIVE_REFRESH_TOKEN=your_refresh_token_here
   ```

## 📚 Detailed Instructions

For detailed step-by-step instructions, see: **`ONEDRIVE_SETUP_GUIDE.md`**

## ✨ What's Changed

- ✅ Upload system now uses OneDrive instead of Firebase Storage
- ✅ Same folder structure maintained: `Year/Month/Client Name/Date/FileName.pdf`
- ✅ No file size restrictions (OneDrive supports large files)
- ✅ All files stored in admin's OneDrive account
- ✅ Users can upload without restrictions
- ✅ Automatic token refresh handled by the application

## 🔒 Security Notes

- **Never commit credentials to Git**
- Keep your `.env.local` file secure
- The refresh token will be automatically refreshed
- If the refresh token expires, you'll need to get a new one

## 🚀 After Setup

Once you've added the credentials:
1. Restart your development server
2. Navigate to the Labels page
3. Try uploading a PDF
4. Check your OneDrive to verify the upload

## ❓ Need Help?

If you encounter any issues:
1. Check `ONEDRIVE_SETUP_GUIDE.md` for troubleshooting
2. Verify all 4 credentials are correct
3. Ensure API permissions are granted
4. Check server logs for detailed error messages

