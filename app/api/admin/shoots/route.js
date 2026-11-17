import { handler, json, readJson } from '@/lib/api';
import { createShoot } from '@/lib/service';

export const dynamic = 'force-dynamic';

export const POST = handler(async (req) => json(await createShoot(await readJson(req)), 201), { admin: true });
