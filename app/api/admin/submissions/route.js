import { handler, json } from '@/lib/api';
import { listSubmissions } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return json({ submissions: await listSubmissions(params) });
}, { admin: true });
