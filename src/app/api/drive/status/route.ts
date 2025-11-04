import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { google } from 'googleapis';

/**
 * GET /api/drive/status
 * Checks if Google Drive is connected (i.e., if access token exists and is valid)
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('google_drive_access_token')?.value;
  const refreshToken = cookieStore.get('google_drive_refresh_token')?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ connected: false, message: 'No Google Drive tokens found.' });
  }

  // Attempt to use the access token
  if (accessToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_DRIVE_CLIENT_ID,
        process.env.GOOGLE_DRIVE_CLIENT_SECRET,
        process.env.GOOGLE_DRIVE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback/google`
      );
      oauth2Client.setCredentials({ access_token: accessToken });

      // Try to get user info to validate token
      await google.oauth2({ auth: oauth2Client, version: 'v2' }).userinfo.get();
      return NextResponse.json({ connected: true, message: 'Google Drive is connected.' });
    } catch (error) {
      console.warn('Access token invalid or expired, attempting refresh:', error);
      // Fall through to refresh token logic
    }
  }

  // If access token failed or didn't exist, try to refresh
  if (refreshToken) {
    try {
      const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        return NextResponse.json({ connected: false, message: 'OAuth credentials not configured for refresh.' });
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await response.json();

      if (response.ok && tokens.access_token) {
        cookieStore.set('google_drive_access_token', tokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60, // 1 hour
          path: '/',
        });
        return NextResponse.json({ connected: true, message: 'Google Drive connection refreshed.' });
      } else {
        console.error('Failed to refresh token:', tokens);
        // Clear invalid refresh token
        cookieStore.delete('google_drive_refresh_token');
        cookieStore.delete('google_drive_access_token');
      }
    } catch (error) {
      console.error('Error during token refresh:', error);
    }
  }

  return NextResponse.json({ connected: false, message: 'Google Drive is not connected.' });
}


