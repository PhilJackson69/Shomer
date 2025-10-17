/**
 * Convert data to CSV format with proper escaping
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  // Escape and quote fields that contain comma, quote, or newline
  const escapeField = (field: string | number | null | undefined): string => {
    if (field === null || field === undefined) {
      return '';
    }
    
    const str = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  };

  // Convert headers to CSV row
  const headerRow = headers.map(escapeField).join(',');
  
  // Convert data rows to CSV
  const dataRows = rows.map(row => 
    row.map(escapeField).join(',')
  );
  
  return [headerRow, ...dataRows].join('\n');
}
