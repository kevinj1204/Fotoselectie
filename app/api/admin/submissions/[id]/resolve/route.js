import { handler, json, readJson } from '@/lib/api';
import { resolveDuplicate } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req, { params }) => {
  const { id } = await params;
  const { action } = await readJson(req);
  return json(await resolveDuplicate(id, action));
}, { admin: true });
