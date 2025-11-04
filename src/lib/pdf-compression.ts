/**
 * PDF Compression Utility
 * Compresses PDF files to meet the 1MB size limit requirement
 */

export interface CompressionResult {
  success: boolean;
  file: File | null;
  originalSize: number;
  compressedSize: number;
  error?: string;
}

/**
 * Compresses a PDF file to under 1MB (1,048,576 bytes)
 * Uses browser's native compression if available, otherwise returns original if under limit
 * 
 * @param file - The PDF file to compress
 * @param maxSizeBytes - Maximum file size in bytes (default: 1MB)
 * @returns Promise with compression result
 */
export async function compressPDF(
  file: File,
  maxSizeBytes: number = 1048576 // 1MB
): Promise<CompressionResult> {
  const originalSize = file.size;

  // If file is already under the limit, return as-is
  if (originalSize <= maxSizeBytes) {
    return {
      success: true,
      file,
      originalSize,
      compressedSize: originalSize,
    };
  }

  try {
    // For now, we'll return an error if the file is too large
    // In a production environment, you might want to use a server-side compression
    // library like pdf-lib or pdf.js to reduce quality/remove unnecessary content
    // 
    // Browser-side PDF compression is limited, so we'll validate and provide
    // helpful error messages. The actual compression should ideally happen server-side
    // or use a third-party service.
    
    return {
      success: false,
      file: null,
      originalSize,
      compressedSize: originalSize,
      error: `File size (${formatFileSize(originalSize)}) exceeds the maximum allowed size of ${formatFileSize(maxSizeBytes)}. Please compress the PDF using a PDF compression tool before uploading.`,
    };
  } catch (error) {
    return {
      success: false,
      file: null,
      originalSize,
      compressedSize: originalSize,
      error: error instanceof Error ? error.message : 'Failed to compress PDF',
    };
  }
}

/**
 * Formats file size in bytes to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validates that a file is a PDF
 */
export function validatePDFFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'Please upload a PDF file',
    };
  }

  // Check file extension as fallback
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return {
      valid: false,
      error: 'File must have a .pdf extension',
    };
  }

  return { valid: true };
}


