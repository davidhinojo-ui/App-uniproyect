import React from 'react';
import { TimeRecord } from '../../types/index.js';
import { Clock, LogIn, LogOut, Building, Calendar, Euro } from 'lucide-react';

interface WorkerHistoryProps {
  records: TimeRecord[];
}

export const WorkerHistory: React.FC<WorkerHistoryProps> = ({ records }) => {
  const totalHours = records
    .filter((r) => r.type === 'check_out' && r.hoursWorked)
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Summary card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium">Historial personal</span>
          <h3 className="text-base font-bold text-white">Mis Fichajes Registrados</h3>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400">Total horas:</span>
          <p className="text-lg font-bold text-emerald-400">{totalHours.toFixed(1)} h</p>
        </div>
      </div>

      {/* Record list */}
      <div className="space-y-2.5">
        {records.map((r) => {
          const isCheckIn = r.type === 'check_in';
          const dateObj = new Date(r.timestamp);

          return (
            <div
              key={r.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCheckIn
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                  }`}
                >
                  {isCheckIn ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-bold ${
                        isCheckIn ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {isCheckIn ? 'ENTRADA' : 'SALIDA'}
                    </span>
                    <span className="text-slate-400 text-xs">• {r.projectName}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })} a las{' '}
                    <strong className="text-white font-mono">
                      {dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="text-right">
                {r.type === 'check_out' && r.hoursWorked ? (
                  <div>
                    <span className="text-sm font-bold text-white">{r.hoursWorked} h</span>
                    {r.calculatedCost && (
                      <span className="block text-[11px] text-emerald-400 font-semibold">
                        +{r.calculatedCost.toFixed(2)} €
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">Entrada</span>
                )}
              </div>
            </div>
          );
        })}

        {records.length === 0 && (
          <div className="text-center py-10 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            Aún no has registrado ningún fichaje.
          </div>
        )}
      </div>
    </div>
  );
};
