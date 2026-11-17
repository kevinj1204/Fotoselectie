import { handler, json } from '@/lib/api';
import { getTotals, listShootsWithProgress } from '@/lib/service';
import { getExtraPrice } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const [totals, shoots, price] = await Promise.all([getTotals(), listShootsWithProgress(), getExtraPrice()]);
  return json({ totals, shoots, extra_photo_price: price });
}, { admin: true });
