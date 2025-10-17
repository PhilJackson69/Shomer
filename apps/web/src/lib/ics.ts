/**
 * iCalendar (.ics) utility functions for RFC 5545 compliance
 */

/**
 * Format a Date to UTC iCalendar format (YYYYMMDDTHHMMSSZ)
 */
export function formatIcsDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text content for iCalendar according to RFC 5545
 * Escapes commas, semicolons, backslashes, and newlines
 */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/,/g, '\\,')    // Escape commas
    .replace(/;/g, '\\;')    // Escape semicolons
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r');  // Escape carriage returns
}

/**
 * Build a complete VCALENDAR with VEVENT entries
 */
export function buildVCalendar({
  orgName,
  tz = 'UTC',
  events,
}: {
  orgName: string;
  tz?: string;
  events: Array<{
    uid: string;
    dtstamp: Date;
    dtstart: Date;
    dtend: Date;
    summary: string;
    description: string;
    location: string;
  }>;
}): string {
  const lines: string[] = [];
  
  // VCALENDAR header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Shomer//On-Call//EN');
  lines.push(`X-WR-CALNAME:${escapeText(`Shomer On-Call — ${orgName}`)}`);
  lines.push(`X-WR-TIMEZONE:${tz}`);
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  
  // Add each VEVENT
  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${formatIcsDateUtc(event.dtstamp)}`);
    lines.push(`DTSTART:${formatIcsDateUtc(event.dtstart)}`);
    lines.push(`DTEND:${formatIcsDateUtc(event.dtend)}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push('END:VEVENT');
  }
  
  // VCALENDAR footer
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n') + '\r\n';
}
