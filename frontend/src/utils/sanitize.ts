import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent Cross-Site Scripting (XSS) attacks.
 * Allows safe tags and formatting used in university official documents (OS-1, OS-2, clearance certificates),
 * while strictly stripping harmful JavaScript, event handlers, and execution payloads.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ['style'],
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
  });
}
