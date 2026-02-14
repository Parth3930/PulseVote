import FpJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

export async function getVisitorId(): Promise<string> {
  if (!fpPromise) {
    fpPromise = FpJS.load();
  }

  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
}

export function getClientIp(request: Request): string {
  // Try various headers that might contain the real IP
  const headers = request.headers;

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to a generic value (this shouldn't happen in production)
  return '0.0.0.0';
}
