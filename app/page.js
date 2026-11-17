import { BRAND } from '@/lib/constants';

export default function Home() {
  return (
    <>
      <header className="pub-header">
        <div className="eyebrow">{BRAND.name}</div>
        <h1>{BRAND.appTitle}</h1>
      </header>
      <main className="pub-wrap">
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>Gebruik de link van de organisatie</h2>
          <p className="muted">
            Open de link die je van de organisatie hebt ontvangen via WhatsApp of e-mail.
            Daarin staan je provincie en shoot al klaar.
          </p>
          <p className="small muted">Geen link ontvangen? Neem contact op met de organisatie.</p>
        </div>
      </main>
    </>
  );
}
