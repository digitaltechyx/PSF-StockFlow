/**
 * API Route: Get Microsoft Graph API Access Token
 * Handles token refresh and returns valid access token
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.ONEDRIVE_CLIENT_ID;
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET;
    const tenantId = process.env.ONEDRIVE_TENANT_ID;
    const refreshToken = process.env.ONEDRIVE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !tenantId || !refreshToken) {
      return NextResponse.json(
        { error: 'OneDrive credentials not configured. Please check your environment variables.' },
        { status: 500 }
      );
    }

    // Get access token using refresh token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default offline_access',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Token refresh error:', errorData);
      return NextResponse.json(
        { error: 'Failed to refresh access token' },
        { status: response.status }
      );
    }

    const tokenData = await response.json();
    
    // Store the new refresh token if provided
    if (tokenData.refresh_token) {
      // Note: In production, you should update the stored refresh token
      // This is a simplified version - you may want to store it in a database
      console.log('New refresh token received. Update ONEDRIVE_REFRESH_TOKEN in your .env file.');
    }

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

