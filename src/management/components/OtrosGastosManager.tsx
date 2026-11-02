/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import { 
  OtrosGasto, 
  Obra, 
  getObraOverheadAllocationMap, 
  getMonthlyOverheadAllocationBreakdown, 
  formatMonthKeyToLabel, 
  MonthlyOverheadAllocation, 
  ObraMonthlySummary, 
  IAStructuralExpenseExtraction 
} from '../types';
import { 
  Plus, 
  Search, 
  Trash2, 
  CreditCard, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  CheckCircle, 
  Sparkles, 
  Pencil, 
  Percent, 
  Sliders,
  Upload,
  FileUp,
  Image as ImageIcon,
  Eye,
  X,
  RefreshCw,
  AlertCircle,
  FileCheck,
  Building,
  Receipt,
  Layers,
  ArrowRight,
  Download,
  Filter,
  Calendar,
  CalendarDays,
  BarChart3,
  LayoutGrid,
  Table as TableIcon,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Info,
  Wifi,
  WifiOff,
  Cpu
} from 'lucide-react';
import { scanDocumentLocally } from '../lib/localOcrService';

export function inferExpenseCategory(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('combustible') || t.includes('gasoil') || t.includes('gasolina') || t.includes('repsol') || t.includes('cepsa') || t.includes('bp') || t.includes('estacion de servicio') || t.includes('itv') || t.includes('taller') || t.includes('peaje') || t.includes('ap-')) {
    return 'Combustible y Vehículos';
  }
  if (t.includes('asesor') || t.includes('gestor') || t.includes('notar') || t.includes('abogad') || t.includes('auditor') || t.includes('mercantil')) {
    return 'Asesoría y Administración';
  }
  if (t.includes('segur') || t.includes('mapfre') || t.includes('axa') || t.includes('mutua') || t.includes('allianz') || t.includes('poliza') || t.includes('responsabilidad civil')) {
    return 'Seguros Corporativos';
  }
  if (t.includes('alquiler') || t.includes('arrendam') || t.includes('nave') || t.includes('almacen') || t.includes('trastero') || t.includes('inmobiliaria')) {
    return 'Alquileres y Almacén';
  }
  if (t.includes('telefon') || t.includes('movistar') || t.includes('vodafone') || t.includes('orange') || t.includes('fibra') || t.includes('internet') || t.includes('papel') || t.includes('oficina') || t.includes('impresora') || t.includes('suministro')) {
    return 'Suministros y Oficina';
  }
  if (t.includes('software') || t.includes('licencia') || t.includes('autocad') || t.includes('adobe') || t.includes('microsoft') || t.includes('google') || t.includes('cloud') || t.includes('hosting')) {
    return 'Software, BIM y Control';
  }
  if (t.includes('ferreter') || t.includes('bricomart') || t.includes('obramat') || t.includes('leroy') || t.includes('herramienta') || t.includes('tornill') || t.includes('taladro') || t.includes('disco')) {
    return 'Ferretería y Utillaje';
  }
  if (t.includes('prevencion') || t.includes('epi') || t.includes('casco') || t.includes('botas') || t.includes('chaleco') || t.includes('seguridad y salud') || t.includes('reconocimiento medico') || t.includes('prl')) {
    return 'Prevención de Riesgos (PRL)';
  }
  if (t.includes('publicidad') || t.includes('uniforme') || t.includes('rotul') || t.includes('logo') || t.includes('ropa laboral')) {
    return 'Publicidad y Uniformes';
  }
  if (t.includes('tasa') || t.includes('impuesto') || t.includes('licencia') || t.includes('ayuntamiento') || t.includes('vado') || t.includes('hacienda') || t.includes('aval')) {
    return 'Impuestos, Licencias y Avales';
  }
  if (t.includes('nomina') || t.includes('sueldo') || t.includes('seguridad social') || t.includes('salario') || t.includes('oficina tecnica')) {
    return 'Personal de Estructura / Oficina';
  }
  return 'Otros Gastos Indirectos';
}

interface OtrosGastosManagerProps {
  gastosGenerales: OtrosGasto[];
  addGasto: (g: OtrosGasto) => void;
  addGastosBatch?: (list: OtrosGasto[]) => void;
  deleteGasto: (id: string) => void;
  updateGasto: (g: OtrosGasto) => void;
  obras: Obra[];
  updateObra: (o: Obra) => void;
}

export const CONST_CATEGORIES = [
  'Personal de Estructura / Oficina',
  'Alquileres y Almacén',
  'Seguros Corporativos',
  'Combustible y Vehículos',
  'Suministros y Oficina',
  'Software, BIM y Control',
  'Asesoría y Administración',
  'Prevención de Riesgos (PRL)',
  'Ferretería y Utillaje',
  'Publicidad y Uniformes',
  'Impuestos, Licencias y Avales',
  'Otros Gastos Indirectos'
];

interface ReferenceCategory {
  category: string;
  title: string;
  definition: string;
  concepts: string[];
  presetDescription: string;
  presetAmount: number;
  presetNotes: string;
}

const REFERENCE_CATALOG: ReferenceCategory[] = [
  {
    category: 'Personal de Estructura / Oficina',
    title: '👔 Personal de Estructura, Gerencia y Administración',
    definition: 'Sueldos, salarios, seguridad social de personal de oficina, dirección técnica o administración general que dan soporte de manera simultánea a todas las obras.',
    concepts: [
      'Nómina de jefes de obra corporativos o de gerencia de la empresa.',
      'Sueldo de administrativos, auxiliares contables y gestores.',
      'Seguridad Social de plantilla administrativa y de oficina.',
      'Retenciones e IRPF de directores, asesores internos y mandos de oficina.'
    ],
    presetDescription: 'Nómina unificada del departamento de Administración y Oficina Técnica',
    presetAmount: 2450.00,
    presetNotes: 'Costo total incluyendo cargas sociales de empresa.'
  },
  {
    category: 'Alquileres y Almacén',
    title: '🏢 Alquileres, Guardias y Acopio',
    definition: 'Costes fijos e indirectos relacionados con el espacio físico corporativo necesario para resguardar materiales y dotación técnica.',
    concepts: [
      'Alquiler de campa de maquinaria pesada o almacén central.',
      'Alquiler de oficinas corporativas de ingeniería y gerencia.',
      'Boxes de trastero para acopio intermedio de materiales de obra.',
      'Alquiler de aseos, comedores y casetas modulares comunes.'
    ],
    presetDescription: 'Alquiler de Nave de Acopio y Campamento Logístico General (Polígono El Peral)',
    presetAmount: 950.00,
    presetNotes: 'Cuota correspondiente al arriendo del mes corriente.'
  },
  {
    category: 'Seguros Corporativos',
    title: '🛡️ Seguridad Financiera y Pólizas',
    definition: 'Pólizas anuales obligatorias o recomendadas para cubrir la responsabilidad civil cruzada, decenal, y los accidentes del convenio de la empresa.',
    concepts: [
      'Seguro de Responsabilidad Civil (general, patronal, cruzada, post-trabajo).',
      'Seguro de Accidentes de Convenio de Construcción de operarios de plantilla.',
      'Garantía decenal de edificación (seguro obligatorio L.O.E. para promotores y constructores).',
      'Pólizas Todo Riesgo Construcción genéricas de la empresa.'
    ],
    presetDescription: 'Póliza Colectiva de Accidentes (Convenio de la Construcción de Cádiz)',
    presetAmount: 640.00,
    presetNotes: 'Liquidación semestral de póliza ante aseguradora principal.'
  },
  {
    category: 'Combustible y Vehículos',
    title: '🚚 Logística, Flota y Combustibles',
    definition: 'Suministros energéticos y gastos de puesta a punto de vehículos de reparto comunes e inspectores de obra.',
    concepts: [
      'Gasoil y combustibles generales de furgonetas y turismos inspectores.',
      'Pólizas de seguro anual de vehículos de transporte corporativo de la flota.',
      'Mantenimientos mecánicos, cambios de aceite, embragues, frenos o neumáticos comunes.',
      'Tasas de Inspección Técnica de Vehículos (ITV) de flota común.'
    ],
    presetDescription: 'Mantenimiento del motor, filtros y sustitución de neumáticos de furgón Iveco Daily',
    presetAmount: 480.00,
    presetNotes: 'Factura oficial de Talleres Mecánicos Guadalete S.L.'
  },
  {
    category: 'Suministros y Oficina',
    title: '🔌 Consumos del Cuartel General',
    definition: 'Suministros corrientes e insumos lógicos para la labor administrativa y técnica.',
    concepts: [
      'Energía eléctrica y agua del solar de sede principal y almacén acumulador.',
      'Fibra óptica para internet técnico de oficina central y telefonía móvil de jefes.',
      'Consumibles técnicos como papel de impresora plotter planos e informáticos.',
      'Gastos de correo y mensajerías de expedientes de licitación.'
    ],
    presetDescription: 'Factura unificada de suministros eléctricos de oficinas de soporte y almacén',
    presetAmount: 185.30,
    presetNotes: 'Facturado mensualmente por Endesa S.A.'
  },
  {
    category: 'Software, BIM y Control',
    title: '💻 Sistemas Informáticos, SaaS and BIM',
    definition: 'Herramientas digitales profesionales imprescindibles para el diseño de ofertas, delineación, planificación, y control presupuestario.',
    concepts: [
      'Renovación o suscripción a programas de presupuestos y mediciones (Presto, Arquímedes).',
      'Licencias en la nube CAD/BIM (Autodesk Revit, AutoCAD).',
      'Software técnico de cálculo estructural (CYPECAD, CYPE 3D).',
      'Plataformas ERP de administración comercial y control analítico de desvíos.'
    ],
    presetDescription: 'Licencia anual de uso del software de mediciones y presupuestos de obra Presto',
    presetAmount: 320.00,
    presetNotes: 'Suscripción técnica del departamento de estudios.'
  },
  {
    category: 'Asesoría y Administración',
    title: '🤝 Consultorías de Soporte de Empresa',
    definition: 'Gastos y cuotas para el asesoramiento técnico contable, gestiones laborales contractuales y defensa jurídica corporativa.',
    concepts: [
      'Cuotas de gestoría laboral para contratos, finiquitos y confección de nóminas.',
      'Despacho fiscal por presentación de impuestos (IVA, Sociedades, Modelo 111 de IRPF).',
      'Auditorías externas de cuentas oficiales exigidas para contratación pública.',
      'Gastos legales y notariales habituales de representación societaria.'
    ],
    presetDescription: 'Honorarios del despacho asesor laboralista y contabilidad mensual',
    presetAmount: 420.00,
    presetNotes: 'Asesores Reunidos del Guadalete S.L.'
  },
  {
    category: 'Prevención de Riesgos (PRL)',
    title: '🎺 Protección Laboral y Capacitaciones',
    definition: 'Asegurar preventivamente las condiciones de trabajo seguras y cumplir con el Convenio Colectivo Estatal de la Construcción.',
    concepts: [
      'Servicios externos de prevención (SPA) y coordinación técnica.',
      'Cursos oficiales presenciales u homologados de 20h de Tarjeta TPC (Construcción).',
      'Reconocimientos médicos y de salud obligatorios de la plantilla de campo.',
      'Equipos de protección individual coleccionables en almacén (cascos, botas, arneses).'
    ],
    presetDescription: 'Reconocimientos médicos obligatorios de aptitud de la plantilla comercial y operarios',
    presetAmount: 350.00,
    presetNotes: 'Factura emitida por Servicio Clínico Cualitis.'
  },
  {
    category: 'Ferretería y Utillaje',
    title: '🔨 Herramental y Material Común',
    definition: 'Medios mecánicos y de percusión manual no vinculados a una obra, con amortización de corto plazo.',
    concepts: [
      'Picas de pala, niveles láser ópticos, cintas métricas, llanas o fratases.',
      'Herramientas portátiles eléctricas (taladros percutores, amoladoras manuales).',
      'Insumos fungibles estándar: discos de corte de diamante, puntas, bridas.',
      'Repuesto de baterías de herramental común o cables y alargadores.'
    ],
    presetDescription: 'Compra de caja de discos de diamante y brocas de vidia para almacén general',
    presetAmount: 165.20,
    presetNotes: 'Factura de Ferretería Industrial El Arco.'
  },
  {
    category: 'Publicidad y Uniformes',
    title: '📢 Identidad, Branding y Visibilidad',
    definition: 'Acciones encaminadas a reflejar profesionalidad frente al promotor e impulsar la reputación corporativa.',
    concepts: [
      'Uniformes de campo corporativos con serigrafía de logotipo (chalecos, sudaderas).',
      'Diseño y hosting para la página web comercial de obras ejecutadas.',
      'Lonas microperforadas impresas con marca corporativa para andamiajes.',
      'Diseño y rotulado de vehículos industriales y camionetas.'
    ],
    presetDescription: 'Pedido de chaquetas de abrigo técnicas e impermeables con logo para operarios',
    presetAmount: 290.00,
    presetNotes: 'Empresa proveedora Suministros Textiles del Sur.'
  },
  {
    category: 'Impuestos, Licencias y Avales',
    title: '🏛️ Gastos Reguladores y Fianzas',
    definition: 'Tasas locales, impuestos anuales fijos de infraestructuras y comisiones financieras de instrumentos de licitación.',
    concepts: [
      'Comisiones de mantenimiento y apertura de avales bancarios para pujas de contratos.',
      'Impuesto de Bienes Inmuebles (IBI) de la sede central y campamentos fijos.',
      'Tasa de colegiación profesional de los Aparejadores/Ingenieros titulares.',
      'Impuestos de matriculación u homologación municipal general.'
    ],
    presetDescription: 'Comisión trimestral del aval bancario depositado ante diputación provincial',
    presetAmount: 180.00,
    presetNotes: 'Entidad emisora Banco Sabadell.'
  }
];

