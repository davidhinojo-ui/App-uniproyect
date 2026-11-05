/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Obra, FacturaAlbaran, PersonalCost, OtrosGasto, Proveedor, TrabajadorPRL, TrabajadorEmpresa } from '../types';
import { sanitizeForFirestore } from './firestoreSanitizer';

export interface GlobalAppBackupSummary {
  totalObras: number;
  totalDocs: number;
  totalPersonal: number;
  totalGastosGenerales: number;
  totalProveedores: number;
  totalTrabajadores: number;
  totalTrabajadoresEmpresa: number;
  totalExpensesAmount: number;
  totalBudgetObras: number;
  totalDocsAmount: number;
  totalPersonalAmount: number;
  totalGastosGeneralesAmount: number;
}

export interface GlobalAppBackup {
  version: string;
  appName: string;
  exportDate: string;
  companyName: string;
  userEmail?: string | null;
  summary: GlobalAppBackupSummary;
  data: {
    obras: Obra[];
    documentos: FacturaAlbaran[];
    personal: PersonalCost[];
    gastosGenerales: OtrosGasto[];
    proveedores: Proveedor[];
    trabajadores: TrabajadorPRL[];
    trabajadoresEmpresa: TrabajadorEmpresa[];
  };
}

export interface BackupValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  backup?: GlobalAppBackup;
  summary?: GlobalAppBackupSummary;
}

/**
 * Generates the unified, canonical global backup object containing all expenses, works, providers,
 * workers, internal payroll plantilla and app records with 100% field fidelity.
 */
export function generateGlobalBackup(
  obras: Obra[],
  documentos: FacturaAlbaran[],
  personal: PersonalCost[],
  gastosGenerales: OtrosGasto[],
  proveedores: Proveedor[],
  trabajadores: TrabajadorPRL[],
  userEmail?: string | null,
  trabajadoresEmpresa: TrabajadorEmpresa[] = []
): GlobalAppBackup {
  const safeObras = obras || [];
  const safeDocs = documentos || [];
  const safePersonal = personal || [];
  const safeGastos = gastosGenerales || [];
  const safeProveedores = proveedores || [];
  const safeTrabajadores = trabajadores || [];
  const safeTrabajadoresEmpresa = trabajadoresEmpresa || [];

  const totalDocsAmount = safeDocs.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
  const totalPersonalAmount = safePersonal.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
  const totalGastosGeneralesAmount = safeGastos.reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  const totalExpensesAmount = totalDocsAmount + totalPersonalAmount + totalGastosGeneralesAmount;
  const totalBudgetObras = safeObras.reduce((sum, o) => sum + (Number(o.budget) || 0), 0);

  const summary: GlobalAppBackupSummary = {
    totalObras: safeObras.length,
    totalDocs: safeDocs.length,
    totalPersonal: safePersonal.length,
    totalGastosGenerales: safeGastos.length,
    totalProveedores: safeProveedores.length,
    totalTrabajadores: safeTrabajadores.length,
    totalTrabajadoresEmpresa: safeTrabajadoresEmpresa.length,
    totalExpensesAmount: Number(totalExpensesAmount.toFixed(2)),
    totalBudgetObras: Number(totalBudgetObras.toFixed(2)),
    totalDocsAmount: Number(totalDocsAmount.toFixed(2)),
    totalPersonalAmount: Number(totalPersonalAmount.toFixed(2)),
    totalGastosGeneralesAmount: Number(totalGastosGeneralesAmount.toFixed(2)),
  };

  return {
    version: '3.0',
    appName: 'Uniproyect - Control Integral de Obras y Gastos',
    exportDate: new Date().toISOString(),
    companyName: 'UNIPROYECT',
    userEmail: userEmail || null,
    summary,
    data: {
      obras: JSON.parse(JSON.stringify(safeObras)),
      documentos: JSON.parse(JSON.stringify(safeDocs)),
      personal: JSON.parse(JSON.stringify(safePersonal)),
      gastosGenerales: JSON.parse(JSON.stringify(safeGastos)),
      proveedores: JSON.parse(JSON.stringify(safeProveedores)),
      trabajadores: JSON.parse(JSON.stringify(safeTrabajadores)),
      trabajadoresEmpresa: JSON.parse(JSON.stringify(safeTrabajadoresEmpresa)),
    },
  };
}

/**
 * Triggers a browser download of the backup file (.json) with full UTF-8 encoding.
 */
