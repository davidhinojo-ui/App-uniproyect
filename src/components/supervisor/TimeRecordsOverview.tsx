import React, { useState } from 'react';
import { TimeRecord, Project, Worker } from '../../types/index.js';
import {
  Clock,
  Building,
  Euro,
  Users,
  Calendar,
  LogIn,
  LogOut,
  MapPin,
  CheckCircle2,
  Filter,
} from 'lucide-react';

interface TimeRecordsOverviewProps {
  records: TimeRecord[];
  projects: Project[];
  workers: Worker[];
  onRefresh: () => void;
}

export const TimeRecordsOverview: React.FC<TimeRecordsOverviewProps> = ({
  records,
  projects,
  workers,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('all');

  // Filter records
  const filteredRecords = records.filter((r) => {
    const matchProject = selectedProjectId === 'all' || r.projectId === selectedProjectId;
    const matchWorker = selectedWorkerId === 'all' || r.workerId === selectedWorkerId;
    return matchProject && matchWorker;
  });

  // Calculate high-level stats
  const totalHours = filteredRecords
    .filter((r) => r.type === 'check_out' && r.hoursWorked)
    .reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

  const totalCost = filteredRecords
    .filter((r) => r.type === 'check_out' && r.calculatedCost)
    .reduce((sum, r) => sum + (r.calculatedCost || 0), 0);

  // Active workers in field right now (latest record is check_in without subsequent check_out)
  const workerLatestAction = new Map<string, TimeRecord>();
  records.forEach((r) => {
    const existing = workerLatestAction.get(r.workerId);
    if (!existing || new Date(r.timestamp) > new Date(existing.timestamp)) {
      workerLatestAction.set(r.workerId, r);
    }
  });

  const activeWorkersNow = Array.from(workerLatestAction.values()).filter(
    (r) => r.type === 'check_in'
  );

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Horas Computadas</p>
            <h4 className="text-xl font-bold text-white">{totalHours.toFixed(1)} h</h4>
            <p className="text-[11px] text-slate-500">En registros seleccionados</p>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Euro className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Mano de Obra Imputada</p>
            <h4 className="text-xl font-bold text-emerald-400">{totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</h4>
            <p className="text-[11px] text-emerald-500/80">Sumado automáticamente a obras</p>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">En Obra Ahora Mismo</p>
            <h4 className="text-xl font-bold text-amber-300">{activeWorkersNow.length} operarios</h4>
            <p className="text-[11px] text-amber-500/80">Fichaje de entrada activo</p>
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mr-2">
          <Filter className="w-3.5 h-3.5" /> Filtrar Fichajes:
        </span>

        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todas las Obras ({projects.length})</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={selectedWorkerId}
          onChange={(e) => setSelectedWorkerId(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos los Trabajadores ({workers.length})</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.fullName} ({w.category})
            </option>
          ))}
        </select>

        {(selectedProjectId !== 'all' || selectedWorkerId !== 'all') && (
          <button
            onClick={() => {
              setSelectedProjectId('all');
              setSelectedWorkerId('all');
            }}
            className="text-xs text-blue-400 hover:text-blue-300 underline ml-auto"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Records list / Table */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Operario</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Obra Imputada</th>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Horas / Coste</th>
                <th className="py-3 px-4">Ubicación / Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredRecords.map((record) => {
                const dateObj = new Date(record.timestamp);
                const isCheckIn = record.type === 'check_in';

                return (
                  <tr key={record.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      {record.workerName}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          isCheckIn
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {isCheckIn ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                        {isCheckIn ? 'ENTRADA' : 'SALIDA'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-200">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{record.projectName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}{' '}
                      <strong className="text-white">
                        {dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </td>

                    <td className="py-3 px-4">
                      {record.type === 'check_out' && record.hoursWorked ? (
                        <div>
                          <span className="font-semibold text-white">{record.hoursWorked}h</span>
                          <span className="text-emerald-400 font-bold ml-1.5">
                            +{record.calculatedCost?.toFixed(2)} €
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">En curso...</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-400 max-w-xs">
                      {record.location && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400/90 mb-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          GPS validado
                        </span>
                      )}
                      <span className="truncate block text-slate-300 text-[11px]">{record.notes}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRecords.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-xs">
              No hay registros de fichajes que coincidan con los filtros seleccionados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
