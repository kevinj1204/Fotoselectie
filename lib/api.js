import 'server-only';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from './auth';
import { HttpError } from './service';

export function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function requireAdmin() {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) throw new HttpError(401, 'Niet ingelogd.');
  return session;
}

/** Wrapper: vangt fouten af en zet ze om naar nette JSON-meldingen. */
export function handler(fn, { admin = false } = {}) {
  return async (req, ctx) => {
    try {
      if (admin) await requireAdmin();
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error(e);
      return json({ error: 'Er ging iets mis aan onze kant. Probeer het opnieuw.' }, 500);
    }
  };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Ongeldig verzoek.');
  }
}
