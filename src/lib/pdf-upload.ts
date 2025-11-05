import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Get month name from date
 */
function getMonthName(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[date.getMonth()];
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Build the storage path based on the folder structure:
 * [Year]/[Month]/[Client Name]/[Date]/[FileName]
 */
function buildStoragePath(
  fileName: string,
  clientName: string,
  date: Date
): string {
  const year = date.getFullYear().toString();
  const month = getMonthName(date);
  const dateStr = formatDate(date);
  
  // Sanitize client name (remove special characters that might cause issues)
  // Keep spaces, letters, numbers, hyphens, and underscores
  const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9-_ ]/g, "_").trim();
  
  // Sanitize file name - keep spaces and common characters but remove problematic ones
  // Keep the original file name but ensure it's safe for Firebase Storage
  const sanitizedFileName = fileName.trim();
  
  // Build path: Year/Month/Client Name/Date/FileName
  // Firebase Storage handles URL encoding automatically, so we can use spaces
  return `${year}/${month}/${sanitizedClientName}/${dateStr}/${sanitizedFileName}`;
}

export interface UploadProgress {
  progress: number; // 0-100
  state: "running" | "paused" | "success" | "error";
}

export interface UploadResult {
  success: boolean;
  storagePath?: string;
  downloadURL?: string;
  error?: string;
}

/**
 * Upload PDF to Firebase Storage with the specified folder structure
 * 
 * @param file - The PDF file to upload
 * @param clientName - Name of the client/user uploading the file
 * @param onProgress - Optional callback for upload progress
 * @returns Promise with upload result
 */
export async function uploadPDF(
  file: File,
  clientName: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  try {
    // Validate file type
    if (file.type !== "application/pdf") {
      return {
        success: false,
        error: "Only PDF files are allowed",
      };
    }

    // Note: File size validation is handled by compression function
    // We'll allow larger files here since compression will handle the 1MB limit

    // Build storage path
    const currentDate = new Date();
    const storagePath = buildStoragePath(file.name, clientName, currentDate);

    // Create storage reference
    const storageRef = ref(storage, storagePath);

    // Upload file with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise<UploadResult>((resolve) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Track upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          
          if (onProgress) {
            onProgress({
              progress: Math.round(progress),
              state: snapshot.state === "running" ? "running" : 
                     snapshot.state === "paused" ? "paused" : "success",
            });
          }
        },
        (error) => {
          // Handle upload error
          if (onProgress) {
            onProgress({
              progress: 0,
              state: "error",
            });
          }
          resolve({
            success: false,
            error: error.message || "Failed to upload PDF",
          });
        },
        async () => {
          // Upload completed successfully
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            if (onProgress) {
              onProgress({
                progress: 100,
                state: "success",
              });
            }

            resolve({
              success: true,
              storagePath,
              downloadURL,
            });
          } catch (error: any) {
            resolve({
              success: false,
              error: error.message || "Failed to get download URL",
            });
          }
        }
      );
    });
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to upload PDF",
    };
  }
}

/**
 * Helper function to get year, month, and date from a Date object
 */
export function getFolderInfo(date: Date) {
  return {
    year: date.getFullYear().toString(),
    month: getMonthName(date),
    date: formatDate(date),
  };
}

