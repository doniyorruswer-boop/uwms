import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent Cross-Site Scripting (XSS) attacks.
 * Allows safe tags and formatting used in university official documents (OS-1, OS-2, clearance certificates),
 * while strictly stripping harmful JavaScript, event handlers, and execution payloads.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';

  // Extract any <style> tags (e.g. from <head> of full HTML documents)
  const styleBlocks = dirty.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const rawStyles = styleBlocks.join('\n');

  const sanitized = DOMPurify.sanitize(dirty, {
    ADD_TAGS: ['style'],
    ADD_ATTR: [
      'target',
      'style',
      'class',
      'colspan',
      'rowspan',
      'cellpadding',
      'cellspacing',
      'border',
      'align',
      'valign',
      'width',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
  });

  // If DOMPurify dropped the <style> tags (because they were located inside <head>),
  // safely re-inject them so that the document is styled properly in the UI.
  if (rawStyles && !sanitized.includes('<style')) {
    const safeStyles = DOMPurify.sanitize(rawStyles, {
      FORCE_BODY: true,
      ADD_TAGS: ['style'],
    });
    return `${safeStyles}\n${sanitized}`;
  }

  return sanitized;
}
