import bcrypt from 'bcryptjs';
import { handler, json, readJson } from '@/lib/api';
import { query } from '@/lib/db';
import { HttpError } from '@/lib/service';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_FAILS = 8;
const WINDOW_MIN = 15;

function passwordHash() {
  let h = process.env.ADMIN_PASSWORD_HASH || '';
  if (h.startsWith('b64:')) h = Buffer.from(h.slice(4), 'base64').toString('utf8');
  return h;
}

export const POST = handler(async (req) => {
  const ip = (req.headers.get('x-forwarded-for') || 'onbekend').split(',')[0].trim().slice(0, 64);
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM login_attempts WHERE ip = $1 AND success = false AND created_at > now() - interval '${WINDOW_MIN} minutes'`,
    [ip]
  );
  if (rows[0].n >= MAX_FAILS) throw new HttpError(429, `Te veel mislukte pogingen. Probeer het over ${WINDOW_MIN} minuten opnieuw.`);

  const { email, password } = await readJson(req);
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const hash = passwordHash();
  if (!adminEmail || !hash) throw new HttpError(500, 'De beheerder-login is nog niet ingesteld (ADMIN_EMAIL / ADMIN_PASSWORD_HASH).');

  const emailOk = String(email || '').trim().toLowerCase() === adminEmail;
  const passOk = await bcrypt.compare(String(password || ''), hash);
  await query('INSERT INTO login_attempts (ip, success) VALUES ($1, $2)', [ip, emailOk && passOk]);
  await query(`DELETE FROM login_attempts WHERE created_at < now() - interval '7 days'`);
  if (!emailOk || !passOk) throw new HttpError(401, 'E-mailadres of wachtwoord klopt niet.');

  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(adminEmail), sessionCookieOptions);
  return res;
});
