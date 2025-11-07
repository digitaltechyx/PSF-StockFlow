/**
 * API Route: Upload PDF to OneDrive
 * Handles file upload to admin's OneDrive with folder structure
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get access token
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/onedrive/token`);
    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Token error:', tokenError);
      return NextResponse.json(
        { error: 'Failed to get access token', details: tokenError },
        { status: 500 }
      );
    }
    const tokenData = await tokenResponse.json();
    if (!tokenData.accessToken) {
      return NextResponse.json(
        { error: 'No access token received', details: tokenData },
        { status: 500 }
      );
    }
    const { accessToken } = tokenData;

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

    // Create folder structure in OneDrive if it doesn't exist
    const folderParts = folderPath.split('/').slice(0, -1); // Remove filename
    let currentFolderId = 'root'; // Start from root

    // Navigate/create folder structure
    for (let i = 0; i < folderParts.length; i++) {
      const folderName = folderParts[i];
      const folderPathSoFar = folderParts.slice(0, i + 1).join('/');

      // Check if folder exists
      const checkFolderUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(folderPathSoFar)}`;
      let folderResponse = await fetch(checkFolderUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (folderResponse.status === 404) {
        // Folder doesn't exist, create it
        const parentPath = i > 0 ? folderParts.slice(0, i).join('/') : '';
        const parentId = i === 0 ? 'root' : await getFolderId(accessToken, parentPath);

        const createFolderUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`;
        folderResponse = await fetch(createFolderUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        });

        if (!folderResponse.ok) {
          const errorData = await folderResponse.text();
          console.error('Error creating folder:', errorData);
          let errorMessage = `Failed to create folder: ${folderName}`;
          try {
            const errorJson = JSON.parse(errorData);
            errorMessage = errorJson.error?.message || errorJson.error_description || errorMessage;
          } catch (e) {
            errorMessage = errorData || errorMessage;
          }
          return NextResponse.json(
            { error: errorMessage, details: errorData },
            { status: 500 }
          );
        }
      }

      // Get folder ID for next iteration
      if (!folderResponse.ok && folderResponse.status !== 404) {
        const errorData = await folderResponse.text();
        console.error('Error checking folder:', errorData);
        let errorMessage = `Failed to check folder: ${folderName}`;
        try {
          const errorJson = JSON.parse(errorData);
          errorMessage = errorJson.error?.message || errorJson.error_description || errorMessage;
        } catch (e) {
          errorMessage = errorData || errorMessage;
        }
        return NextResponse.json(
          { error: errorMessage, details: errorData },
          { status: 500 }
        );
      }
      
      const folderData = await folderResponse.json();
      currentFolderId = folderData.id;
    }

    // Upload file to the final folder
    const fileName = folderPath.split('/').pop()!;
    // Use the correct upload endpoint - upload to the folder using the folder ID
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${currentFolderId}:/${encodeURIComponent(fileName)}:/content`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/pdf',
      },
      body: buffer,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.text();
      console.error('Upload error:', errorData);
      let errorMessage = 'Failed to upload file to OneDrive';
      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.error?.message || errorJson.error_description || errorMessage;
      } catch (e) {
        // If parsing fails, use the raw error data
        errorMessage = errorData || errorMessage;
      }
      return NextResponse.json(
        { error: errorMessage, details: errorData },
        { status: 500 }
      );
    }

    const uploadData = await uploadResponse.json();

    // Get download URL
    const downloadUrl = uploadData.webUrl || uploadData['@microsoft.graph.downloadUrl'];

    return NextResponse.json({
      success: true,
      fileId: uploadData.id,
      fileName: uploadData.name,
      storagePath: folderPath,
      downloadURL: downloadUrl,
      webUrl: uploadData.webUrl,
      size: uploadData.size,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get folder ID by path
 */
async function getFolderId(accessToken: string, folderPath: string): Promise<string> {
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(folderPath)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get folder ID for: ${folderPath}`);
  }

  const data = await response.json();
  return data.id;
}

