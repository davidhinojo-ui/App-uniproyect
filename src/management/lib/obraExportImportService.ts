/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Obra, FacturaAlbaran, PersonalCost, Proveedor, TrabajadorPRL, ObraExportPackage, ObraExportPackageSummary } from '../types';

export interface CreateObraPackageOptions {
  selectedObras: Obra[];
  allDocumentos: FacturaAlbaran[];
  allPersonal: PersonalCost[];
  allProveedores?: Proveedor[];
  allTrabajadores?: TrabajadorPRL[];
  exportedBy?: string;
  includeDocs?: boolean;
  includePersonal?: boolean;
  includeProveedores?: boolean;
  includeTrabajadores?: boolean;
}

/**
 * Creates a standard JSON export package for one or several Obras with their linked data.
 */
export function createObraPackage({
  selectedObras,
  allDocumentos,
  allPersonal,
  allProveedores = [],
  allTrabajadores = [],
  exportedBy = 'Usuario UniProyect',
  includeDocs = true,
  includePersonal = true,
  includeProveedores = true,
  includeTrabajadores = true,
}: CreateObraPackageOptions): ObraExportPackage {
  const selectedObraIds = new Set(selectedObras.map(o => o.id));

  // 1. Filter docs
  const filteredDocs = includeDocs 
    ? allDocumentos.filter(d => selectedObraIds.has(d.obraId))
    : [];

  // 2. Filter personal
  const filteredPersonal = includePersonal
    ? allPersonal.filter(p => selectedObraIds.has(p.obraId))
    : [];

  // 3. Filter proveedores referenced in docs or matching
  const docSupplierNames = new Set(
    filteredDocs.map(d => (d.supplier || '').trim().toLowerCase()).filter(Boolean)
  );
  const filteredProveedores = includeProveedores
    ? allProveedores.filter(p => docSupplierNames.has((p.name || '').trim().toLowerCase()))
    : [];

  // 4. Filter trabajadores referenced in personal or associatedObraId
  const personalWorkerNames = new Set(
    filteredPersonal.map(p => (p.workerName || '').trim().toLowerCase()).filter(Boolean)
  );
  const filteredTrabajadores = includeTrabajadores
    ? allTrabajadores.filter(t => 
        selectedObraIds.has(t.associatedObraId) || 
        personalWorkerNames.has((t.name || '').trim().toLowerCase())
      )
    : [];

  // 5. Calculate statistics summary
  const totalBudget = selectedObras.reduce((sum, o) => sum + (Number(o.budget) || 0), 0);
  const totalDocumentosAmount = filteredDocs.reduce((sum, d) => sum + (Number(d.totalAmount) || 0), 0);
  const totalPersonalCost = filteredPersonal.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
  const totalDirectCost = totalDocumentosAmount + totalPersonalCost;

  const summary: ObraExportPackageSummary = {
    totalObras: selectedObras.length,
    totalBudget,
    totalDocumentosCount: filteredDocs.length,
    totalDocumentosAmount,
    totalPersonalCount: filteredPersonal.length,
    totalPersonalCost,
    totalDirectCost,
  };

  const isSingle = selectedObras.length === 1;

  const pkg: ObraExportPackage = {
    app: 'UniProyect',
    version: '2.0',
    packageType: isSingle ? 'single_obra' : 'multi_obra',
    exportDate: new Date().toISOString(),
    exportedBy,
    obra: isSingle ? selectedObras[0] : undefined,
    obras: selectedObras,
    documentos: filteredDocs,
    personal: filteredPersonal,
    proveedores: filteredProveedores,
    trabajadores: filteredTrabajadores,
    summary,
  };

  return pkg;
}

/**
 * Initiates browser file download for the package.
 */
