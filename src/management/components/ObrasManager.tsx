/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Obra, FacturaAlbaran, PersonalCost, Proveedor, TrabajadorPRL, getObraOverheadAllocationMap } from '../types';
import { 
  Plus, Search, Building2, MapPin, Trash2, Settings, Download, 
  Upload, Share2, Receipt, Users, CheckCircle2, FileSpreadsheet, X, Pencil 
} from 'lucide-react';
import ExportObraModal from './ExportObraModal';
import ImportObraModal from './ImportObraModal';
import { ProcessImportResult } from '../lib/obraExportImportService';

interface ObrasManagerProps {
  obras: Obra[];
  documentos?: FacturaAlbaran[];
  personal?: PersonalCost[];
  proveedores?: Proveedor[];
  trabajadores?: TrabajadorPRL[];
  addObra: (o: Obra) => void;
  deleteObra: (id: string) => void;
  updateObra: (o: Obra) => void;
  onImportComplete?: (result: ProcessImportResult) => void;
  userEmail?: string | null;
}

export default function ObrasManager({ 
  obras, 
  documentos = [], 
  personal = [], 
  proveedores = [], 
  trabajadores = [],
  addObra, 
  deleteObra, 
  updateObra,
  onImportComplete,
  userEmail,
}: ObrasManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Export & Import Modals
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportPreselectedId, setExportPreselectedId] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<{
    msg: string;
    details?: string;
  } | null>(null);

  // Edit Obra Modal state
  const [editingObraData, setEditingObraData] = useState<Obra | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState(0);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'on_hold'>('active');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [overheadAllocationType, setOverheadAllocationType] = useState<'auto' | 'custom'>('auto');
  const [overrideOverheadPercent, setOverrideOverheadPercent] = useState<number>(0);

  // Inline configuration states per card
  const [configuringObraId, setConfiguringObraId] = useState<string | null>(null);
  const [editingAllocType, setEditingAllocType] = useState<'auto' | 'custom'>('auto');
  const [editingPercent, setEditingPercent] = useState<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return;

    const newObra: Obra = {
      id: `obra-${Date.now()}`,
      name,
      location,
      budget: Number(budget) || 0,
      description,
      status,
      startDate,
      overheadAllocationType,
      overrideOverheadPercent: overheadAllocationType === 'custom' ? Number(overrideOverheadPercent) || 0 : undefined
    };

    addObra(newObra);
    
    // Clear inputs
    setName('');
    setLocation('');
    setBudget(0);
    setDescription('');
    setStatus('active');
    setStartDate(new Date().toISOString().split('T')[0]);
    setOverheadAllocationType('auto');
    setOverrideOverheadPercent(0);
    setShowForm(false);
  };

  const handleOpenExportForObra = (obraId: string) => {
    setExportPreselectedId(obraId);
    setExportModalOpen(true);
  };

  const handleOpenExportAll = () => {
    setExportPreselectedId(null);
    setExportModalOpen(true);
  };

  const handleInternalImportComplete = (result: ProcessImportResult) => {
    if (onImportComplete) {
      onImportComplete(result);
    }
    setImportFeedback({
      msg: `¡Importación completada con éxito!`,
      details: `Se procesaron ${result.importedObrasCount} obras, ${result.importedDocsCount} documentos y ${result.importedPersonalCount} partes de personal.`
    });
    setTimeout(() => {
      setImportFeedback(null);
    }, 6000);
  };

  const filteredObras = obras.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" id="obras-manager-module">
      {/* Header with Title and Import/Export/Add Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4" id="obras-header">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight" id="obras-title">Proyectos de Obra</h2>
          <p className="text-xs text-white/50">
            Gestione carteras de construcción, presupuestos adjudicados, y comparta obras completas con otros compañeros de equipo.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto" id="obras-header-actions">
          {/* Import Button */}
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl border border-white/10 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:border-[#10B981]/40"
            id="btn-import-obra-package"
            title="Importar una obra o paquete compartido por un compañero"
          >
            <Upload className="w-4 h-4 text-[#10B981]" />
            <span>Importar Obra (.json)</span>
          </button>

          {/* Export Portfolio Button */}
          <button
            type="button"
            onClick={handleOpenExportAll}
            className="flex-1 sm:flex-initial bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl border border-white/10 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:border-[#10B981]/40"
            id="btn-export-all-obras"
            title="Exportar cartera de obras a archivo para compartir"
          >
            <Share2 className="w-4 h-4 text-[#10B981]" />
            <span>Exportar Cartera</span>
          </button>

          {/* Add Obra Button */}
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex-1 sm:flex-initial bg-[#10B981] hover:bg-[#10B981]/95 text-black font-extrabold py-2.5 px-4 rounded-xl shadow-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            id="btn-toggle-obra-form"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>Añadir Nueva Obra</span>
          </button>
        </div>
      </div>

      {/* Import Feedback Banner */}
      {importFeedback && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start justify-between gap-3 animate-fadeIn" id="import-feedback-alert">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs font-black text-white block">{importFeedback.msg}</strong>
              <span className="text-[11px] text-emerald-300/80">{importFeedback.details}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            className="text-white/40 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Adding Form Section */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#151515] rounded-2xl p-6 border border-white/5 shadow-lg grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn" id="obra-form">
          <div className="col-span-1 md:col-span-2 flex justify-between items-center border-b border-white/5 pb-3" id="form-header">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#10B981]" />
              Ingresar Nueva Ficha de Obra
            </h4>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-white/40 hover:text-white text-xs px-2 py-1 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div id="form-name-wrapper">
            <label className="block text-xs font-semibold text-white/60 mb-1">Nombre Técnico de la Obra *</label>
            <input
              type="text"
              required
              className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#10B981]"
              placeholder="Ej. Construcción Chalet Atlanterra"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div id="form-location-wrapper">
            <label className="block text-xs font-semibold text-white/60 mb-1">Ubicación / Municipio *</label>
            <input
              type="text"
              required
              className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#10B981]"
              placeholder="Ej. Zahara de los Atunes (Cádiz)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div id="form-budget-wrapper">
            <label className="block text-xs font-semibold text-white/60 mb-1">Presupuesto Ejecución Contratada (€) *</label>
            <input
              type="number"
              required
              min="0"
              className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] font-mono"
              placeholder="Ej. 180000"
              value={budget || ''}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </div>

          <div id="form-status-wrapper">
            <label className="block text-xs font-semibold text-white/60 mb-1">Estado de Ejecución</label>
            <select
              className="w-full bg-[#1E1E1E] rounded-lg border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10B981]"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="active">Activa / Ejecución Continua</option>
              <option value="on_hold">Paralizada de Forma Temporal</option>
              <option value="completed">Finalizada / Obra Entregada</option>
            </select>
          </div>

          <div id="form-date-wrapper">
            <label className="block text-xs font-semibold text-white/60 mb-1">Fecha de Firma de Acta de Replanteo</label>
            <input
              type="date"
              className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] font-mono"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div id="form-overhead-type-wrapper">
            <label className="block text-xs font-semibold text-white/60 mb-1">Reparto Gastos Estructurales</label>
            <select
              className="w-full bg-[#1E1E1E] rounded-lg border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10B981]"
              value={overheadAllocationType}
              onChange={(e) => setOverheadAllocationType(e.target.value as any)}
            >
              <option value="auto">Automático (Según Presupuestos)</option>
              <option value="custom">Porcentaje manual personalizado</option>
            </select>
          </div>

          <div id="form-overhead-percent-wrapper">
            <label className="block text-xs font-semibold text-white/60 mb-1">Porcentaje de Repercusión (%)</label>
            <input
              type="number"
              disabled={overheadAllocationType === 'auto'}
              min="0"
              max="100"
              step="0.1"
              required={overheadAllocationType === 'custom'}
              className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] font-mono disabled:opacity-45"
              placeholder={overheadAllocationType === 'auto' ? "Automático" : "Ej. 15"}
              value={overheadAllocationType === 'auto' ? '' : overrideOverheadPercent || ''}
              onChange={(e) => setOverrideOverheadPercent(Number(e.target.value) || 0)}
            />
          </div>

          <div className="col-span-1 md:col-span-2" id="form-desc-wrapper">
            <label className="block text-xs font-semibold text-white/60 mb-1">Descripción de Partidas Adjudicadas / Memoria técnica</label>
            <textarea
              className="w-full bg-white/5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] h-20 resize-none"
              placeholder="Ej. Proyecto de ejecución para vivienda pasiva, con estructura metálica y cimientos reforzados..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="col-span-1 md:col-span-2 flex justify-end gap-2 border-t border-white/5 pt-3" id="form-btn-actions">
            <button
              type="submit"
              className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold py-2 px-5 rounded-lg text-xs cursor-pointer shadow-md transition-all"
            >
              Guardar Obra
            </button>
          </div>
        </form>
      )}

      {/* Search Input */}
      <div className="relative" id="obras-search-box">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
        <input
          type="text"
          placeholder="Buscar obras por nombre, municipio o provincia..."
          className="w-full bg-white/5 rounded-xl border border-white/10 pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#10B981]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Obras Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="obras-cards-grid">
        {filteredObras.length === 0 ? (
          <div className="col-span-full bg-[#151515] rounded-2xl p-8 border border-white/5 text-center text-white/50 text-xs" id="obras-empty-state">
            <p>No se encontraron proyectos correspondientes al criterio.</p>
          </div>
        ) : (
          (() => {
            const overheadAllocationMap = getObraOverheadAllocationMap(obras, 100);
            return filteredObras.map(obra => {
              const allocInfo = overheadAllocationMap[obra.id] || { percent: 0, amount: 0 };
              const currentAssignedPercent = allocInfo.percent;

              // Compute stats for this obra
              const docsForObra = documentos.filter(d => d.obraId === obra.id);
              const persForObra = personal.filter(p => p.obraId === obra.id);
              const docsSum = docsForObra.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
              const persSum = persForObra.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
              const directCost = docsSum + persSum;
              const percentConsumed = obra.budget > 0 ? Math.min(100, (directCost / obra.budget) * 100) : 0;

              return (
                <div key={obra.id} className="bg-[#151515] rounded-2xl border border-white/5 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between" id={`card-obra-${obra.id}`}>
                  <div>
                    <div className="flex justify-between items-start mb-3" id={`card-obra-header-${obra.id}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        obra.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                        obra.status === 'on_hold' ? 'bg-amber-500/10 text-[#10B981]' : 'bg-white/10 text-white/60'
                      }`} id={`card-obra-badge-${obra.id}`}>
                        {obra.status === 'active' ? 'En ejecución' :
                         obra.status === 'on_hold' ? 'Paralizada' : 'Finalizada'}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {/* Quick Share / Export Button for this specific Obra */}
                        <button
                          type="button"
                          onClick={() => handleOpenExportForObra(obra.id)}
                          className="text-white/40 hover:text-[#10B981] p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                          title="Exportar y Compartir esta Obra (.json)"
                          id={`btn-export-single-obra-${obra.id}`}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        {/* Edit Obra Button */}
                        <button
                          type="button"
                          onClick={() => setEditingObraData({ ...obra })}
                          className="text-white/40 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                          title="Modificar datos de la Obra"
                          id={`btn-edit-obra-${obra.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {obras.length > 1 && (
                          <button
                            onClick={() => {
                              if (confirm(`¿Verdad que desea eliminar la obra "${obra.name}"? Los documentos quedarán huérfanos.`)) {
                                deleteObra(obra.id);
                              }
                            }}
                            className="text-white/30 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            title="Eliminar Obra"
                            id={`btn-del-obra-${obra.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-extrabold text-sm text-white leading-tight mb-1" id={`card-obra-name-${obra.id}`}>{obra.name}</h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-3" id={`card-obra-location-row-${obra.id}`}>
                      <MapPin className="w-3.5 h-3.5 text-white/40 shrink-0" />
                      <span>{obra.location}</span>
                    </div>

                    <p className="text-xs text-white/60 line-clamp-2 h-8 leading-normal mb-3" id={`card-obra-desc-${obra.id}`}>
                      {obra.description || 'Sin descripción detallada.'}
                    </p>

                    {/* Fast Project Metrics Bar */}
                    <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1.5 mb-3">
                      <div className="flex justify-between items-center text-[10px] text-white/50">
                        <span className="flex items-center gap-1">
                          <Receipt className="w-3 h-3 text-[#10B981]" />
                          {docsForObra.length} docs ({docsSum.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#10B981]" />
                          {persForObra.length} partes ({persSum.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)
                        </span>
                      </div>
                      
                      {/* Budget consumption progress bar */}
                      <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            percentConsumed > 90 ? 'bg-rose-500' :
                            percentConsumed > 75 ? 'bg-amber-500' : 'bg-[#10B981]'
                          }`}
                          style={{ width: `${percentConsumed}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono text-white/40">
                        <span>Gasto directo: {directCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</span>
                        <span>{percentConsumed.toFixed(1)}% ppto</span>
                      </div>
                    </div>

                    {/* Overhead allocation section */}
                    <div className="pt-2 border-t border-white/5 text-xs">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-white/50">Repercusión Gasto General:</span>
                        <span className="font-extrabold text-[#10B981] text-[11px] font-mono">
                          {currentAssignedPercent.toFixed(1)}% {obra.overheadAllocationType === 'custom' ? '(Fijo)' : '(Auto)'}
                        </span>
                      </div>

                      {configuringObraId === obra.id ? (
                        <div className="mt-3 space-y-2 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                          <div>
                            <label className="block text-[9px] font-bold text-white/50 uppercase tracking-wider mb-1">Método de Reparto</label>
                            <select
                              className="w-full bg-[#1A1A1A] rounded border border-white/10 px-2 py-1 text-[11px] text-white focus:outline-none"
                              value={editingAllocType}
                              onChange={(e) => {
                                const val = e.target.value as 'auto' | 'custom';
                                setEditingAllocType(val);
                              }}
                            >
                              <option value="auto">Automático proporcional</option>
                              <option value="custom">Porcentaje manual fijo (%)</option>
                            </select>
                          </div>

                          {editingAllocType === 'custom' && (
                            <div>
                              <label className="block text-[9px] font-bold text-white/50 uppercase tracking-wider mb-1">Porcentaje de Repercusión (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                className="w-full bg-white/5 rounded border border-white/10 px-2 py-1 text-[11px] text-white font-mono"
                                value={editingPercent}
                                onChange={(e) => setEditingPercent(Number(e.target.value) || 0)}
                              />
                            </div>
                          )}

                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setConfiguringObraId(null)}
                              className="text-white/40 hover:text-white px-2 py-1 text-[10px]"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateObra({
                                  ...obra,
                                  overheadAllocationType: editingAllocType,
                                  overrideOverheadPercent: editingAllocType === 'custom' ? editingPercent : undefined
                                });
                                setConfiguringObraId(null);
                              }}
                              className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold px-2.5 py-1 rounded text-[10px] cursor-pointer"
                            >
                              Aplicar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConfiguringObraId(obra.id);
                            setEditingAllocType(obra.overheadAllocationType || 'auto');
                            setEditingPercent(obra.overrideOverheadPercent || 0);
                          }}
                          className="mt-2 text-[#10B981] hover:text-[#10B981]/80 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Settings className="w-3 h-3 text-[#10B981]" />
                          Configurar Reparto Gasto Estructural
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3.5 mt-3" id={`card-obra-foot-${obra.id}`}>
                    <div className="flex justify-between items-center text-xs" id={`card-obra-details-${obra.id}`}>
                      <div>
                        <span className="text-[10px] text-white/40 block tracking-wide uppercase">Presupuesto inicial</span>
                        <span className="font-bold text-white/95 font-mono text-sm">
                          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(obra.budget)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-white/40 block tracking-wide uppercase">Alta replanteo</span>
                        <span className="font-medium text-white/60 font-mono">{obra.startDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>

      {/* Export Obra Modal */}
      <ExportObraModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        obras={obras}
        documentos={documentos}
        personal={personal}
        proveedores={proveedores}
        trabajadores={trabajadores}
        preselectedObraId={exportPreselectedId}
        userEmail={userEmail}
      />

      {/* Import Obra Modal */}
      <ImportObraModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        currentObras={obras}
        currentDocs={documentos}
        currentPersonal={personal}
        currentProveedores={proveedores}
        currentTrabajadores={trabajadores}
        onImportComplete={handleInternalImportComplete}
      />

      {/* Edit Obra Modal */}
      {editingObraData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151515] border border-white/10 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <span>Modificar Obra</span>
              </h3>
              <button
                onClick={() => setEditingObraData(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingObraData.name.trim() || !editingObraData.location.trim()) return;
                updateObra(editingObraData);
                setEditingObraData(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Nombre de la Obra</label>
                <input
                  type="text"
                  required
                  value={editingObraData.name}
                  onChange={(e) => setEditingObraData({ ...editingObraData, name: e.target.value })}
                  className="w-full bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">Ubicación / Dirección</label>
                  <input
                    type="text"
                    required
                    value={editingObraData.location}
                    onChange={(e) => setEditingObraData({ ...editingObraData, location: e.target.value })}
                    className="w-full bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">Presupuesto Ejecución (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={editingObraData.budget}
                    onChange={(e) => setEditingObraData({ ...editingObraData, budget: Number(e.target.value) || 0 })}
                    className="w-full bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">Estado de la Obra</label>
                  <select
                    value={editingObraData.status}
                    onChange={(e) => setEditingObraData({ ...editingObraData, status: e.target.value as any })}
                    className="w-full bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">En ejecución</option>
                    <option value="on_hold">Paralizada</option>
                    <option value="completed">Finalizada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={editingObraData.startDate}
                    onChange={(e) => setEditingObraData({ ...editingObraData, startDate: e.target.value })}
                    className="w-full bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1">Descripción / Notas</label>
                <textarea
                  rows={3}
                  value={editingObraData.description || ''}
                  onChange={(e) => setEditingObraData({ ...editingObraData, description: e.target.value })}
                  className="w-full bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingObraData(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
