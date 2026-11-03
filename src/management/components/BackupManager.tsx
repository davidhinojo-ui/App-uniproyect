/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Cloud, 
  Download, 
  Upload, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  FileText, 
  HardDrive, 
  Copy, 
  Check, 
  ExternalLink, 
  Loader2, 
  Layers, 
  Users, 
  Building2, 
  Receipt, 
  FileSpreadsheet,
  Calendar,
  Sparkles,
  ArrowDownCircle,
  Clock,
  Briefcase,
  UserCheck
} from 'lucide-react';
import { Obra, FacturaAlbaran, PersonalCost, OtrosGasto, Proveedor, TrabajadorPRL, TrabajadorEmpresa } from '../types';
import { 
  generateGlobalBackup, 
  downloadBackupFile, 
  validateBackupPayload, 
  applyBackupRestore, 
  GlobalAppBackup,
  BackupValidationResult 
} from '../lib/backupService';
import { 
  upsertMasterBackupFile, 
  downloadMasterBackupFromDrive,
  MASTER_DRIVE_BACKUP_FILENAME,
  MASTER_DRIVE_BACKUP_FOLDER
} from '../lib/googleDriveService';
import { getAccessToken, googleSignIn } from '../lib/googleAuth';

interface BackupManagerProps {
  obras: Obra[];
  documentos: FacturaAlbaran[];
  personal: PersonalCost[];
  gastosGenerales: OtrosGasto[];
  proveedores: Proveedor[];
  trabajadores: TrabajadorPRL[];
  trabajadoresEmpresa?: TrabajadorEmpresa[];
  onRestoreComplete: (
    newObras: Obra[],
    newDocs: FacturaAlbaran[],
    newPersonal: PersonalCost[],
    newGastos: OtrosGasto[],
    newProveedores: Proveedor[],
    newTrabajadores: TrabajadorPRL[],
    newTrabajadoresEmpresa: TrabajadorEmpresa[],
    message: string
  ) => void;
  userEmail?: string | null;
  lastDriveSyncTime?: string | null;
  driveSyncStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onManualDriveSync?: () => Promise<void>;
}

