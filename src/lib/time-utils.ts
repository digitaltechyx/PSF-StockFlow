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
 * Check if current New Jersey time is within upload window (5pm - 11am)
 * @returns true if uploads are allowed, false otherwise
 */
export function isUploadTimeAllowed(): boolean {
  const hours = getNewJerseyHours();
  
  // Allow uploads between 5pm (17) and 11am (11) next day
  // hours >= 17 means 5:00 PM to 11:59 PM
  // hours < 11 means 12:00 AM to 10:59 AM (uploads allowed until 11:00 AM)
  return hours >= 17 || hours < 11;
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
  
  // If it's between 11am and 5pm, calculate time until 5pm (17:00)
  if (hours >= 11 && hours < 17) {
    const hoursUntil5pm = 17 - hours;
    const minutesUntil5pm = 60 - minutes;
    
    if (hoursUntil5pm === 0 && minutesUntil5pm === 60) {
      return "Uploads will be available at 5:00 PM";
    }
    
    if (hoursUntil5pm === 0) {
      return `Uploads will be available in ${minutesUntil5pm - 1} minutes`;
    }
    
    if (minutesUntil5pm === 60) {
      return `Uploads will be available in ${hoursUntil5pm} hours`;
    }
    
    return `Uploads will be available in ${hoursUntil5pm - 1}h ${minutesUntil5pm - 1}m`;
  }
  
  // If it's before 11am or after 5pm, uploads are currently allowed
  return "Uploads are currently allowed";
}

/**
 * Get upload window description
 */
export function getUploadWindowDescription(): string {
  return "Uploads are allowed between 5:00 PM - 11:00 AM (New Jersey Time)";
}

/**
 * Get remaining time until upload window closes (11:00 AM)
 * @returns object with hours, minutes, seconds remaining
 */
export function getTimeUntilUploadWindowCloses(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const njTimeString = now.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const [hours, minutes, seconds] = njTimeString.split(":").map(Number);
  
  // Calculate time until 11:00 AM
  const targetHour = 11;
  const targetMinute = 0;
  const targetSecond = 0;
  
  let totalSecondsRemaining: number;
  
  // If we're in the evening/night part (5pm-11:59pm), calculate time until 11am next day
  if (hours >= 17) {
    // Time until midnight + 11 hours
    const secondsUntilMidnight = (24 * 3600) - (hours * 3600 + minutes * 60 + seconds);
    const secondsUntil11am = secondsUntilMidnight + (11 * 3600);
    totalSecondsRemaining = secondsUntil11am;
  } else {
    // We're in the morning part (12am-10:59am), calculate time until 11am today
    totalSecondsRemaining = (targetHour * 3600 + targetMinute * 60 + targetSecond) - (hours * 3600 + minutes * 60 + seconds);
  }
  
  // If we're past 11 AM (and before 5pm), return 0
  if (totalSecondsRemaining <= 0) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }
  
  const hoursRemaining = Math.floor(totalSecondsRemaining / 3600);
  const minutesRemaining = Math.floor((totalSecondsRemaining % 3600) / 60);
  const secondsRemaining = totalSecondsRemaining % 60;
  
  return { hours: hoursRemaining, minutes: minutesRemaining, seconds: secondsRemaining };
}

/**
 * Get remaining time until upload window opens (5:00 PM)
 * @returns object with hours, minutes, seconds remaining
 */
export function getTimeUntilUploadWindowOpens(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const njTimeString = now.toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const [hours, minutes, seconds] = njTimeString.split(":").map(Number);
  
  // Calculate time until 5:00 PM (17:00)
  const targetHour = 17;
  const targetMinute = 0;
  const targetSecond = 0;
  
  const currentTotalSeconds = hours * 3600 + minutes * 60 + seconds;
  const targetTotalSeconds = targetHour * 3600 + targetMinute * 60 + targetSecond;
  
  let totalSecondsRemaining = targetTotalSeconds - currentTotalSeconds;
  
  // If we're past 5pm, calculate time until 5pm next day
  if (totalSecondsRemaining <= 0) {
    const secondsUntilMidnight = (24 * 3600) - currentTotalSeconds;
    totalSecondsRemaining = secondsUntilMidnight + targetTotalSeconds;
  }
  
  const hoursRemaining = Math.floor(totalSecondsRemaining / 3600);
  const minutesRemaining = Math.floor((totalSecondsRemaining % 3600) / 60);
  const secondsRemaining = totalSecondsRemaining % 60;
  
  return { hours: hoursRemaining, minutes: minutesRemaining, seconds: secondsRemaining };
}

/**
 * Format time remaining as a readable string
 */
export function formatTimeRemaining(time: { hours: number; minutes: number; seconds: number }): string {
  if (time.hours > 0) {
    return `${time.hours}h ${time.minutes}m ${time.seconds}s`;
  } else if (time.minutes > 0) {
    return `${time.minutes}m ${time.seconds}s`;
  } else {
    return `${time.seconds}s`;
  }
}

