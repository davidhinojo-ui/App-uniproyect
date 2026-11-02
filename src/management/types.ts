/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Obra {
  id: string;
  name: string;
  location: string;
  budget: number;
  description: string;
  status: 'active' | 'completed' | 'on_hold';
  startDate: string;
  overheadAllocationType?: 'auto' | 'custom';
  overrideOverheadPercent?: number; // e.g. 15 for 15%
}

export interface DocumentItem {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
}

export interface FacturaAlbaran {
  id: string;
  obraId: string;
  type: 'factura' | 'albaran';
  docNumber: string;
  supplier: string;
  date: string;
  items: DocumentItem[];
  baseAmount: number;
  ivaRate: number; // e.g., 21
  ivaAmount: number;
  retentionRate: number; // e.g., 2
  retentionAmount: number;
  totalAmount: number;
  notes?: string;
  imageUrl?: string;
  status?: 'paid' | 'pending' | 'draft';
  category?: string;
}

export interface TrabajadorEmpresa {
  id: string;
  name: string; // Nombre y apellidos del operario
  role: string; // Categoría o especialidad
  dailyRate: number; // Cuánto cobra al día (€/día o jornal)
  overtimeHourlyRate: number; // Precio de las horas extras (€/hora extra)
  standardHourlyRate?: number; // Precio hora ordinaria (€/h)
  phone?: string;
  dni?: string;
  email?: string;
  defaultObraId?: string; // Obra habitual asignada
  notes?: string;
  active?: boolean;
}

export interface PersonalCost {
  authorId?: string;
  id: string;
  obraId: string;
  workerName: string;
  date: string;
  role: string;
  hours: number;
  hourlyRate: number;
  totalCost: number;
  notes?: string;
  costType?: 'horas' | 'jornal' | 'mensual';
  jornales?: number;
  jornalRate?: number;
  overtimeHours?: number; // Horas extras trabajadas
  overtimeRate?: number; // Tarifa por hora extra (€/h)
  regularHoursCost?: number;
  overtimeCost?: number;
  monthlyBase?: number;
  socialSecurityRate?: number;
  socialSecurityAmount?: number;
  irpfRate?: number;
  irpfAmount?: number;
  netSalary?: number;
  baseSalary?: number;
  startDate?: string;
  endDate?: string;
  workerCatalogId?: string; // Enlace opcional al trabajador memorizado
  fichajeId?: string; // Enlace al registro legal de control horario / fichaje firmado
}

export interface RegistroJornada {
  foremanNotes?: string;
  id: string;
  workerId: string;
  workerName: string;
  workerDni?: string;
  role: string;
  obraId: string;
  obraName: string;
  date: string; // YYYY-MM-DD
  clockIn: string; // HH:mm
  clockOut: string; // HH:mm
  breakMinutes: number; // Pausas en minutos (comida/descanso)
  totalHours: number; // Horas netas de trabajo
  regularHours: number; // Horas ordinarias (hasta 8h)
  overtimeHours: number; // Horas extraordinarias (> 8h)
  hourlyRate: number; // Precio hora ordinaria
  overtimeRate: number; // Precio hora extra
  calculatedCost: number; // Coste total de personal generado
  workerSignature: string; // Imagen de la firma digitalizada manuscrita (DataURL)
  signatureTimestamp: string; // Marca de tiempo oficial de la firma
  legalDisclaimer?: string; // Declaración legal del operario
  notes?: string;
  status: 'active' | 'completed';
  personalCostId?: string; // ID del registro generado en PersonalCost
  incidentReason?: string; // Motivo en caso de rectificación o modificación a posteriori
  createdAt?: string;
  updatedAt?: string;
  // Aprobación digital del Capataz de Obra previa a imputación de gastos
  approvalStatus: 'pending' | 'approved' | 'rejected';
  foremanName?: string;
  foremanRole?: string;
  foremanSignature?: string; // Imagen DataURL de la firma digital del capataz
  approvedAt?: string; // Marca de tiempo oficial de la aprobación del capataz
  rejectionReason?: string; // Motivo en caso de rechazo
  // Metadatos de geolocalización y dispositivo en obra
  locationCoords?: { latitude: number; longitude: number; accuracy?: number };
  locationAddress?: string;
  deviceInfo?: string;
  clockInTimestamp?: number;
}

