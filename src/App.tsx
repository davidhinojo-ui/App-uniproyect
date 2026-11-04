import React, { useState, useEffect } from 'react';
import { Worker, Project, TimeRecord, WorkerInvitation } from './types/index.js';
import { api } from './services/api.js';
import { WorkerManagement } from './components/supervisor/WorkerManagement.js';
import { TimeRecordsOverview } from './components/supervisor/TimeRecordsOverview.js';
import { ProjectLaborCosts } from './components/supervisor/ProjectLaborCosts.js';
import { SecurityAuditTab } from './components/supervisor/SecurityAuditTab.js';
import { QuickGuidedActions } from './components/supervisor/QuickGuidedActions.js';
import { AssistedClockModal } from './components/supervisor/AssistedClockModal.js';
import { QrInvitationModal } from './components/supervisor/QrInvitationModal.js';
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
  Compass,
  LayoutGrid,
  CheckCircle2,
} from 'lucide-react';

type SupervisorTab = 'workers' | 'timerecords' | 'laborcosts' | 'security';
type ViewExperience = 'guided' | 'complete';

const VIEW_STORAGE_KEY = 'uniproyect:view_mode';

export const App: React.FC = () => {
  // Routing & View Mode
  const [routeToken, setRouteToken] = useState<string | null>(null);
  const [isLoginView, setIsLoginView] = useState(false);
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [supervisorTab, setSupervisorTab] = useState<SupervisorTab>('workers');


  // Modals for Guided actions
  const [isAssistedClockOpen, setIsAssistedClockOpen] = useState(false);
  const [activeQrInvitation, setActiveQrInvitation] = useState<WorkerInvitation | null>(null);

  // Application Data
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingWorkerId, setPendingWorkerId] = useState<string | null>(null);
  const [revokedWorkerNotice, setRevokedWorkerNotice] = useState<string | null>(null);

  // Check Hash / Query URL parameters for direct worker portal or QR scan
  useEffect(() => {
    const parseUrl = () => {
      const hash = window.location.hash;
      const search = window.location.search;

      let workerIdFound: string | null = null;
      if (hash.includes('w=')) {
        const match = hash.match(/w=([^&]+)/);
        if (match) workerIdFound = decodeURIComponent(match[1]);
      } else if (search.includes('w=')) {
        const params = new URLSearchParams(search);
        workerIdFound = params.get('w');
      }

      if (!workerIdFound) {
        if (hash.includes('workerId=')) {
          const match = hash.match(/workerId=([^&]+)/);
          if (match) workerIdFound = decodeURIComponent(match[1]);
        } else if (search.includes('workerId=')) {
          const params = new URLSearchParams(search);
          workerIdFound = params.get('workerId');
        }
      }

      if (workerIdFound) {
        setPendingWorkerId(workerIdFound);
        setRouteToken(null);
        setIsLoginView(false);
      } else if (hash.includes('portal') && !activeWorker) {
        const savedWorkerId = localStorage.getItem('uniproyect_worker_id');
        if (savedWorkerId) setPendingWorkerId(savedWorkerId);
      } else if (hash.includes('token=') || search.includes('token=')) {
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
        }
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
  }, [activeWorker]);

  // Fetch initial supervisor data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [wList, pList, rList] = await Promise.all([
        api.getWorkers(),
        api.getAllProjects(),
        api.getAllTimeRecords(),
      ]);

      // Strictly registered obras only: include works registered in UniProyect
      let registeredProjects = [...pList];
      try {
        const savedObras = localStorage.getItem('up_obras');
        if (savedObras) {
          const parsed = JSON.parse(savedObras);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const existingIds = new Set(registeredProjects.map((p) => p.id));
            for (const o of parsed) {
              if (o && o.id && o.name && !existingIds.has(o.id)) {
                registeredProjects.push({
                  id: o.id,
                  organizationId: 'org-jose-real',
                  code: o.id.startsWith('obra-') ? o.id.toUpperCase() : `OBRA-${o.id}`,
                  name: o.name,
                  address: o.location || '',
                  client: o.description || '',
                  status: o.status === 'on_hold' ? 'paused' : (o.status || 'active'),
                  supervisorName: 'David Hinojo (Supervisor General)',
                  budget: Number(o.budget) || 0,
                  laborCostTotal: 0,
                  createdAt: o.startDate || new Date().toISOString(),
                });
              }
            }
          }
        }
      } catch (_) {}

      setWorkers(wList);
      setProjects(registeredProjects);
      setRecords(rList);

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

  // Quick QR generation helper for guided view
  const handleQuickGenerateQr = async () => {
    const candidate = workers.find((w) => w.status === 'pending') || workers[0];
    if (!candidate) return;
    try {
      const inv = await api.createInvitation(candidate.id);
      setActiveQrInvitation(inv);
      fetchData();
    } catch (err: any) {
      alert('Error al generar código QR: ' + err.message);
    }
  };

  // Auto-connect worker from QR code or direct link
  useEffect(() => {
    if (pendingWorkerId && workers.length > 0) {
      const match = workers.find((w) => w.id === pendingWorkerId);
      if (match) {
        if (match.status === 'revoked') {
          setRevokedWorkerNotice(match.fullName);
          setActiveWorker(null);
        } else {
          setActiveWorker(match);
          setRevokedWorkerNotice(null);
          try {
            localStorage.setItem('uniproyect_worker_id', match.id);
          } catch (_) {}
        }
      }
    }
  }, [pendingWorkerId, workers]);

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
    setPendingWorkerId(null);
    setIsLoginView(false);
    try {
      localStorage.removeItem('uniproyect_worker_id');
    } catch (_) {}
    window.location.hash = '';
    fetchData();
  };

  // 0. RENDER REVOCATION NOTICE (If designated worker's portal was deleted/revoked)
  if (revokedWorkerNotice) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-6 text-center shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Portal Desactivado</h2>
          <p className="text-sm text-slate-300">
            El acceso al portal de trabajo para <strong className="text-rose-300">{revokedWorkerNotice}</strong> ha sido revocado o eliminado por el Gerente de Obra.
          </p>
          <p className="text-xs text-slate-500">
            Si se trata de un error o requiere reactivación, contacte con administración o la dirección de obra de José Real Construcciones, S.L.
          </p>
          <button
            onClick={() => {
              setRevokedWorkerNotice(null);
              setPendingWorkerId(null);
              try {
                localStorage.removeItem('uniproyect_worker_id');
              } catch (_) {}
              window.location.hash = '';
            }}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-xs transition-colors cursor-pointer"
          >
            Volver a Selección / Panel
          </button>
        </div>
      </div>
    );
  }

  // 1. RENDER ACTIVATION VIEW (QR scan target without direct worker ID)
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
        <div className="up-workspace mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl up-brand bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider text-blue-400">
                  UniProyect
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Control de Obras
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
                Control de Obra y Registro de Jornadas
              </h1>
            </div>
          </div>

          {/* Quick Controls: Fast Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => setIsLoginView(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Abrir pantalla de acceso de trabajadores"
            >
              <Smartphone className="w-4 h-4 text-blue-400" />
              <span>Portal Operario</span>
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

        {/* Navigation Tabs - Highlighted in Complete View or accessible in Guided View */}
        <div className="up-workspace mx-auto mt-4 flex gap-1 border-t border-slate-800 pt-2 overflow-x-auto">
          <button
            aria-pressed={supervisorTab === 'workers'}
            onClick={() => setSupervisorTab('workers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              supervisorTab === 'workers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Trabajadores y Accesos QR</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full up-nav-count">
              {workers.length}
            </span>
          </button>

          <button
            aria-pressed={supervisorTab === 'timerecords'}
            onClick={() => setSupervisorTab('timerecords')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              supervisorTab === 'timerecords'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Control Horario y Registro de Jornadas</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full up-nav-count">
              {records.length}
            </span>
          </button>

          <button
            aria-pressed={supervisorTab === 'laborcosts'}
            onClick={() => setSupervisorTab('laborcosts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              supervisorTab === 'laborcosts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Mano de Obra y Costes</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full up-nav-count">
              {projects.length} obras
            </span>
          </button>

          <button
            aria-pressed={supervisorTab === 'security'}
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
      <main className="flex-1 up-workspace mx-auto w-full p-4 sm:p-8 space-y-8">
        {supervisorTab === 'workers' && (
          <WorkerManagement
            workers={workers}
            projects={projects}
            onRefresh={fetchData}
            onSelectWorkerForPreview={handleSelectWorkerForPreview}
          />
        )}

        {supervisorTab === 'timerecords' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Control Horario y Registro de Jornadas
                </h2>
                <p className="text-xs text-slate-400">
                  Monitorización en tiempo real de entradas, salidas y cómputo de horas por obra.
                </p>
              </div>
              <button
                onClick={() => setIsAssistedClockOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                + Fichar en Obra
              </button>
            </div>

            <TimeRecordsOverview
              records={records}
              projects={projects}
              workers={workers}
              onRefresh={fetchData}
            />
          </div>
        )}

        {supervisorTab === 'laborcosts' && (
          <ProjectLaborCosts projects={projects} records={records} />
        )}

        {supervisorTab === 'security' && <SecurityAuditTab />}
      </main>

      {/* Guided Assisted Clock-In Modal */}
      {isAssistedClockOpen && (
        <AssistedClockModal
          workers={workers}
          projects={projects}
          onClose={() => setIsAssistedClockOpen(false)}
          onSuccess={fetchData}
        />
      )}

      {/* Guided QR Generator Modal */}
      {activeQrInvitation && (
        <QrInvitationModal
          invitation={activeQrInvitation}
          onClose={() => setActiveQrInvitation(null)}
          onRevoke={async () => {
            if (confirm('¿Seguro que desea revocar esta invitación?')) {
              await api.revokeWorker(activeQrInvitation.workerId);
              setActiveQrInvitation(null);
              fetchData();
            }
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          UniProyect © 2026 José Real Construcciones, S.L. — Aislamiento estricto multi-inquilino y registro horario RGPD compliant.
        </p>
      </footer>
    </div>
  );
};
