import React, { lazy, Suspense, useEffect, useState } from 'react';
const Management = lazy(() => import('./management/App.js'));
const Workforce = lazy(() => import('./App.js').then(module => ({ default: module.App })));
import { ThemeSwitcher } from './components/ThemeSwitcher.js';
import './management/management.css';

export function WorkspaceRouter() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const workforce = /workforce|login-operario|token=/.test(hash) || new URLSearchParams(window.location.search).has('token');
  return <>
    <nav aria-label="Áreas de UniProyect" className="sticky top-0 z-50 flex flex-wrap gap-2 border-b border-slate-700 bg-slate-900 px-4 py-2">
      <a href="#" aria-current={!workforce ? 'page' : undefined} className="rounded-xl px-4 py-2 text-sm font-bold bg-blue-600">Obras y costes</a>
      <a href="#workforce" aria-current={workforce ? 'page' : undefined} className="rounded-xl px-4 py-2 text-sm font-bold bg-slate-800 text-white">Trabajadores y fichajes</a>
    </nav>
    <Suspense fallback={<p role="status" className="p-6">Cargando UniProyect…</p>}>
      {workforce ? <><Workforce /><ThemeSwitcher /></> : <div className="up-management"><Management /></div>}
    </Suspense>
  </>;
}
