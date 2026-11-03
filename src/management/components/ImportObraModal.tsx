/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Obra, FacturaAlbaran, PersonalCost, Proveedor, TrabajadorPRL, ObraExportPackage } from '../types';
import { 
  X, Upload, FileCode, Check, AlertCircle, Building2, Receipt, 
  Users, HardHat, ShieldAlert, Sparkles, CheckSquare, Square, 
  ArrowRight, RefreshCw, Layers
} from 'lucide-react';
import { parseObraPackage, processImportObraPackage, ProcessImportResult } from '../lib/obraExportImportService';

interface ImportObraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentObras: Obra[];
  currentDocs: FacturaAlbaran[];
  currentPersonal: PersonalCost[];
  currentProveedores: Proveedor[];
  currentTrabajadores: TrabajadorPRL[];
  onImportComplete: (result: ProcessImportResult) => void;
}

export default function ImportObraModal({
  isOpen,
  onClose,
  currentObras,
  currentDocs,
  currentPersonal,
  currentProveedores,
  currentTrabajadores,
  onImportComplete,
}: ImportObraModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [parsedPkg, setParsedPkg] = useState<ObraExportPackage | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Selected obras to import from package
  const [selectedObraIds, setSelectedObraIds] = useState<string[]>([]);
  
  // Strategy: 'new_ids' | 'overwrite_existing' | 'merge_existing'
  const [importMode, setImportMode] = useState<'new_ids' | 'overwrite_existing' | 'merge_existing'>('new_ids');
  const [nameSuffix, setNameSuffix] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state on open/close
  React.useEffect(() => {
    if (isOpen) {
      setParsedPkg(null);
      setParseError(null);
      setPastedText('');
      setFileName(null);
      setSelectedObraIds([]);
      setImportMode('new_ids');
      setNameSuffix('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = parseObraPackage(content);
      if (result.valid && result.package) {
        setParsedPkg(result.package);
        const ids = (result.package.obras || []).map(o => o.id);
        setSelectedObraIds(ids);
        setParseError(null);
      } else {
        setParsedPkg(null);
        setParseError(result.error || 'No se pudo procesar el archivo seleccionado.');
      }
    };
    reader.onerror = () => {
      setParseError('Error de lectura del archivo en el navegador.');
    };
    reader.readAsText(file);
  };

  const handleProcessPastedText = () => {
    if (!pastedText.trim()) return;
    setParseError(null);
    const result = parseObraPackage(pastedText);
    if (result.valid && result.package) {
      setParsedPkg(result.package);
      const ids = (result.package.obras || []).map(o => o.id);
      setSelectedObraIds(ids);
      setParseError(null);
    } else {
      setParsedPkg(null);
      setParseError(result.error || 'El texto pegado no es un JSON válido o no contiene una estructura de obra reconocida.');
    }
  };

  const handleToggleSelectObra = (id: string) => {
    if (selectedObraIds.includes(id)) {
      setSelectedObraIds(selectedObraIds.filter(i => i !== id));
    } else {
      setSelectedObraIds([...selectedObraIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (!parsedPkg || !parsedPkg.obras) return;
    if (selectedObraIds.length === parsedPkg.obras.length) {
      setSelectedObraIds([]);
    } else {
      setSelectedObraIds(parsedPkg.obras.map(o => o.id));
    }
  };

  const handleExecuteImport = () => {
    if (!parsedPkg || selectedObraIds.length === 0) return;
    setIsProcessing(true);

    try {
      const result = processImportObraPackage({
        pkg: parsedPkg,
        mode: importMode,
        currentObras,
        currentDocs,
        currentPersonal,
        currentProveedores,
        currentTrabajadores,
        selectedObraIdsToImport: selectedObraIds,
        nameSuffix,
      });

      onImportComplete(result);
      onClose();
    } catch (err: any) {
      console.error('Import execution error:', err);
      setParseError(`Error durante la importación: ${err.message || 'Fallo inesperado'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if any selected obra conflicts with an existing obra
  const existingNames = new Set(currentObras.map(o => o.name.trim().toLowerCase()));
  const existingIds = new Set(currentObras.map(o => o.id));

  const hasConflicts = parsedPkg?.obras?.some(o => 
    selectedObraIds.includes(o.id) && (existingNames.has(o.name.trim().toLowerCase()) || existingIds.has(o.id))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" id="import-obra-modal-backdrop">
      <div 
        className="bg-[#151518] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        id="import-obra-modal-panel"
      >
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-white/10 flex justify-between items-center bg-[#1A1A1E]">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                Importar Obra de un Compañero
                <span className="text-[10px] font-mono uppercase bg-[#10B981]/20 text-[#10B981] px-2 py-0.5 rounded-full font-bold">
                  JSON / .obra
                </span>
              </h3>
              <p className="text-xs text-white/50">
                Carga un archivo de obra compartido para incorporar proyectos, facturas y mano de obra a tu panel.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            id="btn-close-import-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 md:p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* STEP 1: Input source if no package is loaded yet */}
          {!parsedPkg ? (
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'file' 
                      ? 'bg-[#10B981] text-black font-extrabold shadow' 
                      : 'text-white/60 hover:text-white'
                  }`}
                  id="tab-import-file"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir Archivo (.json / .obra)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'text' 
                      ? 'bg-[#10B981] text-black font-extrabold shadow' 
                      : 'text-white/60 hover:text-white'
                  }`}
                  id="tab-import-text"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Pegar Código JSON</span>
                </button>
              </div>

              {/* Tab 1: File Dropzone */}
              {activeTab === 'file' && (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-[#10B981]/60 rounded-3xl p-8 md:p-12 text-center bg-white/[0.01] hover:bg-[#10B981]/[0.02] transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group"
                  id="import-dropzone"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.obra,.obra.json,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                    id="input-file-obra-import"
                  />
                  <div className="p-4 rounded-2xl bg-white/5 text-white/50 group-hover:text-[#10B981] group-hover:bg-[#10B981]/10 transition-colors">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">
                      Arrastre aquí el archivo o haga clic para examinar
                    </h4>
                    <p className="text-xs text-white/40 mt-1">
                      Archivos compatibles: <span className="font-mono text-white/60">.obra.json, .json, .obra</span>
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-3 py-1 bg-white/5 text-white/50 rounded-full border border-white/5">
                    Máximo 50 MB
                  </span>
                </div>
              )}

              {/* Tab 2: Textarea */}
              {activeTab === 'text' && (
                <div className="space-y-3">
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder='Pegue aquí el contenido JSON compartido por su compañero (ej: {"app": "UniProyect", "obras": [...]})'
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:border-[#10B981] resize-none"
                    id="textarea-pasted-json"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleProcessPastedText}
                      disabled={!pastedText.trim()}
                      className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold px-5 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-40"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      <span>Analizar y Previsualizar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Pre-Import Inspection & Options */
            <div className="space-y-6">
              {/* File Info Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-[#10B981]/10 border border-[#10B981]/20 p-3.5 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#10B981]/20 text-[#10B981]">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-white block">
                      Paquete detectado correctamente {fileName ? `(${fileName})` : ''}
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">
                      Exportado el: {new Date(parsedPkg.exportDate).toLocaleDateString('es-ES')} por {parsedPkg.exportedBy || 'Compañero'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setParsedPkg(null)}
                  className="text-[11px] text-[#10B981] hover:underline font-bold cursor-pointer"
                >
                  Cambiar archivo
                </button>
              </div>

              {/* Obra Selection List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#10B981]" />
                    Obras Incluidas en el Paquete ({selectedObraIds.length} seleccionadas)
                  </label>
                  {parsedPkg.obras && parsedPkg.obras.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[11px] font-bold text-[#10B981] hover:underline cursor-pointer"
                    >
                      {selectedObraIds.length === parsedPkg.obras.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto p-1 bg-black/30 rounded-2xl border border-white/5">
                  {parsedPkg.obras?.map(obra => {
                    const isSelected = selectedObraIds.includes(obra.id);
                    const docCount = (parsedPkg.documentos || []).filter(d => d.obraId === obra.id).length;
                    const persCount = (parsedPkg.personal || []).filter(p => p.obraId === obra.id).length;
                    const docSum = (parsedPkg.documentos || []).filter(d => d.obraId === obra.id).reduce((s, d) => s + d.totalAmount, 0);
                    const persSum = (parsedPkg.personal || []).filter(p => p.obraId === obra.id).reduce((s, p) => s + p.totalCost, 0);

                    const nameConflict = existingNames.has(obra.name.trim().toLowerCase());
                    const idConflict = existingIds.has(obra.id);

                    return (
                      <div
                        key={obra.id}
                        onClick={() => handleToggleSelectObra(obra.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected 
                            ? 'bg-[#10B981]/10 border-[#10B981]/40 text-white' 
                            : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5'
                        }`}
                      >
                        <div className="mt-0.5 text-[#10B981]">
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-white/30" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-white truncate">{obra.name}</span>
                            {(nameConflict || idConflict) && (
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">
                                Ya existe en tu sistema
                              </span>
                            )}
                          </div>
                          
                          <div className="text-[11px] text-white/50 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-mono">
                            <span>Ubicación: <strong className="text-white/70 font-sans">{obra.location}</strong></span>
                            <span>•</span>
                            <span>Ppto: <strong className="text-white/70">{obra.budget.toLocaleString('es-ES')} €</strong></span>
                            <span>•</span>
                            <span>{docCount} facturas ({docSum.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)</span>
                            <span>•</span>
                            <span>{persCount} partes ({persSum.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Global Package Metrics */}
              {parsedPkg.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-white/[0.02] p-3.5 rounded-2xl border border-white/5">
                  <div>
                    <span className="text-[10px] text-white/40 block">Total Facturas</span>
                    <strong className="text-xs font-mono font-bold text-white">
                      {parsedPkg.summary.totalDocumentosCount} ({parsedPkg.summary.totalDocumentosAmount.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 block">Partes Personal</span>
                    <strong className="text-xs font-mono font-bold text-white">
                      {parsedPkg.summary.totalPersonalCount} ({parsedPkg.summary.totalPersonalCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 block">Proveedores</span>
                    <strong className="text-xs font-mono font-bold text-white">
                      {parsedPkg.proveedores?.length || 0} vinculados
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 block">Trabajadores PRL</span>
                    <strong className="text-xs font-mono font-bold text-white">
                      {parsedPkg.trabajadores?.length || 0} registrados
                    </strong>
                  </div>
                </div>
              )}

              {/* STEP 3: Import Strategy & Conflict Resolution */}
              <div className="space-y-3 bg-[#1A1A1E] p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white/80 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#10B981]" />
                    Estrategia de Importación
                  </span>
                  {hasConflicts && (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Se detectaron coincidencias de nombres/IDs
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Mode 1: New IDs */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    importMode === 'new_ids' 
                      ? 'bg-[#10B981]/10 border-[#10B981]/40' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'new_ids'}
                      onChange={() => setImportMode('new_ids')}
                      className="mt-1 text-[#10B981] focus:ring-[#10B981] accent-[#10B981]"
                    />
                    <div>
                      <strong className="text-xs text-white font-extrabold block">
                        🆕 Crear como Nuevas Obras (Recomendado)
                      </strong>
                      <p className="text-[11px] text-white/50 mt-0.5">
                        Genera nuevos identificadores únicos para la obra, facturas y partes. No sobreescribe ni altera ningún proyecto existente.
                      </p>
                    </div>
                  </label>

                  {/* Mode 2: Overwrite */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    importMode === 'overwrite_existing' 
                      ? 'bg-amber-500/10 border-amber-500/40' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'overwrite_existing'}
                      onChange={() => setImportMode('overwrite_existing')}
                      className="mt-1 text-amber-400 focus:ring-amber-400 accent-amber-400"
                    />
                    <div>
                      <strong className="text-xs text-amber-400 font-extrabold block">
                        🔄 Sobreescribir / Reemplazar Obra Coincidente
                      </strong>
                      <p className="text-[11px] text-white/50 mt-0.5">
                        Si ya tienes una obra con el mismo nombre o ID, actualizará su presupuesto y reemplazará sus documentos por los del archivo.
                      </p>
                    </div>
                  </label>

                  {/* Mode 3: Merge */}
                  <label className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    importMode === 'merge_existing' 
                      ? 'bg-blue-500/10 border-blue-500/40' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                  }`}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge_existing'}
                      onChange={() => setImportMode('merge_existing')}
                      className="mt-1 text-blue-400 focus:ring-blue-400 accent-blue-400"
                    />
                    <div>
                      <strong className="text-xs text-blue-400 font-extrabold block">
                        🔀 Fusionar e Incorporar Novedades (Merge)
                      </strong>
                      <p className="text-[11px] text-white/50 mt-0.5">
                        Conserva todos los documentos y partes existentes en tu obra, y añade solo los nuevos registros que falten sin duplicar.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Suffix input if creating as new */}
                {importMode === 'new_ids' && hasConflicts && (
                  <div className="pt-2">
                    <label className="block text-[11px] text-white/60 mb-1">
                      Sufijo distintivo para la nueva obra (opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. (Compartida por Juan)"
                      value={nameSuffix}
                      onChange={(e) => setNameSuffix(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {parseError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 md:p-6 border-t border-white/10 bg-[#1A1A1E] flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-white/60 hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {parsedPkg && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={selectedObraIds.length === 0 || isProcessing}
              className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#10B981]/20 transition-all cursor-pointer disabled:opacity-40"
              id="btn-confirm-import-obra"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Check className="w-4 h-4 text-black" />
              )}
              <span>
                {isProcessing 
                  ? 'Importando registros...' 
                  : `Importar ${selectedObraIds.length} ${selectedObraIds.length === 1 ? 'Obra' : 'Obras'} al Sistema`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
