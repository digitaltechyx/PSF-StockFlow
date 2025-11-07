/**
 * API Route: List files from OneDrive
 * Returns list of PDF files from admin's OneDrive
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get access token
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/onedrive/token`);
    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 500 }
      );
    }
    const { accessToken } = await tokenResponse.json();

    // Get all PDF files from OneDrive
    // We'll recursively search through all folders
    // Note: The search API might not return all files, so we'll use a recursive approach
    const allFiles: any[] = [];
    
    // Function to recursively get all files from a folder
    async function getAllFilesFromFolder(folderId: string, folderPath: string = '') {
      const folderUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;
      
      const response = await fetch(folderUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return; // Skip folders we can't access
      }

      const data = await response.json();
      const items = data.value || [];

      for (const item of items) {
        if (item.file && item.name.toLowerCase().endsWith('.pdf')) {
          // It's a PDF file
          allFiles.push({
            ...item,
            folderPath: folderPath,
          });
        } else if (item.folder) {
          // It's a folder, recurse into it
          const newPath = folderPath ? `${folderPath}/${item.name}` : item.name;
          await getAllFilesFromFolder(item.id, newPath);
        }
      }
    }

    // Start from root
    const rootResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!rootResponse.ok) {
      const errorData = await rootResponse.text();
      console.error('List error:', errorData);
      return NextResponse.json(
        { error: 'Failed to access OneDrive root' },
        { status: 500 }
      );
    }

    const rootData = await rootResponse.json();
    await getAllFilesFromFolder(rootData.id);

    const files = allFiles;

    // Transform files to match our UploadedPDF interface
    const transformedFiles = files.map((file: any) => {
      const fileName = file.name;
      
      // Parse folder path to extract year, month, client name, date
      // Path format: Year/Month/Client Name/Date/FileName
      const pathSegments = file.folderPath ? file.folderPath.split('/') : [];
      
      // If folderPath is empty, try to extract from parentReference
      let finalPathSegments = pathSegments;
      if (pathSegments.length === 0 && file.parentReference?.path) {
        const parentPath = file.parentReference.path;
        const pathPart = parentPath.split(':')[1] || parentPath;
        finalPathSegments = pathPart.split('/').filter(Boolean);
      }

      // Extract components (assuming structure: Year/Month/Client Name/Date)
      const year = finalPathSegments[0] || '';
      const month = finalPathSegments[1] || '';
      const clientName = finalPathSegments[2] || '';
      const date = finalPathSegments[3] || '';

      // Build storage path
      const storagePath = finalPathSegments.length > 0 
        ? `${finalPathSegments.join('/')}/${fileName}`
        : fileName;

      return {
        id: file.id,
        fileName: fileName,
        storagePath: storagePath,
        downloadURL: file['@microsoft.graph.downloadUrl'] || file.webUrl,
        webUrl: file.webUrl,
        size: file.size,
        uploadedAt: file.createdDateTime || file.lastModifiedDateTime,
        uploadedBy: '', // Will be populated from Firestore metadata
        uploadedByName: clientName,
        year: year,
        month: month,
        date: date,
      };
    });

    return NextResponse.json({
      success: true,
      files: transformedFiles,
    });
  } catch (error: any) {
    console.error('List error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list files' },
      { status: 500 }
    );
  }
}

