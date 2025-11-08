/**
 * API Route: List files from Google Drive
 * Returns list of PDF files from admin's Google Drive
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
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

    // Ensure authentication is initialized
    await auth.authorize();

    const drive = google.drive({ version: 'v3', auth });

    // Recursively get all PDF files
    const allFiles: any[] = [];

    async function getAllPDFs(folderId: string = 'root', folderPath: string = '') {
      try {
        // Get all files and folders in current folder
        const response = await drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: 'files(id, name, mimeType, size, createdTime, webViewLink, webContentLink, parents)',
          spaces: 'drive',
        });

        const items = response.data.files || [];

        for (const item of items) {
          if (item.mimeType === 'application/pdf') {
            // It's a PDF file
            allFiles.push({
              id: item.id,
              name: item.name,
              size: item.size,
              createdTime: item.createdTime,
              webViewLink: item.webViewLink,
              webContentLink: item.webContentLink,
              folderPath: folderPath,
            });
          } else if (item.mimeType === 'application/vnd.google-apps.folder') {
            // It's a folder, recurse into it
            const newPath = folderPath ? `${folderPath}/${item.name}` : item.name;
            await getAllPDFs(item.id!, newPath);
          }
        }
      } catch (error) {
        console.error(`Error accessing folder ${folderId}:`, error);
        // Continue with other folders
      }
    }

    // Start from root
    await getAllPDFs();

    return NextResponse.json({
      success: true,
      files: allFiles,
      count: allFiles.length,
    });
  } catch (error: any) {
    console.error('Google Drive list error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to list files from Google Drive',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

