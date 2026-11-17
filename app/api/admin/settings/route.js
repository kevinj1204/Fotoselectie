import { handler, json, readJson } from '@/lib/api';
import { setExtraPrice } from '@/lib/service';
import { getExtraPrice } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => json({ extra_photo_price: await getExtraPrice() }), { admin: true });

export const PUT = handler(async (req) => {
  const { extra_photo_price } = await readJson(req);
  return json({ extra_photo_price: await setExtraPrice(extra_photo_price) });
}, { admin: true });
