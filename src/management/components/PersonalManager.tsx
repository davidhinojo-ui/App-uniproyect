/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PersonalCost, Obra, TrabajadorEmpresa } from '../types';
import { 
  Plus, 
  Search, 
  Users, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Percent, 
  UserCheck, 
  Clock, 
  Building2, 
  Sparkles, 
  Edit2, 
  Briefcase, 
  Phone, 
  Check, 
  ArrowRight,
  ShieldAlert,
  CreditCard,
  UserPlus,
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  Copy,
  CheckCheck,
  RefreshCw,
  Layers,
  Calendar,
  Share2
} from 'lucide-react';

interface PersonalManagerProps {
  personal: PersonalCost[];
  obras: Obra[];
  trabajadoresEmpresa?: TrabajadorEmpresa[];
  addPersonal: (p: PersonalCost) => void;
  deletePersonal: (id: string) => void;
  updatePersonal: (p: PersonalCost) => void;
  addTrabajadorEmpresa?: (t: TrabajadorEmpresa) => void;
  updateTrabajadorEmpresa?: (t: TrabajadorEmpresa) => void;
  deleteTrabajadorEmpresa?: (id: string) => void;
  importTrabajadoresEmpresa?: (list: TrabajadorEmpresa[], mode?: 'merge' | 'replace') => void;
}

const CONST_ROLES = [
  'Oficial de 1ª Encofrador',
  'Oficial de 1ª Albañil',
  'Oficial de 1ª Carpintero',
  'Oficial de 1ª Electricista',
  'Oficial de 1ª Fontanero',
  'Oficial de 1ª Plaquista',
  'Oficial de 1ª Pintor',
  'Oficial de 2ª Albañil',
  'Encargado de Obra',
  'Jefe de Obra',
  'Peón Especialista',
  'Peón Ordinario',
  'Maquinista de Retroexcavadora',
  'Gruista',
  'Administrativo / Contable de Oficina',
  'Director de Oficina / Gerencia',
  'Técnico de Presupuestos / Estudios',
  'Delineante / Ingeniero de Oficina',
  'Otro Técnico de Edificación'
];

// --- WORKING DAYS CALCULATION UTILITY ---
const calculateWorkingDays = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
  if (startDate > endDate) return 0;

  let count = 0;
  const curDate = new Date(startDate.getTime());
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      count++;
    }
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
};

