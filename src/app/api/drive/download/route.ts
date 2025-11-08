/**
 * API Route: Download file from Google Drive
 * Returns download URL for a given file ID or path
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId');
    const filePath = searchParams.get('filePath');

    if (!fileId && !filePath) {
      return NextResponse.json(
        { error: 'Either fileId or filePath is required' },
        { status: 400 }
      );
    }

    // Get service account credentials from environment
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      return NextResponse.json(
        { error: 'Google Drive credentials not configured.' },
        { status: 500 }
      );
    }

    // Parse service account key
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountKey);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid GOOGLE_SERVICE_ACCOUNT_KEY format.' },
        { status: 500 }
      );
    }

    // Authenticate with Google Drive
    const auth = new google.auth.JWT(
      serviceAccount.client_email,
      undefined,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/drive']
    );

    const drive = google.drive({ version: 'v3', auth });

    let targetFileId = fileId;

    // If filePath is provided, find the file
    if (!targetFileId && filePath) {
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop()!;
      let currentFolderId = 'root';

      // Navigate through folder structure
      for (const folderName of pathParts) {
        const folders = await drive.files.list({
          q: `'${currentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
        });
        
        if (!folders.data.files || folders.data.files.length === 0) {
          return NextResponse.json(
            { error: `Folder not found: ${folderName}` },
            { status: 404 }
          );
        }
        
        currentFolderId = folders.data.files[0].id!;
      }

      // Find the file in the final folder
      const files = await drive.files.list({
        q: `'${currentFolderId}' in parents and name='${fileName}' and mimeType='application/pdf' and trashed=false`,
        fields: 'files(id)',
      });

      if (!files.data.files || files.data.files.length === 0) {
        return NextResponse.json(
          { error: `File not found: ${fileName}` },
          { status: 404 }
        );
      }

      targetFileId = files.data.files[0].id!;
    }

    // Get file info and download URL
    const fileInfo = await drive.files.get({
      fileId: targetFileId!,
      fields: 'id, name, webViewLink, webContentLink, size',
    });

    // Generate a download URL (valid for a limited time)
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${targetFileId}`;

    return NextResponse.json({
      success: true,
      fileId: fileInfo.data.id,
      fileName: fileInfo.data.name,
      downloadURL: fileInfo.data.webContentLink || downloadUrl,
      webUrl: fileInfo.data.webViewLink,
      size: fileInfo.data.size,
    });
  } catch (error: any) {
    console.error('Google Drive download error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to get download URL from Google Drive',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

