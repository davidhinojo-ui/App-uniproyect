/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Obra, FacturaAlbaran, PersonalCost, OtrosGasto, getObraOverheadAllocationMap } from '../types';
import { TrendingUp, Euro, Users, Receipt, Briefcase, AlertTriangle } from 'lucide-react';

interface KPICardsProps {
  selectedObraId: string | 'all';
  obras: Obra[];
  documentos: FacturaAlbaran[];
  personal: PersonalCost[];
  gastosGenerales: OtrosGasto[];
}

export default function KPICards({
  selectedObraId,
  obras,
  documentos,
  personal,
  gastosGenerales,
}: KPICardsProps) {
  // Memoized calculations based on the active project filter
  const {
    activeObras,
    totalBudget,
    filteredDocs,
    materialsSpent,
    laborSpent,
    companyOverhead,
    currentAllocationPercent,
    totalSpent,
    remainingBudget,
    marginPercentage,
    facturasCount,
    albaranesCount,
  } = React.useMemo(() => {
    const activeObras = selectedObraId === 'all' 
      ? obras 
      : obras.filter(o => o.id === selectedObraId);

    const totalBudget = activeObras.reduce((sum, o) => sum + (Number(o.budget) || 0), 0);

    const filteredDocs = selectedObraId === 'all'
      ? documentos
      : documentos.filter(d => d.obraId === selectedObraId);

    const filteredPersonal = selectedObraId === 'all'
      ? personal.filter(p => p.obraId !== 'structural')
      : personal.filter(p => p.obraId === selectedObraId);

    // Spent counts
    const materialsSpent = filteredDocs.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
    const laborSpent = filteredPersonal.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
    
    // Overhead is general company expenses. Prorated proportionally to active works by economic volume (budget) or custom percentage
    const totalCompanyOverhead = gastosGenerales.reduce((sum, g) => sum + (Number(g.amount) || 0), 0) +
                                 personal.filter(p => p.obraId === 'structural').reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);

    const overheadAllocationMap = getObraOverheadAllocationMap(obras, totalCompanyOverhead);

    const companyOverhead = selectedObraId === 'all'
      ? totalCompanyOverhead
      : (overheadAllocationMap[selectedObraId]?.amount || 0);

    const currentAllocationPercent = selectedObraId !== 'all'
      ? (overheadAllocationMap[selectedObraId]?.percent || 0) * 100
      : 100;

    const totalSpent = materialsSpent + laborSpent + companyOverhead;
    const remainingBudget = totalBudget - totalSpent;
    const marginPercentage = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0;
    const facturasCount = filteredDocs.filter(d => d.type === 'factura').length;
    const albaranesCount = filteredDocs.filter(d => d.type === 'albaran').length;

    return {
      activeObras,
      totalBudget,
      filteredDocs,
      materialsSpent,
      laborSpent,
      companyOverhead,
      currentAllocationPercent,
      totalSpent,
      remainingBudget,
      marginPercentage,
      facturasCount,
      albaranesCount,
    };
  }, [selectedObraId, obras, documentos, personal, gastosGenerales]);

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-dashboard-grid">
      {/* Total Presupuesto */}
      <div className="bg-[#0F0F12] rounded-2xl p-5 border border-white/[0.06] shadow-premium relative overflow-hidden transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5 group" id="card-budget">
        <div className="flex justify-between items-start" id="card-budget-header">
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-display">Presupuesto Asignado</p>
            <h3 className="text-2xl font-bold text-white mt-1.5 font-mono tracking-tight group-hover:text-emerald-400 transition-colors">{formatCurrency(totalBudget)}</h3>
          </div>
          <div className="bg-[#10B981]/10 text-[#10B981] p-2.5 rounded-xl border border-[#10B981]/20 transition-transform group-hover:scale-105" id="card-budget-icon">
            <Briefcase className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-white/40" id="card-budget-footer">
          <span className="font-extrabold text-white/70">{activeObras.length}</span> {activeObras.length === 1 ? 'Obra seleccionada' : 'Obras consolidadas'}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-green-600"></div>
      </div>

      {/* Gastos Acumulados */}
      <div className="bg-[#0F0F12] rounded-2xl p-5 border border-white/[0.06] shadow-premium relative overflow-hidden transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5 group" id="card-expenses">
        <div className="flex justify-between items-start" id="card-expenses-header">
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-display">Gastos Acumulados</p>
            <h3 className="text-2xl font-bold text-white mt-1.5 font-mono tracking-tight group-hover:text-red-400 transition-colors">{formatCurrency(totalSpent)}</h3>
          </div>
          <div className="bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20 transition-transform group-hover:scale-105" id="card-expenses-icon">
            <TrendingUp className="w-5 h-5 animate-pulse" />
          </div>
        </div>
        <div className="mt-4 text-[10px] text-white/40 flex flex-wrap gap-1.5" id="card-expenses-sub-ratios">
          <span className="bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded text-white/60 font-mono">Mat: {formatCurrency(materialsSpent)}</span>
          <span className="bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded text-white/60 font-mono">Lab: {formatCurrency(laborSpent)}</span>
          {companyOverhead > 0 && (
            <span className="bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-0.5 rounded text-[#10B981] hover:text-[#10B981]/80 font-mono font-bold transition-colors" title={selectedObraId === 'all' ? "Estructura general de empresa" : "Gastos estructurales de empresa repercutidos proporcional o manualmente"}>
              {selectedObraId === 'all' ? 'Overhead' : 'Estr. Repercutida'}: {formatCurrency(companyOverhead)}
              {selectedObraId !== 'all' && (
                ` (${currentAllocationPercent.toFixed(1)}%)`
              )}
            </span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-red-500"></div>
      </div>

      {/* Margen de Utilidad */}
      <div className="bg-[#0F0F12] rounded-2xl p-5 border border-white/[0.06] shadow-premium relative overflow-hidden transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5 group" id="card-margin">
        <div className="flex justify-between items-start" id="card-margin-header">
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-display">Margen Estimado</p>
            <h3 className={`text-2xl font-bold mt-1.5 font-mono tracking-tight ${remainingBudget >= 0 ? 'text-emerald-400 group-hover:text-emerald-300' : 'text-red-400 group-hover:text-red-300'} transition-colors`}>
              {formatCurrency(remainingBudget)}
            </h3>
          </div>
          <div className={`p-2.5 rounded-xl border transition-transform group-hover:scale-105 ${remainingBudget >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`} id="card-margin-icon">
            <Euro className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4.5" id="card-margin-bar-group">
          <div className="flex justify-between text-[11px] text-white/40 mb-1 font-display" id="card-margin-sub">
            <span>Rendimiento Bruto</span>
            <span className={`font-bold ${remainingBudget >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{marginPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-1 overflow-hidden" id="card-margin-progressbar">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${remainingBudget < 0 ? 'bg-red-500' : marginPercentage < 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.max(0, Math.min(100, marginPercentage))}%` }}
              id="card-margin-progress-fill"
            ></div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-emerald-500"></div>
      </div>

      {/* Clasificación de Documentos */}
      <div className="bg-[#0F0F12] rounded-2xl p-5 border border-white/[0.06] shadow-premium relative overflow-hidden transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5 group" id="card-billing">
        <div className="flex justify-between items-start" id="card-billing-header">
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-display">Documentos Recibidos</p>
            <h3 className="text-2xl font-bold text-white mt-1.5 font-mono tracking-tight group-hover:text-emerald-400 transition-colors">{filteredDocs.length} Uds.</h3>
          </div>
          <div className="bg-[#10B981]/10 text-[#10B981] p-2.5 rounded-xl border border-[#10B981]/20 transition-transform group-hover:scale-105" id="card-billing-icon">
            <Receipt className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
        <div className="mt-4 flex gap-4 text-xs font-semibold text-white/50" id="card-billing-sub">
          <div className="flex items-center gap-1.5" id="billing-paid-label">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Facturas: <strong className="text-white font-mono">{facturasCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5" id="billing-pending-label">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Albaranes: <strong className="text-white font-mono">{albaranesCount}</strong></span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-green-600"></div>
      </div>

      {/* Alerta de Desviación de Presupuesto */}
      {marginPercentage < 10 && totalBudget > 0 && (
        <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-amber-950/20 border border-amber-500/30 text-amber-200 rounded-xl p-4 flex items-center gap-3 shadow-inner font-sans" id="budget-margin-warn-callout">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <strong className="font-semibold block sm:inline">⚠️ Atrapamiento de Margen de Obra:</strong> El margen financiero está por debajo del 10%. Por favor, revise los costes de subcontratación, controle que no haya albaranes retrasados sin auditar y ajuste las ratios de peones.
          </div>
        </div>
      )}
    </div>
  );
}
