import React, { useState } from 'react';
import { Worker, Project } from '../../types/index.js';
import { api } from '../../services/api.js';
import { X, Clock, LogIn, LogOut, Building, User, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface AssistedClockModalProps {
  workers: Worker[];
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AssistedClockModal: React.FC<AssistedClockModalProps> = ({
  workers,
  projects,
  onClose,
  onSuccess,
}) => {
  const activeWorkers = workers.filter((w) => w.status === 'active');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(activeWorkers[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [clockType, setClockType] = useState<'check_in' | 'check_out'>('check_in');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId || !selectedProjectId) {
      setFeedback({ type: 'error', message: 'Seleccione el operario y la obra' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const res = await api.recordTime({
        workerId: selectedWorkerId,
        projectId: selectedProjectId,
        type: clockType,
        notes: notes.trim() || `Fichaje asistido registrado por el supervisor`,
      });

      setFeedback({ type: 'success', message: res.message });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al registrar fichaje' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">Fichaje Asistido en Obra</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800/80 rounded-2xl border border-slate-700">
            <button
              type="button"
              onClick={() => setClockType('check_in')}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                clockType === 'check_in'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" /> ENTRADA
            </button>
            <button
              type="button"
              onClick={() => setClockType('check_out')}
              className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                clockType === 'check_out'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogOut className="w-4 h-4" /> SALIDA
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" /> Operario *
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {activeWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.fullName} — {w.category} ({w.hourlyRate} €/h)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-400" /> Obra de Imputación *
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones del Fichaje (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Entrada turno mañana, replanteo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                clockType === 'check_in'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
              }`}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Confirmar {clockType === 'check_in' ? 'Entrada' : 'Salida'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
