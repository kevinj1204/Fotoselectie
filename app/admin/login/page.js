'use client';
import { useState } from 'react';
import { BRAND } from '@/lib/constants';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) window.location.href = '/admin';
      else setError(data.error || 'Inloggen mislukt.');
    } catch {
      setError('Geen verbinding. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="small muted" style={{ letterSpacing: '.2em', textTransform: 'uppercase' }}>{BRAND.name}</div>
        <h2 style={{ marginTop: 4 }}>Beheer – inloggen</h2>
        <div className="field">
          <label className="label" htmlFor="email">E-mailadres</label>
          <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Wachtwoord</label>
          <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={busy}>{busy ? 'Bezig…' : 'Inloggen'}</button>
        <p className="small muted" style={{ textAlign: 'center', marginTop: 14 }}><a href="/admin/wachtwoord">Wachtwoord instellen of wijzigen</a></p>
      </form>
    </div>
  );
}
