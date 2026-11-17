'use client';
import { PROVINCES } from '@/lib/constants';
import { formatEuro } from '@/lib/validation';
import { ShootProgress } from './Progress';

export default function Overview({ data, onOpen, onGoShoots }) {
  const { totals, shoots } = data;
  const active = shoots.filter((s) => !s.archived_at);

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="k">Totaal inzendingen</div><div className="v">{totals.total}</div></div>
        <div className="stat"><div className="k">Teens</div><div className="v">{totals.teens}</div></div>
        <div className="stat"><div className="k">Missen</div><div className="v">{totals.misses}</div></div>
        <div className="stat"><div className="k">Betaalde foto&apos;s</div><div className="v">{totals.extra_count}</div></div>
        <div className="stat"><div className="k">Totaal betaalde foto&apos;s</div><div className="v">{formatEuro(totals.extra_total)}</div></div>
        <div className="stat"><div className="k">Te beoordelen</div><div className="v" style={{ color: totals.to_review ? 'var(--warn)' : undefined }}>{totals.to_review}</div></div>
      </div>

      {totals.to_review > 0 && (
        <div className="alert alert-warn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Er {totals.to_review === 1 ? 'is 1 mogelijk dubbele inzending' : `zijn ${totals.to_review} mogelijk dubbele inzendingen`} die je moet beoordelen.</span>
          <button className="btn btn-sm btn-primary" onClick={() => onOpen({ status: 'review' })}>Bekijken</button>
        </div>
      )}

      <div className="section-title">
        <h2>Voortgang per provincie/regio</h2>
        <button className="btn btn-sm btn-outline" onClick={onGoShoots}>Shoots beheren</button>
      </div>

      <div className="prov-grid">
        {PROVINCES.map((p) => {
          const list = active.filter((s) => s.province === p);
          return (
            <div className="prov" key={p}>
              <h3>{p} <span className="count">{totals.per_province[p] || 0} inzending{(totals.per_province[p] || 0) === 1 ? '' : 'en'}</span></h3>
              {list.length === 0 && <div className="empty">Nog geen actieve shoot ingesteld.</div>}
              {list.map((s) => (
                <div className="shoot-prog" key={s.id} style={{ marginTop: 12 }}>
                  <div className="name">
                    <span>{s.name}</span>
                    <button className="btn btn-sm btn-ghost" style={{ minHeight: 28, padding: '2px 8px' }} onClick={() => onOpen({ shoot_id: s.id })}>Bekijk →</button>
                  </div>
                  <ShootProgress s={s} compact />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>
        De teller telt iedere deelnemer (voor- + achternaam) één keer per shoot. Het is een voortgangscontrole: controleer zelf of de juiste personen hebben ingestuurd.
      </p>
    </>
  );
}
