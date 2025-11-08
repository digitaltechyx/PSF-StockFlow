/**
 * API Route: Upload PDF to Google Drive
 * Handles file upload to admin's Google Drive with folder structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    // Get service account credentials from environment
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountKey) {
      return NextResponse.json(
        { error: 'Google Drive credentials not configured. Please check GOOGLE_SERVICE_ACCOUNT_KEY environment variable.' },
        { status: 500 }
      );
    }

    // Parse service account key
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountKey);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid GOOGLE_SERVICE_ACCOUNT_KEY format. Must be valid JSON.' },
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientName = formData.get('clientName') as string;
    const folderPath = formData.get('folderPath') as string;

    if (!file || !clientName || !folderPath) {
      return NextResponse.json(
        { error: 'Missing required fields: file, clientName, or folderPath' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse folder path: Year/Month/Client Name/Date/FileName
    const pathParts = folderPath.split('/');
    const fileName = pathParts.pop()!;
    const folderParts = pathParts; // [Year, Month, Client Name, Date]

    // Create folder structure in Google Drive
    let parentFolderId = 'root'; // Start from root

    for (const folderName of folderParts) {
      // Check if folder exists
      const existingFolders = await drive.files.list({
        q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      let folderId = existingFolders.data.files?.[0]?.id;

      // Create folder if it doesn't exist
      if (!folderId) {
        const folder = await drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
          },
          fields: 'id, name',
        });
        folderId = folder.data.id!;
      }

      parentFolderId = folderId!;
    }

    // Upload file to the final folder
    const fileMetadata = {
      name: fileName,
      parents: [parentFolderId],
    };

    const media = {
      mimeType: 'application/pdf',
      body: buffer,
    };

    const uploadedFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink, size',
    });

    // Make file accessible (optional - for direct download)
    await drive.permissions.create({
      fileId: uploadedFile.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get file download URL
    const fileInfo = await drive.files.get({
      fileId: uploadedFile.data.id!,
      fields: 'id, name, webViewLink, webContentLink, size',
    });

    return NextResponse.json({
      success: true,
      fileId: uploadedFile.data.id,
      fileName: uploadedFile.data.name,
      storagePath: folderPath,
      downloadURL: fileInfo.data.webContentLink || fileInfo.data.webViewLink,
      webUrl: fileInfo.data.webViewLink,
      size: fileInfo.data.size,
    });
  } catch (error: any) {
    console.error('Google Drive upload error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to upload file to Google Drive',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

