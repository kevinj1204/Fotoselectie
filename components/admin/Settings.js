'use client';
import { useState } from 'react';
import { api } from './api';
import { formatEuro } from '@/lib/validation';

export default function Settings({ data, reload, toast }) {
  const [price, setPrice] = useState(String(data.extra_photo_price).replace('.', ','));
  const [err, setErr] = useState('');

  async function save(e) {
    e.preventDefault();
    setErr('');
    try {
      await api('/api/admin/settings', { method: 'PUT', body: { extra_photo_price: price } });
      await reload();
      toast('Tarief opgeslagen');
    } catch (e2) { setErr(e2.message); }
  }

  return (
    <>
      <div className="section-title" style={{ marginTop: 0 }}><h2>Tarief extra foto&apos;s</h2></div>
      <form className="card" onSubmit={save} style={{ maxWidth: 520, marginTop: 0 }}>
        <label className="label" htmlFor="price">Prijs per extra foto (€)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button className="btn btn-primary">Opslaan</button>
        </div>
        <div className="hint">Huidig tarief: {formatEuro(data.extra_photo_price)}. Een nieuw tarief geldt voor nieuwe inzendingen; bestaande inzendingen houden het tarief van het moment van inzenden.</div>
        {err && <div className="alert alert-error">{err}</div>}
      </form>

      <div className="section-title"><h2>Exporteren</h2></div>
      <div className="card" style={{ marginTop: 0 }}>
        <h3 style={{ fontSize: 19 }}>Alle inzendingen</h3>
        <p className="small muted">Shoot, naam, categorie, provincie, hoofd- en extra fotonummers, aantal, kosten en datum/tijd. Wil je een gefilterde export? Gebruik de exportknoppen op het tabblad Inzendingen.</p>
        <div className="row-actions">
          <a className="btn btn-sm btn-primary" href="/api/admin/export?type=submissions&format=xlsx">Excel (.xlsx)</a>
          <a className="btn btn-sm btn-outline" href="/api/admin/export?type=submissions&format=csv">CSV</a>
        </div>
        <h3 style={{ fontSize: 19, marginTop: 20 }}>Voortgang per shoot en provincie</h3>
        <p className="small muted">Verwachte aantallen, ontvangen, resterend, status en deadline per shoot/provincie.</p>
        <div className="row-actions">
          <a className="btn btn-sm btn-primary" href="/api/admin/export?type=progress&format=xlsx">Excel (.xlsx)</a>
          <a className="btn btn-sm btn-outline" href="/api/admin/export?type=progress&format=csv">CSV</a>
        </div>
        <p className="small muted" style={{ marginTop: 14 }}>Tip: de Excel-versie opent direct netjes in Excel; CSV is handig voor andere programma’s.</p>
      </div>
    </>
  );
}
