import { validateSafeOutboundUrl } from './url.util';
import { BadRequestException } from '@nestjs/common';

describe('url.util - SSRF Protection', () => {
  it('should accept valid public HTTPS URLs', () => {
    const validUrl = 'https://hemis.otm.uz/rest/v1';
    expect(validateSafeOutboundUrl(validUrl)).toBe('https://hemis.otm.uz/rest/v1');
  });

  it('should accept valid public HTTP URLs with standard domains', () => {
    const validUrl = 'http://api.university.edu.uz/endpoint';
    expect(validateSafeOutboundUrl(validUrl)).toBe('http://api.university.edu.uz/endpoint');
  });

  it('should block localhost and *.localhost', () => {
    expect(() => validateSafeOutboundUrl('http://localhost:3000')).toThrow(BadRequestException);
    expect(() => validateSafeOutboundUrl('http://sub.localhost:8080')).toThrow(BadRequestException);
  });

  it('should block 127.0.0.1 and loopback IPs', () => {
    expect(() => validateSafeOutboundUrl('http://127.0.0.1:4000/api')).toThrow(BadRequestException);
    expect(() => validateSafeOutboundUrl('http://127.1.2.3:80')).toThrow(BadRequestException);
  });

  it('should block AWS / Cloud metadata IP 169.254.169.254', () => {
    expect(() => validateSafeOutboundUrl('http://169.254.169.254/latest/meta-data')).toThrow(BadRequestException);
  });

  it('should block RFC1918 private IPv4 networks (10.x, 172.16-31.x, 192.168.x)', () => {
    expect(() => validateSafeOutboundUrl('http://10.0.0.5/api')).toThrow(BadRequestException);
    expect(() => validateSafeOutboundUrl('http://172.16.0.1/admin')).toThrow(BadRequestException);
    expect(() => validateSafeOutboundUrl('http://172.31.255.254')).toThrow(BadRequestException);
    expect(() => validateSafeOutboundUrl('http://192.168.1.1:8080')).toThrow(BadRequestException);
  });

  it('should block internal single-label hostnames without dots (e.g. http://metadata/)', () => {
    expect(() => validateSafeOutboundUrl('http://metadata/')).toThrow(BadRequestException);
    expect(() => validateSafeOutboundUrl('http://intranet/api')).toThrow(BadRequestException);
  });

  it('should block .internal, .local, and .lan hostnames', () => {
    expect(() => validateSafeOutboundUrl('http://redis.local')).toThrow(BadRequestException);
    expect(() => validateSafeOutboundUrl('http://db.internal')).toThrow(BadRequestException);
  });

  it('should block IPv6 loopback and private ranges', () => {
    expect(() => validateSafeOutboundUrl('http://[::1]:8080')).toThrow(BadRequestException);
  });

  it('should block unsupported protocols like file:// or gopher://', () => {
    expect(() => validateSafeOutboundUrl('file:///etc/passwd')).toThrow(BadRequestException);
    expect(() => validateSafeOutboundUrl('gopher://evil.com')).toThrow(BadRequestException);
  });
});
