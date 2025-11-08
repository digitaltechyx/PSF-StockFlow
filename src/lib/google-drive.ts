/**
 * Google Drive Utility Functions
 * Handles folder structure and path building for Google Drive
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
 * Build the storage path based on the folder structure:
 * [Year]/[Month]/[Client Name]/[Date]/[FileName]
 */
export function buildGoogleDrivePath(
  fileName: string,
  clientName: string,
  date: Date
): string {
  const year = date.getFullYear().toString();
  const month = getMonthName(date);
  const dateStr = formatDate(date);
  
  return `${year}/${month}/${clientName}/${dateStr}/${fileName}`;
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

