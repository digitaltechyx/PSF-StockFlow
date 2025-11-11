/**
 * API Route: Server-side PDF Compression
 * Handles PDF compression on the server using pdf-lib with aggressive optimization
 * Always attempts maximum compression regardless of file size
 */

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
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

    const originalSize = file.size;

    // Always attempt compression, regardless of file size
    // Read the PDF file
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
      capNumbers: true,
    });

    const pageCount = pdfDoc.getPageCount();
    
    // Strategy 1: Save with minimal settings (most aggressive)
    let pdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      updateMetadata: false,
    });

    let compressedSize = pdfBytes.byteLength;
    let bestBytes = pdfBytes;
    let bestSize = compressedSize;

    // Strategy 2: Try creating a new document with only essential content
    // This can sometimes reduce size by removing unnecessary metadata
    const newPdfDoc = await PDFDocument.create();
    
    const copiedPages = await newPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => {
      newPdfDoc.addPage(page);
    });

    const newBytes = await newPdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      updateMetadata: false,
    });
    
    const newSize = newBytes.byteLength;
    
    if (newSize < bestSize) {
      bestBytes = newBytes;
      bestSize = newSize;
      compressedSize = newSize;
    }

    // Strategy 3: Try with object streams enabled (sometimes helps)
    const streamBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateMetadata: false,
    });
    
    const streamSize = streamBytes.byteLength;
    if (streamSize < bestSize) {
      bestBytes = streamBytes;
      bestSize = streamSize;
      compressedSize = streamSize;
    }

    // Only use compressed version if it's actually smaller
    // If compression made it worse, use original
    if (bestSize >= originalSize) {
      bestBytes = Buffer.from(arrayBuffer);
      bestSize = originalSize;
      compressedSize = originalSize;
    }

    // Calculate compression ratio
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    // Always return success - compression is attempted but upload is allowed regardless
    return NextResponse.json({
      success: true,
      file: Buffer.from(bestBytes).toString('base64'),
      originalSize,
      compressedSize,
      compressionRatio,
    });
  } catch (error: any) {
    console.error('PDF compression error:', error);
    // If compression fails, try to return original file
    // Note: We can't re-read the request, so we'll return an error
    // The client-side code will handle this by using the original file
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to compress PDF. Please ensure the file is a valid PDF.',
      },
      { status: 500 }
    );
  }
}

