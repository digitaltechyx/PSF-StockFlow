/**
 * API Route: Download file from OneDrive
 * Returns file download URL or file content
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId');
    const filePath = searchParams.get('filePath');

    if (!fileId && !filePath) {
      return NextResponse.json(
        { error: 'Missing fileId or filePath parameter' },
        { status: 400 }
      );
    }

    // Get access token
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/onedrive/token`);
    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 500 }
      );
    }
    const { accessToken } = await tokenResponse.json();

    let downloadUrl: string;

    if (fileId) {
      // Get file by ID
      const fileUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;
      const fileResponse = await fetch(fileUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!fileResponse.ok) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }

      const fileData = await fileResponse.json();
      downloadUrl = fileData['@microsoft.graph.downloadUrl'] || fileData.webUrl;
    } else {
      // Get file by path
      const fileUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(filePath!)}`;
      const fileResponse = await fetch(fileUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!fileResponse.ok) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }

      const fileData = await fileResponse.json();
      downloadUrl = fileData['@microsoft.graph.downloadUrl'] || fileData.webUrl;
    }

    // Return download URL
    return NextResponse.json({
      success: true,
      downloadUrl: downloadUrl,
    });
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get download URL' },
      { status: 500 }
    );
  }
}

