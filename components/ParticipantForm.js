'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import PhotoCodeInput from './PhotoCodeInput';
import { BRAND, CATEGORY_LABELS, MAX_EXTRA_PHOTOS, PHOTO_PREFIX } from '@/lib/constants';
import { validateSubmission, hasErrors, formatEuro, formatEuroShort } from '@/lib/validation';
import { formatDateTime, TZ_CARIBBEAN } from '@/lib/time';

const EMPTY = { first_name: '', last_name: '', category: '', photo: '', extras: [] };

function newKey() {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

export default function ParticipantForm({ token, shoot, price }) {
  const storageKey = `hs-form-${token}`;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState('form'); // form | review | done
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [result, setResult] = useState(null);
  const [closed, setClosed] = useState(shoot.closed);
  const idemKey = useRef(null);
  const sendingRef = useRef(false);
  const topRef = useRef(null);

  // Ingevulde gegevens bewaren (bv. als de telefoon de pagina herlaadt na het bekijken van de galerij)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved === 'object') setForm({ ...EMPTY, ...saved, extras: Array.isArray(saved.extras) ? saved.extras : [] });
    } catch {}
  }, [storageKey]);
  useEffect(() => {
    if (step === 'done') return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(form)); } catch {}
  }, [form, step, storageKey]);

  const extraCount = form.extras.length;
  const extraTotal = Math.round(extraCount * price * 100) / 100;

  const payload = useMemo(() => ({
    first_name: form.first_name,
    last_name: form.last_name,
    category: form.category,
    province: shoot.province,
    photo_code: form.photo,
    extra_photo_codes: form.extras,
  }), [form, shoot.province]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field] || (field === 'photo' && errors.photo_code)) {
      setErrors((e) => { const n = { ...e }; delete n[field]; if (field === 'photo') delete n.photo_code; return n; });
    }
  }
  function setExtra(i, v) {
    setForm((f) => { const extras = [...f.extras]; extras[i] = v; return { ...f, extras }; });
    if (errors.extra?.[i]) setErrors((e) => { const extra = [...(e.extra || [])]; extra[i] = undefined; return { ...e, extra }; });
  }
  function addExtra() {
    if (form.extras.length >= MAX_EXTRA_PHOTOS) return;
    setForm((f) => ({ ...f, extras: [...f.extras, ''] }));
    setTimeout(() => document.getElementById(`extra-${form.extras.length}`)?.focus(), 30);
  }
  function removeExtra(i) {
    setForm((f) => ({ ...f, extras: f.extras.filter((_, j) => j !== i) }));
    setErrors((e) => { const n = { ...e }; delete n.extra; return n; });
  }

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toReview(e) {
    e.preventDefault();
    setServerError('');
    const { errors: errs } = validateSubmission(payload);
    setErrors(errs);
    if (hasErrors(errs)) {
      setTimeout(() => document.querySelector('[aria-invalid="true"], .has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20);
      return;
    }
    if (!idemKey.current) idemKey.current = newKey();
    setStep('review');
    scrollTop();
  }

  async function send(confirmDuplicate = false) {
    if (sendingRef.current) return; // voorkomt dubbele tik
    sendingRef.current = true;
    setSending(true);
    setServerError('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, token, idempotency_key: idemKey.current, confirm_duplicate: confirmDuplicate }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult(data);
        setStep('done');
        setDuplicate(null);
        try { sessionStorage.removeItem(storageKey); } catch {}
        scrollTop();
      } else if (res.status === 409 && data.duplicate) {
        setDuplicate(data);
      } else if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setStep('form');
        setServerError(data.error || 'Controleer de gemarkeerde velden.');
      } else if (res.status === 403 && data.closed) {
        setClosed(true);
      } else {
        setServerError(data.error || 'Verzenden is niet gelukt. Je gegevens zijn bewaard, probeer het opnieuw.');
      }
    } catch {
      setServerError('Verzenden is niet gelukt. Controleer je internetverbinding en probeer het opnieuw. Je gegevens zijn bewaard.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const header = (
    <header className="pub-header" ref={topRef}>
      <div className="eyebrow">{BRAND.name}</div>
      <h1>Kies je {shoot.photo_label}</h1>
      <div className="shoot">{shoot.name} · {shoot.province}</div>
    </header>
  );

  const deadlineBanner = shoot.deadline_at ? (
    <div className={`deadline-banner${shoot.deadline_passed ? ' passed' : ''}`}>
      {shoot.deadline_passed ? (
        <><strong>De deadline is verstreken</strong>Inzenden is nog even mogelijk. Geef je keuze zo snel mogelijk door.</>
      ) : (
        <>
          Uiterlijk doorgeven vóór
          <strong>{formatDateTime(shoot.deadline_at)}</strong>
          {shoot.province === 'Dutch Caribbean'
            ? <span className="small muted">Nederlandse tijd · lokale tijd: {formatDateTime(shoot.deadline_at, TZ_CARIBBEAN)}</span>
            : <span className="small muted">Nederlandse tijd</span>}
        </>
      )}
    </div>
  ) : null;

  if (closed) {
    return (
      <>
        {header}
        <main className="pub-wrap">
          <div className="card" style={{ textAlign: 'center' }}>
            <h2>De inzendtermijn is gesloten</h2>
            <p className="muted">
              Het is niet meer mogelijk om via dit formulier je keuze door te geven.
              Neem contact op met de organisatie als je nog een keuze wilt doorgeven.
            </p>
          </div>
        </main>
      </>
    );
  }

  if (step === 'done' && result) {
    const s = result.summary;
    return (
      <>
        {header}
        <main className="pub-wrap">
          <div className="card success">
            <div className="check" aria-hidden="true">✓</div>
            <h2>Bedankt! Je keuze is succesvol ontvangen.</h2>
            {result.changeRequest && (
              <p className="alert alert-warn" style={{ textAlign: 'left' }}>
                Er was al eerder een keuze voor je doorgegeven. Je nieuwe keuze is ontvangen en wordt door de organisatie gecontroleerd.
              </p>
            )}
            <p className="muted">Maak gerust een screenshot van dit overzicht.</p>
          </div>
          <div className="card summary">
            <h2>Jouw keuze</h2>
            <dl>
              <dt>Naam</dt><dd>{s.first_name} {s.last_name}</dd>
              <dt>Categorie</dt><dd>{s.category}</dd>
              <dt>Provincie/regio</dt><dd>{s.province}</dd>
              <dt>Shoot</dt><dd>{shoot.name}</dd>
              <dt>Hoofdkeuze</dt><dd className="code">{s.photo_code}</dd>
              <dt>Extra foto's</dt><dd>{s.extra_photo_count ? <span className="code">{s.extra_photo_codes.join(', ')}</span> : 'Geen'}</dd>
              {s.extra_photo_count > 0 && (<><dt>Extra bedrag</dt><dd>{formatEuro(s.extra_photo_total)}</dd></>)}
              <dt>Ontvangen op</dt><dd>{formatDateTime(s.submitted_at)}</dd>
            </dl>
            {s.extra_photo_count > 0 && (
              <p className="small muted" style={{ marginTop: 12 }}>
                Het bedrag voor de extra foto's wordt nu niet afgerekend. De organisatie laat je weten hoe je dit kunt voldoen.
              </p>
            )}
          </div>
        </main>
      </>
    );
  }

  if (step === 'review') {
    return (
      <>
        {header}
        <main className="pub-wrap">
          {deadlineBanner}
          <div className="card summary">
            <h2>Klopt alles?</h2>
            <p className="muted small">Controleer je gegevens en tik daarna op ‘Verzenden’.</p>
            <dl>
              <dt>Naam</dt><dd>{payload.first_name.trim()} {payload.last_name.trim()}</dd>
              <dt>Categorie</dt><dd>{payload.category}</dd>
              <dt>Provincie/regio</dt><dd>{shoot.province}</dd>
              <dt>Shoot</dt><dd>{shoot.name}</dd>
              <dt>Hoofdkeuze</dt><dd className="code">{PHOTO_PREFIX}{form.photo}</dd>
              <dt>Extra foto's</dt>
              <dd>{extraCount ? <span className="code">{form.extras.map((d) => PHOTO_PREFIX + d).join(', ')}</span> : 'Geen'}</dd>
            </dl>
            <div className="cost-box">
              1 hoofdkeuze (inbegrepen)
              {extraCount > 0 && <> · {extraCount} extra foto{extraCount === 1 ? '' : "'s"} × {formatEuro(price)}</>}
              <div className="total">{extraCount ? `${formatEuro(extraTotal)} extra` : 'Geen extra kosten'}</div>
              {extraCount > 0 && <div className="small muted">Je betaalt nu niets. De organisatie informeert je over de betaling van de extra foto's.</div>}
            </div>

            {duplicate && (
              <div className="alert alert-warn" role="alert">
                <strong>{duplicate.error}</strong>
                <p style={{ margin: '6px 0 10px' }}>
                  Heb je al eerder ingestuurd en wil je je keuze wijzigen? Dan sturen we je nieuwe keuze door naar de organisatie. Je eerdere keuze wordt niet automatisch overschreven; de organisatie controleert dit.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" disabled={sending} onClick={() => send(true)}>
                    {sending ? 'Bezig…' : 'Ja, nieuwe keuze doorsturen'}
                  </button>
                  <button type="button" className="btn btn-outline" disabled={sending} onClick={() => { setDuplicate(null); setStep('form'); }}>
                    Gegevens aanpassen
                  </button>
                </div>
              </div>
            )}
            {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}

            {!duplicate && (
              <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                <button type="button" className="btn btn-primary btn-block" disabled={sending} onClick={() => send(false)}>
                  {sending ? 'Bezig met verzenden…' : 'Verzenden'}
                </button>
                <button type="button" className="btn btn-outline btn-block" disabled={sending} onClick={() => { setStep('form'); setServerError(''); }}>
                  Terug en aanpassen
                </button>
              </div>
            )}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <main className="pub-wrap">
        {deadlineBanner}

        {shoot.gallery_url && (
          <div className="card gallery-card">
            <h2>1. Kies je favoriete foto</h2>
            <p className="muted">Zoek je favoriete foto in de galerij en vul hieronder het TLP-fotonummer in.</p>
            <a className="btn btn-accent btn-block" href={shoot.gallery_url} target="_blank" rel="noopener noreferrer">
              Bekijk de foto&apos;s in Shootstack ↗
            </a>
            <p className="small muted" style={{ margin: '10px 0 0' }}>De galerij opent in een nieuw tabblad. Je ingevulde gegevens blijven hier bewaard.</p>
          </div>
        )}

        <form className="card" onSubmit={toReview} noValidate>
          <h2>{shoot.gallery_url ? '2. ' : ''}Jouw gegevens</h2>
          <p className="small muted" style={{ marginTop: 0 }}>Velden met <span className="req">*</span> zijn verplicht.</p>

          <div className="field">
            <label className="label" htmlFor="first_name">Voornaam<span className="req">*</span></label>
            <input id="first_name" className={`input${errors.first_name ? ' has-error' : ''}`} autoComplete="given-name"
              value={form.first_name} aria-invalid={!!errors.first_name} onChange={(e) => set('first_name', e.target.value)} />
            {errors.first_name && <div className="error-text">{errors.first_name}</div>}
          </div>

          <div className="field">
            <label className="label" htmlFor="last_name">Achternaam<span className="req">*</span></label>
            <input id="last_name" className={`input${errors.last_name ? ' has-error' : ''}`} autoComplete="family-name"
              value={form.last_name} aria-invalid={!!errors.last_name} onChange={(e) => set('last_name', e.target.value)} />
            {errors.last_name && <div className="error-text">{errors.last_name}</div>}
          </div>

          <div className="field">
            <span className="label" id="cat-label">Categorie<span className="req">*</span></span>
            <div className={`seg${errors.category ? ' has-error' : ''}`} role="group" aria-labelledby="cat-label">
              {['Teen', 'Miss'].map((c) => (
                <button type="button" key={c} aria-pressed={form.category === c} onClick={() => set('category', c)}>
                  <strong>{c}</strong>
                  <span>{c === 'Teen' ? 'jonger dan 18 jaar' : '18 jaar en ouder'}</span>
                </button>
              ))}
            </div>
            {errors.category && <div className="error-text">{errors.category}</div>}
          </div>

          <div className="field">
            <span className="label">Provincie / regio<span className="req">*</span></span>
            <div className="input locked" aria-label={`Provincie: ${shoot.province}`}>
              <span>{shoot.province}</span><span className="lock">🔒 vastgezet via je link</span>
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="photo">Gekozen fotonummer (hoofdkeuze)<span className="req">*</span></label>
            <PhotoCodeInput id="photo" value={form.photo} onChange={(v) => set('photo', v)} error={errors.photo_code} />
          </div>

          <div className="field">
            <span className="label">Extra foto&apos;s <span className="muted small" style={{ fontWeight: 400 }}>(optioneel)</span></span>
            <div className="hint" style={{ marginTop: 0 }}>Wil je naast je hoofdkeuze nog meer foto&apos;s? Elke extra foto kost {formatEuro(price)}.</div>
            {form.extras.map((d, i) => (
              <div key={i}>
                <div className="extra-row">
                  <PhotoCodeInput id={`extra-${i}`} value={d} onChange={(v) => setExtra(i, v)} label={`Extra foto ${i + 1} (alleen cijfers)`}
                    error={errors.extra?.[i]} showPreview={false} />
                  <button type="button" className="icon-btn" aria-label={`Extra foto ${i + 1} verwijderen`} onClick={() => removeExtra(i)}>✕</button>
                </div>
              </div>
            ))}
            {errors.extra_general && <div className="error-text">{errors.extra_general}</div>}
            <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 10 }} onClick={addExtra}
              disabled={form.extras.length >= MAX_EXTRA_PHOTOS}>
              + Extra foto toevoegen (+ {formatEuroShort(price)})
            </button>
            <div className="cost-box" aria-live="polite">
              1 hoofdkeuze (inbegrepen)
              {extraCount > 0 && <> · {extraCount} extra foto{extraCount === 1 ? '' : "'s"} × {formatEuro(price)}</>}
              <div className="total">{extraCount ? `${formatEuro(extraTotal)} extra` : 'Geen extra kosten'}</div>
              {extraCount > 0 && <div className="small muted">Dit bedrag geldt alleen voor de extra foto&apos;s en wordt nu niet afgerekend.</div>}
            </div>
          </div>

          {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}

          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 22 }}>
            Controleren en verzenden
          </button>
        </form>

        <p className="privacy">
          Je gegevens worden alleen gebruikt voor de organisatie van de fotoselectie van {BRAND.name} en zijn niet openbaar zichtbaar.
          Wil je iets laten corrigeren of verwijderen? Neem contact op met de organisatie.
        </p>
      </main>
    </>
  );
}
