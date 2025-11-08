/**
 * API Route: Handle Google Drive OAuth Callback
 * Exchanges authorization code for refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      return NextResponse.json(
        { error: `OAuth error: ${error}` },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${request.nextUrl.origin}/api/drive/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Exchange code for tokens
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      return NextResponse.json(
        { error: 'Failed to exchange code for tokens', details: errorData },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token received. Make sure to include access_type=offline and prompt=consent in the authorization URL.' },
        { status: 500 }
      );
    }

    // Store refresh token in Firestore (or you can store in environment variable)
    // For now, we'll store it in a system config document
    try {
      await setDoc(doc(db, 'system', 'googleDrive'), {
        refreshToken: refreshToken,
        accessToken: tokenData.access_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        updatedAt: new Date(),
      }, { merge: true });
    } catch (firestoreError) {
      console.error('Error storing refresh token:', firestoreError);
      // Continue anyway - user can manually set it in environment variable
    }

    // Return success page
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Drive Connected</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #34a853; }
            .success { color: #34a853; font-weight: bold; }
            .info { background: #e8f5e9; padding: 15px; border-radius: 4px; margin: 20px 0; }
            code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Google Drive Connected Successfully!</h1>
            <p class="success">Your Google Drive account has been connected.</p>
            <div class="info">
              <p><strong>Refresh Token:</strong></p>
              <p><code>${refreshToken}</code></p>
              <p style="margin-top: 15px; font-size: 14px;">
                <strong>Important:</strong> Save this refresh token. You can also set it as an environment variable:
              </p>
              <p><code>GOOGLE_DRIVE_REFRESH_TOKEN=${refreshToken}</code></p>
            </div>
            <p>You can now close this window and try uploading a file.</p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process OAuth callback' },
      { status: 500 }
    );
  }
}

