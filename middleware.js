import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from './lib/auth';

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === '/admin/login' || pathname === '/admin/wachtwoord' || pathname === '/api/admin/login';

  // CSRF-bescherming: wijzigende beheerverzoeken moeten van dezelfde site komen.
  if (pathname.startsWith('/api/admin') && !['GET', 'HEAD'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (!origin || new URL(origin).host !== host) {
      return NextResponse.json({ error: 'Verzoek geweigerd.' }, { status: 403 });
    }
  }

  if (isLogin) return NextResponse.next();

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
