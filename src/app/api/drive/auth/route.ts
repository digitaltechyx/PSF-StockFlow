/**
 * API Route: Get Google Drive OAuth Authorization URL
 * Returns the authorization URL for admin to authenticate
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/drive/callback`;
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'GOOGLE_CLIENT_ID is not configured' },
        { status: 500 }
      );
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    return NextResponse.json({
      authUrl: authUrl.toString(),
    });
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}

