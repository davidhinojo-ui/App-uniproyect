import React, { useState, useEffect } from 'react';
import { Worker, Project, TimeRecord, WorkerDocument } from '../../types/index.js';
import { api } from '../../services/api.js';
import { TimeClock } from './TimeClock.js';
import { WorkerHistory } from './WorkerHistory.js';
import { WorkerDocuments } from './WorkerDocuments.js';
import { WorkerProjects } from './WorkerProjects.js';
import {
  Clock,
  History,
  FileText,
  Building,
  LogOut,
  UserCheck,
  ShieldCheck,
  RefreshCw,
  HardHat,
} from 'lucide-react';

interface WorkerPortalProps {
  worker: Worker;
  projects: Project[];
  onLogout: () => void;
}

type TabType = 'clock' | 'history' | 'documents' | 'projects';

export const WorkerPortal: React.FC<WorkerPortalProps> = ({
  worker,
  projects,
  onLogout,
}) => {
  const [currentTab, setCurrentTab] = useState<TabType>('clock');
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [documents, setDocuments] = useState<WorkerDocument[]>([]);
  const [loading, setLoading] = useState(false);

  // Load worker's private records and documents
  const loadData = async () => {
    try {
      setLoading(true);
      const [recs, docs] = await Promise.all([
        api.getMyTimeRecords(worker.id),
        api.getMyDocuments(worker.id),
      ]);
      setRecords(recs);
      setDocuments(docs);
    } catch (err: any) {
      console.error('Error al cargar datos del trabajador:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [worker.id]);

  // Secure logout with complete session and cache purge (Shared mobile devices)
  const handleSecureLogout = () => {
    if (confirm('¿Cerrar sesión en este dispositivo? Se limpiará la memoria local de forma segura.')) {
      api.logout().catch(()=>{});
      localStorage.removeItem('uniproyect_worker_id');
      localStorage.removeItem('uniproyect_worker_token');
      sessionStorage.clear();
      onLogout();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 up-worker-portal flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="max-w-lg mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                José Real Construcciones, S.L.
              </span>
              <h2 className="text-sm font-bold text-white leading-tight truncate max-w-[190px] sm:max-w-none">
                {worker.fullName}
              </h2>
              <span className="text-[11px] text-slate-400 font-medium block">
                {worker.category}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleSecureLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
              title="Cerrar sesión y purgar datos en dispositivo compartido"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        {currentTab === 'clock' && (
          <TimeClock
            worker={worker}
            projects={projects}
            onTimeRecorded={loadData}
            recentRecords={records}
          />
        )}

        {currentTab === 'history' && <WorkerHistory records={records} />}

        {currentTab === 'documents' && (
          <WorkerDocuments documents={documents} worker={worker} onRefresh={loadData} />
        )}

        {currentTab === 'projects' && (
          <WorkerProjects projects={projects} worker={worker} />
        )}
      </main>

      {/* Fixed Bottom Navigation (Mobile First) */}
      <nav aria-label="Navegación del portal del trabajador" className="up-worker-nav fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2">
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-1">
          <button
            aria-current={currentTab === 'clock' ? 'page' : undefined}
            onClick={() => setCurrentTab('clock')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
              currentTab === 'clock'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Fichar</span>
          </button>

          <button
            aria-current={currentTab === 'history' ? 'page' : undefined}
            onClick={() => setCurrentTab('history')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
              currentTab === 'history'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Fichajes</span>
          </button>

          <button
            aria-current={currentTab === 'documents' ? 'page' : undefined}
            onClick={() => setCurrentTab('documents')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
              currentTab === 'documents'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="relative">
              <FileText className="w-5 h-5 mb-1" />
              {documents.some((d) => !d.signed) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400"></span>
              )}
            </div>
            <span className="text-[11px]">Nóminas</span>
          </button>

          <button
            aria-current={currentTab === 'projects' ? 'page' : undefined}
            onClick={() => setCurrentTab('projects')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
              currentTab === 'projects'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Building className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Obras</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
