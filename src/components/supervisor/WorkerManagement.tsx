import React, { useState } from 'react';
import { Worker, Project, WorkerInvitation } from '../../types/index.js';
import { api } from '../../services/api.js';
import { QrInvitationModal } from './QrInvitationModal.js';
import {
  QrCode,
  UserCheck,
  UserX,
  AlertTriangle,
  Plus,
  Search,
  Building,
  Euro,
  ExternalLink,
  Shield,
  Loader2,
} from 'lucide-react';

interface WorkerManagementProps {
  workers: Worker[];
  projects: Project[];
  onRefresh: () => void;
  onSelectWorkerForPreview?: (worker: Worker) => void;
}

export const WorkerManagement: React.FC<WorkerManagementProps> = ({
  workers,
  projects,
  onRefresh,
  onSelectWorkerForPreview,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeInvitation, setActiveInvitation] = useState<WorkerInvitation | null>(null);
  const [loadingWorkerId, setLoadingWorkerId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New worker form state
  const [newFullName, setNewFullName] = useState('');
  const [newDniNie, setNewDniNie] = useState('');
  const [newCategory, setNewCategory] = useState('Oficial 1ª Albañil');
  const [newHourlyRate, setNewHourlyRate] = useState('19.50');
  const [newPhone, setNewPhone] = useState('');
  const [newSelectedProjects, setNewSelectedProjects] = useState<string[]>(['proj-001']);
  const [submittingWorker, setSubmittingWorker] = useState(false);
  const [formError, setFormError] = useState('');

  // Handle Generate QR Invitation
  const handleGenerateQr = async (workerId: string) => {
    try {
      setLoadingWorkerId(workerId);
      const invitation = await api.createInvitation(workerId);
      setActiveInvitation(invitation);
      onRefresh();
    } catch (err: any) {
      alert('Error al generar código QR: ' + err.message);
    } finally {
      setLoadingWorkerId(null);
    }
  };

  // Handle Revoke Access
  const handleToggleStatus = async (worker: Worker, newStatus: Worker['status']) => {
    const confirmMsg =
      newStatus === 'revoked'
        ? `¿Seguro que desea revocar el acceso a ${worker.fullName}? Sus invitaciones y credenciales quedarán invalidadas.`
        : `¿Cambiar el estado de ${worker.fullName} a "${newStatus}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      if (newStatus === 'revoked') {
        await api.revokeWorker(worker.id, 'Revocación manual por el supervisor');
      } else {
        await api.updateWorker(worker.id, { status: newStatus });
      }
      onRefresh();
    } catch (err: any) {
      alert('Error al actualizar estado: ' + err.message);
    }
  };

  // Create Worker submission
  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      setFormError('El nombre completo es obligatorio');
      return;
    }
    try {
      setSubmittingWorker(true);
      setFormError('');
      await api.createWorker({
        fullName: newFullName.trim(),
        dniNie: newDniNie.trim(),
        category: newCategory,
        hourlyRate: parseFloat(newHourlyRate) || 18.0,
        assignedProjectIds: newSelectedProjects,
        phone: newPhone.trim(),
      });
      setIsAddModalOpen(false);
      setNewFullName('');
      setNewDniNie('');
      setNewPhone('');
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar trabajador');
    } finally {
      setSubmittingWorker(false);
    }
  };

  // Filtering
  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.dniNie.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top action & search bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 w-full sm:w-auto items-center">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, DNI o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados ({workers.length})</option>
            <option value="active">Activos</option>
            <option value="pending">Pendientes de QR</option>
            <option value="suspended">Suspendidos</option>
            <option value="revoked">Revocados</option>
          </select>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-blue-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Trabajador
        </button>
      </div>

      {/* Workers Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkers.map((worker) => {
          const assignedProjectsNames = worker.assignedProjectIds
            .map((pid) => projects.find((p) => p.id === pid)?.name)
            .filter(Boolean);

          const isLoadingThis = loadingWorkerId === worker.id;

          return (
            <div
              key={worker.id}
              className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-600 transition-all shadow-lg"
            >
              <div>
                {/* Header with status pill */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">
                      {worker.fullName}
                    </h3>
                    <p className="text-xs text-blue-400 font-medium mt-0.5">
                      {worker.category}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                      worker.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : worker.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : worker.status === 'suspended'
                        ? 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {worker.status === 'active' && <UserCheck className="w-3 h-3" />}
                    {worker.status === 'pending' && <AlertTriangle className="w-3 h-3" />}
                    {worker.status === 'suspended' && <UserX className="w-3 h-3" />}
                    {worker.status === 'revoked' && <Shield className="w-3 h-3" />}
                    {worker.status === 'active' && 'Activo'}
                    {worker.status === 'pending' && 'Pendiente QR'}
                    {worker.status === 'suspended' && 'Suspendido'}
                    {worker.status === 'revoked' && 'Revocado'}
                  </span>
                </div>

                {/* Worker Details */}
                <div className="mt-4 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400">DNI / NIE:</span>
                    <span className="font-mono font-medium text-slate-200">{worker.dniNie || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Euro className="w-3.5 h-3.5 text-emerald-400" /> Coste hora:
                    </span>
                    <span className="font-bold text-emerald-400">{worker.hourlyRate.toFixed(2)} €/h</span>
                  </div>
                  <div className="py-1">
                    <span className="text-slate-400 flex items-center gap-1 mb-1">
                      <Building className="w-3.5 h-3.5 text-blue-400" /> Obras autorizadas:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {assignedProjectsNames.length > 0 ? (
                        assignedProjectsNames.map((pname, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 text-[11px] border border-slate-700 truncate max-w-[200px]"
                            title={pname}
                          >
                            {pname}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">Ninguna asignada</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 pt-4 border-t border-slate-700/60 space-y-2">
                <button
                  onClick={() => handleGenerateQr(worker.id)}
                  disabled={isLoadingThis || worker.status === 'revoked'}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600/90 hover:bg-blue-600 text-white font-medium rounded-xl text-xs transition-colors shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingThis ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  {worker.activationCount > 0 ? 'Regenerar Acceso QR' : 'Crear Acceso al Portal (QR)'}
                </button>

                <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                  {onSelectWorkerForPreview && (
                    <button
                      onClick={() => onSelectWorkerForPreview(worker)}
                      className="text-slate-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                      title="Abrir vista previa del portal de este trabajador"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Probar Portal
                    </button>
                  )}

                  <div className="flex gap-2 ml-auto">
                    {worker.status === 'active' ? (
                      <button
                        onClick={() => handleToggleStatus(worker, 'suspended')}
                        className="text-amber-400 hover:text-amber-300 hover:underline"
                      >
                        Suspender
                      </button>
                    ) : worker.status === 'suspended' ? (
                      <button
                        onClick={() => handleToggleStatus(worker, 'active')}
                        className="text-emerald-400 hover:text-emerald-300 hover:underline"
                      >
                        Reactivar
                      </button>
                    ) : null}

                    {worker.status !== 'revoked' && (
                      <button
                        onClick={() => handleToggleStatus(worker, 'revoked')}
                        className="text-rose-400 hover:text-rose-300 hover:underline"
                      >
                        Revocar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredWorkers.length === 0 && (
        <div className="text-center py-12 bg-slate-800/40 rounded-2xl border border-slate-700/40">
          <p className="text-slate-400 text-sm">No se encontraron trabajadores con los filtros aplicados.</p>
        </div>
      )}

      {/* QR Code Modal */}
      {activeInvitation && (
        <QrInvitationModal
          invitation={activeInvitation}
          onClose={() => setActiveInvitation(null)}
          onRevoke={async () => {
            if (confirm('¿Seguro que desea revocar esta invitación?')) {
              await api.revokeWorker(activeInvitation.workerId);
              setActiveInvitation(null);
              onRefresh();
            }
          }}
        />
      )}

      {/* Modal: New Worker */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/60 flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Alta de Nuevo Trabajador</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWorker} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nombre y Apellidos *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez Santana"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">DNI / NIE *</label>
                  <input
                    type="text"
                    required
                    placeholder="12345678Z"
                    value={newDniNie}
                    onChange={(e) => setNewDniNie(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Coste Hora (€/h) *</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={newHourlyRate}
                    onChange={(e) => setNewHourlyRate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Categoría Laboral *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Oficial 1ª Albañil">Oficial 1ª Albañil</option>
                  <option value="Oficial 1ª Encofrador">Oficial 1ª Encofrador</option>
                  <option value="Peón Especialista">Peón Especialista</option>
                  <option value="Oficial Electricista">Oficial Electricista</option>
                  <option value="Oficial Fontanero">Oficial Fontanero</option>
                  <option value="Encargado de Obra">Encargado de Obra</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Teléfono Móvil (opcional)</label>
                <input
                  type="tel"
                  placeholder="+34 600 000 000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Obras Asignadas Inicialmente</label>
                <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                  {projects.map((proj) => {
                    const isChecked = newSelectedProjects.includes(proj.id);
                    return (
                      <label key={proj.id} className="flex items-center gap-2 cursor-pointer text-slate-200">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSelectedProjects([...newSelectedProjects, proj.id]);
                            } else {
                              setNewSelectedProjects(newSelectedProjects.filter((id) => id !== proj.id));
                            }
                          }}
                          className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{proj.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingWorker}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50 shadow-md shadow-blue-500/20"
                >
                  {submittingWorker ? 'Guardando...' : 'Guardar y Habilitar QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
