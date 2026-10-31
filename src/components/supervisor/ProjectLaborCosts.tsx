import React from 'react';
import { Project, TimeRecord } from '../../types/index.js';
import { Building, Euro, TrendingUp, Users, HardHat, FileText } from 'lucide-react';

interface ProjectLaborCostsProps {
  projects: Project[];
  records: TimeRecord[];
}

export const ProjectLaborCosts: React.FC<ProjectLaborCostsProps> = ({ projects, records }) => {
  return (
    <div className="space-y-6">
      {/* Informative banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <h4 className="font-bold text-white text-sm mb-1">
            Imputación Automática de Mano de Obra en Obras
          </h4>
          <p>
            Cada vez que un trabajador fichado registra su <strong>salida</strong> desde su portal individual, el sistema calcula automáticamente las horas efectivas multiplicadas por su tarifa horaria y <strong>suma el importe directamente al coste de mano de obra de la obra correspondiente</strong>.
          </p>
        </div>
      </div>

      {/* Grid of Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((project) => {
          const laborCost = project.laborCostTotal || 0;
          const materialCost = project.materialCostTotal || 0;
          const totalSpent = laborCost + materialCost;
          const budget = project.budget || 200000;
          const percentageBudget = Math.min(100, (totalSpent / budget) * 100);

          // Get project records
          const projectRecords = records.filter((r) => r.projectId === project.id);
          const projectCheckouts = projectRecords.filter((r) => r.type === 'check_out');
          const totalLoggedHours = projectCheckouts.reduce((acc, r) => acc + (r.hoursWorked || 0), 0);

          return (
            <div
              key={project.id}
              className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-600 transition-all"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono text-blue-400 font-bold">
                      {project.code}
                    </span>
                    <h3 className="text-base font-bold text-white leading-tight mt-0.5">
                      {project.name}
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    En curso
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  {project.address}
                </p>

                {/* Main Cost Highlights */}
                <div className="mt-5 grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700/40">
                  <div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <HardHat className="w-3.5 h-3.5 text-amber-400" /> Mano de Obra:
                    </span>
                    <p className="text-base font-bold text-amber-400 mt-0.5">
                      {laborCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {totalLoggedHours.toFixed(1)} h computadas
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-blue-400" /> Materiales:
                    </span>
                    <p className="text-base font-bold text-slate-200 mt-0.5">
                      {materialCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </p>
                    <span className="text-[10px] text-slate-400">Facturas / Albaranes</span>
                  </div>
                </div>

                {/* Total & Budget Bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Gasto Total Acumulado:</span>
                    <strong className="text-white">
                      {totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </strong>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-700/60 rounded-full h-2.5 overflow-hidden flex">
                    {/* Labor segment */}
                    <div
                      className="bg-amber-400 h-full"
                      style={{ width: `${(laborCost / budget) * 100}%` }}
                      title={`Mano de obra: ${laborCost}€`}
                    />
                    {/* Materials segment */}
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${(materialCost / budget) * 100}%` }}
                      title={`Materiales: ${materialCost}€`}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>
                      Presupuesto: {budget.toLocaleString('es-ES')} €
                    </span>
                    <span className={percentageBudget > 80 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                      {percentageBudget.toFixed(1)}% ejecutado
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-5 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
                <span>Encargado: {project.supervisorName}</span>
                <span className="text-slate-500">{projectCheckouts.length} salidas registradas</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