export interface ActiveFichaje {
  id: string;
  workerId: string;
  workerName: string;
  workerDni?: string;
  role: string;
  obraId: string;
  obraName: string;
  date: string;
  clockIn: string; // HH:mm
  clockInTimestamp: number; // Date.now()
  breakMinutes?: number;
  hourlyRate: number;
  overtimeRate: number;
  locationCoords?: { latitude: number; longitude: number; accuracy?: number };
  locationAddress?: string;
  deviceInfo?: string;
  notes?: string;
}

export interface OtrosGasto {
  id: string;
  category: string; // e.g., Combustible y Vehículos, Suministros y Oficina, Seguros Corporativos, etc.
  description: string;
  date: string;
  amount: number;
  notes?: string;
  supplier?: string;
  docNumber?: string;
  baseAmount?: number;
  ivaRate?: number;
  ivaAmount?: number;
  imageUrl?: string;
}

export interface IAStructuralExpenseExtraction {
  category: string;
  description: string;
  date: string;
  amount: number;
  supplier?: string;
  docNumber?: string;
  baseAmount?: number;
  ivaRate?: number;
  ivaAmount?: number;
  notes?: string;
}

// IA Recognition response format
export interface IAExtractionResult {
  type: 'factura' | 'albaran';
  docNumber: string;
  supplier: string;
  date: string;
  items: DocumentItem[];
  baseAmount: number;
  ivaRate: number;
  ivaAmount: number;
  retentionRate: number;
  retentionAmount: number;
  totalAmount: number;
  notes?: string;
}

export interface Proveedor {
  id: string;
  name: string;
  nif: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  category: string;
  notes?: string;
}

export interface DocumentState {
  id: string;
  name: string; // Document label / legal reference
  required: boolean;
  isChecked: boolean;
  uploadedFile?: {
    name: string;
    size: string;
    date: string;
  };
  signatures?: {
    workerSignature?: string; // Base64 signature image
    companySignature?: string; // Base64 signature image
    workerSignedAt?: string;
    companySignedAt?: string;
    emailSentTo?: string;
    driveFileUrl?: string;
  };
}

export interface TrabajadorPRL {
  id: string;
  name: string;
  nif: string;
  type: 'propio' | 'subcontratado' | 'autonomo';
  companyName?: string; // If subcontratado
  phone: string;
  email: string;
  role: string;
  notes?: string;
  associatedObraId: string; // Prefilled obra context
  documentsChecklist: DocumentState[];
}

export function getObraOverheadAllocationMap(
  obras: Obra[],
  totalCompanyOverhead: number
): Record<string, { percent: number; amount: number }> {
  const map: Record<string, { percent: number; amount: number }> = {};
  if (obras.length === 0) return map;

  // 1. Find custom allocations
  let sumCustomPercent = 0;
  const customAllocations = obras.map(o => {
    const isCustom = o.overheadAllocationType === 'custom' && typeof o.overrideOverheadPercent === 'number';
    const rawPercent = isCustom ? (o.overrideOverheadPercent || 0) / 100 : 0;
    return {
      id: o.id,
      isCustom,
      rawPercent
    };
  });

  customAllocations.forEach(c => {
    if (c.isCustom) {
      sumCustomPercent += c.rawPercent;
    }
  });

  // Scale custom allocations if they exceed 100%
  const scaleCustomFactor = sumCustomPercent > 1 ? (1 / sumCustomPercent) : 1;
  const finalCustomSum = sumCustomPercent > 1 ? 1 : sumCustomPercent;
  const remainingPercentForAuto = Math.max(0, 1 - finalCustomSum);

  // 2. Auto allocations based on budget
  const autoObras = obras.filter(o => {
    const c = customAllocations.find(ca => ca.id === o.id);
    return !c?.isCustom;
  });

  const totalBudgetOfAutoObras = autoObras.reduce((sum, o) => sum + o.budget, 0);

  obras.forEach(o => {
    const c = customAllocations.find(ca => ca.id === o.id);
    let finalPercent = 0;

    if (c?.isCustom) {
      finalPercent = c.rawPercent * scaleCustomFactor;
    } else {
      if (totalBudgetOfAutoObras > 0) {
        const budgetRatio = o.budget / totalBudgetOfAutoObras;
        finalPercent = budgetRatio * remainingPercentForAuto;
      } else if (autoObras.length > 0) {
        finalPercent = (1 / autoObras.length) * remainingPercentForAuto;
      }
    }

    map[o.id] = {
      percent: finalPercent,
      amount: finalPercent * totalCompanyOverhead
    };
  });

  return map;
}

