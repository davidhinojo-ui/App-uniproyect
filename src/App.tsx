import React, { useState, useEffect } from 'react';
import { Worker, Project, TimeRecord } from './types/index.js';
import { api } from './services/api.js';
import { WorkerManagement } from './components/supervisor/WorkerManagement.js';
import { TimeRecordsOverview } from './components/supervisor/TimeRecordsOverview.js';
import { ProjectLaborCosts } from './components/supervisor/ProjectLaborCosts.js';
import { SecurityAuditTab } from './components/supervisor/SecurityAuditTab.js';
import { WorkerPortal } from './components/portal/WorkerPortal.js';
import { ActivationView } from './components/auth/ActivationView.js';
import { WorkerLogin } from './components/auth/WorkerLogin.js';
import {
  Users,
  Clock,
  TrendingUp,
  ShieldCheck,
  Building,
  HardHat,
  ArrowRightLeft,
  Smartphone,
  QrCode,
  RefreshCw,
} from 'lucide-react';

type SupervisorTab = 'workers' | 'timerecords' | 'laborcosts' | 'security';

export const App: React.FC = () => {
  // Routing & View Mode
  const [routeToken, setRouteToken] = useState<string | null>(null);
  const [isLoginView, setIsLoginView] = useState(false);
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [supervisorTab, setSupervisorTab] = useState<SupervisorTab>('workers');

  // Application Data
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Check Hash / Query URL parameters for QR activation
  useEffect(() => {
    const parseUrl = () => {
      const hash = window.location.hash;
      const search = window.location.search;

      // Check for token in hash (#activar?token=...) or query (?token=...)
      let tokenFound: string | null = null;
      if (hash.includes('token=')) {
        const match = hash.match(/token=([A-Za-z0-9_-]+)/);
        if (match) tokenFound = match[1];
      } else if (search.includes('token=')) {
        const params = new URLSearchParams(search);
        tokenFound = params.get('token');
      }

      if (tokenFound) {
        setRouteToken(tokenFound);
        setIsLoginView(false);
      } else if (hash.includes('login-operario')) {
        setIsLoginView(true);
        setRouteToken(null);
      } else {
        setRouteToken(null);
        setIsLoginView(false);
      }
    };

    parseUrl();
    window.addEventListener('hashchange', parseUrl);
    return () => window.removeEventListener('hashchange', parseUrl);
  }, []);

  // Fetch initial supervisor data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [wList, pList, rList] = await Promise.all([
        api.getWorkers(),
        api.getAllProjects(),
        api.getAllTimeRecords(),
      ]);
      setWorkers(wList);
      setProjects(pList);
      setRecords(rList);

      // If activeWorker is loaded, keep it up to date
      if (activeWorker) {
        const fresh = wList.find((w) => w.id === activeWorker.id);
        if (fresh) setActiveWorker(fresh);
      }
    } catch (err: any) {
      console.error('Error al inicializar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handler for QR Activation completed
  const handleWorkerActivated = (worker: Worker) => {
    setActiveWorker(worker);
    setRouteToken(null);
    window.location.hash = '';
    fetchData();
  };

  // Handler for previewing worker from supervisor table
  const handleSelectWorkerForPreview = (worker: Worker) => {
    setActiveWorker(worker);
  };

  // Handler for logout
  const handleWorkerLogout = () => {
    setActiveWorker(null);
    setIsLoginView(false);
    window.location.hash = '';
    fetchData();
  };

  // 1. RENDER ACTIVATION VIEW (QR scan target)
  if (routeToken) {
    return (
      <ActivationView
        token={routeToken}
        onActivated={handleWorkerActivated}
        onCancel={() => {
          setRouteToken(null);
          window.location.hash = '';
        }}
      />
    );
  }

  // 2. RENDER WORKER LOGIN VIEW
  if (isLoginView && !activeWorker) {
    return (
      <WorkerLogin
        onSuccess={(worker) => {
          setActiveWorker(worker);
          setIsLoginView(false);
          window.location.hash = '';
        }}
        onBackToSupervisor={() => {
          setIsLoginView(false);
          window.location.hash = '';
        }}
        activeWorkers={workers}
      />
    );
  }

  // 3. RENDER WORKER PERSONAL PORTAL ("Mi espacio de trabajo")
  if (activeWorker) {
    return (
      <div>
        {/* Testing Banner to quickly jump back to supervisor */}
        <div className="bg-slate-900 border-b border-blue-500/30 px-4 py-2 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>
              Sesión activa como: <strong className="text-white">{activeWorker.fullName}</strong> ({activeWorker.category})
            </span>
          </div>
          <button
            onClick={() => setActiveWorker(null)}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg font-medium transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> Volver a Supervisor
          </button>
        </div>

        <WorkerPortal
          worker={activeWorker}
          projects={projects}
          onLogout={handleWorkerLogout}
        />
      </div>
    );
  }

  // 4. RENDER SUPERVISOR PANEL
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Corporate Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-blue-400">
                  UniProyect
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  José Real Construcciones, S.L.
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
                Panel de Supervisión y Control Horario
              </h1>
            </div>
          </div>

          {/* Quick Access Switchers */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLoginView(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Abrir pantalla de acceso de trabajadores"
            >
              <Smartphone className="w-4 h-4 text-blue-400" />
              <span>Portal Trabajador</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-4 flex gap-1 border-t border-slate-800 pt-2 overflow-x-auto">
          <button
            onClick={() => setSupervisorTab('workers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              supervisorTab === 'workers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Trabajadores y Accesos QR</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-900/60">
              {workers.length}
            </span>
          </button>

          <button
            onClick={() => setSupervisorTab('timerecords')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              supervisorTab === 'timerecords'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Fichajes en Vivo</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-900/60">
              {records.length}
            </span>
          </button>

          <button
            onClick={() => setSupervisorTab('laborcosts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              supervisorTab === 'laborcosts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Mano de Obra y Costes</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-900/60">
              {projects.length} obras
            </span>
          </button>

          <button
            onClick={() => setSupervisorTab('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              supervisorTab === 'security'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Auditoría Zero-Trust</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400">
              OK
            </span>
          </button>
        </div>
      </header>

      {/* Main Supervisor Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8">
        {supervisorTab === 'workers' && (
          <WorkerManagement
            workers={workers}
            projects={projects}
            onRefresh={fetchData}
            onSelectWorkerForPreview={handleSelectWorkerForPreview}
          />
        )}

        {supervisorTab === 'timerecords' && (
          <TimeRecordsOverview
            records={records}
            projects={projects}
            workers={workers}
            onRefresh={fetchData}
          />
        )}

        {supervisorTab === 'laborcosts' && (
          <ProjectLaborCosts projects={projects} records={records} />
        )}

        {supervisorTab === 'security' && <SecurityAuditTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          UniProyect © 2026 José Real Construcciones, S.L. — Aislamiento estricto multi-inquilino y registro horario RGPD compliant.
        </p>
      </footer>
    </div>
  );
};
