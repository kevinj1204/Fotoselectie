// Sessie-cookie voor de beheerder (Edge- en Node-compatibel).
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'hs_admin';
const SESSION_HOURS = 12;

// Sleutel voor de sessie-cookie. SESSION_SECRET is optioneel: zonder wordt de sleutel afgeleid
// van de (geheime) databaseverbinding + wachtwoord-hash. Wachtwoord wijzigen = iedereen uitgelogd.
let cachedKey = null;
let cachedFrom = null;
async function secretKey() {
  const base = process.env.SESSION_SECRET ||
    `${process.env.DATABASE_URL || process.env.POSTGRES_URL || ''}|${process.env.ADMIN_PASSWORD_HASH || ''}`;
  if (base.length < 32) throw new Error('Beheer-login is nog niet ingesteld (ADMIN_PASSWORD_HASH / DATABASE_URL).');
  if (cachedKey && cachedFrom === base) return cachedKey;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hs-session|' + base));
  cachedKey = new Uint8Array(digest);
  cachedFrom = base;
  return cachedKey;
}

export async function createSessionToken(email) {
  return new SignJWT({ role: 'admin', email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(await secretKey());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secretKey());
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_HOURS * 3600,
};
