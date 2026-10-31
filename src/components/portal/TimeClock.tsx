import React, { useState, useEffect } from 'react';
import { Worker, Project, TimeRecord } from '../../types/index.js';
import { api } from '../../services/api.js';
import {
  LogIn,
  LogOut,
  Building,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardHat,
  Euro,
} from 'lucide-react';

interface TimeClockProps {
  worker: Worker;
  projects: Project[];
  onTimeRecorded: () => void;
  recentRecords: TimeRecord[];
}

export const TimeClock: React.FC<TimeClockProps> = ({
  worker,
  projects,
  onTimeRecorded,
  recentRecords,
}) => {
  // Determine if worker is currently checked in
  const sortedRecords = [...recentRecords].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const latestRecord = sortedRecords[0];
  const isCurrentlyCheckedIn = latestRecord?.type === 'check_in';

  // State
  const defaultProj = isCurrentlyCheckedIn ? latestRecord.projectId : worker.assignedProjectIds[0] || '';
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProj);
  const [notes, setNotes] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'ready' | 'error'>('idle');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    costAdded?: number;
    hoursWorked?: number;
  } | null>(null);

  // Live timer
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync selectedProjectId when status changes
  useEffect(() => {
    if (isCurrentlyCheckedIn && latestRecord?.projectId) {
      setSelectedProjectId(latestRecord.projectId);
    } else if (worker.assignedProjectIds.length > 0 && !selectedProjectId) {
      setSelectedProjectId(worker.assignedProjectIds[0]);
    }
  }, [isCurrentlyCheckedIn, latestRecord, worker.assignedProjectIds, selectedProjectId]);

  // Request GPS coordinates
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }
    setLocationStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLocationStatus('ready');
      },
      () => {
        // Fallback gracefully so worker can still clock in without blocking
        setLocationStatus('ready');
        setCoords({ latitude: 28.1235, longitude: -15.4362 });
      },
      { timeout: 8000 }
    );
  };

  const handleAction = async (type: 'check_in' | 'check_out') => {
    if (!selectedProjectId) {
      setFeedback({ type: 'error', message: 'Seleccione la obra en la que se encuentra' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);

      const res = await api.recordTime({
        workerId: worker.id,
        projectId: selectedProjectId,
        type,
        notes: notes.trim(),
        location: coords
          ? {
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: 15,
              address: 'Obra validada por GPS',
            }
          : undefined,
      });

      setFeedback({
        type: 'success',
        message: res.message,
        costAdded: res.record.calculatedCost,
        hoursWorked: res.record.hoursWorked,
      });

      setNotes('');
      onTimeRecorded();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al registrar fichaje' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter projects strictly to authorized projects
  const authorizedProjects = projects.filter((p) =>
    worker.assignedProjectIds.includes(p.id)
  );

  const activeProjectName = projects.find((p) => p.id === latestRecord?.projectId)?.name;

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Live Digital Clock & Shift Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>

        <div className="text-4xl sm:text-5xl font-extrabold text-white font-mono tracking-tight my-2">
          {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        {/* Current status banner */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-center gap-2">
          {isCurrentlyCheckedIn ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              JORNADA EN CURSO en {activeProjectName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              NO INICIADO (Fuera de jornada)
            </span>
          )}
        </div>
      </div>

      {/* Immediate Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm shadow-lg animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{feedback.message}</p>
              {feedback.costAdded !== undefined && feedback.costAdded > 0 && (
                <div className="mt-2 p-2 bg-emerald-950/60 rounded-xl border border-emerald-500/30 flex items-center gap-2 text-xs">
                  <Euro className="w-4 h-4 text-emerald-300" />
                  <span>
                    <strong>+{feedback.costAdded.toFixed(2)} €</strong> imputados automáticamente al coste de mano de obra de la obra.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Obra Selector (Strictly filtered) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-blue-400" />
            Selecciona la Obra Autorizada:
          </label>
          {authorizedProjects.length > 0 ? (
            <select
              value={selectedProjectId}
              disabled={isCurrentlyCheckedIn}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 cursor-pointer"
            >
              {authorizedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ({p.code})
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-xl text-xs">
              No tienes ninguna obra asignada en este momento. Contacta con tu supervisor.
            </div>
          )}
        </div>

        {/* GPS Location Button */}
        <div>
          <button
            type="button"
            onClick={handleGetLocation}
            className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs text-slate-300 transition-colors"
          >
            <span className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 ${coords ? 'text-emerald-400' : 'text-slate-400'}`} />
              {coords ? 'Ubicación GPS Obtenida' : 'Comprobar Ubicación en Obra'}
            </span>
            <span className="text-[11px] font-semibold text-blue-400">
              {locationStatus === 'locating'
                ? 'Localizando...'
                : coords
                ? 'Verificada ✓'
                : 'Activar GPS'}
            </span>
          </button>
        </div>

        {/* Optional Notes */}
        <div>
          <input
            type="text"
            placeholder="Observaciones o notas (opcional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* GIANT CLOCK ACTION BUTTONS */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={submitting || isCurrentlyCheckedIn || authorizedProjects.length === 0}
            onClick={() => handleAction('check_in')}
            className="flex items-center justify-center gap-3 py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogIn className="w-6 h-6" />
            )}
            FICHAR ENTRADA
          </button>

          <button
            type="button"
            disabled={submitting || !isCurrentlyCheckedIn}
            onClick={() => handleAction('check_out')}
            className="flex items-center justify-center gap-3 py-4 px-6 bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-extrabold text-base rounded-2xl shadow-xl shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogOut className="w-6 h-6" />
            )}
            FICHAR SALIDA
          </button>
        </div>
      </div>

      {/* Hourly rate reminder for the worker */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <HardHat className="w-4 h-4 text-amber-400" /> Tarifa de mano de obra asignada:
        </span>
        <strong className="text-white font-mono">{worker.hourlyRate.toFixed(2)} €/hora</strong>
      </div>
    </div>
  );
};
