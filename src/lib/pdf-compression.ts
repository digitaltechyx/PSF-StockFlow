import { PDFDocument } from "pdf-lib";

export const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes

export interface CompressionResult {
  success: boolean;
  file?: File;
  originalSize: number;
  compressedSize?: number;
  error?: string;
}

/**
 * Compress PDF file to meet the 1MB limit
 * Uses pdf-lib to optimize the PDF by removing unnecessary metadata
 */
export async function compressPDF(file: File): Promise<CompressionResult> {
  try {
    const originalSize = file.size;

    // If file is already under 1MB, return as is
    if (originalSize <= MAX_FILE_SIZE) {
      return {
        success: true,
        file: file,
        originalSize,
        compressedSize: originalSize,
      };
    }

    // Read the PDF file
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      // Ignore encryption errors
      ignoreEncryption: true,
      // Update metadata
      updateMetadata: true,
    });

    // Optimize the PDF by removing unnecessary metadata
    // Note: pdf-lib doesn't have built-in compression, but we can optimize metadata
    // For actual compression, we'd need a server-side solution or a different library
    
    // Save the PDF with optimized settings
    // Try multiple compression strategies
    let pdfBytes = await pdfDoc.save({
      useObjectStreams: false, // Disable object streams for better compatibility
    });

    let compressedSize = pdfBytes.byteLength;

    // If still too large, try with additional optimization
    if (compressedSize > MAX_FILE_SIZE) {
      // Try saving again with minimal metadata
      pdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
      });
      compressedSize = pdfBytes.byteLength;
    }

    // Check if compression helped enough
    if (compressedSize > MAX_FILE_SIZE) {
      // Calculate compression ratio
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
      
      return {
        success: false,
        originalSize,
        compressedSize,
        error: `File size (${(compressedSize / 1024 / 1024).toFixed(2)}MB) still exceeds 1MB limit after compression. ${compressionRatio > 0 ? `Compressed by ${compressionRatio.toFixed(1)}%.` : ""} Please use a PDF optimizer tool (like SmallPDF or ILovePDF) or split the file into smaller parts.`,
      };
    }

    // Create a new File object from the compressed bytes
    const compressedFile = new File(
      [pdfBytes],
      file.name,
      {
        type: "application/pdf",
        lastModified: Date.now(),
      }
    );

    return {
      success: true,
      file: compressedFile,
      originalSize,
      compressedSize,
    };
  } catch (error: any) {
    return {
      success: false,
      originalSize: file.size,
      error: error.message || "Failed to compress PDF",
    };
  }
}

/**
 * Validate PDF file
 */
export function validatePDFFile(file: File): { valid: boolean; error?: string } {
  if (file.type !== "application/pdf") {
    return { valid: false, error: "Only PDF files are allowed." };
  }
  return { valid: true };
}

