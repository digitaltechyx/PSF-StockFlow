# Deploy Firebase Storage Rules

The storage rules have been updated to fix the permission issue. You need to deploy them to Firebase.

## Option 1: Using Firebase CLI (Recommended)

1. **Make sure Firebase CLI is installed:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **Initialize Firebase (if not already done):**
   ```bash
   firebase init storage
   ```
   - Select your Firebase project
   - Choose to use existing storage.rules file

4. **Deploy the storage rules:**
   ```bash
   firebase deploy --only storage
   ```

## Option 2: Manual Deployment via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Storage** → **Rules** tab
4. Copy the contents of `storage.rules` file
5. Paste it into the Firebase Console
6. Click **Publish**

## Verify the Rules

After deployment, the rules should allow:
- ✅ Authenticated users to read any file
- ✅ Authenticated users to upload PDFs (up to 2MB)
- ✅ Authenticated users to delete files
- ✅ Support for file names with spaces and special characters

## Test the Upload

After deploying the rules, try uploading your PDFs again. The permission errors should be resolved.

