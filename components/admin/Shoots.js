'use client';
import { useState } from 'react';
import { api, shareLink, copyText } from './api';
import { ShootProgress } from './Progress';
import { PROVINCES } from '@/lib/constants';
import { isValidHttpsUrl } from '@/lib/validation';
import { amsterdamLocalToDate, dateToAmsterdamLocal, formatDateTime } from '@/lib/time';

function shareWarnings(s) {
  const w = [];
  if (!s.gallery_ok) w.push('er is nog geen Shootstack-galerijlink ingesteld');
  if (!s.deadline_at) w.push('er is nog geen deadline ingesteld');
  if (!s.expected_participants) w.push('er is nog geen verwacht aantal deelnemers ingesteld');
  return w;
}

function confirmShare(s) {
  const w = shareWarnings(s);
  if (!w.length) return true;
  return window.confirm(`Let op: ${w.join(', ')}.\n\nWil je de link toch delen?`);
}

export default function Shoots({ data, reload, toast, onOpen }) {
  const [editing, setEditing] = useState(null); // null | {} (nieuw) | shoot
  const [showArchived, setShowArchived] = useState(false);
  const shoots = data.shoots.filter((s) => showArchived || !s.archived_at);

  async function act(fn, msg) {
    try { await fn(); await reload(); if (msg) toast(msg); } catch (e) { window.alert(e.message); }
  }

  function messageText(s) {
    const deadline = s.deadline_at ? `\nGraag uiterlijk doorgeven vóór ${formatDateTime(s.deadline_at)}.` : '';
    return `Hoi! Via deze link kun je je gekozen headshot doorgeven (${s.name}, ${s.province}):\n${shareLink(s.public_link_token)}${deadline}`;
  }

  return (
    <>
      <div className="section-title" style={{ marginTop: 0 }}>
        <h2>Shoots & deelnemerslinks</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Toon gearchiveerde
          </label>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>+ Nieuwe shoot</button>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: -4 }}>
        Stel per shoot eerst het verwachte aantal en de deadline in, en kopieer daarna de link. De link verandert niet als je de galerijlink of instellingen aanpast.
      </p>

      {PROVINCES.map((p) => {
        const list = shoots.filter((s) => s.province === p);
        return (
          <div key={p} className="group">
            <div className="subgroup-title">{p} <span className="badge">{list.length} shoot{list.length === 1 ? '' : 's'}</span></div>
            {list.length === 0 && <div className="empty small">Nog geen shoot. <button className="btn btn-sm btn-ghost" onClick={() => setEditing({ province: p })}>+ Shoot aanmaken</button></div>}
            <div className="prov-grid">
              {list.map((s) => {
                const warnings = shareWarnings(s);
                return (
                  <div className="prov" key={s.id}>
                    <h3>{s.name}</h3>
                    <ShootProgress s={s} />
                    {warnings.length > 0 && !s.archived_at && (
                      <div className="alert alert-warn small" style={{ marginTop: 10, padding: '8px 12px' }}>Vóór het delen: {warnings.join(', ')}.</div>
                    )}
                    <div className="link-box"><span style={{ flex: 1 }}>{shareLink(s.public_link_token)}</span></div>
                    <div className="row-actions">
                      <button className="btn btn-sm btn-primary" onClick={async () => { if (confirmShare(s) && await copyText(shareLink(s.public_link_token))) toast('Link gekopieerd'); }}>Link kopiëren</button>
                      <a className="btn btn-sm btn-outline" href={`https://wa.me/?text=${encodeURIComponent(messageText(s))}`} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => { if (!confirmShare(s)) e.preventDefault(); }}>WhatsApp</a>
                      <a className="btn btn-sm btn-outline" href={`mailto:?subject=${encodeURIComponent('Geef je headshot-keuze door')}&body=${encodeURIComponent(messageText(s))}`}
                        onClick={(e) => { if (!confirmShare(s)) e.preventDefault(); }}>E-mail</a>
                      <a className="btn btn-sm btn-ghost" href={`/s/${s.public_link_token}`} target="_blank" rel="noopener noreferrer">Bekijk formulier ↗</a>
                    </div>
                    <div className="row-actions">
                      <button className="btn btn-sm btn-outline" onClick={() => setEditing(s)}>Bewerken</button>
                      <button className="btn btn-sm btn-outline" onClick={() => onOpen({ shoot_id: s.id })}>Inzendingen ({s.submissions})</button>
                      {s.archived_at
                        ? <button className="btn btn-sm btn-ghost" onClick={() => act(() => api(`/api/admin/shoots/${s.id}`, { method: 'PATCH', body: { archived: false } }), 'Shoot teruggezet')}>Terugzetten</button>
                        : <button className="btn btn-sm btn-ghost" onClick={() => window.confirm(`Shoot "${s.name}" archiveren? De deelnemerslink werkt daarna niet meer; inzendingen blijven bewaard.`) && act(() => api(`/api/admin/shoots/${s.id}`, { method: 'PATCH', body: { archived: true } }), 'Shoot gearchiveerd')}>Archiveren</button>}
                      {s.submissions === 0 && <button className="btn btn-sm btn-ghost" style={{ color: 'var(--err)' }} onClick={() => window.confirm(`Shoot "${s.name}" definitief verwijderen?`) && act(() => api(`/api/admin/shoots/${s.id}`, { method: 'DELETE' }), 'Shoot verwijderd')}>Verwijderen</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {editing && (
        <ShootModal shoot={editing} onClose={() => setEditing(null)} onSaved={async (msg) => { setEditing(null); await reload(); toast(msg); }} />
      )}
    </>
  );
}

function ShootModal({ shoot, onClose, onSaved }) {
  const isNew = !shoot.id;
  const [f, setF] = useState({
    province: shoot.province || '',
    name: shoot.name || '',
    shootstack_gallery_url: shoot.shootstack_gallery_url || '',
    expected_participants: shoot.expected_participants ?? '',
    expected_teens: shoot.expected_teens ?? '',
    expected_misses: shoot.expected_misses ?? '',
    deadline_local: dateToAmsterdamLocal(shoot.deadline_at),
    allow_submissions_after_deadline: !!shoot.allow_submissions_after_deadline,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const urlInvalid = f.shootstack_gallery_url && !isValidHttpsUrl(f.shootstack_gallery_url);
  const t = Number(f.expected_teens || 0), m = Number(f.expected_misses || 0), tot = Number(f.expected_participants || 0);
  const sumMismatch = f.expected_teens !== '' && f.expected_misses !== '' && f.expected_participants !== '' && t + m !== tot;

  async function save(e) {
    e.preventDefault();
    setErr('');
    if (urlInvalid) { setErr('De Shootstack-link moet beginnen met https://'); return; }
    const deadline = f.deadline_local ? amsterdamLocalToDate(f.deadline_local) : null;
    const body = {
      province: f.province, name: f.name, shootstack_gallery_url: f.shootstack_gallery_url.trim(),
      expected_participants: f.expected_participants, expected_teens: f.expected_teens, expected_misses: f.expected_misses,
      deadline_at: deadline ? deadline.toISOString() : null,
      allow_submissions_after_deadline: f.allow_submissions_after_deadline,
    };
    setBusy(true);
    try {
      if (isNew) await api('/api/admin/shoots', { method: 'POST', body });
      else await api(`/api/admin/shoots/${shoot.id}`, { method: 'PATCH', body });
      onSaved(isNew ? 'Shoot aangemaakt' : 'Shoot opgeslagen');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!window.confirm('Nieuwe link maken? De oude link werkt daarna NIET meer. Doe dit alleen als de link bij de verkeerde personen terecht is gekomen.')) return;
    try {
      await api(`/api/admin/shoots/${shoot.id}`, { method: 'PATCH', body: { regenerate_link: true } });
      onSaved('Nieuwe link aangemaakt');
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={save}>
        <h2>{isNew ? 'Nieuwe shoot' : 'Shoot bewerken'}</h2>
        <div className="grid2">
          <div className="field">
            <label className="label" htmlFor="sh-prov">Provincie/regio</label>
            <select id="sh-prov" className="select input" value={f.province} onChange={(e) => set('province', e.target.value)} required disabled={!isNew && shoot.submissions > 0}>
              <option value="">Kies…</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="sh-name">Naam van de shoot</label>
            <input id="sh-name" className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Bijv. Officiële headshots" required />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="sh-url">Shootstack-galerijlink</label>
          <input id="sh-url" className={`input${urlInvalid ? ' has-error' : ''}`} type="url" inputMode="url" value={f.shootstack_gallery_url}
            onChange={(e) => set('shootstack_gallery_url', e.target.value)} placeholder="https://…" />
          {urlInvalid ? <div className="error-text">Gebruik een volledige link die begint met https://</div>
            : !f.shootstack_gallery_url && <div className="hint">Zonder link toont het formulier geen galerijknop.</div>}
        </div>
        <div className="grid3">
          <div className="field">
            <label className="label" htmlFor="sh-exp">Verwacht totaal</label>
            <input id="sh-exp" className="input" type="number" min="0" inputMode="numeric" value={f.expected_participants} onChange={(e) => set('expected_participants', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="sh-teens">Waarvan Teens</label>
            <input id="sh-teens" className="input" type="number" min="0" inputMode="numeric" value={f.expected_teens} onChange={(e) => set('expected_teens', e.target.value)} placeholder="optioneel" />
          </div>
          <div className="field">
            <label className="label" htmlFor="sh-miss">Waarvan Missen</label>
            <input id="sh-miss" className="input" type="number" min="0" inputMode="numeric" value={f.expected_misses} onChange={(e) => set('expected_misses', e.target.value)} placeholder="optioneel" />
          </div>
        </div>
        {sumMismatch && <div className="hint" style={{ color: 'var(--warn)' }}>Let op: Teens + Missen ({t + m}) is niet gelijk aan het totaal ({tot}). Het totaal blijft leidend.</div>}
        <div className="field">
          <label className="label" htmlFor="sh-dl">Deadline (Nederlandse tijd)</label>
          <input id="sh-dl" className="input" type="datetime-local" value={f.deadline_local} onChange={(e) => set('deadline_local', e.target.value)} />
        </div>
        <label className="check-row">
          <input type="checkbox" checked={f.allow_submissions_after_deadline} onChange={(e) => set('allow_submissions_after_deadline', e.target.checked)} />
          Inzenden na de deadline toestaan
        </label>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="modal-actions">
          {!isNew && <button type="button" className="btn btn-ghost btn-sm" style={{ marginRight: 'auto' }} onClick={regenerate}>Nieuwe link genereren</button>}
          <button type="button" className="btn btn-outline" onClick={onClose}>Annuleren</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button>
        </div>
      </form>
    </div>
  );
}
