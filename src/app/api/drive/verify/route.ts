import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/drive/verify
 * Verifies Google Drive OAuth configuration
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback/google`;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1cnz3Uv-CdReOq9zbfqoPhQOelwVIxtmW';

  const checks = {
    clientId: {
      exists: !!clientId,
      length: clientId?.length || 0,
      valid: !!clientId && clientId.length > 0,
      preview: clientId ? `${clientId.substring(0, 20)}...` : 'Not set',
    },
    clientSecret: {
      exists: !!clientSecret,
      length: clientSecret?.length || 0,
      valid: !!clientSecret && clientSecret.length > 0,
      preview: clientSecret ? `${clientSecret.substring(0, 10)}...` : 'Not set',
    },
    redirectUri: {
      value: redirectUri,
      valid: redirectUri.includes('/api/auth/callback/google'),
    },
    folderId: {
      value: folderId,
      valid: folderId.length > 0,
    },
  };

  const allValid = checks.clientId.valid && checks.clientSecret.valid && checks.redirectUri.valid && checks.folderId.valid;

  return NextResponse.json({
    valid: allValid,
    message: allValid 
      ? 'All Google Drive OAuth credentials are configured correctly!' 
      : 'Some credentials are missing or invalid.',
    checks,
    recommendations: [
      !checks.clientId.valid && 'GOOGLE_DRIVE_CLIENT_ID is missing or invalid',
      !checks.clientSecret.valid && 'GOOGLE_DRIVE_CLIENT_SECRET is missing or invalid',
      !checks.redirectUri.valid && 'GOOGLE_DRIVE_REDIRECT_URI is invalid (should include /api/auth/callback/google)',
      !checks.folderId.valid && 'GOOGLE_DRIVE_FOLDER_ID is missing',
    ].filter(Boolean),
  });
}

