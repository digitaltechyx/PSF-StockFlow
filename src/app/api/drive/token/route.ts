/**
 * API Route: Get Google Drive Access Token
 * Uses refresh token to get a new access token
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Try to get refresh token from environment variable first
    let refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    // If not in env, try to get from Firestore
    if (!refreshToken) {
      try {
        const systemDoc = await getDoc(doc(db, 'system', 'googleDrive'));
        if (systemDoc.exists()) {
          const data = systemDoc.data();
          refreshToken = data.refreshToken;
        }
      } catch (error) {
        console.error('Error reading from Firestore:', error);
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        { 
          error: 'No refresh token found. Please authenticate with Google Drive first.',
          hint: 'Go to /api/drive/auth to get the authorization URL'
        },
        { status: 500 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Exchange refresh token for access token
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      let errorData: any;
      try {
        errorData = await tokenResponse.json();
      } catch {
        errorData = await tokenResponse.text();
      }
      
      console.error('Token refresh error:', errorData);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to refresh access token';
      let hint = 'Your refresh token may be expired or invalid. Please re-authenticate by visiting /api/drive/auth';
      
      if (errorData.error) {
        if (errorData.error === 'invalid_grant') {
          errorMessage = 'Refresh token is invalid or expired';
          hint = 'Please re-authenticate Google Drive by visiting /api/drive/auth to get a new refresh token';
        } else if (errorData.error === 'invalid_client') {
          errorMessage = 'Google OAuth credentials are invalid';
          hint = 'Please check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables';
        } else {
          errorMessage = `Token refresh failed: ${errorData.error}`;
          if (errorData.error_description) {
            hint = errorData.error_description;
          }
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorData,
          hint: hint
        },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();

    return NextResponse.json({
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
    });
  } catch (error: any) {
    console.error('Error getting access token:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get access token' },
      { status: 500 }
    );
  }
}

