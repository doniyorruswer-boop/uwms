/**
 * HTML sanitization and escaping utilities to prevent Stored & Reflected XSS vulnerabilities.
 */

/**
 * Escapes characters that have special meaning in HTML to their corresponding safe entity representations.
 * Handles strings, numbers, and null/undefined values safely.
 */
export function escapeHtml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) {
    return '';
  }
  const str = String(unsafe);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes potentially pre-rendered HTML by stripping dangerous executable elements
 * like <script>, <iframe>, <object>, <embed>, dangerous attributes (onload, onerror, etc.),
 * and javascript: or data: URIs.
 */
export function stripDangerousHtmlTags(html: string | null | undefined): string {
  if (!html) return '';

  return html
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove iframe tags (paired or self-closing)
    .replace(/<iframe\b[^>]*>(?:[\s\S]*?<\/iframe>)?/gi, '')
    // Remove object tags (paired or self-closing)
    .replace(/<object\b[^>]*>(?:[\s\S]*?<\/object>)?/gi, '')
    // Remove embed tags (paired or self-closing)
    .replace(/<embed\b[^>]*>(?:[\s\S]*?<\/embed>)?/gi, '')
    // Remove inline event handlers: onclick, onerror, onload, etc.
    .replace(/\s+on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s+on\w+\s*=\s*[^ >]+/gi, '')
    // Remove javascript: and vbscript: URIs
    .replace(/href\s*=\s*(['"])\s*(javascript|vbscript):.*?\1/gi, 'href="#"')
    .replace(/src\s*=\s*(['"])\s*(javascript|vbscript):.*?\1/gi, 'src=""');
}
