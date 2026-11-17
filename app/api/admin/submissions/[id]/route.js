import { handler, json, readJson } from '@/lib/api';
import { getSubmission, updateSubmission, deleteSubmission } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req, { params }) => {
  const { id } = await params;
  return json(await getSubmission(id));
}, { admin: true });

export const PATCH = handler(async (req, { params }) => {
  const { id } = await params;
  return json(await updateSubmission(id, await readJson(req)));
}, { admin: true });

export const DELETE = handler(async (req, { params }) => {
  const { id } = await params;
  await deleteSubmission(id);
  return json({ ok: true });
}, { admin: true });
