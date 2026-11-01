import React, { useState } from 'react';
import { api } from '../../services/api.js';
import { Worker } from '../../types/index.js';
import { KeyRound, User, Lock, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface WorkerLoginProps {
  onSuccess: (worker: Worker) => void;
  onBackToSupervisor: () => void;
  activeWorkers: Worker[];
}

export const WorkerLogin: React.FC<WorkerLoginProps> = ({
  onSuccess,
  onBackToSupervisor,
  activeWorkers,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !pin.trim()) {
      setError('Complete todos los campos');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.workerLogin(identifier.trim(), pin.trim());
      localStorage.setItem('uniproyect_worker_id', res.worker.id);
      localStorage.setItem('uniproyect_worker_token', res.token);
      onSuccess(res.worker);
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (w: Worker) => {
    setIdentifier(w.id);
    setPin('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <div className="text-center mb-6">
          <span className="text-xs uppercase font-bold tracking-widest text-blue-400">
            José Real Construcciones, S.L.
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
            Portal del Trabajador
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Acceso con Identificador y PIN personal
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" /> Identificador o Teléfono *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. w-101 o +34 611 223 344"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-400" /> PIN Personal *
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-xl tracking-[0.4em] font-mono py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Entrar a Mi Espacio <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Fast Access Pills */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <p className="text-[11px] text-slate-400 font-medium mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Acceso rápido de prueba (demo):
          </p>
          <div className="space-y-1.5">
            {activeWorkers
              .filter((w) => w.status === 'active')
              .map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleQuickSelect(w)}
                  className="w-full text-left p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 flex justify-between items-center text-xs text-slate-300 hover:text-white transition-colors"
                >
                  <span className="font-medium truncate">{w.fullName}</span>
                  <span className="text-[10px] text-blue-400 font-mono">PIN: {w.pin || '1234'}</span>
                </button>
              ))}
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onBackToSupervisor}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Volver al Panel de Supervisión
          </button>
        </div>
      </div>
    </div>
  );
};
