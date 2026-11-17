import { getPublicShoot } from '@/lib/service';
import { getExtraPrice } from '@/lib/db';
import { BRAND } from '@/lib/constants';
import ParticipantForm from '@/components/ParticipantForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: `${BRAND.name} – Fotoselectie` };
}

export default async function ShootPage({ params }) {
  const { token } = await params;
  const shoot = await getPublicShoot(token);

  if (!shoot) {
    return (
      <>
        <header className="pub-header">
          <div className="eyebrow">{BRAND.name}</div>
          <h1>{BRAND.appTitle}</h1>
        </header>
        <main className="pub-wrap">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>Deze link werkt niet (meer)</h2>
            <p className="muted">Controleer of je de volledige link hebt geopend, of neem contact op met de organisatie.</p>
          </div>
        </main>
      </>
    );
  }

  const price = await getExtraPrice();
  return <ParticipantForm token={token} shoot={shoot} price={price} />;
}
