# Microsoft Update Notice - Azure App Registration

## ⚠️ Important Update from Microsoft

Microsoft has **deprecated the ability to create applications outside of a directory** in Azure Active Directory. This means you **must have an Azure Active Directory (tenant/directory)** to register your application.

## What This Means for You

If you see this message when trying to register an app:
> "The ability to create applications outside of a directory has been deprecated. You may get a new directory by joining the M365 Developer Program or signing up for Azure."

You need to get an Azure directory first.

## How to Get an Azure Directory

### Option 1: Sign Up for Azure (Recommended - Free)

1. Go to [Azure Portal](https://portal.azure.com/)
2. Click **Start free** or **Sign up**
3. Create a free Azure account
4. This automatically creates an Azure Active Directory (tenant) for you
5. **Benefits:**
   - $200 in free credits
   - 12 months of free services
   - Free forever tier for many services
   - No credit card required for free tier

### Option 2: Join M365 Developer Program (Free)

1. Go to [Microsoft 365 Developer Program](https://developer.microsoft.com/microsoft-365/dev-program)
2. Sign up for free
3. Get a developer tenant with:
   - Office 365 E5 subscription
   - Azure Active Directory
   - 25 user licenses
   - Valid for 90 days (renewable)

## After Getting a Directory

Once you have an Azure directory:

1. Go to [Azure Portal](https://portal.azure.com/)
2. Sign in with your account
3. Navigate to **Azure Active Directory** → **App registrations**
4. You should now be able to click **New registration** without seeing the deprecation message
5. Follow the rest of the setup guide in `ONEDRIVE_SETUP_GUIDE.md`

## Why This Change?

Microsoft made this change to:
- Improve security and organization
- Better manage application registrations
- Align with enterprise best practices
- Provide better tenant isolation

## Impact on Our Integration

✅ **No impact on functionality** - Our OneDrive integration will work exactly the same once you have a directory.

✅ **Better security** - Having a directory provides better security and management.

✅ **Free options available** - Both Azure free tier and M365 Developer Program are free.

## Quick Start

1. **Get an Azure directory** (choose one):
   - Sign up for Azure: https://portal.azure.com/
   - Join M365 Developer Program: https://developer.microsoft.com/microsoft-365/dev-program

2. **Continue with setup**:
   - Follow `ONEDRIVE_SETUP_GUIDE.md` from Step 1
   - You should now be able to register your application

## Need Help?

If you encounter any issues:
1. Make sure you're signed in to Azure Portal with an account that has a directory
2. Check that you've completed the sign-up process for Azure or M365 Developer Program
3. Verify you can see "Azure Active Directory" in the Azure Portal menu

