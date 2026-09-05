/**
 * Strip HTML tags from a string and normalise whitespace.
 * Returns an empty string for null/undefined input.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
