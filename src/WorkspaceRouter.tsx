import React, { lazy, Suspense, useEffect, useState } from 'react';
const Management = lazy(() => import('./management/App.js'));
const Workforce = lazy(() => import('./App.js').then(module => ({ default: module.App })));
import { ThemeSwitcher } from './components/ThemeSwitcher.js';
import './management/management.css';
import { AuthGate, SignOutButton } from './supabase/AuthGate.js';

export function WorkspaceRouter() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const update = () => {
      setHash(window.location.hash);
      setSearch(window.location.search);
    };
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
    };
  }, []);

  const searchParams = new URLSearchParams(search);
  const isDirectWorkerPortal =
    /portal|login-operario/.test(hash) ||
    hash.includes('w=') ||
    hash.includes('token=') ||
    searchParams.has('portal') ||
    searchParams.has('w') ||
    searchParams.has('workerId') ||
    searchParams.has('token');

  const workforce = isDirectWorkerPortal || /workforce/.test(hash);

  return (
    <>
      {!isDirectWorkerPortal && (
        <nav aria-label="Áreas de UniProyect" className="sticky top-0 z-50 border-b border-slate-700/80 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-2.5 shadow-sm">
          <div className="w-full max-w-full mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <a href="#" aria-current={!workforce ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${!workforce ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>Obras y costes</a>
              <a href="#workforce" aria-current={workforce ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${workforce ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>Trabajadores y fichajes</a>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span className="font-semibold text-slate-300">UniProyect</span>
              <span aria-hidden="true">·</span>
              <span>Control de Obras y Costes</span>
            </div>
            <SignOutButton />
          </div>
        </nav>
      )}
      <WorkspaceAccess direct={isDirectWorkerPortal}><Suspense fallback={<p role="status" className="p-6 text-white font-medium">Cargando UniProyect…</p>}>
        {workforce ? (
          <>
            <Workforce />
            <ThemeSwitcher />
          </>
        ) : (
          <div className="up-management">
            <Management />
          </div>
        )}
      </Suspense></WorkspaceAccess>
    </>
  );
}

function WorkspaceAccess({ direct, children }: { direct: boolean; children: React.ReactNode }) {
  return direct ? <>{children}</> : <AuthGate>{children}</AuthGate>;
}
