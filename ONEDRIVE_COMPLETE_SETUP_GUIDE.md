# OneDrive Integration - Complete Setup Guide

**Everything you need to set up OneDrive integration for PSF StockFlow in one place.**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Important: Microsoft Update](#important-microsoft-update)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Credentials Summary](#credentials-summary)
6. [Troubleshooting](#troubleshooting)
7. [Security Best Practices](#security-best-practices)

---

## Overview

This guide will help you set up OneDrive integration for the PSF StockFlow application. All labels will be uploaded to the admin's OneDrive account with the same folder structure as before:

```
Year/
  └── Month/
      └── Client Name/
          └── Date (YYYY-MM-DD)/
              └── FileName.pdf
```

**Example:**
```
2024/
  └── January/
      └── John Doe/
          └── 2024-01-15/
              └── label.pdf
```

### What's Changed

- ✅ Upload system now uses OneDrive instead of Firebase Storage
- ✅ Same folder structure maintained
- ✅ No file size restrictions (OneDrive supports large files)
- ✅ All files stored in admin's OneDrive account
- ✅ Users can upload without restrictions
- ✅ Automatic token refresh handled by the application

---

## Important: Microsoft Update

### ⚠️ Critical Requirement

**Microsoft has deprecated the ability to create applications outside of a directory.** You **MUST have an Azure Active Directory (tenant/directory)** to register your application.

If you see this message when trying to register an app:
> "The ability to create applications outside of a directory has been deprecated. You may get a new directory by joining the M365 Developer Program or signing up for Azure."

You need to get an Azure directory first.

### How to Get an Azure Directory

If you don't have an Azure directory yet, choose one of these **FREE** options:

#### Option 1: Sign Up for Azure (Recommended)

1. Go to [Azure Portal](https://portal.azure.com/)
2. Click **Start free** or **Sign up**
3. Create a free Azure account
4. This automatically creates an Azure Active Directory (tenant) for you
5. **Benefits:**
   - $200 in free credits
   - 12 months of free services
   - Free forever tier for many services
   - No credit card required for free tier

#### Option 2: Join M365 Developer Program

1. Go to [Microsoft 365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program)
2. Sign up for free
3. Get a developer tenant with:
   - Office 365 E5 subscription
   - Azure Active Directory
   - 25 user licenses
   - Valid for 90 days (renewable)

**Note:** Both options are free and will give you the directory you need.

---

## Prerequisites

Before starting, make sure you have:

- ✅ A Microsoft account (personal or work/school account)
- ✅ **An Azure Active Directory (Tenant/Directory)** - Required (see above if you don't have one)
- ✅ Access to Azure Portal (for app registration)
- ✅ Admin account credentials for OneDrive

---

## Step-by-Step Setup

### Step 1: Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign in with your Microsoft account (**make sure you have an Azure directory**)
3. Navigate to **Azure Active Directory** → **App registrations**
4. Click **New registration**

5. Fill in the application details:
   - **Name**: `PSF StockFlow OneDrive Integration` (or any name you prefer)
   - **Supported account types**: 
     - Select **Accounts in any organizational directory and personal Microsoft accounts**
     - OR **Accounts in this organizational directory only** (if you only want your organization)
   - **Redirect URI**: 
     - Platform: **Web**
     - URI: `http://localhost:3000/api/auth/callback` (for development)
     - For production, add your production URL: `https://yourdomain.com/api/auth/callback`

6. Click **Register**

**Note:** If you see a message about creating applications outside of a directory being deprecated, make sure you're signed in to an Azure account with a directory. If you don't have one, follow the steps above to get an Azure directory.

---

### Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add the following permissions:
   - `Files.ReadWrite` - Read and write files in user's OneDrive
   - `Files.ReadWrite.All` - Read and write all files user can access
   - `offline_access` - Maintain access to data you have given it access to
   - `User.Read` - Sign in and read user profile

6. Click **Add permissions**
7. **Important:** Click **Grant admin consent** (if you're an admin) or request admin consent

---

### Step 3: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description: `PSF StockFlow Secret`
4. Choose expiration (recommended: 24 months)
5. Click **Add**
6. **⚠️ CRITICAL:** Copy the **Value** immediately (you won't be able to see it again!)
   - This is your `ONEDRIVE_CLIENT_SECRET`
   - Save it somewhere safe

---

### Step 4: Get Application (Client) ID

1. In your app registration, go to **Overview**
2. Copy the **Application (client) ID**
   - This is your `ONEDRIVE_CLIENT_ID`
   - Example format: `12345678-1234-1234-1234-123456789abc`

---

### Step 5: Get Directory (Tenant) ID

1. In your app registration, go to **Overview**
2. Copy the **Directory (tenant) ID**
   - This is your `ONEDRIVE_TENANT_ID`
   - Example format: `87654321-4321-4321-4321-cba987654321`

---

### Step 6: Get Refresh Token (Initial Setup)

You need to get an initial refresh token. This is a **one-time process**:

#### Method 1: Using Browser and Command Line (Recommended)

1. **Construct the authorization URL:**
   ```
   https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize?
   client_id={CLIENT_ID}
   &response_type=code
   &redirect_uri={REDIRECT_URI}
   &response_mode=query
   &scope=https://graph.microsoft.com/Files.ReadWrite.All offline_access
   &state=12345
   ```

2. **Replace the placeholders:**
   - `{TENANT_ID}` → Your Directory (tenant) ID from Step 5
   - `{CLIENT_ID}` → Your Application (client) ID from Step 4
   - `{REDIRECT_URI}` → Your redirect URI (URL encoded)
     - For development: `http://localhost:3000/api/auth/callback`
     - URL encoded: `http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback`

3. **Example URL:**
   ```
   https://login.microsoftonline.com/87654321-4321-4321-4321-cba987654321/oauth2/v2.0/authorize?client_id=12345678-1234-1234-1234-123456789abc&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback&response_mode=query&scope=https://graph.microsoft.com/Files.ReadWrite.All offline_access&state=12345
   ```

4. **Open this URL in a browser** and sign in with the **admin's Microsoft account**
5. **Grant permissions** when prompted
6. You'll be redirected to your redirect URI with a `code` parameter in the URL
   - Example: `http://localhost:3000/api/auth/callback?code=0.abc123...&state=12345`
   - Copy the `code` value (everything after `code=` and before `&`)

7. **Exchange the code for tokens** using this command (replace placeholders):

   ```bash
   curl -X POST https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "client_id={CLIENT_ID}" \
     -d "client_secret={CLIENT_SECRET}" \
     -d "code={AUTHORIZATION_CODE}" \
     -d "redirect_uri={REDIRECT_URI}" \
     -d "grant_type=authorization_code"
   ```

   **Example:**
   ```bash
   curl -X POST https://login.microsoftonline.com/87654321-4321-4321-4321-cba987654321/oauth2/v2.0/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "client_id=12345678-1234-1234-1234-123456789abc" \
     -d "client_secret=abc123~xyz789..." \
     -d "code=0.abc123def456..." \
     -d "redirect_uri=http://localhost:3000/api/auth/callback" \
     -d "grant_type=authorization_code"
   ```

8. **From the response**, copy the `refresh_token` value
   - This is your `ONEDRIVE_REFRESH_TOKEN`
   - Save it securely

#### Method 2: Using Postman or Similar Tool

1. Use Postman to make the OAuth 2.0 request
2. Follow the same flow as Method 1
3. Extract the refresh token from the response

---

### Step 7: Add Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# OneDrive Integration Credentials
ONEDRIVE_CLIENT_ID=your_client_id_here
ONEDRIVE_CLIENT_SECRET=your_client_secret_here
ONEDRIVE_TENANT_ID=your_tenant_id_here
ONEDRIVE_REFRESH_TOKEN=your_refresh_token_here
```

**Important Notes:**
- ⚠️ **Never commit these credentials to version control**
- ⚠️ Keep your `.env.local` file secure
- ✅ The refresh token will be automatically refreshed by the application
- ⚠️ If the refresh token expires, you'll need to get a new one using Step 6

---

### Step 8: Test the Integration

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the Labels page** in your application

3. **Try uploading a PDF file**

4. **Check your OneDrive** to verify the file was uploaded with the correct folder structure:
   - `Year/Month/Client Name/Date/FileName.pdf`

---

## Credentials Summary

You need **4 credentials** total. Here's where to find each one:

| Credential | Where to Find | Step |
|------------|---------------|------|
| **ONEDRIVE_CLIENT_ID** | Azure Portal → App registrations → Your app → Overview → Application (client) ID | Step 4 |
| **ONEDRIVE_CLIENT_SECRET** | Azure Portal → App registrations → Your app → Certificates & secrets → **Value** (copy immediately!) | Step 3 |
| **ONEDRIVE_TENANT_ID** | Azure Portal → App registrations → Your app → Overview → Directory (tenant) ID | Step 5 |
| **ONEDRIVE_REFRESH_TOKEN** | OAuth flow (one-time process) - See Step 6 | Step 6 |

### Quick Checklist

- [ ] Azure directory created (if needed)
- [ ] App registered in Azure Portal
- [ ] API permissions configured and granted
- [ ] Client secret created and copied
- [ ] Client ID copied
- [ ] Tenant ID copied
- [ ] Refresh token obtained
- [ ] All 4 credentials added to `.env.local`
- [ ] Application tested

---

## Troubleshooting

### Error: "Failed to get access token"

**Possible causes:**
- Environment variables not set correctly
- Refresh token expired or invalid
- Client secret expired

**Solutions:**
1. Check that all 4 environment variables are set in `.env.local`
2. Verify the refresh token is still valid
3. Check if the client secret has expired (create a new one if needed)
4. Restart your development server after updating environment variables

---

### Error: "Failed to upload file to OneDrive"

**Possible causes:**
- API permissions not granted
- Admin consent not given
- Refresh token doesn't have correct scopes

**Solutions:**
1. Go to Azure Portal → App registrations → Your app → API permissions
2. Verify all required permissions are added:
   - `Files.ReadWrite`
   - `Files.ReadWrite.All`
   - `offline_access`
   - `User.Read`
3. Click **Grant admin consent** (if you're an admin)
4. Verify the refresh token was obtained with the correct scopes

---

### Error: "Folder not found" or "Permission denied"

**Possible causes:**
- App doesn't have `Files.ReadWrite.All` permission
- Admin consent not granted
- Microsoft account doesn't have OneDrive access

**Solutions:**
1. Ensure the app has `Files.ReadWrite.All` permission
2. Verify admin consent was granted
3. Check that the Microsoft account has OneDrive access
4. Try signing in to OneDrive directly to verify access

---

### Refresh Token Expired

**What to do:**
1. Go through Step 6 again to get a new refresh token
2. Update the `ONEDRIVE_REFRESH_TOKEN` in your `.env.local` file
3. Restart your application

**Note:** The application will automatically refresh tokens, but if the refresh token itself expires, you'll need to get a new one.

---

### "Creating applications outside of a directory has been deprecated"

**What this means:**
- You don't have an Azure Active Directory (tenant/directory)
- You need to get one first

**Solution:**
1. Follow the instructions in the [Important: Microsoft Update](#important-microsoft-update) section
2. Sign up for Azure or join M365 Developer Program (both are free)
3. Once you have a directory, continue with Step 1

---

## Security Best Practices

1. **Never expose credentials**
   - Keep all credentials in environment variables
   - Never commit `.env.local` to version control
   - Use `.gitignore` to exclude environment files

2. **Use HTTPS in production**
   - Always use HTTPS for production deployments
   - Never send credentials over unencrypted connections

3. **Rotate secrets regularly**
   - Update client secrets periodically
   - Update refresh tokens if they expire
   - Monitor Azure Portal for any suspicious activity

4. **Limit permissions**
   - Only grant the minimum permissions required
   - Regularly review API permissions in Azure Portal

5. **Monitor access**
   - Regularly check Azure Portal for any suspicious activity
   - Review application logs for unusual patterns

---

## Support

If you encounter any issues:

1. **Check the browser console** for error messages
2. **Check the server logs** for detailed error information
3. **Verify all credentials** are correct in `.env.local`
4. **Ensure all API permissions** are granted in Azure Portal
5. **Restart your development server** after making changes

---

## Next Steps

After setting up the credentials:

1. ✅ The application will automatically handle token refresh
2. ✅ Users can upload labels without any restrictions
3. ✅ All files will be stored in the admin's OneDrive
4. ✅ The same folder structure will be maintained
5. ✅ No file size restrictions (OneDrive supports large files)

---

## Quick Reference

### All Required Credentials

```env
ONEDRIVE_CLIENT_ID=your_client_id_here
ONEDRIVE_CLIENT_SECRET=your_client_secret_here
ONEDRIVE_TENANT_ID=your_tenant_id_here
ONEDRIVE_REFRESH_TOKEN=your_refresh_token_here
```

### Required API Permissions

- `Files.ReadWrite`
- `Files.ReadWrite.All`
- `offline_access`
- `User.Read`

### Folder Structure

```
Year/Month/Client Name/Date/FileName.pdf
```

---

**That's it! You now have everything you need to set up OneDrive integration. Follow the steps in order, and you'll be up and running in no time.**

