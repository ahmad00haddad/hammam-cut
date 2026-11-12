/**
 * One CSV cell. Customer-controlled text that starts with = + - @ (or a tab/CR) would be run as a
 * formula by Excel / Sheets, so those get a leading apostrophe. Quotes are doubled.
 */
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  // plain phone numbers like +962 79 123 4567 are safe; anything else starting with a trigger is not
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}