interface BulkItemState {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progressText: string;
  extractedExpenses?: IAStructuralExpenseExtraction[];
}

export default function OtrosGastosManager({
  gastosGenerales,
  addGasto,
  addGastosBatch,
  deleteGasto,
  updateGasto,
  obras,
  updateObra
}: OtrosGastosManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedGuideCat, setSelectedGuideCat] = useState<string | null>(null);

  // AI Import Modal state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiQueue, setAiQueue] = useState<BulkItemState[]>([]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiErrorMessage, setAiErrorMessage] = useState('');
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');

  // Monthly overhead allocation states
  const [selectedAllocationMonth, setSelectedAllocationMonth] = useState<string>('all');
  const [allocationViewMode, setAllocationViewMode] = useState<'cards' | 'matrix' | 'chart'>('cards');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');

  // Sorting state
  type SortKey = 'category' | 'description' | 'date' | 'amount' | 'supplier';
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Edit / Input states
  const [editingGastoId, setEditingGastoId] = useState<string | null>(null);

  // Form fields
  const [category, setCategory] = useState(CONST_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(0);
  const [supplier, setSupplier] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [baseAmount, setBaseAmount] = useState<number>(0);
  const [ivaRate, setIvaRate] = useState<number>(21);
  const [ivaAmount, setIvaAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isFormScanning, setIsFormScanning] = useState(false);

  // Document Lightbox preview
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('');

  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const formFileInputRef = useRef<HTMLInputElement>(null);

  // Handle Base Amount / IVA Auto-calculation in Form
  const handleBaseChange = (newBase: number, currentIvaRate: number = ivaRate) => {
    setBaseAmount(newBase);
    const calculatedIva = Number((newBase * (currentIvaRate / 100)).toFixed(2));
    setIvaAmount(calculatedIva);
    setAmount(Number((newBase + calculatedIva).toFixed(2)));
  };

  const handleIvaRateChange = (newRate: number) => {
    setIvaRate(newRate);
    const calculatedIva = Number((baseAmount * (newRate / 100)).toFixed(2));
    setIvaAmount(calculatedIva);
    setAmount(Number((baseAmount + calculatedIva).toFixed(2)));
  };

  const handleTotalAmountChange = (newTotal: number, currentIvaRate: number = ivaRate) => {
    setAmount(newTotal);
    if (newTotal > 0 && currentIvaRate >= 0) {
      const calculatedBase = Number((newTotal / (1 + currentIvaRate / 100)).toFixed(2));
      const calculatedIva = Number((newTotal - calculatedBase).toFixed(2));
      setBaseAmount(calculatedBase);
      setIvaAmount(calculatedIva);
    }
  };

  const handleAutoFill = (cat: string, desc: string, amt: number, nt: string) => {
    setCategory(cat);
    setDescription(desc);
    setAmount(amt);
    setNotes(nt);
    setDate(new Date().toISOString().split('T')[0]);
    setSupplier('');
    setDocNumber('');
    const base = Number((amt / 1.21).toFixed(2));
    setBaseAmount(base);
    setIvaRate(21);
    setIvaAmount(Number((amt - base).toFixed(2)));
    setImageUrl('');
    setEditingGastoId(null);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('overhead-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleStartEdit = (g: OtrosGasto) => {
    setEditingGastoId(g.id);
    setCategory(g.category);
    setDescription(g.description);
    setDate(g.date);
    setAmount(g.amount);
    setSupplier(g.supplier || '');
    setDocNumber(g.docNumber || '');
    setBaseAmount(g.baseAmount ?? Number((g.amount / 1.21).toFixed(2)));
    setIvaRate(g.ivaRate ?? 21);
    setIvaAmount(g.ivaAmount ?? Number((g.amount - (g.baseAmount || g.amount / 1.21)).toFixed(2)));
    setNotes(g.notes || '');
    setImageUrl(g.imageUrl || '');
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('overhead-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingGastoId(null);
    setDescription('');
    setSupplier('');
    setDocNumber('');
    setBaseAmount(0);
    setIvaAmount(0);
    setIvaRate(21);
    setNotes('');
    setImageUrl('');
    setAmount(0);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    if (editingGastoId) {
      const updated: OtrosGasto = {
        id: editingGastoId,
        category,
        description,
        date,
        amount: Number(amount) || 0,
        supplier: supplier.trim() || undefined,
        docNumber: docNumber.trim() || undefined,
        baseAmount: Number(baseAmount) || undefined,
        ivaRate: Number(ivaRate),
        ivaAmount: Number(ivaAmount) || undefined,
        notes: notes.trim() || undefined,
        imageUrl: imageUrl || undefined,
      };
      updateGasto(updated);
      setEditingGastoId(null);
    } else {
      const newGasto: OtrosGasto = {
        id: `g-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        category,
        description,
        date,
        amount: Number(amount) || 0,
        supplier: supplier.trim() || undefined,
        docNumber: docNumber.trim() || undefined,
        baseAmount: Number(baseAmount) || undefined,
        ivaRate: Number(ivaRate),
        ivaAmount: Number(ivaAmount) || undefined,
        notes: notes.trim() || undefined,
        imageUrl: imageUrl || undefined,
      };
      addGasto(newGasto);
    }

    // Reset Form
    handleCancelEdit();
  };

  // --- AI SCANNING FOR SINGLE FORM UPLOAD ---
  const handleFormFileScan = async (file: File) => {
    if (!file) return;
    setIsFormScanning(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsDataURL(file);
      });

      setImageUrl(base64Data);

      // Check if user is offline, run Tesseract OCR locally
      if (!navigator.onLine) {
        const localDoc = await scanDocumentLocally(base64Data);
        const cat = inferExpenseCategory(localDoc.supplier + ' ' + localDoc.rawText);
        setCategory(cat);
        if (localDoc.supplier) setSupplier(localDoc.supplier);
        if (localDoc.docNumber) setDocNumber(localDoc.docNumber);
        if (localDoc.date) setDate(localDoc.date);
        if (localDoc.totalAmount) setAmount(localDoc.totalAmount);
        if (localDoc.baseAmount) setBaseAmount(localDoc.baseAmount);
        if (localDoc.ivaRate !== undefined) setIvaRate(localDoc.ivaRate);
        if (localDoc.ivaAmount !== undefined) setIvaAmount(localDoc.ivaAmount);
        setDescription(localDoc.items && localDoc.items.length > 0 ? localDoc.items.map(i => i.name).join(', ') : `Factura ${localDoc.supplier || 'gasto'}`);
        if (localDoc.notes) setNotes(localDoc.notes);
        return;
      }

      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

      const response = await fetch('/api/gemini/analyze-structural-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: cleanBase64,
          mimeType: file.type || 'application/pdf',
          filename: file.name
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errData.error || 'Error en el servidor de IA.');
      }

      const data = await response.json();
      const extractedList: IAStructuralExpenseExtraction[] = data.expenses || [];
      if (extractedList.length > 0) {
        const first = extractedList[0];
        if (first.category && CONST_CATEGORIES.includes(first.category)) {
          setCategory(first.category);
        }
        if (first.description) setDescription(first.description);
        if (first.supplier) setSupplier(first.supplier);
        if (first.docNumber) setDocNumber(first.docNumber);
        if (first.date) setDate(first.date);
        if (first.amount) setAmount(Number(first.amount));
        if (first.baseAmount) setBaseAmount(Number(first.baseAmount));
        if (first.ivaRate !== undefined) setIvaRate(Number(first.ivaRate));
        if (first.ivaAmount !== undefined) setIvaAmount(Number(first.ivaAmount));
        if (first.notes) setNotes(first.notes);
      }
    } catch (err: any) {
      console.warn('Gemini falló en gastos generales, conmutando a OCR Local Tesseract.js...', err);
      // Automatic fallback to local OCR
      try {
        const base64Data = imageUrl || await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer el archivo.'));
          reader.readAsDataURL(file);
        });

        const localDoc = await scanDocumentLocally(base64Data);
        const cat = inferExpenseCategory(localDoc.supplier + ' ' + localDoc.rawText);
        setCategory(cat);
        if (localDoc.supplier) setSupplier(localDoc.supplier);
        if (localDoc.docNumber) setDocNumber(localDoc.docNumber);
        if (localDoc.date) setDate(localDoc.date);
        if (localDoc.totalAmount) setAmount(localDoc.totalAmount);
        if (localDoc.baseAmount) setBaseAmount(localDoc.baseAmount);
        if (localDoc.ivaRate !== undefined) setIvaRate(localDoc.ivaRate);
        if (localDoc.ivaAmount !== undefined) setIvaAmount(localDoc.ivaAmount);
        setDescription(localDoc.items && localDoc.items.length > 0 ? localDoc.items.map(i => i.name).join(', ') : `Gasto ${localDoc.supplier || 'general'}`);
        if (localDoc.notes) setNotes(localDoc.notes);
      } catch (fallbackErr: any) {
        console.error('Error al escanear con IA y OCR Local:', fallbackErr);
        alert('Error en el escaneo: ' + (fallbackErr.message || fallbackErr));
      }
    } finally {
      setIsFormScanning(false);
    }
  };

  // --- BATCH / MODAL AI SCAN LOGIC ---
  const handleAddFilesToAiQueue = (files: FileList | File[]) => {
    const newItems: BulkItemState[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      newItems.push({
        id: `ai-item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        file,
        previewUrl,
        status: 'pending',
        progressText: 'Listo para procesar con IA',
      });
    }
    setAiQueue(prev => [...prev, ...newItems]);
    setAiErrorMessage('');
    setAiSuccessMessage('');
  };

  const processAiItem = async (itemId: string, queueSnapshot: BulkItemState[]) => {
    const item = queueSnapshot.find(it => it.id === itemId);
    if (!item) return;

    // If offline, use local OCR directly
    if (!navigator.onLine) {
      setAiQueue(prev => prev.map(it => 
        it.id === itemId 
          ? { ...it, status: 'processing', progressText: 'Escaneando offline con Tesseract.js...' } 
          : it
      ));

      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer el archivo.'));
          reader.readAsDataURL(item.file);
        });

        const localDoc = await scanDocumentLocally(base64Data);
        const cat = inferExpenseCategory(localDoc.supplier + ' ' + localDoc.rawText);
        const extracted: IAStructuralExpenseExtraction[] = [{
          category: cat,
          description: localDoc.items && localDoc.items.length > 0 ? localDoc.items.map(i => i.name).join(', ') : `Factura ${localDoc.supplier || 'gasto'}`,
          supplier: localDoc.supplier,
          docNumber: localDoc.docNumber,
          date: localDoc.date,
          amount: localDoc.totalAmount,
          baseAmount: localDoc.baseAmount,
          ivaRate: localDoc.ivaRate,
          ivaAmount: localDoc.ivaAmount,
          notes: localDoc.notes
        }];

        setAiQueue(prev => prev.map(it => 
          it.id === itemId 
            ? {
                ...it,
                status: 'completed',
                progressText: `OCR Local: ${localDoc.supplier || 'Gasto'} (${localDoc.totalAmount.toFixed(2)}€)`,
                extractedExpenses: extracted,
                previewUrl: it.previewUrl || (base64Data.startsWith('data:image') ? base64Data : '')
              }
            : it
        ));
        return;
      } catch (localErr: any) {
        setAiQueue(prev => prev.map(it => 
          it.id === itemId 
            ? { ...it, status: 'failed', progressText: `Error OCR Local: ${localErr.message || 'Error'}` } 
            : it
        ));
        return;
      }
    }

    setAiQueue(prev => prev.map(it => 
      it.id === itemId 
        ? { ...it, status: 'processing', progressText: 'Escaneando con Gemini AI...' } 
        : it
    ));

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error al leer el archivo.'));
        reader.readAsDataURL(item.file);
      });

      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

      const response = await fetch('/api/gemini/analyze-structural-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: cleanBase64,
          mimeType: item.file.type || 'application/pdf',
          filename: item.file.name
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Respuesta fallida del servidor.');
      }

      const result = await response.json();
      const extracted: IAStructuralExpenseExtraction[] = result.expenses || [];

      setAiQueue(prev => prev.map(it => 
        it.id === itemId 
          ? {
              ...it,
              status: 'completed',
              progressText: `Detectado: ${extracted.length} gasto(s)`,
              extractedExpenses: extracted,
              previewUrl: it.previewUrl || (base64Data.startsWith('data:image') ? base64Data : '')
            }
          : it
      ));
    } catch (err: any) {
      console.warn(`Error en Gemini para ${itemId}, intentando OCR Local de contingencia:`, err);
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer el archivo.'));
          reader.readAsDataURL(item.file);
        });

        const localDoc = await scanDocumentLocally(base64Data);
        const cat = inferExpenseCategory(localDoc.supplier + ' ' + localDoc.rawText);
        const extracted: IAStructuralExpenseExtraction[] = [{
          category: cat,
          description: localDoc.items && localDoc.items.length > 0 ? localDoc.items.map(i => i.name).join(', ') : `Gasto ${localDoc.supplier || 'general'}`,
          supplier: localDoc.supplier,
          docNumber: localDoc.docNumber,
          date: localDoc.date,
          amount: localDoc.totalAmount,
          baseAmount: localDoc.baseAmount,
          ivaRate: localDoc.ivaRate,
          ivaAmount: localDoc.ivaAmount,
          notes: localDoc.notes
        }];

        setAiQueue(prev => prev.map(it => 
          it.id === itemId 
            ? {
                ...it,
                status: 'completed',
                progressText: `OCR Contingencia: ${localDoc.supplier || 'Gasto'} (${localDoc.totalAmount.toFixed(2)}€)`,
                extractedExpenses: extracted,
                previewUrl: it.previewUrl || (base64Data.startsWith('data:image') ? base64Data : '')
              }
            : it
        ));
      } catch (localFallbackErr: any) {
        setAiQueue(prev => prev.map(it => 
          it.id === itemId 
            ? { ...it, status: 'failed', progressText: `Error: Gemini (${err.message}) y OCR (${localFallbackErr.message})` } 
            : it
        ));
      }
    }
  };

  const handleStartAiProcessing = async () => {
    if (aiQueue.length === 0) return;
    setIsAiProcessing(true);
    setAiErrorMessage('');
    const snapshot = [...aiQueue];
    const pendingItems = snapshot.filter(it => it.status === 'pending' || it.status === 'failed');

    // Process items sequentially with a short pause to ensure steady progress and respect quota limits
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      await processAiItem(item.id, snapshot);
      if (i < pendingItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
    setIsAiProcessing(false);
  };

  const handleUpdateExtractedCategory = (itemId: string, expenseIndex: number, newCat: string) => {
    setAiQueue(prev => prev.map(it => {
      if (it.id === itemId && it.extractedExpenses) {
        const updatedExp = [...it.extractedExpenses];
        if (updatedExp[expenseIndex]) {
          updatedExp[expenseIndex] = { ...updatedExp[expenseIndex], category: newCat };
        }
        return { ...it, extractedExpenses: updatedExp };
      }
      return it;
    }));
  };

  const handleImportAllCompletedAiExpenses = () => {
    const completedItems = aiQueue.filter(it => it.status === 'completed' && it.extractedExpenses && it.extractedExpenses.length > 0);
    if (completedItems.length === 0) {
      setAiErrorMessage('No hay gastos reconocidos para importar. Por favor ejecute el escaneo de IA.');
      return;
    }

    const newGastosToInsert: OtrosGasto[] = [];

    completedItems.forEach(item => {
      (item.extractedExpenses || []).forEach((exp, idx) => {
        newGastosToInsert.push({
          id: `g-ai-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          category: CONST_CATEGORIES.includes(exp.category) ? exp.category : 'Otros Gastos Indirectos',
          description: exp.description || `Gasto de estructura detectado por IA (${item.file.name})`,
          date: exp.date || new Date().toISOString().split('T')[0],
          amount: Number(exp.amount) || 0,
          supplier: exp.supplier || undefined,
          docNumber: exp.docNumber || undefined,
          baseAmount: exp.baseAmount !== undefined ? Number(exp.baseAmount) : undefined,
          ivaRate: exp.ivaRate !== undefined ? Number(exp.ivaRate) : 21,
          ivaAmount: exp.ivaAmount !== undefined ? Number(exp.ivaAmount) : undefined,
          notes: exp.notes ? `${exp.notes} • Importado desde ${item.file.name}` : `Importado por IA desde ${item.file.name}`,
          imageUrl: item.previewUrl || undefined
        });
      });
    });

    if (addGastosBatch) {
      addGastosBatch(newGastosToInsert);
    } else {
      newGastosToInsert.forEach(g => addGasto(g));
    }

    setAiSuccessMessage(`¡Éxito! Se han importado correctamente ${newGastosToInsert.length} gastos estructurales a la contabilidad.`);
    setAiQueue([]);
    setTimeout(() => {
      setShowAiModal(false);
      setAiSuccessMessage('');
    }, 1200);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Monthly overhead allocation breakdown across all dates
  const { monthlyList, obraSummaries, totalGlobalOverhead, allMonthKeys } = useMemo(() => {
    return getMonthlyOverheadAllocationBreakdown(gastosGenerales, obras);
  }, [gastosGenerales, obras]);

  const filteredGastos = gastosGenerales.filter(g => {
    const matchesSearch = 
      g.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
      g.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.supplier && g.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (g.docNumber && g.docNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (g.notes && g.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategoryFilter === 'all' || g.category === selectedCategoryFilter;
    const matchesMonth = selectedMonthFilter === 'all' || (g.date && g.date.startsWith(selectedMonthFilter));

    return matchesSearch && matchesCategory && matchesMonth;
  });

  const sortedGastos = [...filteredGastos].sort((a, b) => {
    let valA = a[sortKey] || '';
    let valB = b[sortKey] || '';

    if (sortKey === 'amount') {
      return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    
    return 0;
  });

  const totalSpent = gastosGenerales.reduce((sum, g) => sum + g.amount, 0);
  const totalFilteredSpent = filteredGastos.reduce((sum, g) => sum + g.amount, 0);

  // Global accumulated allocation
  const allocationMap = useMemo(() => {
    return getObraOverheadAllocationMap(obras, totalSpent);
  }, [obras, totalSpent]);

  // Selected Monthly Allocation Data
  const currentMonthData = useMemo(() => {
    if (selectedAllocationMonth === 'all') {
      return {
        monthKey: 'all',
        monthLabel: 'Todos los meses (Total Acumulado)',
        totalOverhead: totalSpent,
        count: gastosGenerales.length,
        allocationsByObra: allocationMap
      };
    }
    const found = monthlyList.find(m => m.monthKey === selectedAllocationMonth);
    if (found) {
      return {
        monthKey: found.monthKey,
        monthLabel: found.monthLabel,
        totalOverhead: found.totalOverhead,
        count: found.gastosCount,
        allocationsByObra: found.allocationsByObra
      };
    }
    return {
      monthKey: selectedAllocationMonth,
      monthLabel: formatMonthKeyToLabel(selectedAllocationMonth),
      totalOverhead: 0,
      count: 0,
      allocationsByObra: getObraOverheadAllocationMap(obras, 0)
    };
  }, [selectedAllocationMonth, monthlyList, totalSpent, gastosGenerales.length, allocationMap, obras]);

  const currentAllocationMonthIndex = monthlyList.findIndex(m => m.monthKey === selectedAllocationMonth);

  return (
    <div className="space-y-6" id="otros-gastos-module">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fadeIn" id="overhead-header">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight animate-slideDown" id="overhead-title">
            Gastos Estructurales e Indirectos de Empresa
          </h2>
          <p className="text-xs text-white/50">
            Registre y catalogue costes indirectos: facturas de suministros, alquileres, combustibles, pólizas, asesoría y digitalización automática por IA (PDF / Imágenes).
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto" id="overhead-actions-container">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`border border-white/10 hover:bg-white/5 text-white font-bold py-2.5 px-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer grow sm:grow-0 ${showGuide ? 'bg-white/10 border-white/20' : ''}`}
            id="btn-toggle-overhead-guide"
          >
            <BookOpen className="w-4 h-4 text-[#10B981]" />
            Catálogo Sectorial
            {showGuide ? <ChevronUp className="w-3.5 h-3.5 text-white/50" /> : <ChevronDown className="w-3.5 h-3.5 text-white/50" />}
          </button>

          <button
            onClick={() => {
              setShowAiModal(true);
              setAiErrorMessage('');
            }}
            className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold py-2.5 px-4 rounded-xl shadow-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap grow sm:grow-0"
            id="btn-open-ai-structural-modal"
          >
            <Sparkles className="w-4 h-4 text-black" />
            📷 Importar Facturas con IA
          </button>

          <button
            onClick={() => {
              if (showForm && editingGastoId) {
                handleCancelEdit();
              } else {
                setEditingGastoId(null);
                setDescription('');
                setSupplier('');
                setDocNumber('');
                setBaseAmount(0);
                setIvaAmount(0);
                setIvaRate(21);
                setNotes('');
                setImageUrl('');
                setAmount(0);
                setShowForm(!showForm);
              }
            }}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-sm text-xs flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap grow sm:grow-0"
            id="btn-toggle-overhead-form"
          >
            <Plus className="w-4 h-4 text-white" />
            {editingGastoId ? 'Modo Alta Manual' : showForm ? 'Ocultar Formulario' : 'Nuevo Registro Manual'}
          </button>
        </div>
      </div>

      {/* AI MULTI-DOCUMENT / PDF & IMAGE IMPORT MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" id="ai-structural-import-modal">
          <div className="bg-[#161618] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            
            {/* Modal Top Bar */}
            <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-[#1C1C1E]">
              <div className="flex items-center gap-3">
                <div className="bg-[#10B981]/15 text-[#10B981] p-2.5 rounded-2xl">
                  <Sparkles className="w-5 h-5 text-[#10B981]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    Importación Inteligente de Facturas y Gastos de Estructura
                  </h3>
                  <p className="text-xs text-white/50">
                    Soporta PDFs y formatos de imagen (PNG, JPG, WEBP). La Inteligencia Artificial detecta importes, IVA, emisor y categorización.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAiModal(false)}
                className="text-white/40 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Connection Status & Engine Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/[0.03] border border-white/10 rounded-2xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-[11px] flex items-center gap-1.5 font-medium">
                    <Cpu className="w-3.5 h-3.5 text-[#10B981]" />
                    Tecnología:
                  </span>
                  <span className="font-bold text-white text-[11px] bg-white/10 px-2 py-0.5 rounded-md">
                    Gemini Nube + OCR Local (Tesseract.js)
                  </span>
                </div>
                <div>
                  {typeof navigator !== 'undefined' && navigator.onLine ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-medium bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                      <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                      <Wifi className="w-3 h-3" />
                      Conectado (Gemini AI + Fallback Local)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      <WifiOff className="w-3 h-3 text-amber-400" />
                      Sin conexión (Escaneo 100% Offline con Tesseract)
                    </span>
                  )}
                </div>
              </div>

              {/* Dropzone Container */}
              <div 
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleAddFilesToAiQueue(e.dataTransfer.files);
                  }
                }}
                className="border-2 border-dashed border-white/15 hover:border-[#10B981]/60 rounded-3xl p-8 text-center bg-white/[0.01] hover:bg-[#10B981]/[0.02] transition-all flex flex-col items-center justify-center cursor-pointer group"
                onClick={() => bulkFileInputRef.current?.click()}
                id="ai-dropzone-structural"
              >
                <input 
                  type="file"
                  ref={bulkFileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleAddFilesToAiQueue(e.target.files);
                    }
                  }}
                  accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-extrabold text-white mb-1">
                  Arrastra aquí tus facturas o recibos en PDF o formato de Imagen
                </h4>
                <p className="text-xs text-white/50 max-w-md">
                  Puedes seleccionar un archivo individual o varios a la vez (lotes masivos). Gemini extraerá el proveedor, fecha, base, IVA y clasificará en la categoría adecuada.
                </p>
                <span className="mt-3 inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-white/60">
                  Formatos compatibles: PDF, PNG, JPG, JPEG, WEBP
                </span>
              </div>

              {/* Status messages */}
              {aiErrorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3 text-xs text-rose-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{aiErrorMessage}</span>
                </div>
              )}

              {aiSuccessMessage && (
                <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-2xl p-4 flex items-center gap-3 text-xs text-[#10B981]">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span>{aiSuccessMessage}</span>
                </div>
              )}

              {/* Queue Listing */}
              {aiQueue.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#10B981]" />
                      Archivos en cola para escaneo ({aiQueue.length})
                    </h4>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAiQueue([])}
                        className="text-xs text-white/40 hover:text-rose-400 px-2 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                        disabled={isAiProcessing}
                      >
                        Vaciar cola
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {aiQueue.map((item) => (
                      <div key={item.id} className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {item.previewUrl ? (
                              <img src={item.previewUrl} alt="Preview" className="w-10 h-10 object-cover rounded-xl border border-white/10 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 shrink-0">
                                <FileText className="w-5 h-5 text-white/60" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-white truncate block">{item.file.name}</span>
                              <span className="text-[10px] text-white/40 font-mono">
                                {(item.file.size / 1024).toFixed(1)} KB • {item.file.type || 'Documento'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 ${
                              item.status === 'completed' ? 'bg-[#10B981]/10 text-[#10B981]' :
                              item.status === 'processing' ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
                              item.status === 'failed' ? 'bg-rose-500/10 text-rose-400' :
                              'bg-white/5 text-white/50'
                            }`}>
                              {item.status === 'processing' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                              {item.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
                              {item.status === 'failed' && <AlertCircle className="w-3.5 h-3.5" />}
                              {item.progressText}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAiQueue(prev => prev.filter(it => it.id !== item.id))}
                              className="text-white/30 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                              disabled={isAiProcessing}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Extracted Expenses List for this item */}
                        {item.extractedExpenses && item.extractedExpenses.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-white/5">
                            {item.extractedExpenses.map((exp, expIdx) => (
                              <div key={expIdx} className="bg-black/30 border border-white/5 rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-center text-xs">
                                <div className="md:col-span-1">
                                  <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Categoría Detectada</label>
                                  <select
                                    className="w-full bg-[#252528] rounded-lg border border-white/10 px-2 py-1 text-xs text-white focus:outline-none focus:border-[#10B981]"
                                    value={exp.category}
                                    onChange={(e) => handleUpdateExtractedCategory(item.id, expIdx, e.target.value)}
                                  >
                                    {CONST_CATEGORIES.map(c => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="md:col-span-1">
                                  <span className="block text-[9px] font-bold text-white/40 uppercase mb-1">Proveedor / Doc</span>
                                  <span className="font-semibold text-white truncate block">{exp.supplier || 'Emisor S/N'}</span>
                                  <span className="text-[10px] text-white/40 font-mono">{exp.docNumber || 'S/N'}</span>
                                </div>

                                <div className="md:col-span-1">
                                  <span className="block text-[9px] font-bold text-white/40 uppercase mb-1">Concepto</span>
                                  <span className="text-white/80 line-clamp-1">{exp.description}</span>
                                  <span className="text-[10px] text-white/40 font-mono">{exp.date}</span>
                                </div>

                                <div className="md:col-span-1 text-right">
                                  <span className="block text-[9px] font-bold text-white/40 uppercase mb-1">Importe Total</span>
                                  <span className="font-mono font-black text-sm text-[#10B981]">{exp.amount.toFixed(2)} €</span>
                                  <span className="text-[10px] text-white/40 block font-mono">
                                    Base: {(exp.baseAmount ?? (exp.amount / 1.21)).toFixed(2)} € (IVA {exp.ivaRate ?? 21}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="px-6 py-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3 bg-[#1C1C1E]">
              <div className="text-xs text-white/50">
                {aiQueue.filter(it => it.status === 'completed').length > 0 && (
                  <span>
                    Listos para importar: <strong className="text-[#10B981] font-bold">
                      {aiQueue.filter(it => it.status === 'completed').reduce((acc, it) => acc + (it.extractedExpenses?.length || 0), 0)} gasto(s)
                    </strong>
                  </span>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-white/70 text-xs font-bold transition-all cursor-pointer grow sm:grow-0"
                  disabled={isAiProcessing}
                >
                  Cancelar
                </button>

                {aiQueue.some(it => it.status === 'pending' || it.status === 'failed') && (
                  <button
                    type="button"
                    onClick={handleStartAiProcessing}
                    disabled={isAiProcessing || aiQueue.length === 0}
                    className="bg-white/10 hover:bg-white/20 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md grow sm:grow-0"
                  >
                    {isAiProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#10B981]" />
                        <span>Analizando documentos...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-[#10B981]" />
                        <span>Ejecutar Reconocimiento IA</span>
                      </>
                    )}
                  </button>
                )}

                {aiQueue.some(it => it.status === 'completed') && (
                  <button
                    type="button"
                    onClick={handleImportAllCompletedAiExpenses}
                    disabled={isAiProcessing}
                    className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#10B981]/20 grow sm:grow-0"
                  >
                    <FileCheck className="w-4 h-4 text-black" />
                    <span>Guardar en Gastos Estructurales</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Structural Expenses Reference Guide */}
      {showGuide && (
        <div className="bg-[#111112] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn" id="overhead-reference-guide">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="font-extrabold text-[#10B981] text-xs uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Sparkles className="w-4 h-4 text-[#10B981] animate-pulse" />
                Catálogo Profesional de Referencias y Gastos Estructurales
              </h3>
              <p className="text-white/50 text-[10px] mt-1 leading-relaxed max-w-3xl">
                Los gastos de estructura abarcan todas las partidas indirectas indispensables para sostener la actividad comercial de una empresa constructora. Catalogar correctamente estos elementos evita absorber el beneficio neto de la obra. 
                <strong className="text-[#10B981] ml-1">Explore nuestro catálogo sectorial o pulse en "Cargar en Formulario" para rellenar automáticamente la ficha de ingreso.</strong>
              </p>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-white/40 hover:text-white text-xs px-2 py-1 cursor-pointer font-sans bg-white/5 hover:bg-white/10 rounded-lg border border-white/5"
            >
              Cerrar Catálogo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Guide Left List */}
            <div className="col-span-1 border-r border-white/5 pr-4 space-y-1" id="guide-categories-selector">
              <span className="block text-white/40 text-[9px] font-bold uppercase tracking-wider mb-2">Clasificador Sectorial</span>
              {REFERENCE_CATALOG.map((catItem) => {
                const isSelected = selectedGuideCat === catItem.category || (selectedGuideCat === null && catItem.category === REFERENCE_CATALOG[0].category);
                return (
                  <button
                    type="button"
                    key={catItem.category}
                    onClick={() => setSelectedGuideCat(catItem.category)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      isSelected 
                        ? 'bg-[#10B981]/15 text-[#10B981] border-l-2 border-[#10B981] pl-4 font-extrabold' 
                        : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    <span>{catItem.category}</span>
                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />}
                  </button>
                );
              })}
            </div>

            {/* Guide Right Detail Panel */}
            <div className="col-span-1 md:col-span-2 space-y-5" id="guide-category-details">
              {REFERENCE_CATALOG.filter(catItem => selectedGuideCat ? catItem.category === selectedGuideCat : catItem.category === REFERENCE_CATALOG[0].category).map((catItem) => (
                <div key={catItem.category} className="space-y-4 animate-fadeIn">
                  <div className="space-y-1.5">
                    <h4 className="text-white font-extrabold text-sm flex items-center gap-2">{catItem.title}</h4>
                    <span className="inline-block px-2 py-0.5 bg-white/5 border border-white/5 rounded-md text-[9px] font-mono text-[#10B981] uppercase tracking-wide">Área Operativa Indirecta</span>
                    <p className="text-white/70 text-xs leading-relaxed font-sans">{catItem.definition}</p>
                  </div>

                  <div className="bg-[#151516] border border-white/5 p-4 rounded-xl space-y-2.5">
                    <span className="block font-sans text-[10px] font-bold text-white/40 uppercase tracking-widest">Ejemplos de conceptos que se pueden generar:</span>
                    <ul className="space-y-1.5 pl-1">
                      {catItem.concepts.map((concept, index) => (
                        <li key={index} className="text-xs text-white/80 flex items-start gap-2">
                          <span className="text-[#10B981] font-mono mt-0.5">▪</span>
                          <span className="font-sans leading-snug">{concept}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-[#10B981]/25 bg-[#10B981]/5 px-4 py-3.5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold font-mono text-[#10B981] uppercase tracking-widest">Gasto de Plantilla de Referencia</span>
                      <p className="text-xs text-white font-semibold leading-tight">{catItem.presetDescription}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/50">
                        <span>Importe de referencia: <strong className="text-white font-mono font-bold">{catItem.presetAmount.toFixed(2)} €</strong></span>
                        <span>•</span>
                        <span>{catItem.presetNotes}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutoFill(catItem.category, catItem.presetDescription, catItem.presetAmount, catItem.presetNotes)}
                      className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold px-3 py-2 rounded-lg text-[10px] flex items-center gap-1.5 transition-all self-end sm:self-auto cursor-pointer shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-black" />
                      Cargar en Formulario
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Input & Smart AI Scan Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#151515] rounded-3xl p-6 border border-white/10 shadow-xl space-y-5 animate-fadeIn" id="overhead-form">
          <div className="flex justify-between items-center border-b border-white/5 pb-3" id="overhead-form-header">
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#10B981]" />
              {editingGastoId ? 'Editar Gasto Estructural' : 'Registrar Gasto Estructural / Indirecto de Empresa'}
            </h4>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-white/40 hover:text-white text-xs px-2 py-1 cursor-pointer"
            >
              Cerrar Formulario
            </button>
          </div>

          {/* Quick AI Auto-fill drop zone inside form */}
          <div className="bg-[#18181A] border border-dashed border-[#10B981]/30 hover:border-[#10B981] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#10B981]/10 text-[#10B981]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-white">¿Tienes la factura o recibo en PDF o imagen?</h5>
                <p className="text-[11px] text-white/50">Carga el documento para autocompletar automáticamente proveedor, fecha, base, IVA y categoría con IA.</p>
              </div>
            </div>
            <div>
              <input 
                type="file"
                ref={formFileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFormFileScan(file);
                }}
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => formFileInputRef.current?.click()}
                disabled={isFormScanning}
                className="bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/40 text-[#10B981] font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
              >
                {isFormScanning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analizando con IA...</span>
                  </>
                ) : (
                  <>
                    <FileUp className="w-3.5 h-3.5" />
                    <span>Escanear y Autocompletar con IA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {editingGastoId && (
            <div className="bg-[#10B981]/5 border border-[#10B981]/20 p-3 rounded-xl text-xs text-[#10B981] flex justify-between items-center">
              <span>Editando registro ID: <strong className="font-mono">{editingGastoId}</strong></span>
              <button 
                type="button" 
                onClick={handleCancelEdit}
                className="bg-[#10B981] hover:bg-[#10B981]/90 text-black px-2 py-1 rounded text-[10px] font-extrabold cursor-pointer"
              >
                Crear uno Nuevo
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Categoría del Gasto *</label>
              <select
                className="w-full bg-[#1E1E1E] rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981]"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CONST_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Supplier / Provider */}
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Proveedor / Emisor / Acreedor</label>
              <input
                type="text"
                className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981]"
                placeholder="Ej. Endesa Energía S.A., Cepsa, Mapfre..."
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>

            {/* Doc number */}
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Nº Factura / Justificante</label>
              <input
                type="text"
                className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] font-mono"
                placeholder="Ej. FT-2026-00481"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-white/60 mb-1">Concepto / Descripción del Gasto *</label>
              <input
                type="text"
                required
                className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981]"
                placeholder="Ej. Factura Cepsa gasoil de furgonetas e Iveco Daily"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Fecha de Devengo</label>
              <input
                type="date"
                className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] font-mono"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Base Imponible */}
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Base Imponible (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981] font-mono"
                placeholder="Ej. 100.00"
                value={baseAmount || ''}
                onChange={(e) => handleBaseChange(Number(e.target.value))}
              />
            </div>

            {/* IVA Rate & Cuota */}
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Tipo de IVA (%)</label>
              <div className="flex gap-2">
                <select
                  className="w-1/2 bg-[#1E1E1E] rounded-xl border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10B981] font-mono"
                  value={ivaRate}
                  onChange={(e) => handleIvaRateChange(Number(e.target.value))}
                >
                  <option value={21}>21 % (General)</option>
                  <option value={10}>10 % (Reducido)</option>
                  <option value={4}>4 % (Superreducido)</option>
                  <option value={0}>0 % (Exento / Suplido)</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  className="w-1/2 bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/80 font-mono"
                  placeholder="Cuota IVA"
                  value={ivaAmount || ''}
                  onChange={(e) => {
                    const newIva = Number(e.target.value);
                    setIvaAmount(newIva);
                    setAmount(Number((baseAmount + newIva).toFixed(2)));
                  }}
                />
              </div>
            </div>

            {/* Total Amount */}
            <div>
              <label className="block text-xs font-semibold text-[#10B981] mb-1">Importe Total con IVA (€) *</label>
              <input
                type="number"
                required
                step="0.01"
                className="w-full bg-[#10B981]/10 rounded-xl border border-[#10B981]/30 px-3 py-2 text-sm text-white font-black font-mono focus:outline-none focus:border-[#10B981]"
                placeholder="Ej. 121.00"
                value={amount || ''}
                onChange={(e) => handleTotalAmountChange(Number(e.target.value))}
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-white/60 mb-1">Observaciones / Método de Pago / Notas</label>
              <input
                type="text"
                className="w-full bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#10B981]"
                placeholder="Ej. Domiciliado en cuenta corriente Sabadell, pagado con tarjeta..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Image URL preview */}
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-1">Documento Digital / Factura Adjunta</label>
              {imageUrl ? (
                <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-xs text-[#10B981] font-medium flex items-center gap-1.5 truncate">
                    <FileCheck className="w-4 h-4 shrink-0" />
                    Documento vinculado
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewDocUrl(imageUrl);
                      setPreviewDocTitle(description || 'Factura de Gasto');
                    }}
                    className="text-xs text-white/60 hover:text-white p-1 hover:bg-white/10 rounded cursor-pointer"
                    title="Ver documento"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-white/40 hover:text-rose-400 p-1 hover:bg-white/10 rounded cursor-pointer ml-auto"
                    title="Quitar adjunto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-white/30 block py-2">Sin documento adjunto</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-white/5 pt-3" id="form-ovh-actions">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold py-2 px-6 rounded-xl text-xs cursor-pointer shadow-lg transition-all"
            >
              {editingGastoId ? 'Actualizar Gasto' : 'Guardar Gasto Estructural'}
            </button>
          </div>
        </form>
      )}

      {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#18181A] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#1F1F22]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#10B981]" />
                <span className="font-bold text-white text-xs">{previewDocTitle || 'Visor de Factura Digital'}</span>
              </div>
              <button 
                onClick={() => setPreviewDocUrl(null)}
                className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-black/40">
              {previewDocUrl.startsWith('data:application/pdf') || previewDocUrl.endsWith('.pdf') ? (
                <iframe src={previewDocUrl} className="w-full h-[70vh] rounded-xl border border-white/10" title="PDF Preview" />
              ) : (
                <img src={previewDocUrl} alt="Document Preview" className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-lg" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* REPERCUSSION OVERHEAD PRORATION MATRIX PANEL */}
      <div className="bg-[#151515] rounded-3xl p-6 border border-white/5 shadow-md space-y-5" id="distribution-overhead-panel">
        
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20">
                <Sliders className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  Reparto de Gastos Estructurales a las Obras por Meses
                  <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 bg-[#10B981]/15 text-[#10B981] rounded-full border border-[#10B981]/20 font-extrabold">
                    Repercusión Mensual
                  </span>
                </h3>
                <p className="text-xs text-white/50">
                  Los costes corporativos e indirectos se agrupan automáticamente por meses según la fecha de cada gasto/factura y se imputan a las obras con su porcentaje correspondiente.
                </p>
              </div>
            </div>
          </div>

          {/* Global summary pill */}
          <div className="flex items-center gap-2 bg-white/[0.02] border border-white/10 p-2 rounded-2xl shrink-0">
            <div className="px-3.5 py-1.5 bg-white/5 rounded-xl text-right">
              <span className="block text-[8px] text-white/40 uppercase font-mono tracking-wider">
                {selectedAllocationMonth === 'all' ? 'Total Estructura' : `Base ${currentMonthData.monthLabel}`}
              </span>
              <span className="text-xs font-black font-mono text-[#10B981]">
                {currentMonthData.totalOverhead.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="px-3.5 py-1.5 bg-white/5 rounded-xl text-right">
              <span className="block text-[8px] text-white/40 uppercase font-mono tracking-wider">Total Acumulado Global</span>
              <span className="text-xs font-bold font-mono text-white/80">
                {totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </div>

        {/* Month Selector Bar & View Modes */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-[#1A1A1C] p-3 rounded-2xl border border-white/5">
          
          {/* Month Selector & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-white/70 flex items-center gap-1.5 whitespace-nowrap pl-1">
              <Calendar className="w-4 h-4 text-[#10B981]" />
              Periodo de Reparto:
            </span>

            {/* Dropdown with all months */}
            <select
              value={selectedAllocationMonth}
              onChange={(e) => setSelectedAllocationMonth(e.target.value)}
              className="bg-[#242426] text-white text-xs font-bold font-mono rounded-xl border border-white/10 px-3 py-2 focus:outline-none focus:border-[#10B981] cursor-pointer"
              id="select-overhead-month"
            >
              <option value="all">📅 Todos los Meses (Total Acumulado: {totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €)</option>
              <optgroup label="Desglose mensual según fecha de gastos:">
                {monthlyList.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    🗓️ {m.monthLabel} — {m.totalOverhead.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € ({m.gastosCount} facturas/gastos)
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Quick Prev / Next Month buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (selectedAllocationMonth === 'all') {
                    if (monthlyList.length > 0) setSelectedAllocationMonth(monthlyList[0].monthKey);
                  } else if (currentAllocationMonthIndex < monthlyList.length - 1) {
                    setSelectedAllocationMonth(monthlyList[currentAllocationMonthIndex + 1].monthKey);
                  }
                }}
                disabled={selectedAllocationMonth !== 'all' && currentAllocationMonthIndex >= monthlyList.length - 1}
                title="Mes anterior"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-white/5 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentAllocationMonthIndex > 0) {
                    setSelectedAllocationMonth(monthlyList[currentAllocationMonthIndex - 1].monthKey);
                  }
                }}
                disabled={selectedAllocationMonth === 'all' || currentAllocationMonthIndex <= 0}
                title="Mes siguiente"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-white/5 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {selectedAllocationMonth !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedAllocationMonth('all')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white/70 hover:text-white border border-white/5 cursor-pointer ml-1"
                >
                  Ver Todo
                </button>
              )}
            </div>
          </div>

          {/* View Mode Selector Tabs */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setAllocationViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                allocationViewMode === 'cards'
                  ? 'bg-[#10B981] text-black font-extrabold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              id="tab-allocation-cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tarjetas & Ajuste</span>
            </button>

            <button
              type="button"
              onClick={() => setAllocationViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                allocationViewMode === 'matrix'
                  ? 'bg-[#10B981] text-black font-extrabold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              id="tab-allocation-matrix"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Matriz Mes a Mes</span>
            </button>

            <button
              type="button"
              onClick={() => setAllocationViewMode('chart')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                allocationViewMode === 'chart'
                  ? 'bg-[#10B981] text-black font-extrabold shadow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              id="tab-allocation-chart"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Evolución Mensual</span>
            </button>
          </div>
        </div>

        {obras.length === 0 ? (
          <div className="text-center py-6 text-xs text-white/35">
            No hay obras dadas de alta en el sistema para imputar gastos de estructura.
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: CARDS & ADJUSTMENTS */}
            {allocationViewMode === 'cards' && (
              <div className="space-y-4">
                {/* Active Period Info Bar */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                  <div className="flex items-center gap-2 text-white/70">
                    <CalendarDays className="w-4 h-4 text-[#10B981]" />
                    <span>
                      Reparto activo: <strong className="text-white">{currentMonthData.monthLabel}</strong>
                    </span>
                    <span className="text-white/30">•</span>
                    <span>
                      Costes de estructura: <strong className="text-[#10B981] font-mono">{currentMonthData.totalOverhead.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong> ({currentMonthData.count} registros)
                    </span>
                  </div>

                  {selectedAllocationMonth !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedMonthFilter(selectedAllocationMonth)}
                      className="text-[11px] text-[#10B981] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Filter className="w-3 h-3" />
                      Filtrar listado inferior por este mes
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="overhead-allocation-matrix-grid">
                  {obras.map(obra => {
                    const allocation = currentMonthData.allocationsByObra[obra.id] || { percent: 0, amount: 0 };
                    const currentPercentVal = allocation.percent * 100;
                    const isCustom = obra.overheadAllocationType === 'custom';
                    const obraSummary = obraSummaries.find(s => s.obraId === obra.id);

                    return (
                      <div 
                        key={obra.id} 
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                          isCustom ? 'bg-amber-500/[0.03] border-amber-500/20' : 'bg-white/[0.01] border-white/5'
                        }`} 
                        id={`allocation-card-${obra.id}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-white font-extrabold text-xs leading-tight line-clamp-1">{obra.name}</span>
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              isCustom ? 'bg-amber-500/10 text-amber-400' : 'bg-[#10B981]/10 text-[#10B981]'
                            }`}>
                              {isCustom ? 'Manual' : 'Proporcional'}
                            </span>
                          </div>

                          <div className="text-[10px] text-white/40 mb-3 flex justify-between">
                            <span>Ppto original: <strong className="font-mono text-white/50">{obra.budget.toLocaleString('es-ES')} €</strong></span>
                          </div>

                          {/* Controls */}
                          <div className="space-y-3 pt-2 border-t border-white/5">
                            <div>
                              <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wide mb-1">Modo de Reparto</label>
                              <select
                                className="w-full bg-[#202022] rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#10B981] cursor-pointer"
                                value={obra.overheadAllocationType || 'auto'}
                                onChange={(e) => {
                                  const val = e.target.value as 'auto' | 'custom';
                                  const defaultPct = isCustom ? (obra.overrideOverheadPercent || 0) : Math.round(currentPercentVal);
                                  updateObra({
                                    ...obra,
                                    overheadAllocationType: val,
                                    overrideOverheadPercent: val === 'custom' ? defaultPct : undefined
                                  });
                                }}
                              >
                                <option value="auto">Automático proporcional (Ppto)</option>
                                <option value="custom">Manual (% fijo personalizado)</option>
                              </select>
                            </div>

                            {isCustom && (
                              <div>
                                <label className="block text-[9px] font-semibold text-amber-400 flex justify-between mb-1">
                                  <span>Porcentaje Asignado manual</span>
                                  <span>{currentPercentVal.toFixed(1)}%</span>
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    className="w-full bg-[#252528] rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                                    value={obra.overrideOverheadPercent ?? 0}
                                    onChange={(e) => {
                                      const rawVal = Number(e.target.value);
                                      const validatedVal = Math.min(100, Math.max(0, rawVal));
                                      updateObra({
                                        ...obra,
                                        overrideOverheadPercent: validatedVal
                                      });
                                    }}
                                  />
                                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500/60" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Allocated result */}
                        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                          <div className="flex justify-between items-center bg-white/[0.02] p-2 rounded-xl text-xs">
                            <div>
                              <span className="text-white/40 font-semibold uppercase text-[9px] block">
                                {selectedAllocationMonth === 'all' ? 'Repercutido total:' : `Repercutido ${currentMonthData.monthLabel.split(' ')[0]}:`}
                              </span>
                              <span className="text-[10px] font-bold text-white/50 block font-mono">
                                ({(allocation.percent * 100).toFixed(1)} %)
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-white font-mono block text-xs">
                                {allocation.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                              </span>
                            </div>
                          </div>

                          {selectedAllocationMonth !== 'all' && obraSummary && (
                            <div className="flex justify-between items-center px-2 text-[10px] text-white/40">
                              <span>Total histórico acumulado:</span>
                              <strong className="font-mono text-white/70">
                                {obraSummary.totalAllocated.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW MODE 2: MONTH BY MONTH MATRIX TABLE */}
            {allocationViewMode === 'matrix' && (
              <div className="space-y-3" id="overhead-monthly-matrix-container">
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#1A1A1C]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-white/70">
                        <th className="p-3.5 font-extrabold uppercase text-[10px] tracking-wider min-w-[200px]">Obra / Proyecto</th>
                        <th className="p-3.5 font-extrabold uppercase text-[10px] tracking-wider text-right min-w-[110px]">Presupuesto</th>
                        <th className="p-3.5 font-extrabold uppercase text-[10px] tracking-wider text-center min-w-[100px]">Tipo Reparto</th>
                        <th className="p-3.5 font-extrabold uppercase text-[10px] tracking-wider text-right min-w-[80px]">% Asignado</th>
                        
                        {/* Month columns */}
                        {monthlyList.map(m => (
                          <th key={m.monthKey} className="p-3.5 font-extrabold text-[10px] tracking-wider text-right min-w-[120px] bg-white/[0.02]">
                            <div className="font-mono text-white">{m.monthLabel}</div>
                            <div className="text-[9px] text-[#10B981] font-mono font-normal">
                              ({m.totalOverhead.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €)
                            </div>
                          </th>
                        ))}

                        <th className="p-3.5 font-extrabold uppercase text-[10px] tracking-wider text-right min-w-[130px] bg-[#10B981]/10 text-[#10B981]">
                          Total Repercutido
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/90">
                      {obraSummaries.map(summary => {
                        const obra = obras.find(o => o.id === summary.obraId);
                        const isCustom = summary.isCustom;
                        const effectivePct = summary.configuredPercent > 0 
                          ? summary.configuredPercent 
                          : ((allocationMap[summary.obraId]?.percent || 0) * 100);

                        return (
                          <tr key={summary.obraId} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3.5 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <Building className="w-3.5 h-3.5 text-white/40 shrink-0" />
                                <span className="truncate">{summary.obraName}</span>
                              </div>
                            </td>
                            <td className="p-3.5 text-right font-mono text-white/70">
                              {summary.budget.toLocaleString('es-ES')} €
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                isCustom ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/20'
                              }`}>
                                {isCustom ? 'Manual' : 'Proporcional'}
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-white/80">
                              {effectivePct.toFixed(1)} %
                            </td>

                            {/* Monthly columns */}
                            {monthlyList.map(m => {
                              const amount = summary.monthlyAmounts[m.monthKey] || 0;
                              const pct = (summary.monthlyPercents[m.monthKey] || 0) * 100;

                              return (
                                <td key={m.monthKey} className="p-3.5 text-right font-mono bg-white/[0.01]">
                                  {amount > 0 ? (
                                    <div>
                                      <span className="font-bold text-white block">
                                        {amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                      </span>
                                      <span className="text-[9px] text-white/40 block">
                                        ({pct.toFixed(1)}%)
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-white/20">-</span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Grand total per obra */}
                            <td className="p-3.5 text-right font-mono font-black text-[#10B981] bg-[#10B981]/5 text-sm">
                              {summary.totalAllocated.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-white/20 bg-[#1F1F22] font-black text-white">
                        <td className="p-3.5 uppercase text-[10px] tracking-wider" colSpan={4}>
                          Total Gastos Estructurales por Mes
                        </td>
                        {monthlyList.map(m => (
                          <td key={m.monthKey} className="p-3.5 text-right font-mono text-[#10B981]">
                            <div>{m.totalOverhead.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</div>
                            <div className="text-[9px] text-white/40 font-normal">({m.gastosCount} facturas)</div>
                          </td>
                        ))}
                        <td className="p-3.5 text-right font-mono text-[#10B981] text-sm bg-[#10B981]/15">
                          {totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-[11px] text-white/40 italic text-right">
                  * Los importes mensuales se calculan aplicando los porcentajes de repercusión a la suma de gastos de estructura devengados en cada mes calendario.
                </p>
              </div>
            )}

            {/* VIEW MODE 3: MONTHLY EVOLUTION / BREAKDOWN */}
            {allocationViewMode === 'chart' && (
              <div className="space-y-4" id="overhead-monthly-evolution-container">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {monthlyList.map(m => {
                    const isSelected = selectedAllocationMonth === m.monthKey;
                    return (
                      <div 
                        key={m.monthKey}
                        className={`bg-[#1A1A1C] border rounded-2xl p-4 space-y-3 transition-all cursor-pointer hover:border-[#10B981]/50 ${
                          isSelected ? 'border-[#10B981] ring-1 ring-[#10B981]/30 bg-[#10B981]/[0.02]' : 'border-white/5'
                        }`}
                        onClick={() => {
                          setSelectedAllocationMonth(m.monthKey);
                          setAllocationViewMode('cards');
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
                              {m.monthLabel}
                            </span>
                            <span className="text-[10px] text-white/40 font-mono block mt-0.5">
                              {m.gastosCount} gastos registrados
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black font-mono text-[#10B981] block">
                              {m.totalOverhead.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </span>
                            <span className="text-[9px] text-white/50 uppercase font-mono">Gasto del mes</span>
                          </div>
                        </div>

                        {/* Obra distribution list */}
                        <div className="space-y-1.5 pt-2 border-t border-white/5">
                          <span className="text-[9px] uppercase font-bold text-white/40 tracking-wider block">
                            Repercusión en obras:
                          </span>
                          {obras.map(o => {
                            const alloc = m.allocationsByObra[o.id] || { percent: 0, amount: 0 };
                            return (
                              <div key={o.id} className="flex justify-between items-center text-[11px] text-white/70 py-0.5">
                                <span className="truncate pr-2 max-w-[160px]">{o.name}:</span>
                                <span className="font-mono font-bold text-white shrink-0">
                                  {alloc.amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                  <span className="text-[9px] text-white/40 ml-1">({(alloc.percent * 100).toFixed(0)}%)</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-white/5 flex justify-end">
                          <span className="text-[10px] text-[#10B981] font-bold flex items-center gap-1 hover:underline">
                            Ver detalles del mes <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1" id="overhead-search-box">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por concepto, proveedor, factura o categoría..."
              className="w-full bg-white/5 rounded-xl border border-white/10 pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#10B981]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Month Quick Filter */}
          <div className="w-full sm:w-56">
            <select
              className="w-full bg-[#1A1A1C] rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#10B981] cursor-pointer"
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              id="select-filter-by-month"
            >
              <option value="all">📅 Todos los meses ({gastosGenerales.length})</option>
              {monthlyList.map(m => (
                <option key={m.monthKey} value={m.monthKey}>
                  🗓️ {m.monthLabel} ({m.gastosCount} facturas - {m.totalOverhead.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €)
                </option>
              ))}
            </select>
          </div>

          {/* Category Quick Filter */}
          <div className="w-full sm:w-60">
            <select
              className="w-full bg-[#1A1A1C] rounded-xl border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#10B981] cursor-pointer"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            >
              <option value="all">Todas las categorías ({gastosGenerales.length})</option>
              {CONST_CATEGORIES.map(c => {
                const count = gastosGenerales.filter(g => g.category === c).length;
                return (
                  <option key={c} value={c}>{c} ({count})</option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Category Pills Scroller */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategoryFilter === 'all' 
                ? 'bg-[#10B981] text-black font-extrabold' 
                : 'bg-white/5 hover:bg-white/10 text-white/60'
            }`}
          >
            Todos ({gastosGenerales.length})
          </button>
          {CONST_CATEGORIES.map(c => {
            const count = gastosGenerales.filter(g => g.category === c).length;
            if (count === 0 && selectedCategoryFilter !== c) return null;
            return (
              <button
                key={c}
                onClick={() => setSelectedCategoryFilter(c)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategoryFilter === c 
                    ? 'bg-[#10B981] text-black font-extrabold' 
                    : 'bg-white/5 hover:bg-white/10 text-white/60'
                }`}
              >
                {c} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Expense summary */}
      <div className="bg-[#10B981]/10 border border-[#10B981]/20 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs text-white/80 shadow-inner" id="overhead-filtered-summary">
        <div>
          <span>Búsqueda: <strong>{filteredGastos.length}</strong> de {gastosGenerales.length} gastos de estructura.</span>
        </div>
        <div className="flex gap-4 font-semibold font-mono text-[#10B981]" id="overhead-filtered-ratios">
          <span>Suma filtrada: {totalFilteredSpent.toFixed(2)} €</span>
          <span>•</span>
          <span>Gran Total general: {totalSpent.toFixed(2)} €</span>
        </div>
      </div>

      {/* Corporate Expenses list grid table */}
      <div className="bg-[#151515] rounded-3xl border border-white/5 shadow-sm overflow-hidden" id="overhead-table-container">
        <div className="overflow-x-auto" id="overhead-table-scroll">
          <table className="w-full text-left font-sans text-xs border-collapse" id="overhead-table">
            <thead>
              <tr className="bg-white/5 text-white/40 border-b border-white/5 uppercase text-[10px] tracking-wider font-semibold">
                <th 
                  onClick={() => handleSort('category')} 
                  className="px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Categoría
                    <span className="text-[#10B981] font-mono text-[9px]">{sortKey === 'category' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('supplier')} 
                  className="px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Proveedor / Doc
                    <span className="text-[#10B981] font-mono text-[9px]">{sortKey === 'supplier' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('description')} 
                  className="px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Gasto Realizado / Concepto
                    <span className="text-[#10B981] font-mono text-[9px]">{sortKey === 'description' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('date')} 
                  className="px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Fecha
                    <span className="text-[#10B981] font-mono text-[9px]">{sortKey === 'date' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="px-5 py-3.5 text-right font-mono text-white/40 select-none">
                  Base / IVA
                </th>
                <th 
                  onClick={() => handleSort('amount')} 
                  className="px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors select-none text-right font-extrabold"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    Total (€)
                    <span className="text-[#10B981] font-mono text-[9px]">{sortKey === 'amount' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="px-5 py-3.5 text-center select-none">Adjunto</th>
                <th className="px-5 py-3.5 text-center select-none">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/80">
              {sortedGastos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-white/40">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Receipt className="w-8 h-8 text-white/20" />
                      <p>No se encontraron gastos generales para los filtros seleccionados.</p>
                      <button
                        onClick={() => setShowAiModal(true)}
                        className="text-[#10B981] hover:underline font-bold text-xs flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Importar facturas de gastos con IA
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedGastos.map(g => (
                  <tr key={g.id} className={`hover:bg-white/5 transition-colors ${editingGastoId === g.id ? 'bg-[#10B981]/5 outline outline-1 outline-[#10B981]/20' : ''}`} id={`row-overhead-${g.id}`}>
                    <td className="px-5 py-4">
                      <span className="inline-block px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 text-[11px] font-bold text-white/90">
                        {g.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {g.supplier ? (
                        <div>
                          <span className="font-bold text-white block truncate max-w-[140px]">{g.supplier}</span>
                          {g.docNumber && <span className="text-[10px] text-white/40 font-mono block mt-0.5">{g.docNumber}</span>}
                        </div>
                      ) : (
                        <span className="text-white/30 text-[11px] italic">No especificado</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <div className="font-medium text-white/90">{g.description}</div>
                        {g.notes && <div className="text-[10px] text-white/40 italic leading-snug mt-0.5">{g.notes}</div>}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-white/50 whitespace-nowrap">{g.date}</td>
                    <td className="px-5 py-4 font-mono text-right text-[11px] text-white/50 whitespace-nowrap">
                      {g.baseAmount ? (
                        <>
                          <div>{g.baseAmount.toFixed(2)} €</div>
                          <div className="text-[9px] text-white/30">IVA {g.ivaRate ?? 21}% ({g.ivaAmount ? `${g.ivaAmount.toFixed(2)} €` : ''})</div>
                        </>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-right text-white font-black whitespace-nowrap">
                      <span className="text-sm text-[#10B981]">{g.amount.toFixed(2)} €</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {g.imageUrl ? (
                        <button
                          onClick={() => {
                            setPreviewDocUrl(g.imageUrl || null);
                            setPreviewDocTitle(g.description || 'Documento de Gasto');
                          }}
                          className="text-[#10B981] hover:text-[#10B981]/80 p-1.5 rounded-lg bg-[#10B981]/10 hover:bg-[#10B981]/20 transition-all cursor-pointer inline-flex items-center justify-center"
                          title="Ver documento adjunto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-white/20">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleStartEdit(g)}
                          className="text-white/40 hover:text-[#10B981] p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center bg-white/5 hover:bg-white/10"
                          title="Editar registro de gasto"
                          id={`btn-edit-ovh-${g.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('¿Verdad que desea eliminar este gasto estructural de la contabilidad empresarial? Esta acción es irreversible.')) {
                              deleteGasto(g.id);
                              if (editingGastoId === g.id) {
                                handleCancelEdit();
                              }
                            }
                          }}
                          className="text-white/30 hover:text-rose-400 p-1.5 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center bg-white/5 hover:bg-white/10"
                          title="Eliminar gasto"
                          id={`btn-del-ovh-${g.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
