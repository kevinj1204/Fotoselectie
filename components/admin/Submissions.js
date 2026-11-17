'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import PhotoCodeInput from '../PhotoCodeInput';
import { PROVINCES, PHOTO_PREFIX } from '@/lib/constants';
import { formatEuro, digitsOnly } from '@/lib/validation';
import { formatShort, formatDateTime } from '@/lib/time';

const DEFAULT_FILTER = { shoot_id: '', province: '', category: '', status: '', q: '', sort: 'last_name', dir: 'asc' };

function toQuery(f) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v && !k.startsWith('_')) p.set(k, v); });
  return p.toString();
}

export default function Submissions({ data, reload, toast, initialFilter }) {
  const [filter, setFilter] = useState({ ...DEFAULT_FILTER, ...(initialFilter || {}) });
  const [q, setQ] = useState(initialFilter?.q || '');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('grouped');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (initialFilter) { setFilter({ ...DEFAULT_FILTER, ...initialFilter }); setQ(initialFilter.q || ''); }
  }, [initialFilter]);

  // Zoeken met kleine vertraging
  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => (f.q === q ? f : { ...f, q })), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    try {
      const res = await api(`/api/admin/submissions?${toQuery(filter)}`);
      setList(res.submissions);
      setError('');
    } catch (e) { setError(e.message); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setFilter((f) => ({ ...f, [k]: v }));
  const shootsForSelect = data.shoots.filter((s) => !filter.province || s.province === filter.province);
  const filtersActive = filter.shoot_id || filter.category || filter.status || filter.q;
  const provincesToShow = filter.province ? [filter.province]
    : filter.shoot_id ? [data.shoots.find((s) => s.id === filter.shoot_id)?.province].filter(Boolean)
    : PROVINCES;

  const totals = useMemo(() => {
    if (!list) return null;
    return {
      n: list.length,
      extra: list.reduce((a, s) => a + s.extra_photo_count, 0),
      amount: list.reduce((a, s) => a + Number(s.extra_photo_total), 0),
    };
  }, [list]);

  async function afterChange(msg) {
    setOpenId(null);
    await Promise.all([load(), reload()]);
    if (msg) toast(msg);
  }

  const exportHref = (format) => `/api/admin/export?${toQuery({ ...filter, format, type: 'submissions' })}`;

  return (
    <>
      <div className="toolbar">
        <input className="input" type="search" placeholder="Zoek op naam of fotonummer (bv. TLP024)" value={q} onChange={(e) => setQ(e.target.value)} style={{ flexBasis: 300 }} aria-label="Zoeken" />
        <select className="select input" value={filter.province} onChange={(e) => setFilter((f) => ({ ...f, province: e.target.value, shoot_id: '' }))} aria-label="Provincie">
          <option value="">Alle provincies/regio&apos;s</option>
          {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="select input" value={filter.shoot_id} onChange={(e) => set('shoot_id', e.target.value)} aria-label="Shoot">
          <option value="">Alle shoots</option>
          {shootsForSelect.map((s) => <option key={s.id} value={s.id}>{s.province} – {s.name}{s.archived_at ? ' (archief)' : ''}</option>)}
        </select>
        <select className="select input" value={filter.category} onChange={(e) => set('category', e.target.value)} aria-label="Categorie">
          <option value="">Teens + Missen</option>
          <option value="Teen">Alleen Teens</option>
          <option value="Miss">Alleen Missen</option>
        </select>
        <select className="select input" value={filter.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          <option value="">Alle statussen</option>
          <option value="review">Te beoordelen (mogelijk dubbel)</option>
        </select>
        <select className="select input" value={`${filter.sort}:${filter.dir}`} onChange={(e) => { const [sort, dir] = e.target.value.split(':'); setFilter((f) => ({ ...f, sort, dir })); }} aria-label="Sorteren">
          <option value="last_name:asc">Sorteer: achternaam A–Z</option>
          <option value="last_name:desc">Sorteer: achternaam Z–A</option>
          <option value="submitted_at:desc">Sorteer: nieuwste eerst</option>
          <option value="submitted_at:asc">Sorteer: oudste eerst</option>
        </select>
      </div>

      <div className="section-title" style={{ marginTop: 14 }}>
        <div className="small muted">
          {totals ? <>{totals.n} inzending{totals.n === 1 ? '' : 'en'} · {totals.extra} extra foto&apos;s · {formatEuro(totals.amount)}</> : 'Laden…'}
          {(filtersActive || filter.province) && <button className="btn btn-sm btn-ghost" onClick={() => { setFilter(DEFAULT_FILTER); setQ(''); }}>Filters wissen</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${view === 'grouped' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('grouped')}>Per provincie</button>
          <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('list')}>Lijst</button>
          <a className="btn btn-sm btn-outline" href={exportHref('xlsx')}>Export Excel</a>
          <a className="btn btn-sm btn-outline" href={exportHref('csv')}>Export CSV</a>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {list && view === 'list' && <Table rows={list} onOpen={setOpenId} showProvince />}

      {list && view === 'grouped' && provincesToShow.map((p) => {
        const rows = list.filter((s) => s.province === p);
        if (!rows.length && filtersActive) return null;
        const teens = rows.filter((s) => s.category === 'Teen');
        const misses = rows.filter((s) => s.category === 'Miss');
        return (
          <details className="group" key={p} open>
            <summary><h3>{p}</h3><span className="badge">{rows.length}</span></summary>
            {!rows.length && <div className="empty">Nog geen inzendingen</div>}
            {rows.length > 0 && (
              <>
                {filter.category !== 'Miss' && (
                  <>
                    <div className="subgroup-title">Teens (onder 18 jaar) <span className="badge">{teens.length}</span></div>
                    {teens.length ? <Table rows={teens} onOpen={setOpenId} /> : <div className="empty small">Nog geen Teens</div>}
                  </>
                )}
                {filter.category !== 'Teen' && (
                  <>
                    <div className="subgroup-title">Missen (18 jaar en ouder) <span className="badge">{misses.length}</span></div>
                    {misses.length ? <Table rows={misses} onOpen={setOpenId} /> : <div className="empty small">Nog geen Missen</div>}
                  </>
                )}
              </>
            )}
          </details>
        );
      })}

      {openId && <SubmissionModal id={openId} shoots={data.shoots} onClose={() => setOpenId(null)} onChanged={afterChange} />}
    </>
  );
}

function Table({ rows, onOpen, showProvince }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Voornaam</th><th>Achternaam</th><th>Categorie</th>
            {showProvince && <th>Provincie</th>}
            <th>Shoot</th><th>Gekozen foto</th><th>Extra foto&apos;s</th><th>Extra €</th><th>Ontvangen</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="clickable" onClick={() => onOpen(s.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(s.id)}>
              <td>{s.first_name}</td>
              <td>{s.last_name}</td>
              <td>{s.category}</td>
              {showProvince && <td>{s.province}</td>}
              <td className="small">{s.shoot_name}</td>
              <td className="code">{s.photo_code || <span className="badge dark" style={{ fontWeight: 600 }}>alleen betaald</span>}</td>
              <td className="code small">{s.extra_photo_codes.length ? s.extra_photo_codes.join(', ') : <span className="muted">–</span>}</td>
              <td>{s.extra_photo_count ? formatEuro(s.extra_photo_total) : <span className="muted">–</span>}</td>
              <td className="small">{formatShort(s.submitted_at)}</td>
              <td>{s.review_status === 'possible_duplicate' && <span className="badge warn">Te beoordelen</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubmissionModal({ id, shoots, onClose, onChanged }) {
  const [s, setS] = useState(null);
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [dupWarn, setDupWarn] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/api/admin/submissions/${id}`).then((d) => {
      setS(d);
      setF({
        shoot_id: d.shoot_id, participant_number: d.participant_number || '', first_name: d.first_name, last_name: d.last_name,
        category: d.category, photo: digitsOnly(d.photo_code), extras: d.extra_photo_codes.map(digitsOnly), admin_note: d.admin_note || '',
      });
    }).catch((e) => setErr(e.message));
  }, [id]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function save(confirm = false) {
    setBusy(true); setErr(''); setFieldErr({});
    try {
      await api(`/api/admin/submissions/${id}`, {
        method: 'PATCH',
        body: {
          shoot_id: f.shoot_id, participant_number: f.participant_number, first_name: f.first_name, last_name: f.last_name,
          category: f.category, photo_code: f.photo, extra_photo_codes: f.extras, admin_note: f.admin_note, confirm_duplicate: confirm,
        },
      });
      onChanged('Inzending opgeslagen');
    } catch (e) {
      if (e.status === 409) setDupWarn(e.message);
      else { setErr(e.message); setFieldErr(e.data?.errors || {}); }
    } finally { setBusy(false); }
  }

  async function del() {
    if (!window.confirm(`Inzending van ${s.first_name} ${s.last_name} (${s.photo_code || s.extra_photo_codes.join(', ')}) definitief verwijderen?`)) return;
    try { await api(`/api/admin/submissions/${id}`, { method: 'DELETE' }); onChanged('Inzending verwijderd'); } catch (e) { setErr(e.message); }
  }

  async function resolve(action) {
    const texts = {
      replace_original: 'De oorspronkelijke inzending wordt verwijderd en deze nieuwe inzending blijft staan. Doorgaan?',
      keep_both: 'Beide inzendingen blijven bestaan (bijv. twee verschillende deelnemers). Doorgaan?',
      discard_new: 'Deze nieuwe inzending wordt verwijderd; de oorspronkelijke blijft staan. Doorgaan?',
    };
    if (!window.confirm(texts[action])) return;
    try { await api(`/api/admin/submissions/${id}/resolve`, { method: 'POST', body: { action } }); onChanged('Beoordeling opgeslagen'); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {!s && !err && <p>Laden…</p>}
        {err && !s && <div className="alert alert-error">{err}</div>}
        {s && !edit && (
          <>
            <h2>{s.first_name} {s.last_name}</h2>
            {s.review_status === 'possible_duplicate' && (
              <div className="alert alert-warn">
                <strong>Mogelijk dubbele inzending</strong> – {s.duplicate_reason}.
                {s.original ? (
                  <div className="small" style={{ marginTop: 6 }}>
                    Eerdere inzending: {s.original.first_name} {s.original.last_name}, {s.original.category},
                    foto <span className="code">{s.original.photo_code || '–'}</span>
                    {s.original.extra_photo_codes.length > 0 && <> + {s.original.extra_photo_codes.join(', ')}</>}, ontvangen {formatShort(s.original.submitted_at)}
                  </div>
                ) : <div className="small" style={{ marginTop: 6 }}>De eerdere inzending bestaat niet meer.</div>}
                <div className="row-actions">
                  {s.original && <button className="btn btn-sm btn-primary" onClick={() => resolve('replace_original')}>Nieuwe keuze gebruiken (oude verwijderen)</button>}
                  <button className="btn btn-sm btn-outline" onClick={() => resolve('discard_new')}>Oude keuze houden</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => resolve('keep_both')}>Geen dubbel – beide houden</button>
                </div>
              </div>
            )}
            <div className="summary">
              <dl>
                {s.participant_number && <><dt>Deelnemernummer</dt><dd>{s.participant_number}</dd></>}
                <dt>Categorie</dt><dd>{s.category}</dd>
                <dt>Provincie/regio</dt><dd>{s.province}</dd>
                <dt>Shoot</dt><dd>{s.shoot_name}</dd>
                <dt>Hoofdkeuze</dt><dd className="code">{s.photo_code || 'Geen (alleen betaalde foto\'s)'}</dd>
                <dt>{s.photo_code ? "Extra foto's" : "Betaalde foto's"}</dt><dd className="code">{s.extra_photo_codes.length ? s.extra_photo_codes.join(', ') : '–'}</dd>
                <dt>Aantal extra</dt><dd>{s.extra_photo_count} × {formatEuro(s.extra_photo_price_each)} = {formatEuro(s.extra_photo_total)}</dd>
                <dt>Ontvangen</dt><dd>{formatDateTime(s.submitted_at)}</dd>
                {s.updated_at && <><dt>Laatst gewijzigd</dt><dd>{formatDateTime(s.updated_at)}</dd></>}
                {s.admin_note && <><dt>Notitie</dt><dd style={{ fontWeight: 400 }}>{s.admin_note}</dd></>}
              </dl>
            </div>
            {err && <div className="alert alert-error">{err}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" style={{ marginRight: 'auto', color: 'var(--err)' }} onClick={del}>Verwijderen</button>
              <button className="btn btn-outline" onClick={onClose}>Sluiten</button>
              <button className="btn btn-primary" onClick={() => setEdit(true)}>Aanpassen</button>
            </div>
          </>
        )}
        {s && edit && f && (
          <form onSubmit={(e) => { e.preventDefault(); save(false); }}>
            <h2>Inzending aanpassen</h2>
            <div className="field">
              <label className="label" htmlFor="e-shoot">Shoot</label>
              <select id="e-shoot" className="select input" value={f.shoot_id} onChange={(e) => set('shoot_id', e.target.value)}>
                {shoots.map((sh) => <option key={sh.id} value={sh.id}>{sh.province} – {sh.name}{sh.archived_at ? ' (archief)' : ''}</option>)}
              </select>
            </div>
            <div className="grid2">
              <div className="field">
                <label className="label" htmlFor="e-nr">Deelnemernummer <span className="muted small" style={{ fontWeight: 400 }}>(optioneel, alleen beheer)</span></label>
                <input id="e-nr" className={`input${fieldErr.participant_number ? ' has-error' : ''}`} value={f.participant_number} onChange={(e) => set('participant_number', e.target.value)} />
                {fieldErr.participant_number && <div className="error-text">{fieldErr.participant_number}</div>}
              </div>
              <div className="field">
                <label className="label" htmlFor="e-cat">Categorie</label>
                <select id="e-cat" className="select input" value={f.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="Teen">Teen</option><option value="Miss">Miss</option>
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="e-fn">Voornaam</label>
                <input id="e-fn" className={`input${fieldErr.first_name ? ' has-error' : ''}`} value={f.first_name} onChange={(e) => set('first_name', e.target.value)} />
              </div>
              <div className="field">
                <label className="label" htmlFor="e-ln">Achternaam</label>
                <input id="e-ln" className={`input${fieldErr.last_name ? ' has-error' : ''}`} value={f.last_name} onChange={(e) => set('last_name', e.target.value)} />
              </div>
            </div>
            {!shoots.find((sh) => sh.id === f.shoot_id)?.paid_only && (
              <div className="field">
                <span className="label">Hoofdkeuze</span>
                <PhotoCodeInput id="e-photo" value={f.photo} onChange={(v) => set('photo', v)} error={fieldErr.photo_code} />
              </div>
            )}
            <div className="field">
              <span className="label">{shoots.find((sh) => sh.id === f.shoot_id)?.paid_only ? "Betaalde foto's" : "Extra foto's"}</span>
              {fieldErr.extra_general && <div className="error-text">{fieldErr.extra_general}</div>}
              {f.extras.map((d, i) => (
                <div className="extra-row" key={i}>
                  <PhotoCodeInput id={`e-extra-${i}`} value={d} showPreview={false} error={fieldErr.extra?.[i]}
                    onChange={(v) => setF((x) => { const extras = [...x.extras]; extras[i] = v; return { ...x, extras }; })} />
                  <button type="button" className="icon-btn" aria-label="Verwijderen" onClick={() => setF((x) => ({ ...x, extras: x.extras.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 8 }} onClick={() => setF((x) => ({ ...x, extras: [...x.extras, ''] }))}>+ Extra foto</button>
              <div className="hint">{f.extras.length} × {formatEuro(s.extra_photo_price_each)} = {formatEuro(f.extras.length * s.extra_photo_price_each)} (tarief op moment van inzending)</div>
            </div>
            <div className="field">
              <label className="label" htmlFor="e-note">Notitie (alleen zichtbaar voor beheer)</label>
              <textarea id="e-note" className="input" rows={2} value={f.admin_note} onChange={(e) => set('admin_note', e.target.value)} />
            </div>
            {dupWarn && (
              <div className="alert alert-warn">{dupWarn}
                <div className="row-actions"><button type="button" className="btn btn-sm btn-primary" onClick={() => save(true)}>Toch opslaan</button></div>
              </div>
            )}
            {err && <div className="alert alert-error">{err}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => { setEdit(false); setDupWarn(null); }}>Annuleren</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Opslaan…' : 'Opslaan'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