export function downloadBackupFile(backup: GlobalAppBackup, customFilename?: string): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = customFilename || `UNIPROYECT_COPIA_SEGURIDAD_COMPLETA_${dateStr}.json`;
  const jsonStr = JSON.stringify(backup, null, 2);

  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates any JSON string or object to ensure it is a valid Uniproyect global backup.
 * Designed to be completely resilient, error-free, and backwards-compatible with any previous format.
 */
export function validateBackupPayload(rawInput: string | any): BackupValidationResult {
  try {
    let parsed: any;
    if (typeof rawInput === 'string') {
      try {
        // Strip UTF-8 BOM if present from Windows text files
        const sanitized = rawInput.trim().replace(/^\uFEFF/, '');
        parsed = JSON.parse(sanitized);
      } catch (e: any) {
        return { isValid: false, error: 'El archivo o texto no es un JSON válido o tiene caracteres corruptos.' };
      }
    } else {
      parsed = rawInput;
    }

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Estructura de copia de seguridad no válida.' };
    }

    // Support both direct root format and payload wrapped in data
    const dataSection = parsed.data || parsed;

    // Check if at least one critical collection is present
    const rawObras = dataSection.obras || dataSection.projects || dataSection.obrasList;
    const rawDocs = dataSection.documentos || dataSection.docs || dataSection.facturas || dataSection.invoices;
    const rawPersonal = dataSection.personal || dataSection.personalCosts || dataSection.manoDeObra;
    const rawGastos = dataSection.gastosGenerales || dataSection.gastos || dataSection.otrosGastos || dataSection.generalExpenses;
    const rawProveedores = dataSection.proveedores || dataSection.suppliers;
    const rawTrabajadores = dataSection.trabajadores || dataSection.trabajadoresPRL || dataSection.workers;
    const rawPlantilla = dataSection.trabajadoresEmpresa || dataSection.plantilla || dataSection.plantillaTrabajadores || dataSection.companyWorkers;

    const hasObras = Array.isArray(rawObras);
    const hasDocs = Array.isArray(rawDocs);
    const hasPersonal = Array.isArray(rawPersonal);
    const hasGastos = Array.isArray(rawGastos);
    const hasProv = Array.isArray(rawProveedores);
    const hasTrab = Array.isArray(rawTrabajadores);
    const hasPlantilla = Array.isArray(rawPlantilla);

    if (!hasObras && !hasDocs && !hasPersonal && !hasGastos && !hasProv && !hasTrab && !hasPlantilla) {
      return {
        isValid: false,
        error: 'El archivo no contiene ninguna colección reconocida de Uniproyect (Obras, Facturas, Personal, Gastos, Proveedores o Plantilla).',
      };
    }

    // Normalize and preserve 100% of all fields with object spread
    const obras: Obra[] = (Array.isArray(rawObras) ? rawObras : []).map((o: any, idx: number) => ({
      ...o,
      id: String(o.id || `obra-${Date.now()}-${idx}`),
      name: String(o.name || `Obra ${idx + 1}`),
      location: String(o.location || 'No especificada'),
      budget: Number(o.budget) || 0,
      description: String(o.description || ''),
      status: (['active', 'completed', 'on_hold'].includes(o.status) ? o.status : 'active') as any,
      startDate: String(o.startDate || new Date().toISOString().split('T')[0]),
      overheadAllocationType: o.overheadAllocationType || 'auto',
      ...(o.overrideOverheadPercent !== undefined && o.overrideOverheadPercent !== null
        ? { overrideOverheadPercent: Number(o.overrideOverheadPercent) }
        : {}),
    }));

    const documentos: FacturaAlbaran[] = (Array.isArray(rawDocs) ? rawDocs : []).map((d: any, idx: number) => ({
      ...d,
      id: String(d.id || `doc-${Date.now()}-${idx}`),
      obraId: String(d.obraId || '1'),
      type: (d.type === 'albaran' ? 'albaran' : 'factura') as any,
      docNumber: String(d.docNumber || `DOC-${idx + 1}`),
      supplier: String(d.supplier || 'Proveedor Genérico'),
      date: String(d.date || new Date().toISOString().split('T')[0]),
      items: Array.isArray(d.items)
        ? d.items.map((it: any) => ({
            ...it,
            name: String(it.name || 'Material/Servicio'),
            quantity: Number(it.quantity) || 1,
            unit: String(it.unit || 'ud'),
            price: Number(it.price) || 0,
            total: Number(it.total) || 0,
          }))
        : [],
      baseAmount: Number(d.baseAmount) || 0,
      ivaRate: d.ivaRate !== undefined ? Number(d.ivaRate) : 21,
      ivaAmount: Number(d.ivaAmount) || 0,
      retentionRate: d.retentionRate !== undefined ? Number(d.retentionRate) : 0,
      retentionAmount: Number(d.retentionAmount) || 0,
      totalAmount: Number(d.totalAmount) || 0,
      notes: d.notes ? String(d.notes) : undefined,
      imageUrl: d.imageUrl ? String(d.imageUrl) : undefined,
      status: (['paid', 'pending', 'draft'].includes(d.status) ? d.status : 'paid') as any,
      category: d.category ? String(d.category) : undefined,
    }));

    const personal: PersonalCost[] = (Array.isArray(rawPersonal) ? rawPersonal : []).map((p: any, idx: number) => ({
      ...p,
      id: String(p.id || `pers-${Date.now()}-${idx}`),
      obraId: String(p.obraId || '1'),
      workerName: String(p.workerName || 'Operario'),
      date: String(p.date || new Date().toISOString().split('T')[0]),
      role: String(p.role || 'Oficial'),
      hours: Number(p.hours) || 0,
      hourlyRate: Number(p.hourlyRate) || 0,
      totalCost: Number(p.totalCost) || 0,
      notes: p.notes ? String(p.notes) : undefined,
      costType: p.costType || 'horas',
      jornales: p.jornales !== undefined ? Number(p.jornales) : undefined,
      jornalRate: p.jornalRate !== undefined ? Number(p.jornalRate) : undefined,
      overtimeHours: p.overtimeHours !== undefined ? Number(p.overtimeHours) : undefined,
      overtimeRate: p.overtimeRate !== undefined ? Number(p.overtimeRate) : undefined,
      regularHoursCost: p.regularHoursCost !== undefined ? Number(p.regularHoursCost) : undefined,
      overtimeCost: p.overtimeCost !== undefined ? Number(p.overtimeCost) : undefined,
      monthlyBase: p.monthlyBase !== undefined ? Number(p.monthlyBase) : undefined,
      socialSecurityRate: p.socialSecurityRate !== undefined ? Number(p.socialSecurityRate) : undefined,
      socialSecurityAmount: p.socialSecurityAmount !== undefined ? Number(p.socialSecurityAmount) : undefined,
      irpfRate: p.irpfRate !== undefined ? Number(p.irpfRate) : undefined,
      irpfAmount: p.irpfAmount !== undefined ? Number(p.irpfAmount) : undefined,
      netSalary: p.netSalary !== undefined ? Number(p.netSalary) : undefined,
      baseSalary: p.baseSalary !== undefined ? Number(p.baseSalary) : undefined,
      startDate: p.startDate ? String(p.startDate) : undefined,
      endDate: p.endDate ? String(p.endDate) : undefined,
      workerCatalogId: p.workerCatalogId ? String(p.workerCatalogId) : undefined,
    }));

    const gastosGenerales: OtrosGasto[] = (Array.isArray(rawGastos) ? rawGastos : []).map((g: any, idx: number) => ({
      ...g,
      id: String(g.id || `gasto-${Date.now()}-${idx}`),
      category: String(g.category || 'Otros Suministros'),
      description: String(g.description || 'Gasto General'),
      date: String(g.date || new Date().toISOString().split('T')[0]),
      amount: Number(g.amount) || 0,
      notes: g.notes ? String(g.notes) : undefined,
      supplier: g.supplier ? String(g.supplier) : undefined,
      docNumber: g.docNumber ? String(g.docNumber) : undefined,
      baseAmount: g.baseAmount !== undefined ? Number(g.baseAmount) : undefined,
      ivaRate: g.ivaRate !== undefined ? Number(g.ivaRate) : undefined,
      ivaAmount: g.ivaAmount !== undefined ? Number(g.ivaAmount) : undefined,
      imageUrl: g.imageUrl ? String(g.imageUrl) : undefined,
    }));

    const proveedores: Proveedor[] = (Array.isArray(rawProveedores) ? rawProveedores : []).map((pr: any, idx: number) => ({
      ...pr,
      id: String(pr.id || `prov-${Date.now()}-${idx}`),
      name: String(pr.name || `Proveedor ${idx + 1}`),
      nif: String(pr.nif || pr.cif || ''),
      address: String(pr.address || ''),
      phone: String(pr.phone || ''),
      email: String(pr.email || ''),
      contactPerson: String(pr.contactPerson || ''),
      category: String(pr.category || 'Materiales Generales'),
      notes: pr.notes ? String(pr.notes) : undefined,
    }));

    const trabajadores: TrabajadorPRL[] = (Array.isArray(rawTrabajadores) ? rawTrabajadores : []).map((t: any, idx: number) => ({
      ...t,
      id: String(t.id || `trab-${Date.now()}-${idx}`),
      name: String(t.name || `Trabajador ${idx + 1}`),
      nif: String(t.nif || ''),
      type: (t.type === 'subcontrata' ? 'subcontrata' : 'propio') as any,
      phone: String(t.phone || ''),
      email: String(t.email || ''),
      role: String(t.role || 'Oficial'),
      notes: t.notes ? String(t.notes) : undefined,
      associatedObraId: String(t.associatedObraId || '1'),
      documentsChecklist: Array.isArray(t.documentsChecklist) ? t.documentsChecklist : [],
    }));

    const trabajadoresEmpresa: TrabajadorEmpresa[] = (Array.isArray(rawPlantilla) ? rawPlantilla : []).map((te: any, idx: number) => ({
      ...te,
      id: String(te.id || `trab-emp-${Date.now()}-${idx}`),
      name: String(te.name || `Operario ${idx + 1}`),
      role: String(te.role || 'Oficial de 1ª'),
      dailyRate: Number(te.dailyRate) || 90,
      overtimeHourlyRate: Number(te.overtimeHourlyRate) || 18,
      standardHourlyRate: te.standardHourlyRate !== undefined ? Number(te.standardHourlyRate) : undefined,
      phone: te.phone ? String(te.phone) : undefined,
      dni: te.dni ? String(te.dni) : undefined,
      email: te.email ? String(te.email) : undefined,
      defaultObraId: te.defaultObraId ? String(te.defaultObraId) : undefined,
      notes: te.notes ? String(te.notes) : undefined,
      active: te.active !== false,
    }));

    const totalDocsAmount = documentos.reduce((sum, d) => sum + d.totalAmount, 0);
    const totalPersonalAmount = personal.reduce((sum, p) => sum + p.totalCost, 0);
    const totalGastosGeneralesAmount = gastosGenerales.reduce((sum, g) => sum + g.amount, 0);
    const totalExpensesAmount = totalDocsAmount + totalPersonalAmount + totalGastosGeneralesAmount;
    const totalBudgetObras = obras.reduce((sum, o) => sum + o.budget, 0);

    const summary: GlobalAppBackupSummary = {
      totalObras: obras.length,
      totalDocs: documentos.length,
      totalPersonal: personal.length,
      totalGastosGenerales: gastosGenerales.length,
      totalProveedores: proveedores.length,
      totalTrabajadores: trabajadores.length,
      totalTrabajadoresEmpresa: trabajadoresEmpresa.length,
      totalExpensesAmount: Number(totalExpensesAmount.toFixed(2)),
      totalBudgetObras: Number(totalBudgetObras.toFixed(2)),
      totalDocsAmount: Number(totalDocsAmount.toFixed(2)),
      totalPersonalAmount: Number(totalPersonalAmount.toFixed(2)),
      totalGastosGeneralesAmount: Number(totalGastosGeneralesAmount.toFixed(2)),
    };

    const validatedBackup: GlobalAppBackup = {
      version: parsed.version || '3.0',
      appName: parsed.appName || 'Uniproyect - Control Integral de Obras y Gastos',
      exportDate: parsed.exportDate || new Date().toISOString(),
      companyName: parsed.companyName || 'UNIPROYECT',
      userEmail: parsed.userEmail || null,
      summary,
      data: {
        obras: sanitizeForFirestore(obras),
        documentos: sanitizeForFirestore(documentos),
        personal: sanitizeForFirestore(personal),
        gastosGenerales: sanitizeForFirestore(gastosGenerales),
        proveedores: sanitizeForFirestore(proveedores),
        trabajadores: sanitizeForFirestore(trabajadores),
        trabajadoresEmpresa: sanitizeForFirestore(trabajadoresEmpresa),
      },
    };

    return {
      isValid: true,
      backup: validatedBackup,
      summary,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Error al procesar la copia: ${err?.message || 'Formato no válido'}`,
    };
  }
}

/**
 * Resolves restore operations (replace entirely vs merge) across all 7 database entities.
 * In 'replace' mode, it completely overwrites existing database collections with the backup data,
 * guaranteeing identical transfer to another computer or device.
 */
export function applyBackupRestore(
  backup: GlobalAppBackup,
  mode: 'replace' | 'merge',
  currentData: {
    obras: Obra[];
    documentos: FacturaAlbaran[];
    personal: PersonalCost[];
    gastosGenerales: OtrosGasto[];
    proveedores: Proveedor[];
    trabajadores: TrabajadorPRL[];
    trabajadoresEmpresa?: TrabajadorEmpresa[];
  }
): {
  restoredObras: Obra[];
  restoredDocs: FacturaAlbaran[];
  restoredPersonal: PersonalCost[];
  restoredGastos: OtrosGasto[];
  restoredProveedores: Proveedor[];
  restoredTrabajadores: TrabajadorPRL[];
  restoredTrabajadoresEmpresa: TrabajadorEmpresa[];
  addedObrasCount: number;
  addedDocsCount: number;
  addedPersonalCount: number;
  addedGastosCount: number;
  addedProveedoresCount: number;
  addedTrabajadoresCount: number;
  addedTrabajadoresEmpresaCount: number;
} {
  const incoming = backup.data;

  if (mode === 'replace') {
    return {
      restoredObras: sanitizeForFirestore(incoming.obras || []),
      restoredDocs: sanitizeForFirestore(incoming.documentos || []),
      restoredPersonal: sanitizeForFirestore(incoming.personal || []),
      restoredGastos: sanitizeForFirestore(incoming.gastosGenerales || []),
      restoredProveedores: sanitizeForFirestore(incoming.proveedores || []),
      restoredTrabajadores: sanitizeForFirestore(incoming.trabajadores || []),
      restoredTrabajadoresEmpresa: sanitizeForFirestore(incoming.trabajadoresEmpresa || []),
      addedObrasCount: (incoming.obras || []).length,
      addedDocsCount: (incoming.documentos || []).length,
      addedPersonalCount: (incoming.personal || []).length,
      addedGastosCount: (incoming.gastosGenerales || []).length,
      addedProveedoresCount: (incoming.proveedores || []).length,
      addedTrabajadoresCount: (incoming.trabajadores || []).length,
      addedTrabajadoresEmpresaCount: (incoming.trabajadoresEmpresa || []).length,
    };
  }

  // MERGE MODE: Combine incoming with current without duplicating primary IDs
  const existingObraIds = new Set((currentData.obras || []).map(o => o.id));
  const newObras = (incoming.obras || []).filter(o => !existingObraIds.has(o.id));
  const mergedObras = [...(currentData.obras || []), ...newObras];

  const existingDocIds = new Set((currentData.documentos || []).map(d => d.id));
  const newDocs = (incoming.documentos || []).filter(d => !existingDocIds.has(d.id));
  const mergedDocs = [...(currentData.documentos || []), ...newDocs];

  const existingPersIds = new Set((currentData.personal || []).map(p => p.id));
  const newPers = (incoming.personal || []).filter(p => !existingPersIds.has(p.id));
  const mergedPersonal = [...(currentData.personal || []), ...newPers];

  const existingGastosIds = new Set((currentData.gastosGenerales || []).map(g => g.id));
  const newGastos = (incoming.gastosGenerales || []).filter(g => !existingGastosIds.has(g.id));
  const mergedGastos = [...(currentData.gastosGenerales || []), ...newGastos];

  const existingProvIds = new Set((currentData.proveedores || []).map(pr => pr.id));
  const newProv = (incoming.proveedores || []).filter(pr => !existingProvIds.has(pr.id));
  const mergedProveedores = [...(currentData.proveedores || []), ...newProv];

  const existingTrabIds = new Set((currentData.trabajadores || []).map(t => t.id));
  const newTrab = (incoming.trabajadores || []).filter(t => !existingTrabIds.has(t.id));
  const mergedTrabajadores = [...(currentData.trabajadores || []), ...newTrab];

  const existingEmpIds = new Set((currentData.trabajadoresEmpresa || []).map(te => te.id));
  const newEmp = (incoming.trabajadoresEmpresa || []).filter(te => !existingEmpIds.has(te.id));
  const mergedTrabajadoresEmpresa = [...(currentData.trabajadoresEmpresa || []), ...newEmp];

  return {
    restoredObras: sanitizeForFirestore(mergedObras),
    restoredDocs: sanitizeForFirestore(mergedDocs),
    restoredPersonal: sanitizeForFirestore(mergedPersonal),
    restoredGastos: sanitizeForFirestore(mergedGastos),
    restoredProveedores: sanitizeForFirestore(mergedProveedores),
    restoredTrabajadores: sanitizeForFirestore(mergedTrabajadores),
    restoredTrabajadoresEmpresa: sanitizeForFirestore(mergedTrabajadoresEmpresa),
    addedObrasCount: newObras.length,
    addedDocsCount: newDocs.length,
    addedPersonalCount: newPers.length,
    addedGastosCount: newGastos.length,
    addedProveedoresCount: newProv.length,
    addedTrabajadoresCount: newTrab.length,
    addedTrabajadoresEmpresaCount: newEmp.length,
  };
}
