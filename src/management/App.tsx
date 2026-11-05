import { authorizedFetch } from '../supabase/http';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Obra, FacturaAlbaran, PersonalCost, OtrosGasto, DocumentItem, Proveedor, TrabajadorPRL, TrabajadorEmpresa, DocumentState, getObraOverheadAllocationMap, RegistroJornada, ActiveFichaje } from './types';
import { 
  INITIAL_OBRAS, 
  INITIAL_DOCUMENTOS, 
  INITIAL_PERSONAL, 
  INITIAL_OTROS_GASTOS,
  INITIAL_TRABAJADORES_EMPRESA,
  INITIAL_FICHAJES
} from './initialData';

// Firebase Integrations
import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
import { onAuthStateChanged, User, signInWithPopup, signOut } from '../supabase/authCompat';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch } from '../supabase/documentCompat';

// Modular layouts
import CompanyHeader from './components/CompanyHeader';
import KPICards from './components/KPICards';
import ObrasManager from './components/ObrasManager';
import PersonalManager from './components/PersonalManager';
import OtrosGastosManager from './components/OtrosGastosManager';
import { ControlHorarioManager } from './components/ControlHorarioManager';
import { WorkerPortal } from './components/WorkerPortal';
import ReportViewer from './components/ReportViewer';
import GoogleDriveExplorer from './components/GoogleDriveExplorer';
import GmailExplorer from './components/GmailExplorer';
import NotificationCenter from './components/NotificationCenter';
import BackupManager from './components/BackupManager';
import { DuplicateGroupCard } from './components/DuplicateGroupCard';
import { VirtualizedDocsTable } from './components/VirtualizedDocsTable';
import { exportDocsListToExcel } from './exportUtils';
import { ProcessImportResult } from './lib/obraExportImportService';
import { generateGlobalBackup } from './lib/backupService';
import { sanitizeForFirestore } from './lib/firestoreSanitizer';
import { scanDocumentLocally, LocalOcrExtractedDocument } from './lib/localOcrService';
import { upsertMasterBackupFile, MASTER_DRIVE_BACKUP_FILENAME, MASTER_DRIVE_BACKUP_FOLDER } from './lib/googleDriveService';
import { getAccessToken, googleSignIn } from './lib/googleAuth';
// @ts-ignore
import { jsPDF } from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';

// Custom Notification Service
import { sendPushNotification, checkProjectBudgetsAndNotify } from './lib/notificationService';

import { 
  Plus, Search, Receipt, Users, CreditCard, FileText, Sparkles, 
  Trash2, FileUp, Loader2, Check, AlertCircle, Building2, 
  Euro, Calendar, RefreshCw, Sun, Moon, Cloud, Mail, Download,
  FileSpreadsheet, TrendingUp, Wifi, WifiOff, Cpu, HardDrive,
  Database, LogIn, CheckCircle2, X, Clock,
  Smartphone, QrCode, Compass, LayoutGrid, MoreHorizontal, ChevronRight, Layers, ArrowRight
} from 'lucide-react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export interface BulkQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: string;
  error?: string;
  extractedData?: {
    documents?: NonNullable<BulkQueueItem['extractedData']>[];
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
  };
  destinationObraId: string;
}

// --- AUTOMATIC EXTRACTION ON INITIAL LOAD HELPER UTILS ---
const extractInitialProveedores = (docs: FacturaAlbaran[]): Proveedor[] => {
  const mapUnique = new Map<string, string>();
  docs.forEach(d => {
    mapUnique.set(d.supplier.trim(), d.docNumber);
  });

  const categoryMap: Record<string, string> = {
    'Hormigones del Sur S.A.': 'Hormigones y Áridos',
    'Materiales Arcos y Construcción S.L.': 'Ladrillos y Cerámicas',
    'Instalaciones Eléctricas Pérez': 'Instalaciones Eléctricas'
  };

  const nifMap: Record<string, string> = {
    'Hormigones del Sur S.A.': 'A41221087',
    'Materiales Arcos y Construcción S.L.': 'B56144883',
    'Instalaciones Eléctricas Pérez': 'B56788339'
  };

  const contactMap: Record<string, string> = {
    'Hormigones del Sur S.A.': 'Francisco González',
    'Materiales Arcos y Construcción S.L.': 'Andrés Arcos',
    'Instalaciones Eléctricas Pérez': 'Ignacio Pérez'
  };

  const phoneMap: Record<string, string> = {
    'Hormigones del Sur S.A.': '+34 956 70 80 40',
    'Materiales Arcos y Construcción S.L.': '+34 956 70 12 15',
    'Instalaciones Eléctricas Pérez': '+34 656 12 14 15'
  };

  const emailMap: Record<string, string> = {
    'Hormigones del Sur S.A.': 'pedidos@hormigonesdelsur.es',
    'Materiales Arcos y Construcción S.L.': 'ventas@materialesarcos.com',
    'Instalaciones Eléctricas Pérez': 'electricidadperez@colegio.es'
  };

  const addressMap: Record<string, string> = {
    'Hormigones del Sur S.A.': 'Ctra. de Jerez km 1.5, Arcos de la Fra. (Cádiz)',
    'Materiales Arcos y Construcción S.L.': 'Polígono El Peral, Calle A, s/n, Arcos de la Fra.',
    'Instalaciones Eléctricas Pérez': 'C/ San Francisco 42, Arcos de la Fra. (Cádiz)'
  };

  return Array.from(mapUnique.keys()).map((name, i) => {
    return {
      id: `prov-init-${i}`,
      name,
      nif: nifMap[name] || `B-${Math.floor(10000000 + Math.random() * 90000000)}`,
      category: categoryMap[name] || 'Otros Suministros',
      address: addressMap[name] || 'Polígono Comercial Industrial de Arcos, s/n',
      phone: phoneMap[name] || '+34 956 70 00 00',
      email: emailMap[name] || `contacto@${name.replace(/[^a-z]/g, '').toLowerCase()}.com`,
      contactPerson: contactMap[name] || 'Gestor de Cuentas',
      notes: 'Extraído automáticamente a partir de los partes de compras.'
    };
  });
};

// --- AUTOMATIC EXPENDITURE CATEGORY SUGGESTION FROM ITEM DESCRIPTIONS ---
const CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  {
    category: "Hormigones y Áridos",
    keywords: ["hormigon", "hormigón", "arido", "árido", "arena", "grava", "cemento", "mortero", "piedra", "zahorra", "concreto", "mezcla", "asfalto", "machaqueo", "premezcla", "grava-arena"]
  },
  {
    category: "Ladrillos y Cerámicas",
    keywords: ["ladrillo", "ceramica", "cerámica", "teja", "azulejo", "bloque", "termoarcilla", "bovedilla", "gres", "porcelanico", "porcelánico", "yeso", "pladur", "escayola", "tabique", "bovedillas", "rasillon", "rasillón"]
  },
  {
    category: "Instalaciones Eléctricas",
    keywords: ["cable", "enchufe", "interruptor", "iluminacion", "iluminación", "foco", "led", "cuadro", "diferencial", "magnetotermico", "magnetotérmico", "canalizacion", "canalización", "tubo corrugado", "potencia", "electricidad", "electrico", "eléctrico", "manguera electrica", "foco led", "trifasico", "monofasico"]
  },
  {
    category: "Aceros y Metales",
    keywords: ["acero", "metal", "hierro", "viga", "chapa", "malla", "mallazo", "ferralla", "perfil", "aluminio", "cobre", "tornillo", "clavo", "tuerca", "anclaje", "reja", "perfileria", "vigueta", "correa metalica", "b90", "varilla", "estribo", "armadura"]
  },
  {
    category: "Carpintería y Acristalamiento",
    keywords: ["madera", "puerta", "ventana", "cristal", "vidrio", "marco", "tarima", "parque", "parquet", "liston", "listón", "pvc", "persiana", "herraje", "bisagra", "premarco", "hoja aluminio", "vidrio templado", "climalit"]
  },
  {
    category: "Fontanería y Climatización",
    keywords: ["tuberia", "tubería", "grifo", "sanitario", "lavabo", "bomba", "aire acondicionado", "calefaccion", "calefacción", "termo", "caldera", "bomba de calor", "codo pvc", "sifon", "sifón", "valvula", "válvula", "desague", "desagüe", "radiador", "manguito", "colector"]
  },
  {
    category: "Pinturas y Revestimientos",
    keywords: ["pintura", "barniz", "rodillo", "pincel", "brocha", "esmalte", "imprimacion", "imprimación", "silicona", "masilla", "cola", "adhesivo", "estuco", "revoque", "aislamiento", "lana de roca", "disolvente", "plaste", "impregnacion"]
  },
  {
    category: "Herramientas y Maquinaria",
    keywords: ["herramienta", "taladro", "radial", "martillo", "destornillador", "sierra", "maquinaria", "excavadora", "andamio", "hormigonera", "grúa", "grua", "escalera", "disco corte", "carretilla", "pala", "pico", "nivel laser", "plegadora", "cortadora"]
  },
  {
    category: "Combustibles y Energía",
    keywords: ["combustible", "gasoil", "gasolina", "diesel", "diésel", "propano", "butano", "gas", "bateria", "batería", "aceite motor", "adblue", "lubricante"]
  },
  {
    category: "Otros Suministros",
    keywords: ["varios", "otros", "suministros", "general", "oficina", "papel", "boligrafo", "carpetas", "limpieza", "agua", "catering"]
  }
];

const suggestCategoryFromItems = (items: { name: string }[]): string | null => {
  if (!items || items.length === 0) return null;
  
  const combinedText = items
    .map(item => (item.name || '').toLowerCase())
    .join(' ');
  
  if (!combinedText.trim()) return null;

  let bestCategory: string | null = null;
  let maxScore = 0;

  CATEGORY_KEYWORDS.forEach(({ category, keywords }) => {
    let score = 0;
    keywords.forEach(keyword => {
      const parts = combinedText.split(keyword);
      const matches = parts.length - 1;
      if (matches > 0) {
        score += matches;
      }
    });

    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  });

  return maxScore > 0 ? bestCategory : null;
};

const extractInitialTrabajadores = (pers: PersonalCost[]): TrabajadorPRL[] => {
  const mapUnique = new Map<string, string>();
  pers.forEach(p => {
    mapUnique.set(p.workerName.trim(), p.role);
  });

  const nifMap: Record<string, string> = {
    'Manuel Ortega G.': '31877665Y',
    'Jesús Marín Ruíz': '31988112W',
    'Alejandro Real H.': '31677221K'
  };

  const phoneMap: Record<string, string> = {
    'Manuel Ortega G.': '+34 611 12 13 14',
    'Jesús Marín Ruíz': '+34 622 15 16 17',
    'Alejandro Real H.': '+34 644 19 20 21'
  };

  const emailMap: Record<string, string> = {
    'Manuel Ortega G.': 'manuel.ortega@jreal.com',
    'Jesús Marín Ruíz': 'jesus.marin@jreal.com',
    'Alejandro Real H.': 'alejandro.real@jreal.com'
  };

  const createInitialPRLChecklist = (): DocumentState[] => {
    return [
      { id: 'doc-prl-inf', name: 'Ficha de Información y Formación Preventiva (Art. 18-19 LPRL 31/1995)', required: true, isChecked: true },
      { id: 'doc-prl-epi', name: 'Recibo y Compromiso de Entrega de EPIs (Art. 17 LPRL)', required: true, isChecked: true },
      { id: 'doc-prl-apto', name: 'Apto Médico de Vigilancia de la Salud (Art. 22 LPRL)', required: true, isChecked: false },
      { id: 'doc-prl-tpc', name: 'Formación Convenio Construcción - Aula 20h / TPC', required: true, isChecked: true }
    ];
  };

  return Array.from(mapUnique.keys()).map((name, i) => {
    const role = mapUnique.get(name) || 'Oficial de 1ª Encofrador';
    return {
      id: `work-init-${i}`,
      name,
      nif: nifMap[name] || `31${Math.floor(100000 + Math.random() * 900000)}B`,
      type: 'propio' as const,
      phone: phoneMap[name] || '+34 600 00 00 00',
      email: emailMap[name] || `operario@jreal.com`,
      role,
      notes: 'Operario asignado de plantilla principal extraído en inicio.',
      associatedObraId: '1',
      documentsChecklist: createInitialPRLChecklist()
    };
  });
};

