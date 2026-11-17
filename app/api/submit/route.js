import { handler, json, readJson } from '@/lib/api';
import { submitParticipant } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => {
  const body = await readJson(req);
  const result = await submitParticipant(body);
  return json(result, 201);
});
