import { handler, json, readJson } from '@/lib/api';
import { updateShoot, deleteShoot } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const PATCH = handler(async (req, { params }) => {
  const { id } = await params;
  return json(await updateShoot(id, await readJson(req)));
}, { admin: true });

export const DELETE = handler(async (req, { params }) => {
  const { id } = await params;
  await deleteShoot(id);
  return json({ ok: true });
}, { admin: true });
