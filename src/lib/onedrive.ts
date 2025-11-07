/**
 * OneDrive utility functions for Microsoft Graph API
 * Handles authentication, folder creation, file upload, and file operations
 */

/**
 * Get month name from date
 */
export function getMonthName(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[date.getMonth()];
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Build the OneDrive folder path based on the folder structure:
 * [Year]/[Month]/[Client Name]/[Date]/[FileName]
 */
export function buildOneDrivePath(
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
  const sanitizedFileName = fileName.trim();
  
  // Build path: Year/Month/Client Name/Date/FileName
  return `${year}/${month}/${sanitizedClientName}/${dateStr}/${sanitizedFileName}`;
}

/**
 * Get access token for Microsoft Graph API
 * This will be handled by the API route using stored credentials
 */
export async function getAccessToken(): Promise<string> {
  const response = await fetch('/api/onedrive/token');
  if (!response.ok) {
    throw new Error('Failed to get access token');
  }
  const data = await response.json();
  return data.accessToken;
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

