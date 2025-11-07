# OneDrive Integration Setup Guide

This guide will help you set up OneDrive integration for the PSF StockFlow application. All labels will be uploaded to the admin's OneDrive account with the same folder structure as before.

## Prerequisites

- A Microsoft account (personal or work/school account)
- **An Azure Active Directory (Tenant/Directory)** - Required for app registration
- Access to Azure Portal (for app registration)
- Admin account credentials for OneDrive

## Important: Microsoft Update (2024/2025)

**Microsoft has deprecated the ability to create applications outside of a directory.** You must have an Azure Active Directory (tenant) to register an application.

### How to Get an Azure Directory

If you don't have an Azure directory yet, you have two options:

#### Option 1: Sign Up for Azure (Recommended)
1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign up for a free Azure account
3. This automatically creates an Azure Active Directory (tenant) for you
4. You'll get $200 in free credits and 12 months of free services

#### Option 2: Join M365 Developer Program
1. Go to [Microsoft 365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program)
2. Sign up for free
3. This gives you a developer tenant with Office 365 and Azure AD

**Note:** Both options are free and will give you the directory you need to register your application.

## Step 1: Register Application in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign in with your Microsoft account (make sure you have an Azure directory)
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

## Step 2: Configure API Permissions

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
7. Click **Grant admin consent** (if you're an admin) or request admin consent

## Step 3: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description: `PSF StockFlow Secret`
4. Choose expiration (recommended: 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the **Value** immediately (you won't be able to see it again)
   - This is your `ONEDRIVE_CLIENT_SECRET`

## Step 4: Get Application (Client) ID

1. In your app registration, go to **Overview**
2. Copy the **Application (client) ID**
   - This is your `ONEDRIVE_CLIENT_ID`

## Step 5: Get Directory (Tenant) ID

1. In your app registration, go to **Overview**
2. Copy the **Directory (tenant) ID**
   - This is your `ONEDRIVE_TENANT_ID`

## Step 6: Get Refresh Token (Initial Setup)

You need to get an initial refresh token. This is a one-time process:

### Option A: Using OAuth Flow (Recommended for Production)

1. Construct the authorization URL:
   ```
   https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize?
   client_id={CLIENT_ID}
   &response_type=code
   &redirect_uri={REDIRECT_URI}
   &response_mode=query
   &scope=https://graph.microsoft.com/Files.ReadWrite.All offline_access
   &state=12345
   ```

2. Replace:
   - `{TENANT_ID}` with your Directory (tenant) ID
   - `{CLIENT_ID}` with your Application (client) ID
   - `{REDIRECT_URI}` with your redirect URI (URL encoded)

3. Open this URL in a browser and sign in with the admin's Microsoft account
4. Grant permissions
5. You'll be redirected to your redirect URI with a `code` parameter
6. Exchange the code for tokens using this API call:

   ```bash
   curl -X POST https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "client_id={CLIENT_ID}" \
     -d "client_secret={CLIENT_SECRET}" \
     -d "code={AUTHORIZATION_CODE}" \
     -d "redirect_uri={REDIRECT_URI}" \
     -d "grant_type=authorization_code"
   ```

7. From the response, copy the `refresh_token`
   - This is your `ONEDRIVE_REFRESH_TOKEN`

### Option B: Using Postman or Similar Tool

1. Use Postman to make the OAuth 2.0 request
2. Follow the same flow as Option A
3. Extract the refresh token from the response

## Step 7: Add Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# OneDrive Integration Credentials
ONEDRIVE_CLIENT_ID=your_client_id_here
ONEDRIVE_CLIENT_SECRET=your_client_secret_here
ONEDRIVE_TENANT_ID=your_tenant_id_here
ONEDRIVE_REFRESH_TOKEN=your_refresh_token_here
```

**Important Notes:**
- Never commit these credentials to version control
- Keep your `.env.local` file secure
- The refresh token will be automatically refreshed by the application
- If the refresh token expires, you'll need to get a new one using Step 6

## Step 8: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the Labels page
3. Try uploading a PDF file
4. Check your OneDrive to verify the file was uploaded with the correct folder structure:
   - `Year/Month/Client Name/Date/FileName.pdf`

## Troubleshooting

### Error: "Failed to get access token"
- Check that all environment variables are set correctly
- Verify the refresh token is still valid
- Ensure the client secret hasn't expired

### Error: "Failed to upload file to OneDrive"
- Check that the API permissions are granted
- Verify admin consent was given
- Check that the refresh token has the correct scopes

### Error: "Folder not found" or "Permission denied"
- Ensure the app has `Files.ReadWrite.All` permission
- Verify admin consent was granted
- Check that the Microsoft account has OneDrive access

### Refresh Token Expired
If your refresh token expires, you'll need to:
1. Go through Step 6 again to get a new refresh token
2. Update the `ONEDRIVE_REFRESH_TOKEN` in your `.env.local` file
3. Restart your application

## Security Best Practices

1. **Never expose credentials**: Keep all credentials in environment variables
2. **Use HTTPS in production**: Always use HTTPS for production deployments
3. **Rotate secrets regularly**: Update client secrets and refresh tokens periodically
4. **Monitor access**: Regularly check Azure Portal for any suspicious activity
5. **Limit permissions**: Only grant the minimum permissions required

## Folder Structure

The application maintains the same folder structure in OneDrive:
```
Year/
  └── Month/
      └── Client Name/
          └── Date (YYYY-MM-DD)/
              └── FileName.pdf
```

Example:
```
2024/
  └── January/
      └── John Doe/
          └── 2024-01-15/
              └── label.pdf
```

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Check the server logs for detailed error information
3. Verify all credentials are correct
4. Ensure all API permissions are granted

## Next Steps

After setting up the credentials:
1. The application will automatically handle token refresh
2. Users can upload labels without any restrictions
3. All files will be stored in the admin's OneDrive
4. The same folder structure will be maintained

