'use client';
import { useState } from 'react';
import bcrypt from 'bcryptjs';

// Maakt in je eigen browser een versleutelde versie (hash) van je wachtwoord.
// Het wachtwoord wordt nergens naartoe gestuurd of opgeslagen.
export default function PasswordHashPage() {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [hash, setHash] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function make(e) {
    e.preventDefault();
    setErr(''); setHash(''); setCopied(false);
    if (pw.length < 10) { setErr('Kies een wachtwoord van minimaal 10 tekens.'); return; }
    if (pw !== pw2) { setErr('De wachtwoorden zijn niet gelijk.'); return; }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    const h = bcrypt.hashSync(pw, 12);
    setHash('b64:' + btoa(h));
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" style={{ maxWidth: 520 }} onSubmit={make}>
        <h2>Beheerderswachtwoord instellen</h2>
        <p className="small muted">Je wachtwoord blijft in deze browser; alleen de versleutelde versie zet je in Vercel.</p>
        <div className="field">
          <label className="label" htmlFor="pw">Nieuw wachtwoord</label>
          <input id="pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="pw2">Herhaal wachtwoord</label>
          <input id="pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {err && <div className="alert alert-error">{err}</div>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy}>{busy ? 'Bezig…' : 'Maak versleutelde waarde'}</button>
        {hash && (
          <div style={{ marginTop: 18 }}>
            <div className="label">Waarde voor ADMIN_PASSWORD_HASH</div>
            <div className="link-box" style={{ fontFamily: 'monospace' }}>{hash}</div>
            <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 8 }}
              onClick={async () => { try { await navigator.clipboard.writeText(hash); setCopied(true); } catch {} }}>
              {copied ? 'Gekopieerd ✓' : 'Kopieer waarde'}
            </button>
            <ol className="small" style={{ marginTop: 14, paddingLeft: 18 }}>
              <li>Vercel → project <b>fotoselectie</b> → Settings → Environment Variables.</li>
              <li>Naam <b>ADMIN_PASSWORD_HASH</b>, plak de waarde, Save.</li>
              <li>Deployments → laatste deployment → ⋯ → Redeploy.</li>
              <li>Log daarna in via <b>/admin</b> met je e-mailadres en dit wachtwoord.</li>
            </ol>
          </div>
        )}
      </form>
    </div>
  );
}
