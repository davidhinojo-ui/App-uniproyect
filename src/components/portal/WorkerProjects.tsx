import React from 'react';
import { Project, Worker } from '../../types/index.js';
import { Building, MapPin, User, CheckCircle2 } from 'lucide-react';

interface WorkerProjectsProps {
  projects: Project[];
  worker: Worker;
}

export const WorkerProjects: React.FC<WorkerProjectsProps> = ({ projects, worker }) => {
  const authorized = projects.filter((p) => worker.assignedProjectIds.includes(p.id));

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <Building className="w-5 h-5 text-blue-400" /> Mis Obras Asignadas
        </h3>
        <p className="text-xs text-slate-400">
          Proyectos en los que estás autorizado por la empresa para registrar tu jornada laboral.
        </p>
      </div>

      <div className="space-y-3">
        {authorized.map((proj) => (
          <div
            key={proj.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono text-blue-400 font-bold">{proj.code}</span>
                <h4 className="text-base font-bold text-white leading-tight mt-0.5">{proj.name}</h4>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Autorizado
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              <p className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                <span>{proj.address}</span>
              </p>
              <p className="flex items-center gap-2 text-slate-400">
                <User className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Encargado: <strong className="text-slate-200">{proj.supervisorName}</strong></span>
              </p>
            </div>
          </div>
        ))}

        {authorized.length === 0 && (
          <div className="text-center py-10 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            No tienes obras asignadas actualmente. Consulta con tu supervisor.
          </div>
        )}
      </div>
    </div>
  );
};