export default function App() {
  const [signedInUser, setSignedInUser] = useState<User | null>(auth.currentUser);
  useEffect(() => onAuthStateChanged(auth, setSignedInUser), []);
  // --- STATE ---
  const [obras, setObras] = useState<Obra[]>([]);
  const [documentos, setDocumentos] = useState<FacturaAlbaran[]>([]);
  const [personal, setPersonal] = useState<PersonalCost[]>([]);
  const [gastosGenerales, setGastosGenerales] = useState<OtrosGasto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [trabajadores, setTrabajadores] = useState<TrabajadorPRL[]>([]);
  const [plantillaTrabajadores, setPlantillaTrabajadores] = useState<TrabajadorEmpresa[]>([]);
  const [fichajes, setFichajes] = useState<RegistroJornada[]>(() => {
    const saved = localStorage.getItem('up_fichajes');
    return saved ? JSON.parse(saved) : [];
  });

  // Worker Mobile Portal Mode (opened via query param ?portal=trabajador or UI toggle)
  const [isWorkerPortalOpen, setIsWorkerPortalOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('portal=trabajador') || 
           window.location.search.includes('portal=operario') || 
           window.location.search.includes('mode=worker');
  });

  // Active shifts derived from fichajes where status === 'active'
  const activeFichajes: ActiveFichaje[] = useMemo(() => {
    return fichajes
      .filter(f => f.status === 'active')
      .map(f => ({
        id: f.id,
        workerId: f.workerId,
        workerName: f.workerName,
        workerDni: f.workerDni,
        role: f.role,
        obraId: f.obraId,
        obraName: f.obraName,
        date: f.date,
        clockIn: f.clockIn,
        clockInTimestamp: f.clockInTimestamp || (new Date(`${f.date}T${f.clockIn}:00`).getTime()) || Date.now(),
        breakMinutes: f.breakMinutes || 0,
        hourlyRate: f.hourlyRate,
        overtimeRate: f.overtimeRate,
        locationCoords: f.locationCoords,
        notes: f.notes
      }));
  }, [fichajes]);

  // Firestore central database sync states
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('synced');

  // Connection and Offline synchronization states
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    const saved = localStorage.getItem('up_offline_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  
  interface AppToast {
    id: number;
    message: string;
    type: 'success' | 'error';
  }

  const [toast, setToast] = useState<AppToast | null>(null);

  const showAppToast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToast({ id, message: msg, type });
    setTimeout(() => {
      setToast(prev => prev?.id === id ? null : prev);
    }, 4500);
  };

  // Sync to localStorage on queue changes
  useEffect(() => {
    localStorage.setItem('up_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  const getCollectionLabel = (coll: string) => {
    switch (coll) {
      case 'obras': return 'Obra';
      case 'documentos': return 'Documento';
      case 'personal': return 'Parte de personal';
      case 'gastosGenerales': return 'Gasto general';
      case 'proveedores': return 'Proveedor';
      case 'trabajadores': return 'Trabajador';
      case 'plantillaTrabajadores': return 'Personal de plantilla';
      case 'fichajes': return 'Control horario y fichaje';
      default: return 'Registro';
    }
  };

  const getOpSuccessMessage = (coll: string, actionType: 'create' | 'update' | 'delete') => {
    const isFeminine = coll === 'obras';
    const suffix = isFeminine ? 'a' : 'o';
    const label = getCollectionLabel(coll);
    if (actionType === 'delete') {
      return `${label} eliminad${suffix} correctamente de la base de datos`;
    }
    if (actionType === 'update') {
      return `${label} modificad${suffix} correctamente en la base de datos`;
    }
    return `${label} guardad${suffix} correctamente en la base de datos`;
  };

  const getOpErrorMessage = (coll: string, actionType: 'create' | 'update' | 'delete', errorDetails?: string) => {
    const isFeminine = coll === 'obras';
    const suffix = isFeminine ? 'a' : 'o';
    const label = getCollectionLabel(coll);
    const actionVerb = actionType === 'delete' ? `eliminad${suffix}` : actionType === 'update' ? `modificad${suffix}` : `guardad${suffix}`;
    return `Error: No se ha ${actionVerb} ${label.toLowerCase()} en la base de datos${errorDetails ? ` (${errorDetails})` : ''}`;
  };

  // Generic DB Write handler - Direct persistence to the single central Firestore database
  const dbWrite = async (
    collectionName: string, 
    id: string, 
    data: any, 
    isDelete: boolean = false,
    actionType: 'create' | 'update' | 'delete' = isDelete ? 'delete' : 'create',
    silent: boolean = false
  ) => {
    if (!isOnline) {
      // Add operation to offline sync queue
      setOfflineQueue(prev => {
        const filtered = prev.filter(item => !(item.collectionName === collectionName && item.id === id));
        return [...filtered, { collectionName, id, data, isDelete, actionType, timestamp: Date.now() }];
      });
      if (!silent) {
        showAppToast(`Sin conexión: Operación guardada en cola local para sincronizar (${getCollectionLabel(collectionName)})`, 'error');
      }
      return;
    }

    try {
      const docRef = doc(db, collectionName, id);
      if (isDelete) {
        await deleteDoc(docRef);
      } else {
        const cleanedData = sanitizeForFirestore(data);
        await setDoc(docRef, cleanedData);
      }
      if (!silent) {
        showAppToast(getOpSuccessMessage(collectionName, actionType), 'success');
      }
    } catch (err: any) {
      console.error(`Fallo de escritura en Firestore (${collectionName}):`, err);
      // Fallback: save to offline queue
      setOfflineQueue(prev => {
        const filtered = prev.filter(item => !(item.collectionName === collectionName && item.id === id));
        return [...filtered, { collectionName, id, data, isDelete, actionType, timestamp: Date.now() }];
      });
      if (!silent) {
        showAppToast(getOpErrorMessage(collectionName, actionType, err?.message), 'error');
      }
    }
  };
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'obras' | 'documentos' | 'personal' | 'gastos' | 'informes' | 'copias' | 'control_horario'>('dashboard');
  

  // Mobile More Navigation Drawer state
  const [isMobileMoreMenuOpen, setIsMobileMoreMenuOpen] = useState(false);

  const [selectedObraId, setSelectedObraId] = useState<string | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDocType, setFilterDocType] = useState<'all' | 'factura' | 'albaran'>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Document table sorting
  const [docSortBy, setDocSortBy] = useState<'docNumber' | 'supplier' | 'date' | 'category' | 'totalAmount'>('date');
  const [docSortOrder, setDocSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleDocSort = (field: 'docNumber' | 'supplier' | 'date' | 'category' | 'totalAmount') => {
    if (docSortBy === field) {
      setDocSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDocSortBy(field);
      setDocSortOrder('asc');
    }
  };

  // Document Form fields (Añadir/Editar)
  const [showDocModal, setShowDocModal] = useState(false);
  const [modalTab, setModalTab] = useState<'single' | 'bulk'>('single');
  const [docId, setDocId] = useState('');
  const [docObraId, setDocObraId] = useState('');
  const [docType, setDocType] = useState<'factura' | 'albaran'>('factura');
  const [docNumber, setDocNumber] = useState('');
  const [docSupplier, setDocSupplier] = useState('');
  const [docDate, setDocDate] = useState('');
  const [docItems, setDocItems] = useState<DocumentItem[]>([]);
  const [docIvaRate, setDocIvaRate] = useState(21);
  const [docRetentionRate, setDocRetentionRate] = useState(0);
  const [docNotes, setDocNotes] = useState('');
  const [docImageUrl, setDocImageUrl] = useState('');
  const [docCategory, setDocCategory] = useState('');

  const suggestedCategory = useMemo(() => suggestCategoryFromItems(docItems), [docItems]);

  // Auto-apply suggested category when it becomes available and no category is currently selected
  useEffect(() => {
    if (suggestedCategory && !docCategory) {
      setDocCategory(suggestedCategory);
    }
  }, [suggestedCategory]);

  // Fullscreen Invoice Preview states
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState('');
  const [fullscreenTitle, setFullscreenTitle] = useState('');
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenRotation, setFullscreenRotation] = useState(0);

  // AI & OCR Loaders State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // OCR Engine Mode: 'auto' (Gemini when online, Tesseract when offline), 'gemini' (Cloud AI), 'local' (100% Offline Tesseract.js)
  const [ocrEngineMode, setOcrEngineMode] = useState<'auto' | 'gemini' | 'local'>('auto');

  // Bulk processing list
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // Google Drive toggle state
  const [showDrive, setShowDrive] = useState(false);
  // Gmail toggle state
  const [showGmail, setShowGmail] = useState(false);

  // Duplicates manager states & helpers
  const [openDuplicatesConsole, setOpenDuplicatesConsole] = useState(false);
  const [duplicateActionLoading, setDuplicateActionLoading] = useState(false);

  const duplicatesGrouped = useMemo(() => {
    const groups: Record<string, FacturaAlbaran[]> = {};
    documentos.forEach(doc => {
      const supplierNorm = (doc.supplier || '').trim().toLowerCase();
      const numberNorm = (doc.docNumber || '').trim().toLowerCase();
      const typeNorm = doc.type || 'factura';
      if (supplierNorm && numberNorm) {
        const key = `${typeNorm}-${supplierNorm}-${numberNorm}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(doc);
      }
    });

    const duplicateGroups: {
      key: string;
      docs: FacturaAlbaran[];
      supplier: string;
      docNumber: string;
      type: 'factura' | 'albaran';
    }[] = [];

    Object.entries(groups).forEach(([key, docs]) => {
      if (docs.length > 1) {
        duplicateGroups.push({
          key,
          docs,
          supplier: docs[0].supplier,
          docNumber: docs[0].docNumber,
          type: docs[0].type
        });
      }
    });

    return duplicateGroups;
  }, [documentos]);

  const getBestDocumentInGroup = (docs: FacturaAlbaran[]): FacturaAlbaran => {
    let bestDoc = docs[0];
    let bestScore = -1;

    docs.forEach(doc => {
      let score = 0;
      if (doc.status === 'paid') score += 10;
      else if (doc.status === 'pending') score += 5;

      if (doc.imageUrl) score += 10;
      if (doc.items && doc.items.length > 0 && doc.items[0].name !== 'Suministros varios unificados en OCR') score += 5;
      if (doc.notes && !doc.notes.includes('Cargado mediante Lector de Lotes por IA')) score += 2;
      
      if (score > bestScore) {
        bestScore = score;
        bestDoc = doc;
      } else if (score === bestScore) {
        if (doc.id < bestDoc.id) {
          bestDoc = doc;
        }
      }
    });

    return bestDoc;
  };

  const handleAutomaticDuplicatesCleanup = async () => {
    if (duplicatesGrouped.length === 0) return;
    
    const totalDuplicatesCount = duplicatesGrouped.reduce((sum, g) => sum + (g.docs.length - 1), 0);
    
    if (confirm(`⚠️ ADVERTENCIA DE LIMPIEZA AUTOMÁTICA\n\nSe han detectado ${duplicatesGrouped.length} grupos de documentos repetidos, sumando un total de ${totalDuplicatesCount} copias redundantes.\n\nEl sistema conservará automáticamente la copia más completa y validada de cada grupo y eliminará el resto de forma irreversible.\n\n¿Desea proceder con la eliminación automática de los ${totalDuplicatesCount} documentos duplicados?`)) {
      setDuplicateActionLoading(true);
      try {
        const idsToDelete: string[] = [];
        duplicatesGrouped.forEach(group => {
          const best = getBestDocumentInGroup(group.docs);
          group.docs.forEach(doc => {
            if (doc.id !== best.id) {
              idsToDelete.push(doc.id);
            }
          });
        });

        if (idsToDelete.length > 0) {
          const updated = documentos.filter(d => !idsToDelete.includes(d.id));
          saveAllData(obras, updated, personal, gastosGenerales);
          
          for (const id of idsToDelete) {
            await dbWrite('documentos', id, null, true, 'delete', true);
          }
          
          setSelectedDocIds(prev => prev.filter(id => !idsToDelete.includes(id)));
          
          sendPushNotification(null, {
            title: `🧹 Limpieza de Duplicados Realizada`,
            body: `Se han eliminado automáticamente ${idsToDelete.length} documentos repetidos redundantes de forma exitosa.`,
            type: 'system',
          }).catch(err => console.error(err));
          
          showAppToast(`✓ Se han eliminado ${idsToDelete.length} documentos duplicados de la base de datos`, 'success');
        }
      } catch (err: any) {
        console.error('Error al limpiar duplicados:', err);
        showAppToast(`✕ Error al limpiar duplicados en la base de datos: ${err?.message || 'Error'}`, 'error');
      } finally {
        setDuplicateActionLoading(false);
      }
    }
  };

  const handleResolveSingleDuplicateGroup = async (groupKey: string, keepDocId: string) => {
    const group = duplicatesGrouped.find(g => g.key === groupKey);
    if (!group) return;

    const docsToDelete = group.docs.filter(d => d.id !== keepDocId).map(d => d.id);
    if (docsToDelete.length === 0) return;

    if (confirm(`¿Desea conservar la copia seleccionada y eliminar permanentemente las otras ${docsToDelete.length} copias repetidas de este grupo?`)) {
      setDuplicateActionLoading(true);
      try {
        const updated = documentos.filter(d => !docsToDelete.includes(d.id));
        saveAllData(obras, updated, personal, gastosGenerales);

        for (const id of docsToDelete) {
          await dbWrite('documentos', id, null, true, 'delete', true);
        }

        setSelectedDocIds(prev => prev.filter(id => !docsToDelete.includes(id)));

        sendPushNotification(null, {
          title: `✓ Duplicados Resueltos: ${group.supplier}`,
          body: `Se ha resuelto el duplicado del documento ${group.docNumber}, conservando el documento seleccionado y eliminando las copias redundantes.`,
          type: 'system',
        }).catch(err => console.error(err));

        showAppToast(`✓ Se han eliminado ${docsToDelete.length} copias duplicadas de la base de datos`, 'success');

      } catch (err: any) {
        console.error('Error al resolver duplicados del grupo:', err);
        showAppToast(`✕ Error al eliminar copias duplicadas en la base de datos: ${err?.message || 'Error'}`, 'error');
      } finally {
        setDuplicateActionLoading(false);
      }
    }
  };

  // PDF Export loader
  const [isExportingDashboardPDF, setIsExportingDashboardPDF] = useState(false);

  // Theme support
  const [theme, setTheme] = useState<'dark' | 'light'>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f8fafc' : '#090d16');
    try { localStorage.setItem('uniproyect:theme', theme); } catch { /* unavailable */ }
  }, [theme]);

  // Monitor network connectivity for automatic offline OCR mode
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- PERSISTENCE & CLOUD SYNC LOGIC ---
  // Load initial local storage fallback immediately on mount
  useEffect(() => {
    // Preserve existing local data; restoration never purges caches.
    const savedObras = localStorage.getItem('up_obras');
    const savedDocs = localStorage.getItem('up_docs');
    const savedPersonal = localStorage.getItem('up_personal');
    const savedGastos = localStorage.getItem('up_gastos');
    const savedProveedores = localStorage.getItem('up_proveedores');
    const savedTrabajadores = localStorage.getItem('up_trabajadores');
    const savedPlantilla = localStorage.getItem('up_plantilla_trabajadores');

    const loadedObras: Obra[] = savedObras ? JSON.parse(savedObras) : [];
    const loadedDocs: FacturaAlbaran[] = savedDocs ? JSON.parse(savedDocs) : [];
    const loadedPersonal: PersonalCost[] = savedPersonal ? JSON.parse(savedPersonal) : [];
    const loadedGastos: OtrosGasto[] = savedGastos ? JSON.parse(savedGastos) : [];

    setObras(loadedObras);
    setDocumentos(loadedDocs);
    setPersonal(loadedPersonal);
    setGastosGenerales(loadedGastos);
    setProveedores(savedProveedores ? JSON.parse(savedProveedores) : []);
    setTrabajadores(savedTrabajadores ? JSON.parse(savedTrabajadores) : []);
    setPlantillaTrabajadores(savedPlantilla ? JSON.parse(savedPlantilla) : []);

    // Sync registered obras to supervisor backend if available
    if (loadedObras.length > 0) {
      authorizedFetch('/api/supervisor/sync-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: loadedObras }),
      }).catch(() => {});
    }

    if (!savedPlantilla) {
      authorizedFetch('/api/supervisor/workers')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && Array.isArray(data.workers) && data.workers.length > 0) {
            const mappedWorkers = data.workers.map((w: any) => ({
              id: w.id,
              name: w.fullName,
              role: w.category,
              dailyRate: Math.round((Number(w.hourlyRate) || 15) * 8),
              phone: w.phone || '',
              active: w.status === 'active',
            }));
            setPlantillaTrabajadores(current => current.length === 0 ? mappedWorkers : current);
            try { localStorage.setItem('up_plantilla_trabajadores', JSON.stringify(mappedWorkers)); } catch (_) {}
          }
        })
        .catch(err => console.warn('Could not load supervisor workers fallback:', err));
    }
  }, []);

  // Keep registered obras synchronized with supervisor & worker portal backend
  useEffect(() => {
    if (obras && obras.length > 0) {
      authorizedFetch('/api/supervisor/sync-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: obras }),
      }).catch(() => {});
    }
  }, [obras]);

  // Monitor connection changes and automatically trigger synchronization
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process offline write queue
  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0 || isSyncingQueue || !isOnline) return;
    setIsSyncingQueue(true);
    setSyncStatus('syncing');

    const queueToProcess = [...offlineQueue];
    const failedItems: any[] = [];

    for (const item of queueToProcess) {
      try {
        const docRef = doc(db, item.collectionName, item.id);
        if (item.isDelete) {
          await deleteDoc(docRef);
        } else {
          const sanitize = (val: any): any => {
            if (val === null || typeof val !== 'object') return val;
            if (Array.isArray(val)) return val.map(sanitize);
            const cleaned: any = {};
            for (const key of Object.keys(val)) {
              if (val[key] !== undefined) {
                cleaned[key] = sanitize(val[key]);
              }
            }
            return cleaned;
          };
          const cleanedData = sanitize(item.data);
          await setDoc(docRef, cleanedData);
        }
      } catch (err) {
        console.error('Error syncing queued item:', item, err);
        failedItems.push(item);
      }
    }

    setOfflineQueue(failedItems);
    setIsSyncingQueue(false);
    if (failedItems.length === 0) {
      setSyncStatus('synced');
    } else {
      setSyncStatus('error');
    }
  };

  // Connect by default directly to the single central Firestore database
  useEffect(() => {
    let unsubscribes: (() => void)[] = [];

    if (!isOnline) {
      setSyncStatus('idle');
      return;
    }

    setSyncStatus('syncing');

    try {
      unsubscribes.push(
        onSnapshot(collection(db, 'obras'), (snap) => {
          const list: Obra[] = [];
          snap.forEach(d => list.push(d.data() as Obra));
          setObras(list);
          localStorage.setItem('up_obras', JSON.stringify(list));
        }, (err) => {
          console.error('Error al escuchar obras en Firestore:', err);
          setSyncStatus('error');
        })
      );

      unsubscribes.push(
        onSnapshot(collection(db, 'documentos'), (snap) => {
          const list: FacturaAlbaran[] = [];
          snap.forEach(d => list.push(d.data() as FacturaAlbaran));
          setDocumentos(list);
          localStorage.setItem('up_docs', JSON.stringify(list));
        }, (err) => {
          console.error('Error al escuchar documentos en Firestore:', err);
          setSyncStatus('error');
        })
      );

      unsubscribes.push(
        onSnapshot(collection(db, 'personal'), (snap) => {
          const list: PersonalCost[] = [];
          snap.forEach(d => list.push(d.data() as PersonalCost));
          setPersonal(list);
          localStorage.setItem('up_personal', JSON.stringify(list));
        }, (err) => {
          console.error('Error al escuchar personal en Firestore:', err);
          setSyncStatus('error');
        })
      );

      unsubscribes.push(
        onSnapshot(collection(db, 'gastosGenerales'), (snap) => {
          const list: OtrosGasto[] = [];
          snap.forEach(d => list.push(d.data() as OtrosGasto));
          setGastosGenerales(list);
          localStorage.setItem('up_gastos', JSON.stringify(list));
        }, (err) => {
          console.error('Error al escuchar gastosGenerales en Firestore:', err);
          setSyncStatus('error');
        })
      );

      unsubscribes.push(
        onSnapshot(collection(db, 'proveedores'), (snap) => {
          const list: Proveedor[] = [];
          snap.forEach(d => list.push(d.data() as Proveedor));
          setProveedores(list);
          localStorage.setItem('up_proveedores', JSON.stringify(list));
        }, (err) => {
          console.error('Error al escuchar proveedores en Firestore:', err);
          setSyncStatus('error');
        })
      );

      unsubscribes.push(
        onSnapshot(collection(db, 'trabajadores'), (snap) => {
          const list: TrabajadorPRL[] = [];
          snap.forEach(d => list.push(d.data() as TrabajadorPRL));
          setTrabajadores(list);
          localStorage.setItem('up_trabajadores', JSON.stringify(list));
        }, (err) => {
          console.error('Error al escuchar trabajadores en Firestore:', err);
          setSyncStatus('error');
        })
      );

      unsubscribes.push(
        onSnapshot(collection(db, 'plantillaTrabajadores'), (snap) => {
          const list: TrabajadorEmpresa[] = [];
          snap.forEach(d => list.push(d.data() as TrabajadorEmpresa));
          setPlantillaTrabajadores(list);
          localStorage.setItem('up_plantilla_trabajadores', JSON.stringify(list));
        }, (err) => {
          console.error('Error al escuchar plantillaTrabajadores en Firestore:', err);
          setSyncStatus('error');
        })
      );

      unsubscribes.push(
        onSnapshot(collection(db, 'fichajes'), (snap) => {
          const list: RegistroJornada[] = [];
          snap.forEach(d => list.push(d.data() as RegistroJornada));
          setFichajes(list);
          localStorage.setItem('up_fichajes', JSON.stringify(list));
        }, (err) => {
          console.error('Error al escuchar fichajes en Firestore:', err);
          setSyncStatus('error');
        })
      );

      setSyncStatus('synced');
    } catch (err) {
      console.error('Error al establecer listeners de la base de datos central:', err);
      setSyncStatus('error');
    }

    return () => {
      unsubscribes.forEach(un => un());
    };
  }, [isOnline, signedInUser?.uid]);

  // Sync to local storage on changes
  const saveAllData = (
    newObras: Obra[], 
    newDocs: FacturaAlbaran[], 
    newPers: PersonalCost[], 
    newGastos: OtrosGasto[],
    newProveedores?: Proveedor[],
    newTrabajadores?: TrabajadorPRL[],
    newPlantilla?: TrabajadorEmpresa[],
    newFichajes?: RegistroJornada[]
  ) => {
    setObras(newObras);
    setDocumentos(newDocs);
    setPersonal(newPers);
    setGastosGenerales(newGastos);

    localStorage.setItem('up_obras', JSON.stringify(newObras));
    localStorage.setItem('up_docs', JSON.stringify(newDocs));
    localStorage.setItem('up_personal', JSON.stringify(newPers));
    localStorage.setItem('up_gastos', JSON.stringify(newGastos));

    if (newProveedores !== undefined) {
      setProveedores(newProveedores);
      localStorage.setItem('up_proveedores', JSON.stringify(newProveedores));
    }
    if (newTrabajadores !== undefined) {
      setTrabajadores(newTrabajadores);
      localStorage.setItem('up_trabajadores', JSON.stringify(newTrabajadores));
    }
    if (newPlantilla !== undefined) {
      setPlantillaTrabajadores(newPlantilla);
      localStorage.setItem('up_plantilla_trabajadores', JSON.stringify(newPlantilla));
    }
    if (newFichajes !== undefined) {
      setFichajes(newFichajes);
      localStorage.setItem('up_fichajes', JSON.stringify(newFichajes));
    }
    localStorage.setItem('up_data_initialized', 'true');
  };

  // State for continuous Google Drive cloud backup
  const [driveSyncStatus, setDriveSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastDriveSyncTime, setLastDriveSyncTime] = useState<string | null>(() => localStorage.getItem('up_last_drive_backup_time'));

  // Fingerprint of app data to detect any change across all expenses and tables
  const dataFingerprint = useMemo(() => {
    const docSum = documentos.reduce((s, d) => s + (Number(d.totalAmount) || 0), 0);
    const persSum = personal.reduce((s, p) => s + (Number(p.totalCost) || 0), 0);
    const gastSum = gastosGenerales.reduce((s, g) => s + (Number(g.amount) || 0), 0);
    return `${obras.length}-${documentos.length}-${personal.length}-${gastosGenerales.length}-${proveedores.length}-${trabajadores.length}-${plantillaTrabajadores.length}-${docSum.toFixed(2)}-${persSum.toFixed(2)}-${gastSum.toFixed(2)}`;
  }, [obras, documentos, personal, gastosGenerales, proveedores, trabajadores, plantillaTrabajadores]);

  // Manual trigger for Google Drive cloud backup
  const handleManualDriveSync = async () => {
    let token = await getAccessToken();
    if (!token) {
      const authRes = await googleSignIn();
      if (!authRes?.accessToken) {
        throw new Error('Se requiere autenticación con Google para guardar en Drive.');
      }
      token = authRes.accessToken;
    }

    setDriveSyncStatus('saving');
    const backup = generateGlobalBackup(
      obras,
      documentos,
      personal,
      gastosGenerales,
      proveedores,
      trabajadores,
      null,
      plantillaTrabajadores
    );

    const result = await upsertMasterBackupFile(token, backup);
    setDriveSyncStatus('saved');
    setLastDriveSyncTime(result.updatedTime);
    localStorage.setItem('up_last_drive_backup_time', result.updatedTime);
    localStorage.setItem('up_last_drive_backup_meta', JSON.stringify({
      fileId: result.fileId,
      webViewLink: result.webViewLink,
      updatedTime: result.updatedTime,
      sizeBytes: result.sizeBytes,
    }));
  };

  // Unified global restore handler
  const handleRestoreComplete = (
    newObras: Obra[],
    newDocs: FacturaAlbaran[],
    newPersonal: PersonalCost[],
    newGastos: OtrosGasto[],
    newProveedores: Proveedor[],
    newTrabajadores: TrabajadorPRL[],
    newPlantilla: TrabajadorEmpresa[],
    message: string
  ) => {
    saveAllData(
      newObras,
      newDocs,
      newPersonal,
      newGastos,
      newProveedores,
      newTrabajadores,
      newPlantilla
    );

    // Persist all restored collections to Firestore in safe batches of 350 items
    const allOps: Array<{ coll: string; id: string; data: any }> = [
      ...newObras.map(item => ({ coll: 'obras', id: item.id, data: item })),
      ...newDocs.map(item => ({ coll: 'documentos', id: item.id, data: item })),
      ...newPersonal.map(item => ({ coll: 'personal', id: item.id, data: item })),
      ...newGastos.map(item => ({ coll: 'gastosGenerales', id: item.id, data: item })),
      ...newProveedores.map(item => ({ coll: 'proveedores', id: item.id, data: item })),
      ...newTrabajadores.map(item => ({ coll: 'trabajadores', id: item.id, data: item })),
      ...newPlantilla.map(item => ({ coll: 'plantillaTrabajadores', id: item.id, data: item })),
    ];

    (async () => {
      const CHUNK_SIZE = 350;
      try {
        for (let i = 0; i < allOps.length; i += CHUNK_SIZE) {
          const chunk = allOps.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(op => {
            batch.set(doc(db, op.coll, op.id), sanitizeForFirestore(op.data));
          });
          await batch.commit();
        }
        showAppToast('✓ Copia de seguridad restaurada correctamente en la base de datos', 'success');
      } catch (err: any) {
        console.error('Error sincronizando restauración en Firestore:', err);
        showAppToast(`✕ Error al sincronizar restauración en la base de datos: ${err?.message || 'Error'}`, 'error');
      }
    })();

    sendPushNotification(null, {
      title: '🛡️ Copia de Seguridad Restaurada',
      body: message,
      type: 'system',
    }).catch(err => console.error(err));
  };

  const handleResetData = async () => {
    if (confirm('¿Estás seguro de que deseas vaciar todos los datos de la aplicación? Esta acción dejará la base de datos central y los registros completamente limpios a cero.')) {
      saveAllData([], [], [], [], [], [], [], []);
      setObras([]);
      setDocumentos([]);
      setPersonal([]);
      setGastosGenerales([]);
      setProveedores([]);
      setTrabajadores([]);
      setPlantillaTrabajadores([]);
      setFichajes([]);

      setSyncStatus('syncing');
      try {
        const batch = writeBatch(db);
        obras.forEach(item => batch.delete(doc(db, 'obras', item.id)));
        documentos.forEach(item => batch.delete(doc(db, 'documentos', item.id)));
        personal.forEach(item => batch.delete(doc(db, 'personal', item.id)));
        gastosGenerales.forEach(item => batch.delete(doc(db, 'gastosGenerales', item.id)));
        proveedores.forEach(item => batch.delete(doc(db, 'proveedores', item.id)));
        trabajadores.forEach(item => batch.delete(doc(db, 'trabajadores', item.id)));
        plantillaTrabajadores.forEach(item => batch.delete(doc(db, 'plantillaTrabajadores', item.id)));
        fichajes.forEach(item => batch.delete(doc(db, 'fichajes', item.id)));
        await batch.commit();
        setSyncStatus('synced');
        showAppToast('✓ Todos los registros han sido vaciados correctamente de la base de datos', 'success');
      } catch (err: any) {
        console.error('Error al vaciar registros en la base de datos:', err);
        setSyncStatus('error');
        showAppToast(`✕ Error al vaciar los registros en la base de datos: ${err?.message || 'Fallo de conexión'}`, 'error');
      }
    }
  };

  // --- PROVEEDORES HANDLERS ---
  const handleAddProveedor = (p: Proveedor) => {
    const updated = [p, ...proveedores];
    saveAllData(obras, documentos, personal, gastosGenerales, updated, trabajadores, plantillaTrabajadores);
    dbWrite('proveedores', p.id, p, false, 'create');
  };

  const handleUpdateProveedor = (p: Proveedor) => {
    const updated = proveedores.map(prev => prev.id === p.id ? p : prev);
    saveAllData(obras, documentos, personal, gastosGenerales, updated, trabajadores, plantillaTrabajadores);
    dbWrite('proveedores', p.id, p, false, 'update');
  };

  const handleDeleteProveedor = (id: string) => {
    const updated = proveedores.filter(p => p.id !== id);
    saveAllData(obras, documentos, personal, gastosGenerales, updated, trabajadores, plantillaTrabajadores);
    dbWrite('proveedores', id, null, true, 'delete');
  };

  const handleImportProveedores = (list: Proveedor[]) => {
    // Avoid exact duplicated NIFs to keep clean
    const existingNifs = new Set(proveedores.map(p => p.nif.toUpperCase()));
    const filteredImports = list.filter(p => !existingNifs.has(p.nif.toUpperCase()));
    const updated = [...filteredImports, ...proveedores];
    saveAllData(obras, documentos, personal, gastosGenerales, updated, trabajadores, plantillaTrabajadores);
    filteredImports.forEach(p => dbWrite('proveedores', p.id, p, false, 'create', true));
    showAppToast(`✓ Se han importado y guardado ${filteredImports.length} proveedores correctamente en la base de datos`, 'success');
  };

  // --- TRABAJADORES PRL HANDLERS ---
  const handleAddTrabajador = (t: TrabajadorPRL) => {
    const updated = [t, ...trabajadores];
    saveAllData(obras, documentos, personal, gastosGenerales, proveedores, updated, plantillaTrabajadores);
    dbWrite('trabajadores', t.id, t, false, 'create');
  };

  const handleUpdateTrabajador = (t: TrabajadorPRL) => {
    const updated = trabajadores.map(prev => prev.id === t.id ? t : prev);
    saveAllData(obras, documentos, personal, gastosGenerales, proveedores, updated, plantillaTrabajadores);
    dbWrite('trabajadores', t.id, t, false, 'update');
  };

  const handleDeleteTrabajador = (id: string) => {
    const updated = trabajadores.filter(t => t.id !== id);
    saveAllData(obras, documentos, personal, gastosGenerales, proveedores, updated, plantillaTrabajadores);
    dbWrite('trabajadores', id, null, true, 'delete');
  };

  const handleImportTrabajadores = (list: TrabajadorPRL[]) => {
    const existingNifs = new Set(trabajadores.map(t => t.nif.toUpperCase()));
    const filteredImports = list.filter(t => !existingNifs.has(t.nif.toUpperCase()));
    const updated = [...filteredImports, ...trabajadores];
    saveAllData(obras, documentos, personal, gastosGenerales, proveedores, updated, plantillaTrabajadores);
    filteredImports.forEach(t => dbWrite('trabajadores', t.id, t, false, 'create', true));
    showAppToast(`✓ Se han importado y guardado ${filteredImports.length} trabajadores PRL correctamente en la base de datos`, 'success');
  };

  // --- PLANTILLA TRABAJADORES (PERSONAL DE OBRA) HANDLERS ---
  const handleAddTrabajadorEmpresa = (t: TrabajadorEmpresa) => {
    const updated = [t, ...plantillaTrabajadores];
    saveAllData(obras, documentos, personal, gastosGenerales, proveedores, trabajadores, updated);
    dbWrite('plantillaTrabajadores', t.id, t, false, 'create');
  };

  const handleUpdateTrabajadorEmpresa = (t: TrabajadorEmpresa) => {
    const updated = plantillaTrabajadores.map(prev => prev.id === t.id ? t : prev);
    saveAllData(obras, documentos, personal, gastosGenerales, proveedores, trabajadores, updated);
    dbWrite('plantillaTrabajadores', t.id, t, false, 'update');
  };

  const handleDeleteTrabajadorEmpresa = (id: string) => {
    const updated = plantillaTrabajadores.filter(t => t.id !== id);
    saveAllData(obras, documentos, personal, gastosGenerales, proveedores, trabajadores, updated);
    dbWrite('plantillaTrabajadores', id, null, true, 'delete');
  };

  const handleImportTrabajadoresEmpresa = (list: TrabajadorEmpresa[], mode: 'merge' | 'replace' = 'merge') => {
    let updated: TrabajadorEmpresa[] = [];
    if (mode === 'replace') {
      updated = list;
    } else {
      const existingNames = new Set(plantillaTrabajadores.map(t => t.name.toLowerCase().trim()));
      const filteredImports = list.filter(t => !existingNames.has(t.name.toLowerCase().trim()));
      updated = [...filteredImports, ...plantillaTrabajadores];
    }
    saveAllData(obras, documentos, personal, gastosGenerales, proveedores, trabajadores, updated);
    if (mode === 'replace') {
      const batch = writeBatch(db);
      updated.forEach(item => batch.set(doc(db, 'plantillaTrabajadores', item.id), sanitizeForFirestore(item)));
      batch.commit().then(() => {
        showAppToast(`✓ Se han actualizado ${updated.length} trabajadores de plantilla en la base de datos`, 'success');
      }).catch(e => {
        console.error(e);
        showAppToast(`✕ Error al actualizar la plantilla en la base de datos: ${e?.message || 'Error'}`, 'error');
      });
    } else {
      list.forEach(item => dbWrite('plantillaTrabajadores', item.id, item, false, 'create', true));
      showAppToast(`✓ Se han importado ${list.length} trabajadores de plantilla correctamente en la base de datos`, 'success');
    }
  };

  // --- CONTROL HORARIO Y FICHAJES LEGALES HANDLERS ---
  const handleSaveFichaje = async (record: RegistroJornada) => {
    // Si viene sin estado explícito de aprobación, empieza como 'pending'
    const finalRecord: RegistroJornada = {
      ...record,
      approvalStatus: record.approvalStatus || 'pending'
    };

    const updatedFichajes = [finalRecord, ...fichajes.filter(f => f.id !== finalRecord.id)];
    setFichajes(updatedFichajes);
    localStorage.setItem('up_fichajes', JSON.stringify(updatedFichajes));
    await dbWrite('fichajes', finalRecord.id, finalRecord, false, 'create', true);

    const costId = finalRecord.personalCostId || `cost-fichaje-${finalRecord.id}`;

    // REQUISITO ESTRICTO: Solo se imputa automáticamente a los gastos de personal de la obra
    // si ha sido previamente o explícitamente aprobado de forma digital por el gerente de la obra
    if (finalRecord.approvalStatus === 'approved') {
      const costItem: PersonalCost = {
        id: costId,
        obraId: finalRecord.obraId,
        workerName: finalRecord.workerName,
        date: finalRecord.date,
        role: finalRecord.role || 'Oficial de Obra',
        hours: finalRecord.regularHours,
        hourlyRate: finalRecord.hourlyRate,
        overtimeHours: finalRecord.overtimeHours,
        overtimeRate: finalRecord.overtimeRate,
        totalCost: finalRecord.calculatedCost,
        costType: 'horas',
        notes: `[Control Horario Aprobado por Gerente: ${finalRecord.foremanName || 'Gerente de Obra'}] Fichaje ${finalRecord.clockIn}-${finalRecord.clockOut} (${finalRecord.totalHours}h). ${finalRecord.notes || ''}`.trim(),
        workerCatalogId: finalRecord.workerId,
        fichajeId: finalRecord.id
      };

      const updatedPersonal = [costItem, ...personal.filter(p => p.id !== costId && p.fichajeId !== finalRecord.id)];
      setPersonal(updatedPersonal);
      localStorage.setItem('up_personal', JSON.stringify(updatedPersonal));
      await dbWrite('personal', costItem.id, costItem, false, 'create', true);

      showAppToast(`✓ Jornada de ${finalRecord.workerName} guardada y ${finalRecord.calculatedCost.toFixed(2)}€ imputados a la obra`, 'success');
    } else {
      // Si está pendiente o rechazado, nos aseguramos de que NO figure en los gastos de personal de la obra
      const updatedPersonal = personal.filter(p => p.id !== costId && p.fichajeId !== finalRecord.id);
      if (updatedPersonal.length !== personal.length) {
        setPersonal(updatedPersonal);
        localStorage.setItem('up_personal', JSON.stringify(updatedPersonal));
        await dbWrite('personal', costId, null, true, 'delete', true);
      }
      showAppToast(`✓ Jornada de ${finalRecord.workerName} firmada y registrada. Pendiente de aprobación del Gerente para imputar coste.`, 'success');
    }
  };

  // --- WORKER MOBILE PORTAL HANDLERS (Fichaje directo de operarios en obra) ---
  const handleClockInWorker = async (data: {
    workerId: string;
    workerName: string;
    workerDni?: string;
    role: string;
    obraId: string;
    obraName: string;
    hourlyRate: number;
    overtimeRate: number;
    locationCoords?: { latitude: number; longitude: number; accuracy?: number };
    notes?: string;
  }) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const clockInTime = now.toTimeString().slice(0, 5); // HH:mm
    const recordId = `fichaje-${data.workerId}-${todayStr}-${Date.now()}`;

    const newActiveRecord: RegistroJornada = {
      id: recordId,
      workerId: data.workerId,
      workerName: data.workerName,
      workerDni: data.workerDni || '',
      role: data.role || 'Oficial de Obra',
      obraId: data.obraId,
      obraName: data.obraName,
      date: todayStr,
      clockIn: clockInTime,
      clockOut: '',
      breakMinutes: 0,
      totalHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      hourlyRate: data.hourlyRate,
      overtimeRate: data.overtimeRate,
      calculatedCost: 0,
      workerSignature: '',
      signatureTimestamp: '',
      legalDisclaimer: 'Registro de entrada realizado desde el Portal del Operario móvil (RDL 8/2019).',
      notes: data.notes || '',
      status: 'active',
      approvalStatus: 'approved', // Pre-aprobado para imputación inmediata al fichar salida
      createdAt: now.toISOString(),
      clockInTimestamp: now.getTime(),
      locationCoords: data.locationCoords
    };

    const updatedFichajes = [newActiveRecord, ...fichajes.filter(f => f.id !== recordId)];
    setFichajes(updatedFichajes);
    localStorage.setItem('up_fichajes', JSON.stringify(updatedFichajes));
    await dbWrite('fichajes', recordId, newActiveRecord, false, 'create', true);

    showAppToast(`✓ Entrada registrada: ${data.workerName} en ${data.obraName} (${clockInTime}h)`, 'success');
  };

  const handleClockOutWorker = async (data: {
    activeFichajeId: string;
    exitTime: string;
    breakMinutes: number;
    signature: string;
    notes?: string;
    locationCoords?: { latitude: number; longitude: number; accuracy?: number };
  }) => {
    const target = fichajes.find(f => f.id === data.activeFichajeId);
    if (!target) throw new Error('No se encontró el turno activo de trabajo');

    // Calcular horas trabajadas
    const [inH, inM] = target.clockIn.split(':').map(Number);
    const [outH, outM] = data.exitTime.split(':').map(Number);
    let totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // cruce de medianoche

    const netMinutes = Math.max(0, totalMinutes - data.breakMinutes);
    const netHours = Number((netMinutes / 60).toFixed(2));
    const regHours = Math.min(8, netHours);
    const otHours = Math.max(0, netHours - 8);

    const cost = Number(((regHours * target.hourlyRate) + (otHours * target.overtimeRate)).toFixed(2));
    const costId = `cost-fichaje-${target.id}`;

    const completedRecord: RegistroJornada = {
      ...target,
      clockOut: data.exitTime,
      breakMinutes: data.breakMinutes,
      totalHours: netHours,
      regularHours: regHours,
      overtimeHours: otHours,
      calculatedCost: cost,
      workerSignature: data.signature,
      signatureTimestamp: new Date().toISOString(),
      status: 'completed',
      approvalStatus: 'approved', // Imputación directa a la obra según requerimiento
      personalCostId: costId,
      notes: (data.notes ? `${target.notes ? target.notes + ' | ' : ''}${data.notes}` : target.notes) || '',
      updatedAt: new Date().toISOString()
    };

    // 1. Guardar fichaje completado en Firestore
    const updatedFichajes = fichajes.map(f => f.id === target.id ? completedRecord : f);
    setFichajes(updatedFichajes);
    localStorage.setItem('up_fichajes', JSON.stringify(updatedFichajes));
    await dbWrite('fichajes', target.id, completedRecord, false, 'update', true);

    // 2. Imputar automáticamente el coste al Personal de la Obra correspondiente
    const costItem: PersonalCost = {
      id: costId,
      obraId: completedRecord.obraId,
      workerName: completedRecord.workerName,
      date: completedRecord.date,
      role: completedRecord.role || 'Oficial de Obra',
      hours: completedRecord.regularHours,
      hourlyRate: completedRecord.hourlyRate,
      overtimeHours: completedRecord.overtimeHours,
      overtimeRate: completedRecord.overtimeRate,
      totalCost: completedRecord.calculatedCost,
      costType: 'horas',
      notes: `[Portal Operario Fichaje] Entrada ${completedRecord.clockIn} - Salida ${completedRecord.clockOut} (${completedRecord.totalHours}h). ${completedRecord.notes || ''}`.trim(),
      workerCatalogId: completedRecord.workerId,
      fichajeId: completedRecord.id
    };

    const updatedPersonal = [costItem, ...personal.filter(p => p.id !== costId && p.fichajeId !== target.id)];
    setPersonal(updatedPersonal);
    localStorage.setItem('up_personal', JSON.stringify(updatedPersonal));
    await dbWrite('personal', costItem.id, costItem, false, 'create', true);

    showAppToast(`✓ Salida registrada para ${completedRecord.workerName}. ${cost.toFixed(2)}€ imputados a los gastos de ${completedRecord.obraName}`, 'success');
  };

  const handleApproveFichaje = async (
    recordId: string, 
    foremanData: { foremanName: string; foremanRole?: string; foremanSignature: string; notes?: string }
  ) => {
    const target = fichajes.find(f => f.id === recordId);
    if (!target) return;

    const costId = target.personalCostId || `cost-fichaje-${target.id}`;
    const approvedRecord: RegistroJornada = {
      ...target,
      approvalStatus: 'approved',
      foremanName: foremanData.foremanName,
      foremanRole: foremanData.foremanRole || 'Gerente de Obra',
      foremanSignature: foremanData.foremanSignature,
      approvedAt: new Date().toISOString(),
      foremanNotes: foremanData.notes || '',
      personalCostId: costId,
      updatedAt: new Date().toISOString()
    };

    // 1. Guardar fichaje aprobado en Firestore y estado local
    const updatedFichajes = fichajes.map(f => f.id === recordId ? approvedRecord : f);
    setFichajes(updatedFichajes);
    localStorage.setItem('up_fichajes', JSON.stringify(updatedFichajes));
    await dbWrite('fichajes', recordId, approvedRecord, false, 'update', true);

    // 2. Imputar automáticamente el coste al Personal de la Obra correspondiente
    const costItem: PersonalCost = {
      id: costId,
      obraId: approvedRecord.obraId,
      workerName: approvedRecord.workerName,
      date: approvedRecord.date,
      role: approvedRecord.role || 'Oficial de Obra',
      hours: approvedRecord.regularHours,
      hourlyRate: approvedRecord.hourlyRate,
      overtimeHours: approvedRecord.overtimeHours,
      overtimeRate: approvedRecord.overtimeRate,
      totalCost: approvedRecord.calculatedCost,
      costType: 'horas',
      notes: `[Control Horario Aprobado por Gerente: ${foremanData.foremanName}] Fichaje ${approvedRecord.clockIn}-${approvedRecord.clockOut} (${approvedRecord.totalHours}h). ${approvedRecord.notes || ''}`.trim(),
      workerCatalogId: approvedRecord.workerId,
      fichajeId: approvedRecord.id
    };

    const updatedPersonal = [costItem, ...personal.filter(p => p.id !== costId && p.fichajeId !== recordId)];
    setPersonal(updatedPersonal);
    localStorage.setItem('up_personal', JSON.stringify(updatedPersonal));
    await dbWrite('personal', costItem.id, costItem, false, 'create', true);

    showAppToast(`✓ Jornada de ${approvedRecord.workerName} aprobada digitalmente por ${foremanData.foremanName}. ${approvedRecord.calculatedCost.toFixed(2)}€ imputados a la obra.`, 'success');
  };

  const handleBatchApproveFichajes = async (
    recordIds: string[], 
    foremanData: { foremanName: string; foremanRole?: string; foremanSignature: string; notes?: string }
  ) => {
    if (recordIds.length === 0) return;

    let updatedFichajes = [...fichajes];
    const newCostItems: PersonalCost[] = [];
    const timestamp = new Date().toISOString();

    for (const rId of recordIds) {
      const idx = updatedFichajes.findIndex(f => f.id === rId);
      if (idx !== -1) {
        const item = updatedFichajes[idx];
        const costId = item.personalCostId || `cost-fichaje-${item.id}`;
        const approved: RegistroJornada = {
          ...item,
          approvalStatus: 'approved',
          foremanName: foremanData.foremanName,
          foremanRole: foremanData.foremanRole || 'Gerente de Obra',
          foremanSignature: foremanData.foremanSignature,
          approvedAt: timestamp,
          foremanNotes: foremanData.notes || '',
          personalCostId: costId,
          updatedAt: timestamp
        };
        updatedFichajes[idx] = approved;
        await dbWrite('fichajes', rId, approved, false, 'update', true);

        const costItem: PersonalCost = {
          id: costId,
          obraId: approved.obraId,
          workerName: approved.workerName,
          date: approved.date,
          role: approved.role || 'Oficial de Obra',
          hours: approved.regularHours,
          hourlyRate: approved.hourlyRate,
          overtimeHours: approved.overtimeHours,
          overtimeRate: approved.overtimeRate,
          totalCost: approved.calculatedCost,
          costType: 'horas',
          notes: `[Control Horario Aprobado por Gerente: ${foremanData.foremanName}] Fichaje ${approved.clockIn}-${approved.clockOut} (${approved.totalHours}h). ${approved.notes || ''}`.trim(),
          workerCatalogId: approved.workerId,
          fichajeId: approved.id
        };
        newCostItems.push(costItem);
        await dbWrite('personal', costItem.id, costItem, false, 'create', true);
      }
    }

    setFichajes(updatedFichajes);
    localStorage.setItem('up_fichajes', JSON.stringify(updatedFichajes));

    const costIdsSet = new Set(newCostItems.map(c => c.id));
    const rIdsSet = new Set(recordIds);
    const updatedPersonal = [...newCostItems, ...personal.filter(p => !costIdsSet.has(p.id) && !(p.fichajeId && rIdsSet.has(p.fichajeId)))];
    setPersonal(updatedPersonal);
    localStorage.setItem('up_personal', JSON.stringify(updatedPersonal));

    const totalCostAllocated = newCostItems.reduce((acc, c) => acc + c.totalCost, 0);
    showAppToast(`✓ Se han aprobado ${newCostItems.length} jornadas por el gerente ${foremanData.foremanName}. ${totalCostAllocated.toFixed(2)}€ imputados a las obras.`, 'success');
  };

  const handleRejectFichaje = async (recordId: string, reason: string) => {
    const target = fichajes.find(f => f.id === recordId);
    if (!target) return;

    const costId = target.personalCostId || `cost-fichaje-${target.id}`;
    const rejectedRecord: RegistroJornada = {
      ...target,
      approvalStatus: 'rejected',
      rejectionReason: reason,
      updatedAt: new Date().toISOString()
    };

    const updatedFichajes = fichajes.map(f => f.id === recordId ? rejectedRecord : f);
    setFichajes(updatedFichajes);
    localStorage.setItem('up_fichajes', JSON.stringify(updatedFichajes));
    await dbWrite('fichajes', recordId, rejectedRecord, false, 'update', true);

    // Si tuviera coste asociado previamente, se retira de la obra
    const updatedPersonal = personal.filter(p => p.id !== costId && p.fichajeId !== recordId);
    if (updatedPersonal.length !== personal.length) {
      setPersonal(updatedPersonal);
      localStorage.setItem('up_personal', JSON.stringify(updatedPersonal));
      await dbWrite('personal', costId, null, true, 'delete', true);
    }

    showAppToast(`✕ Jornada de ${target.workerName} rechazada. Gasto no computado a la obra.`, 'error');
  };

  const handleDeleteFichaje = async (id: string) => {
    const target = fichajes.find(f => f.id === id);
    const updatedFichajes = fichajes.filter(f => f.id !== id);
    setFichajes(updatedFichajes);
    localStorage.setItem('up_fichajes', JSON.stringify(updatedFichajes));
    await dbWrite('fichajes', id, null, true, 'delete', true);

    if (target) {
      const costId = target.personalCostId || `cost-fichaje-${id}`;
      const updatedPersonal = personal.filter(p => p.id !== costId && p.fichajeId !== id);
      setPersonal(updatedPersonal);
      localStorage.setItem('up_personal', JSON.stringify(updatedPersonal));
      await dbWrite('personal', costId, null, true, 'delete', true);
    }

    showAppToast('✓ Registro de jornada y su coste de obra eliminados correctamente', 'success');
  };


  const exportExecutiveReportPDF = () => {
    setIsExportingDashboardPDF(true);
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const filename = `INFORME_EJECUTIVO_OBRAS_${new Date().toISOString().split('T')[0]}.pdf`;

      // Draw Uniproyect branding logic
      const drawDocumentHeader = () => {
        // Draw Logo Background (Emerald color `#10B981` -> RGB 16, 185, 129)
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(15, 15, 14, 14, 2, 2, 'F');

        // Draw Stylized Building Frame Blocks Inside Logo (White Vector Art)
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1.3);
        
        // Column 1
        doc.line(18.5, 24.5, 18.5, 21.5);
        doc.line(18.5, 21.5, 20.5, 21.5);
        doc.line(20.5, 21.5, 20.5, 24.5);
        
        // Column 2
        doc.line(21.5, 24.5, 21.5, 19.5);
        doc.line(21.5, 19.5, 23.5, 19.5);
        doc.line(23.5, 19.5, 23.5, 24.5);
        
        // Column 3
        doc.line(24.5, 24.5, 24.5, 17.5);
        doc.line(24.5, 17.5, 26.5, 17.5);
        doc.line(26.5, 17.5, 26.5, 24.5);

        // Horizontal ground base line for logo
        doc.setLineWidth(0.8);
        doc.line(17.5, 25.5, 27.5, 25.5);

        // Company Name Brand text
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Uniproyect', 33, 21);
        
        doc.setTextColor(16, 185, 129); // emerald-500
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('JOSÉ REAL CONSTRUCCIONES, S.L.', 33, 25.5);

        // Company Metadata Context on Top Right
        doc.setTextColor(71, 85, 105); // slate-600
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('JOSÉ REAL CONSTRUCCIONES, S.L.', 195, 17, { align: 'right' });
        doc.text('NIF: B-56755085', 195, 21, { align: 'right' });
        doc.text('C/ Amapola 8, 11.630, Arcos de la Frontera', 195, 25, { align: 'right' });
        doc.text('Telf: +34 640 37 27 27 | Correo: jrealconstruccion@gmail.com', 195, 29, { align: 'right' });

        // Flat Colored Divider Line
        doc.setDrawColor(16, 185, 129); // Emerald Line
        doc.setLineWidth(0.8);
        doc.line(15, 33, 195, 33);
      };

      drawDocumentHeader();

      // Report Header Section
      doc.setTextColor(15, 23, 42); // slate-900 / black
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('INFORME CONTROL PRESUPUESTARIO EJECUTIVO', 15, 41);

      doc.setTextColor(100, 116, 139); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const formattedDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      doc.text(`Generado el: ${formattedDate} para dirección y control financiero contable de proyectos.`, 15, 45);

      // Calculations:
      const totalCompanyOverhead = gastosGenerales.reduce((acc, g) => acc + g.amount, 0) +
                                   personal.filter(p => p.authorId === 'structural' || p.obraId === 'structural').reduce((acc, p) => acc + p.totalCost, 0);
      const overheadAllocationMap = getObraOverheadAllocationMap(obras, totalCompanyOverhead);

      let companyTotalBudget = 0;
      let companyTotalSpent = 0;
      let companyTotalDirectSpent = 0;
      let companyTotalOverheadAllocated = 0;

      const obrasCalculated = obras.map(obra => {
        const oDocs = documentos.filter(d => d.obraId === obra.id);
        const oPers = personal.filter(p => p.obraId === obra.id);
        const directSpent = oDocs.reduce((acc, d) => acc + d.totalAmount, 0) + oPers.reduce((acc, p) => acc + p.totalCost, 0);
        const obraOverhead = overheadAllocationMap[obra.id]?.amount || 0;
        const totalSpent = directSpent + obraOverhead;
        const percentage = obra.budget > 0 ? (totalSpent / obra.budget) * 100 : 0;
        const netBalance = obra.budget - totalSpent;

        companyTotalBudget += obra.budget;
        companyTotalSpent += totalSpent;
        companyTotalDirectSpent += directSpent;
        companyTotalOverheadAllocated += obraOverhead;

        return {
          ...obra,
          directSpent,
          obraOverhead,
          totalSpent,
          percentage,
          netBalance
        };
      });

      const totalProfitMargin = companyTotalBudget - companyTotalSpent;
      const budgetProgress = companyTotalBudget > 0 ? (companyTotalSpent / companyTotalBudget) * 100 : 0;
      const isProfit = totalProfitMargin >= 0;

      // Draw beautiful summary boxes
      let cardY = 50;
      let cardH = 14;
      let cardW = 57;
      let gap = 4.5;

      // Card 1: Presupuesto Unificado
      let cardX1 = 15;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.roundedRect(cardX1, cardY, cardW, cardH, 1.5, 1.5, 'FD');
      
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('PRESUPUESTO GLOBAL OBJETIVO', cardX1 + 4, cardY + 4);
      
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(companyTotalBudget), cardX1 + 4, cardY + 10);

      // Card 2: Gastos Totales Consolidados
      let cardX2 = cardX1 + cardW + gap;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cardX2, cardY, cardW, cardH, 1.5, 1.5, 'FD');
      
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('COSTES REALES DE EJECUCIÓN', cardX2 + 4, cardY + 4);
      
      doc.setTextColor(30, 41, 59); // slate-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(companyTotalSpent), cardX2 + 4, cardY + 10);

      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(`Grado de ejecución: ${budgetProgress.toFixed(1)}%`, cardX2 + 4, cardY + 12.8);

      // Card 3: Margen de Utilidad Consolidado
      let cardX3 = cardX2 + cardW + gap;
      if (isProfit) {
        doc.setFillColor(240, 253, 250); // teal-50
        doc.setDrawColor(153, 246, 228); // teal-200
      } else {
        doc.setFillColor(254, 242, 242); // red-50
        doc.setDrawColor(254, 202, 202); // red-200
      }
      doc.roundedRect(cardX3, cardY, cardW, cardH, 1.5, 1.5, 'FD');
      
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('MARGEN NETO ESTIMADO', cardX3 + 4, cardY + 4);
      
      if (isProfit) {
        doc.setTextColor(13, 148, 136); // teal-600
      } else {
        doc.setTextColor(220, 38, 38); // red-600
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalProfitMargin), cardX3 + 4, cardY + 10);

      const computedProfitPercent = companyTotalBudget > 0 ? (totalProfitMargin / companyTotalBudget * 100).toFixed(1) : '0';
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(`Rendimiento de cartera: ${computedProfitPercent}%`, cardX3 + 4, cardY + 12.8);

      let nextY = 69;

      // Table 1: Detailed Obras
      doc.setTextColor(15, 23, 42); // slate-900 / black
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('1. RESUMEN FINANCIERO Y CONTROL DE PROYECTOS (ACTIVOS)', 15, nextY);
      nextY += 3;

      const table1Rows = obrasCalculated.map(o => [
        o.id.toUpperCase().substring(0, 8),
        o.name || '',
        o.location || '',
        o.budget.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        o.directSpent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        o.obraOverhead.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        o.totalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        `${o.percentage.toFixed(1)} %`,
        o.netBalance.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ]);

      // Add totals row:
      table1Rows.push([
        'T. GLOBAL',
        'TOTAL CARTERA CONSOLIDADO',
        '',
        companyTotalBudget.toLocaleString('es-ES', { minimumFractionDigits: 2 }),
        companyTotalDirectSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 }),
        companyTotalOverheadAllocated.toLocaleString('es-ES', { minimumFractionDigits: 2 }),
        companyTotalSpent.toLocaleString('es-ES', { minimumFractionDigits: 2 }),
        `${budgetProgress.toFixed(1)} %`,
        totalProfitMargin.toLocaleString('es-ES', { minimumFractionDigits: 2 })
      ]);

      autoTable(doc, {
        startY: nextY,
        margin: { left: 15, right: 15, bottom: 20 },
        head: [['Ref ID', 'Proyecto / Obra', 'Ubicación', 'Presup. (€)', 'Coste Directo (€)', 'In. Gral (€)', 'Coste Real (€)', 'Cons.', 'Balance (€)']],
        body: table1Rows,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.5, font: 'helvetica' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 14 },
          1: { halign: 'left', cellWidth: 36 },
          2: { halign: 'left', cellWidth: 22 },
          3: { halign: 'right', cellWidth: 19 },
          4: { halign: 'right', cellWidth: 19 },
          5: { halign: 'right', cellWidth: 16 },
          6: { halign: 'right', fontStyle: 'bold', cellWidth: 19 },
          7: { halign: 'center', cellWidth: 15 },
          8: { halign: 'right', fontStyle: 'bold', cellWidth: 20 }
        },
        didParseCell: function (data) {
          if (data.row.index === table1Rows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [248, 250, 252];
            if (data.column.index === 8) {
              data.cell.styles.textColor = isProfit ? [13, 148, 136] : [220, 38, 38];
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable.finalY + 10;

      // Table 2: General Expenses Distribution
      if (nextY + 25 > 280) {
        doc.addPage();
        nextY = 20;
      }

      doc.setTextColor(15, 23, 42); // slate-900 / black
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('2. ANÁLISIS DE COSTES GENERALES DE ESTRUCTURA Y PRORRATEO', 15, nextY);
      nextY += 3;

      const stRows = personal.filter(p => p.authorId === 'structural' || p.obraId === 'structural');
      const directExpenses = gastosGenerales;

      const structRows = [
        ...stRows.map(p => [
          'Personal Directivo',
          `Trabajador: ${p.workerName} (${p.role}) - Partes de Estructura`,
          p.date,
          p.totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €'
        ]),
        ...directExpenses.map(g => [
          g.category || 'Otros Suministros',
          g.description || '',
          g.date || '',
          g.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €'
        ])
      ];

      structRows.push([
        'TOTAL INDIRECTOS',
        'Consolidado de Cuotas de Estructura Empresarial Prorrateadas',
        '',
        totalCompanyOverhead.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €'
      ]);

      autoTable(doc, {
        startY: nextY,
        margin: { left: 15, right: 15, bottom: 20 },
        head: [['Categoría / Tipo Gasto', 'Concepto / Destinatario / Detalle', 'Fecha', 'Importe Neto (€)']],
        body: structRows,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.5, font: 'helvetica' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 40 },
          1: { halign: 'left', cellWidth: 95 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'right', fontStyle: 'bold', cellWidth: 25 }
        },
        didParseCell: function (data) {
          if (data.row.index === structRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [248, 250, 252];
            if (data.column.index === 3) {
              data.cell.styles.textColor = [16, 185, 129];
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable.finalY + 10;

      // Table 3: Top Contractors / Suppliers by volume
      if (nextY + 25 > 280) {
        doc.addPage();
        nextY = 20;
      }

      doc.setTextColor(15, 23, 42); // slate-900 / black
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('3. PRINCIPALES PRESTADORES DE SERVICIOS Y PROVEEDORES DE OBRA', 15, nextY);
      nextY += 3;

      // Calculate supplier totals
      const supplierTotals: Record<string, { total: number; count: number; categories: string[] }> = {};
      documentos.forEach(d => {
        const s = d.supplier || 'No Identificado';
        if (!supplierTotals[s]) {
          supplierTotals[s] = { total: 0, count: 0, categories: [] };
        }
        supplierTotals[s].total += d.totalAmount;
        supplierTotals[s].count += 1;
        if (d.category && !supplierTotals[s].categories.includes(d.category)) {
          supplierTotals[s].categories.push(d.category);
        }
      });

      const sortedSuppliers = Object.entries(supplierTotals)
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const supplierRows = sortedSuppliers.map((s, idx) => [
        `0${idx + 1}`,
        s.name,
        `${s.count} transacc.`,
        s.categories.slice(0, 2).join(', ') || 'Otros',
        s.total.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €'
      ]);

      autoTable(doc, {
        startY: nextY,
        margin: { left: 15, right: 15, bottom: 20 },
        head: [['Puesto', 'Proveedor / Contratista Homologado', 'Lote Transacciones', 'Suministros Homologados Directos', 'Volumen Imputado (€)']],
        body: supplierRows,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.5, font: 'helvetica' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
          1: { halign: 'left', cellWidth: 70 },
          2: { halign: 'center', cellWidth: 30 },
          3: { halign: 'left', cellWidth: 40 },
          4: { halign: 'right', fontStyle: 'bold', cellWidth: 25 }
        }
      });

      nextY = (doc as any).lastAutoTable.finalY + 12;

      // Final signature
      if (nextY + 28 > 280) {
        doc.addPage();
        nextY = 20;
      }

      doc.setFillColor(30, 41, 59); // slate-800 background
      doc.roundedRect(15, nextY, 180, 14, 1.5, 1.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('AUDITORÍA SUMARIA GLOBAL Y RESUMEN DE CONTROL EJECUTIVO - UNIPROYECT', 20, nextY + 5.5);

      doc.setTextColor(209, 250, 229); // emerald-100
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(`Cartera general de ${obras.length} obras fiscalizadas y consolidadas mediante control financiero de contabilidad directa.`, 20, nextY + 9.5);

      const totalFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(companyTotalSpent);
      doc.setTextColor(16, 185, 129); // emerald green
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(totalFormatted, 190, nextY + 9, { align: 'right' });

      // Represent signatures
      nextY += 22;
      if (nextY + 18 > 280) {
        doc.addPage();
        nextY = 20;
      }

      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.4);

      // Representative 1
      doc.line(30, nextY + 10, 85, nextY + 10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.text('Certificación Contable Directa', 30, nextY + 14);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('Uniproyect Control de Obras', 30, nextY + 18);

      // Representative 2
      doc.line(125, nextY + 10, 180, nextY + 10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.text('Dirección de Operaciones', 125, nextY + 14);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('José Real Construcciones, S.L.', 125, nextY + 18);

      // Running footer page decoration
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Draw running footer page number
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${totalPages}`, 195, 292, { align: 'right' });

        // Draw document watermark
        const refStr = `ID AUDIT: UNIPROYECT-EXEC-CONSOLIDADO    |    Copyright © DHG. Todos los derechos reservados.`;
        doc.text(refStr, 15, 292);

        // Base running thin grey rule
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, 288, 195, 288);

        // Running top-header on pages above page 1
        if (i > 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184); // slate-400
          doc.text('INFORME EJECUTIVO DE CARTERA - CONTROL DE PRESUPUESTOS Y GASTOS', 15, 10);
          doc.text(new Date().toLocaleDateString('es-ES'), 195, 10, { align: 'right' });

          doc.setDrawColor(16, 185, 129); // emerald accent thin border
          doc.setLineWidth(0.4);
          doc.line(15, 11.5, 195, 11.5);
        }
      }

      doc.save(filename);
      setIsExportingDashboardPDF(false);
    } catch (err) {
      console.error('[Export Executive PDF Error]:', err);
      setIsExportingDashboardPDF(false);
    }
  };

  // --- HANDLERS ---
  // Obras handlers
  const handleAddObra = (o: Obra) => {
    const updated = [o, ...obras];
    saveAllData(updated, documentos, personal, gastosGenerales);
    dbWrite('obras', o.id, o, false, 'create');
  };
  const handleDeleteObra = (id: string) => {
    const updated = obras.filter(o => o.id !== id);
    saveAllData(updated, documentos, personal, gastosGenerales);
    dbWrite('obras', id, null, true, 'delete');
  };
  const handleUpdateObra = (o: Obra) => {
    const updated = obras.map(item => item.id === o.id ? o : item);
    saveAllData(updated, documentos, personal, gastosGenerales);
    dbWrite('obras', o.id, o, false, 'update');
  };

  const handleImportObraComplete = (result: ProcessImportResult) => {
    saveAllData(
      result.updatedObras,
      result.updatedDocs,
      result.updatedPersonal,
      gastosGenerales,
      result.updatedProveedores,
      result.updatedTrabajadores
    );

    // Sync imported items to central Firestore database
    result.updatedObras.forEach(o => dbWrite('obras', o.id, o, false, 'create', true));
    result.updatedDocs.forEach(d => dbWrite('documentos', d.id, d, false, 'create', true));
    result.updatedPersonal.forEach(p => dbWrite('personal', p.id, p, false, 'create', true));
    result.updatedProveedores.forEach(pr => dbWrite('proveedores', pr.id, pr, false, 'create', true));
    result.updatedTrabajadores.forEach(t => dbWrite('trabajadores', t.id, t, false, 'create', true));

    showAppToast(`✓ Se han importado y guardado ${result.importedObrasCount} obras y ${result.importedDocsCount} documentos correctamente en la base de datos`, 'success');

    sendPushNotification(null, {
      title: `📦 ¡Importación de Obra Completada!`,
      body: `Se han importado ${result.importedObrasCount} obras con ${result.importedDocsCount} documentos y ${result.importedPersonalCount} partes de personal.`,
      type: 'system'
    }).catch(err => console.error(err));
  };

  // Personal handlers
  const handleAddPersonal = (p: PersonalCost) => {
    if (p.obraId === 'structural') {
      const g: OtrosGasto = {
        id: p.id,
        category: 'Personal de Estructura / Oficina',
        description: `Personal: ${p.workerName} (${p.role})`,
        date: p.date,
        amount: p.totalCost,
        notes: `Generado desde personal de oficina. Horas: ${p.hours}, Tarifa: ${p.hourlyRate}€/h. ${p.notes || ''}`
      };
      const updatedGastos = [g, ...gastosGenerales];
      const updatedPersonal = personal.filter(item => item.id !== p.id);
      saveAllData(obras, documentos, updatedPersonal, updatedGastos, proveedores, trabajadores);
      dbWrite('gastosGenerales', g.id, g, false, 'create');
      dbWrite('personal', p.id, null, true, 'delete', true);
    } else {
      const updated = [p, ...personal];
      saveAllData(obras, documentos, updated, gastosGenerales, proveedores, trabajadores);
      dbWrite('personal', p.id, p, false, 'create');
    }
  };

  const handleUpdatePersonal = (p: PersonalCost) => {
    if (p.obraId === 'structural') {
      const g: OtrosGasto = {
        id: p.id,
        category: 'Personal de Estructura / Oficina',
        description: `Personal: ${p.workerName} (${p.role})`,
        date: p.date,
        amount: p.totalCost,
        notes: `Generado desde personal de oficina. Horas: ${p.hours}, Tarifa: ${p.hourlyRate}€/h. ${p.notes || ''}`
      };
      const updatedGastos = gastosGenerales.some(item => item.id === g.id)
        ? gastosGenerales.map(item => item.id === g.id ? g : item)
        : [g, ...gastosGenerales];
      const updatedPersonal = personal.filter(item => item.id !== p.id);
      saveAllData(obras, documentos, updatedPersonal, updatedGastos, proveedores, trabajadores);
      dbWrite('gastosGenerales', g.id, g, false, 'update');
      dbWrite('personal', p.id, null, true, 'delete', true);
    } else {
      const updatedGastos = gastosGenerales.filter(item => item.id !== p.id);
      const updatedPersonal = personal.some(item => item.id === p.id)
        ? personal.map(item => item.id === p.id ? p : item)
        : [p, ...personal];
      saveAllData(obras, documentos, updatedPersonal, updatedGastos, proveedores, trabajadores);
      dbWrite('personal', p.id, p, false, 'update');
      dbWrite('gastosGenerales', p.id, null, true, 'delete', true);
    }
  };

  const handleDeletePersonal = (id: string) => {
    const updatedPersonal = personal.filter(p => p.id !== id);
    const updatedGastos = gastosGenerales.filter(g => g.id !== id);
    saveAllData(obras, documentos, updatedPersonal, updatedGastos, proveedores, trabajadores);
    dbWrite('personal', id, null, true, 'delete');
    dbWrite('gastosGenerales', id, null, true, 'delete', true);
  };

  // Otros Gastos handlers
  const handleAddGasto = (g: OtrosGasto) => {
    const updated = [g, ...gastosGenerales];
    saveAllData(obras, documentos, personal, updated, proveedores, trabajadores);
    dbWrite('gastosGenerales', g.id, g, false, 'create');
  };
  const handleAddGastosBatch = (newGastos: OtrosGasto[]) => {
    const updated = [...newGastos, ...gastosGenerales];
    saveAllData(obras, documentos, personal, updated, proveedores, trabajadores);
    newGastos.forEach(g => dbWrite('gastosGenerales', g.id, g, false, 'create', true));
    showAppToast(`✓ Se han guardado ${newGastos.length} gastos correctamente en la base de datos`, 'success');
  };
  const handleUpdateGasto = (g: OtrosGasto) => {
    const updated = gastosGenerales.map(item => item.id === g.id ? g : item);
    saveAllData(obras, documentos, personal, updated, proveedores, trabajadores);
    dbWrite('gastosGenerales', g.id, g, false, 'update');
  };
  const handleDeleteGasto = (id: string) => {
    const updated = gastosGenerales.filter(g => g.id !== id);
    saveAllData(obras, documentos, personal, updated, proveedores, trabajadores);
    dbWrite('gastosGenerales', id, null, true, 'delete');
  };

  // Document (Factura / Albaran) handlers
  const handleOpenDocModal = (docToEdit?: FacturaAlbaran) => {
    if (docToEdit) {
      setModalTab('single');
      setDocId(docToEdit.id);
      setDocObraId(docToEdit.obraId);
      setDocType(docToEdit.type);
      setDocNumber(docToEdit.docNumber);
      setDocSupplier(docToEdit.supplier);
      setDocDate(docToEdit.date);
      setDocItems(docToEdit.items);
      setDocIvaRate(docToEdit.ivaRate);
      setDocRetentionRate(docToEdit.retentionRate);
      setDocNotes(docToEdit.notes || '');
      setDocImageUrl(docToEdit.imageUrl || '');
      setDocCategory(docToEdit.category || '');
    } else {
      setModalTab('single');
      setDocId('');
      setDocObraId(obras[0]?.id || '');
      setDocType('factura');
      setDocNumber('');
      setDocSupplier('');
      setDocDate(new Date().toISOString().split('T')[0]);
      setDocItems([
        { name: 'Material general / Suministros', quantity: 1, unit: 'ud', price: 0, total: 0 }
      ]);
      setDocIvaRate(21);
      setDocRetentionRate(0);
      setDocNotes('');
      setDocImageUrl('');
      setDocCategory('');
    }
    setErrorMsg('');
    setOcrSuccessMsg('');
    setBulkQueue([]); // Reset bulk queue on fresh modal open
    setShowDocModal(true);
  };

  const handleSaveDocFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docObraId || !docNumber || !docSupplier) {
      setErrorMsg('Por favor rellene los campos obligatorios del emisor.');
      return;
    }

    // Calculations based on standard auditing rules in Spain
    const baseAmount = docItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const ivaAmount = baseAmount * (Number(docIvaRate) / 100);
    const retentionAmount = baseAmount * (Number(docRetentionRate) / 100);
    const totalAmount = baseAmount + ivaAmount - retentionAmount;

    const savedItems: DocumentItem[] = docItems.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      total: Number(item.quantity) * Number(item.price),
    }));

    const isDuplicate = documentos.some(d => 
      d.id !== (docId || '') &&
      d.type === docType &&
      d.supplier.trim().toLowerCase() === docSupplier.trim().toLowerCase() &&
      d.docNumber.trim().toLowerCase() === docNumber.trim().toLowerCase()
    );

    if (isDuplicate) {
      const typeLabel = docType === 'factura' ? 'Factura' : 'Albarán';
      if (!confirm(`⚠️ ¡Atención! Ya existe una copia de tipo ${typeLabel} con Nº "${docNumber}" del emisor/proveedor "${docSupplier}".\n\n¿Desea ingresar este documento duplicado de todas formas?`)) {
        return;
      }
    }

    const finalDoc: FacturaAlbaran = {
      id: docId || `doc-${Date.now()}`,
      obraId: docObraId,
      type: docType,
      docNumber,
      supplier: docSupplier,
      date: docDate,
      items: savedItems,
      baseAmount,
      ivaRate: Number(docIvaRate),
      ivaAmount,
      retentionRate: Number(docRetentionRate),
      retentionAmount,
      totalAmount,
      notes: docNotes,
      imageUrl: docImageUrl,
      category: docCategory,
    };

    let updatedDocs = [...documentos];
    if (docId) {
      updatedDocs = updatedDocs.map(d => d.id === docId ? finalDoc : d);
    } else {
      updatedDocs = [finalDoc, ...updatedDocs];
    }

    saveAllData(obras, updatedDocs, personal, gastosGenerales);
    dbWrite('documentos', finalDoc.id, finalDoc, false, docId ? 'update' : 'create');

    if (!docId) {
      // Fire push notification for the newly scanned or imported document
      sendPushNotification(null, {
        title: `📂 Documento Importado: ${finalDoc.type === 'factura' ? 'Factura' : 'Albarán'}`,
        body: `Se ha importado y guardado Nº ${finalDoc.docNumber} de ${finalDoc.supplier} por un total de ${finalDoc.totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.`,
        type: 'document_import',
        meta: {
          docId: finalDoc.id
        }
      }).catch(err => console.error(err));
    }

    setShowDocModal(false);
  };

  const handleDeleteDocumento = (id: string) => {
    if (confirm('¿Desea suprimir este documento? Se eliminarán los acumulados contables asociados.')) {
      const updated = documentos.filter(d => d.id !== id);
      saveAllData(obras, updated, personal, gastosGenerales);
      dbWrite('documentos', id, null, true, 'delete');
      setSelectedDocIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleExportCSV = async () => {
    if (activeDocsList.length === 0) return;
    try {
      const fileBlob = await exportDocsListToExcel(activeDocsList, obras);
      const url = URL.createObjectURL(fileBlob);
      
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `control_obras_documentos_${dateStr}.xlsx`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error al exportar a Excel:', err);
    }
  };

  const handleExportPDF = () => {
    // Determine which documents to export
    // If there is an active selection of documents via checkbox, export only those.
    // Otherwise, export all documents currently in the filtered list (activeDocsList).
    const docsToExport = selectedDocIds.length > 0
      ? activeDocsList.filter(d => selectedDocIds.includes(d.id))
      : activeDocsList;

    if (docsToExport.length === 0) {
      alert("No hay documentos para exportar a PDF.");
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
      const isSelectionOnly = selectedDocIds.length > 0;
      const filename = `REPORTE_DOCUMENTOS_${isSelectionOnly ? 'SELECCION_' : 'FILTRADOS_'}${new Date().toISOString().split('T')[0]}.pdf`;

      // Draw Uniproyect branding logic
      const drawDocumentHeader = () => {
        // Draw Logo Background (Emerald color `#10B981` -> RGB 16, 185, 129)
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(15, 15, 14, 14, 2, 2, 'F');

        // Draw Stylized Building Frame Blocks Inside Logo (White Vector Art)
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1.3);
        
        // Column 1
        doc.line(18.5, 24.5, 18.5, 21.5);
        doc.line(18.5, 21.5, 20.5, 21.5);
        doc.line(20.5, 21.5, 20.5, 24.5);
        
        // Column 2
        doc.line(21.5, 24.5, 21.5, 19.5);
        doc.line(21.5, 19.5, 23.5, 19.5);
        doc.line(23.5, 19.5, 23.5, 24.5);
        
        // Column 3
        doc.line(24.5, 24.5, 24.5, 17.5);
        doc.line(24.5, 17.5, 26.5, 17.5);
        doc.line(26.5, 17.5, 26.5, 24.5);

        // Horizontal ground base line for logo
        doc.setLineWidth(0.8);
        doc.line(17.5, 25.5, 27.5, 25.5);

        // Company Name Brand text
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Uniproyect', 33, 21);
        
        doc.setTextColor(16, 185, 129); // emerald-500
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('JOSÉ REAL CONSTRUCCIONES, S.L.', 33, 25.5);

        // Company Metadata Context on Top Right (Landscape format: 297mm width)
        doc.setTextColor(71, 85, 105); // slate-600
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('JOSÉ REAL CONSTRUCCIONES, S.L.', 282, 17, { align: 'right' });
        doc.text('NIF: B-56755085', 282, 21, { align: 'right' });
        doc.text('C/ Amapola 8, 11.630, Arcos de la Frontera', 282, 25, { align: 'right' });
        doc.text('Telf: +34 640 37 27 27 | Correo: jrealconstruccion@gmail.com', 282, 29, { align: 'right' });

        // Flat Colored Divider Line
        doc.setDrawColor(16, 185, 129); // Emerald Line
        doc.setLineWidth(0.8);
        doc.line(15, 33, 282, 33);
      };

      drawDocumentHeader();

      // Report Header Section
      doc.setTextColor(15, 23, 42); // slate-900 / black
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const reportTitle = isSelectionOnly 
        ? 'LISTADO DE FACTURAS Y ALBARANES (SELECCIÓN DE TABLA)' 
        : 'LISTADO DE FACTURAS Y ALBARANES (VISTA FILTRADA ACTUAL)';
      doc.text(reportTitle, 15, 41);

      doc.setTextColor(100, 116, 139); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const formattedDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      doc.text(`Generado el: ${formattedDate}. Total de documentos: ${docsToExport.length}.`, 15, 45);

      // Calculations:
      const sumBase = docsToExport.reduce((sum, d) => sum + d.baseAmount, 0);
      const sumIva = docsToExport.reduce((sum, d) => sum + d.ivaAmount, 0);
      const sumRet = docsToExport.reduce((sum, d) => sum + d.retentionAmount, 0);
      const sumTotal = docsToExport.reduce((sum, d) => sum + d.totalAmount, 0);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 49, 267, 14, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('RESUMEN DE CONTENIDO:', 20, 57.5);

      doc.text(`Suma Base Imp.:`, 80, 57.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`${sumBase.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 108, 57.5);

      doc.setFont('helvetica', 'bold');
      doc.text(`Suma IVA / Retenciones:`, 142, 57.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`+${sumIva.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / -${sumRet.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 178, 57.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text(`TOTAL NETO INTEGRADO:`, 222, 57.5);
      doc.text(`${sumTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, 258, 57.5);

      // Prepare table rows for autoTable
      const tableRows = docsToExport.map(doc => {
        const relatedWork = obras.find(o => o.id === doc.obraId)?.name || 'Sin obra';
        const typeLabel = doc.type === 'factura' ? 'Factura' : 'Albarán';
        const statusLabel = doc.status === 'paid' ? 'Pagado' : doc.status === 'pending' ? 'Pendiente' : 'Borrador';
        const categoryLabel = getDocCategory(doc);

        return [
          doc.docNumber,
          typeLabel,
          doc.supplier,
          categoryLabel,
          doc.date,
          relatedWork,
          doc.baseAmount.toFixed(2) + ' €',
          (doc.ivaRate > 0 ? `${doc.ivaRate}%` : '0%'),
          doc.totalAmount.toFixed(2) + ' €',
          statusLabel
        ];
      });

      // Append Total Footer Row
      tableRows.push([
        'TOTAL CONSOLIDADO',
        '',
        '',
        '',
        '',
        `${docsToExport.length} documentos`,
        sumBase.toFixed(2) + ' €',
        '',
        sumTotal.toFixed(2) + ' €',
        ''
      ]);

      autoTable(doc, {
        startY: 68,
        margin: { left: 15, right: 15, bottom: 20 },
        head: [['Nº Documento', 'Tipo', 'Emisor Proveedor', 'Categoría', 'Fecha', 'Obra / Proyecto', 'Base Imp.', 'IVA %', 'Total Neto', 'Estado']],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, font: 'helvetica' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 24 },
          1: { halign: 'center', cellWidth: 16 },
          2: { halign: 'left', cellWidth: 46 },
          3: { halign: 'left', cellWidth: 26 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'left', cellWidth: 46 },
          6: { halign: 'right', cellWidth: 24 },
          7: { halign: 'center', cellWidth: 14 },
          8: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
          9: { halign: 'center', cellWidth: 25 }
        },
        didParseCell: function (data) {
          // Style summary row
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
            if (data.column.index === 8) {
              data.cell.styles.textColor = [16, 185, 129];
            }
          }
          // Style state labels
          if (data.column.index === 9 && data.row.index !== tableRows.length - 1) {
            const val = data.cell.text[0];
            if (val === 'Pagado') {
              data.cell.styles.textColor = [16, 185, 129];
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Pendiente') {
              data.cell.styles.textColor = [245, 158, 11];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      doc.save(filename);
    } catch (err) {
      console.error('Error al generar PDF de documentos:', err);
      alert('Se produjo un error al generar el archivo PDF.');
    }
  };

  const handleToggleSelectAllDocs = () => {
    const activeIds = activeDocsList.map(d => d.id);
    const allSelectedInActive = activeIds.every(id => selectedDocIds.includes(id));
    
    if (allSelectedInActive) {
      setSelectedDocIds(prev => prev.filter(id => !activeIds.includes(id)));
    } else {
      setSelectedDocIds(prev => {
        const union = new Set([...prev, ...activeIds]);
        return Array.from(union);
      });
    }
  };

  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleMassDeleteDocuments = () => {
    if (selectedDocIds.length === 0) return;
    if (confirm(`¿Desea suprimir de forma masiva los ${selectedDocIds.length} documentos seleccionados? Se eliminarán los acumulados contables asociados.`)) {
      const updated = documentos.filter(d => !selectedDocIds.includes(d.id));
      saveAllData(obras, updated, personal, gastosGenerales);
      selectedDocIds.forEach(id => dbWrite('documentos', id, null, true, 'delete', true));
      showAppToast(`✓ Se han eliminado ${selectedDocIds.length} documentos correctamente de la base de datos`, 'success');
      setSelectedDocIds([]);
    }
  };

  const handleAddFieldItem = () => {
    setDocItems([
      ...docItems,
      { name: '', quantity: 1, unit: 'ud', price: 0, total: 0 }
    ]);
  };

  const handleRemoveFieldItem = (index: number) => {
    if (docItems.length === 1) return;
    setDocItems(docItems.filter((_, i) => i !== index));
  };

  const handleUpdateItemField = (index: number, key: keyof DocumentItem, val: any) => {
    const updated = docItems.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [key]: val };
        if (key === 'quantity' || key === 'price') {
          const qty = key === 'quantity' ? Number(val) : Number(item.quantity);
          const prc = key === 'price' ? Number(val) : Number(item.price);
          updatedItem.total = qty * prc;
        }
        return updatedItem;
      }
      return item;
    });
    setDocItems(updated);
  };

  // --- OCR / LIVE AI EXTRACTOR PROCESS ---
  const analyzeDocumentWithAI = async (base64String: string, mime: string, name: string) => {
    setIsAnalyzing(true);
    setOcrSuccessMsg('');
    setErrorMsg('');

    const effectiveEngine = (ocrEngineMode === 'local' || !navigator.onLine)
      ? 'local'
      : ocrEngineMode;

    if (effectiveEngine === 'local') {
      setAnalysisProgress('Modo Local Offline: Iniciando escáner Tesseract.js en tu dispositivo...');
      try {
        const extracted = await scanDocumentLocally(base64String, {
          knownSuppliers: proveedores,
          onProgress: (percent, status) => {
            setAnalysisProgress(`[OCR Local ${percent}%] ${status}`);
          }
        });

        if (extracted.type) setDocType(extracted.type);
        if (extracted.docNumber) setDocNumber(extracted.docNumber);
        if (extracted.supplier) setDocSupplier(extracted.supplier);
        if (extracted.date) setDocDate(extracted.date);
        if (extracted.ivaRate !== undefined) setDocIvaRate(extracted.ivaRate);
        if (extracted.retentionRate !== undefined) setDocRetentionRate(extracted.retentionRate);
        if (extracted.notes) setDocNotes(extracted.notes);
        if (extracted.items && extracted.items.length > 0) {
          setDocItems(extracted.items);
        }

        setOcrSuccessMsg(`¡Éxito Local! Procesado 100% en tu dispositivo sin conexión (Tesseract.js). Proveedor: ${extracted.supplier}, Total: ${extracted.totalAmount.toFixed(2)}€`);
        return;
      } catch (localErr: any) {
        console.error('Error en OCR local:', localErr);
        setErrorMsg(`Error en OCR Local (Tesseract.js): ${localErr.message || 'No se pudo reconocer el texto'}`);
        return;
      } finally {
        setIsAnalyzing(false);
        setAnalysisProgress('');
      }
    }

    try {
      setAnalysisProgress('Procesando imagen con IA Gemini 3.5-Flash (Estructurando productos, IVA y totales)...');
      
      const response = await authorizedFetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: base64String,
          mimeType: mime,
          filename: name
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Fallo del servidor (HTTP ${response.status})`);
      }

      const dataStr = await response.json();
      
      // Handle the new multi-document response structure robustly
      const docs = dataStr.documents && Array.isArray(dataStr.documents) ? dataStr.documents : [dataStr];
      
      if (docs.length === 0) {
        throw new Error('No se ha podido leer ningún documento en el archivo.');
      }
      
      if (docs.length > 1) {
        // Automatically convert these sub-pages into processed items in our bulkQueue!
        const newBulkItems: BulkQueueItem[] = docs.map((info: any, index: number) => {
          return {
            id: `bulk-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
            file: new File([], `${name.replace(/\.[^/.]+$/, "")}_doc_${index + 1}.${name.split('.').pop()}`, { type: mime }),
            previewUrl: base64String.startsWith('data:image') ? base64String : '',
            status: 'completed' as const,
            progress: 'Reconocido multipágina con éxito',
            extractedData: info,
            destinationObraId: selectedObraId === 'all' ? (obras[0]?.id || '') : selectedObraId,
          };
        });
        
        setBulkQueue(prev => [...prev, ...newBulkItems]);
        setModalTab('bulk');
        setOcrSuccessMsg(`¡Hecho! Hemos detectado ${docs.length} documentos independientes en las páginas de "${name}". Los hemos cargado auto-clasificados en la pestaña de Lotes Masivos.`);
        return;
      }

      const info = docs[0];

      // Successfully processed! Let's inject parameters into our Modal Form State
      if (info.type) setDocType(info.type);
      if (info.docNumber) setDocNumber(info.docNumber);
      if (info.supplier) setDocSupplier(info.supplier);
      if (info.date) setDocDate(info.date);
      if (info.ivaRate !== undefined) setDocIvaRate(info.ivaRate);
      if (info.retentionRate !== undefined) setDocRetentionRate(info.retentionRate);
      if (info.notes) setDocNotes(info.notes);
      
      if (info.items && Array.isArray(info.items) && info.items.length > 0) {
        setDocItems(info.items);
      } else if (info.baseAmount) {
        setDocItems([{ name: 'Suministros varios unificados en OCR', quantity: 1, unit: 'ud', price: info.baseAmount, total: info.baseAmount }]);
      }

      setOcrSuccessMsg(`¡Éxito! Gemini ha reconocido el documento "${name}". Hemos cargado las partidas e importes.`);
    } catch (err: any) {
      console.warn('Fallo en Gemini o sin conexión, probando fallback automático a OCR Local Tesseract.js...', err);
      
      // Automatic fallback to local Tesseract OCR
      if (ocrEngineMode === 'auto' || ocrEngineMode === 'local') {
        try {
          setAnalysisProgress('Servidor en la nube inaccesible. Activando OCR Local de contingencia (Tesseract.js en el dispositivo)...');
          const extracted = await scanDocumentLocally(base64String, {
            knownSuppliers: proveedores,
            onProgress: (percent, status) => {
              setAnalysisProgress(`[OCR Local de Contingencia ${percent}%] ${status}`);
            }
          });

          if (extracted.type) setDocType(extracted.type);
          if (extracted.docNumber) setDocNumber(extracted.docNumber);
          if (extracted.supplier) setDocSupplier(extracted.supplier);
          if (extracted.date) setDocDate(extracted.date);
          if (extracted.ivaRate !== undefined) setDocIvaRate(extracted.ivaRate);
          if (extracted.retentionRate !== undefined) setDocRetentionRate(extracted.retentionRate);
          if (extracted.notes) setDocNotes(extracted.notes);
          if (extracted.items && extracted.items.length > 0) {
            setDocItems(extracted.items);
          }

          setOcrSuccessMsg(`¡Completado con OCR Local de Contingencia! Proveedor detectado: ${extracted.supplier}, Total: ${extracted.totalAmount.toFixed(2)}€`);
          return;
        } catch (localFallbackErr: any) {
          console.error(localFallbackErr);
          setErrorMsg(`Error en escaneo: Gemini (${err.message}) y OCR Local (${localFallbackErr.message})`);
          return;
        }
      }

      setErrorMsg(`Error de IA: ${err.message}. Puedes conmutar a "Tesseract OCR Local" para procesar sin internet.`);
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  const handleImportFromGoogleDrive = async (base64String: string, mime: string, name: string) => {
    // Open the single entry modal and reset existing fields
    handleOpenDocModal();
    setDocImageUrl(base64String);
    // Run Gemini OCR extraction
    await analyzeDocumentWithAI(base64String, mime, name);
  };

  const handleImportFromGmail = async (base64String: string, mime: string, name: string) => {
    // Open the single entry modal and reset existing fields
    handleOpenDocModal();
    setDocImageUrl(base64String);
    // Run Gemini OCR extraction
    await analyzeDocumentWithAI(base64String, mime, name);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setDocImageUrl(base64);
      await analyzeDocumentWithAI(base64, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  // --- IA BULK SCAN ENGINE (CARGA MASIVA POR IA) ---
  const handleBulkFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: BulkQueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = `bulk-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
      newItems.push({
        id,
        file,
        previewUrl,
        status: 'pending',
        progress: 'Listo para procesar',
        destinationObraId: selectedObraId === 'all' ? (obras[0]?.id || '') : selectedObraId,
      });
    }

    setBulkQueue(prev => [...prev, ...newItems]);
  };

  const processBulkItem = async (itemId: string, currentQueueState: BulkQueueItem[]) => {
    // Find item
    const targetItem = currentQueueState.find(it => it.id === itemId);
    if (!targetItem) return;

    const effectiveEngine = (ocrEngineMode === 'local' || !navigator.onLine) ? 'local' : ocrEngineMode;

    if (effectiveEngine === 'local') {
      setBulkQueue(prev => prev.map(it => 
        it.id === itemId 
          ? { ...it, status: 'processing', progress: 'Iniciando OCR Local (Tesseract.js)...' } 
          : it
      ));

      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer el archivo físico.'));
          reader.readAsDataURL(targetItem.file);
        });

        const extracted = await scanDocumentLocally(base64Data, {
          knownSuppliers: proveedores,
          onProgress: (percent, status) => {
            setBulkQueue(prev => prev.map(it => 
              it.id === itemId 
                ? { ...it, progress: `[OCR Local ${percent}%] ${status}` } 
                : it
            ));
          }
        });

        setBulkQueue(prev => prev.map(it => 
          it.id === itemId 
            ? { 
                ...it, 
                status: 'completed', 
                progress: `Reconocido con OCR local (Tesseract) - ${extracted.supplier}`,
                extractedData: extracted,
              } 
            : it
        ));
        return;
      } catch (localErr: any) {
        console.error('Error procesando lote en OCR local:', localErr);
        setBulkQueue(prev => prev.map(it => 
          it.id === itemId 
            ? { ...it, status: 'failed', progress: `Error OCR Local: ${localErr.message || 'Fallo de escaneo'}` } 
            : it
        ));
        return;
      }
    }

    setBulkQueue(prev => prev.map(it => 
      it.id === itemId 
        ? { ...it, status: 'processing', progress: 'Iniciando lectura por Gemini...' } 
        : it
    ));

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Error al leer el archivo físico.'));
        reader.readAsDataURL(targetItem.file);
      });

      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

      setBulkQueue(prev => prev.map(it => 
        it.id === itemId 
          ? { ...it, progress: 'Estructurando desglose de partidas y totales...' } 
          : it
      ));

      const response = await authorizedFetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: cleanBase64,
          mimeType: targetItem.file.type,
          filename: targetItem.file.name
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Respuesta de servidor fallida.');
      }

      const info = await response.json();

      setBulkQueue(prev => prev.map(it => 
        it.id === itemId 
          ? { 
              ...it, 
              status: 'completed', 
              progress: 'Reconocido con éxito',
              extractedData: info,
            } 
          : it
      ));
    } catch (err: any) {
      console.warn(`Error procesando lote ${itemId} con Gemini, intentando OCR Local de contingencia:`, err);
      
      // Contingency local OCR
      try {
        setBulkQueue(prev => prev.map(it => 
          it.id === itemId 
            ? { ...it, progress: 'Activando OCR Local de contingencia (Tesseract)...' } 
            : it
        ));

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Error al leer el archivo.'));
          reader.readAsDataURL(targetItem.file);
        });

        const extracted = await scanDocumentLocally(base64Data, {
          knownSuppliers: proveedores,
          onProgress: (percent, status) => {
            setBulkQueue(prev => prev.map(it => 
              it.id === itemId 
                ? { ...it, progress: `[OCR Local ${percent}%] ${status}` } 
                : it
            ));
          }
        });

        setBulkQueue(prev => prev.map(it => 
          it.id === itemId 
            ? { 
                ...it, 
                status: 'completed', 
                progress: `Reconocido con OCR local (contingencia) - ${extracted.supplier}`,
                extractedData: extracted,
              } 
            : it
        ));
      } catch (localFallbackErr: any) {
        setBulkQueue(prev => prev.map(it => 
          it.id === itemId 
            ? { 
                ...it, 
                status: 'failed', 
                progress: `Error: Gemini (${err.message}) y OCR Local (${localFallbackErr.message})`,
              } 
            : it
        ));
      }
    }
  };

  const handleStartBulkProcessing = async () => {
    setIsProcessingBulk(true);
    // Take current pending or failed items
    const snapshotQueue = [...bulkQueue];
    const pendingItems = snapshotQueue.filter(item => item.status === 'pending' || item.status === 'failed');
    
    // Process items sequentially with a short pause to ensure steady progress and respect quota limits
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      await processBulkItem(item.id, snapshotQueue);
      if (i < pendingItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
    setIsProcessingBulk(false);
  };

  const handleRemoveBulkItem = (id: string) => {
    setBulkQueue(prev => prev.filter(it => it.id !== id));
  };

  const handleUpdateBulkDestObra = (id: string, obraId: string) => {
    setBulkQueue(prev => prev.map(it => it.id === id ? { ...it, destinationObraId: obraId } : it));
  };

  const handleUpdateBulkDocType = (id: string, type: 'factura' | 'albaran') => {
    setBulkQueue(prev => prev.map(it => {
      if (it.id === id && it.extractedData) {
        return {
          ...it,
          extractedData: {
            ...it.extractedData,
            type
          }
        };
      }
      return it;
    }));
  };

  const handleImportBulkQueue = () => {
    const completedItems = bulkQueue.filter(it => it.status === 'completed' && it.extractedData);
    if (completedItems.length === 0) return;

    const newDocs: FacturaAlbaran[] = [];

    completedItems.forEach(item => {
      let documentList: any[] = [];
      if (item.extractedData) {
        if (item.extractedData.documents && Array.isArray(item.extractedData.documents)) {
          documentList = item.extractedData.documents;
        } else {
          documentList = [item.extractedData];
        }
      }

      documentList.forEach((ext, idx) => {
        const totalAmount = ext.totalAmount || ext.baseAmount || 0;
        const baseAmount = ext.baseAmount || totalAmount / (1 + (ext.ivaRate || 21) / 100);
        const ivaAmount = ext.ivaAmount || totalAmount - baseAmount;
        newDocs.push({
          id: `doc-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          obraId: item.destinationObraId,
          type: ext.type || 'factura',
          docNumber: ext.docNumber || `NUM-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          supplier: ext.supplier || 'PROVEEDOR EXTRACTO por IA',
          date: ext.date || new Date().toISOString().split('T')[0],
          items: ext.items && ext.items.length > 0 ? ext.items : [
            { name: 'Suministros varios unificados en OCR', quantity: 1, unit: 'ud', price: baseAmount, total: baseAmount }
          ],
          baseAmount,
          ivaRate: ext.ivaRate !== undefined ? ext.ivaRate : 21,
          ivaAmount,
          retentionRate: ext.retentionRate || 0,
          retentionAmount: ext.retentionAmount || 0,
          totalAmount,
          status: 'pending',
          notes: ext.notes || 'Cargado mediante Lector de Lotes por IA.',
        });
      });
    });

    if (newDocs.length === 0) return;

    const updated = [...newDocs, ...documentos];
    saveAllData(obras, updated, personal, gastosGenerales);
    newDocs.forEach(item => dbWrite('documentos', item.id, item, false, 'create', true));
    showAppToast(`✓ Se han guardado ${newDocs.length} documentos correctamente en la base de datos`, 'success');

    // Fire consolidated push notification for the batch import
    sendPushNotification(null, {
      title: `📂 ¡Lote de ${newDocs.length} Documentos Importado!`,
      body: `Se han procesado, indexado y guardado correctamente ${newDocs.length} nuevos documentos mediante el Lector Masivo de Lotes.`,
      type: 'document_import'
    }).catch(err => console.error(err));

    setBulkQueue([]);
    setShowDocModal(false);
  };

  // --- FILTER DOCUMENTOS LIST AND SORT ---
  const getDocCategory = (doc: FacturaAlbaran) => {
    if (doc.category) return doc.category;
    const matchedProv = proveedores.find(p => p.name.trim().toLowerCase() === doc.supplier.trim().toLowerCase());
    return matchedProv?.category || 'Otros Suministros';
  };

  const activeDocsList = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    return documentos.filter(doc => {
      const matchesSearch = !searchLower || 
                            (doc.supplier && doc.supplier.toLowerCase().includes(searchLower)) || 
                            (doc.docNumber && doc.docNumber.toLowerCase().includes(searchLower)) ||
                            (doc.notes && doc.notes.toLowerCase().includes(searchLower));
      
      const matchesObra = selectedObraId === 'all' || doc.obraId === selectedObraId;
      const matchesType = filterDocType === 'all' || doc.type === filterDocType;
      
      const matchesStartDate = !filterStartDate || doc.date >= filterStartDate;
      const matchesEndDate = !filterEndDate || doc.date <= filterEndDate;

      return matchesSearch && matchesObra && matchesType && matchesStartDate && matchesEndDate;
    }).sort((a, b) => {
      let comparison = 0;
      if (docSortBy === 'docNumber') {
        comparison = (a.docNumber || '').localeCompare(b.docNumber || '');
      } else if (docSortBy === 'supplier') {
        comparison = (a.supplier || '').localeCompare(b.supplier || '');
      } else if (docSortBy === 'date') {
        comparison = (a.date || '').localeCompare(b.date || '');
      } else if (docSortBy === 'category') {
        comparison = getDocCategory(a).localeCompare(getDocCategory(b));
      } else if (docSortBy === 'totalAmount') {
        comparison = (Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0);
      }
      return docSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [documentos, searchTerm, selectedObraId, filterDocType, filterStartDate, filterEndDate, docSortBy, docSortOrder, proveedores]);

  // Memoized sum of filtered documents total amount
  const filteredDocsTotalAmount = useMemo(() => {
    return activeDocsList.reduce((sum, doc) => sum + (Number(doc.totalAmount) || 0), 0);
  }, [activeDocsList]);

  // Calculate monthly expenditure evolution of the last semester (Memoized)
  const semesterTrendData = useMemo(() => {
    let maxDate = new Date(2026, 5, 1); // June 2026
    const today = new Date();
    if (today > maxDate) {
      maxDate = today;
    }

    const checkMax = (dateStr: string) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (!isNaN(d.getTime()) && d > maxDate) {
        maxDate = d;
      }
    };
    documentos.forEach(d => checkMax(d.date));
    personal.forEach(p => checkMax(p.date));
    gastosGenerales.forEach(g => checkMax(g.date));

    const semesterData: { key: string; label: string; total: number; facturas: number; personal: number; generales: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(maxDate.getFullYear(), maxDate.getMonth() - i, 1);
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const monthLabel = d.toLocaleString('es-ES', { month: 'short' });
      const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      semesterData.push({
        key: monthKey,
        label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1) + ' ' + year,
        total: 0,
        facturas: 0,
        personal: 0,
        generales: 0,
      });
    }

    // Accumulate documents expenditures
    documentos.forEach(doc => {
      const belongsToObra = selectedObraId === 'all' || doc.obraId === selectedObraId;
      if (!belongsToObra) return;

      const docMonth = doc.date ? doc.date.substring(0, 7) : '';
      const monthObj = semesterData.find(mo => mo.key === docMonth);
      if (monthObj) {
        const val = Number(doc.totalAmount) || 0;
        monthObj.facturas += val;
        monthObj.total += val;
      }
    });

    // Accumulate workers payroll expenditures
    personal.forEach(p => {
      const belongsToObra = selectedObraId === 'all' || p.obraId === selectedObraId;
      if (!belongsToObra) return;

      const pMonth = p.date ? p.date.substring(0, 7) : '';
      const monthObj = semesterData.find(mo => mo.key === pMonth);
      if (monthObj) {
        const val = Number(p.totalCost) || 0;
        monthObj.personal += val;
        monthObj.total += val;
      }
    });

    // Accumulate general company overhead expenditures
    gastosGenerales.forEach(g => {
      if (selectedObraId !== 'all') return;

      const gMonth = g.date ? g.date.substring(0, 7) : '';
      const monthObj = semesterData.find(mo => mo.key === gMonth);
      if (monthObj) {
        const val = Number(g.amount) || 0;
        monthObj.generales += val;
        monthObj.total += val;
      }
    });

    return semesterData;
  }, [documentos, personal, gastosGenerales, selectedObraId]);

  const semesterTrendTotal = useMemo(() => {
    return semesterTrendData.reduce((acc, curr) => acc + curr.total, 0);
  }, [semesterTrendData]);

  // Dedicated Mobile Worker Portal view (Entrada / Salida y firma en smartphone)
  if (isWorkerPortalOpen) {
    return (
      <WorkerPortal
        obras={obras}
        trabajadoresEmpresa={plantillaTrabajadores}
        fichajes={fichajes}
        activeFichajes={activeFichajes}
        onClockIn={handleClockInWorker}
        onClockOut={handleClockOutWorker}
        onExitPortal={() => {
          if (typeof window !== 'undefined' && window.history && window.history.pushState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('portal');
            url.searchParams.delete('mode');
            window.history.pushState({}, '', url.pathname + (url.search ? url.search : ''));
          }
          setIsWorkerPortalOpen(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans flex flex-col" id="applet-viewport">
      {syncStatus === 'error' && <div role="alert" className="m-4 rounded-xl border border-amber-500 bg-slate-900 p-4 text-white">
        <p>No se han podido cargar los datos de obras y costes. Los datos locales se conservan; una falta de permisos no significa que no haya obras.</p>
        {!signedInUser && <button type="button" className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-white" onClick={() => signInWithPopup(auth, googleProvider).catch(() => showAppToast('No se ha podido iniciar sesión con Google.', 'error'))}>Conectar con mi cuenta de Google</button>}
      </div>}

      
      {/* Unified Header & Navigation Bar */}
      <header className="bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/[0.08] sticky top-0 z-40 no-print shadow-md" id="main-branded-header">
        <div className="w-full max-w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-2.5 sm:py-3 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3" id="header-wrapper">
          <div className="flex-1 min-w-0">
            <CompanyHeader compact={true} />
          </div>
          
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 shrink-0" id="header-meta-actions">
            {/* Central Database Live Indicator */}
            <div className="flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 rounded-xl px-2.5 py-1.5 text-xs text-white" id="central-db-indicator">
              <div className="relative">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-[#0A0A0A] animate-ping" />
                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-[#0A0A0A]" />
              </div>
              <span className="hidden lg:inline text-[10px] font-bold text-emerald-400">
                Firestore
              </span>
            </div>

            {/* Live Alarm / Push Notification Center */}
            <NotificationCenter 
              onSelectObra={setSelectedObraId} 
              onSelectTab={setActiveTab}
            />

            {/* Theme Toggle Button (diurno <-> nocturno) */}
            <button
              onClick={() => setTheme(curr => curr === 'dark' ? 'light' : 'dark')}
              className="touch-target text-white/70 hover:text-[#10B981] p-2 rounded-xl hover:bg-white/5 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
              title={theme === 'dark' ? "Cambiar a modo diurno (día)" : "Cambiar a modo nocturno (noche)"}
              id="btn-toggle-theme"
              aria-label="Cambiar tema diurno o nocturno"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-emerald-400" />
                  <span className="hidden xl:inline font-bold text-[11px]">Diurno</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="hidden xl:inline font-bold text-[11px]">Nocturno</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar - Seamlessly integrated under the header */}
        <div
          className={`px-4 sm:px-6 py-2 transition-colors ${
            theme === 'light'
              ? 'bg-gradient-to-r from-slate-50 via-white to-slate-50 border-t border-b border-slate-200 shadow-xs'
              : 'border-t border-white/[0.04] bg-[#09090B]/90'
          }`}
          id="navigation-tabs-bar"
        >
          <div className="w-full max-w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2.5">
            {/* Desktop & Tablet Segmented Tabs */}
            <nav
              className={`flex rounded-xl p-1 overflow-x-auto no-scrollbar w-full md:w-auto shadow-inner items-center gap-1 transition-colors ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-slate-100 to-slate-200/90 border border-slate-300'
                  : 'bg-zinc-900/70 border border-white/[0.06]'
              }`}
              id="apple-tab-nav"
              aria-label="Navegación principal"
            >
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'dashboard'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-black'
                    : theme === 'light'
                    ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80 font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                📊 <span>Resumen</span>
              </button>
              <button
                onClick={() => setActiveTab('obras')}
                className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'obras'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-black'
                    : theme === 'light'
                    ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80 font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                🏗️ <span>Obras</span>
              </button>
              <button
                onClick={() => setActiveTab('documentos')}
                className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'documentos'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-black'
                    : theme === 'light'
                    ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80 font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                🧾 <span>Facturas y Albaranes</span>
              </button>
              <button
                onClick={() => setActiveTab('personal')}
                className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'personal'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-black'
                    : theme === 'light'
                    ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80 font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                👷 <span>Personal</span>
              </button>
              <button
                onClick={() => setActiveTab('control_horario')}
                className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'control_horario'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-black'
                    : theme === 'light'
                    ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80 font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                ⏱️ <span>Control Horario</span>
              </button>
              <button
                onClick={() => setActiveTab('gastos')}
                className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'gastos'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-black'
                    : theme === 'light'
                    ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80 font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                🏢 <span>Gastos Empresa</span>
              </button>
              <button
                onClick={() => setActiveTab('informes')}
                className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'informes'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-black'
                    : theme === 'light'
                    ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80 font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                📝 <span>Informes</span>
              </button>
              <button
                onClick={() => setActiveTab('copias')}
                className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                  activeTab === 'copias'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-black'
                    : theme === 'light'
                    ? 'text-slate-800 hover:text-slate-950 hover:bg-white/80 font-bold'
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                💾 <span>Copias</span>
              </button>

              {/* Direct Worker Mobile Portal Switch */}
              <button
                onClick={() => setIsWorkerPortalOpen(true)}
                className="py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow shrink-0 font-extrabold"
                title="Abrir portal de control horario para operarios en móvil"
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span className="font-extrabold">Portal Operario</span>
                {activeFichajes.length > 0 && (
                  <span className="bg-slate-950 text-emerald-400 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold animate-pulse">
                    {activeFichajes.length}
                  </span>
                )}
              </button>
            </nav>

            {/* Project Focus Filter Selector */}
            <div className="flex gap-2 items-center justify-end shrink-0" id="project-focus-wrap">
              <span className={`text-[11px] uppercase tracking-wider font-extrabold hidden lg:inline ${
                theme === 'light' ? 'text-slate-700' : 'text-white/50'
              }`}>Obra Activa:</span>
              <select
                className={`rounded-xl border text-xs px-3 py-2 font-bold tracking-tight focus:outline-none focus:border-emerald-500/50 shadow-inner cursor-pointer transition-colors w-full md:w-auto ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 border-slate-300 shadow-sm'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 text-white border-white/[0.08]'
                }`}
                value={selectedObraId}
                onChange={(e) => setSelectedObraId(e.target.value)}
                id="obra-focus-selector"
                aria-label="Seleccionar obra en curso"
              >
                <option value="all" className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#0F0F12] text-white'}>Todas las obras unificadas</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id} className={theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#0F0F12] text-white'}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Main Body View Content wrapper with full width for PC displays */}
      <main className="flex-1 w-full max-w-full mx-auto p-4 md:p-6 lg:px-8 xl:px-10 2xl:px-12 space-y-6 pb-24 md:pb-8" id="main-content-viewport">
        {/* Render Dashboard KPI Scorecards if selected dashboard or other than print view / backup */}
        {activeTab !== 'informes' && activeTab !== 'copias' && (
          <div className="no-print" id="dashboard-score-wrap">
            <KPICards 
              selectedObraId={selectedObraId}
              obras={obras}
              documentos={documentos}
              personal={personal}
              gastosGenerales={gastosGenerales}
            />
          </div>
        )}

        {/* --- ROUTING STATES --- */}
        
        {/* A. DASHBOARD EXECUTIVE LANDING VIEW */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn no-print" id="dashboard-landing">
            {/* Left Col: Main Active Site Progression summary */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Obras Progression Progress summary banner */}
              <div className="bg-[#151515] rounded-2xl p-6 border border-white/5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-white/5 pb-4" id="dashboard-progression-header">
                  <div>
                    <h3 className="font-extrabold text-sm text-white uppercase tracking-wider font-display">Progreso y consumo de presupuesto de Obras</h3>
                    <p className="text-[10.5px] text-white/40 mt-1">Comparativa consolidada con repercusión de costes indirectos y estructura general.</p>
                  </div>
                  <button
                    onClick={exportExecutiveReportPDF}
                    disabled={isExportingDashboardPDF}
                    className="bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-white/30 text-black font-extrabold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-300 hover:scale-102 active:scale-98 shadow-md cursor-pointer disabled:cursor-not-allowed shrink-0 font-sans"
                    id="btn-export-executive-report"
                    title="Exportar resumen ejecutivo en PDF de todas las obras y presupuestos"
                  >
                    {isExportingDashboardPDF ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5" />
                        <span>Exportar Informe</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="space-y-4">
                  {obras.length === 0 ? (
                    <div className="text-center py-6 text-white/40 text-xs border border-dashed border-white/10 rounded-xl">
                      No hay proyectos ni obras registrados. Haz clic en "Nueva Obra" para crear tu primer proyecto.
                    </div>
                  ) : (() => {
                    const totalCompanyOverhead = gastosGenerales.reduce((acc, g) => acc + g.amount, 0) +
                                                 personal.filter(p => p.obraId === 'structural').reduce((acc, p) => acc + p.totalCost, 0);
                    const overheadAllocationMap = getObraOverheadAllocationMap(obras, totalCompanyOverhead);

                    return obras.map(obra => {
                      // Calc costs
                      const oDocs = documentos.filter(d => d.obraId === obra.id);
                      const oPers = personal.filter(p => p.obraId === obra.id);
                      const directSpent = oDocs.reduce((acc, d) => acc + d.totalAmount, 0) + oPers.reduce((acc, p) => acc + p.totalCost, 0);
                      const obraOverhead = overheadAllocationMap[obra.id]?.amount || 0;
                      const spent = directSpent + obraOverhead;
                      const percentage = obra.budget > 0 ? (spent / obra.budget) * 100 : 0;
                      
                      return (
                        <div key={obra.id} className="space-y-1.5" id={`progression-obra-${obra.id}`}>
                          <div className="flex justify-between items-center text-xs text-white/70">
                            <strong className="font-bold text-white/90 flex items-center gap-1.5" title={`Presupuesto base de obra. Repercusión de gastos indirectos y estructura general asignada: ${obraOverhead.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`}>
                              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                              {obra.name}
                            </strong>
                            <span className="font-semibold font-mono text-white/90" title={`Costo Materiales/Mano de obra directo: ${directSpent.toLocaleString('es-ES', { maximumFractionDigits: 0 })} € | Repercutido general empresa: ${obraOverhead.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`}>
                              {spent.toLocaleString('es-ES', { maximumFractionDigits: 0 })} € / {obra.budget.toLocaleString('es-ES', { maximumFractionDigits: 0 })} € ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${percentage > 95 ? 'bg-red-500' : percentage > 75 ? 'bg-[#10B981]' : 'bg-[#10B981]/80'}`}
                              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Evolución del Gasto Mensual (Último Semestre) */}
              <div className="bg-[#151515] rounded-2xl p-6 border border-white/5 shadow-sm" id="dashboard-monthly-expenditure-card">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#10B981]" />
                      Evolución del Gasto Mensual
                    </h3>
                    <p className="text-[10.5px] text-white/50 mt-1">
                      {selectedObraId === 'all' 
                        ? 'Consolidado global de la empresa (último semestre)' 
                        : `Filtrado por proyecto: ${obras.find(o => o.id === selectedObraId)?.name || ''}`}
                    </p>
                  </div>
                  
                  {/* Status / Quick details */}
                  <div className="text-right">
                    <span className="text-[10px] text-white/40 block">Total en el semestre</span>
                    <span className="text-sm font-black font-mono text-[#10B981]">
                      {semesterTrendTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <div className="w-full h-[260px] pr-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={semesterTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        stroke="rgba(255,255,255,0.4)" 
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="font-mono text-[9px]"
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.4)"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${(v).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`}
                        className="font-mono text-[9px]"
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[#1A1A1C] border border-white/10 p-3 rounded-xl shadow-2xl text-[10.5px] space-y-1.5 text-left font-sans text-white">
                                <p className="font-bold text-white border-b border-white/5 pb-1 flex items-center gap-1.5 text-[11px] mb-1">
                                  <span className="text-[#10B981]">📅</span> {label}
                                </p>
                                <div className="flex justify-between items-center gap-6">
                                  <span className="text-white/60 font-medium font-sans">Facturas/Albaranes:</span>
                                  <span className="font-mono font-bold text-amber-400">
                                    {data.facturas.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center gap-6">
                                  <span className="text-white/60 font-medium font-sans">Mano de Obra (Personal):</span>
                                  <span className="font-mono font-bold text-sky-400">
                                    {data.personal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                                {selectedObraId === 'all' && (
                                  <div className="flex justify-between items-center gap-6">
                                    <span className="text-white/60 font-medium font-sans">Gastos de Estructura:</span>
                                    <span className="font-mono font-bold text-violet-400">
                                      {data.generales.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center gap-6 border-t border-white/5 pt-1.5 mt-1 font-bold">
                                  <span className="text-white/80 font-sans font-bold">Gasto Total:</span>
                                  <span className="font-mono text-[#10B981] text-[11.5px] font-black">
                                    {data.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="total" 
                        stroke="#10B981" 
                        strokeWidth={3} 
                        dot={{ r: 4, strokeWidth: 1.5, fill: '#151515', stroke: '#10B981' }}
                        activeDot={{ r: 6, strokeWidth: 2, fill: '#10B981', stroke: '#ffffff' }} 
                        animationDuration={600}
                        name="Gasto Total"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick action helper summary log */}
              <div className="bg-[#151515] rounded-2xl p-6 border border-white/5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-white/5 rounded-xl p-4 hover:bg-white/5 transition-colors flex items-start gap-3">
                  <div className="bg-[#10B981]/10 text-[#10B981] p-2.5 rounded-xl shrink-0"><Receipt className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-bold text-xs text-white/90">Cargar Factura o Albarán</h4>
                    <p className="text-[10.5px] text-white/50 mt-1">Someter y escanear digitalmente documentos utilizando Inteligencia Artificial.</p>
                    <button onClick={() => { setActiveTab('documentos'); handleOpenDocModal(); }} className="text-[#10B981] hover:text-[#10B981]/80 font-bold text-[10.5px] mt-2 block hover:underline text-left cursor-pointer">Ejecutar OCR →</button>
                  </div>
                </div>

                <div className="border border-white/5 rounded-xl p-4 hover:bg-white/5 transition-colors flex items-start gap-3">
                  <div className="bg-[#10B981]/10 text-[#10B981] p-2.5 rounded-xl shrink-0"><Clock className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-bold text-xs text-white/90">Control Horario y Fichajes</h4>
                    <p className="text-[10.5px] text-white/50 mt-1">Firma digital manuscrita con registro legal RDL 8/2019 e imputación automática a obras.</p>
                    <button onClick={() => setActiveTab('control_horario')} className="text-[#10B981] hover:text-[#10B981]/80 font-bold text-[10.5px] mt-2 block hover:underline text-left cursor-pointer">Abrir Terminal →</button>
                  </div>
                </div>

                <div className="border border-white/5 rounded-xl p-4 hover:bg-white/5 transition-colors flex items-start gap-3">
                  <div className="bg-[#10B981]/10 text-[#10B981] p-2.5 rounded-xl shrink-0"><Users className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-bold text-xs text-white/90">Partes de Personal</h4>
                    <p className="text-[10.5px] text-white/50 mt-1">Registrar horas trabajadas y especialidades de los oficiales o subcontratas.</p>
                    <button onClick={() => setActiveTab('personal')} className="text-[#10B981] hover:text-[#10B981]/80 font-bold text-[10.5px] mt-2 block hover:underline text-left cursor-pointer">Ingresar partes →</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Late documents summary table */}
            <div className="bg-[#151515] rounded-2xl p-6 border border-white/5 shadow-sm flex flex-col justify-between" id="dashboard-right-sidebar">
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider mb-4">Últimos documentos ingresados</h3>
                <div className="space-y-3.5">
                  {documentos.slice(0, 4).map(doc => {
                    const oName = obras.find(o => o.id === doc.obraId)?.name || 'Sin obra';
                    return (
                      <div key={doc.id} className="flex justify-between items-start gap-2 border-b border-white/5 pb-3 last:border-0 last:pb-0 text-xs">
                        <div>
                          <strong className="font-bold text-white/80 block truncate max-w-[150px]">{doc.supplier}</strong>
                          <span className="text-[10px] text-white/40 block mt-0.5">{doc.type.toUpperCase()} • {doc.docNumber}</span>
                          <span className="text-[10px] text-white/50 block underline truncate max-w-[140px] mt-0.5">{oName}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold block text-white/90 font-mono">{doc.totalAmount.toFixed(2)} €</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <button
                onClick={() => setActiveTab('informes')}
                className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-lg transition-colors"
              >
                Ver Justificación de Gasto Completa
              </button>
            </div>
          </div>
        )}

        {/* B. OBRAS (CONSTRUCTION WORKS MANAGER) */}
        {activeTab === 'obras' && (
          <div className="animate-fadeIn no-print">
            <ObrasManager 
              obras={obras}
              documentos={documentos}
              personal={personal}
              proveedores={proveedores}
              trabajadores={trabajadores}
              addObra={handleAddObra}
              deleteObra={handleDeleteObra}
              updateObra={handleUpdateObra}
              onImportComplete={handleImportObraComplete}
              userEmail={null}
            />
          </div>
        )}

        {/* C. GASTOS DE PERSONAL DE OBRAS LOGS */}
        {activeTab === 'personal' && (
          <div className="animate-fadeIn no-print">
            <PersonalManager 
              personal={personal}
              obras={obras}
              trabajadoresEmpresa={plantillaTrabajadores}
              addPersonal={handleAddPersonal}
              deletePersonal={handleDeletePersonal}
              updatePersonal={handleUpdatePersonal}
              addTrabajadorEmpresa={handleAddTrabajadorEmpresa}
              updateTrabajadorEmpresa={handleUpdateTrabajadorEmpresa}
              deleteTrabajadorEmpresa={handleDeleteTrabajadorEmpresa}
              importTrabajadoresEmpresa={handleImportTrabajadoresEmpresa}
            />
          </div>
        )}

        {/* C2. CONTROL HORARIO & REGISTRO DE JORNADAS CON FIRMA LEGAL (RDL 8/2019) */}
        {activeTab === 'control_horario' && (
          <div className="animate-fadeIn no-print">
            <ControlHorarioManager 
              fichajes={fichajes}
              obras={obras}
              trabajadoresEmpresa={plantillaTrabajadores}
              personal={personal}
              onSaveFichaje={handleSaveFichaje}
              onDeleteFichaje={handleDeleteFichaje}
              onUpdateFichaje={handleSaveFichaje}
              onApproveFichaje={handleApproveFichaje}
              onBatchApproveFichajes={handleBatchApproveFichajes}
              onRejectFichaje={handleRejectFichaje}
              selectedObraId={selectedObraId}
              onNavigateToObra={(oId) => {
                setSelectedObraId(oId);
                setActiveTab('obras');
              }}
              activeFichajes={activeFichajes}
              onOpenWorkerPortal={() => setIsWorkerPortalOpen(true)}
            />
          </div>
        )}

        {/* D. OTROS GASTOS DE EMPRESA OVERHEAD */}
        {activeTab === 'gastos' && (
          <div className="animate-fadeIn no-print">
            <OtrosGastosManager 
              gastosGenerales={gastosGenerales}
              addGasto={handleAddGasto}
              addGastosBatch={handleAddGastosBatch}
              deleteGasto={handleDeleteGasto}
              updateGasto={handleUpdateGasto}
              obras={obras}
              updateObra={handleUpdateObra}
            />
          </div>
        )}

        {/* E. DOCUMENT CONTROLLS & INVOICES BILLING AUDIT (CORE COMPONENT) */}
        {activeTab === 'documentos' && (
          <div className="space-y-6 animate-fadeIn no-print" id="documentos-view-wrapper">
            
            {/* Action panel uploader */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" id="docs-top-meta">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">Facturas y Albaranes</h2>
                <p className="text-xs text-white/50">Gestione recibos, notas de entrega, verifique líneas de material y ejecute la carga digital masiva por IA.</p>
              </div>

              <div className="flex flex-wrap gap-2" id="docs-action-buttons-wrap">
                <button
                  onClick={() => { setShowDrive(!showDrive); setShowGmail(false); }}
                  className={`py-2.5 px-4 rounded-xl shadow-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer border ${
                    showDrive 
                      ? 'bg-[#10B981] hover:bg-[#10B981]/90 border-[#10B981] text-black font-black' 
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                  }`}
                  id="btn-toggle-drive-explorer"
                >
                  <Cloud className="w-4 h-4" />
                  {showDrive ? 'Cerrar Google Drive' : '📂 Examinar Google Drive'}
                </button>

                <button
                  onClick={() => { setShowGmail(!showGmail); setShowDrive(false); }}
                  className={`py-2.5 px-4 rounded-xl shadow-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer border ${
                    showGmail 
                      ? 'bg-[#10B981] hover:bg-[#10B981]/90 border-[#10B981] text-black font-black' 
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white'
                  }`}
                  id="btn-toggle-gmail-explorer"
                >
                  <Mail className="w-4 h-4" />
                  {showGmail ? 'Cerrar Gmail' : '📧 Buscar en Gmail'}
                </button>

                <button
                  onClick={() => {
                    handleOpenDocModal();
                    setModalTab('single');
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-lg text-xs border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
                  id="btn-open-doc-add-modal"
                >
                  <Plus className="w-4 h-4 text-white" />
                  Ingreso Individual
                </button>

                <button
                  onClick={() => {
                    handleOpenDocModal();
                    setModalTab('bulk');
                  }}
                  className="bg-[#10B981] hover:bg-[#10B981]/95 text-black font-extrabold py-2.5 px-4 rounded-xl shadow-lg text-xs flex items-center gap-2 transition-all cursor-pointer"
                  id="btn-open-doc-bulk-modal"
                >
                  <Sparkles className="w-4 h-4 text-black" />
                  📷 Carga Masiva por IA (Lote)
                </button>
              </div>
            </div>

            {/* DUPLICATE DETECTION WARNING BANNER */}
            {duplicatesGrouped.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fadeIn" id="duplicates-warning-banner">
                <div className="flex items-start gap-3">
                  <div className="bg-amber-500/20 p-2 rounded-xl text-amber-400 font-extrabold text-sm shrink-0">
                    ⚠️
                  </div>
                  <div>
                    <h4 className="text-white font-extrabold text-xs">¡Atención! Documentos duplicados detectados</h4>
                    <p className="text-[11px] text-white/60 mt-0.5">
                      Se han detectado <strong className="text-amber-400 font-bold">{duplicatesGrouped.length} grupos</strong> de facturas o albaranes repetidos.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                  <button
                    onClick={() => setOpenDuplicatesConsole(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/15"
                  >
                    🔍 Resolver Duplicados
                  </button>
                </div>
              </div>
            )}

            {/* Google Drive Integrated UI Browser overlay */}
            {showDrive && (
              <div className="animate-fadeIn" id="drive-explorer-container">
                <GoogleDriveExplorer 
                  onImportDocument={handleImportFromGoogleDrive} 
                  isProcessing={isAnalyzing} 
                />
              </div>
            )}

            {/* Gmail Integrated UI Inbox Browser overlay */}
            {showGmail && (
              <div className="animate-fadeIn" id="gmail-explorer-container">
                <GmailExplorer 
                  onImportDocument={handleImportFromGmail} 
                  isProcessing={isAnalyzing} 
                />
              </div>
            )}

            {/* Main table listings column - Demo panel removed */}
            <div className="space-y-4 w-full">
              {/* Search & filters tools */}
              <div className="bg-[#151515] rounded-2xl p-4 border border-white/5 shadow-sm flex flex-col gap-4" id="docs-table-filters">
                  <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                    
                    <div className="relative flex-1" id="doc-search-input-wrap">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Buscar por emisor, CIF, número de documento..."
                        className="w-full bg-white/5 rounded-xl border border-white/10 pl-10 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:bg-white/10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3" id="doc-type-pills-filter-row">
                      <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10" id="doc-type-pills-filter">
                        <button
                          onClick={() => setFilterDocType('all')}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filterDocType === 'all' ? 'bg-[#10B981] text-black shadow-md font-extrabold' : 'text-white/65 hover:text-white'
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => setFilterDocType('factura')}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filterDocType === 'factura' ? 'bg-[#10B981] text-black shadow-md font-extrabold' : 'text-white/65 hover:text-white'
                          }`}
                        >
                          Facturas
                        </button>
                        <button
                          onClick={() => setFilterDocType('albaran')}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filterDocType === 'albaran' ? 'bg-[#10B981] text-black shadow-md font-extrabold' : 'text-white/65 hover:text-white'
                          }`}
                        >
                          Albaranes
                        </button>
                      </div>

                      {/* DYNAMIC SUM OF FILTERED DOCUMENTS */}
                      <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2" id="docs-filtered-totals-pill">
                        <div className="text-left">
                          <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block">Total Filtrado ({activeDocsList.length})</span>
                          <strong className="text-sm font-black text-amber-500 font-mono block">
                            {filteredDocsTotalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </strong>
                        </div>
                      </div>

                      {/* BOTÓN EXPORTAR EXCEL / CSV */}
                      <button
                        type="button"
                        onClick={handleExportCSV}
                        disabled={activeDocsList.length === 0}
                        className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-black transition-all shadow-sm border cursor-pointer select-none ${
                          activeDocsList.length === 0
                            ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed opacity-50'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-[#10B981] hover:scale-[1.01] active:scale-[0.99]'
                        }`}
                        title={activeDocsList.length === 0 ? "No hay documentos para exportar" : "Exportar listado a Excel/CSV"}
                        id="btn-export-docs-csv"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span>Exportar Excel/CSV</span>
                      </button>

                      {/* BOTÓN EXPORTAR PDF */}
                      <button
                        type="button"
                        onClick={handleExportPDF}
                        disabled={activeDocsList.length === 0}
                        className={`flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-black transition-all shadow-sm border cursor-pointer select-none ${
                          activeDocsList.length === 0
                            ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed opacity-50'
                            : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-400 hover:scale-[1.01] active:scale-[0.99]'
                        }`}
                        title={
                          activeDocsList.length === 0 
                            ? "No hay documentos para exportar" 
                            : selectedDocIds.length > 0 
                              ? `Exportar PDF (${selectedDocIds.length} seleccionados)` 
                              : "Exportar listado completo (filtrado) a PDF"
                        }
                        id="btn-export-docs-pdf"
                      >
                        <Download className="w-4 h-4 text-rose-400" />
                        <span>
                          {selectedDocIds.length > 0 
                            ? `Exportar PDF (${selectedDocIds.length})` 
                            : "Exportar PDF"}
                        </span>
                      </button>
                    </div>

                  </div>

                  {/* Date Range Selector Row */}
                  <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center justify-between gap-4 border-t border-white/[0.04] pt-4" id="docs-date-range-filters">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                      <span className="text-xs font-extrabold text-white/40 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                        Rango de Fechas:
                      </span>
                      
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                          <input
                            type="date"
                            className="bg-white/5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 w-full select-none cursor-pointer"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            title="Fecha de inicio"
                          />
                        </div>
                        <span className="text-white/30 text-xs font-bold px-0.5">a</span>
                        <div className="relative flex-1 sm:flex-none">
                          <input
                            type="date"
                            className="bg-white/5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50 w-full select-none cursor-pointer"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            title="Fecha de fin"
                          />
                        </div>
                      </div>

                      {/* Clear Dates Button */}
                      {(filterStartDate || filterEndDate) && (
                        <button
                          onClick={() => {
                            setFilterStartDate('');
                            setFilterEndDate('');
                          }}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/75 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1 shrink-0"
                          title="Limpiar filtro de fechas"
                        >
                          <span>Limpiar</span>
                          <span className="text-[10px] opacity-60">✕</span>
                        </button>
                      )}
                    </div>

                    {/* Pre-set Quick Ranges (e.g. Este mes, Mes anterior, Este año, Todo) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                          setFilterStartDate(start);
                          setFilterEndDate(end);
                        }}
                        className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                          filterStartDate && filterEndDate && 
                          filterStartDate === new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
                            ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/35'
                            : 'bg-white/[0.02] text-white/50 border-white/[0.05] hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        Este mes
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
                          const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
                          setFilterStartDate(start);
                          setFilterEndDate(end);
                        }}
                        className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                          filterStartDate && filterEndDate &&
                          filterStartDate === new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0]
                            ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/35'
                            : 'bg-white/[0.02] text-white/50 border-white/[0.05] hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        Mes anterior
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                          const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
                          setFilterStartDate(start);
                          setFilterEndDate(end);
                        }}
                        className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                          filterStartDate && filterEndDate &&
                          filterStartDate === new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
                            ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/35'
                            : 'bg-white/[0.02] text-white/50 border-white/[0.05] hover:text-white hover:bg-white/[0.04]'
                        }`}
                      >
                        Este año
                      </button>
                    </div>
                  </div>

                </div>

                {/* Bulk deletion/action console if selections exist */}
                {selectedDocIds.length > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 flex justify-between items-center transition-all animate-slideUp text-white" id="docs-mass-actions-bar">
                    <div className="flex items-center gap-3">
                      <span className="text-rose-400 font-extrabold text-xs">⚠️ ACCIONES EN LOTE:</span>
                      <span className="text-xs font-semibold text-rose-100">Tenemos {selectedDocIds.length} documentos seleccionados</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedDocIds([])}
                        className="bg-white/5 hover:bg-white/10 hover:text-white transition-all text-white/70 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                      >
                        Deseleccionar todo
                      </button>
                      <button
                        onClick={handleMassDeleteDocuments}
                        className="bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all text-white font-black px-4 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                        id="btn-mass-delete-docs"
                      >
                        🗑️ Borrar Seleccionados ({selectedDocIds.length})
                      </button>
                    </div>
                  </div>
                )}

                {/* Documents list table (Virtualized for high performance) */}
                <VirtualizedDocsTable
                  documents={activeDocsList}
                  obras={obras}
                  proveedores={proveedores}
                  selectedDocIds={selectedDocIds}
                  docSortBy={docSortBy}
                  docSortOrder={docSortOrder}
                  onSort={handleDocSort}
                  onToggleSelectDoc={handleToggleSelectDoc}
                  onToggleSelectAll={handleToggleSelectAllDocs}
                  onOpenDocModal={handleOpenDocModal}
                  onDeleteDoc={handleDeleteDocumento}
                  onViewFullscreen={(imageUrl, title) => {
                    setFullscreenImageUrl(imageUrl);
                    setFullscreenTitle(title);
                    setFullscreenZoom(1);
                    setFullscreenRotation(0);
                  }}
                />
              </div>

          </div>
        )}

        {/* F. FORMAL JUSTIFICATION FINANCES REPORT VIEWER SHEET */}
        {activeTab === 'informes' && (
          <div className="animate-fadeIn">
            <ReportViewer 
              selectedObraId={selectedObraId}
              obras={obras}
              documentos={documentos}
              personal={personal}
              gastosGenerales={gastosGenerales}
            />
          </div>
        )}

        {/* G. GLOBAL BACKUP & CLOUD RESTORE SYSTEM */}
        {activeTab === 'copias' && (
          <div className="animate-fadeIn no-print">
            <BackupManager 
              obras={obras}
              documentos={documentos}
              personal={personal}
              gastosGenerales={gastosGenerales}
              proveedores={proveedores}
              trabajadores={trabajadores}
              trabajadoresEmpresa={plantillaTrabajadores}
              onRestoreComplete={handleRestoreComplete}
              userEmail={null}
              lastDriveSyncTime={lastDriveSyncTime}
              driveSyncStatus={driveSyncStatus}
              onManualDriveSync={handleManualDriveSync}
            />
          </div>
        )}

      </main>

      {/* 4. MASTER ADD/EDIT DOCUMENT MODAL (WITH LIVE DRAG-DROP AND AI OCR CONSOLE) */}
      {showDocModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto no-print animate-fadeIn" id="doc-modal-overlay">
          <div className={`bg-white rounded-3xl border border-slate-100 shadow-2xl w-full ${(docImageUrl || (!docId && modalTab === 'bulk')) ? 'max-w-6xl' : 'max-w-4xl'} max-h-[90vh] overflow-y-auto font-sans text-xs flex flex-col`} id="doc-modal-body">
            
            {/* Modal header */}
            <div className="border-b border-slate-100 px-6 py-4 flex justify-between items-center bg-slate-50 rounded-t-3xl" id="doc-modal-header">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-amber-500" />
                  {docId ? 'Editar Detalle de Factura/Albarán' : 'Carga Digital Inteligente de Facturas y Albaranes'}
                </h3>
                <p className="text-[10px] text-slate-500 leading-normal">Ingrese datos manualmente o use el lector de IA Gemini para absorber digitalmente toda la información.</p>
              </div>
              <button
                onClick={() => setShowDocModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
                id="btn-close-modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Tab Switcher (solo para altas nuevas, no en edición directo) */}
            {!docId && (
              <div className="flex border-b border-slate-100 px-6 bg-slate-50/50 shrink-0" id="doc-modal-tab-switcher">
                <button
                  type="button"
                  onClick={() => setModalTab('single')}
                  className={`py-3 px-4 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    modalTab === 'single'
                      ? 'border-amber-500 text-slate-900 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Carga Individual / Formulario
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('bulk')}
                  className={`py-3 px-4 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    modalTab === 'bulk'
                      ? 'border-amber-500 text-slate-900 font-black'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Carga Masiva por Lotes de IA
                </button>
              </div>
            )}

            {modalTab === 'bulk' && !docId ? (
              // MULTI-FILE BULK LOADER SCREEN
              <div className="p-6 space-y-6 flex-1 flex flex-col min-h-[400px]" id="bulk-loader-tab-content">
                
                {/* OCR Engine & Offline Status Bar for Bulk Processing */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-[11px]">
                      <Cpu className="w-3.5 h-3.5 text-emerald-500" />
                      Motor de Lotes:
                    </span>
                    <div className="inline-flex p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setOcrEngineMode('auto')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          ocrEngineMode === 'auto'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                        title="Usa Gemini y conmuta automáticamente a Tesseract si no hay red"
                      >
                        Auto (Recomendado)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOcrEngineMode('gemini')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          ocrEngineMode === 'gemini'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                        title="Usa Gemini IA en la nube"
                      >
                        Gemini Nube
                      </button>
                      <button
                        type="button"
                        onClick={() => setOcrEngineMode('local')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          ocrEngineMode === 'local'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                        title="Procesa localmente con Tesseract.js (100% offline)"
                      >
                        Tesseract Local (Offline)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOnline ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <Wifi className="w-3 h-3" />
                        Conectado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse">
                        <WifiOff className="w-3 h-3 text-amber-600" />
                        Sin conexión (Lotes por Tesseract)
                      </span>
                    )}
                  </div>
                </div>

                {/* Drag and Drop Zone + Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="bulk-controls-row">
                  <div className="md:col-span-2 border-2 border-dashed border-emerald-500/40 rounded-3xl p-6 text-center bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors flex flex-col items-center justify-center relative min-h-[160px]" id="bulk-drop-zone">
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={handleBulkFilesSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-[0px]"
                    />
                    <Sparkles className="w-10 h-10 text-emerald-500 mb-2 shrink-0 animate-pulse" />
                    <span className="font-extrabold text-slate-800 text-sm block">Subir varios archivos a la vez para lectura por Lotes</span>
                    <span className="text-[11px] text-slate-400 mt-1 block">Selecciona o arrastra imágenes, fotos o PDFs. Soporta reconocimiento multipágina.</span>
                  </div>

                  {/* Bulk Actions Console Sidebar */}
                  <div className="bg-slate-950 text-white rounded-3xl p-5 flex flex-col justify-between border border-slate-800 space-y-4 shadow-xl" id="bulk-actions-sheet">
                    <div>
                      <span className="text-[10px] font-sans font-black text-emerald-400 uppercase tracking-wider block">Terminal de Cola Masiva</span>
                      <p className="text-slate-400 text-[10px] leading-relaxed mt-1.5">
                        Sube todos tus documentos de obra juntos. Gemini procesará cada página por separado extrayendo facturas y albaranes de forma independiente.
                      </p>
                    </div>

                    <div className="space-y-2">
                       {bulkQueue.length > 0 && (
                          <button
                            type="button"
                            disabled={isProcessingBulk}
                            onClick={handleStartBulkProcessing}
                            className={`w-full font-extrabold py-2.5 px-4 rounded-xl shadow-md text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              isProcessingBulk 
                                ? 'bg-slate-800 text-slate-500' 
                                : 'bg-[#10B981] hover:bg-[#10B981]/90 text-black'
                            }`}
                          >
                            {isProcessingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : '🚀'}
                            {isProcessingBulk ? 'Procesando con IA...' : 'Iniciar Reconocimiento por IA'}
                          </button>
                       )}
                    </div>
                  </div>
                </div>

                {/* Queue display list */}
                {bulkQueue.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-3xl p-10 text-slate-400 text-center min-h-[255px]" id="bulk-empty-state">
                    <FileUp className="w-12 h-12 text-slate-300 mb-3" />
                    <span className="font-bold text-slate-700 block text-xs">La lista de procesamiento está vacía</span>
                    <p className="text-[10px] text-slate-400 max-w-sm mt-1 leading-normal">
                      Arrastra archivos pdf o imágenes arriba, o haz clic en la caja para cargar varias facturas o albaranes a la vez.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" id="bulk-queue-items-wrapper">
                    <div className="flex justify-between items-center bg-slate-100 rounded-xl px-4 py-2 font-mono text-[10px] text-slate-500 font-bold">
                      <span>DOCUMENTOS EN COLA DE ESPERA: {bulkQueue.length}</span>
                      <button
                        type="button"
                        onClick={() => setBulkQueue([])}
                        className="text-red-500 hover:underline cursor-pointer"
                      >
                        Limpiar todo
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 max-h-[450px] overflow-y-auto pr-1" id="bulk-cards-grid">
                      {bulkQueue.map((item) => {
                        const statusColors = {
                          pending: 'border-slate-200 bg-white text-slate-650',
                          processing: 'border-amber-300 bg-amber-500/5 text-amber-600 animate-pulse',
                          completed: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-705',
                          failed: 'border-rose-300 bg-rose-500/5 text-rose-705'
                        };

                        // Support new array of docs inside item.extractedData
                        let extractedDocs: any[] = [];
                        if (item.extractedData) {
                          if (item.extractedData.documents && Array.isArray(item.extractedData.documents)) {
                            extractedDocs = item.extractedData.documents;
                          } else {
                            extractedDocs = [item.extractedData];
                          }
                        }

                        return (
                          <div 
                            key={item.id} 
                            className={`border-2 rounded-2xl p-4 transition-all flex flex-col gap-3 ${statusColors[item.status]}`}
                            id={`bulk-item-card-${item.id}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <span className="text-[18px] bg-slate-150 p-2 rounded-xl" id="bulk-doc-icon">📄</span>
                                <div className="text-left">
                                  <strong className="text-slate-900 font-extrabold text-[12px] block break-all">{item.file.name}</strong>
                                  <span className="text-[9.5px] text-slate-500 font-mono block">
                                    Tamaño: {(item.file.size / 1024).toFixed(1)} KB | Tipo: {item.file.type || 'Fichero'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5" id="bulk-item-actions">
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                                  item.status === 'processing' ? 'bg-amber-500/12 text-amber-500' :
                                  item.status === 'failed' ? 'bg-rose-500/10 text-rose-600' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {item.status === 'completed' ? 'Reconocido' :
                                   item.status === 'processing' ? 'Procesando' :
                                   item.status === 'failed' ? 'Error' : 'Pendiente'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBulkItem(item.id)}
                                  className="text-slate-350 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-[14px]"
                                  title="Remover de la cola"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            {/* Real-time progress label */}
                            <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-slate-500 border-t border-slate-100 pt-2.5">
                              {item.status === 'processing' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                              <span>Log: {item.progress}</span>
                            </div>

                            {/* Extracted overview / adjustments forms if completed */}
                            {item.status === 'completed' && extractedDocs.length > 0 && (
                              <div className="bg-slate-50/85 rounded-xl p-3 border border-slate-150 space-y-3 mt-1.5 text-slate-800" id="bulk-result-preview-panel">
                                <div className="text-[9.5px] uppercase font-bold text-[#10B981] flex items-center gap-1">
                                  <span>✨ Reconocimiento Finalizado ({extractedDocs.length} {extractedDocs.length > 1 ? 'documentos' : 'documento'} encontrados):</span>
                                </div>
                                
                                <div className="divide-y divide-slate-150 space-y-3 col-span-12">
                                  {extractedDocs.map((ext, idx) => {
                                    const computedTotal = ext.totalAmount || ext.baseAmount || 0;
                                    return (
                                      <div key={idx} className="pt-2.5 first:pt-0 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center" id={`extracted-doc-sub-item-${idx}`}>
                                        <div className="sm:col-span-3">
                                          <label className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Tipo Docs {extractedDocs.length > 1 && `#${idx + 1}`}</label>
                                          <select
                                            className="w-full bg-white rounded border border-slate-205 p-1 text-[10.5px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            value={ext.type || 'factura'}
                                            onChange={(e) => {
                                              // Handle updating the specifically indexed sub-document type
                                              setBulkQueue(prev => prev.map(it => {
                                                if (it.id === item.id && it.extractedData) {
                                                  const dList = it.extractedData.documents && Array.isArray(it.extractedData.documents) 
                                                    ? [...it.extractedData.documents] 
                                                    : [{...it.extractedData}];
                                                  dList[idx] = { ...dList[idx], type: e.target.value === 'albaran' ? 'albaran' : 'factura' };
                                                  return { ...it, extractedData: { ...it.extractedData, documents: dList, type: e.target.value === 'albaran' ? 'albaran' : 'factura' } };
                                                }
                                                return it;
                                              }));
                                            }}
                                          >
                                            <option value="factura">Factura</option>
                                            <option value="albaran">Albarán</option>
                                          </select>
                                        </div>

                                        <div className="sm:col-span-4">
                                          <label className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Emisor Proveedor</label>
                                          <span className="font-bold text-slate-800 text-[11px] block truncate" title={ext.supplier || 'N/D'}>
                                            {ext.supplier || 'Proveedor Desconocido'}
                                          </span>
                                        </div>

                                        <div className="sm:col-span-3">
                                          <label className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5">Nº / Fecha</label>
                                          <span className="font-mono text-slate-700 text-[10px] block truncate">
                                            {ext.docNumber || 'S/N'} ({ext.date || 'Sin fecha'})
                                          </span>
                                        </div>

                                        <div className="sm:col-span-2 text-right">
                                          <label className="block text-[9px] uppercase font-bold text-slate-400 mb-0.5 text-right">Monto Total</label>
                                          <span className="font-mono text-[11px] text-slate-900 font-extrabold block">
                                            {computedTotal.toFixed(2)} €
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Obra select and customization fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-105 pt-3 mt-1" id="bulk-item-obra-assign">
                                  <div className="text-left">
                                    <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Destinar a Obra Proyecto *</label>
                                    <select
                                      className="w-full bg-white rounded border border-slate-205 p-1.5 text-[10.5px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                      value={item.destinationObraId}
                                      onChange={(e) => handleUpdateBulkDestObra(item.id, e.target.value)}
                                    >
                                      <option value="" disabled>Seleccionar obra...</option>
                                      {obras.map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex flex-col justify-end text-right text-[10px] text-slate-400">
                                    <span>Partidas encontradas: {extractedDocs.reduce((acc, d) => acc + (d.items?.length || 0), 0)}</span>
                                    <span className="text-[#10B981] font-bold mt-1">Listo para ser importado</span>
                                  </div>
                                </div>

                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>

                    {/* Import / Final Save control bar for bulk */}
                    <div className="border-t border-slate-100 pt-4 flex justify-between items-center bg-slate-50 px-4 py-3.5 rounded-2xl" id="bulk-submit-row">
                      <span className="text-[10px] text-slate-500 font-bold">
                        IMPORTAR COLA: {bulkQueue.filter(it => it.status === 'completed').length} de {bulkQueue.length} listos
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDocModal(false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-5 rounded-xl text-xs cursor-pointer"
                        >
                          Cerrar panel
                        </button>
                        <button
                          type="button"
                          onClick={handleImportBulkQueue}
                          disabled={bulkQueue.filter(it => it.status === 'completed').length === 0}
                          className={`font-black py-2 px-6 rounded-xl text-xs shadow-md transition-all cursor-pointer ${
                            bulkQueue.filter(it => it.status === 'completed').length === 0
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                          }`}
                          id="btn-confirm-bulk-import"
                        >
                          Importar lotes procesados
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              // Modal Content container wrapper
              <div className="p-6 space-y-6 flex-1" id="doc-modal-scroll-area">
              
              {/* OCR Uploader Panel - hide on edit */}
              {!docId && (
                <div className="space-y-3" id="ocr-uploader-row">
                  {/* OCR Engine & Offline Status Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-[11px]">
                        <Cpu className="w-3.5 h-3.5 text-amber-500" />
                        Motor OCR:
                      </span>
                      <div className="inline-flex p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setOcrEngineMode('auto')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            ocrEngineMode === 'auto'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                          title="Usa Gemini con conexión y conmuta automáticamente a Tesseract.js si estás desconectado"
                        >
                          Auto (Recomendado)
                        </button>
                        <button
                          type="button"
                          onClick={() => setOcrEngineMode('gemini')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            ocrEngineMode === 'gemini'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                          title="Usa Gemini IA en la nube (requiere conexión)"
                        >
                          Gemini Nube
                        </button>
                        <button
                          type="button"
                          onClick={() => setOcrEngineMode('local')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            ocrEngineMode === 'local'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm font-bold'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                          title="Procesa 100% en el dispositivo con Tesseract.js sin enviar datos a internet"
                        >
                          Tesseract Local (100% Offline)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <Wifi className="w-3 h-3" />
                          Conexión activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse">
                          <WifiOff className="w-3 h-3 text-amber-600" />
                          Sin conexión (Tesseract Local activo)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* File Drag Box */}
                    <div className="md:col-span-2 border-2 border-dashed border-amber-300 rounded-2xl p-5 text-center bg-amber-50/15 flex flex-col items-center justify-center hover:bg-amber-50/35 transition-colors relative" id="drag-drop-zone">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <FileUp className="w-8 h-8 text-amber-600 mb-2 shrink-0 animate-bounce" />
                      <span className="font-extrabold text-slate-800 text-[11px] block">Cargar original de factura o albarán</span>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {ocrEngineMode === 'local' || !isOnline
                          ? 'Escaneo local instantáneo con Tesseract.js (sin conexión a internet)'
                          : 'Soporta fotos, capturas (.PNG, .JPG) o documentos .PDF'}
                      </span>
                    </div>

                    {/* AI Extract Status / Live Feedback logs */}
                    <div className="bg-slate-950 text-white rounded-2xl p-4 flex flex-col justify-between font-mono text-[10px] border border-slate-800" id="ai-logs-terminal">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-sans font-bold text-amber-500 uppercase tracking-widest block">
                            {ocrEngineMode === 'local' || !isOnline ? 'Tesseract OCR Local (Offline)' : 'Gemini AI OCR (Nube)'}
                          </span>
                          <span className="text-[8px] text-slate-400 font-sans">
                            {ocrEngineMode === 'local' || !isOnline ? 'Procesamiento en dispositivo' : 'Google AI'}
                          </span>
                        </div>
                        {isAnalyzing ? (
                          <div className="space-y-2 animate-pulse" id="ai-loading-panel">
                            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                            <p className="text-slate-350 leading-relaxed text-[10px]">{analysisProgress}</p>
                          </div>
                        ) : ocrSuccessMsg ? (
                          <div className="space-y-1.5 text-emerald-400" id="ai-success-panel">
                            <div className="flex items-center gap-1.5 font-bold"><Check className="w-4 h-4 shrink-0" /> PROCESADO CON ÉXITO</div>
                            <p className="text-[9.5px] leading-relaxed text-slate-300 font-sans">{ocrSuccessMsg}</p>
                          </div>
                        ) : errorMsg ? (
                          <div className="space-y-1.5 text-red-400" id="ai-error-panel">
                            <div className="flex items-center gap-1.5 font-bold"><AlertCircle className="w-4 h-4 shrink-0" /> FALLO DE ESCANEO</div>
                            <p className="text-[9.5px] leading-relaxed text-slate-300 font-sans">{errorMsg}</p>
                          </div>
                        ) : (
                          <p className="text-slate-500 leading-normal" id="ai-idle-panel">
                            {ocrEngineMode === 'local' || !isOnline
                              ? 'Motor local listo. Sube una factura o albarán para escanearlo 100% offline.'
                              : 'Terminal inactivo. Arrastre un archivo o elija un ejemplo para escanear.'}
                          </p>
                        )}
                      </div>
                      {isAnalyzing && (
                        <div className="w-full bg-slate-800 h-1 overflow-hidden rounded-full mt-3">
                          <div className="h-full bg-amber-500 animate-[loading_1.5s_infinite_linear]" style={{ width: '45%' }}></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form entries */}
              <form onSubmit={handleSaveDocFromModal} className="space-y-4" id="modal-invoice-form">
                
                <div className={docImageUrl ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : ""}>
                  {docImageUrl && (
                    <div className="lg:col-span-5 space-y-4" id="modal-image-preview-panel">
                      <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-2xl p-3">
                        <div>
                          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block font-semibold">Documento Escaneado</span>
                          <span className="text-xs font-black text-slate-800">Visualizador Integrado</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFullscreenImageUrl(docImageUrl);
                            setFullscreenTitle(docSupplier ? `${docSupplier} (${docNumber || 'Borrador'})` : 'Revisión de Factura');
                            setFullscreenZoom(1);
                            setFullscreenRotation(0);
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] py-1.5 px-3 rounded-lg shadow-sm transition-all flex items-center gap-1 shrink-0"
                        >
                          👁️ Pantalla Completa
                        </button>
                      </div>

                      <div className="relative group border border-slate-150 rounded-2xl bg-slate-50 hover:bg-slate-100/50 flex items-center justify-center p-2 min-h-[350px] lg:h-[500px] w-full transition-all duration-300">
                        {/* Image render */}
                        {docImageUrl.startsWith('data:application/pdf') || docImageUrl.endsWith('.pdf') ? (
                          <object
                            data={docImageUrl}
                            type="application/pdf"
                            className="w-full h-full rounded-2xl min-h-[350px]"
                          >
                            <div className="p-4 text-center text-slate-500 font-sans">
                              Vista previa de PDF no disponible. Use la descarga o el visor externo.
                            </div>
                          </object>
                        ) : (
                          <img
                            src={docImageUrl}
                            alt="Factura Digital Escaneada"
                            className="max-h-full max-w-full object-contain rounded-xl transition-all duration-300 shadow-md group-hover:scale-[1.02]"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-x-0 inset-y-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                          <button
                            type="button"
                            onClick={() => {
                              setFullscreenImageUrl(docImageUrl);
                              setFullscreenTitle(docSupplier ? `${docSupplier} (${docNumber || 'Borrador'})` : 'Revisión de Factura');
                              setFullscreenZoom(1);
                              setFullscreenRotation(0);
                            }}
                            className="bg-white text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-1.5 font-sans"
                          >
                            🔍 Ampliar en Pantalla Completa
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 italic text-center">
                        Haga clic en la imagen o en el botón para abrir en modo Pantalla Completa.
                      </p>
                    </div>
                  )}

                  <div className={docImageUrl ? "lg:col-span-12" : ""}>
                    <div className={docImageUrl ? "grid grid-cols-1 lg:grid-cols-1 gap-4" : ""}>
                      {/* Master Details Block */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-200/50" id="form-invoice-master">
                  
                  <div id="wrapper-form-obra">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Obra Proyecto Adjudicado *</label>
                    <select
                      required
                      className="w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none"
                      value={docObraId}
                      onChange={(e) => setDocObraId(e.target.value)}
                    >
                      <option value="" disabled>Seleccione obra destino...</option>
                      {obras.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                  </div>

                  <div id="wrapper-form-type">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Tipo de Documento</label>
                    <select
                      className="w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none"
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as any)}
                    >
                      <option value="factura">Factura Oficial</option>
                      <option value="albaran">Albarán de obra / Remisión</option>
                    </select>
                  </div>

                  <div id="wrapper-form-number">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Nº Documento o Identificador *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. FAC-2026-0422"
                      className="w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-amber-500"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                    />
                  </div>

                  <div id="wrapper-form-date">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Fecha Emisión</label>
                    <input
                      type="date"
                      className="w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:border-amber-500"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-2" id="wrapper-form-supplier">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Razón Social Emisor / Proveedor *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Suministros y Prefabricados Guadalete S.A."
                      className="w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                      value={docSupplier}
                      onChange={(e) => setDocSupplier(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-2" id="wrapper-form-category">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Categoría del Suministro</label>
                    <select
                      className="w-full bg-white rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none"
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                    >
                      <option value="">Predeterminado del Proveedor</option>
                      <option value="Hormigones y Áridos">Hormigones y Áridos</option>
                      <option value="Ladrillos y Cerámicas">Ladrillos y Cerámicas</option>
                      <option value="Instalaciones Eléctricas">Instalaciones Eléctricas</option>
                      <option value="Aceros y Metales">Aceros y Metales</option>
                      <option value="Carpintería y Acristalamiento">Carpintería y Acristalamiento</option>
                      <option value="Fontanería y Climatización">Fontanería y Climatización</option>
                      <option value="Pinturas y Revestimientos">Pinturas y Revestimientos</option>
                      <option value="Herramientas y Maquinaria">Herramientas y Maquinaria</option>
                      <option value="Combustibles y Energía">Combustibles y Energía</option>
                      <option value="Otros Suministros">Otros Suministros</option>
                    </select>

                    {/* DYNAMIC CATEGORY SUGGESTION PILL */}
                    {suggestedCategory && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600 animate-fadeIn" id="doc-category-suggestion-container">
                        <span className="inline-flex items-center text-[9px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200/50 rounded px-1.5 py-0.5" id="doc-category-suggestion-tag">
                          💡 Sugerencia
                        </span>
                        {docCategory === suggestedCategory ? (
                          <span className="text-emerald-700 font-semibold flex items-center gap-1" id="doc-category-suggestion-matched">
                            ✓ Recomendada aplicada: <strong className="font-bold">{suggestedCategory}</strong>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5" id="doc-category-suggestion-clickable-wrap">
                            <span>Basado en descripción:</span>
                            <button
                              type="button"
                              onClick={() => setDocCategory(suggestedCategory)}
                              className="bg-amber-100 hover:bg-amber-150 text-amber-900 font-bold px-2.5 py-0.5 rounded text-[11px] transition-all hover:scale-[1.02] active:scale-95 shadow-sm flex items-center gap-1 cursor-pointer border border-amber-200/70"
                              id="btn-apply-suggested-category"
                              title="Haz clic para aplicar esta categoría sugerida automáticamente"
                            >
                              {suggestedCategory}
                              <span className="text-[9px] bg-amber-200/80 px-1.5 py-0.1 select-none rounded text-amber-950 font-medium ml-1">Aplicar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>

                {/* Sub-itemized Material Lines Grid (Añadir/Eliminar filas de material) */}
                <div className="space-y-2" id="form-invoice-items-rowing">
                  <div className="flex justify-between items-center" id="invoice-items-heading-wrapper">
                    <span className="text-[10px] uppercase font-extrabold text-slate-500 block tracking-wider">Desglose de Partidas de Material de Obra</span>
                    <button
                      type="button"
                      onClick={handleAddFieldItem}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1 rounded-md text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                      id="btn-add-item-row"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Añadir Fila de Material
                    </button>
                  </div>

                  {/* Table headers */}
                  <div className="border border-slate-150 rounded-2xl overflow-hidden" id="itemized-lines-box">
                    <table className="w-full text-left" id="invoice-items-form-table">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase text-[9px] tracking-wide font-bold border-b border-slate-150">
                          <th className="px-3 py-2">Material / Suministro o Concepto</th>
                          <th className="px-3 py-2 w-16 text-right font-sans">Cant.</th>
                          <th className="px-3 py-2 w-16">Uds.</th>
                          <th className="px-3 py-2 w-24 text-right font-sans">P. Unit (€)</th>
                          <th className="px-3 py-2 w-24 text-right font-sans">Total (€)</th>
                          <th className="px-3 py-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {docItems.map((item, index) => (
                          <tr key={index} id={`form-item-row-${index}`}>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                placeholder="Ej. Cemento Portland CEM II 32,5N"
                                className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white rounded px-2 py-1 focus:outline-none"
                                value={item.name}
                                required
                                onChange={(e) => handleUpdateItemField(index, 'name', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5 w-16 text-right">
                              <input
                                type="number"
                                required
                                min="0.01"
                                step="any"
                                className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white rounded px-2 py-1 focus:outline-none font-mono text-right"
                                value={item.quantity || ''}
                                onChange={(e) => handleUpdateItemField(index, 'quantity', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5 w-16">
                              <input
                                type="text"
                                className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white rounded px-2 py-1 focus:outline-none text-center"
                                value={item.unit}
                                onChange={(e) => handleUpdateItemField(index, 'unit', e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5 w-24 text-right">
                              <input
                                type="number"
                                required
                                min="0"
                                step="any"
                                className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white rounded px-2 py-1 focus:outline-none font-mono text-right"
                                value={item.price || ''}
                                onChange={(e) => handleUpdateItemField(index, 'price', e.target.value)}
                              />
                            </td>
                            <td className="px-3 py-1.5 w-24 text-right text-slate-800 font-bold font-mono">
                              {(item.quantity * item.price).toFixed(2)}
                            </td>
                            <td className="px-2 py-1.5 w-10 text-center">
                              <button
                                type="button"
                                disabled={docItems.length === 1}
                                onClick={() => handleRemoveFieldItem(index)}
                                className={`text-slate-350 hover:text-red-500 p-1 rounded cursor-pointer ${
                                  docItems.length === 1 ? 'opacity-30 cursor-not-allowed' : ''
                                }`}
                                id={`btn-remove-item-${index}`}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Additional notes + tax parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2" id="form-invoice-taxation-split">
                  
                  {/* Notes Column */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Notas Contables</label>
                    <textarea
                      placeholder="Ej. Suministro entregado al pie del chalet Atlanterra para verjado frontal..."
                      className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 h-24 resize-none focus:outline-none"
                      value={docNotes}
                      onChange={(e) => setDocNotes(e.target.value)}
                    />
                  </div>

                  {/* Taxes and amounts calculations */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/50 space-y-3 font-sans text-xs" id="taxation-calc-sidebar">
                    <span className="text-[10px] uppercase font-extrabold text-slate-500 block tracking-wider">Desglose de Totales e Impuestos (España)</span>
                    
                    {/* Tax Base */}
                    <div className="flex justify-between items-center text-slate-600 font-mono">
                      <span>Base Imponible de Obra</span>
                      <span>
                        {docItems.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0).toFixed(2)} €
                      </span>
                    </div>

                    {/* VAT (IVA %) selection */}
                    <div className="flex justify-between items-center gap-4 text-slate-600">
                      <span>IVA Aplicado (%)</span>
                      <div className="flex gap-2 items-center">
                        <select
                          className="bg-white rounded border border-slate-200 p-1 text-xs font-mono"
                          value={docIvaRate}
                          onChange={(e) => setDocIvaRate(Number(e.target.value))}
                        >
                          <option value="21">21% (Básico general)</option>
                          <option value="10">10% (Edificación/Reformas)</option>
                          <option value="4">4% (Superreducido)</option>
                          <option value="0">0% (Inversión Sujeto Pasivo)</option>
                        </select>
                        <span className="font-mono text-slate-800 font-medium">
                          {(docItems.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0) * (docIvaRate / 100)).toFixed(2)} €
                        </span>
                      </div>
                    </div>

                    {/* Retention/Works guarantees (Fianzas de obra) */}
                    <div className="flex justify-between items-center gap-4 text-slate-600">
                      <span>Retención de Garantía / IRPF (%)</span>
                      <div className="flex gap-2 items-center">
                        <select
                          className="bg-white rounded border border-slate-200 p-1 text-xs font-mono"
                          value={docRetentionRate}
                          onChange={(e) => setDocRetentionRate(Number(e.target.value))}
                        >
                          <option value="0">0% (Sin Retenciones)</option>
                          <option value="2">2% (Garantía contratada)</option>
                          <option value="5">5% (Retención habitual España)</option>
                          <option value="15">15% (Retención IRPF autónomos)</option>
                        </select>
                        <span className="font-mono text-slate-800 font-medium">
                          {(docItems.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0) * (docRetentionRate / 100)).toFixed(2)} €
                        </span>
                      </div>
                    </div>

                    {/* Combined net Total */}
                    <div className="flex justify-between items-center text-sm font-black border-t border-slate-200 pt-3 text-slate-900" id="taxation-calc-total">
                      <span>TOTAL NETO A PAGAR</span>
                      <span className="font-mono text-base border-b-2 border-amber-500">
                        {(
                          docItems.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0) +
                          (docItems.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0) * (docIvaRate / 100)) -
                          (docItems.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0) * (docRetentionRate / 100))
                        ).toFixed(2)} €
                      </span>
                    </div>

                  </div>

                </div>

                    </div>
                  </div>
                </div>

                {/* Confirm Submit buttons */}
                <div className="border-t border-slate-100 pt-4 flex justify-end gap-2" id="form-invoice-actions">
                  <button
                    type="button"
                    onClick={() => setShowDocModal(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-5 rounded-lg text-xs cursor-pointer"
                  >
                    Cerrar panel
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-6 rounded-lg text-xs shadow-sm cursor-pointer"
                    id="btn-save-doc"
                  >
                    Guardar Factura / Albarán
                  </button>
                </div>

              </form>

            </div>
            )}

          </div>
        </div>
      )}

      {/* 4.5 DUPLICATES CONTROL CENTER MODAL */}
      {openDuplicatesConsole && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[49] overflow-y-auto no-print animate-fadeIn" id="duplicates-modal-overlay">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto font-sans text-xs flex flex-col animate-slideUp" id="duplicates-modal-body">
            
            {/* Modal header */}
            <div className="border-b border-slate-100 px-6 py-4 flex justify-between items-center bg-slate-50 rounded-t-3xl" id="duplicates-modal-header">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="text-amber-500 text-lg">⚠️</span>
                  Control y Resolución de Documentos Duplicados
                </h3>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Identifique facturas y albaranes redundantes introducidos por duplicidad en la carga individual o masiva por IA.
                </p>
              </div>
              <button
                onClick={() => setOpenDuplicatesConsole(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
                id="btn-close-duplicates-modal"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto text-slate-800" id="duplicates-modal-content">
              {duplicatesGrouped.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <span className="text-4xl">🎉</span>
                  <h4 className="text-sm font-black text-slate-800">No se detectaron documentos duplicados</h4>
                  <p className="text-xs text-slate-500">Todos los documentos cargados en el sistema tienen emisores y números únicos.</p>
                  <button
                    onClick={() => setOpenDuplicatesConsole(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer mt-2"
                  >
                    Cerrar Panel
                  </button>
                </div>
              ) : (
                <>
                  {/* Quick summary and Automatic resolution banner */}
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="text-amber-800 font-bold text-xs flex items-center gap-1.5">
                        <span>🧹</span> Limpieza Automática Inteligente
                      </h4>
                      <p className="text-[11px] text-amber-700/80 mt-0.5 max-w-2xl leading-normal">
                        ¿Tiene prisa? El sistema puede automatizar la resolución. Para cada grupo repetido, conservará la copia con mayor puntuación de completitud (estado 'Pagado', posesión de adjunto escaneado, etc.) y eliminará las redundantes de forma segura.
                      </p>
                    </div>
                    <button
                      onClick={handleAutomaticDuplicatesCleanup}
                      disabled={duplicateActionLoading}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-amber-500/10 cursor-pointer whitespace-nowrap self-stretch sm:self-auto text-center"
                    >
                      {duplicateActionLoading ? 'Procesando...' : '⚡ Ejecutar Limpieza Automática'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-slate-900 font-black uppercase text-[10px] tracking-wider">
                      Grupos de Duplicados Detectados ({duplicatesGrouped.length})
                    </h4>

                    <div className="space-y-4" id="duplicates-groups-container">
                      {duplicatesGrouped.map((group) => {
                        const bestDoc = getBestDocumentInGroup(group.docs);
                        return (
                          <DuplicateGroupCard 
                            key={group.key}
                            group={group}
                            bestDoc={bestDoc}
                            obras={obras}
                            onResolve={handleResolveSingleDuplicateGroup}
                            loading={duplicateActionLoading}
                          />
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 px-6 py-4 flex justify-end bg-slate-50 rounded-b-3xl" id="duplicates-modal-footer">
              <button
                onClick={() => setOpenDuplicatesConsole(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-5 rounded-xl text-xs cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. INTERACTIVE FULLSCREEN DOCUMENT DETAIL VIEW (ZOOM, ROTATE AND INTERACTIVE REVIEW) */}
      {fullscreenImageUrl && (
        <div className="fixed inset-0 bg-slate-950/98 z-[99] flex flex-col no-print animate-fadeIn" id="fullscreen-document-viewer">
          {/* Top Utility Bar Controls */}
          <div className="bg-slate-900 border-b border-white/5 py-3 px-6 flex flex-col sm:flex-row justify-between items-center gap-3.5" id="fullscreen-viewer-header">
            <div className="flex items-center gap-3">
              <span className="text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">Modo Revisión Detallada</span>
              <h4 className="text-white font-extrabold text-sm font-sans tracking-tight" id="fullscreen-invoice-title">
                {fullscreenTitle || 'Documento Escaneado de Facturación'}
              </h4>
            </div>

            {/* Scale, Rotate, and Manipulation Panel */}
            <div className="flex flex-wrap items-center justify-center gap-2" id="fullscreen-image-controls">
              <span className="text-[10px] font-mono text-white/50 mr-1.5 uppercase tracking-wide">Controles:</span>
              
              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => setFullscreenZoom(prev => Math.max(0.5, prev - 0.25))}
                disabled={fullscreenZoom <= 0.5}
                className="bg-white/5 hover:bg-white/10 active:scale-95 text-white/90 p-1.5 px-3 rounded-lg text-xs font-bold font-sans flex items-center gap-1 transition-all disabled:opacity-40 select-none cursor-pointer border border-white/5"
                title="Alejar Zoom"
                id="btn-viewer-zoom-out"
              >
                ➖ Alejar
              </button>

              {/* Current Zoom factor */}
              <span className="font-mono text-xs text-amber-400 font-bold px-2 inline-block min-w-[55px] text-center bg-white/5 rounded-md py-1 border border-white/5">
                {Math.round(fullscreenZoom * 100)}%
              </span>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() => setFullscreenZoom(prev => Math.min(3.0, prev + 0.25))}
                disabled={fullscreenZoom >= 3.0}
                className="bg-white/5 hover:bg-white/10 active:scale-95 text-white/90 p-1.5 px-3 rounded-lg text-xs font-bold font-sans flex items-center gap-1 transition-all disabled:opacity-40 select-none cursor-pointer border border-white/5"
                title="Acercar Zoom"
                id="btn-viewer-zoom-in"
              >
                ➕ Acercar
              </button>

              {/* Divider */}
              <div className="w-[1px] h-5 bg-white/10 mx-1"></div>

              {/* Rotate Left 90 */}
              <button
                type="button"
                onClick={() => setFullscreenRotation(prev => (prev - 90) % 360)}
                className="bg-white/5 hover:bg-white/10 active:scale-95 text-white/90 p-1.5 px-2.5 rounded-lg text-xs font-sans transition-all cursor-pointer border border-white/5"
                title="Rotar a la izquierda (Antihorario)"
                id="btn-viewer-rotate-left"
              >
                🔄 -90°
              </button>

              {/* Rotate Right 90 */}
              <button
                type="button"
                onClick={() => setFullscreenRotation(prev => (prev + 90) % 360)}
                className="bg-white/5 hover:bg-white/10 active:scale-95 text-white/90 p-1.5 px-2.5 rounded-lg text-xs font-sans transition-all cursor-pointer border border-white/5"
                title="Rotar a la derecha (Horario)"
                id="btn-viewer-rotate-right"
              >
                🔄 +90°
              </button>

              {/* Reset to Default */}
              <button
                type="button"
                onClick={() => {
                  setFullscreenZoom(1);
                  setFullscreenRotation(0);
                }}
                disabled={fullscreenZoom === 1 && fullscreenRotation === 0}
                className="bg-white/5 hover:bg-white/10 active:scale-95 text-white/40 hover:text-white p-1.5 px-3 rounded-lg text-xs font-sans transition-all disabled:opacity-30 cursor-pointer border border-white/5"
                title="Restaurar a escala original"
                id="btn-viewer-reset"
              >
                Reajustar ↩️
              </button>

              {/* Exit Fullscreen */}
              <button
                type="button"
                onClick={() => setFullscreenImageUrl('')}
                className="bg-red-500 hover:bg-red-600 text-white font-extrabold px-4 py-1.5 rounded-lg text-xs transition-colors shadow-md ml-2 cursor-pointer font-sans"
                id="btn-close-fullscreen-viewer"
              >
                ✕ Salir Vista Detallada
              </button>
            </div>
          </div>

          {/* Canvas Scrollable Zoom Workspace Area */}
          <div 
            className="flex-1 overflow-auto p-8 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
            id="fullscreen-viewer-viewport"
          >
            <div 
              className="max-w-full max-h-full transition-transform duration-200 ease-out p-4 flex items-center justify-center bg-[#09090a] rounded-2xl border border-white/5 shadow-2xl relative"
              style={{
                transform: `scale(${fullscreenZoom}) rotate(${fullscreenRotation}deg)`,
              }}
              id="draggable-zoom-container"
            >
              {fullscreenImageUrl.startsWith('data:application/pdf') || fullscreenImageUrl.endsWith('.pdf') ? (
                <object
                  data={fullscreenImageUrl}
                  type="application/pdf"
                  className="w-[85vw] h-[80vh] rounded-xl"
                  id="fullscreen-pdf-obj"
                >
                  <p className="text-white/60 p-4">La vista previa en PDF no se pudo cargar. Pruebe a abrir en otra pestaña.</p>
                </object>
              ) : (
                <img
                  src={fullscreenImageUrl}
                  alt="Vista Completa Digitalizada"
                  className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl animate-fadeIn"
                  draggable={false}
                  referrerPolicy="no-referrer"
                  id="fullscreen-preview-img"
                />
              )}
            </div>
          </div>

          {/* Bottom helper stats and shortcuts info */}
          <div className="bg-slate-900 border-t border-white/5 py-2 px-6 flex justify-between items-center text-[10px] text-white/40 font-mono" id="viewer-status-footer">
            <span>Usa los controles superiores para ajustar la ampliación o rotación del documento escaneado.</span>
            <span>Control de Certificados</span>
          </div>
        </div>
      )}

      {/* Realtime Toast Notification with Green/Red Feedback */}
      {toast && (
        <div 
          className={`fixed bottom-6 right-6 z-50 px-4 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3.5 text-xs animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-md backdrop-blur-lg border-2 ${
            toast.type === 'success'
              ? 'bg-[#061d11]/95 border-emerald-500 shadow-emerald-950/60'
              : 'bg-[#200a0a]/95 border-rose-500 shadow-rose-950/60'
          }`} 
          id="db-toast-notification"
        >
          <div className={`p-2 rounded-xl shrink-0 border ${
            toast.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                toast.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {toast.type === 'success' ? 'Base de Datos • Éxito' : 'Base de Datos • Error'}
              </span>
            </div>
            <p className="text-white text-[13px] font-medium leading-snug mt-0.5 break-words">
              {toast.message}
            </p>
          </div>

          <button
            onClick={() => setToast(null)}
            className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-1"
            title="Cerrar notificación"
            id="close-db-toast-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Barra de Navegación Inferior Móvil (BottomNav para smartphones) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#111114]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 shadow-2xl flex items-center justify-around no-print" 
        id="mobile-bottom-nav"
        aria-label="Navegación móvil inferior"
      >
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl touch-target cursor-pointer transition-colors ${
            activeTab === 'dashboard' ? 'text-emerald-400 font-bold' : 'text-white/60 hover:text-white'
          }`}
          aria-label="Ir a Resumen"
        >
          <span className="text-lg leading-none">📊</span>
          <span className="text-[10px] mt-0.5 font-medium">Resumen</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('obras')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl touch-target cursor-pointer transition-colors ${
            activeTab === 'obras' ? 'text-emerald-400 font-bold' : 'text-white/60 hover:text-white'
          }`}
          aria-label="Ir a Obras"
        >
          <span className="text-lg leading-none">🏗️</span>
          <span className="text-[10px] mt-0.5 font-medium">Obras</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('control_horario')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl touch-target cursor-pointer transition-colors relative ${
            activeTab === 'control_horario' ? 'text-emerald-400 font-bold' : 'text-white/60 hover:text-white'
          }`}
          aria-label="Ir a Control Horario"
        >
          <span className="text-lg leading-none">⏱️</span>
          <span className="text-[10px] mt-0.5 font-medium">Fichajes</span>
          {activeFichajes.length > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl touch-target cursor-pointer transition-colors ${
            activeTab === 'personal' ? 'text-emerald-400 font-bold' : 'text-white/60 hover:text-white'
          }`}
          aria-label="Ir a Personal"
        >
          <span className="text-lg leading-none">👷</span>
          <span className="text-[10px] mt-0.5 font-medium">Personal</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMoreMenuOpen(true)}
          className="flex flex-col items-center justify-center p-1.5 rounded-xl touch-target cursor-pointer text-white/60 hover:text-white transition-colors"
          aria-label="Abrir menú de más secciones"
        >
          <MoreHorizontal className="w-5 h-5 text-white/70" />
          <span className="text-[10px] mt-0.5 font-medium">Más</span>
        </button>
      </nav>

      {/* Mobile More Options Drawer Modal */}
      {isMobileMoreMenuOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileMoreMenuOpen(false);
          }}
        >
          <div 
            className="bg-[#121215] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-lg p-5 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white" id="mobile-menu-title">
                  Todas las Secciones
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMoreMenuOpen(false)}
                className="touch-target p-1.5 text-white/50 hover:text-white rounded-lg hover:bg-white/5"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>


            {/* Modules Grid */}
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('documentos');
                  setIsMobileMoreMenuOpen(false);
                }}
                className={`touch-target w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                  activeTab === 'documentos' ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold' : 'hover:bg-white/5 text-white/80'
                }`}
              >
                <span className="flex items-center gap-2.5 text-xs font-medium">
                  <span className="text-base">🧾</span>
                  <span>Facturas y Albaranes</span>
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('gastos');
                  setIsMobileMoreMenuOpen(false);
                }}
                className={`touch-target w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                  activeTab === 'gastos' ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold' : 'hover:bg-white/5 text-white/80'
                }`}
              >
                <span className="flex items-center gap-2.5 text-xs font-medium">
                  <span className="text-base">🏢</span>
                  <span>Gastos Generales de Empresa</span>
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('informes');
                  setIsMobileMoreMenuOpen(false);
                }}
                className={`touch-target w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                  activeTab === 'informes' ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold' : 'hover:bg-white/5 text-white/80'
                }`}
              >
                <span className="flex items-center gap-2.5 text-xs font-medium">
                  <span className="text-base">📝</span>
                  <span>Informes y Balance de Liquidación</span>
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('copias');
                  setIsMobileMoreMenuOpen(false);
                }}
                className={`touch-target w-full text-left p-3 rounded-xl flex items-center justify-between transition-colors ${
                  activeTab === 'copias' ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold' : 'hover:bg-white/5 text-white/80'
                }`}
              >
                <span className="flex items-center gap-2.5 text-xs font-medium">
                  <span className="text-base">💾</span>
                  <span>Copias de Seguridad y Respaldo</span>
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsWorkerPortalOpen(true);
                  setIsMobileMoreMenuOpen(false);
                }}
                className="touch-target w-full text-left p-3 rounded-xl flex items-center justify-between bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold"
              >
                <span className="flex items-center gap-2.5 text-xs">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>Portal Móvil para Operarios</span>
                </span>
                <ChevronRight className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
