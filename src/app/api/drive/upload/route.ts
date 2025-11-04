import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { cookies } from 'next/headers';

// Google Drive folder ID from environment (PSF Labels folder)
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1cnz3Uv-CdReOq9zbfqoPhQOelwVIxtmW';

// Maximum file size: 1MB
const MAX_FILE_SIZE = 1048576; // 1MB in bytes

/**
 * Get OAuth access token from cookies
 */
async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('google_drive_access_token')?.value;
  return accessToken || null;
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('google_drive_refresh_token')?.value;
  
  if (!refreshToken) {
    return null;
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
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
      // Update cookie with new access token
      cookieStore.set('google_drive_access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour
        path: '/',
      });
      return tokens.access_token;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
  }

  return null;
}

/**
 * Initialize Google Drive API client with OAuth
 */
async function getDriveClient() {
  let accessToken = await getAccessToken();

  // If no access token, try to refresh
  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    throw new Error('Google Drive not authenticated. Please connect your Google account first.');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    process.env.GOOGLE_DRIVE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback/google`
  );

  oauth2Client.setCredentials({ access_token: accessToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  return drive;
}

/**
 * Get or create a folder in Google Drive
 * @param drive - Google Drive client
 * @param folderName - Name of the folder to find or create
 * @param parentFolderId - ID of the parent folder
 * @returns Folder ID
 */
async function getOrCreateFolder(
  drive: any,
  folderName: string,
  parentFolderId: string
): Promise<string> {
  try {
    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${folderName}' and parents in '${parentFolderId}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (response.data.files && response.data.files.length > 0) {
      // Folder exists, return its ID
      return response.data.files[0].id!;
    }

    // Folder doesn't exist, create it
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
      supportsAllDrives: true,
    });

    return folder.data.id!;
  } catch (error) {
    console.error(`Error getting/creating folder "${folderName}":`, error);
    throw error;
  }
}

/**
 * POST /api/drive/upload
 * Uploads a PDF file to Google Drive
 */
export async function POST(request: NextRequest) {
  try {

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const invoiceNumber = formData.get('invoiceNumber') as string | null;
    const userId = formData.get('userId') as string | null;
    const userName = formData.get('userName') as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of 1MB. Please compress the PDF before uploading.` 
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize Drive client
    const drive = await getDriveClient();

    // Create folder structure: PSF Labels > User Name > Current Date
    const userFolderName = userName || `User_${userId}`;
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Get or create user folder
    const userFolderId = await getOrCreateFolder(drive, userFolderName, DRIVE_FOLDER_ID);
    
    // Get or create date folder inside user folder
    const dateFolderId = await getOrCreateFolder(drive, currentDate, userFolderId);

    // Create file metadata
    const fileName = invoiceNumber 
      ? `Invoice_${invoiceNumber}_${currentDate}.pdf`
      : `PDF_${currentDate}_${Date.now()}.pdf`;
    
    const fileMetadata = {
      name: fileName,
      parents: [dateFolderId],
    };

    // Upload file to Google Drive
    // Convert buffer to stream for googleapis
    const stream = Readable.from(buffer);

    const uploadedFile = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: 'application/pdf',
        body: stream,
      },
      fields: 'id, name, webViewLink, size, createdTime',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    // Return success response with file information
    return NextResponse.json({
      success: true,
      fileId: uploadedFile.data.id,
      fileName: uploadedFile.data.name,
      webViewLink: uploadedFile.data.webViewLink,
      size: uploadedFile.data.size,
      uploadedAt: uploadedFile.data.createdTime,
    });

  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    
    if (error instanceof Error) {
      // Check for specific error messages
      if (error.message.includes('not authenticated') || error.message.includes('connect your Google')) {
        return NextResponse.json(
          { 
            error: 'Google Drive not connected. Please connect your Google account first.',
            requiresAuth: true
          },
          { status: 401 }
        );
      }

      if (error.message.includes('permission') || error.message.includes('access denied')) {
        return NextResponse.json(
          { error: 'Permission denied. Please check that you have access to the Google Drive folder.' },
          { status: 500 }
        );
      }

      if (error.message.includes('storage quota') || error.message.includes('quota')) {
        return NextResponse.json(
          { 
            error: 'Storage quota exceeded. Please free up space in your Google Drive.' 
          },
          { status: 500 }
        );
      }

      // Return the actual error message for debugging
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload file to Google Drive. Please try again.' },
      { status: 500 }
    );
  }
}

