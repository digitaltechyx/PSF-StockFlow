/**
 * Time utility functions for New Jersey timezone (America/New_York)
 * Handles timezone conversion and upload time restrictions
 */

/**
 * Get current time in New Jersey timezone (America/New_York)
 * This automatically handles EST/EDT (Eastern Standard/Daylight Time)
 */
export function getNewJerseyTime(): Date {
  const now = new Date();
  // Get time string in New Jersey timezone and parse it
  const njTimeString = now.toLocaleString("en-US", { 
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  
  // Parse the time string to get hours
  // Format: "MM/DD/YYYY, HH:MM:SS"
  const [datePart, timePart] = njTimeString.split(", ");
  const [hours] = timePart.split(":").map(Number);
  
  // Create a date object with the correct hours for comparison
  // We'll use the local date but adjust hours based on NJ time
  const njDate = new Date(now);
  const localHours = njDate.getHours();
  const njHours = hours;
  
  // Calculate the difference and adjust
  const hourDiff = njHours - localHours;
  njDate.setHours(localHours + hourDiff);
  
  return njDate;
}

/**
 * Get formatted time string in New Jersey timezone
 */
export function getNewJerseyTimeString(): string {
  const now = new Date();
  return now.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

/**
 * Get hours in New Jersey timezone
 */
function getNewJerseyHours(): number {
  const now = new Date();
  const njTimeString = now.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(njTimeString, 10);
}

/**
 * Check if current New Jersey time is within upload window (12am - 11:59am)
 * @returns true if uploads are allowed, false otherwise
 */
export function isUploadTimeAllowed(): boolean {
  const hours = getNewJerseyHours();
  
  // Allow uploads between 12am (0) and 11:59am (11)
  // 0 <= hours < 12 means 12:00 AM to 11:59 AM
  return hours >= 0 && hours < 12;
}

/**
 * Get time until next upload window opens
 * @returns string describing when uploads will be available again
 */
export function getTimeUntilNextUploadWindow(): string {
  const now = new Date();
  const njTimeString = now.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const [hours, minutes] = njTimeString.split(":").map(Number);
  
  // If it's 12pm or later, calculate time until midnight (next day)
  if (hours >= 12) {
    const hoursUntilMidnight = 24 - hours;
    const minutesUntilMidnight = 60 - minutes;
    
    if (hoursUntilMidnight === 24 && minutesUntilMidnight === 60) {
      return "Uploads will be available at 12:00 AM";
    }
    
    if (hoursUntilMidnight === 24) {
      return `Uploads will be available in ${minutesUntilMidnight - 1} minutes`;
    }
    
    if (minutesUntilMidnight === 60) {
      return `Uploads will be available in ${hoursUntilMidnight - 1} hours`;
    }
    
    return `Uploads will be available in ${hoursUntilMidnight - 1}h ${minutesUntilMidnight - 1}m`;
  }
  
  // If it's before 12am (shouldn't happen, but handle edge case)
  return "Uploads are currently allowed";
}

/**
 * Get upload window description
 */
export function getUploadWindowDescription(): string {
  return "Uploads are allowed between 12:00 AM - 11:59 AM (New Jersey Time)";
}