export default function BackupManager({
  obras,
  documentos,
  personal,
  gastosGenerales,
  proveedores,
  trabajadores,
  trabajadoresEmpresa = [],
  onRestoreComplete,
  userEmail,
  lastDriveSyncTime,
  driveSyncStatus = 'idle',
  onManualDriveSync
}: BackupManagerProps) {
  // Local states
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [isLoadingFromDrive, setIsLoadingFromDrive] = useState(false);
  const [driveSuccessMsg, setDriveSuccessMsg] = useState<string | null>(null);
  const [driveErrorMsg, setDriveErrorMsg] = useState<string | null>(null);
  const [driveBackupMeta, setDriveBackupMeta] = useState<{
    fileId?: string;
    webViewLink?: string;
    updatedTime?: string;
    sizeBytes?: number;
  } | null>(() => {
    const saved = localStorage.getItem('up_last_drive_backup_meta');
    return saved ? JSON.parse(saved) : null;
  });

  // Import State
  const [importTab, setImportTab] = useState<'file' | 'text'>('file');
  const [pastedJson, setPastedJson] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessBanner, setRestoreSuccessBanner] = useState<string | null>(null);

  // Cloud Restore Preview Modal State
  const [driveCloudBackup, setDriveCloudBackup] = useState<{
    backup: GlobalAppBackup;
    meta: {
      fileId: string;
      name: string;
      updatedTime: string;
      webViewLink: string;
      sizeBytes?: number;
    };
  } | null>(null);
  const [showDriveRestoreModal, setShowDriveRestoreModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Calculated Totals
  const totalDocsAmount = documentos.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
  const totalPersonalAmount = personal.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
  const totalGastosGeneralesAmount = gastosGenerales.reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  const totalExpensesSum = totalDocsAmount + totalPersonalAmount + totalGastosGeneralesAmount;
  const totalRecordsCount = obras.length + documentos.length + personal.length + gastosGenerales.length + proveedores.length + trabajadores.length + (trabajadoresEmpresa || []).length;

  // Handle Local Export File
  const handleExportJson = () => {
    setIsExporting(true);
    try {
      const backup = generateGlobalBackup(
        obras,
        documentos,
        personal,
        gastosGenerales,
        proveedores,
        trabajadores,
        userEmail,
        trabajadoresEmpresa
      );
      downloadBackupFile(backup);
    } catch (err) {
      console.error('Error al exportar copia local:', err);
      alert('Hubo un error al generar el archivo de copia de seguridad.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy to Clipboard
  const handleCopyClipboard = async () => {
    try {
      const backup = generateGlobalBackup(
        obras,
        documentos,
        personal,
        gastosGenerales,
        proveedores,
        trabajadores,
        userEmail,
        trabajadoresEmpresa
      );
      await navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
      alert('No se pudo copiar al portapapeles.');
    }
  };

  // Handle Manual Save / Overwrite to Google Drive
  const handleSaveToGoogleDrive = async () => {
    if (onManualDriveSync) {
      setIsSavingToDrive(true);
      setDriveSuccessMsg(null);
      setDriveErrorMsg(null);
      try {
        await onManualDriveSync();
        setDriveSuccessMsg('✅ Copia maestra guardada y sobrescrita en Google Drive con éxito.');
        setTimeout(() => setDriveSuccessMsg(null), 5000);
      } catch (err: any) {
        setDriveErrorMsg(`Error: ${err?.message || 'No se pudo guardar en Drive'}`);
      } finally {
        setIsSavingToDrive(false);
      }
      return;
    }

    setIsSavingToDrive(true);
    setDriveSuccessMsg(null);
    setDriveErrorMsg(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (!authRes?.accessToken) {
          throw new Error('Se requiere iniciar sesión en Google para guardar en Drive.');
        }
        token = authRes.accessToken;
      }

      const backup = generateGlobalBackup(
        obras,
        documentos,
        personal,
        gastosGenerales,
        proveedores,
        trabajadores,
        userEmail,
        trabajadoresEmpresa
      );

      const result = await upsertMasterBackupFile(token, backup);
      const meta = {
        fileId: result.fileId,
        webViewLink: result.webViewLink,
        updatedTime: result.updatedTime,
        sizeBytes: result.sizeBytes,
      };
      setDriveBackupMeta(meta);
      localStorage.setItem('up_last_drive_backup_meta', JSON.stringify(meta));
      setDriveSuccessMsg(`✅ Copia maestra en Google Drive ${result.isNew ? 'creada' : 'sobrescrita y actualizada'} correctamente.`);
      setTimeout(() => setDriveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Error guardando en Drive:', err);
      setDriveErrorMsg(err?.message || 'Error al conectar con Google Drive.');
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // Handle Fetch Master Backup from Drive for Restoration
  const handleFetchFromGoogleDrive = async () => {
    setIsLoadingFromDrive(true);
    setDriveErrorMsg(null);

    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        if (!authRes?.accessToken) {
          throw new Error('Inicie sesión en Google para acceder a su copia de Drive.');
        }
        token = authRes.accessToken;
      }

      const driveResult = await downloadMasterBackupFromDrive(token);
      if (!driveResult) {
        throw new Error(`No se encontró el archivo maestro "${MASTER_DRIVE_BACKUP_FILENAME}" en Google Drive.`);
      }

      const validation = validateBackupPayload(driveResult.data);
      if (!validation.isValid || !validation.backup) {
        throw new Error(validation.error || 'La copia encontrada en Drive no tiene un formato válido.');
      }

      setDriveCloudBackup({
        backup: validation.backup,
        meta: {
          fileId: driveResult.fileId,
          name: driveResult.name,
          updatedTime: driveResult.updatedTime,
          webViewLink: driveResult.webViewLink,
          sizeBytes: driveResult.sizeBytes,
        },
      });
      setShowDriveRestoreModal(true);
    } catch (err: any) {
      console.error('Error recuperando copia de Drive:', err);
      setDriveErrorMsg(err?.message || 'Error al descargar la copia de Google Drive.');
    } finally {
      setIsLoadingFromDrive(false);
    }
  };

  // Process and inspect incoming local file
  const processSelectedFile = (file: File) => {
    setSelectedFile(file);
    setIsValidating(true);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = validateBackupPayload(text);
      setValidationResult(res);
      setIsValidating(false);
    };
    reader.onerror = () => {
      setValidationResult({ isValid: false, error: 'Error al leer el archivo seleccionado.' });
      setIsValidating(false);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Process and inspect incoming pasted JSON
  const handlePasteChange = (text: string) => {
    setPastedJson(text);
    if (!text.trim()) {
      setValidationResult(null);
      return;
    }
    setIsValidating(true);
    const res = validateBackupPayload(text);
    setValidationResult(res);
    setIsValidating(false);
  };

  // Execute Local File/Text Restore
  const handleExecuteRestore = () => {
    if (!validationResult?.backup) return;
    setIsRestoring(true);

    try {
      const {
        restoredObras,
        restoredDocs,
        restoredPersonal,
        restoredGastos,
        restoredProveedores,
        restoredTrabajadores,
        restoredTrabajadoresEmpresa,
        addedObrasCount,
        addedDocsCount,
        addedPersonalCount,
        addedGastosCount,
      } = applyBackupRestore(validationResult.backup, restoreMode, {
        obras,
        documentos,
        personal,
        gastosGenerales,
        proveedores,
        trabajadores,
        trabajadoresEmpresa,
      });

      const message = restoreMode === 'replace'
        ? `Copia restaurada por sustitución completa: ${restoredObras.length} obras, ${restoredDocs.length} facturas/albaranes, ${restoredPersonal.length} partes de personal, ${restoredGastos.length} gastos de empresa, ${restoredProveedores.length} proveedores, ${restoredTrabajadores.length} operarios PRL y ${restoredTrabajadoresEmpresa.length} plantilla interna.`
        : `Fusión completada: Se incorporaron ${addedObrasCount} obras, ${addedDocsCount} documentos, ${addedPersonalCount} partes, ${addedGastosCount} gastos y novedades en proveedores/personal.`;

      onRestoreComplete(
        restoredObras,
        restoredDocs,
        restoredPersonal,
        restoredGastos,
        restoredProveedores,
        restoredTrabajadores,
        restoredTrabajadoresEmpresa || trabajadoresEmpresa,
        message
      );

      setShowConfirmModal(false);
      setValidationResult(null);
      setSelectedFile(null);
      setPastedJson('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      setRestoreSuccessBanner(`🎉 ¡Restauración ejecutada con éxito! ${message}`);
      setTimeout(() => setRestoreSuccessBanner(null), 8000);
    } catch (err: any) {
      console.error('Error durante la restauración:', err);
      alert(`Fallo en la restauración: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  // Execute Direct Cloud Drive Restore
  const handleExecuteDriveRestore = () => {
    if (!driveCloudBackup?.backup) return;
    setIsRestoring(true);

    try {
      const {
        restoredObras,
        restoredDocs,
        restoredPersonal,
        restoredGastos,
        restoredProveedores,
        restoredTrabajadores,
        restoredTrabajadoresEmpresa,
      } = applyBackupRestore(driveCloudBackup.backup, 'replace', {
        obras,
        documentos,
        personal,
        gastosGenerales,
        proveedores,
        trabajadores,
        trabajadoresEmpresa,
      });

      const message = `Restauración completa desde Google Drive aplicada con éxito: ${restoredObras.length} obras, ${restoredDocs.length} documentos y ${restoredPersonal.length} partes.`;

      onRestoreComplete(
        restoredObras,
        restoredDocs,
        restoredPersonal,
        restoredGastos,
        restoredProveedores,
        restoredTrabajadores,
        restoredTrabajadoresEmpresa || trabajadoresEmpresa,
        message
      );

      setShowDriveRestoreModal(false);
      setDriveCloudBackup(null);

      setRestoreSuccessBanner(`🎉 ¡Datos recuperados desde Google Drive! ${message}`);
      setTimeout(() => setRestoreSuccessBanner(null), 8000);
    } catch (err: any) {
      console.error('Error restaurando desde Google Drive:', err);
      alert(`Fallo al restaurar copia de Drive: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const formattedLastSync = lastDriveSyncTime || driveBackupMeta?.updatedTime
    ? new Date(lastDriveSyncTime || driveBackupMeta?.updatedTime || '').toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    : null;

  return (
    <div className="space-y-6 animate-fadeIn font-sans" id="backup-manager-container">
      
      {/* 1. Header & Title Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#151515] p-6 rounded-3xl border border-white/5 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#10B981] text-[11px] font-extrabold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            Protección y Respaldo Continuo
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Copias de Seguridad
          </h2>
          <p className="text-xs text-white/50 max-w-2xl leading-relaxed">
            Exporte copias completas en JSON, restaure datos ante pérdidas imprevistas y mantenga una copia maestra actualizada automáticamente en Google Drive.
          </p>
        </div>

        {/* Quick Summary Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-right">
            <span className="text-[10px] uppercase tracking-wider text-white/40 block font-bold">Total Gastos Auditados</span>
            <span className="text-sm sm:text-base font-black text-emerald-400 font-mono block">
              {totalExpensesSum.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-right">
            <span className="text-[10px] uppercase tracking-wider text-white/40 block font-bold">Total Registros</span>
            <span className="text-sm sm:text-base font-black text-white font-mono block">
              {totalRecordsCount} items
            </span>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {restoreSuccessBanner && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-5 py-4 rounded-2xl flex items-start justify-between gap-3 animate-slideDown shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold leading-relaxed">{restoreSuccessBanner}</span>
          </div>
          <button
            onClick={() => setRestoreSuccessBanner(null)}
            className="text-emerald-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Main 2-Column Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CARD A: GOOGLE DRIVE AUTO-BACKUP & MASTER FILE */}
        <div className="bg-[#151515] rounded-3xl p-6 border border-white/5 shadow-sm flex flex-col justify-between space-y-6 relative overflow-hidden">
          
          {/* Subtle Ambient Background Accent */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">Google Drive en la Nube</h3>
                  <p className="text-[11px] text-white/40">Copia continua de archivo único pisándose en Drive</p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                {driveSyncStatus === 'saving' || isSavingToDrive ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Sincronizado</span>
                  </>
                )}
              </div>
            </div>

            {/* Explanation box */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Modo Sobrescribir (Archivo Único Maestro):</span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Cada modificación de gastos, obras o personal se guarda y sobrescribe en el archivo maestro <code className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">{MASTER_DRIVE_BACKUP_FILENAME}</code> dentro de la carpeta <code className="text-white/80 bg-white/5 px-1.5 py-0.5 rounded font-mono text-[10px]">{MASTER_DRIVE_BACKUP_FOLDER}</code>.
              </p>
            </div>

            {/* File & Timestamp Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase tracking-wider block font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  Última Actualización
                </span>
                <span className="font-mono font-bold text-white/90 block mt-1">
                  {formattedLastSync || 'Guardado automáticamente al detectar cambios'}
                </span>
              </div>

              <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase tracking-wider block font-bold flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-amber-400" />
                  Destino en Drive
                </span>
                <span className="font-mono font-bold text-white/90 block mt-1 truncate" title={`${MASTER_DRIVE_BACKUP_FOLDER}/${MASTER_DRIVE_BACKUP_FILENAME}`}>
                  📁 {MASTER_DRIVE_BACKUP_FOLDER}
                </span>
              </div>
            </div>

            {driveSuccessMsg && (
              <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{driveSuccessMsg}</span>
              </div>
            )}

            {driveErrorMsg && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{driveErrorMsg}</span>
              </div>
            )}
          </div>

          {/* Drive Action Buttons */}
          <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveToGoogleDrive}
              disabled={isSavingToDrive}
              className="flex-1 bg-[#10B981] hover:bg-[#10B981]/90 disabled:bg-zinc-800 disabled:text-white/30 text-black font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
              id="btn-sync-drive-now"
            >
              {isSavingToDrive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Guardando en Drive...</span>
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4 text-black" />
                  <span>Guardar Copia en Drive Ahora</span>
                </>
              )}
            </button>

            <button
              onClick={handleFetchFromGoogleDrive}
              disabled={isLoadingFromDrive}
              className="flex-1 bg-white/5 hover:bg-white/10 disabled:bg-zinc-900 border border-white/10 hover:border-white/20 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              id="btn-restore-from-drive"
              title="Descargar y restaurar el archivo maestro desde Google Drive en caso de pérdida de datos"
            >
              {isLoadingFromDrive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Cargando de Drive...</span>
                </>
              ) : (
                <>
                  <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                  <span>Restaurar desde Google Drive</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* CARD B: LOCAL EXPORT OF COMPREHENSIVE BACKUP */}
        <div className="bg-[#151515] rounded-3xl p-6 border border-white/5 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white">Exportación de Copia Local</h3>
                <p className="text-[11px] text-white/40">Descargue el archivo de seguridad en su equipo o copie el JSON</p>
              </div>
            </div>

            {/* Breakdown of collections included in the export */}
            <div className="space-y-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-extrabold block">
                Contenido Incluido en el Paquete de Respaldo:
              </span>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-xl flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block text-white font-mono text-xs">{obras.length}</strong>
                    <span className="text-[10px] text-white/40">Obras</span>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-xl flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <strong className="block text-white font-mono text-xs">{documentos.length}</strong>
                    <span className="text-[10px] text-white/40">Docs / Facturas</span>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-xl flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <strong className="block text-white font-mono text-xs">{personal.length}</strong>
                    <span className="text-[10px] text-white/40">Partes Personal</span>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-xl flex items-center gap-2">
                  <Layers className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <strong className="block text-white font-mono text-xs">{gastosGenerales.length}</strong>
                    <span className="text-[10px] text-white/40">Gastos Empresa</span>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-xl flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <strong className="block text-white font-mono text-xs">{proveedores.length}</strong>
                    <span className="text-[10px] text-white/40">Proveedores</span>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-xl flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                  <div>
                    <strong className="block text-white font-mono text-xs">{trabajadores.length}</strong>
                    <span className="text-[10px] text-white/40">Operarios PRL</span>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-2.5 rounded-xl flex items-center gap-2 col-span-2 sm:col-span-1">
                  <Briefcase className="w-4 h-4 text-violet-400 shrink-0" />
                  <div>
                    <strong className="block text-white font-mono text-xs">{(trabajadoresEmpresa || []).length}</strong>
                    <span className="text-[10px] text-white/40">Plantilla Empresa</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-white/50 leading-relaxed">
              El archivo generado contiene la totalidad de los datos estructurados, importes, líneas de albaranes, cheques PRL e información contable de la empresa.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportJson}
              disabled={isExporting}
              className="flex-1 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-black font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all duration-200 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              id="btn-download-backup-json"
            >
              <Download className="w-4 h-4 text-black" />
              <span>Descargar Archivo (.json)</span>
            </button>

            <button
              onClick={handleCopyClipboard}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
              id="btn-copy-backup-json"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white/70" />
                  <span>Copiar JSON</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* 3. IMPORT & RESTORE BACKUP PANEL */}
      <div className="bg-[#151515] rounded-3xl p-6 sm:p-8 border border-white/5 shadow-sm space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">Importar y Restaurar Copia de Seguridad</h3>
              <p className="text-xs text-white/50">Cargue un archivo .json o pegue el contenido para restaurar sus datos</p>
            </div>
          </div>

          {/* Import Method Tabs */}
          <div className="flex bg-zinc-900 p-1 rounded-xl border border-white/5 shrink-0">
            <button
              onClick={() => setImportTab('file')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                importTab === 'file' ? 'bg-[#10B981] text-black font-extrabold shadow-sm' : 'text-white/50 hover:text-white'
              }`}
            >
              📁 Archivo .JSON
            </button>
            <button
              onClick={() => setImportTab('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                importTab === 'text' ? 'bg-[#10B981] text-black font-extrabold shadow-sm' : 'text-white/50 hover:text-white'
              }`}
            >
              📋 Pegar Código
            </button>
          </div>
        </div>

        {/* Form Inputs based on selected tab */}
        {importTab === 'file' ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                processSelectedFile(file);
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                : 'border-white/10 hover:border-emerald-500/50 bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isDragging ? 'bg-emerald-400 text-black scale-110' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <strong className="text-sm font-bold text-white block">
                {selectedFile ? selectedFile.name : (isDragging ? '¡Suelte el archivo JSON aquí!' : 'Haga clic o arrastre aquí su archivo de copia (.json)')}
              </strong>
              <p className="text-[11px] text-white/40">
                {selectedFile ? `Tamaño: ${(selectedFile.size / 1024).toFixed(1)} KB` : 'Archivos con formato JSON válidos de Uniproyect'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/70 block">Pegue el contenido JSON de la copia de seguridad:</label>
            <textarea
              value={pastedJson}
              onChange={(e) => handlePasteChange(e.target.value)}
              placeholder="Pegue aquí el texto JSON exportado..."
              rows={5}
              className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 rounded-2xl p-4 text-xs font-mono text-white placeholder-white/20 focus:outline-none"
            />
          </div>
        )}

        {/* Validation Feedback & Preview */}
        {isValidating && (
          <div className="flex items-center gap-2 text-xs text-white/50 p-4 bg-white/5 rounded-2xl">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Validando e inspeccionando la estructura de datos...</span>
          </div>
        )}

        {validationResult && !validationResult.isValid && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-300">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-extrabold block text-rose-200">Archivo no compatible o dañado:</strong>
              <span className="text-rose-300/80">{validationResult.error}</span>
            </div>
          </div>
        )}

        {validationResult && validationResult.isValid && validationResult.summary && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 space-y-4 animate-fadeIn">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <strong className="text-sm font-black text-white">Copia de Seguridad Válida Reconocida</strong>
              </div>
              <span className="text-[11px] text-emerald-300 font-mono">
                Fecha del archivo: {new Date(validationResult.backup?.exportDate || '').toLocaleString('es-ES')}
              </span>
            </div>

            {/* Stats preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Obras</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {validationResult.summary.totalObras} proyectos
                </strong>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Facturas y Albaranes</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {validationResult.summary.totalDocs} docs
                </strong>
                <span className="text-[10px] text-emerald-400 font-mono block">
                  {validationResult.summary.totalDocsAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </span>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Personal de Obra</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {validationResult.summary.totalPersonal} partes
                </strong>
                <span className="text-[10px] text-sky-400 font-mono block">
                  {validationResult.summary.totalPersonalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </span>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Gastos Estructura</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {validationResult.summary.totalGastosGenerales} gastos
                </strong>
                <span className="text-[10px] text-rose-400 font-mono block">
                  {validationResult.summary.totalGastosGeneralesAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </span>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Proveedores</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {validationResult.summary.totalProveedores} registrados
                </strong>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Operarios PRL</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {validationResult.summary.totalTrabajadores} operarios
                </strong>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Plantilla Empresa</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {validationResult.summary.totalTrabajadoresEmpresa || 0} plantilla
                </strong>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5 bg-emerald-500/5 border-emerald-500/20">
                <span className="text-[10px] text-emerald-400/80 uppercase block font-bold">Total Gastos Auditados</span>
                <strong className="text-emerald-400 font-mono font-bold text-sm block mt-0.5">
                  {validationResult.summary.totalExpensesAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </strong>
              </div>
            </div>

            {/* Restore Mode Choice */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-white block">Estrategia de Restauración:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`border p-3.5 rounded-xl cursor-pointer flex items-start gap-3 transition-all ${
                  restoreMode === 'replace' ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-black/20 border-white/5 hover:border-white/10'
                }`}>
                  <input
                    type="radio"
                    name="restoreMode"
                    value="replace"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                    className="mt-1 accent-emerald-400"
                  />
                  <div>
                    <strong className="text-xs font-bold text-white block">Sustitución Completa (Recomendado)</strong>
                    <p className="text-[10.5px] text-white/50 mt-0.5 leading-snug">
                      Reemplaza la base de datos actual por el estado exacto de la copia de seguridad. Ideal ante pérdida total o cambio de equipo.
                    </p>
                  </div>
                </label>

                <label className={`border p-3.5 rounded-xl cursor-pointer flex items-start gap-3 transition-all ${
                  restoreMode === 'merge' ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-black/20 border-white/5 hover:border-white/10'
                }`}>
                  <input
                    type="radio"
                    name="restoreMode"
                    value="merge"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                    className="mt-1 accent-emerald-400"
                  />
                  <div>
                    <strong className="text-xs font-bold text-white block">Fusión Inteligente</strong>
                    <p className="text-[10.5px] text-white/50 mt-0.5 leading-snug">
                      Conserva los datos actuales e incorpora únicamente los registros de obras o gastos que no existan.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Confirmation Trigger Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-black py-3 px-6 rounded-xl text-xs flex items-center gap-2 shadow-xl cursor-pointer transition-all hover:scale-102 active:scale-98"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Proceder con la Restauración</span>
              </button>
            </div>

          </div>
        )}

      </div>

      {/* MODAL 1: CONFIRM LOCAL RESTORE */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#151515] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl text-xs">
            <div className="flex items-center gap-3 text-amber-400 border-b border-white/5 pb-4">
              <div className="p-2 bg-amber-500/10 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-white">¿Confirmar Restauración de Datos?</h4>
                <p className="text-[11px] text-white/50">Esta acción modificará la base de datos de la aplicación</p>
              </div>
            </div>

            <p className="text-white/80 leading-relaxed">
              {restoreMode === 'replace' ? (
                <>
                  Está a punto de <strong className="text-amber-400 font-bold">sobrescribir todos los datos actuales</strong> de la aplicación con la copia seleccionada. Los registros que no estén presentes en el archivo serán reemplazados.
                </>
              ) : (
                <>
                  Se incorporarán los registros nuevos de la copia sin borrar los existentes en la aplicación.
                </>
              )}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isRestoring}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-black py-2.5 px-5 rounded-xl flex items-center gap-2 cursor-pointer shadow-lg"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-black" />
                    <span>Sí, Restaurar Ahora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PREVIEW & RESTORE FROM GOOGLE DRIVE */}
      {showDriveRestoreModal && driveCloudBackup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#151515] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-xl w-full space-y-5 shadow-2xl text-xs">
            
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">Copia Maestra Recuperada de Google Drive</h4>
                  <p className="text-[11px] text-white/40">Archivo: {driveCloudBackup.meta.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDriveRestoreModal(false)}
                className="text-white/40 hover:text-white p-1 text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/50">Última modificación en Drive:</span>
                <span className="font-mono font-bold text-white/90">
                  {new Date(driveCloudBackup.meta.updatedTime).toLocaleString('es-ES')}
                </span>
              </div>

              {driveCloudBackup.meta.sizeBytes && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-white/50">Tamaño del archivo:</span>
                  <span className="font-mono font-bold text-white/90">
                    {(driveCloudBackup.meta.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </div>

            {/* Stats preview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Obras</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {driveCloudBackup.backup.summary.totalObras} proyectos
                </strong>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Facturas/Albaranes</span>
                <strong className="text-white font-mono font-bold text-sm block mt-0.5">
                  {driveCloudBackup.backup.summary.totalDocs} docs
                </strong>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Total Gastos</span>
                <strong className="text-emerald-400 font-mono font-bold text-sm block mt-0.5">
                  {driveCloudBackup.backup.summary.totalExpensesAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </strong>
              </div>
            </div>

            <p className="text-white/70 leading-relaxed">
              ¿Desea restaurar todos los datos desde esta copia de Google Drive? Se recuperarán de forma íntegra todos los gastos, proyectos y datos de empresa.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDriveRestoreModal(false)}
                disabled={isRestoring}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDriveRestore}
                disabled={isRestoring}
                className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-black py-2.5 px-5 rounded-xl flex items-center gap-2 cursor-pointer shadow-lg"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Restaurando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-black" />
                    <span>Confirmar Restauración desde Drive</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