export default function PersonalManager({
  personal,
  obras,
  trabajadoresEmpresa = [],
  addPersonal,
  deletePersonal,
  updatePersonal,
  addTrabajadorEmpresa,
  updateTrabajadorEmpresa,
  deleteTrabajadorEmpresa,
  importTrabajadoresEmpresa,
}: PersonalManagerProps) {
  // Navigation sub-tab: 'partes' (registro de gastos en obra) | 'plantilla' (registro maestro de trabajadores)
  const [activeSubTab, setActiveSubTab] = useState<'partes' | 'plantilla'>('partes');

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedObraFilter, setSelectedObraFilter] = useState('all');

  // Master worker catalog modal state
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editingWorkerCatalog, setEditingWorkerCatalog] = useState<TrabajadorEmpresa | null>(null);
  const [workerCatalogSearch, setWorkerCatalogSearch] = useState('');

  // Fields for Master Worker Catalog Modal
  const [modalWorkerName, setModalWorkerName] = useState('');
  const [modalWorkerRole, setModalWorkerRole] = useState(CONST_ROLES[0]);
  const [modalDailyRate, setModalDailyRate] = useState<number>(95);
  const [modalOvertimeRate, setModalOvertimeRate] = useState<number>(18);
  const [modalStandardHourlyRate, setModalStandardHourlyRate] = useState<number>(14);
  const [modalDni, setModalDni] = useState('');
  const [modalPhone, setModalPhone] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalDefaultObra, setModalDefaultObra] = useState<string>(obras[0]?.id || '');
  const [modalNotes, setModalNotes] = useState('');

  // Selected worker from catalog to quick fill
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');

  // Form fields for PersonalCost
  const [workerName, setWorkerName] = useState('');
  const [obraId, setObraId] = useState(obras[0]?.id || 'structural');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [role, setRole] = useState(CONST_ROLES[1]);
  const [notes, setNotes] = useState('');

  // Cost type: 'jornal' (default para obra) | 'horas' | 'mensual'
  const [costType, setCostType] = useState<'horas' | 'jornal' | 'mensual'>('jornal');

  // Rate & Time variables
  const [hours, setHours] = useState<number>(8);
  const [hourlyRate, setHourlyRate] = useState<number>(18);

  const [jornales, setJornales] = useState<number>(1);
  const [jornalRate, setJornalRate] = useState<number>(95);

  // Overtime Tracking
  const [overtimeHours, setOvertimeHours] = useState<number>(0);
  const [overtimeRate, setOvertimeRate] = useState<number>(18);

  const [monthlyBase, setMonthlyBase] = useState<number>(1950);

  // Social Security & IRPF
  const [socialSecurityRate, setSocialSecurityRate] = useState<number>(32.5);
  const [socialSecurityAmount, setSocialSecurityAmount] = useState<number>(0);
  const [irpfRate, setIrpfRate] = useState<number>(15.0);
  const [irpfAmount, setIrpfAmount] = useState<number>(0);
  const [netSalary, setNetSalary] = useState<number>(0);
  const [autoCalculate, setAutoCalculate] = useState<boolean>(true);

  // Editing state for PersonalCost
  const [editingItem, setEditingItem] = useState<PersonalCost | null>(null);

  // Table expanded row state
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Quick preset feedback flash
  const [appliedWorkerPreset, setAppliedWorkerPreset] = useState<string | null>(null);

  // Import / Export Modal state
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [importExportTab, setImportExportTab] = useState<'export' | 'import'>('export');
  const [importText, setImportText] = useState('');
  const [parsedImportWorkers, setParsedImportWorkers] = useState<TrabajadorEmpresa[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Obra Selector Modal for a worker
  const [quickObraWorker, setQuickObraWorker] = useState<TrabajadorEmpresa | null>(null);

  // Helper to get stats of which obras a worker worked on (e.g. this month or all)
  const getWorkerObrasHistory = (workerName: string) => {
    const records = personal.filter(p => p.workerName.toLowerCase().trim() === workerName.toLowerCase().trim());
    const obraMap: Record<string, { obraId: string; obraName: string; count: number; totalCost: number; overtimeHours: number }> = {};
    
    records.forEach(r => {
      const oName = r.obraId === 'structural' 
        ? 'Estructura / Oficina' 
        : (obras.find(o => o.id === r.obraId)?.name || 'Obra Desconocida');
      
      if (!obraMap[r.obraId]) {
        obraMap[r.obraId] = {
          obraId: r.obraId,
          obraName: oName,
          count: 0,
          totalCost: 0,
          overtimeHours: 0
        };
      }
      obraMap[r.obraId].count += 1;
      obraMap[r.obraId].totalCost += r.totalCost;
      obraMap[r.obraId].overtimeHours += (r.overtimeHours || 0);
    });

    return Object.values(obraMap);
  };

  // --- EXPORT HANDLERS ---
  const handleExportJSON = () => {
    try {
      const dataToExport = {
        app: 'UniProyect',
        version: '2.5.0',
        exportType: 'plantilla_trabajadores',
        exportDate: new Date().toISOString(),
        totalTrabajadores: trabajadoresEmpresa.length,
        trabajadores: trabajadoresEmpresa
      };

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_trabajadores_empresa_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Error al exportar plantilla en JSON');
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ['Nombre y Apellidos', 'Especialidad', 'Cobra al Dia (EUR)', 'Precio Hora Extra (EUR)', 'Precio Hora Normal (EUR)', 'DNI / NIF', 'Telefono', 'Email', 'Obra Habitual', 'Notas'];
      
      const rows = trabajadoresEmpresa.map(t => {
        const obraName = t.defaultObraId ? (obras.find(o => o.id === t.defaultObraId)?.name || '') : '';
        return [
          `"${(t.name || '').replace(/"/g, '""')}"`,
          `"${(t.role || '').replace(/"/g, '""')}"`,
          (t.dailyRate || 0).toFixed(2),
          (t.overtimeHourlyRate || 0).toFixed(2),
          (t.standardHourlyRate || 0).toFixed(2),
          `"${(t.dni || '').replace(/"/g, '""')}"`,
          `"${(t.phone || '').replace(/"/g, '""')}"`,
          `"${(t.email || '').replace(/"/g, '""')}"`,
          `"${obraName.replace(/"/g, '""')}"`,
          `"${(t.notes || '').replace(/"/g, '""')}"`
        ].join(';');
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_trabajadores_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Error al exportar plantilla en CSV');
    }
  };

  const handleCopyJSON = async () => {
    try {
      const dataToExport = {
        app: 'UniProyect',
        version: '2.5.0',
        exportType: 'plantilla_trabajadores',
        exportDate: new Date().toISOString(),
        totalTrabajadores: trabajadoresEmpresa.length,
        trabajadores: trabajadoresEmpresa
      };
      await navigator.clipboard.writeText(JSON.stringify(dataToExport, null, 2));
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 3000);
    } catch (e) {
      console.error(e);
      alert('No se pudo copiar al portapapeles');
    }
  };

  // --- IMPORT PARSERS ---
  const parseJSONText = (text: string): TrabajadorEmpresa[] => {
    const parsed = JSON.parse(text);
    let list: any[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && Array.isArray(parsed.trabajadores)) {
      list = parsed.trabajadores;
    } else if (parsed && Array.isArray(parsed.plantilla)) {
      list = parsed.plantilla;
    } else {
      throw new Error('El archivo JSON no contiene una lista válida de trabajadores.');
    }

    return list.map((item, idx) => ({
      id: item.id || `trab-emp-imp-${Date.now()}-${idx}`,
      name: String(item.name || item.nombre || '').trim(),
      role: String(item.role || item.categoria || item.especialidad || CONST_ROLES[0]).trim(),
      dailyRate: Number(item.dailyRate ?? item.jornal ?? item.precioDia ?? 95) || 95,
      overtimeHourlyRate: Number(item.overtimeHourlyRate ?? item.horaExtra ?? item.precioHoraExtra ?? 18) || 18,
      standardHourlyRate: item.standardHourlyRate ? Number(item.standardHourlyRate) : undefined,
      dni: item.dni || item.nif || undefined,
      phone: item.phone || item.telefono || undefined,
      email: item.email || undefined,
      defaultObraId: item.defaultObraId || undefined,
      notes: item.notes || item.notas || undefined,
      active: item.active !== false
    })).filter(t => t.name.length > 0);
  };

  const parseCSVText = (text: string): TrabajadorEmpresa[] => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error('El archivo CSV está vacío o solo contiene cabeceras.');
    }

    // Determine delimiter (; or ,)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const result: TrabajadorEmpresa[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      // Basic CSV token parser handling quotes
      const tokens: string[] = [];
      let inQuotes = false;
      let token = '';
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
          tokens.push(token.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          token = '';
        } else {
          token += ch;
        }
      }
      tokens.push(token.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

      const name = tokens[0] || '';
      if (!name) continue;

      const role = tokens[1] || CONST_ROLES[0];
      const dailyRate = parseFloat((tokens[2] || '95').replace(',', '.')) || 95;
      const overtimeHourlyRate = parseFloat((tokens[3] || '18').replace(',', '.')) || 18;
      const standardHourlyRate = tokens[4] ? parseFloat(tokens[4].replace(',', '.')) : undefined;
      const dni = tokens[5] || undefined;
      const phone = tokens[6] || undefined;
      const email = tokens[7] || undefined;
      const notes = tokens[9] || undefined;

      result.push({
        id: `trab-emp-csv-${Date.now()}-${i}`,
        name,
        role,
        dailyRate,
        overtimeHourlyRate,
        standardHourlyRate,
        dni,
        phone,
        email,
        notes,
        active: true
      });
    }

    return result;
  };

  const handleProcessImportInput = (rawText: string) => {
    setImportError(null);
    setParsedImportWorkers([]);
    const clean = rawText.trim();
    if (!clean) return;

    try {
      if (clean.startsWith('{') || clean.startsWith('[')) {
        const res = parseJSONText(clean);
        if (res.length === 0) throw new Error('No se detectaron trabajadores válidos en el JSON.');
        setParsedImportWorkers(res);
      } else {
        const res = parseCSVText(clean);
        if (res.length === 0) throw new Error('No se detectaron trabajadores válidos en el CSV.');
        setParsedImportWorkers(res);
      }
    } catch (err: any) {
      setImportError(err.message || 'Error al procesar el archivo o texto');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
      handleProcessImportInput(text);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (parsedImportWorkers.length === 0) {
      alert('No hay trabajadores preparados para importar.');
      return;
    }

    if (importTrabajadoresEmpresa) {
      importTrabajadoresEmpresa(parsedImportWorkers, importMode);
    } else if (addTrabajadorEmpresa) {
      parsedImportWorkers.forEach(w => addTrabajadorEmpresa(w));
    }

    alert(`¡Éxito! Se han importado ${parsedImportWorkers.length} operarios a la plantilla.`);
    setShowImportExportModal(false);
    setParsedImportWorkers([]);
    setImportText('');
    setImportError(null);
  };

  // When clicking on a worker from the master catalog to quick-fill
  const handleSelectCatalogWorker = (workerId: string) => {
    setSelectedCatalogId(workerId);
    const found = trabajadoresEmpresa.find(t => t.id === workerId);
    if (found) {
      setWorkerName(found.name);
      setRole(found.role);
      setJornalRate(found.dailyRate || 95);
      setOvertimeRate(found.overtimeHourlyRate || 18);
      if (found.standardHourlyRate) {
        setHourlyRate(found.standardHourlyRate);
      } else {
        setHourlyRate(Math.round(found.dailyRate / 8) || 15);
      }
      if (found.defaultObraId && obras.some(o => o.id === found.defaultObraId)) {
        setObraId(found.defaultObraId);
      }

      setAppliedWorkerPreset(found.name);
      setTimeout(() => setAppliedWorkerPreset(null), 4000);
    }
  };

  // Open the form directly for a specific worker
  const handleQuickAddForWorker = (worker: TrabajadorEmpresa) => {
    setActiveSubTab('partes');
    setShowForm(true);
    setEditingItem(null);
    setSelectedCatalogId(worker.id);
    setWorkerName(worker.name);
    setRole(worker.role);
    setJornalRate(worker.dailyRate);
    setOvertimeRate(worker.overtimeHourlyRate);
    setHourlyRate(worker.standardHourlyRate || Math.round(worker.dailyRate / 8) || 15);
    if (worker.defaultObraId && obras.some(o => o.id === worker.defaultObraId)) {
      setObraId(worker.defaultObraId);
    } else if (obras.length > 0) {
      setObraId(obras[0].id);
    }
    setCostType('jornal');
    setJornales(1);
    setOvertimeHours(0);
    setDate(new Date().toISOString().split('T')[0]);
    setAutoCalculate(true);
    setAppliedWorkerPreset(worker.name);
    setTimeout(() => setAppliedWorkerPreset(null), 4000);
  };

  // Open worker modal for create/edit
  const handleOpenWorkerModal = (worker?: TrabajadorEmpresa) => {
    if (worker) {
      setEditingWorkerCatalog(worker);
      setModalWorkerName(worker.name);
      setModalWorkerRole(worker.role);
      setModalDailyRate(worker.dailyRate);
      setModalOvertimeRate(worker.overtimeHourlyRate);
      setModalStandardHourlyRate(worker.standardHourlyRate || (worker.dailyRate ? Number((worker.dailyRate / 8).toFixed(2)) : 18.0));
      setModalDni(worker.dni || '');
      setModalPhone(worker.phone || '');
      setModalEmail(worker.email || '');
      setModalDefaultObra(worker.defaultObraId || (obras[0]?.id || ''));
      setModalNotes(worker.notes || '');
    } else {
      setEditingWorkerCatalog(null);
      setModalWorkerName('');
      setModalWorkerRole(CONST_ROLES[0]);
      setModalDailyRate(148);
      setModalOvertimeRate(24);
      setModalStandardHourlyRate(18.5);
      setModalDni('');
      setModalPhone('');
      setModalEmail('');
      setModalDefaultObra(obras[0]?.id || '');
      setModalNotes('');
    }
    setShowWorkerModal(true);
  };

  // Submit Worker to Master Catalog
  const handleSaveWorkerToCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalWorkerName.trim()) {
      alert('Por favor ingrese el nombre y apellidos del trabajador.');
      return;
    }

    const workerToSave: TrabajadorEmpresa = {
      id: editingWorkerCatalog ? editingWorkerCatalog.id : `trab-emp-${Date.now()}`,
      name: modalWorkerName.trim(),
      role: modalWorkerRole,
      dailyRate: Number(modalDailyRate) || 0,
      overtimeHourlyRate: Number(modalOvertimeRate) || 0,
      standardHourlyRate: Number(modalStandardHourlyRate) || 0,
      dni: modalDni.trim() || undefined,
      phone: modalPhone.trim() || undefined,
      email: modalEmail.trim() || undefined,
      defaultObraId: modalDefaultObra || undefined,
      notes: modalNotes.trim() || undefined,
      active: true,
    };

    if (editingWorkerCatalog) {
      if (updateTrabajadorEmpresa) {
        updateTrabajadorEmpresa(workerToSave);
      }
    } else {
      if (addTrabajadorEmpresa) {
        addTrabajadorEmpresa(workerToSave);
      }
    }

    setShowWorkerModal(false);
  };

  // Delete worker from Master Catalog
  const handleDeleteWorkerFromCatalog = (id: string, name: string) => {
    if (confirm(`¿Está seguro de eliminar a "${name}" del registro de plantilla de la empresa?`)) {
      if (deleteTrabajadorEmpresa) {
        deleteTrabajadorEmpresa(id);
      }
    }
  };

  // Sync edit form fields when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setWorkerName(editingItem.workerName);
      setObraId(editingItem.obraId);
      setDate(editingItem.date);
      setStartDate(editingItem.startDate || '');
      setEndDate(editingItem.endDate || '');
      setRole(editingItem.role);
      setNotes(editingItem.notes || '');
      setCostType(editingItem.costType || 'jornal');
      setSelectedCatalogId(editingItem.workerCatalogId || '');
      
      const ssRate = editingItem.socialSecurityRate ?? 32.5;
      const ssAmt = editingItem.socialSecurityAmount ?? 0;
      const irRate = editingItem.irpfRate ?? 15.0;
      const irAmt = editingItem.irpfAmount ?? 0;
      const nSal = editingItem.netSalary ?? 0;

      setOvertimeHours(editingItem.overtimeHours || 0);
      setOvertimeRate(editingItem.overtimeRate || 18);

      if (editingItem.costType === 'jornal') {
        setJornales(editingItem.jornales ?? Math.max(1, Math.round(editingItem.hours / 8)));
        setJornalRate(editingItem.jornalRate ?? 95);
      } else if (editingItem.costType === 'mensual') {
        setMonthlyBase(editingItem.monthlyBase ?? 1950);
      } else {
        setHours(editingItem.hours);
        setHourlyRate(editingItem.hourlyRate);
      }

      setSocialSecurityRate(ssRate);
      setSocialSecurityAmount(ssAmt);
      setIrpfRate(irRate);
      setIrpfAmount(irAmt);
      setNetSalary(nSal);
      setAutoCalculate(false);
    } else if (!selectedCatalogId) {
      // Default reset when opening clean
      setWorkerName('');
      setObraId(obras[0]?.id || 'structural');
      setDate(new Date().toISOString().split('T')[0]);
      setStartDate('');
      setEndDate('');
      setRole(CONST_ROLES[1]);
      setNotes('');
      setCostType('jornal');
      setHours(8);
      setHourlyRate(18);
      setJornales(1);
      setJornalRate(95);
      setOvertimeHours(0);
      setOvertimeRate(18);
      setMonthlyBase(1950);
      setSocialSecurityRate(32.5);
      setIrpfRate(15.0);
      setAutoCalculate(true);
    }
  }, [editingItem, obras]);

  // Auto calculate working days when startDate or endDate changes in jornal mode
  useEffect(() => {
    if (costType === 'jornal' && startDate && endDate) {
      const days = calculateWorkingDays(startDate, endDate);
      if (days > 0) {
        setJornales(days);
      }
    }
  }, [startDate, endDate, costType]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Helper to retrieve gross regular base salary + overtime cost
  const getRegularCost = (): number => {
    if (costType === 'horas') return (Number(hours) || 0) * (Number(hourlyRate) || 0);
    if (costType === 'jornal') return (Number(jornales) || 0) * (Number(jornalRate) || 0);
    if (costType === 'mensual') return Number(monthlyBase) || 0;
    return 0;
  };

  const regularCost = getRegularCost();
  const overtimeCost = (Number(overtimeHours) || 0) * (Number(overtimeRate) || 0);
  const baseSalary = regularCost + overtimeCost;

  // Dynamic computation
  useEffect(() => {
    if (autoCalculate) {
      const ssAmt = Number((baseSalary * (socialSecurityRate / 100)).toFixed(2));
      const irpfAmt = Number((baseSalary * (irpfRate / 100)).toFixed(2));
      setSocialSecurityAmount(ssAmt);
      setIrpfAmount(irpfAmt);
      setNetSalary(Number((baseSalary - irpfAmt).toFixed(2)));
    }
  }, [baseSalary, socialSecurityRate, irpfRate, autoCalculate, costType]);

  const handleSSRateChange = (rateVal: number) => {
    setAutoCalculate(true);
    setSocialSecurityRate(rateVal);
  };

  const handleSSAmountChange = (amtVal: number) => {
    setAutoCalculate(false);
    setSocialSecurityAmount(amtVal);
    if (baseSalary > 0) {
      setSocialSecurityRate(Number(((amtVal / baseSalary) * 100).toFixed(2)));
    }
  };

  const handleIRPFRateChange = (rateVal: number) => {
    setAutoCalculate(true);
    setIrpfRate(rateVal);
  };

  const handleIRPFAmountChange = (amtVal: number) => {
    setAutoCalculate(false);
    setIrpfAmount(amtVal);
    if (baseSalary > 0) {
      setIrpfRate(Number(((amtVal / baseSalary) * 100).toFixed(2)));
    }
    setNetSalary(Number((baseSalary - amtVal).toFixed(2)));
  };

  const resetToConvenioDefaults = () => {
    setAutoCalculate(true);
    setSocialSecurityRate(32.5);
    setIrpfRate(15.0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim() || !obraId) {
      alert('Por favor complete el nombre del operario y seleccione la obra de destino.');
      return;
    }

    // Standardize hours for project reporting
    let hoursStored = 0;
    let hourlyRateStored = 0;

    if (costType === 'horas') {
      hoursStored = (Number(hours) || 0) + (Number(overtimeHours) || 0);
      hourlyRateStored = Number(hourlyRate) || 0;
    } else if (costType === 'jornal') {
      hoursStored = ((Number(jornales) || 0) * 8) + (Number(overtimeHours) || 0);
      hourlyRateStored = hoursStored > 0 ? Number((baseSalary / hoursStored).toFixed(2)) : 0;
    } else {
      hoursStored = 160 + (Number(overtimeHours) || 0);
      hourlyRateStored = Number((baseSalary / hoursStored).toFixed(2));
    }

    const finalTotalCost = baseSalary + socialSecurityAmount + irpfAmount;

    const newCost: PersonalCost = {
      id: editingItem ? editingItem.id : `p-${Date.now()}`,
      obraId,
      workerName: workerName.trim(),
      date,
      role,
      hours: hoursStored,
      hourlyRate: hourlyRateStored,
      totalCost: Number(finalTotalCost.toFixed(2)),
      notes,
      startDate: costType === 'jornal' ? startDate : undefined,
      endDate: costType === 'jornal' ? endDate : undefined,
      
      // Breakdown & Overtime parameters
      costType,
      jornales: costType === 'jornal' ? Number(jornales) : undefined,
      jornalRate: costType === 'jornal' ? Number(jornalRate) : undefined,
      overtimeHours: Number(overtimeHours) || 0,
      overtimeRate: Number(overtimeRate) || 0,
      regularHoursCost: Number(regularCost.toFixed(2)),
      overtimeCost: Number(overtimeCost.toFixed(2)),
      monthlyBase: costType === 'mensual' ? Number(monthlyBase) : undefined,
      socialSecurityRate: Number(socialSecurityRate) || 0,
      socialSecurityAmount: Number(socialSecurityAmount) || 0,
      irpfRate: Number(irpfRate) || 0,
      irpfAmount: Number(irpfAmount) || 0,
      netSalary: Number(netSalary) || 0,
      baseSalary: Number(baseSalary) || 0,
      workerCatalogId: selectedCatalogId || undefined,
    };

    if (editingItem) {
      updatePersonal(newCost);
    } else {
      addPersonal(newCost);
    }

    // Reset Form fields
    setEditingItem(null);
    setSelectedCatalogId('');
    setWorkerName('');
    setNotes('');
    setHours(8);
    setJornales(1);
    setOvertimeHours(0);
    setMonthlyBase(1950);
    setStartDate('');
    setEndDate('');
    setShowForm(false);
    setAutoCalculate(true);
  };

  // Sorting state variables
  const [personalSortBy, setPersonalSortBy] = useState<'workerName' | 'role' | 'date' | 'totalCost'>('date');
  const [personalSortOrder, setPersonalSortOrder] = useState<'asc' | 'desc'>('desc');

  const handlePersonalSort = (field: 'workerName' | 'role' | 'date' | 'totalCost') => {
    if (personalSortBy === field) {
      setPersonalSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPersonalSortBy(field);
      setPersonalSortOrder('asc');
    }
  };

  const filteredPersonal = personal.filter(p => {
    const matchesSearch = p.workerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesObra = selectedObraFilter === 'all' || p.obraId === selectedObraFilter;
    return matchesSearch && matchesObra;
  }).sort((a, b) => {
    let comparison = 0;
    if (personalSortBy === 'workerName') {
      comparison = a.workerName.localeCompare(b.workerName);
    } else if (personalSortBy === 'role') {
      comparison = a.role.localeCompare(b.role);
    } else if (personalSortBy === 'date') {
      comparison = a.date.localeCompare(b.date);
    } else if (personalSortBy === 'totalCost') {
      comparison = a.totalCost - b.totalCost;
    }
    return personalSortOrder === 'asc' ? comparison : -comparison;
  });

  const filteredCatalogWorkers = trabajadoresEmpresa.filter(t => {
    return t.name.toLowerCase().includes(workerCatalogSearch.toLowerCase()) ||
           t.role.toLowerCase().includes(workerCatalogSearch.toLowerCase()) ||
           (t.dni && t.dni.toLowerCase().includes(workerCatalogSearch.toLowerCase()));
  });

  const totalCostFiltered = filteredPersonal.reduce((sum, p) => sum + p.totalCost, 0);
  const totalHoursFiltered = filteredPersonal.reduce((sum, p) => sum + p.hours, 0);
  const totalOvertimeHoursFiltered = filteredPersonal.reduce((sum, p) => sum + (p.overtimeHours || 0), 0);

  return (
    <div className="space-y-6" id="personal-manager-module">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4" id="personal-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight" id="personal-title">Personal de Obra y Plantilla</h2>
            <span className="bg-[#10B981]/15 text-[#10B981] font-bold text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
              {trabajadoresEmpresa.length} Operarios Memorizados
            </span>
          </div>
          <p className="text-xs text-white/50">
            Registro de trabajadores con jornal diario y precio de horas extras memorizados, y control de partes de obra.
          </p>
        </div>

        {/* Top Actions Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setImportExportTab('export');
              setShowImportExportModal(true);
            }}
            className="bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-3.5 rounded-xl border border-white/10 text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            id="btn-open-import-export-modal"
            title="Exportar o importar plantilla de trabajadores para compartir con compañeros"
          >
            <Share2 className="w-4 h-4 text-[#10B981]" />
            <span>Compartir / Importar</span>
          </button>

          <button
            onClick={() => handleOpenWorkerModal()}
            className="bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-3.5 rounded-xl border border-white/10 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            id="btn-add-worker-catalog"
          >
            <UserPlus className="w-4 h-4 text-[#10B981]" />
            <span>+ Añadir a Plantilla</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('partes');
              setShowForm(!showForm);
              setEditingItem(null);
            }}
            className="bg-[#10B981] hover:bg-[#10B981]/95 text-black font-extrabold py-2.5 px-4 rounded-xl shadow-lg text-xs flex items-center gap-2 transition-all cursor-pointer"
            id="btn-toggle-personal-form"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>{showForm ? 'Cerrar Formulario' : 'Imputar Gasto / Parte'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className="flex bg-[#121212] p-1 rounded-2xl border border-white/10 max-w-md" id="personal-subtabs">
        <button
          type="button"
          onClick={() => setActiveSubTab('partes')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'partes'
              ? 'bg-[#10B981] text-black shadow-md'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Partes de Gasto ({personal.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('plantilla')}
          className={`flex-1 py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'plantilla'
              ? 'bg-[#10B981] text-black shadow-md'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Plantilla de Trabajadores ({trabajadoresEmpresa.length})</span>
        </button>
      </div>

      {/* QUICK PRESET CHIPS BAR (Always visible above to one-click populate expense) */}
      {trabajadoresEmpresa.length > 0 && activeSubTab === 'partes' && (
        <div className="bg-[#151515] p-4 rounded-2xl border border-white/5 space-y-2.5 animate-fadeIn" id="quick-workers-picker-bar">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-[#10B981]" />
              <span>Acceso Rápido: Pinche un operario para imputarle un gasto</span>
            </span>
            <span className="text-[11px] text-white/40">Tarifas y horas extras memorizadas</span>
          </div>

          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1" id="quick-workers-chips">
            {trabajadoresEmpresa.map(worker => {
              const isSelected = selectedCatalogId === worker.id && showForm;
              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => handleQuickAddForWorker(worker)}
                  className={`py-2 px-3.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer text-left select-none ${
                    isSelected
                      ? 'bg-[#10B981]/20 border-[#10B981] text-white shadow-lg'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90 hover:border-[#10B981]/40'
                  }`}
                  id={`btn-quick-worker-${worker.id}`}
                >
                  <div className="w-7 h-7 rounded-lg bg-[#10B981]/20 text-[#10B981] flex items-center justify-center font-bold text-xs shrink-0">
                    {worker.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white leading-tight">{worker.name}</div>
                    <div className="text-[10px] text-white/50 font-mono flex items-center gap-1.5 mt-0.5">
                      <span className="text-[#10B981] font-bold">{worker.dailyRate}€/día</span>
                      <span>•</span>
                      <span>+{worker.overtimeHourlyRate}€/h extra</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FEEDBACK ALERT WHEN PRESET APPLIED */}
      {appliedWorkerPreset && (
        <div className="bg-[#10B981]/15 border border-[#10B981]/40 rounded-xl p-3 text-xs text-[#10B981] font-semibold flex items-center gap-2 animate-fadeIn" id="preset-applied-banner">
          <Check className="w-4 h-4 text-[#10B981]" />
          <span>
            ✨ Datos memorizados cargados con éxito para: <strong>{appliedWorkerPreset}</strong>. Seleccione la obra en curso y complete las jornadas o extras.
          </span>
        </div>
      )}

      {/* SUBTAB 1: GASTOS Y PARTES DE OBRA */}
      {activeSubTab === 'partes' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Expense Registration Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-[#151515] rounded-3xl p-6 border border-white/10 shadow-2xl grid grid-cols-1 md:grid-cols-3 gap-5 animate-fadeIn" id="personal-form">
              <div className="md:col-span-3 flex justify-between items-center border-b border-white/5 pb-3.5" id="personal-form-header">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center font-bold">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      {editingItem ? `Editar Parte de Mano de Obra: ${editingItem.workerName}` : 'Imputar Gasto de Personal a Obra'}
                    </h4>
                    <p className="text-[11px] text-white/50">Todos los datos se memorizan y se reflejan en el balance de la obra seleccionada.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setShowForm(false);
                  }}
                  className="text-white/40 hover:text-white text-xs px-2.5 py-1 bg-white/5 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {/* 1. SELECCIÓN DE TRABAJADOR MEMORIZADO O MANUAL */}
              <div className="md:col-span-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3" id="worker-selection-block">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#10B981]" />
                    <span>Seleccionar Operario Memorizado de la Empresa</span>
                  </label>
                  {selectedCatalogId && (
                    <span className="text-[11px] text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded font-mono font-bold">
                      ✓ Operario vinculado de plantilla
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] text-white/50 mb-1">Elegir de la Plantilla:</label>
                    <select
                      className="w-full bg-[#1E1E1E] rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#10B981] font-bold"
                      value={selectedCatalogId}
                      onChange={(e) => handleSelectCatalogWorker(e.target.value)}
                    >
                      <option value="">-- Introducir Manualmente --</option>
                      {trabajadoresEmpresa.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.role} - {t.dailyRate}€/día)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] text-white/50 mb-1">Nombre y Apellidos del Operario *</label>
                    <input
                      type="text"
                      required
                      className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] font-bold"
                      placeholder="Ej. Juan Gómez Real"
                      value={workerName}
                      onChange={(e) => {
                        setWorkerName(e.target.value);
                        setSelectedCatalogId('');
                      }}
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] text-white/50 mb-1">Especialidad / Categoría</label>
                    <select
                      className="w-full bg-[#1E1E1E] rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981]"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      {CONST_ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. SELECCIÓN DE OBRA EN CURSO (Pinchar y elegir la obra) */}
              <div className="md:col-span-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-3" id="obra-selection-block">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#10B981]" />
                    <span>Obra en Curso de Destino (Pinche para asignar el gasto) *</span>
                  </label>
                  <span className="text-[11px] text-white/40 font-mono">
                    Seleccionada: <strong>{obraId === 'structural' ? 'Estructura / Oficina' : (obras.find(o => o.id === obraId)?.name || 'Sin obra')}</strong>
                  </span>
                </div>

                {/* Visual Cards to Click and Choose the Obra */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5" id="obra-interactive-picker">
                  {obras.map(o => {
                    const isSelected = obraId === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setObraId(o.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#10B981]/20 border-[#10B981] shadow-lg ring-1 ring-[#10B981]'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                        }`}
                        id={`btn-select-obra-${o.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-[#10B981] text-black' : 'bg-white/10 text-white/60'
                          }`}>
                            {o.status === 'active' ? 'En Curso' : o.status === 'on_hold' ? 'En Pausa' : 'Finalizada'}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-[#10B981]" />}
                        </div>
                        <div className="font-extrabold text-white text-xs truncate" title={o.name}>
                          {o.name}
                        </div>
                        <div className="text-[10px] text-white/40 font-mono truncate">
                          {o.location || 'Obra activa'}
                        </div>
                      </button>
                    );
                  })}

                  {/* Structural / General overhead option */}
                  <button
                    type="button"
                    onClick={() => setObraId('structural')}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                      obraId === 'structural'
                        ? 'bg-[#10B981]/20 border-[#10B981] shadow-lg ring-1 ring-[#10B981]'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                    }`}
                    id="btn-select-obra-structural"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                        obraId === 'structural' ? 'bg-[#10B981] text-black' : 'bg-white/10 text-white/60'
                      }`}>
                        Gasto General
                      </span>
                      {obraId === 'structural' && <Check className="w-4 h-4 text-[#10B981]" />}
                    </div>
                    <div className="font-extrabold text-white text-xs truncate">
                      🏢 Estructura / Oficina
                    </div>
                    <div className="text-[10px] text-white/40 font-mono">
                      Gasto Indirecto Empresa
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. FECHA Y MODALIDAD DE CÓMPUTO */}
              <div id="form-worker-date">
                <label className="block text-xs font-semibold text-white/60 mb-1">Fecha de Imputación / Jornada</label>
                <input
                  type="date"
                  className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="md:col-span-2 flex flex-col justify-end" id="form-worker-costype-tabs">
                <label className="text-xs font-semibold text-white/60 mb-1">Modalidad de Cómputo *</label>
                <div className="grid grid-cols-3 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setCostType('jornal')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      costType === 'jornal' ? 'bg-[#10B981] text-black font-black' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    📅 Por Jornal Diario (€/día)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCostType('horas')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      costType === 'horas' ? 'bg-[#10B981] text-black font-black' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    ⏱️ Por Horas (€/h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCostType('mensual')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      costType === 'mensual' ? 'bg-[#10B981] text-black font-black' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    💼 Salario Mensual
                  </button>
                </div>
              </div>

              {/* 4. CÁLCULO DE JORNAL + HORAS EXTRAS */}
              {costType === 'jornal' && (
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#121212] p-4 rounded-2xl border border-white/5" id="jornal-calc-panel">
                  <div>
                    <label className="block text-xs font-semibold text-white/60 mb-1">Número de Jornales (Días) *</label>
                    <input
                      type="number"
                      required
                      min="0.5"
                      step="0.5"
                      max="365"
                      className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono font-bold text-lg"
                      value={jornales || ''}
                      onChange={(e) => setJornales(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-white/40 block mt-1">1 jornal = 1 día de obra</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/60 mb-1">Tarifa Jornal Diario (€/día) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="1"
                        max="1000"
                        step="1"
                        className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono font-bold text-lg pr-7"
                        value={jornalRate || ''}
                        onChange={(e) => setJornalRate(Number(e.target.value))}
                      />
                      <span className="absolute right-2.5 top-2 text-xs font-mono text-white/40">€</span>
                    </div>
                    <span className="text-[10px] text-[#10B981] block mt-1 font-bold">Subtotal: {regularCost.toFixed(2)} €</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">Horas Extras Realizadas</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full bg-amber-500/10 rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-400 font-mono font-bold text-lg"
                      value={overtimeHours || 0}
                      onChange={(e) => setOvertimeHours(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-white/40 block mt-1">Horas fuera de jornada</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">Precio Hora Extra (€/h)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="500"
                        step="0.5"
                        className="w-full bg-amber-500/10 rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-400 font-mono font-bold text-lg pr-7"
                        value={overtimeRate || 0}
                        onChange={(e) => setOvertimeRate(Number(e.target.value))}
                      />
                      <span className="absolute right-2.5 top-2 text-xs font-mono text-amber-400">€</span>
                    </div>
                    <span className="text-[10px] text-amber-400 block mt-1 font-bold">Extras: +{overtimeCost.toFixed(2)} €</span>
                  </div>

                  {/* Date range optional helper */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-white/40 mb-1">Rango Opcional (Fecha inicio / fin):</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className="w-full bg-white/5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white font-mono"
                        placeholder="Desde"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                      <input
                        type="date"
                        className="w-full bg-white/5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white font-mono"
                        placeholder="Hasta"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-end bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="text-right">
                      <span className="text-[10px] text-white/40 uppercase block">Base Total Devengada:</span>
                      <span className="text-base font-black font-mono text-white">
                        {baseSalary.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* POR HORAS */}
              {costType === 'horas' && (
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#121212] p-4 rounded-2xl border border-white/5">
                  <div>
                    <label className="block text-xs font-semibold text-white/60 mb-1">Horas Ordinarias *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="500"
                      className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono font-bold text-lg"
                      value={hours || ''}
                      onChange={(e) => setHours(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/60 mb-1">Coste Hora Ordinaria (€) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="1000"
                      step="0.5"
                      className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono font-bold text-lg"
                      value={hourlyRate || ''}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">Horas Extras</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full bg-amber-500/10 rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-400 font-mono font-bold text-lg"
                      value={overtimeHours || 0}
                      onChange={(e) => setOvertimeHours(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">Precio Hora Extra (€/h)</label>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="0.5"
                      className="w-full bg-amber-500/10 rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-400 font-mono font-bold text-lg"
                      value={overtimeRate || 0}
                      onChange={(e) => setOvertimeRate(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {/* MENSUAL */}
              {costType === 'mensual' && (
                <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#121212] p-4 rounded-2xl border border-white/5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-white/60 mb-1">Salario Base Mensual Bruto (€) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="10000"
                      step="10"
                      className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono font-bold text-lg"
                      value={monthlyBase || ''}
                      onChange={(e) => setMonthlyBase(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1">Horas Extras Realizadas</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-full bg-amber-500/10 rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-200 focus:outline-none font-mono font-bold text-lg"
                      value={overtimeHours || 0}
                      onChange={(e) => setOvertimeHours(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              {/* 5. IMPUESTOS Y COTIZACIÓN (SS E IRPF) */}
              <div className="md:col-span-3 bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3" id="form-worker-tax-ss-block">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      🛡️ Cotización Social e Impuestos (S.S. e IRPF)
                    </span>
                    <p className="text-[10px] text-white/40">Coste de Seguridad Social a cargo de empresa e IRPF aplicable.</p>
                  </div>
                  <button
                    type="button"
                    onClick={resetToConvenioDefaults}
                    className="bg-white/10 hover:bg-white/15 text-white/80 py-1 px-2.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    ⚖️ Convenio (32.5% SS / 15% IRPF)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Social Security */}
                  <div className="bg-[#121212] rounded-xl p-3 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-white/80">Seguro Social Empresa (SS)</label>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded">Coste Empresa</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-white/40 block mb-0.5">Porcentaje (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono"
                          value={socialSecurityRate}
                          onChange={(e) => handleSSRateChange(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 block mb-0.5">Importe (€)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono"
                          value={socialSecurityAmount}
                          onChange={(e) => handleSSAmountChange(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* IRPF */}
                  <div className="bg-[#121212] rounded-xl p-3 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-white/80">Retención de I.R.P.F.</label>
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-1.5 py-0.5 rounded">Retención</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-white/40 block mb-0.5">Porcentaje (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono"
                          value={irpfRate}
                          onChange={(e) => handleIRPFRateChange(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 block mb-0.5">Importe (€)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono"
                          value={irpfAmount}
                          onChange={(e) => handleIRPFAmountChange(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Final Computation Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#1b1b1b] p-3.5 rounded-xl text-xs font-mono">
                  <div>
                    <span className="text-white/40 text-[10px] block">Base Regular:</span>
                    <span className="text-white font-bold">{regularCost.toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-amber-400 text-[10px] block">Horas Extras ({overtimeHours}h):</span>
                    <span className="text-amber-400 font-bold">+{overtimeCost.toFixed(2)} €</span>
                  </div>
                  <div>
                    <span className="text-emerald-400 text-[10px] block">Seg. Social (+):</span>
                    <span className="text-emerald-400 font-bold">+{socialSecurityAmount.toFixed(2)} €</span>
                  </div>
                  <div className="border-l border-white/10 pl-2">
                    <span className="text-[#10B981] text-[10px] font-black uppercase block">Cargo Total Obra:</span>
                    <span className="text-[#10B981] font-black text-sm">{(baseSalary + socialSecurityAmount + irpfAmount).toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* 6. NOTAS */}
              <div className="md:col-span-3" id="form-worker-notes-wrapper">
                <label className="block text-xs font-semibold text-white/60 mb-1">Notas / Detalles del parte (ej. tareas ejecutadas, mediciones)</label>
                <input
                  type="text"
                  className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981]"
                  placeholder="Ej. Encofrado de pilares planta baja, 2h extra para hormigonado..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* 7. SUBMIT BUTTON */}
              <div className="md:col-span-3 flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-white/5" id="form-worker-subtotal">
                <div className="text-xs text-white/60">
                  <span>Cargo Real a la Obra: </span>
                  <strong className="font-mono text-[#10B981] font-black text-base ml-1">
                    {(baseSalary + socialSecurityAmount + irpfAmount).toFixed(2)} €
                  </strong>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setShowForm(false);
                    }}
                    className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none bg-[#10B981] hover:bg-[#10B981]/90 text-black font-black py-2.5 px-6 rounded-xl text-xs cursor-pointer shadow-lg transition-all"
                    id="btn-save-personal-cost"
                  >
                    Guardar Gasto de Personal
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* FILTERS & SEARCH BAR */}
          <div className="bg-[#151515] rounded-2xl p-4 border border-white/5 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center shadow-sm" id="personal-filters">
            <div className="relative flex-1" id="p-search-wrapper">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar partes por operario o puesto..."
                className="w-full bg-white/5 rounded-xl border border-white/10 pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#10B981]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-2 items-center" id="p-obra-filter-wrapper">
              <label className="text-xs text-white/50 shrink-0 font-medium">Filtrar por obra:</label>
              <select
                className="bg-[#1E1E1E] rounded-xl border border-white/10 text-xs text-white p-2.5 focus:outline-none focus:border-[#10B981]"
                value={selectedObraFilter}
                onChange={(e) => setSelectedObraFilter(e.target.value)}
              >
                <option value="all">Todas las Obras Activas</option>
                <option value="structural">🏢 Estructural / Oficina (Gasto Indirecto)</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SUMMARY RATIOS BADGE */}
          <div className="bg-[#10B981]/10 border border-[#10B981]/20 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs text-white/80" id="personal-filtered-summary">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#10B981] shrink-0" />
              <span>Partes filtrados: <strong className="text-white">{filteredPersonal.length}</strong> registros</span>
            </div>
            <div className="flex flex-wrap gap-4 font-semibold font-mono text-[#10B981]" id="personal-filtered-numerical-ratios">
              <span>Horas Totales: {totalHoursFiltered} h</span>
              {totalOvertimeHoursFiltered > 0 && (
                <span className="text-amber-400">Horas Extras: {totalOvertimeHoursFiltered} h</span>
              )}
              <span className="text-white font-black text-sm">Total Coste: {totalCostFiltered.toFixed(2)} €</span>
            </div>
          </div>

          {/* LABOR LIST TABLE */}
          <div className="bg-[#151515] rounded-2xl border border-white/5 shadow-sm overflow-hidden" id="personal-table-card">
            {/* Mobile Cards View (Phones / Narrow Viewports) */}
            <div className="block md:hidden divide-y divide-white/5 p-3 space-y-3" id="personal-mobile-cards">
              {filteredPersonal.length === 0 ? (
                <div className="p-8 text-center text-white/40 text-xs">
                  No hay registros de partes de trabajo de personal para los criterios de filtro activos.
                </div>
              ) : (
                filteredPersonal.map(p => {
                  const obraName = p.obraId === 'structural' ? 'Estructural / Oficina' : (obras.find(o => o.id === p.obraId)?.name || 'Sin obra');
                  const isExpanded = !!expandedRows[p.id];

                  let modalityLabel = `${p.hours} h`;
                  let subLabel = `${p.hourlyRate.toFixed(2)} €/h`;
                  if (p.costType === 'jornal') {
                    modalityLabel = `${p.jornales ?? Math.max(1, Math.round(p.hours / 8))} jornales`;
                    subLabel = `${(p.jornalRate ?? 95).toFixed(2)} €/día`;
                  } else if (p.costType === 'mensual') {
                    modalityLabel = `Mensual`;
                    subLabel = `${(p.monthlyBase ?? p.baseSalary ?? p.totalCost).toFixed(2)} €/mes`;
                  }

                  const hasOvertime = (p.overtimeHours || 0) > 0;
                  const baseSalaryVal = p.baseSalary ?? (p.costType === 'horas' ? p.hours * p.hourlyRate : p.totalCost);

                  return (
                    <div key={`m-p-${p.id}`} className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-3 shadow-xs">
                      {/* Top Bar: Worker Name + Role */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-1.5">
                            {p.workerName}
                            {(p.fichajeId || p.notes?.includes('[Control Horario Oficial]')) && (
                              <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                                Legal
                              </span>
                            )}
                          </div>
                          <span className="inline-block mt-0.5 bg-white/10 text-white/80 px-2 py-0.5 rounded text-[10.5px]">
                            {p.role}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-white/50 bg-white/5 px-2 py-1 rounded-lg">
                          {p.date}
                        </span>
                      </div>

                      {/* Obra & Details */}
                      <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-white/40 text-[11px]">Obra:</span>
                          <span className="font-bold text-white/90 text-right truncate max-w-[190px]">{obraName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/40 text-[11px]">Cómputo:</span>
                          <span className="font-mono text-white/90">{modalityLabel} ({subLabel})</span>
                        </div>
                        {hasOvertime && (
                          <div className="flex justify-between items-center text-amber-400">
                            <span className="text-[11px]">Horas Extras:</span>
                            <span className="font-mono font-bold">+{p.overtimeHours}h ({p.overtimeRate || 18} €/h)</span>
                          </div>
                        )}
                        <div className="border-t border-white/5 pt-1.5 flex justify-between items-center">
                          <span className="text-white/50 text-[11px] font-medium">Coste Imputado:</span>
                          <span className="font-mono font-black text-sm text-[#10B981]">
                            {p.totalCost.toFixed(2)} €
                          </span>
                        </div>
                      </div>

                      {/* Expandable Breakdown on mobile */}
                      {isExpanded && (
                        <div className="bg-black/60 rounded-xl p-3 border border-white/10 space-y-2 text-xs animate-fadeIn">
                          <div className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                            Liquidación Desglosada
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-white/40 block text-[10px]">Base Regular:</span>
                              <span className="text-white font-bold">{(p.regularHoursCost ?? (p.costType === 'jornal' ? (p.jornales || 1) * (p.jornalRate || 95) : baseSalaryVal)).toFixed(2)} €</span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-amber-400/70 block text-[10px]">Horas Extras:</span>
                              <span className="text-amber-400 font-bold">+{(p.overtimeCost ?? ((p.overtimeHours || 0) * (p.overtimeRate || 18))).toFixed(2)} €</span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-emerald-400/70 block text-[10px]">Seg. Social:</span>
                              <span className="text-emerald-400 font-bold">+{(p.socialSecurityAmount ?? 0).toFixed(2)} €</span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg">
                              <span className="text-emerald-400/70 block text-[10px]">IRPF:</span>
                              <span className="text-emerald-400 font-bold">+{(p.irpfAmount ?? 0).toFixed(2)} €</span>
                            </div>
                          </div>
                          {p.notes && (
                            <div className="text-[11px] text-white/60 italic pt-1 border-t border-white/5">
                              {p.notes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Mobile Actions with touch target >= 44px */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleRow(p.id)}
                          className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4 text-[#10B981]" />
                              <span>Ocultar</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              <span>Desglose</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(p);
                            setShowForm(true);
                          }}
                          className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-[#10B981]/15 hover:bg-[#10B981] text-[#10B981] hover:text-black font-bold text-xs flex items-center justify-center gap-1.5 border border-[#10B981]/25 cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePersonal(p.id)}
                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-rose-400 flex items-center justify-center border border-white/10 cursor-pointer"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Full Table (hidden on mobile, shown on md+) */}
            <div className="hidden md:block overflow-x-auto" id="personal-table-scroll">
              <table className="w-full text-left font-sans text-xs border-collapse" id="personal-table">
                <thead>
                  <tr className="bg-white/5 text-white/40 border-b border-white/5 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="px-5 py-3.5 cursor-pointer hover:text-white select-none whitespace-nowrap" onClick={() => handlePersonalSort('workerName')}>
                      Operario {personalSortBy === 'workerName' ? (personalSortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-5 py-3.5 cursor-pointer hover:text-white select-none whitespace-nowrap" onClick={() => handlePersonalSort('role')}>
                      Especialidad {personalSortBy === 'role' ? (personalSortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-5 py-3.5">Obra Asignada</th>
                    <th className="px-5 py-3.5 cursor-pointer hover:text-white select-none whitespace-nowrap" onClick={() => handlePersonalSort('date')}>
                      Fecha {personalSortBy === 'date' ? (personalSortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-5 py-3.5 text-right">Jornadas / Cómputo</th>
                    <th className="px-5 py-3.5 text-right">Horas Extras</th>
                    <th className="px-5 py-3.5 text-right cursor-pointer hover:text-white select-none whitespace-nowrap" onClick={() => handlePersonalSort('totalCost')}>
                      Coste Real Obra {personalSortBy === 'totalCost' ? (personalSortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-5 py-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {filteredPersonal.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-white/40">
                        No hay registros de partes de trabajo de personal para los criterios de filtro activos.
                      </td>
                    </tr>
                  ) : (
                    filteredPersonal.map(p => {
                      const obraName = p.obraId === 'structural' ? 'Estructural / Oficina' : (obras.find(o => o.id === p.obraId)?.name || 'Sin obra');
                      const isExpanded = !!expandedRows[p.id];
                      
                      let modalityLabel = `${p.hours} h`;
                      let subLabel = `${p.hourlyRate.toFixed(2)} €/h`;
                      if (p.costType === 'jornal') {
                        modalityLabel = `${p.jornales ?? Math.max(1, Math.round(p.hours / 8))} jornales`;
                        subLabel = `${(p.jornalRate ?? 95).toFixed(2)} €/día`;
                      } else if (p.costType === 'mensual') {
                        modalityLabel = `Mensual`;
                        subLabel = `${(p.monthlyBase ?? p.baseSalary ?? p.totalCost).toFixed(2)} €/mes`;
                      }

                      const hasOvertime = (p.overtimeHours || 0) > 0;
                      const baseSalaryVal = p.baseSalary ?? (p.costType === 'horas' ? p.hours * p.hourlyRate : p.totalCost);

                      return (
                        <React.Fragment key={p.id}>
                          <tr className="hover:bg-white/5 transition-colors border-b border-white/5" id={`row-worker-${p.id}`}>
                            <td className="px-5 py-4 font-semibold text-white/90">
                              <button
                                type="button"
                                onClick={() => toggleRow(p.id)}
                                className="mr-2 text-white/40 hover:text-[#10B981] inline-flex items-center align-middle cursor-pointer"
                                title="Ver desglose financiero"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-[#10B981]" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                              <span className="align-middle inline-block font-bold">{p.workerName}</span>
                              {(p.fichajeId || p.notes?.includes('[Control Horario Oficial]')) && (
                                <span className="ml-2 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 border border-emerald-500/30 align-middle" title="Certificado con firma digital de presencia en obra (RDL 8/2019)">
                                  <Clock className="w-2.5 h-2.5" />
                                  Fichaje Legal
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded text-[11px] font-sans">
                                {p.role}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-white/70 font-medium max-w-[150px] truncate">{obraName}</td>
                            <td className="px-5 py-4 font-mono text-white/50">{p.date}</td>
                            <td className="px-5 py-4 text-right">
                              <div className="font-semibold text-white/90">{modalityLabel}</div>
                              <div className="text-[10px] text-white/40 font-mono">{subLabel}</div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              {hasOvertime ? (
                                <div className="text-[11px] font-mono font-bold text-amber-400">
                                  <span>{p.overtimeHours} h extras</span>
                                  <span className="text-[9.5px] text-white/40 block">({(p.overtimeRate || 18)} €/h)</span>
                                </div>
                              ) : (
                                <span className="text-white/30 text-[10px] font-mono">0 h</span>
                              )}
                            </td>
                            <td className="px-5 py-4 font-mono text-right text-[#10B981] font-black text-sm">
                              {p.totalCost.toFixed(2)} €
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingItem(p);
                                    setShowForm(true);
                                  }}
                                  className="text-emerald-400 hover:text-white bg-[#10B981]/15 hover:bg-[#10B981] px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all border border-[#10B981]/20"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleRow(p.id)}
                                  className="text-white/50 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                                >
                                  {isExpanded ? 'Cerrar' : 'Detalles'}
                                </button>
                                <button
                                  onClick={() => deletePersonal(p.id)}
                                  className="text-white/30 hover:text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                                  title="Eliminar registro"
                                  id={`btn-del-worker-${p.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Expanded panel with full breakdown */}
                          {isExpanded && (
                            <tr className="bg-black/45 border-b border-white/5 animate-fadeIn">
                              <td colSpan={8} className="px-8 py-5">
                                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                                  <div className="sm:col-span-5 flex justify-between items-center bg-white/5 px-3.5 py-2 rounded-xl text-xs">
                                    <span className="text-white/70">
                                      📊 Desglose de liquidación de: <strong>{p.workerName}</strong> | Obra: <strong>{obraName}</strong>
                                    </span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-mono text-white/50">
                                      ID: {p.id}
                                    </span>
                                  </div>

                                  <div className="bg-[#121212] p-3 rounded-xl border border-white/5 text-left">
                                    <span className="text-[10px] text-white/40 font-semibold uppercase block mb-1">Base Regular</span>
                                    <span className="font-mono text-white text-sm font-black">
                                      {(p.regularHoursCost ?? (p.costType === 'jornal' ? (p.jornales || 1) * (p.jornalRate || 95) : baseSalaryVal)).toFixed(2)} €
                                    </span>
                                    <span className="text-[9px] text-white/30 block mt-1">{p.costType === 'jornal' ? `${p.jornales || 1} jornales x ${p.jornalRate || 95}€` : `${p.hours}h`}</span>
                                  </div>

                                  <div className="bg-[#121212] p-3 rounded-xl border border-white/5 text-left">
                                    <span className="text-[10px] text-amber-400 font-semibold uppercase block mb-1">Horas Extras</span>
                                    <span className="font-mono text-amber-400 text-sm font-black">
                                      +{(p.overtimeCost ?? ((p.overtimeHours || 0) * (p.overtimeRate || 18))).toFixed(2)} €
                                    </span>
                                    <span className="text-[9px] text-white/30 block mt-1">{p.overtimeHours || 0}h extras x {p.overtimeRate || 18}€/h</span>
                                  </div>

                                  <div className="bg-[#121212] p-3 rounded-xl border border-white/5 text-left">
                                    <span className="text-[10px] text-emerald-400 font-semibold uppercase block mb-1">Seg. Social (+)</span>
                                    <span className="font-mono text-emerald-400 text-sm font-black">
                                      +{(p.socialSecurityAmount ?? 0).toFixed(2)} €
                                    </span>
                                    <span className="text-[9px] text-white/30 block mt-1">Cotización SS empresa</span>
                                  </div>

                                  <div className="bg-[#121212] p-3 rounded-xl border border-white/5 text-left">
                                    <span className="text-[10px] text-emerald-400 font-semibold uppercase block mb-1">IRPF (+)</span>
                                    <span className="font-mono text-emerald-400 text-sm font-black">
                                      +{(p.irpfAmount ?? 0).toFixed(2)} €
                                    </span>
                                    <span className="text-[9px] text-white/30 block mt-1">Retención fiscal</span>
                                  </div>

                                  <div className="bg-[#10B981]/10 p-3 rounded-xl border border-[#10B981]/20 text-left">
                                    <span className="text-[10px] text-[#10B981] font-black uppercase block mb-1">Coste Total Obra</span>
                                    <span className="font-mono text-[#10B981] text-base font-black">{p.totalCost.toFixed(2)} €</span>
                                    <span className="text-[9px] text-white/45 block mt-1">Total imputado a la obra</span>
                                  </div>

                                  {p.notes && (
                                    <div className="sm:col-span-5 bg-[#0e0e0e] p-3 rounded-xl text-xs text-white/60 font-mono italic">
                                      <strong>Notas:</strong> {p.notes}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: REGISTRO MAESTRO DE PLANTILLA DE LA EMPRESA */}
      {activeSubTab === 'plantilla' && (
        <div className="space-y-6 animate-fadeIn" id="plantilla-workers-view">
          {/* Top Plantilla Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#151515] p-4 rounded-2xl border border-white/5">
            <div className="relative flex-1 w-full" id="worker-catalog-search-wrap">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar en la plantilla por nombre, puesto o DNI..."
                className="w-full bg-white/5 rounded-xl border border-white/10 pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#10B981]"
                value={workerCatalogSearch}
                onChange={(e) => setWorkerCatalogSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setImportExportTab('export');
                  setShowImportExportModal(true);
                }}
                className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-3.5 rounded-xl border border-white/10 text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Exportar archivo de trabajadores"
              >
                <Download className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Exportar</span>
              </button>

              <button
                onClick={() => {
                  setImportExportTab('import');
                  setShowImportExportModal(true);
                }}
                className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-3.5 rounded-xl border border-white/10 text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Importar archivo de trabajadores para compartir"
              >
                <Upload className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Importar</span>
              </button>

              <button
                onClick={() => handleOpenWorkerModal()}
                className="w-full sm:w-auto bg-[#10B981] hover:bg-[#10B981]/95 text-black font-extrabold py-2.5 px-5 rounded-xl shadow-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                id="btn-new-worker-entry"
              >
                <UserPlus className="w-4 h-4 text-black" />
                <span>+ Nuevo Trabajador</span>
              </button>
            </div>
          </div>

          {/* Plantilla Info Banner */}
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-xs text-white/70 flex items-start gap-3">
            <div className="bg-[#10B981]/20 p-2 rounded-xl text-[#10B981] shrink-0 font-bold">
              💡
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <strong className="text-white block font-bold text-xs">Directorio Memorizado y Compartible de la Empresa</strong>
                <span className="text-[10px] text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-md font-mono self-start">
                  Compatible para compartir con compañeros (JSON/Excel)
                </span>
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">
                Los trabajadores se memorizan con su jornal diario y horas extras. Puede imputarles gastos a varias obras distintas a la vez o en el mismo mes con solo pinchar la obra deseada.
              </p>
            </div>
          </div>

          {/* Worker Catalog Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="workers-catalog-grid">
            {filteredCatalogWorkers.length === 0 ? (
              <div className="col-span-full bg-[#151515] p-12 rounded-3xl border border-white/5 text-center space-y-3">
                <Users className="w-12 h-12 text-white/20 mx-auto" />
                <h4 className="text-white font-bold text-sm">No hay trabajadores en la plantilla</h4>
                <p className="text-white/40 text-xs max-w-md mx-auto">
                  Añada a los trabajadores de la empresa con su jornal diario y tarifa de horas extras, o importe un archivo compartido.
                </p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => handleOpenWorkerModal()}
                    className="bg-[#10B981] text-black font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    + Registrar Trabajador
                  </button>
                  <button
                    onClick={() => {
                      setImportExportTab('import');
                      setShowImportExportModal(true);
                    }}
                    className="bg-white/10 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Importar Plantilla
                  </button>
                </div>
              </div>
            ) : (
              filteredCatalogWorkers.map(worker => {
                const defaultObraName = worker.defaultObraId ? obras.find(o => o.id === worker.defaultObraId)?.name : null;
                const obraStats = getWorkerObrasHistory(worker.name);

                return (
                  <div
                    key={worker.id}
                    className="bg-[#151515] hover:bg-[#181818] transition-all rounded-3xl p-5 border border-white/10 shadow-lg flex flex-col justify-between gap-4 group"
                    id={`card-worker-catalog-${worker.id}`}
                  >
                    <div className="space-y-3">
                      {/* Card Header */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#10B981]/20 text-[#10B981] font-black text-sm flex items-center justify-center border border-[#10B981]/30">
                            {worker.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-white font-extrabold text-sm">{worker.name}</h4>
                            <span className="text-[11px] text-[#10B981] font-semibold block">{worker.role}</span>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOpenWorkerModal(worker)}
                            className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            title="Editar operario"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteWorkerFromCatalog(worker.id, worker.name)}
                            className="text-white/30 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            title="Eliminar de plantilla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Rates Overview Box */}
                      <div className="grid grid-cols-2 gap-2 bg-[#101010] p-3 rounded-2xl border border-white/5 font-mono">
                        <div className="text-left">
                          <span className="text-[10px] text-white/40 uppercase block">Cobra al Día (Jornal)</span>
                          <span className="text-sm font-black text-white">{worker.dailyRate.toFixed(2)} €/día</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-amber-400 uppercase block">Hora Extra</span>
                          <span className="text-sm font-black text-amber-400">+{worker.overtimeHourlyRate.toFixed(2)} €/h</span>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="space-y-1 text-[11px] text-white/60">
                        {worker.dni && (
                          <div className="flex justify-between">
                            <span className="text-white/40">DNI / NIF:</span>
                            <span className="font-mono text-white">{worker.dni}</span>
                          </div>
                        )}
                        {worker.phone && (
                          <div className="flex justify-between">
                            <span className="text-white/40">Teléfono:</span>
                            <span>{worker.phone}</span>
                          </div>
                        )}
                        {defaultObraName && (
                          <div className="flex justify-between">
                            <span className="text-white/40">Obra Habitual:</span>
                            <span className="text-white font-medium truncate max-w-[140px]" title={defaultObraName}>{defaultObraName}</span>
                          </div>
                        )}
                        {worker.notes && (
                          <p className="text-[10px] text-white/40 italic pt-1 border-t border-white/5 truncate">
                            {worker.notes}
                          </p>
                        )}
                      </div>

                      {/* Multi-Obra Activity Badges */}
                      {obraStats.length > 0 && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] text-white/45">
                            <span className="font-bold flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-[#10B981]" />
                              <span>Obras Imputadas ({obraStats.length}):</span>
                            </span>
                            <span className="font-mono text-[#10B981]">
                              {obraStats.reduce((sum, s) => sum + s.totalCost, 0).toFixed(0)} € total
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {obraStats.map(s => (
                              <button
                                key={s.obraId}
                                onClick={() => {
                                  handleQuickAddForWorker(worker);
                                  setObraId(s.obraId);
                                }}
                                title={`Hacer clic para imputar gasto a ${s.obraName} (${s.count} partes registrados)`}
                                className="bg-white/5 hover:bg-[#10B981]/20 hover:text-[#10B981] border border-white/10 hover:border-[#10B981]/40 text-[10px] px-2 py-0.5 rounded-lg text-white/80 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <span className="truncate max-w-[110px]">{s.obraName}</span>
                                <span className="bg-white/10 text-[9px] px-1 rounded-sm font-mono text-white/60">{s.count}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Button & Quick Obra Picker */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAddForWorker(worker)}
                          className="flex-1 bg-[#10B981]/15 hover:bg-[#10B981] text-[#10B981] hover:text-black font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-[#10B981]/30 cursor-pointer shadow-sm"
                          id={`btn-impute-for-${worker.id}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Imputar Gasto</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setQuickObraWorker(worker)}
                          className="bg-white/5 hover:bg-white/15 text-white/80 hover:text-white p-2 rounded-xl text-xs flex items-center justify-center transition-all border border-white/10 cursor-pointer"
                          title="Elegir en qué obra imputar el gasto"
                        >
                          <Building2 className="w-3.5 h-3.5 text-[#10B981]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* QUICK OBRA SELECTOR MODAL (Select which obra to impute for a worker) */}
      {quickObraWorker && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto no-print animate-fadeIn">
          <div className="bg-[#181818] rounded-3xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden text-white font-sans animate-slideUp">
            <div className="border-b border-white/10 px-5 py-4 flex justify-between items-center bg-[#141414]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Elegir Obra de Destino</h3>
                  <p className="text-[10px] text-white/50">Imputar gasto para <strong className="text-[#10B981]">{quickObraWorker.name}</strong></p>
                </div>
              </div>
              <button
                onClick={() => setQuickObraWorker(null)}
                className="text-white/40 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-white/60">
                Seleccione la obra en curso donde ha trabajado <strong className="text-white">{quickObraWorker.name}</strong>:
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {/* Estructura / General option */}
                <button
                  onClick={() => {
                    handleQuickAddForWorker(quickObraWorker);
                    setObraId('structural');
                    setQuickObraWorker(null);
                  }}
                  className="w-full text-left p-3 rounded-2xl bg-white/5 hover:bg-[#10B981]/15 hover:border-[#10B981]/40 border border-white/5 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                      🏢
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-[#10B981]">Estructura / Oficina General</h4>
                      <span className="text-[10px] text-white/40">Gasto no atribuible a obra específica</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-[#10B981] group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* All Obras */}
                {obras.map(o => (
                  <button
                    key={o.id}
                    onClick={() => {
                      handleQuickAddForWorker(quickObraWorker);
                      setObraId(o.id);
                      setQuickObraWorker(null);
                    }}
                    className="w-full text-left p-3 rounded-2xl bg-white/5 hover:bg-[#10B981]/15 hover:border-[#10B981]/40 border border-white/5 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center font-bold text-xs">
                        🏗️
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white group-hover:text-[#10B981]">{o.name}</h4>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            o.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : o.status === 'on_hold' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/60'
                          }`}>
                            {o.status === 'active' ? 'En Curso' : o.status === 'on_hold' ? 'En Pausa' : 'Finalizada'}
                          </span>
                        </div>
                        <span className="text-[10px] text-white/40">{o.location || 'Obra'} • Presupuesto: {o.budget.toLocaleString('es-ES')} €</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-[#10B981] group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT / EXPORT WORKERS MODAL (Share with Colleagues) */}
      {showImportExportModal && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto no-print animate-fadeIn" id="import-export-modal-overlay">
          <div className="bg-[#181818] rounded-3xl border border-white/10 shadow-2xl w-full max-w-2xl overflow-hidden text-white font-sans animate-slideUp" id="import-export-modal-body">
            
            {/* Modal Header */}
            <div className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-[#141414]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center font-bold">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Compartir e Importar Plantilla de Trabajadores
                  </h3>
                  <p className="text-[10px] text-white/50">
                    Exporte o cargue el registro de operarios para compartirlo fácilmente con otros compañeros.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportExportModal(false);
                  setParsedImportWorkers([]);
                  setImportText('');
                  setImportError(null);
                }}
                className="text-white/40 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal SubTabs */}
            <div className="flex border-b border-white/10 bg-[#121212] px-6 pt-3 gap-3">
              <button
                type="button"
                onClick={() => setImportExportTab('export')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                  importExportTab === 'export'
                    ? 'border-[#10B981] text-[#10B981]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Exportar Plantilla ({trabajadoresEmpresa.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setImportExportTab('import')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                  importExportTab === 'import'
                    ? 'border-[#10B981] text-[#10B981]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Importar Plantilla</span>
              </button>
            </div>

            {/* Modal Body: EXPORT TAB */}
            {importExportTab === 'export' && (
              <div className="p-6 space-y-5 text-xs">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-start gap-3">
                  <div className="bg-[#10B981]/20 text-[#10B981] p-2 rounded-xl text-lg font-bold">
                    📦
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">Exportar datos de operarios registrados</h4>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Descargue el archivo de su plantilla con nombres, especialidades, tarifas de jornal (€/día) y precios de horas extras (€/h). Su compañero solo tendrá que importarlo en su app.
                    </p>
                  </div>
                </div>

                {/* Export Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* JSON Option */}
                  <div className="bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3 text-center">
                    <div>
                      <FileJson className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
                      <h5 className="font-bold text-white text-xs">Formato JSON</h5>
                      <p className="text-[10px] text-white/40 mt-1">Recomendado para importar directamente en UniProyect sin pérdida de datos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportJSON}
                      className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar JSON</span>
                    </button>
                  </div>

                  {/* CSV / Excel Option */}
                  <div className="bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3 text-center">
                    <div>
                      <FileSpreadsheet className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      <h5 className="font-bold text-white text-xs">Formato Excel / CSV</h5>
                      <p className="text-[10px] text-white/40 mt-1">Tablas con cabeceras para abrir y editar en Microsoft Excel o Google Sheets.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="bg-white/10 hover:bg-white/20 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Descargar CSV</span>
                    </button>
                  </div>

                  {/* Clipboard Option */}
                  <div className="bg-[#141414] p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3 text-center">
                    <div>
                      <Copy className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                      <h5 className="font-bold text-white text-xs">Copiar Portapapeles</h5>
                      <p className="text-[10px] text-white/40 mt-1">Copie el texto completo para pegarlo en WhatsApp, Teams o correo.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyJSON}
                      className="bg-white/10 hover:bg-white/20 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedNotification ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-[#10B981]" />
                          <span className="text-[#10B981]">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Worker List Summary Preview */}
                <div className="bg-[#121212] p-3 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[11px] font-bold text-white/60">Contenido a exportar ({trabajadoresEmpresa.length} operarios):</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                    {trabajadoresEmpresa.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg text-white/80">
                        <span className="font-bold">{t.name} <span className="text-white/40 font-normal">({t.role})</span></span>
                        <span className="text-[#10B981]">{t.dailyRate.toFixed(2)} €/día • +{t.overtimeHourlyRate.toFixed(2)} €/h</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Modal Body: IMPORT TAB */}
            {importExportTab === 'import' && (
              <div className="p-6 space-y-4 text-xs">
                {/* File Upload Box */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-white/70">
                    1. Seleccionar archivo (.json o .csv) o pegar el texto:
                  </label>
                  
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 hover:border-[#10B981] bg-white/5 hover:bg-[#10B981]/5 p-5 rounded-2xl text-center cursor-pointer transition-all"
                  >
                    <Upload className="w-8 h-8 text-[#10B981] mx-auto mb-1.5" />
                    <span className="text-xs font-bold text-white block">Haz clic para buscar el archivo en tu dispositivo</span>
                    <span className="text-[10px] text-white/40 mt-0.5 block">Formatos admitidos: .json (UniProyect) o .csv (Excel)</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Or Paste Raw Text */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-white/70">O pegar el texto recibido:</label>
                    {importText && (
                      <button
                        onClick={() => {
                          setImportText('');
                          setParsedImportWorkers([]);
                          setImportError(null);
                        }}
                        className="text-[10px] text-red-400 hover:underline cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    placeholder='Pegue aquí el contenido JSON o CSV...'
                    className="w-full bg-white/5 rounded-xl border border-white/10 p-2.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-[#10B981] resize-none"
                    value={importText}
                    onChange={(e) => {
                      setImportText(e.target.value);
                      handleProcessImportInput(e.target.value);
                    }}
                  />
                </div>

                {/* Error Message */}
                {importError && (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* Parsed Workers Preview Table */}
                {parsedImportWorkers.length > 0 && (
                  <div className="space-y-3 bg-[#121212] p-4 rounded-2xl border border-white/10 animate-fadeIn">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#10B981]" />
                        <span className="font-bold text-white text-xs">
                          {parsedImportWorkers.length} Trabajadores Detectados Listos para Importar:
                        </span>
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] pr-1">
                      {parsedImportWorkers.map((t, i) => (
                        <div key={i} className="flex justify-between items-center bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-white">
                          <div>
                            <strong className="text-white">{t.name}</strong>
                            <span className="text-white/50 text-[10px] ml-1.5">({t.role})</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[#10B981] font-bold">{t.dailyRate.toFixed(2)} €/día</span>
                            <span className="text-amber-400 text-[10px] ml-2">+{t.overtimeHourlyRate.toFixed(2)} €/h</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Import Mode Selector */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <label className="block text-[11px] font-bold text-white/80">Modo de importación:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 cursor-pointer transition-all ${
                          importMode === 'merge' ? 'bg-[#10B981]/15 border-[#10B981] text-white' : 'bg-white/5 border-white/10 text-white/60'
                        }`}>
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'merge'}
                            onChange={() => setImportMode('merge')}
                            className="mt-0.5"
                          />
                          <div>
                            <strong className="block text-white text-xs">🔄 Fusionar (Recomendado)</strong>
                            <span className="text-[10px] text-white/50">Añade los nuevos trabajadores y mantiene los existentes.</span>
                          </div>
                        </label>

                        <label className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 cursor-pointer transition-all ${
                          importMode === 'replace' ? 'bg-amber-500/15 border-amber-500 text-white' : 'bg-white/5 border-white/10 text-white/60'
                        }`}>
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === 'replace'}
                            onChange={() => setImportMode('replace')}
                            className="mt-0.5"
                          />
                          <div>
                            <strong className="block text-amber-300 text-xs">⚠️ Reemplazar Plantilla</strong>
                            <span className="text-[10px] text-white/50">Borra la plantilla actual y la sustituye por este archivo.</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Execute Import Button */}
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      className="w-full bg-[#10B981] hover:bg-[#10B981]/95 text-black font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirmar e Importar {parsedImportWorkers.length} Trabajadores a la App</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="border-t border-white/10 px-6 py-3.5 flex justify-end bg-[#141414]">
              <button
                type="button"
                onClick={() => {
                  setShowImportExportModal(false);
                  setParsedImportWorkers([]);
                  setImportText('');
                  setImportError(null);
                }}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MASTER WORKER CATALOG MODAL (Add / Edit Worker in Company Registry) */}
      {showWorkerModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto no-print animate-fadeIn" id="worker-modal-overlay">
          <div className="bg-[#181818] rounded-3xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden text-white font-sans animate-slideUp" id="worker-modal-body">
            
            {/* Modal Header */}
            <div className="border-b border-white/10 px-6 py-4 flex justify-between items-center bg-[#141414]" id="worker-modal-header">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#10B981]/20 text-[#10B981] flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {editingWorkerCatalog ? 'Editar Trabajador de la Plantilla' : 'Registrar Trabajador en la Plantilla'}
                  </h3>
                  <p className="text-[10px] text-white/50">Guarde los datos para que la app los memorice en cada imputación.</p>
                </div>
              </div>
              <button
                onClick={() => setShowWorkerModal(false)}
                className="text-white/40 hover:text-white text-lg font-bold p-1 cursor-pointer"
                id="btn-close-worker-modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveWorkerToCatalog} className="p-6 space-y-4 text-xs" id="form-save-worker-catalog">
              <div>
                <label className="block text-[11px] font-bold text-white/70 mb-1">Nombre y Apellidos del Trabajador *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Manuel Ortega González"
                  className="w-full bg-white/5 rounded-xl border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] font-bold"
                  value={modalWorkerName}
                  onChange={(e) => setModalWorkerName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Especialidad / Cargo</label>
                  <select
                    className="w-full bg-[#202020] rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981]"
                    value={modalWorkerRole}
                    onChange={(e) => setModalWorkerRole(e.target.value)}
                  >
                    {CONST_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">DNI / NIE</label>
                  <input
                    type="text"
                    placeholder="Ej. 31877665Y"
                    className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none font-mono"
                    value={modalDni}
                    onChange={(e) => setModalDni(e.target.value)}
                  />
                </div>
              </div>

              {/* Rates Block */}
              <div className="bg-[#101010] p-4 rounded-2xl border border-white/5 space-y-3">
                <span className="text-[10px] font-black uppercase text-[#10B981] tracking-wider block">
                  💰 Tarifas y Precios Memorizados
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-white/80 mb-1">Cuánto cobra al día (€/día) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="1"
                        max="1000"
                        step="1"
                        className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono font-bold text-base pr-6"
                        value={modalDailyRate || ''}
                        onChange={(e) => setModalDailyRate(Number(e.target.value))}
                      />
                      <span className="absolute right-2 top-2 text-xs text-white/40 font-mono">€</span>
                    </div>
                    <span className="text-[9.5px] text-white/40 mt-0.5 block">Jornal estándar por día</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-400 mb-1">Precio Hora Extra (€/h) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="0"
                        max="500"
                        step="0.5"
                        className="w-full bg-amber-500/10 rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-200 focus:outline-none focus:border-amber-400 font-mono font-bold text-base pr-6"
                        value={modalOvertimeRate || ''}
                        onChange={(e) => setModalOvertimeRate(Number(e.target.value))}
                      />
                      <span className="absolute right-2 top-2 text-xs text-amber-400 font-mono">€</span>
                    </div>
                    <span className="text-[9.5px] text-white/40 mt-0.5 block">Tarifa por cada hora extra</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="Ej. +34 611 12 13 14"
                    className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none"
                    value={modalPhone}
                    onChange={(e) => setModalPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Obra Habitual Asignada</label>
                  <select
                    className="w-full bg-[#202020] rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none"
                    value={modalDefaultObra}
                    onChange={(e) => setModalDefaultObra(e.target.value)}
                  >
                    <option value="">-- Sin obra fija --</option>
                    {obras.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white/70 mb-1">Notas / Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Ej. Oficial especializado en estructuras de hormigón..."
                  className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none resize-none"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                />
              </div>

              {/* Modal Actions */}
              <div className="border-t border-white/10 pt-4 flex justify-end gap-2" id="modal-worker-actions">
                <button
                  type="button"
                  onClick={() => setShowWorkerModal(false)}
                  className="bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-black py-2.5 px-6 rounded-xl text-xs cursor-pointer shadow-lg transition-all"
                  id="btn-confirm-save-worker"
                >
                  {editingWorkerCatalog ? 'Actualizar Trabajador' : 'Guardar y Memorizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