export interface MonthlyOverheadAllocation {
  monthKey: string; // e.g. "2026-09"
  monthLabel: string; // e.g. "Septiembre 2026"
  year: number;
  monthNumber: number; // 1-12
  totalOverhead: number;
  gastosCount: number;
  allocationsByObra: Record<string, { percent: number; amount: number }>;
}

export interface ObraMonthlySummary {
  obraId: string;
  obraName: string;
  budget: number;
  isCustom: boolean;
  configuredPercent: number;
  totalAllocated: number;
  monthlyAmounts: Record<string, number>; // monthKey -> allocated amount
  monthlyPercents: Record<string, number>; // monthKey -> allocated percent (0-1)
}

export function formatMonthKeyToLabel(monthKey: string): string {
  if (!monthKey || monthKey.length < 7) return monthKey || '';
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month)) return monthKey;
  
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const name = monthNames[month - 1] || monthStr;
  return `${name} ${year}`;
}

export function getMonthlyOverheadAllocationBreakdown(
  gastos: OtrosGasto[],
  obras: Obra[]
): {
  monthlyList: MonthlyOverheadAllocation[];
  obraSummaries: ObraMonthlySummary[];
  totalGlobalOverhead: number;
  allMonthKeys: string[];
} {
  const totalGlobalOverhead = gastos.reduce((sum, g) => sum + (Number(g.amount) || 0), 0);
  
  // 1. Group gastos by month (YYYY-MM)
  const monthMap: Record<string, { total: number; count: number; gastos: OtrosGasto[] }> = {};

  gastos.forEach(g => {
    let mKey = '';
    if (g.date && g.date.length >= 7) {
      mKey = g.date.substring(0, 7);
    } else {
      const now = new Date();
      mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!monthMap[mKey]) {
      monthMap[mKey] = { total: 0, count: 0, gastos: [] };
    }
    monthMap[mKey].total += (Number(g.amount) || 0);
    monthMap[mKey].count += 1;
    monthMap[mKey].gastos.push(g);
  });

  // Ensure current month is present if gastos is empty
  if (Object.keys(monthMap).length === 0) {
    const now = new Date();
    const currKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthMap[currKey] = { total: 0, count: 0, gastos: [] };
  }

  // Sort months descending (most recent first)
  const sortedMonthKeys = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));

  // 2. Build monthly allocations
  const monthlyList: MonthlyOverheadAllocation[] = sortedMonthKeys.map(mKey => {
    const [yStr, mStr] = mKey.split('-');
    const year = parseInt(yStr, 10) || new Date().getFullYear();
    const monthNumber = parseInt(mStr, 10) || 1;
    const monthTotal = monthMap[mKey]?.total || 0;
    const count = monthMap[mKey]?.count || 0;

    const allocationsByObra = getObraOverheadAllocationMap(obras, monthTotal);

    return {
      monthKey: mKey,
      monthLabel: formatMonthKeyToLabel(mKey),
      year,
      monthNumber,
      totalOverhead: monthTotal,
      gastosCount: count,
      allocationsByObra
    };
  });

  // 3. Build per-obra cross-month summaries
  const obraSummaries: ObraMonthlySummary[] = obras.map(obra => {
    const isCustom = obra.overheadAllocationType === 'custom' && typeof obra.overrideOverheadPercent === 'number';
    const configuredPercent = isCustom ? (obra.overrideOverheadPercent || 0) : 0;
    
    let totalAllocated = 0;
    const monthlyAmounts: Record<string, number> = {};
    const monthlyPercents: Record<string, number> = {};

    monthlyList.forEach(m => {
      const alloc = m.allocationsByObra[obra.id] || { percent: 0, amount: 0 };
      monthlyAmounts[m.monthKey] = alloc.amount;
      monthlyPercents[m.monthKey] = alloc.percent;
      totalAllocated += alloc.amount;
    });

    return {
      obraId: obra.id,
      obraName: obra.name,
      budget: obra.budget,
      isCustom,
      configuredPercent,
      totalAllocated,
      monthlyAmounts,
      monthlyPercents
    };
  });

  return {
    monthlyList,
    obraSummaries,
    totalGlobalOverhead,
    allMonthKeys: sortedMonthKeys
  };
}

