// Sessie-cookie voor de beheerder (Edge- en Node-compatibel).
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'hs_admin';
const SESSION_HOURS = 12;

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET ontbreekt of is korter dan 32 tekens.');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(email) {
  return new SignJWT({ role: 'admin', email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
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
