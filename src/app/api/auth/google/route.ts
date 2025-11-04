import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback/google`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google OAuth credentials not configured.' }, { status: 500 });
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // To get a refresh token
    scope: scopes,
    prompt: 'consent', // Always ask for consent to ensure refresh token is granted
  });

  return NextResponse.redirect(authorizationUrl);
}

