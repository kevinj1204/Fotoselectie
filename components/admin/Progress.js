'use client';
import { formatShort } from '@/lib/time';

export function StatusBadge({ status }) {
  return <span className={`badge ${status.key}`}>{status.label}</span>;
}

export function ShootProgress({ s, compact = false }) {
  const pct = s.percent === null ? 0 : Math.min(100, s.percent);
  return (
    <div>
      {s.expected_participants ? (
        <>
          <div className={`bar ${s.status.key}`}><span style={{ width: `${pct}%` }} /></div>
          <div className="prog-line">
            <span><strong>Ontvangen: {s.received} van {s.expected_participants}</strong></span>
            <span>Nog te ontvangen: {s.remaining}</span>
            <span>{s.percent}%</span>
          </div>
        </>
      ) : (
        <div className="prog-line" style={{ marginTop: 6 }}><span><strong>Ontvangen: {s.received}</strong></span><span className="muted">geen verwacht aantal ingesteld</span></div>
      )}
      {(s.expected_teens !== null || s.expected_misses !== null) && (
        <div className="prog-line small" style={{ marginTop: 4 }}>
          {s.expected_teens !== null && <span>Teens: {s.received_teens} / {s.expected_teens}</span>}
          {s.expected_misses !== null && <span>Missen: {s.received_misses} / {s.expected_misses}</span>}
        </div>
      )}
      <div className="row-actions" style={{ marginTop: 8, alignItems: 'center' }}>
        <StatusBadge status={s.status} />
        {s.deadline_at ? (
          s.deadline_passed
            ? <span className="badge err">Deadline verstreken · {formatShort(s.deadline_at)}</span>
            : <span className="badge">Deadline {formatShort(s.deadline_at)}</span>
        ) : <span className="badge warn">Geen deadline</span>}
        {s.deadline_passed && <span className="badge">{s.allow_submissions_after_deadline ? 'Inzenden nog toegestaan' : 'Inzenden gesloten'}</span>}
        {!compact && !s.gallery_ok && <span className="badge warn">Galerijlink ontbreekt</span>}
        {s.paid_only && <span className="badge dark">Alleen betaalde foto&apos;s</span>}
        {s.to_review > 0 && <span className="badge warn">{s.to_review} te beoordelen</span>}
        {s.archived_at && <span className="badge dark">Gearchiveerd</span>}
      </div>
    </div>
  );
}