export function downloadObraPackage(pkg: ObraExportPackage, customFilename?: string): void {
  const jsonStr = JSON.stringify(pkg, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  let defaultName = 'PAQUETE_OBRAS_UNIPROYECT';
  if (pkg.packageType === 'single_obra' && pkg.obra) {
    const sanitizedTitle = pkg.obra.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    defaultName = `OBRA_${sanitizedTitle}_${new Date().toISOString().split('T')[0]}`;
  } else if (pkg.obras && pkg.obras.length > 0) {
    defaultName = `CARTERA_${pkg.obras.length}_OBRAS_${new Date().toISOString().split('T')[0]}`;
  }

  const filename = customFilename || `${defaultName}.obra.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies the raw JSON package to clipboard.
 */
export async function copyObraPackageToClipboard(pkg: ObraExportPackage): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(pkg, null, 2);
    await navigator.clipboard.writeText(jsonStr);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Parses and validates an imported JSON string or object.
 */
export function parseObraPackage(raw: string | any): { valid: boolean; package?: ObraExportPackage; error?: string } {
  try {
    let parsed: any;
    if (typeof raw === 'string') {
      parsed = JSON.parse(raw);
    } else if (typeof raw === 'object' && raw !== null) {
      parsed = raw;
    } else {
      return { valid: false, error: 'El archivo o texto proporcionado no es un JSON válido.' };
    }

    // Normalization: if parsed is a single Obra object without wrapper
    if (parsed && typeof parsed.name === 'string' && typeof parsed.budget === 'number' && !parsed.obras && !parsed.obra) {
      parsed = {
        app: 'UniProyect',
        version: '1.0',
        packageType: 'single_obra',
        exportDate: new Date().toISOString(),
        obra: parsed,
        obras: [parsed],
        documentos: [],
        personal: [],
        proveedores: [],
        trabajadores: []
      };
    }

    // If single_obra but missing obras array
    if (parsed.obra && (!parsed.obras || parsed.obras.length === 0)) {
      parsed.obras = [parsed.obra];
    }

    // Check minimum requirements
    if (!Array.isArray(parsed.obras) || parsed.obras.length === 0) {
      return { valid: false, error: 'El archivo no contiene ninguna obra válida ("obras" está vacío o no existe).' };
    }

    // Verify at least one obra has name
    const validObras = parsed.obras.filter((o: any) => o && typeof o.name === 'string' && o.name.trim().length > 0);
    if (validObras.length === 0) {
      return { valid: false, error: 'Ninguna de las obras del archivo contiene un nombre técnico válido.' };
    }

    // Ensure array fields exist
    parsed.documentos = Array.isArray(parsed.documentos) ? parsed.documentos : [];
    parsed.personal = Array.isArray(parsed.personal) ? parsed.personal : [];
    parsed.proveedores = Array.isArray(parsed.proveedores) ? parsed.proveedores : [];
    parsed.trabajadores = Array.isArray(parsed.trabajadores) ? parsed.trabajadores : [];

    // Compute or verify summary
    if (!parsed.summary) {
      const totalBudget = validObras.reduce((sum: number, o: Obra) => sum + (Number(o.budget) || 0), 0);
      const totalDocumentosAmount = parsed.documentos.reduce((sum: number, d: FacturaAlbaran) => sum + (Number(d.totalAmount) || 0), 0);
      const totalPersonalCost = parsed.personal.reduce((sum: number, p: PersonalCost) => sum + (Number(p.totalCost) || 0), 0);
      parsed.summary = {
        totalObras: validObras.length,
        totalBudget,
        totalDocumentosCount: parsed.documentos.length,
        totalDocumentosAmount,
        totalPersonalCount: parsed.personal.length,
        totalPersonalCost,
        totalDirectCost: totalDocumentosAmount + totalPersonalCost,
      };
    }

    return { valid: true, package: parsed as ObraExportPackage };
  } catch (err: any) {
    return { valid: false, error: `Error al procesar el archivo: ${err.message || 'Estructura JSON inválida'}` };
  }
}

export interface ProcessImportOptions {
  pkg: ObraExportPackage;
  mode: 'new_ids' | 'overwrite_existing' | 'merge_existing';
  currentObras: Obra[];
  currentDocs: FacturaAlbaran[];
  currentPersonal: PersonalCost[];
  currentProveedores: Proveedor[];
  currentTrabajadores: TrabajadorPRL[];
  selectedObraIdsToImport?: string[];
  nameSuffix?: string;
}

export interface ProcessImportResult {
  updatedObras: Obra[];
  updatedDocs: FacturaAlbaran[];
  updatedPersonal: PersonalCost[];
  updatedProveedores: Proveedor[];
  updatedTrabajadores: TrabajadorPRL[];
  importedObrasCount: number;
  importedDocsCount: number;
  importedPersonalCount: number;
  importedProveedoresCount: number;
  importedTrabajadoresCount: number;
  newlyCreatedObraIds: string[];
}

/**
 * Integrates an imported ObraExportPackage into current application datasets according to the chosen strategy.
 */
export function processImportObraPackage({
  pkg,
  mode,
  currentObras,
  currentDocs,
  currentPersonal,
  currentProveedores,
  currentTrabajadores,
  selectedObraIdsToImport,
  nameSuffix = '',
}: ProcessImportOptions): ProcessImportResult {
  const obrasToProcess = (pkg.obras || []).filter(o => 
    !selectedObraIdsToImport || selectedObraIdsToImport.includes(o.id)
  );

  let updatedObras = [...currentObras];
  let updatedDocs = [...currentDocs];
  let updatedPersonal = [...currentPersonal];
  let updatedProveedores = [...currentProveedores];
  let updatedTrabajadores = [...currentTrabajadores];

  let importedObrasCount = 0;
  let importedDocsCount = 0;
  let importedPersonalCount = 0;
  let importedProveedoresCount = 0;
  let importedTrabajadoresCount = 0;
  const newlyCreatedObraIds: string[] = [];

  // Obra ID mapping (old ID in package -> new target ID in local database)
  const obraIdMap: Record<string, string> = {};

  obrasToProcess.forEach(rawObra => {
    const existingById = updatedObras.find(o => o.id === rawObra.id);
    const existingByName = updatedObras.find(o => o.name.trim().toLowerCase() === rawObra.name.trim().toLowerCase());
    const existing = existingById || existingByName;

    let targetObraId: string;

    if (mode === 'new_ids' || !existing) {
      // Create with brand new unique ID
      const timestamp = Date.now() + Math.floor(Math.random() * 1000);
      targetObraId = `obra-${timestamp}`;
      obraIdMap[rawObra.id] = targetObraId;

      const finalName = nameSuffix ? `${rawObra.name} ${nameSuffix}` : rawObra.name;

      const newObra: Obra = {
        ...rawObra,
        id: targetObraId,
        name: finalName,
        budget: Number(rawObra.budget) || 0,
        status: rawObra.status || 'active',
        startDate: rawObra.startDate || new Date().toISOString().split('T')[0],
      };

      updatedObras = [newObra, ...updatedObras];
      newlyCreatedObraIds.push(targetObraId);
      importedObrasCount++;
    } else {
      // Overwrite or Merge into existing obra
      targetObraId = existing.id;
      obraIdMap[rawObra.id] = targetObraId;

      if (mode === 'overwrite_existing') {
        const updatedObra: Obra = {
          ...rawObra,
          id: existing.id,
          name: existing.name, // Keep existing name or update if wanted
        };
        updatedObras = updatedObras.map(o => o.id === existing.id ? updatedObra : o);
      }
      newlyCreatedObraIds.push(targetObraId);
      importedObrasCount++;
    }

    // Now process Documentos for this Obra
    const rawDocsForThisObra = (pkg.documentos || []).filter(d => d.obraId === rawObra.id);

    if (mode === 'overwrite_existing' && existing) {
      // Remove previous docs for this existing obra
      updatedDocs = updatedDocs.filter(d => d.obraId !== existing.id);
    }

    rawDocsForThisObra.forEach(rawDoc => {
      // Check if doc already exists in target (by docNumber + supplier + targetObraId)
      const existingDoc = updatedDocs.find(d => 
        d.obraId === targetObraId && 
        d.docNumber.trim().toLowerCase() === rawDoc.docNumber.trim().toLowerCase() &&
        d.supplier.trim().toLowerCase() === rawDoc.supplier.trim().toLowerCase()
      );

      if (mode === 'merge_existing' && existingDoc) {
        // Skip duplicate
        return;
      }

      const newDocId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const importedDoc: FacturaAlbaran = {
        ...rawDoc,
        id: (mode === 'new_ids' || !existingDoc) ? newDocId : existingDoc.id,
        obraId: targetObraId,
      };

      if (existingDoc && mode === 'overwrite_existing') {
        updatedDocs = updatedDocs.map(d => d.id === existingDoc.id ? importedDoc : d);
      } else {
        updatedDocs = [importedDoc, ...updatedDocs];
      }
      importedDocsCount++;
    });

    // Now process Personal for this Obra
    const rawPersonalForThisObra = (pkg.personal || []).filter(p => p.obraId === rawObra.id);

    if (mode === 'overwrite_existing' && existing) {
      // Remove previous personal costs for this existing obra
      updatedPersonal = updatedPersonal.filter(p => p.obraId !== existing.id);
    }

    rawPersonalForThisObra.forEach(rawPers => {
      const existingPers = updatedPersonal.find(p => 
        p.obraId === targetObraId && 
        p.workerName.trim().toLowerCase() === rawPers.workerName.trim().toLowerCase() &&
        p.date === rawPers.date &&
        p.role === rawPers.role
      );

      if (mode === 'merge_existing' && existingPers) {
        // Skip duplicate
        return;
      }

      const newPersId = `pers-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const importedPers: PersonalCost = {
        ...rawPers,
        id: (mode === 'new_ids' || !existingPers) ? newPersId : existingPers.id,
        obraId: targetObraId,
      };

      if (existingPers && mode === 'overwrite_existing') {
        updatedPersonal = updatedPersonal.map(p => p.id === existingPers.id ? importedPers : p);
      } else {
        updatedPersonal = [importedPers, ...updatedPersonal];
      }
      importedPersonalCount++;
    });
  });

  // Process Proveedores (merge without duplicate NIFs or names)
  if (Array.isArray(pkg.proveedores)) {
    pkg.proveedores.forEach(rawProv => {
      const exists = updatedProveedores.some(p => 
        (rawProv.nif && p.nif && p.nif.trim().toLowerCase() === rawProv.nif.trim().toLowerCase()) ||
        (p.name.trim().toLowerCase() === rawProv.name.trim().toLowerCase())
      );
      if (!exists) {
        const newProv: Proveedor = {
          ...rawProv,
          id: `prov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        };
        updatedProveedores = [newProv, ...updatedProveedores];
        importedProveedoresCount++;
      }
    });
  }

  // Process Trabajadores PRL (merge and remap associatedObraId)
  if (Array.isArray(pkg.trabajadores)) {
    pkg.trabajadores.forEach(rawTrab => {
      const targetObraId = obraIdMap[rawTrab.associatedObraId] || rawTrab.associatedObraId;
      const exists = updatedTrabajadores.some(t => 
        (rawTrab.nif && t.nif && t.nif.trim().toLowerCase() === rawTrab.nif.trim().toLowerCase()) ||
        (t.name.trim().toLowerCase() === rawTrab.name.trim().toLowerCase())
      );
      if (!exists) {
        const newTrab: TrabajadorPRL = {
          ...rawTrab,
          id: `trab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          associatedObraId: targetObraId,
        };
        updatedTrabajadores = [newTrab, ...updatedTrabajadores];
        importedTrabajadoresCount++;
      }
    });
  }

  return {
    updatedObras,
    updatedDocs,
    updatedPersonal,
    updatedProveedores,
    updatedTrabajadores,
    importedObrasCount,
    importedDocsCount,
    importedPersonalCount,
    importedProveedoresCount,
    importedTrabajadoresCount,
    newlyCreatedObraIds,
  };
}
