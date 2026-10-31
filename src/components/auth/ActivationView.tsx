import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Worker } from '../../types/index.js';
import { ShieldCheck, CheckCircle2, AlertTriangle, KeyRound, Lock, ArrowRight, Loader2 } from 'lucide-react';

interface ActivationViewProps {
  token: string;
  onActivated: (worker: Worker) => void;
  onCancel: () => void;
}

export const ActivationView: React.FC<ActivationViewProps> = ({
  token,
  onActivated,
  onCancel,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<{
    workerName: string;
    category: string;
    organizationName: string;
    expiresAt: string;
    workerId: string;
  } | null>(null);

  // Form states
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  // Verify token on mount
  useEffect(() => {
    let isMounted = true;
    async function verify() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.verifyInvitation(token);
        if (isMounted) {
          setInvitationData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'El código QR no es válido o ha caducado.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    verify();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setActivationError('El PIN debe tener al menos 4 números');
      return;
    }
    if (pin !== confirmPin) {
      setActivationError('Los dos números PIN introducidos no coinciden');
      return;
    }

    try {
      setActivating(true);
      setActivationError(null);
      const res = await api.activateWorker({
        token,
        pin,
      });

      // Save worker session
      localStorage.setItem('uniproyect_worker_id', res.worker.id || '');
      localStorage.setItem('uniproyect_worker_token', res.token);

      onActivated(res.worker as Worker);
    } catch (err: any) {
      setActivationError(err.message || 'Error al completar la activación');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Top subtle glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-blue-500 rounded-b-full"></div>

        {/* Company Header */}
        <div className="text-center mb-6">
          <span className="text-xs uppercase font-bold tracking-widest text-blue-400">
            José Real Construcciones, S.L.
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">
            Portal Personal del Trabajador
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Activación segura mediante código QR individual
          </p>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-slate-300">Validando código de acceso seguro...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Acceso No Válido</h3>
              <p className="text-xs text-rose-300 mt-1 max-w-xs mx-auto">{error}</p>
            </div>
            <p className="text-xs text-slate-400">
              Pide a tu encargado o supervisor un nuevo código QR de activación.
            </p>
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Volver al Inicio
            </button>
          </div>
        ) : invitationData ? (
          <div>
            {/* Welcome Worker Card */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center font-bold text-lg">
                  {invitationData.workerName.charAt(0)}
                </div>
                <div>
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Identidad Verificada
                  </span>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {invitationData.workerName}
                  </h3>
                  <p className="text-xs text-slate-400">{invitationData.category}</p>
                </div>
              </div>
            </div>

            {/* Form to set personal PIN */}
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Crea un <strong>código PIN numérico de 4 dígitos</strong> que recuerdes con facilidad. Te servirá para entrar en tu portal a registrar tu jornada y ver tus nóminas.
                </p>
              </div>

              {activationError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs">
                  {activationError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-400" /> Nuevo PIN de 4 dígitos *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-400" /> Repite tu PIN para confirmar *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={activating || pin.length < 4}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {activating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Activando tu cuenta...
                  </>
                ) : (
                  <>
                    Activar y Entrar al Portal <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
};
