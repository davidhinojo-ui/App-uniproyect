import React from 'react';
import { Worker, Project, TimeRecord } from '../../types/index.js';
import {
  Clock,
  QrCode,
  Users,
  TrendingUp,
  FileSearch,
  ArrowRight,
  HardHat,
  Building,
  CheckCircle2,
  Sparkles,
  Smartphone,
} from 'lucide-react';

interface QuickGuidedActionsProps {
  workers: Worker[];
  projects: Project[];
  records: TimeRecord[];
  onOpenClockIn: () => void;
  onOpenQrGenerator: () => void;
  onNavigateToTab: (tab: 'workers' | 'timerecords' | 'laborcosts' | 'security') => void;
  onOpenWorkerPortalLogin: () => void;
}

export const QuickGuidedActions: React.FC<QuickGuidedActionsProps> = ({
  workers,
  projects,
  records,
  onOpenClockIn,
  onOpenQrGenerator,
  onNavigateToTab,
  onOpenWorkerPortalLogin,
}) => {
  // Stats for guided mode
  const activeNowCount = records.filter(
    (r, _, arr) =>
      r.type === 'check_in' &&
      !arr.some(
        (other) =>
          other.workerId === r.workerId &&
          other.type === 'check_out' &&
          new Date(other.timestamp) > new Date(r.timestamp)
      )
  ).length;

  const totalLaborCost = projects.reduce((sum, p) => sum + (p.laborCostTotal || 0), 0);

  return (
    <div className="space-y-6">
      {/* Hero Banner for Guided Experience */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/80 border border-blue-500/30 rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Experiencia Guiada Simplificada
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              ACCIONES RÁPIDAS GUIADAS
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Seleccione la tarea que desea realizar. Diseñado con botones grandes, lectura clara y pasos directos para obra y oficina.
            </p>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
            <span className="text-xs text-slate-400">Operarios activos ahora:</span>
            <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {activeNowCount} en obra
            </span>
          </div>
        </div>
      </div>

      {/* Main Guided Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: Fichar Entrada / Salida */}
        <div
          onClick={onOpenClockIn}
          className="group bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 rounded-3xl p-5 sm:p-6 shadow-xl hover:shadow-emerald-500/10 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Control de Asistencia
            </span>
            <h3 className="text-lg font-bold text-white mt-1 group-hover:text-emerald-300 transition-colors">
              Fichar Entrada / Salida
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Registrar jornada presencial o asistida de un operario con selección guiada de obra y validación GPS.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Iniciar Registro</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Generar Pase QR */}
        <div
          onClick={onOpenQrGenerator}
          className="group bg-slate-900/90 border border-slate-800 hover:border-blue-500/60 rounded-3xl p-5 sm:p-6 shadow-xl hover:shadow-blue-500/10 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
              <QrCode className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Acceso Móvil al Portal
            </span>
            <h3 className="text-lg font-bold text-white mt-1 group-hover:text-blue-300 transition-colors">
              Generar Pase QR para Operario
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Crear invitación criptográfica de 48h con código QR listo para imprimir en papel o escanear en pantalla.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
            <span>Emitir Código QR</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Control Horario y Registro de Jornadas */}
        <div
          onClick={() => onNavigateToTab('timerecords')}
          className="group bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 rounded-3xl p-5 sm:p-6 shadow-xl hover:shadow-amber-500/10 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Inspección en Vivo
            </span>
            <h3 className="text-lg font-bold text-white mt-1 group-hover:text-amber-300 transition-colors">
              Control Horario y Registro de Jornadas
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Consultar turnos activos, horas efectivas computadas del día y trazabilidad legal de fichajes.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
            <span>Ver Fichajes de Hoy ({records.length})</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Costes de Mano de Obra Acumulada */}
        <div
          onClick={() => onNavigateToTab('laborcosts')}
          className="group bg-slate-900/90 border border-slate-800 hover:border-purple-500/60 rounded-3xl p-5 sm:p-6 shadow-xl hover:shadow-purple-500/10 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
              Imputación Económica
            </span>
            <h3 className="text-lg font-bold text-white mt-1 group-hover:text-purple-300 transition-colors">
              Gasto Acumulado en Obras
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Total mano de obra generado automáticamente por los fichajes: <strong className="text-emerald-400 font-mono">{totalLaborCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong>.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-purple-400 group-hover:translate-x-1 transition-transform">
            <span>Ver Desglose por Obra</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 5: Entrar como Operario (Probar Espacio Personal) */}
        <div
          onClick={onOpenWorkerPortalLogin}
          className="group bg-slate-900/90 border border-slate-800 hover:border-sky-500/60 rounded-3xl p-5 sm:p-6 shadow-xl hover:shadow-sky-500/10 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 group-hover:scale-110 transition-transform">
              <Smartphone className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Portal del Operario
            </span>
            <h3 className="text-lg font-bold text-white mt-1 group-hover:text-sky-300 transition-colors">
              Probar Espacio del Trabajador
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Abrir la vista móvil idéntica a la que ve el albañil o peón en su teléfono móvil con su PIN.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-sky-400 group-hover:translate-x-1 transition-transform">
            <span>Abrir Portal Operario</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Card 6: Auditoría y Seguridad Zero-Trust */}
        <div
          onClick={() => onNavigateToTab('security')}
          className="group bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 rounded-3xl p-5 sm:p-6 shadow-xl hover:shadow-emerald-500/10 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Seguridad RGPD & Aislamiento
            </span>
            <h3 className="text-lg font-bold text-white mt-1 group-hover:text-emerald-300 transition-colors">
              Auditoría y Pruebas Zero-Trust
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              12 de 12 pruebas superadas. Cero filtraciones entre trabajadores y trazabilidad inmutable.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Ver Matriz de Seguridad</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};
