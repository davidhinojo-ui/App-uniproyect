/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Obra, FacturaAlbaran, PersonalCost, Proveedor, TrabajadorPRL } from '../types';
import { 
  X, Download, Copy, Check, Share2, Building2, Receipt, Users, 
  HardHat, FileSpreadsheet, Cloud, ShieldCheck, CheckSquare, Square
} from 'lucide-react';
import { createObraPackage, downloadObraPackage, copyObraPackageToClipboard } from '../lib/obraExportImportService';
import { getAccessToken } from '../lib/googleAuth';
import { getOrCreateDriveFolderAtPath, uploadFileToFolder } from '../lib/googleDriveService';

interface ExportObraModalProps {
  isOpen: boolean;
  onClose: () => void;
  obras: Obra[];
  documentos: FacturaAlbaran[];
  personal: PersonalCost[];
  proveedores: Proveedor[];
  trabajadores: TrabajadorPRL[];
  preselectedObraId?: string | null;
  userEmail?: string | null;
}

export default function ExportObraModal({
  isOpen,
  onClose,
  obras,
  documentos,
  personal,
  proveedores,
  trabajadores,
  preselectedObraId,
  userEmail,
}: ExportObraModalProps) {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (preselectedObraId) return [preselectedObraId];
    return obras.map(o => o.id);
  });

  // Options
  const [includeDocs, setIncludeDocs] = useState(true);
  const [includePersonal, setIncludePersonal] = useState(true);
  const [includeProveedores, setIncludeProveedores] = useState(true);
  const [includeTrabajadores, setIncludeTrabajadores] = useState(true);

  // Status feedback
  const [copied, setCopied] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveResult, setDriveResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Sync preselectedObraId when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (preselectedObraId) {
        setSelectedIds([preselectedObraId]);
      } else if (selectedIds.length === 0) {
        setSelectedIds(obras.map(o => o.id));
      }
      setCopied(false);
      setDriveResult(null);
    }
  }, [isOpen, preselectedObraId]);

  const selectedObras = useMemo(() => {
    return obras.filter(o => selectedIds.includes(o.id));
  }, [obras, selectedIds]);

  const generatedPackage = useMemo(() => {
    if (selectedObras.length === 0) return null;
    return createObraPackage({
      selectedObras,
      allDocumentos: documentos,
      allPersonal: personal,
      allProveedores: proveedores,
      allTrabajadores: trabajadores,
      exportedBy: userEmail || 'Usuario UniProyect',
      includeDocs,
      includePersonal,
      includeProveedores,
      includeTrabajadores,
    });
  }, [selectedObras, documentos, personal, proveedores, trabajadores, userEmail, includeDocs, includePersonal, includeProveedores, includeTrabajadores]);

  if (!isOpen) return null;

  const handleToggleObra = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === obras.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(obras.map(o => o.id));
    }
  };

  const handleDownload = () => {
    if (!generatedPackage) return;
    downloadObraPackage(generatedPackage);
  };

  const handleCopy = async () => {
    if (!generatedPackage) return;
    const ok = await copyObraPackageToClipboard(generatedPackage);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSaveToDrive = async () => {
    if (!generatedPackage) return;
    setDriveSaving(true);
    setDriveResult(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setDriveResult({
          success: false,
          msg: 'Para sincronizar con Google Drive, active la cuenta en Configuración.',
        });
        setDriveSaving(false);
        return;
      }

      const folderId = await getOrCreateDriveFolderAtPath(token, [
        'UniProyect',
        'Consolidado',
        'Exportaciones de Obras'
      ]);

      const jsonContent = JSON.stringify(generatedPackage, null, 2);
      let filename = 'OBRAS_EXPORT_UNIPROYECT.obra.json';
      if (generatedPackage.packageType === 'single_obra' && generatedPackage.obra) {
        const cleanName = generatedPackage.obra.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
        filename = `OBRA_${cleanName}_${new Date().toISOString().split('T')[0]}.obra.json`;
      } else {
        filename = `PAQUETE_${selectedObras.length}_OBRAS_${new Date().toISOString().split('T')[0]}.obra.json`;
      }

      await uploadFileToFolder(token, folderId, filename, jsonContent, 'application/json');

      setDriveResult({
        success: true,
        msg: `Copia guardada en Google Drive: "/UniProyect/Consolidado/Exportaciones de Obras/${filename}"`,
      });
    } catch (err: any) {
      console.error('Error saving to Drive:', err);
      setDriveResult({
        success: false,
        msg: `Error al subir a Google Drive: ${err.message || 'Fallo de conexión'}`,
      });
    } finally {
      setDriveSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" id="export-obra-modal-backdrop">
      <div 
        className="bg-[#151518] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        id="export-obra-modal-panel"
      >
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-white/10 flex justify-between items-center bg-[#1A1A1E]">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                Exportar y Compartir Obras
                <span className="text-[10px] font-mono uppercase bg-[#10B981]/20 text-[#10B981] px-2 py-0.5 rounded-full font-bold">
                  Paquete .obra.json
                </span>
              </h3>
              <p className="text-xs text-white/50">
                Genera un archivo portátil para compartir obras, facturas y partes de personal con compañeros de equipo.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            id="btn-close-export-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 md:p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Obra Selector Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-extrabold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#10B981]" />
                Seleccionar Obras a Exportar ({selectedObras.length} de {obras.length})
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-[#10B981] hover:underline cursor-pointer flex items-center gap-1"
              >
                {selectedIds.length === obras.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1 bg-black/30 rounded-2xl border border-white/5">
              {obras.map(obra => {
                const isSelected = selectedIds.includes(obra.id);
                const docCount = documentos.filter(d => d.obraId === obra.id).length;
                const persCount = personal.filter(p => p.obraId === obra.id).length;

                return (
                  <div
                    key={obra.id}
                    onClick={() => handleToggleObra(obra.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected 
                        ? 'bg-[#10B981]/10 border-[#10B981]/40 text-white' 
                        : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5'
                    }`}
                  >
                    <div className="mt-0.5 text-[#10B981]">
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-white/30" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-xs text-white truncate">{obra.name}</div>
                      <div className="text-[10px] text-white/40 flex items-center gap-2 mt-0.5">
                        <span>Ppto: <strong className="font-mono text-white/60">{obra.budget.toLocaleString('es-ES')} €</strong></span>
                        <span>•</span>
                        <span>{docCount} docs</span>
                        <span>•</span>
                        <span>{persCount} partes</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scope Checkboxes */}
          <div className="space-y-3 bg-[#1A1A1E] p-4 rounded-2xl border border-white/5">
            <span className="text-xs font-extrabold text-white/70 block uppercase tracking-wider">
              Contenido Incluido en el Paquete
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 text-xs text-white/80 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={includeDocs}
                  onChange={(e) => setIncludeDocs(e.target.checked)}
                  className="rounded border-white/20 text-[#10B981] focus:ring-[#10B981] accent-[#10B981]"
                />
                <Receipt className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Facturas y Albaranes ({generatedPackage?.documentos.length || 0})</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-white/80 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={includePersonal}
                  onChange={(e) => setIncludePersonal(e.target.checked)}
                  className="rounded border-white/20 text-[#10B981] focus:ring-[#10B981] accent-[#10B981]"
                />
                <Users className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Partes de Mano de Obra ({generatedPackage?.personal.length || 0})</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-white/80 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={includeProveedores}
                  onChange={(e) => setIncludeProveedores(e.target.checked)}
                  className="rounded border-white/20 text-[#10B981] focus:ring-[#10B981] accent-[#10B981]"
                />
                <Building2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Fichas de Proveedores ({generatedPackage?.proveedores?.length || 0})</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-white/80 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={includeTrabajadores}
                  onChange={(e) => setIncludeTrabajadores(e.target.checked)}
                  className="rounded border-white/20 text-[#10B981] focus:ring-[#10B981] accent-[#10B981]"
                />
                <HardHat className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>Fichas de Trabajadores PRL ({generatedPackage?.trabajadores?.length || 0})</span>
              </label>
            </div>
          </div>

          {/* Package Summary Scorecard */}
          {generatedPackage && generatedPackage.summary && (
            <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#10B981] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Resumen del Paquete a Exportar
                </span>
                <span className="text-[10px] font-mono text-white/50">
                  Formato: JSON estándar v2.0
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/40 block">Obras</span>
                  <strong className="text-sm font-black font-mono text-white">{generatedPackage.summary.totalObras}</strong>
                </div>
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/40 block">Presupuesto</span>
                  <strong className="text-sm font-black font-mono text-white">
                    {generatedPackage.summary.totalBudget.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                  </strong>
                </div>
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/40 block">Documentos</span>
                  <strong className="text-sm font-black font-mono text-[#10B981]">
                    {generatedPackage.summary.totalDocumentosCount} ({generatedPackage.summary.totalDocumentosAmount.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)
                  </strong>
                </div>
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/40 block">Mano de Obra</span>
                  <strong className="text-sm font-black font-mono text-[#10B981]">
                    {generatedPackage.summary.totalPersonalCount} ({generatedPackage.summary.totalPersonalCost.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €)
                  </strong>
                </div>
              </div>

              <div className="text-[11px] text-white/50 flex items-center justify-between pt-1 border-t border-white/5">
                <span>Coste directo consolidado:</span>
                <strong className="font-mono text-sm text-white font-black">
                  {generatedPackage.summary.totalDirectCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </strong>
              </div>
            </div>
          )}

          {/* Drive status message */}
          {driveResult && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              driveResult.success 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {driveResult.msg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 md:p-6 border-t border-white/10 bg-[#1A1A1E] flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!generatedPackage}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer disabled:opacity-40"
              id="btn-copy-obra-json"
            >
              {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '¡Copiado al Portapapeles!' : 'Copiar Texto JSON'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveToDrive}
              disabled={!generatedPackage || driveSaving}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer disabled:opacity-40"
              title="Guardar copia en Google Drive"
              id="btn-drive-export-obra"
            >
              <Cloud className={`w-4 h-4 ${driveSaving ? 'animate-spin text-[#10B981]' : ''}`} />
              <span className="hidden md:inline">{driveSaving ? 'Guardando...' : 'Google Drive'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-white/60 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!generatedPackage}
              className="flex-1 sm:flex-initial bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#10B981]/20 transition-all cursor-pointer disabled:opacity-40"
              id="btn-download-obra-package"
            >
              <Download className="w-4 h-4 text-black" />
              <span>Descargar Archivo de Obra (.obra.json)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
