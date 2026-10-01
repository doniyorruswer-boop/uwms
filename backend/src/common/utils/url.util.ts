import { BadRequestException } from '@nestjs/common';

/**
 * Validates whether an IPv4 address is in a private, loopback, or link-local range.
 */
function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata service)
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (Carrier grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224) return true;

  return false;
}

/**
 * Validates whether an IPv6 address is loopback, unique local, or link-local.
 */
function isPrivateOrReservedIpv6(ip: string): boolean {
  const clean = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1') return true;
  // fe80::/10 (Link-local)
  if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) {
    return true;
  }
  // fc00::/7 (Unique local)
  if (clean.startsWith('fc') || clean.startsWith('fd')) {
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (clean.startsWith('::ffff:')) {
    const v4 = clean.replace('::ffff:', '');
    return isPrivateOrReservedIpv4(v4);
  }
  return false;
}

/**
 * Validates that an outbound target URL is safe from Server-Side Request Forgery (SSRF).
 * Blocks loopback addresses, local/internal networks, and cloud metadata endpoints.
 * Returns the normalized URL string if valid, otherwise throws BadRequestException.
 */
export function validateSafeOutboundUrl(urlStr: string | null | undefined): string {
  if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) {
    throw new BadRequestException('URL manzili kiritilishi shart!');
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    throw new BadRequestException('Yaroqsiz URL formati kiritildi!');
  }

  // Only HTTP and HTTPS protocols are permitted
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(
      `Xavfsizlik cheklovi: faqat http:// yoki https:// protokollariga ruxsat beriladi (${parsed.protocol})`,
    );
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Block localhost, local domains, and single-label internal hosts
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.test') ||
    hostname.endsWith('.example') ||
    !hostname.includes('.') // Disallow single-word internal domain names like "metadata", "consul", etc.
  ) {
    throw new BadRequestException(
      `Xavfsizlik cheklovi: Ichki tarmoq yoki server lokal manzillariga (${hostname}) so‘rov yuborish taqiqlangan! (SSRF Protection)`,
    );
  }

  // IPv4 validation
  const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  if (isIpv4 && isPrivateOrReservedIpv4(hostname)) {
    throw new BadRequestException(
      `Xavfsizlik cheklovi: Ichki tarmoq yoki maxfiy IP manzilga (${hostname}) ulanish taqiqlangan! (SSRF Protection)`,
    );
  }

  // IPv6 validation
  if (hostname.includes(':') && isPrivateOrReservedIpv6(hostname)) {
    throw new BadRequestException(
      `Xavfsizlik cheklovi: Ichki yoki lokal IPv6 manzilga (${hostname}) ulanish taqiqlangan! (SSRF Protection)`,
    );
  }

  return parsed.toString();
}
