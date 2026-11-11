import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode buffer into standard RFC 3548 / RFC 4648 Base32 string (Google Authenticator compatible)
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decode standard Base32 string back to Buffer
 */
export function base32Decode(base32String: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  const clean = base32String.toUpperCase().replace(/[\s=-]/g, '');

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Generate cryptographically secure random Base32 secret for Google Authenticator (160-bit key)
 */
export function generateBase32Secret(byteLength = 20): string {
  const randomBytes = crypto.randomBytes(byteLength);
  return base32Encode(randomBytes);
}

/**
 * Generate standard 6-digit TOTP token for given secret and step offset (RFC 6238)
 */
export function generateTotpToken(secretBase32: string, timeStepOffset = 0): string {
  const secret = base32Decode(secretBase32);
  const timeStep = Math.floor(Date.now() / 1000 / 30) + timeStepOffset;
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', secret).update(timeBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, '0');
}

/**
 * Verify given token against secret with ±window tolerance (default: ±1 step = ±30 seconds)
 */
export function verifyTotpToken(token: string, secretBase32: string, window = 1): boolean {
  if (!token || !secretBase32) return false;
  const cleanToken = token.trim().replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  for (let offset = -window; offset <= window; offset++) {
    if (generateTotpToken(secretBase32, offset) === cleanToken) {
      return true;
    }
  }

  return false;
}

/**
 * Generate standard otpauth:// URI to display as QR code in Google Authenticator
 */
export function generateOtpAuthUri(
  accountName: string,
  issuer: string,
  secretBase32: string,
): string {
  const cleanIssuer = encodeURIComponent(issuer.trim());
  const cleanAccount = encodeURIComponent(accountName.trim());
  return `otpauth://totp/${cleanIssuer}:${cleanAccount}?secret=${secretBase32}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate backup recovery codes for emergency access
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}
