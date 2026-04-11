/**
 * Safari-compatible date parser and utilities.
 * Safari does not support the 'YYYY-MM-DD HH:mm:ss' format (uses spaces).
 * It requires ISO 8601 with 'T' or the slash '/' separator.
 */

export const parseSafeDate = (dateString: any): Date => {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return dateString;
  
  try {
    // 1. If it's a timestamp number
    if (typeof dateString === 'number') return new Date(dateString);
    
    // 2. Standardize string for Safari (Space -> T)
    const standardized = dateString.toString().trim().replace(/\s+/, 'T');
    const date = new Date(standardized);
    
    // 3. Fallback for very old strings or weird formats
    if (isNaN(date.getTime())) {
      // Try again with slashes (some formats use - instead of /)
      return new Date(dateString.toString().replace(/-/g, '/'));
    }
    
    return date;
  } catch (e) {
    console.error('Date parsing error for:', dateString, e);
    return new Date();
  }
};

/**
 * Formats a date for display safely across all browsers.
 */
export const formatDisplayDate = (date: any, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }) => {
  return parseSafeDate(date).toLocaleDateString('ar-EG', options);
};

/**
 * Formats a date and time for display.
 */
export const formatDisplayDateTime = (date: any) => {
  return parseSafeDate(date).toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format bytes to human-readable size
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format date to Arabic locale
 */
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};