export function getProratedPersonalCost(
  p: PersonalCost,
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined
): PersonalCost & {
  originalTotalCost: number;
  originalHours: number;
  prorationFactor: number;
  totalDays: number;
  overlapDays: number;
  hasProration: boolean;
  costStartStr: string;
  costEndStr: string;
} {
  // Determine coverage period S to E
  let costStartStr = p.startDate;
  let costEndStr = p.endDate;

  if (!costStartStr || !costEndStr) {
    if (p.costType === 'mensual') {
      // Default to the full month of p.date
      const parts = p.date.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1]; // e.g. "06"
        // Get number of days in this month
        const lastDayNum = new Date(Number(year), Number(month), 0).getDate();
        costStartStr = `${year}-${month}-01`;
        costEndStr = `${year}-${month}-${lastDayNum < 10 ? '0' + lastDayNum : lastDayNum}`;
      } else {
        costStartStr = p.date;
        costEndStr = p.date;
      }
    } else {
      costStartStr = p.date;
      costEndStr = p.date;
    }
  }

  // Parse dates as local dates to avoid time zone issues
  const parseLocalYMD = (str: string) => {
    const parts = str.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };

  const costStart = parseLocalYMD(costStartStr);
  const costEnd = parseLocalYMD(costEndStr);

  const reportStart = startDateStr ? parseLocalYMD(startDateStr) : parseLocalYMD('2000-01-01');
  const reportEnd = endDateStr ? parseLocalYMD(endDateStr) : parseLocalYMD('2099-12-31');

  // Total days in the cost record period
  const totalDays = Math.round((costEnd.getTime() - costStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Overlap
  const overlapStart = new Date(Math.max(costStart.getTime(), reportStart.getTime()));
  const overlapEnd = new Date(Math.min(costEnd.getTime(), reportEnd.getTime()));

  let overlapDays = 0;
  if (overlapStart <= overlapEnd) {
    overlapDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  // If there are no report dates, it's 100% (prorationFactor = 1.0)
  const isFiltered = !!(startDateStr || endDateStr);
  const prorationFactor = isFiltered ? (totalDays > 0 ? Math.min(1.0, Math.max(0.0, overlapDays / totalDays)) : 0) : 1.0;
  
  const proratedCost = Number((p.totalCost * prorationFactor).toFixed(2));
  const proratedHours = Number((p.hours * prorationFactor).toFixed(2));

  return {
    ...p,
    totalCost: proratedCost,
    hours: proratedHours,
    originalTotalCost: p.totalCost,
    originalHours: p.hours,
    prorationFactor,
    totalDays,
    overlapDays: isFiltered ? overlapDays : totalDays,
    hasProration: isFiltered && prorationFactor < 1.0,
    costStartStr,
    costEndStr,
  };
}

export interface ObraExportPackageSummary {
  totalObras: number;
  totalBudget: number;
  totalDocumentosCount: number;
  totalDocumentosAmount: number;
  totalPersonalCount: number;
  totalPersonalCost: number;
  totalDirectCost: number;
}

export interface ObraExportPackage {
  app: 'UniProyect' | 'DHG_Obras' | string;
  version: string;
  packageType: 'single_obra' | 'multi_obra';
  exportDate: string;
  exportedBy?: string;
  obra?: Obra; // Present if single_obra
  obras?: Obra[]; // Array of obras
  documentos: FacturaAlbaran[];
  personal: PersonalCost[];
  proveedores?: Proveedor[];
  trabajadores?: TrabajadorPRL[];
  trabajadoresEmpresa?: TrabajadorEmpresa[];
  summary?: ObraExportPackageSummary;
}

