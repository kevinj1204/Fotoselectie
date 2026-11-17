'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import Overview from './Overview';
import Shoots from './Shoots';
import Submissions from './Submissions';
import Settings from './Settings';
import { BRAND } from '@/lib/constants';

const TABS = [
  ['overview', 'Overzicht'],
  ['shoots', 'Shoots & links'],
  ['submissions', 'Inzendingen'],
  ['settings', 'Instellingen & export'],
];

export default function Dashboard() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [subFilter, setSubFilter] = useState(null);

  const reload = useCallback(async () => {
    try {
      setData(await api('/api/admin/overview'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  function openSubmissions(filter) {
    setSubFilter({ ...filter, _t: Date.now() });
    setTab('submissions');
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="adm">
      <div className="adm-top">
        <div>
          <div className="eyebrow">{BRAND.name}</div>
          <h1>Headshot-keuze · Beheer</h1>
        </div>
        <button className="btn btn-sm btn-outline" onClick={logout}>Uitloggen</button>
      </div>
      <nav className="adm-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
            {k === 'submissions' && data?.totals?.to_review > 0 && <span className="badge warn" style={{ marginLeft: 6 }}>{data.totals.to_review}</span>}
          </button>
        ))}
      </nav>
      <main className="adm-main">
        {error && <div className="alert alert-error">{error}</div>}
        {!data && !error && <p className="muted">Laden…</p>}
        {data && tab === 'overview' && <Overview data={data} onOpen={openSubmissions} onGoShoots={() => setTab('shoots')} />}
        {data && tab === 'shoots' && <Shoots data={data} reload={reload} toast={setToast} onOpen={openSubmissions} />}
        {data && tab === 'submissions' && <Submissions data={data} reload={reload} toast={setToast} initialFilter={subFilter} />}
        {data && tab === 'settings' && <Settings data={data} reload={reload} toast={setToast} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
