import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Clock, 
  CheckCircle, 
  Calendar, 
  FileText, 
  Download, 
  Building2, 
  User, 
  PenTool, 
  RotateCcw, 
  Trash2, 
  Plus, 
  Eye, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  ArrowRight,
  Printer,
  ChevronRight,
  Briefcase,
  DollarSign,
  UserCheck,
  XCircle,
  Check,
  Filter,
  CheckSquare,
  Square,
  AlertCircle,
  Smartphone,
  QrCode,
  Share2,
  Copy,
  ExternalLink,
  MapPin
} from 'lucide-react';
import QRCode from 'qrcode';
import { Obra, TrabajadorEmpresa, RegistroJornada, PersonalCost, ActiveFichaje } from '../types';

interface ControlHorarioManagerProps {
  fichajes: RegistroJornada[];
  obras: Obra[];
  trabajadoresEmpresa: TrabajadorEmpresa[];
  personal: PersonalCost[];
  onSaveFichaje: (record: RegistroJornada) => void;
  onDeleteFichaje: (id: string) => void;
  onUpdateFichaje: (record: RegistroJornada) => void;
  onApproveFichaje?: (recordId: string, foremanData: { foremanName: string; foremanRole?: string; foremanSignature: string; notes?: string }) => void;
  onBatchApproveFichajes?: (recordIds: string[], foremanData: { foremanName: string; foremanRole?: string; foremanSignature: string; notes?: string }) => void;
  onRejectFichaje?: (recordId: string, reason: string) => void;
  selectedObraId?: string;
  onNavigateToObra?: (obraId: string) => void;
  activeFichajes?: ActiveFichaje[];
  onOpenWorkerPortal?: () => void;
}

export const ControlHorarioManager: React.FC<ControlHorarioManagerProps> = ({
  fichajes,
  obras,
  trabajadoresEmpresa,
  personal,
  onSaveFichaje,
  onDeleteFichaje,
  onUpdateFichaje,
  onApproveFichaje,
  onBatchApproveFichajes,
  onRejectFichaje,
  selectedObraId = 'all',
  onNavigateToObra,
  activeFichajes = [],
  onOpenWorkerPortal,
}) => {
  // Navigation internal mode
  const [activeSubTab, setActiveSubTab] = useState<'terminal' | 'portalMovil' | 'aprobaciones' | 'historial' | 'informeLegal'>('terminal');

  // QR Code generation state for the worker portal
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [qrObraFilter, setQrObraFilter] = useState<string>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  // Compute live active workers list
  const activeWorkersList = useMemo(() => {
    if (activeFichajes && activeFichajes.length > 0) return activeFichajes;
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
  }, [activeFichajes, fichajes]);

  // Compute portal URL
  const portalUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}?portal=trabajador`;
    return qrObraFilter !== 'all' ? `${base}&obraId=${qrObraFilter}` : base;
  }, [qrObraFilter]);

  // Generate QR Code image
  useEffect(() => {
    if (portalUrl) {
      QRCode.toDataURL(portalUrl, {
        width: 340,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        setQrCodeDataUrl(url);
      }).catch(err => console.error('Error generating QR code:', err));
    }
  }, [portalUrl]);

  // Live timer for active workers card
  const [liveNow, setLiveNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const copyPortalLink = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Form states for Terminal
  const todayStr = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toTimeString().slice(0, 5); // HH:mm

  const [workerId, setWorkerId] = useState<string>('');
  const [obraId, setObraId] = useState<string>(selectedObraId !== 'all' ? selectedObraId : (obras[0]?.id || ''));
  const [date, setDate] = useState<string>(todayStr);
  const [clockIn, setClockIn] = useState<string>('08:00');
  const [clockOut, setClockOut] = useState<string>('17:00');
  const [breakMinutes, setBreakMinutes] = useState<number>(60);
  const [notes, setNotes] = useState<string>('');
  
  // Custom rates override if needed
  const [customHourlyRate, setCustomHourlyRate] = useState<number | null>(null);
  const [customOvertimeRate, setCustomOvertimeRate] = useState<number | null>(null);

  // Worker Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Capataz identity & settings
  const [foremanName, setForemanName] = useState<string>(() => localStorage.getItem('up_foreman_name') || 'Manuel Roldán (Capataz)');
  const [foremanRole, setForemanRole] = useState<string>(() => localStorage.getItem('up_foreman_role') || 'Capataz de Obra');
  const [isEditingForeman, setIsEditingForeman] = useState(false);

  useEffect(() => {
    localStorage.setItem('up_foreman_name', foremanName);
  }, [foremanName]);

  useEffect(() => {
    localStorage.setItem('up_foreman_role', foremanRole);
  }, [foremanRole]);

  // Capataz Approval Modal states
  const [approvingRecord, setApprovingRecord] = useState<RegistroJornada | null>(null);
  const [isBatchApprovalModalOpen, setIsBatchApprovalModalOpen] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [foremanNotesInput, setForemanNotesInput] = useState<string>('');
  
  // Capataz Signature Canvas
  const foremanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [foremanIsDrawing, setForemanIsDrawing] = useState(false);
  const [foremanHasSignature, setForemanHasSignature] = useState(false);

  // Rejection modal
  const [rejectingRecord, setRejectingRecord] = useState<RegistroJornada | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('Horario no conforme o ausencia no justificada en la obra');

  // Inspection & Filters
  const [filterMonth, setFilterMonth] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM
  const [filterWorker, setFilterWorker] = useState<string>('all');
  const [filterObra, setFilterObra] = useState<string>(selectedObraId);
  const [filterApprovalStatus, setFilterApprovalStatus] = useState<string>('all'); // all, pending, approved, rejected
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Aprobaciones Tab Specific Filter
  const [approvalTabFilter, setApprovalTabFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  // Certificate Modal
  const [viewingRecord, setViewingRecord] = useState<RegistroJornada | null>(null);

  // Multi-Worker (Cuadrilla) selection mode
  const [isCuadrillaMode, setIsCuadrillaMode] = useState<boolean>(false);
  const [selectedCuadrillaIds, setSelectedCuadrillaIds] = useState<string[]>([]);

  // Count pending approvals
  const pendingApprovalsCount = useMemo(() => {
    return fichajes.filter(f => f.approvalStatus === 'pending' || (!f.approvalStatus && !f.personalCostId)).length;
  }, [fichajes]);

  // Sync selectedObraId if changed from parent
  useEffect(() => {
    if (selectedObraId !== 'all') {
      setObraId(selectedObraId);
      setFilterObra(selectedObraId);
    }
  }, [selectedObraId]);

  // Selected Worker object
  const selectedWorker = useMemo(() => {
    return trabajadoresEmpresa.find(w => w.id === workerId);
  }, [trabajadoresEmpresa, workerId]);

  // Default worker assignment if none selected
  useEffect(() => {
    if (!workerId && trabajadoresEmpresa.length > 0) {
      setWorkerId(trabajadoresEmpresa[0].id);
      if (trabajadoresEmpresa[0].defaultObraId && obras.some(o => o.id === trabajadoresEmpresa[0].defaultObraId)) {
        setObraId(trabajadoresEmpresa[0].defaultObraId);
      }
    }
  }, [trabajadoresEmpresa, workerId, obras]);

  // When selected worker changes, sync default rates
  useEffect(() => {
    if (selectedWorker) {
      const stdRate = selectedWorker.standardHourlyRate || (selectedWorker.dailyRate ? Number((selectedWorker.dailyRate / 8).toFixed(2)) : 15);
      const otRate = selectedWorker.overtimeHourlyRate || Number((stdRate * 1.35).toFixed(2));
      setCustomHourlyRate(stdRate);
      setCustomOvertimeRate(otRate);
      if (selectedWorker.defaultObraId && obras.some(o => o.id === selectedWorker.defaultObraId)) {
        setObraId(selectedWorker.defaultObraId);
      }
    }
  }, [selectedWorker, obras]);

  // Calculations for regular, overtime, total hours and costs
  const calculation = useMemo(() => {
    if (!clockIn || !clockOut) return { totalHours: 0, regularHours: 0, overtimeHours: 0, totalCost: 0, hourlyRate: 15, overtimeRate: 20 };

    const [inH, inM] = clockIn.split(':').map(Number);
    const [outH, outM] = clockOut.split(':').map(Number);

    const inTotalMinutes = inH * 60 + inM;
    let outTotalMinutes = outH * 60 + outM;

    // In case shift passes midnight
    if (outTotalMinutes < inTotalMinutes) {
      outTotalMinutes += 24 * 60;
    }

    const netMinutes = Math.max(0, outTotalMinutes - inTotalMinutes - (Number(breakMinutes) || 0));
    const netHours = Number((netMinutes / 60).toFixed(2));

    const regularHours = Math.min(8, netHours);
    const overtimeHours = Number(Math.max(0, netHours - 8).toFixed(2));

    const stdRate = customHourlyRate ?? (selectedWorker?.standardHourlyRate || (selectedWorker?.dailyRate ? selectedWorker.dailyRate / 8 : 15));
    const otRate = customOvertimeRate ?? (selectedWorker?.overtimeHourlyRate || (stdRate * 1.35));

    const costRegular = regularHours * stdRate;
    const costOvertime = overtimeHours * otRate;
    const totalCost = Number((costRegular + costOvertime).toFixed(2));

    return {
      totalHours: netHours,
      regularHours,
      overtimeHours,
      hourlyRate: stdRate,
      overtimeRate: otRate,
      totalCost,
    };
  }, [clockIn, clockOut, breakMinutes, customHourlyRate, customOvertimeRate, selectedWorker]);

  // Worker Canvas Drawing Logic with touch scaling
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#10B981'; // Green signature
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Foreman Canvas Drawing Logic with touch scaling
  const startForemanDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = foremanCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    setForemanIsDrawing(true);
  };

  const drawForeman = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!foremanIsDrawing) return;
    e.preventDefault();
    const canvas = foremanCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#38BDF8'; // Blue signature for foreman verification
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
    setForemanHasSignature(true);
  };

  const stopForemanDrawing = () => {
    setForemanIsDrawing(false);
  };

  const clearForemanSignature = () => {
    const canvas = foremanCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setForemanHasSignature(false);
  };

  // Submit single signature shift (Operario firma -> Queda 'pending' hasta que apruebe el capataz)
  const handleRegisterFichaje = (e: React.FormEvent) => {
    e.preventDefault();

    if (!workerId || !selectedWorker) {
      alert('Por favor selecciona un trabajador de la plantilla.');
      return;
    }

    if (!obraId) {
      alert('Por favor selecciona la obra donde se ha prestado el servicio.');
      return;
    }

    if (!hasSignature || !canvasRef.current) {
      alert('Es obligatorio estampar la firma digital manuscrita para validar legalmente la jornada.');
      return;
    }

    const signatureDataUrl = canvasRef.current.toDataURL('image/png');
    const matchedObra = obras.find(o => o.id === obraId);

    const recordId = `jornada-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newRecord: RegistroJornada = {
      id: recordId,
      workerId: selectedWorker.id,
      workerName: selectedWorker.name,
      workerDni: selectedWorker.dni || '',
      role: selectedWorker.role || 'Oficial de Obra',
      obraId: obraId,
      obraName: matchedObra?.name || 'Obra',
      date: date,
      clockIn: clockIn,
      clockOut: clockOut,
      breakMinutes: breakMinutes,
      totalHours: calculation.totalHours,
      regularHours: calculation.regularHours,
      overtimeHours: calculation.overtimeHours,
      hourlyRate: calculation.hourlyRate,
      overtimeRate: calculation.overtimeRate,
      calculatedCost: calculation.totalCost,
      workerSignature: signatureDataUrl,
      signatureTimestamp: new Date().toISOString(),
      legalDisclaimer: 'Certifico la veracidad de los datos de la jornada y mi presencia efectiva en la obra indicada, en cumplimiento del art. 34.9 del Estatuto de los Trabajadores y RDL 8/2019.',
      notes: notes.trim(),
      status: 'completed',
      // Se registra con estado pendiente de aprobación digital del capataz
      approvalStatus: 'pending',
      personalCostId: `cost-fichaje-${recordId}`,
      createdAt: new Date().toISOString()
    };

    onSaveFichaje(newRecord);

    // Reset canvas & notes
    clearSignature();
    setNotes('');
    alert(`✓ Jornada de ${selectedWorker.name} registrada con éxito con firma digital.\n\n⚠️ ESTADO: Pendiente de aprobación por el Capataz de la obra. El coste (${calculation.totalCost.toFixed(2)} €) no se imputará al presupuesto de la obra hasta que el capataz la apruebe digitalmente.`);
  };

  // Batch Cuadrilla creation (Operarios firman -> Quedan 'pending' hasta aprobación de Capataz)
  const handleCuadrillaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCuadrillaIds.length === 0) {
      alert('Selecciona al menos un operario de la cuadrilla.');
      return;
    }
    if (!obraId) {
      alert('Selecciona la obra.');
      return;
    }
    if (!hasSignature || !canvasRef.current) {
      alert('Por favor estampa la firma del responsable o encargado de cuadrilla.');
      return;
    }

    const signatureDataUrl = canvasRef.current.toDataURL('image/png');
    const matchedObra = obras.find(o => o.id === obraId);

    let count = 0;
    selectedCuadrillaIds.forEach(wId => {
      const worker = trabajadoresEmpresa.find(w => w.id === wId);
      if (!worker) return;

      const stdRate = worker.standardHourlyRate || (worker.dailyRate ? worker.dailyRate / 8 : 15);
      const otRate = worker.overtimeHourlyRate || (stdRate * 1.35);

      const [inH, inM] = clockIn.split(':').map(Number);
      const [outH, outM] = clockOut.split(':').map(Number);
      const netMins = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM) - breakMinutes);
      const netHours = Number((netMins / 60).toFixed(2));
      const regHours = Math.min(8, netHours);
      const otHours = Math.max(0, netHours - 8);
      const cost = Number(((regHours * stdRate) + (otHours * otRate)).toFixed(2));

      const recordId = `jornada-${Date.now()}-${count}-${Math.random().toString(36).substr(2, 4)}`;
      const newRec: RegistroJornada = {
        id: recordId,
        workerId: worker.id,
        workerName: worker.name,
        workerDni: worker.dni || '',
        role: worker.role || 'Operario de Cuadrilla',
        obraId: obraId,
        obraName: matchedObra?.name || 'Obra',
        date: date,
        clockIn: clockIn,
        clockOut: clockOut,
        breakMinutes: breakMinutes,
        totalHours: netHours,
        regularHours: regHours,
        overtimeHours: otHours,
        hourlyRate: stdRate,
        overtimeRate: otRate,
        calculatedCost: cost,
        workerSignature: signatureDataUrl,
        signatureTimestamp: new Date().toISOString(),
        legalDisclaimer: 'Validado por Cuadrilla. Presencia física acreditada en obra (RDL 8/2019).',
        notes: `Parte de Cuadrilla. ${notes}`.trim(),
        status: 'completed',
        approvalStatus: 'pending',
        personalCostId: `cost-fichaje-${recordId}`,
        createdAt: new Date().toISOString()
      };
      onSaveFichaje(newRec);
      count++;
    });

    clearSignature();
    setSelectedCuadrillaIds([]);
    setNotes('');
    alert(`✓ Se han registrado ${count} jornadas de cuadrilla.\n\n⚠️ Todas han quedado en estado 'Pendiente de aprobación de Capataz' antes de asignarse a los gastos de personal de ${matchedObra?.name || 'la obra'}.`);
  };

  // Open single approval modal
  const handleOpenApproveModal = (record: RegistroJornada) => {
    setApprovingRecord(record);
    setIsBatchApprovalModalOpen(false);
    setForemanNotesInput(record.notes || '');
    setForemanHasSignature(false);
  };

  // Open batch approval modal
  const handleOpenBatchApproveModal = () => {
    if (selectedPendingIds.length === 0) {
      alert('Selecciona al menos una jornada pendiente para aprobar en lote.');
      return;
    }
    setApprovingRecord(null);
    setIsBatchApprovalModalOpen(true);
    setForemanNotesInput('');
    setForemanHasSignature(false);
  };

  // Confirm single approval by Foreman
  const handleConfirmForemanApproval = () => {
    if (!approvingRecord) return;
    if (!foremanName.trim()) {
      alert('Por favor introduce el nombre del Capataz / Encargado de obra.');
      return;
    }
    if (!foremanHasSignature || !foremanCanvasRef.current) {
      alert('El Capataz debe estampar su firma digital manuscrita para validar la jornada e imputar el gasto a la obra.');
      return;
    }

    const foremanSignatureDataUrl = foremanCanvasRef.current.toDataURL('image/png');

    if (onApproveFichaje) {
      onApproveFichaje(approvingRecord.id, {
        foremanName: foremanName.trim(),
        foremanRole: foremanRole.trim(),
        foremanSignature: foremanSignatureDataUrl,
        notes: foremanNotesInput.trim()
      });
    } else {
      // Fallback direct update
      const costId = approvingRecord.personalCostId || `cost-fichaje-${approvingRecord.id}`;
      const approved: RegistroJornada = {
        ...approvingRecord,
        approvalStatus: 'approved',
        foremanName: foremanName.trim(),
        foremanRole: foremanRole.trim(),
        foremanSignature: foremanSignatureDataUrl,
        approvedAt: new Date().toISOString(),
        foremanNotes: foremanNotesInput.trim(),
        personalCostId: costId
      };
      onSaveFichaje(approved);
    }

    setApprovingRecord(null);
    clearForemanSignature();
  };

  // Confirm batch approval by Foreman
  const handleConfirmBatchForemanApproval = () => {
    if (selectedPendingIds.length === 0) return;
    if (!foremanName.trim()) {
      alert('Por favor introduce el nombre del Capataz.');
      return;
    }
    if (!foremanHasSignature || !foremanCanvasRef.current) {
      alert('Es obligatorio estampar la firma digital del Capataz para autorizar el lote.');
      return;
    }

    const foremanSignatureDataUrl = foremanCanvasRef.current.toDataURL('image/png');

    if (onBatchApproveFichajes) {
      onBatchApproveFichajes(selectedPendingIds, {
        foremanName: foremanName.trim(),
        foremanRole: foremanRole.trim(),
        foremanSignature: foremanSignatureDataUrl,
        notes: foremanNotesInput.trim()
      });
    }

    setIsBatchApprovalModalOpen(false);
    setSelectedPendingIds([]);
    clearForemanSignature();
  };

  // Open rejection modal
  const handleOpenRejectModal = (record: RegistroJornada) => {
    setRejectingRecord(record);
    setRejectionReasonInput('Horario no conforme con los partes de obra o ausencia injustificada');
  };

  // Confirm rejection
  const handleConfirmReject = () => {
    if (!rejectingRecord) return;
    if (!rejectionReasonInput.trim()) {
      alert('Por favor indica el motivo del rechazo del fichaje.');
      return;
    }

    if (onRejectFichaje) {
      onRejectFichaje(rejectingRecord.id, rejectionReasonInput.trim());
    } else {
      const rejected: RegistroJornada = {
        ...rejectingRecord,
        approvalStatus: 'rejected',
        rejectionReason: rejectionReasonInput.trim()
      };
      onSaveFichaje(rejected);
    }

    setRejectingRecord(null);
  };

  // Filtered Records for Inspection & History
  const filteredRecords = useMemo(() => {
    return fichajes.filter(r => {
      const matchMonth = !filterMonth || r.date.startsWith(filterMonth);
      const matchWorker = filterWorker === 'all' || r.workerId === filterWorker;
      const matchObra = filterObra === 'all' || r.obraId === filterObra;
      const rStatus = r.approvalStatus || (r.personalCostId ? 'approved' : 'pending');
      const matchApproval = filterApprovalStatus === 'all' || rStatus === filterApprovalStatus;
      const matchSearch = !searchQuery || 
        r.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.obraName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.workerDni && r.workerDni.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchMonth && matchWorker && matchObra && matchApproval && matchSearch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [fichajes, filterMonth, filterWorker, filterObra, filterApprovalStatus, searchQuery]);

  // Filtered records specifically for Aprobaciones Tab
  const approvalTabRecords = useMemo(() => {
    return fichajes.filter(r => {
      const rStatus = r.approvalStatus || (r.personalCostId ? 'approved' : 'pending');
      const matchStatus = approvalTabFilter === 'all' || rStatus === approvalTabFilter;
      const matchObra = filterObra === 'all' || r.obraId === filterObra;
      const matchSearch = !searchQuery || 
        r.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.obraName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStatus && matchObra && matchSearch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [fichajes, approvalTabFilter, filterObra, searchQuery]);

  // Aggregate Metrics for History
  const historyMetrics = useMemo(() => {
    let totalHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;
    let totalCost = 0;
    let approvedCost = 0;
    let pendingCost = 0;

    filteredRecords.forEach(r => {
      totalHours += r.totalHours || 0;
      regularHours += r.regularHours || 0;
      overtimeHours += r.overtimeHours || 0;
      totalCost += r.calculatedCost || 0;
      const rStatus = r.approvalStatus || (r.personalCostId ? 'approved' : 'pending');
      if (rStatus === 'approved') {
        approvedCost += r.calculatedCost || 0;
      } else if (rStatus === 'pending') {
        pendingCost += r.calculatedCost || 0;
      }
    });

    return {
      totalRecords: filteredRecords.length,
      totalHours: Number(totalHours.toFixed(1)),
      regularHours: Number(regularHours.toFixed(1)),
      overtimeHours: Number(overtimeHours.toFixed(1)),
      totalCost: Number(totalCost.toFixed(2)),
      approvedCost: Number(approvedCost.toFixed(2)),
      pendingCost: Number(pendingCost.toFixed(2)),
    };
  }, [filteredRecords]);

  // Print Legal Inspection Report
  const handlePrintLegalReport = () => {
    window.print();
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      alert('No hay registros de jornada para exportar en el filtro actual.');
      return;
    }

    const headers = [
      'ID Fichaje',
      'Fecha',
      'Trabajador',
      'DNI',
      'Categoría',
      'Obra',
      'Hora Entrada',
      'Hora Salida',
      'Pausa (min)',
      'Horas Totales',
      'Horas Ordinarias',
      'Horas Extras',
      'Tarifa Ord (€/h)',
      'Tarifa Extra (€/h)',
      'Coste Jornada (€)',
      'Estado Aprobación',
      'Capataz Validador',
      'Fecha Aprobación',
      'Imputado a Obra',
      'Observaciones'
    ];

    const rows = filteredRecords.map(r => {
      const rStatus = r.approvalStatus || (r.personalCostId ? 'approved' : 'pending');
      const isApproved = rStatus === 'approved';
      return [
        `"${r.id}"`,
        `"${r.date}"`,
        `"${r.workerName}"`,
        `"${r.workerDni || ''}"`,
        `"${r.role}"`,
        `"${r.obraName}"`,
        `"${r.clockIn}"`,
        `"${r.clockOut}"`,
        r.breakMinutes,
        r.totalHours,
        r.regularHours,
        r.overtimeHours,
        r.hourlyRate,
        r.overtimeRate,
        r.calculatedCost,
        `"${rStatus.toUpperCase()}"`,
        `"${r.foremanName || ''}"`,
        `"${r.approvedAt || ''}"`,
        isApproved ? '"SÍ (Coste Asignado)"' : '"NO (Pendiente/Rechazado)"',
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Registro_Horario_Aprobado_Capataz_${filterMonth || 'Total'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Legal Badge */}
      <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 shadow-sm no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Clock className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  Control Horario y Registro de Jornadas
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Homologado RDL 8/2019
                  </span>
                </h2>
                <p className="text-xs text-white/50">
                  Firma digital en obra con validación y aprobación digital del Capataz previa a la imputación a los costes de personal.
                </p>
              </div>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex flex-wrap bg-black/40 border border-white/5 p-1 rounded-xl self-start lg:self-auto gap-1">
            <button
              onClick={() => setActiveSubTab('terminal')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'terminal'
                  ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Terminal de Fichaje
            </button>

            {/* Portal Móvil (QR) Tab */}
            <button
              onClick={() => setActiveSubTab('portalMovil')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
                activeSubTab === 'portalMovil'
                  ? 'bg-amber-400 text-black shadow-sm font-extrabold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Portal Móvil (QR)
              {activeWorkersList.length > 0 && (
                <span className="ml-1 bg-emerald-500 text-black font-black text-[10px] px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">
                  {activeWorkersList.length} en obra
                </span>
              )}
            </button>

            {/* Aprobación Capataz Tab with Alert Counter Badge */}
            <button
              onClick={() => setActiveSubTab('aprobaciones')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
                activeSubTab === 'aprobaciones'
                  ? 'bg-amber-400 text-black shadow-sm font-extrabold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Aprobaciones Capataz
              {pendingApprovalsCount > 0 && (
                <span className="ml-1 bg-amber-500 text-black font-black text-[10px] px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('historial')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'historial'
                  ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Historial y Auditoría ({fichajes.length})
            </button>

            <button
              onClick={() => setActiveSubTab('informeLegal')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'informeLegal'
                  ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Libro Oficial Inspección
            </button>

            {/* Quick button to open mobile portal */}
            <button
              onClick={() => onOpenWorkerPortal ? onOpenWorkerPortal() : window.open(portalUrl, '_blank')}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer ml-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Portal Operario
            </button>
          </div>
        </div>
      </div>

      {/* 2. TAB A: TERMINAL DE FICHAJE RÁPIDO Y FIRMA DIGITAL */}
      {activeSubTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
          {/* Worker Mobile Portal Alert Banner */}
          <div className="lg:col-span-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-amber-300 font-bold block">¿Prefieres que los operarios fichen directamente desde su propio teléfono móvil?</strong>
                <span className="text-slate-300 text-[11px]">
                  Pueden escanear el Código QR en la caseta de obra o abrir el portal en su smartphone para registrar Entrada y Salida con firma digital.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveSubTab('portalMovil')}
                className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                Ver Cartel QR y Operarios en Vivo ({activeWorkersList.length})
              </button>
            </div>
          </div>

          {/* Left Form: Shift Setup */}
          <div className="lg:col-span-7 bg-[#151515] border border-white/5 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  Registro de Jornada del Operario
                </h3>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Firma digital en pie de obra. La jornada se enviará al Capataz para su aprobación digital preceptiva.
                </p>
              </div>

              {/* Mode switch: Single vs Cuadrilla */}
              <button
                type="button"
                onClick={() => setIsCuadrillaMode(!isCuadrillaMode)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isCuadrillaMode 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                    : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {isCuadrillaMode ? 'Modo Cuadrilla Activado' : 'Fichar Cuadrilla Completa'}
              </button>
            </div>

            <form onSubmit={isCuadrillaMode ? handleCuadrillaSubmit : handleRegisterFichaje} className="space-y-4">
              {/* Worker Selection */}
              {!isCuadrillaMode ? (
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5">
                    Operario / Trabajador en Plantilla <span className="text-emerald-400">*</span>
                  </label>
                  {trabajadoresEmpresa.length === 0 ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      No hay operarios registrados en la plantilla. Añade operarios desde la pestaña "Personal de Obra".
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={workerId}
                        onChange={(e) => setWorkerId(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:border-emerald-500 focus:outline-none w-full"
                        required
                      >
                        {trabajadoresEmpresa.map(w => (
                          <option key={w.id} value={w.id} className="bg-[#1A1A1A] text-white">
                            {w.name} ({w.role || 'Operario'}) {w.dni ? `- ${w.dni}` : ''}
                          </option>
                        ))}
                      </select>

                      {/* Role and Rates display */}
                      <div className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 flex flex-col justify-center text-[11px]">
                        <span className="text-white/40 block">Tarifa Aplicada:</span>
                        <div className="flex items-center gap-2 font-mono font-bold text-emerald-400 mt-0.5">
                          <span>Ord: {calculation.hourlyRate.toFixed(2)} €/h</span>
                          <span className="text-white/20">|</span>
                          <span className="text-amber-400">Extra: {calculation.overtimeRate.toFixed(2)} €/h</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1.5">
                    Seleccionar Cuadrilla de Operarios ({selectedCuadrillaIds.length} seleccionados) <span className="text-emerald-400">*</span>
                  </label>
                  <div className="max-h-40 overflow-y-auto bg-black/40 border border-white/10 rounded-xl p-2.5 space-y-1.5">
                    {trabajadoresEmpresa.map(w => {
                      const isChecked = selectedCuadrillaIds.includes(w.id);
                      return (
                        <label 
                          key={w.id} 
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isChecked ? 'bg-emerald-500/15 border border-emerald-500/30 text-white' : 'hover:bg-white/5 text-white/70'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCuadrillaIds(prev => [...prev, w.id]);
                                } else {
                                  setSelectedCuadrillaIds(prev => prev.filter(id => id !== w.id));
                                }
                              }}
                              className="accent-emerald-500 rounded"
                            />
                            <span className="font-bold">{w.name}</span>
                            <span className="text-[10px] text-white/40">({w.role || 'Operario'})</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400">
                            {w.dailyRate ? `${w.dailyRate}€/día` : `${(w.standardHourlyRate || 15)}€/h`}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Obra Destination */}
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5">
                  Obra de Ejecución <span className="text-emerald-400">*</span>
                </label>
                <select
                  value={obraId}
                  onChange={(e) => setObraId(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-medium focus:border-emerald-500 focus:outline-none w-full"
                  required
                >
                  {obras.map(o => (
                    <option key={o.id} value={o.id} className="bg-[#1A1A1A] text-white">
                      {o.name} ({o.location})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Shift Times */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Hora Entrada</label>
                  <input
                    type="time"
                    value={clockIn}
                    onChange={(e) => setClockIn(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Hora Salida</label>
                  <input
                    type="time"
                    value={clockOut}
                    onChange={(e) => setClockOut(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white/60 mb-1">Pausa (Comida/Descanso)</label>
                  <select
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value))}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none w-full"
                  >
                    <option value={0}>Sin pausa</option>
                    <option value={30}>30 minutos</option>
                    <option value={60}>1 hora (60 min)</option>
                    <option value={90}>1 h 30 min</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
              </div>

              {/* Notes or Incident details */}
              <div>
                <label className="block text-[11px] font-bold text-white/60 mb-1">
                  Observaciones o Tareas Ejecutadas (Opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Encofrado de pilares planta 1, zanjas de saneamiento..."
                  className="bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 focus:border-emerald-500 focus:outline-none w-full"
                />
              </div>

              {/* Information Notice about Capataz Approval Requirement */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-bold block text-amber-200">Aprobación obligatoria del Capataz de Obra:</span>
                  Al firmar esta jornada, quedará registrada y sellada legalmente, pero el coste de <strong className="font-mono text-white">{calculation.totalCost.toFixed(2)} €</strong> NO se sumará a los gastos de personal de la obra hasta que el capataz la valide y apruebe con su firma digital en la pestaña "Aprobaciones Capataz".
                </div>
              </div>

              {/* Cuadrilla Submit button */}
              {isCuadrillaMode && (
                <button
                  type="submit"
                  disabled={!hasSignature || selectedCuadrillaIds.length === 0}
                  className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
                >
                  <Layers className="w-4 h-4" />
                  Firmar y Enviar {selectedCuadrillaIds.length} Jornadas a Aprobación del Capataz
                </button>
              )}
            </form>
          </div>

          {/* Right Col: Calculation Preview & Signature Canvas */}
          <div className="lg:col-span-5 space-y-6">
            {/* Calculation Card */}
            <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xs uppercase font-extrabold tracking-wider text-white/50">Cálculo de Jornada</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-mono font-bold">
                  Convenio Construcción
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/40 block">Total Efectivas</span>
                  <span className="text-lg font-black font-mono text-white block mt-0.5">
                    {calculation.totalHours} h
                  </span>
                </div>
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/40 block">Ordinarias</span>
                  <span className="text-lg font-black font-mono text-emerald-400 block mt-0.5">
                    {calculation.regularHours} h
                  </span>
                </div>
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[10px] text-white/40 block">Extraordinarias</span>
                  <span className="text-lg font-black font-mono text-amber-400 block mt-0.5">
                    {calculation.overtimeHours} h
                  </span>
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-white/50 block">Coste Estimado a Imputar en Obra:</span>
                  <span className="text-[11px] font-mono text-white/70">
                    {calculation.regularHours}h x {calculation.hourlyRate.toFixed(2)}€ + {calculation.overtimeHours}h x {calculation.overtimeRate.toFixed(2)}€
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-mono font-black text-emerald-400">
                    {calculation.totalCost.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>

            {/* Signature Pad */}
            <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-emerald-400" />
                    Firma Manuscrita del Operario
                  </h4>
                  <span className="text-[10px] text-white/40">Garantía fehaciente obligatoria por ley</span>
                </div>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-[11px] text-white/40 hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpiar
                </button>
              </div>

              {/* The Signature Canvas */}
              <div className="relative border-2 border-dashed border-emerald-500/30 rounded-2xl bg-black/60 overflow-hidden flex flex-col items-center justify-center touch-none">
                <canvas
                  ref={canvasRef}
                  width={420}
                  height={180}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="cursor-crosshair w-full h-[160px]"
                />

                {!hasSignature && (
                  <div className="absolute pointer-events-none flex flex-col items-center justify-center text-white/30 text-xs space-y-1">
                    <PenTool className="w-6 h-6 stroke-1 text-white/20 animate-bounce" />
                    <span>Firme aquí con el dedo o ratón</span>
                  </div>
                )}

                <div className="w-full bg-black/80 border-t border-white/5 px-3 py-1.5 flex justify-between items-center text-[10px] text-white/40">
                  <span>Marca temporal: {new Date().toLocaleTimeString()}</span>
                  <span className={hasSignature ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {hasSignature ? '✓ Firma Capturada' : 'Esperando firma...'}
                  </span>
                </div>
              </div>

              {/* Legal Disclaimer Box */}
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-[10px] text-white/50 leading-relaxed">
                <span className="font-bold text-white/70 block mb-0.5">
                  ⚖️ Declaración de Conformidad Laboral:
                </span>
                El firmante declara bajo su responsabilidad la exactitud de los horarios indicados y su presencia en obra (art. 34.9 ET y RDL 8/2019).
              </div>

              {/* Direct Single Worker Submit */}
              {!isCuadrillaMode && (
                <button
                  type="button"
                  onClick={handleRegisterFichaje}
                  disabled={!hasSignature || !workerId || !obraId}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-extrabold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-emerald-500/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  Firmar y Enviar a Validación del Capataz ({calculation.totalCost.toFixed(2)} €)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2.5 TAB: PORTAL MÓVIL DEL OPERARIO Y CÓDIGO QR PARA CASETA DE OBRA */}
      {activeSubTab === 'portalMovil' && (
        <div className="space-y-6 no-print">
          {/* Header Banner */}
          <div className="bg-[#18181B] border border-amber-500/20 rounded-2xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      Acceso Autónomo para Trabajadores
                    </span>
                    <span className="text-white/40 text-xs">• Control Horario en Smartphone</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-0.5">
                    Portal de Fichaje Móvil con Código QR
                  </h3>
                  <p className="text-xs text-white/60">
                    Los operarios registran su <strong>Entrada</strong> y <strong>Salida</strong> con firma digital desde su teléfono. Los registros y el <strong>gasto de mano de obra</strong> se imputan automáticamente a la obra correspondiente en tiempo real.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <button
                  onClick={() => onOpenWorkerPortal ? onOpenWorkerPortal() : window.open(portalUrl, '_blank')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg hover:shadow-amber-500/20 transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir Vista Operario
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Card: QR Poster for Construction Cabin */}
            <div className="lg:col-span-6 bg-[#151515] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="w-full flex items-center justify-between border-b border-white/5 pb-3 text-left">
                <div>
                  <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-amber-400" />
                    Cartel de Fichaje para la Caseta de Obra
                  </h4>
                  <p className="text-[11px] text-white/50">
                    Imprime este cartel y colócalo en la entrada de la obra para que los trabajadores lo escaneen con la cámara.
                  </p>
                </div>
              </div>

              {/* Obra filter for QR */}
              <div className="w-full text-left">
                <label className="text-xs text-white/60 font-semibold block mb-1">
                  Obra asignada al cartel QR:
                </label>
                <select
                  value={qrObraFilter}
                  onChange={(e) => setQrObraFilter(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                >
                  <option value="all">Todas las Obras (El operario elige su obra al fichar)</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.name} {o.location ? `(${o.location})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* QR Image Box */}
              <div className="p-4 bg-white rounded-2xl border-4 border-amber-500/40 shadow-2xl inline-block my-2">
                {qrCodeDataUrl ? (
                  <img 
                    src={qrCodeDataUrl} 
                    alt="Código QR de Fichaje de Obra" 
                    className="w-64 h-64 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-slate-800 text-xs">
                    Generando Código QR...
                  </div>
                )}
                <div className="mt-2 text-center text-slate-800 font-extrabold text-[11px] uppercase tracking-wider">
                  Escanea para Fichar Entrada / Salida
                </div>
              </div>

              {/* Shareable Link Box */}
              <div className="w-full bg-black/40 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-2 text-left">
                <div className="truncate text-[11px] text-white/70 font-mono">
                  {portalUrl}
                </div>
                <button
                  onClick={copyPortalLink}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Enlace
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="w-full grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Cartel de Fichaje - Control Horario de Obra</title>
                            <style>
                              body { font-family: sans-serif; text-align: center; padding: 40px; margin: 0; background: #fff; color: #111; }
                              .card { border: 4px solid #f59e0b; border-radius: 20px; padding: 30px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                              h1 { font-size: 24px; margin: 0 0 10px; color: #0f172a; text-transform: uppercase; }
                              p { font-size: 14px; color: #475569; margin: 5px 0 20px; }
                              img { width: 280px; height: 280px; margin: 10px auto; display: block; }
                              .badge { background: #fef3c7; color: #b45309; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; display: inline-block; margin-bottom: 15px; }
                              .steps { text-align: left; background: #f8fafc; padding: 15px 20px; border-radius: 12px; font-size: 13px; color: #334155; margin-top: 20px; line-height: 1.6; }
                              .legal { font-size: 10px; color: #94a3b8; margin-top: 25px; }
                            </style>
                          </head>
                          <body>
                            <div class="card">
                              <span class="badge">CONTROL HORARIO HOMOLOGADO (RDL 8/2019)</span>
                              <h1>PUNTO DE FICHAJE DE OBRA</h1>
                              <p>Apunta con la cámara de tu smartphone para registrar tu jornada laboral.</p>
                              <img src="${qrCodeDataUrl}" alt="QR Fichaje" />
                              <div class="steps">
                                <strong>Instrucciones para el Operario:</strong><br/>
                                1. Abre la cámara de tu teléfono móvil.<br/>
                                2. Enfoca al código QR y pulsa en el enlace que aparece.<br/>
                                3. Selecciona tu nombre y pulsa <strong>"Registrar Entrada"</strong>.<br/>
                                4. Al terminar el turno, pulsa <strong>"Registrar Salida"</strong> y firma en pantalla.
                              </div>
                              <div class="legal">
                                Cumplimiento obligatorio según el Real Decreto-ley 8/2019 de registro de jornada laboral.
                              </div>
                            </div>
                            <script>window.onload = function() { window.print(); }</script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }}
                  className="py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Cartel A4
                </button>
                <button
                  onClick={() => onOpenWorkerPortal ? onOpenWorkerPortal() : window.open(portalUrl, '_blank')}
                  className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <Smartphone className="w-4 h-4" />
                  Abrir en Pantalla
                </button>
              </div>
            </div>

            {/* Right Card: Live Monitoring of Active Workers */}
            <div className="lg:col-span-6 bg-[#151515] border border-white/5 rounded-2xl p-6 shadow-sm flex flex-col space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                      Operarios en Obra Ahora Mismo
                    </h4>
                    <p className="text-[11px] text-white/50">
                      Monitor en tiempo real de turnos activos fichados desde los teléfonos móviles
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full font-bold text-xs font-mono">
                  {activeWorkersList.length} en jornada
                </span>
              </div>

              {/* Active Workers List */}
              {activeWorkersList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-white/5 rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/30 mb-3">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h5 className="text-sm font-bold text-white mb-1">No hay operarios en jornada activa</h5>
                  <p className="text-xs text-white/50 max-w-sm">
                    En cuanto un trabajador abra el portal en su smartphone y registre su entrada, aparecerá aquí al instante con su contador de tiempo en vivo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                  {activeWorkersList.map((worker) => {
                    const diffSec = Math.max(0, Math.floor((liveNow - (worker.clockInTimestamp || Date.now())) / 1000));
                    const h = Math.floor(diffSec / 3600);
                    const m = Math.floor((diffSec % 3600) / 60);
                    const s = diffSec % 60;
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    const elapsedStr = `${pad(h)}h ${pad(m)}m ${pad(s)}s`;

                    return (
                      <div
                        key={worker.id}
                        className="bg-black/40 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-md hover:border-emerald-500/60 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
                            {worker.workerName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-white">{worker.workerName}</span>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono font-bold">
                                ACTIVO
                              </span>
                            </div>
                            <div className="text-xs text-white/60 flex items-center gap-2 mt-0.5">
                              <span className="text-amber-400 font-semibold">{worker.obraName}</span>
                              <span>•</span>
                              <span>Entrada: {worker.clockIn}h</span>
                            </div>
                            {worker.locationCoords && (
                              <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
                                <MapPin className="w-2.5 h-2.5" />
                                <span>GPS Registrado (±{worker.locationCoords.accuracy || 10}m)</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-white/40 block uppercase tracking-wider">Tiempo en obra</span>
                          <span className="text-base font-black text-emerald-300 font-mono">
                            {elapsedStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Explanatory callout for automatic cost allocation */}
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  Imputación Automática de Costes de Personal a la Obra
                </div>
                <p className="text-white/70 text-[11px] leading-relaxed">
                  Cuando el operario pulsa <strong>&ldquo;Registrar Salida y Firmar&rdquo;</strong> desde su móvil, el sistema calcula de forma instantánea sus horas ordinarias y extras según su categoría salarial y <strong>añade de inmediato el gasto de mano de obra</strong> al presupuesto de la obra indicada.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB B: APROBACIONES DE CAPATAZ (NUEVA FUNCIONALIDAD REQUERIDA) */}
      {activeSubTab === 'aprobaciones' && (
        <div className="space-y-6 no-print">
          {/* Capataz Configuration Banner */}
          <div className="bg-[#18181B] border border-amber-500/20 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      Puesto de Mando del Capataz
                    </span>
                    <span className="text-white/40 text-xs">• Control Previo de Imputación</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-0.5">
                    Validación Digital Previa de Partes de Trabajo
                  </h3>
                  <p className="text-xs text-white/60">
                    Ningún coste de personal se asigna al presupuesto de la obra sin la rúbrica digital fehaciente del Capataz.
                  </p>
                </div>
              </div>

              {/* Capataz Info Box */}
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl p-2.5">
                <div className="text-right">
                  <span className="text-[10px] text-white/40 block">Capataz Activo:</span>
                  <span className="text-xs font-black text-white block">{foremanName}</span>
                  <span className="text-[10px] text-amber-400 font-mono">{foremanRole}</span>
                </div>
                <button
                  onClick={() => setIsEditingForeman(!isEditingForeman)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-xs font-bold cursor-pointer"
                  title="Cambiar datos del capataz"
                >
                  {isEditingForeman ? 'Guardar' : 'Editar'}
                </button>
              </div>
            </div>

            {/* Editable Foreman info bar */}
            {isEditingForeman && (
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Nombre y Apellidos del Capataz</label>
                  <input
                    type="text"
                    value={foremanName}
                    onChange={(e) => setForemanName(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white w-full focus:border-amber-400 focus:outline-none"
                    placeholder="Ej: Manuel Roldán (Capataz General)"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Cargo en Obra</label>
                  <select
                    value={foremanRole}
                    onChange={(e) => setForemanRole(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white w-full focus:border-amber-400 focus:outline-none"
                  >
                    <option value="Capataz de Obra">Capataz de Obra</option>
                    <option value="Encargado General">Encargado General</option>
                    <option value="Jefe de Obra">Jefe de Obra</option>
                    <option value="Responsable de Cuadrilla">Responsable de Cuadrilla</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Subfilter & Batch Action Bar */}
          <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Status Tabs */}
            <div className="flex bg-black/40 border border-white/5 p-1 rounded-xl self-start">
              <button
                onClick={() => setApprovalTabFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  approvalTabFilter === 'pending'
                    ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <span>Pendientes</span>
                <span className="bg-black/20 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  {fichajes.filter(f => f.approvalStatus === 'pending' || (!f.approvalStatus && !f.personalCostId)).length}
                </span>
              </button>
              <button
                onClick={() => setApprovalTabFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  approvalTabFilter === 'approved'
                    ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <span>Aprobadas</span>
                <span className="bg-black/20 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  {fichajes.filter(f => f.approvalStatus === 'approved' || (!f.approvalStatus && f.personalCostId)).length}
                </span>
              </button>
              <button
                onClick={() => setApprovalTabFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  approvalTabFilter === 'rejected'
                    ? 'bg-rose-500 text-white shadow-sm font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <span>Rechazadas</span>
                <span className="bg-black/20 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                  {fichajes.filter(f => f.approvalStatus === 'rejected').length}
                </span>
              </button>
              <button
                onClick={() => setApprovalTabFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  approvalTabFilter === 'all'
                    ? 'bg-white/20 text-white font-extrabold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Todas ({fichajes.length})
              </button>
            </div>

            {/* Obra Filter & Batch Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterObra}
                onChange={(e) => setFilterObra(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                <option value="all">Todas las Obras ({obras.length})</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>

              {/* Batch Approval Trigger */}
              {approvalTabFilter === 'pending' && selectedPendingIds.length > 0 && (
                <button
                  onClick={handleOpenBatchApproveModal}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg animate-bounce"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprobar Lote Seleccionado ({selectedPendingIds.length})
                </button>
              )}
            </div>
          </div>

          {/* Cards / Table List of Shifts for Capataz Review */}
          {approvalTabRecords.length === 0 ? (
            <div className="bg-[#151515] border border-white/5 rounded-2xl p-12 text-center text-white/40 space-y-2">
              <UserCheck className="w-10 h-10 mx-auto text-white/20" />
              <p className="text-sm font-bold text-white/70">
                {approvalTabFilter === 'pending' 
                  ? '¡Al día! No hay jornadas pendientes de aprobación en este momento.' 
                  : 'No constan jornadas con el filtro seleccionado.'}
              </p>
              <p className="text-xs">
                Cuando los operarios firmen su entrada y salida en la terminal, aparecerán aquí para tu validación digital.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Batch Select All Header if pending */}
              {approvalTabFilter === 'pending' && (
                <div className="flex justify-between items-center px-4 py-2 bg-black/30 rounded-xl text-xs text-white/60">
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={selectedPendingIds.length > 0 && selectedPendingIds.length === approvalTabRecords.filter(r => (r.approvalStatus === 'pending' || !r.approvalStatus)).length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allPending = approvalTabRecords.filter(r => (r.approvalStatus === 'pending' || !r.approvalStatus)).map(r => r.id);
                          setSelectedPendingIds(allPending);
                        } else {
                          setSelectedPendingIds([]);
                        }
                      }}
                      className="accent-emerald-500 rounded"
                    />
                    <span>Seleccionar todas las jornadas pendientes ({approvalTabRecords.length})</span>
                  </label>
                  <span>{selectedPendingIds.length} seleccionadas</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {approvalTabRecords.map((record) => {
                  const rStatus = record.approvalStatus || (record.personalCostId ? 'approved' : 'pending');
                  const isPending = rStatus === 'pending';
                  const isApproved = rStatus === 'approved';
                  const isRejected = rStatus === 'rejected';
                  const isSelected = selectedPendingIds.includes(record.id);

                  return (
                    <div 
                      key={record.id}
                      className={`bg-[#151515] border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between space-y-4 ${
                        isSelected 
                          ? 'border-emerald-500/50 bg-emerald-500/[0.03]' 
                          : isPending 
                            ? 'border-amber-500/25 hover:border-amber-500/40' 
                            : isApproved 
                              ? 'border-emerald-500/20' 
                              : 'border-rose-500/20'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Top Card Bar: Checkbox (if pending) & Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isPending && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPendingIds(prev => [...prev, record.id]);
                                  } else {
                                    setSelectedPendingIds(prev => prev.filter(id => id !== record.id));
                                  }
                                }}
                                className="accent-emerald-500 rounded w-4 h-4 cursor-pointer"
                              />
                            )}
                            <div>
                              <span className="font-bold text-white text-sm block">{record.workerName}</span>
                              <span className="text-[10px] text-white/50 block font-mono">
                                {record.role} {record.workerDni ? `• ${record.workerDni}` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Approval Status Badge */}
                          {isPending && (
                            <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              Pendiente Capataz
                            </span>
                          )}
                          {isApproved && (
                            <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
                              <CheckCircle className="w-3 h-3" />
                              Aprobada
                            </span>
                          )}
                          {isRejected && (
                            <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0">
                              <XCircle className="w-3 h-3" />
                              Rechazada
                            </span>
                          )}
                        </div>

                        {/* Obra and Timing Details */}
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-white/40 text-[10.5px]">Obra de trabajo:</span>
                            <span className="font-bold text-emerald-400 truncate max-w-[170px]">{record.obraName}</span>
                          </div>

                          <div className="flex justify-between items-center font-mono">
                            <span className="text-white/40 text-[10.5px]">Fecha y Turno:</span>
                            <span className="text-white font-bold">{record.date} ({record.clockIn} - {record.clockOut})</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-white/40 text-[10.5px]">Horas Computadas:</span>
                            <span className="font-bold text-white font-mono">
                              {record.totalHours} h {record.overtimeHours > 0 && <span className="text-amber-400 text-[10px]">(+{record.overtimeHours}h extra)</span>}
                            </span>
                          </div>

                          <div className="border-t border-white/5 pt-2 flex justify-between items-center font-bold">
                            <span className="text-white/50 text-[10.5px]">Coste a Imputar:</span>
                            <span className="font-mono text-sm text-[#10B981]">
                              {record.calculatedCost.toFixed(2)} €
                            </span>
                          </div>
                        </div>

                        {/* Signatures Proof Section */}
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          {/* Worker Signature Thumb */}
                          <div className="bg-black/30 border border-white/5 rounded-xl p-2 text-center">
                            <span className="text-white/40 block text-[9px] mb-1">Firma Operario:</span>
                            {record.workerSignature ? (
                              <img
                                src={record.workerSignature}
                                alt="Firma Operario"
                                className="h-7 w-auto mx-auto object-contain filter invert opacity-90"
                              />
                            ) : (
                              <span className="text-rose-400">Sin firma</span>
                            )}
                          </div>

                          {/* Capataz Signature Thumb */}
                          <div className="bg-black/30 border border-white/5 rounded-xl p-2 text-center">
                            <span className="text-white/40 block text-[9px] mb-1">Firma Capataz:</span>
                            {record.foremanSignature ? (
                              <img
                                src={record.foremanSignature}
                                alt="Firma Capataz"
                                className="h-7 w-auto mx-auto object-contain filter invert opacity-90"
                              />
                            ) : (
                              <span className="text-amber-400/80 italic text-[9px]">Pendiente de rúbrica</span>
                            )}
                          </div>
                        </div>

                        {/* Rejection reason if any */}
                        {isRejected && record.rejectionReason && (
                          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10.5px] text-rose-300">
                            <strong>Motivo de rechazo:</strong> {record.rejectionReason}
                          </div>
                        )}

                        {/* Foreman notes if approved */}
                        {isApproved && record.foremanName && (
                          <div className="p-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-[10px] text-emerald-300 flex items-center justify-between">
                            <span>Aprobado por: <strong>{record.foremanName}</strong></span>
                            <span className="font-mono text-white/40">{record.approvedAt?.slice(0, 10)}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingRecord(record)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Inspeccionar todos los detalles"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detalles
                        </button>

                        {isPending && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenRejectModal(record)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors text-xs font-bold cursor-pointer"
                              title="Rechazar jornada"
                            >
                              Rechazar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenApproveModal(record)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                              title="Aprobar con rúbrica digital"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Aprobar
                            </button>
                          </div>
                        )}

                        {isApproved && (
                          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Coste imputado a obra
                          </span>
                        )}

                        {isRejected && (
                          <button
                            type="button"
                            onClick={() => handleOpenApproveModal(record)}
                            className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-bold cursor-pointer"
                          >
                            Reconsiderar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB C: HISTORIAL COMPLETO, FILTROS Y AUDITORÍA */}
      {activeSubTab === 'historial' && (
        <div className="space-y-6 no-print">
          {/* KPI Cards Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Jornadas Registradas</span>
              <span className="text-2xl font-black font-mono text-white mt-1 block">
                {historyMetrics.totalRecords}
              </span>
              <span className="text-[10px] text-emerald-400 mt-0.5 block flex items-center gap-1 font-medium">
                <CheckCircle className="w-3 h-3" /> 100% Firmadas Digitalmente
              </span>
            </div>

            <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Horas Totales Computadas</span>
              <span className="text-2xl font-black font-mono text-emerald-400 mt-1 block">
                {historyMetrics.totalHours} h
              </span>
              <span className="text-[10px] text-white/50 mt-0.5 block">
                {historyMetrics.regularHours}h ord. • {historyMetrics.overtimeHours}h extra
              </span>
            </div>

            <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Coste Aprobado en Obra</span>
              <span className="text-2xl font-black font-mono text-[#10B981] mt-1 block">
                {historyMetrics.approvedCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-emerald-400/80 mt-0.5 block">
                Asignado a presupuestos de obra
              </span>
            </div>

            <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 block">Pendiente Aprobación</span>
              <span className="text-2xl font-black font-mono text-amber-400 mt-1 block">
                {historyMetrics.pendingCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-amber-400/80 mt-0.5 block">
                No computa en obra aún
              </span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-1">
              <div>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none w-full"
                />
              </div>

              <div>
                <select
                  value={filterWorker}
                  onChange={(e) => setFilterWorker(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none w-full"
                >
                  <option value="all">Todos los Operarios ({trabajadoresEmpresa.length})</option>
                  {trabajadoresEmpresa.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterObra}
                  onChange={(e) => setFilterObra(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none w-full"
                >
                  <option value="all">Todas las Obras ({obras.length})</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterApprovalStatus}
                  onChange={(e) => setFilterApprovalStatus(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none w-full font-bold"
                >
                  <option value="all">Todos los Estados</option>
                  <option value="pending">⏳ Pendiente Capataz</option>
                  <option value="approved">✓ Aprobado por Capataz</option>
                  <option value="rejected">✕ Rechazado</option>
                </select>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Excel
              </button>

              <button
                onClick={() => setActiveSubTab('informeLegal')}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Libro Legal
              </button>
            </div>
          </div>

          {/* Table of Work Shifts */}
          <div className="bg-[#151515] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-white/40 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-white/20" />
                <p className="text-sm font-bold text-white/60">No hay registros de jornada con los filtros seleccionados.</p>
                <p className="text-xs">Usa el "Terminal de Fichaje" para registrar la primera jornada con firma digital.</p>
              </div>
            ) : (
              <div>
                {/* Mobile Responsive Cards View (Phones / Narrow Viewports) */}
                <div className="block md:hidden divide-y divide-white/5 p-3 space-y-3">
                  {filteredRecords.map(record => {
                    const rStatus = record.approvalStatus || (record.personalCostId ? 'approved' : 'pending');
                    const isPending = rStatus === 'pending';
                    const isApproved = rStatus === 'approved';
                    const isRejected = rStatus === 'rejected';

                    return (
                      <div key={`m-${record.id}`} className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-3 shadow-xs">
                        {/* Header: Date + Status */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-white text-xs bg-white/5 px-2.5 py-1 rounded-lg">
                            {record.date}
                          </span>
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              Pendiente Capataz
                            </span>
                          )}
                          {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle className="w-3 h-3" />
                              Aprobado
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <XCircle className="w-3 h-3" />
                              Rechazado
                            </span>
                          )}
                        </div>

                        {/* Worker & Role */}
                        <div>
                          <div className="font-bold text-white text-sm">{record.workerName}</div>
                          <div className="text-[11px] text-white/50 font-mono mt-0.5">
                            {record.role} {record.workerDni ? `• ${record.workerDni}` : ''}
                          </div>
                        </div>

                        {/* Obra & Schedule details */}
                        <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-white/40 text-[11px]">Obra:</span>
                            <button
                              onClick={() => onNavigateToObra && onNavigateToObra(record.obraId)}
                              className="text-emerald-400 hover:underline font-bold text-right truncate max-w-[190px]"
                            >
                              {record.obraName}
                            </button>
                          </div>
                          <div className="flex justify-between items-center font-mono">
                            <span className="text-white/40 text-[11px]">Horario:</span>
                            <span className="text-white">{record.clockIn} - {record.clockOut} {record.breakMinutes > 0 ? `(Pausa: ${record.breakMinutes}m)` : ''}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/40 text-[11px]">Horas Efectivas:</span>
                            <span className="font-bold font-mono text-white">
                              {record.totalHours} h {record.overtimeHours > 0 && <span className="text-amber-400 text-[10px]">(+{record.overtimeHours}h extra)</span>}
                            </span>
                          </div>
                          <div className="border-t border-white/5 pt-1.5 flex justify-between items-center">
                            <span className="text-white/50 text-[11px] font-medium">Coste Jornada:</span>
                            <span className={`font-mono font-black text-sm ${isApproved ? 'text-emerald-400' : 'text-white/70'}`}>
                              {record.calculatedCost.toFixed(2)} €
                            </span>
                          </div>
                        </div>

                        {/* Signatures status */}
                        <div className="flex items-center justify-between text-[11px] text-white/50 bg-white/[0.02] p-2 rounded-xl">
                          <span className="flex items-center gap-1">
                            {record.workerSignature ? <span className="text-emerald-400">✓ Firma Operario</span> : <span className="text-rose-400">✕ Sin firma operario</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            {record.foremanSignature ? <span className="text-sky-400">✓ VºBº Capataz</span> : <span className="text-amber-400">⏳ Pendiente Capataz</span>}
                          </span>
                        </div>

                        {/* Actions buttons on mobile with min-h-[44px] touch target */}
                        <div className="flex items-center gap-2 pt-1">
                          {isPending && (
                            <button
                              onClick={() => handleOpenApproveModal(record)}
                              className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Check className="w-4 h-4" />
                              Aprobar
                            </button>
                          )}
                          <button
                            onClick={() => setViewingRecord(record)}
                            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            Certificado
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar este registro de jornada de ${record.workerName}? Se retirará también automáticamente cualquier imputación de costes en la obra.`)) {
                                onDeleteFichaje(record.id);
                              }
                            }}
                            className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-rose-400 flex items-center justify-center border border-white/10 cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Full Table (hidden on mobile, shown on md+) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-black/40 border-b border-white/5 text-[11px] font-extrabold uppercase tracking-wider text-white/40">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Operario</th>
                        <th className="py-3 px-4">Obra Asignada</th>
                        <th className="py-3 px-4">Horario</th>
                        <th className="py-3 px-4 text-center">Horas</th>
                        <th className="py-3 px-4 text-right">Coste Jornada</th>
                        <th className="py-3 px-4 text-center">Estado Capataz</th>
                        <th className="py-3 px-4 text-center">Firmas</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredRecords.map(record => {
                        const rStatus = record.approvalStatus || (record.personalCostId ? 'approved' : 'pending');
                        const isPending = rStatus === 'pending';
                        const isApproved = rStatus === 'approved';
                        const isRejected = rStatus === 'rejected';

                        return (
                          <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-white/90 whitespace-nowrap">
                              {record.date}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-white block">{record.workerName}</span>
                              <span className="text-[10px] text-white/40 block font-mono">
                                {record.workerDni || record.role}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => onNavigateToObra && onNavigateToObra(record.obraId)}
                                className="text-emerald-400 hover:underline font-bold text-left block truncate max-w-[170px]"
                              >
                                {record.obraName}
                              </button>
                              <span className="text-[9px] text-white/40 flex items-center gap-1 mt-0.5">
                                {isApproved ? (
                                  <span className="text-emerald-400 flex items-center gap-0.5">
                                    <CheckCircle className="w-2.5 h-2.5" /> Gasto imputado
                                  </span>
                                ) : (
                                  <span className="text-amber-400 flex items-center gap-0.5">
                                    <Clock className="w-2.5 h-2.5" /> Sin imputar a obra
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <span className="text-white/80">{record.clockIn} - {record.clockOut}</span>
                              {record.breakMinutes > 0 && (
                                <span className="text-[10px] text-white/40 block">
                                  Pausa: {record.breakMinutes} min
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono">
                              <span className="font-extrabold text-white">{record.totalHours} h</span>
                              {record.overtimeHours > 0 && (
                                <span className="text-[10px] text-amber-400 block font-bold">
                                  +{record.overtimeHours}h extra
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                              <span className={isApproved ? 'text-emerald-400' : 'text-white/50'}>
                                {record.calculatedCost.toFixed(2)} €
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  <Clock className="w-3 h-3" />
                                  Pendiente
                                </span>
                              )}
                              {isApproved && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle className="w-3 h-3" />
                                  Aprobado
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  <XCircle className="w-3 h-3" />
                                  Rechazado
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {record.workerSignature ? (
                                  <button
                                    onClick={() => setViewingRecord(record)}
                                    className="p-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors cursor-pointer"
                                    title="Firma Operario"
                                  >
                                    <img
                                      src={record.workerSignature}
                                      alt="Firma Operario"
                                      className="h-5 w-10 object-contain filter invert opacity-80"
                                    />
                                  </button>
                                ) : null}
                                {record.foremanSignature ? (
                                  <button
                                    onClick={() => setViewingRecord(record)}
                                    className="p-1 bg-sky-500/10 hover:bg-sky-500/20 rounded-lg border border-sky-500/30 transition-colors cursor-pointer"
                                    title="Firma Capataz"
                                  >
                                    <img
                                      src={record.foremanSignature}
                                      alt="Firma Capataz"
                                      className="h-5 w-10 object-contain filter invert opacity-90"
                                    />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                              {isPending && (
                                <button
                                  onClick={() => handleOpenApproveModal(record)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px] cursor-pointer"
                                  title="Aprobar e imputar coste a la obra"
                                >
                                  Aprobar
                                </button>
                              )}
                              <button
                                onClick={() => setViewingRecord(record)}
                                className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors cursor-pointer"
                                title="Ver Certificado Legal Individual"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`¿Eliminar este registro de jornada de ${record.workerName}? Se retirará también automáticamente cualquier imputación de costes en la obra.`)) {
                                    onDeleteFichaje(record.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Eliminar jornada"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB D: INFORME LEGAL OFICIAL PARA INSPECCIÓN DE TRABAJO (Imprimible) */}
      {activeSubTab === 'informeLegal' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/70">Mes del Informe:</span>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
              />
              <select
                value={filterWorker}
                onChange={(e) => setFilterWorker(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                <option value="all">Todos los Operarios</option>
                {trabajadoresEmpresa.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePrintLegalReport}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                <Printer className="w-4 h-4" />
                Imprimir Documento Oficial / Guardar en PDF
              </button>
            </div>
          </div>

          {/* Printable Official Document Sheet */}
          <div className="bg-white text-black p-8 sm:p-12 rounded-2xl shadow-2xl font-serif max-w-5xl mx-auto border border-zinc-200">
            {/* Header Document */}
            <div className="border-b-2 border-black pb-4 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-tight text-black">
                    Registro Diario de Jornada Laboral y Validación de Obra
                  </h1>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    Conforme al Real Decreto-ley 8/2019, de 8 de marzo, artículo 34.9 del Estatuto de los Trabajadores y supervisión de Capataz.
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold">PERÍODO: {filterMonth || todayStr.slice(0, 7)}</p>
                  <p className="text-zinc-500 text-[10px]">Custodia obligatoria (4 años)</p>
                </div>
              </div>

              {/* Company & Worker Meta Grid */}
              <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-zinc-300 text-xs font-sans">
                <div>
                  <p><strong className="text-zinc-700">EMPRESA / RAZÓN SOCIAL:</strong> CONSTRUCCIONES Y REFORMAS S.L.</p>
                  <p><strong className="text-zinc-700">C.I.F. / N.I.F.:</strong> B-11948291</p>
                  <p><strong className="text-zinc-700">CAPATAZ RESPONSABLE:</strong> {foremanName} ({foremanRole})</p>
                </div>
                <div>
                  <p><strong className="text-zinc-700">TRABAJADOR / OPERARIO:</strong> {filterWorker === 'all' ? 'Relación Colectiva de Plantilla' : (trabajadoresEmpresa.find(w => w.id === filterWorker)?.name || 'Todos')}</p>
                  <p><strong className="text-zinc-700">D.N.I. / N.I.E.:</strong> {filterWorker === 'all' ? 'Ver desglose individual' : (trabajadoresEmpresa.find(w => w.id === filterWorker)?.dni || '-')}</p>
                  <p><strong className="text-zinc-700">CATEGORÍA PROFESIONAL:</strong> {filterWorker === 'all' ? 'Convenio General de la Construcción' : (trabajadoresEmpresa.find(w => w.id === filterWorker)?.role || '-')}</p>
                </div>
              </div>
            </div>

            {/* Official Table */}
            <table className="w-full text-left text-[11px] font-sans border-collapse border border-zinc-300 mb-6">
              <thead>
                <tr className="bg-zinc-100 border-b border-zinc-300 text-zinc-700 uppercase font-bold text-[10px]">
                  <th className="border border-zinc-300 p-2">Día</th>
                  <th className="border border-zinc-300 p-2">Trabajador</th>
                  <th className="border border-zinc-300 p-2">Obra de Ubicación</th>
                  <th className="border border-zinc-300 p-2 text-center">Entrada</th>
                  <th className="border border-zinc-300 p-2 text-center">Salida</th>
                  <th className="border border-zinc-300 p-2 text-center">Pausa</th>
                  <th className="border border-zinc-300 p-2 text-center">H. Ord.</th>
                  <th className="border border-zinc-300 p-2 text-center">H. Extra</th>
                  <th className="border border-zinc-300 p-2 text-center">Firma Operario</th>
                  <th className="border border-zinc-300 p-2 text-center">VºBº Capataz</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center p-6 text-zinc-400 italic">
                      No constan registros para el período y operario seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, idx) => {
                    const rStatus = r.approvalStatus || (r.personalCostId ? 'approved' : 'pending');
                    const isApproved = rStatus === 'approved';

                    return (
                      <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                        <td className="border border-zinc-300 p-2 font-mono font-bold">{r.date}</td>
                        <td className="border border-zinc-300 p-2">{r.workerName}</td>
                        <td className="border border-zinc-300 p-2">{r.obraName}</td>
                        <td className="border border-zinc-300 p-2 text-center font-mono">{r.clockIn}</td>
                        <td className="border border-zinc-300 p-2 text-center font-mono">{r.clockOut}</td>
                        <td className="border border-zinc-300 p-2 text-center font-mono">{r.breakMinutes}m</td>
                        <td className="border border-zinc-300 p-2 text-center font-mono font-bold">{r.regularHours}</td>
                        <td className="border border-zinc-300 p-2 text-center font-mono font-bold text-zinc-800">{r.overtimeHours || 0}</td>
                        <td className="border border-zinc-300 p-2 text-center">
                          {r.workerSignature ? (
                            <img src={r.workerSignature} alt="Firma" className="h-5 w-12 object-contain mx-auto" />
                          ) : (
                            <span className="text-[9px] text-zinc-400">Firmado</span>
                          )}
                        </td>
                        <td className="border border-zinc-300 p-2 text-center">
                          {isApproved ? (
                            r.foremanSignature ? (
                              <img src={r.foremanSignature} alt="Capataz" className="h-5 w-12 object-contain mx-auto" />
                            ) : (
                              <span className="text-[9px] text-emerald-700 font-bold font-mono">Aprobado</span>
                            )
                          ) : (
                            <span className="text-[9px] text-amber-600 font-bold">Pendiente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-100 border-t-2 border-zinc-400 font-bold">
                  <td colSpan={6} className="border border-zinc-300 p-2 text-right uppercase">
                    Total Acumulado del Período:
                  </td>
                  <td className="border border-zinc-300 p-2 text-center font-mono">
                    {historyMetrics.regularHours} h
                  </td>
                  <td className="border border-zinc-300 p-2 text-center font-mono">
                    {historyMetrics.overtimeHours} h
                  </td>
                  <td colSpan={2} className="border border-zinc-300 p-2 text-center font-mono text-[10px]">
                    Total: {historyMetrics.totalHours} h
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Signature Box Section at the bottom */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-zinc-300 text-xs font-sans mt-8">
              <div className="border border-zinc-300 rounded-xl p-3 text-center h-28 flex flex-col justify-between">
                <span className="font-bold text-zinc-700 uppercase text-[9px]">
                  Firma y Sello de la Empresa:
                </span>
                <span className="text-[9px] text-zinc-400">Representante Legal</span>
              </div>
              <div className="border border-zinc-300 rounded-xl p-3 text-center h-28 flex flex-col justify-between">
                <span className="font-bold text-zinc-700 uppercase text-[9px]">
                  VºBº Capataz de Obra:
                </span>
                <span className="text-[9px] text-zinc-500 font-bold">{foremanName}</span>
                <span className="text-[8px] text-zinc-400">Validación y Aprobación Digital</span>
              </div>
              <div className="border border-zinc-300 rounded-xl p-3 text-center h-28 flex flex-col justify-between">
                <span className="font-bold text-zinc-700 uppercase text-[9px]">
                  Conformidad del Operario:
                </span>
                <span className="text-[9px] text-zinc-400">Firma fehaciente acreditada digitalmente</span>
              </div>
            </div>

            {/* Legal Footer */}
            <p className="text-[9px] text-zinc-400 mt-6 text-center">
              Este documento certifica el cumplimiento del Real Decreto-ley 8/2019 de 8 de marzo sobre el registro diario de jornada y el protocolo de aprobación por parte del responsable técnico de obra. Los datos están protegidos conforme al RGPD y a disposición de la Inspección de Trabajo y Seguridad Social.
            </p>
          </div>
        </div>
      )}

      {/* 6. MODAL DE APROBACIÓN DIGITAL DEL CAPATAZ (INDIVIDUAL) */}
      {approvingRecord && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-amber-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  Visto Bueno y Firma del Capataz
                </span>
                <h3 className="text-base font-extrabold text-white mt-1 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-400" />
                  Aprobación de Jornada para Imputación en Obra
                </h3>
              </div>
              <button
                onClick={() => setApprovingRecord(null)}
                className="text-white/40 hover:text-white text-sm p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Shift Summary Card */}
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-white/50 text-[11px]">Trabajador:</span>
                <strong className="text-white text-sm">{approvingRecord.workerName} ({approvingRecord.role})</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50 text-[11px]">Obra Asignada:</span>
                <strong className="text-emerald-400">{approvingRecord.obraName}</strong>
              </div>
              <div className="flex justify-between items-center font-mono">
                <span className="text-white/50 text-[11px]">Fecha y Horario:</span>
                <span className="text-white font-bold">{approvingRecord.date} | {approvingRecord.clockIn} - {approvingRecord.clockOut}</span>
              </div>
              <div className="flex justify-between items-center font-mono">
                <span className="text-white/50 text-[11px]">Horas Efectivas:</span>
                <span className="text-white">{approvingRecord.totalHours} h ({approvingRecord.regularHours}h ord. + {approvingRecord.overtimeHours}h extra)</span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                <span className="text-white/70 font-bold">Coste a Imputar a la Obra:</span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  {approvingRecord.calculatedCost.toFixed(2)} €
                </span>
              </div>
            </div>

            {/* Worker Signature Preview */}
            <div className="bg-black/30 border border-white/5 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-white/40 block">Firma del Operario Registrada:</span>
                <span className="text-[10px] text-white/60 font-mono">{approvingRecord.signatureTimestamp?.slice(0, 19).replace('T', ' ')}</span>
              </div>
              {approvingRecord.workerSignature ? (
                <img
                  src={approvingRecord.workerSignature}
                  alt="Firma Operario"
                  className="h-8 w-20 object-contain filter invert opacity-90"
                />
              ) : (
                <span className="text-[10px] text-rose-400">Sin firma</span>
              )}
            </div>

            {/* Foreman Verification Inputs */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Nombre del Capataz Validador</label>
                  <input
                    type="text"
                    value={foremanName}
                    onChange={(e) => setForemanName(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white w-full focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Cargo en Obra</label>
                  <input
                    type="text"
                    value={foremanRole}
                    onChange={(e) => setForemanRole(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white w-full focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white/70 mb-1">Observaciones del Capataz (Opcional)</label>
                <input
                  type="text"
                  value={foremanNotesInput}
                  onChange={(e) => setForemanNotesInput(e.target.value)}
                  placeholder="Ej: Trabajos comprobados conforme al replanteo..."
                  className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white w-full focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Foreman Digital Signature Pad */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-black uppercase text-amber-400">
                    Estampa la Firma Digital del Capataz: *
                  </label>
                  <button
                    type="button"
                    onClick={clearForemanSignature}
                    className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpiar firma
                  </button>
                </div>

                <div className="relative border-2 border-dashed border-amber-500/40 rounded-xl bg-black/60 overflow-hidden touch-none flex flex-col items-center justify-center">
                  <canvas
                    ref={foremanCanvasRef}
                    width={400}
                    height={140}
                    onMouseDown={startForemanDrawing}
                    onMouseMove={drawForeman}
                    onMouseUp={stopForemanDrawing}
                    onMouseLeave={stopForemanDrawing}
                    onTouchStart={startForemanDrawing}
                    onTouchMove={drawForeman}
                    onTouchEnd={stopForemanDrawing}
                    className="cursor-crosshair w-full h-[120px]"
                  />
                  {!foremanHasSignature && (
                    <div className="absolute pointer-events-none text-white/30 text-xs flex flex-col items-center">
                      <PenTool className="w-5 h-5 text-amber-400/30 mb-1" />
                      <span>Rúbrica digital del Capataz</span>
                    </div>
                  )}
                  <div className="w-full bg-black/80 px-2.5 py-1 flex justify-between text-[9px] text-white/40 border-t border-white/5">
                    <span>Sello digital de supervisión técnica</span>
                    <span className={foremanHasSignature ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {foremanHasSignature ? '✓ Firma de Capataz Capturada' : 'Esperando firma...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Legal Certificate Endorsement Box */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-200 leading-relaxed">
                <strong>Certificación del Capataz:</strong> Doy fe de la prestación laboral del operario en la obra indicada y autorizo expresamente la imputación contable de {approvingRecord.calculatedCost.toFixed(2)} € a los gastos de personal del proyecto.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApprovingRecord(null)}
                className="bg-white/5 hover:bg-white/10 text-white/70 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmForemanApproval}
                disabled={!foremanHasSignature || !foremanName.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black py-2.5 px-5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle className="w-4 h-4" />
                Aprobar e Imputar Gasto a Obra ({approvingRecord.calculatedCost.toFixed(2)} €)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE APROBACIÓN POR LOTES DEL CAPATAZ */}
      {isBatchApprovalModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-amber-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  Aprobación Masiva de Lote
                </span>
                <h3 className="text-base font-extrabold text-white mt-1 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-400" />
                  Aprobar Lote de {selectedPendingIds.length} Jornadas de Obra
                </h3>
              </div>
              <button
                onClick={() => setIsBatchApprovalModalOpen(false)}
                className="text-white/40 hover:text-white text-sm p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Batch summary metrics */}
            {(() => {
              const selectedRecords = fichajes.filter(f => selectedPendingIds.includes(f.id));
              const totalCost = selectedRecords.reduce((acc, r) => acc + (r.calculatedCost || 0), 0);
              const totalHours = selectedRecords.reduce((acc, r) => acc + (r.totalHours || 0), 0);

              return (
                <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-[11px]">Total Jornadas a Aprobar:</span>
                    <strong className="text-white text-sm">{selectedRecords.length} jornadas</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-[11px]">Horas Totales Computadas:</span>
                    <strong className="text-white">{totalHours.toFixed(1)} horas</strong>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                    <span className="text-white/70 font-bold">Coste Total que se Imputará a las Obras:</span>
                    <span className="text-lg font-mono font-black text-emerald-400">
                      {totalCost.toFixed(2)} €
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Foreman Verification Inputs */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Nombre del Capataz Validador</label>
                  <input
                    type="text"
                    value={foremanName}
                    onChange={(e) => setForemanName(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white w-full focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-white/70 mb-1">Cargo en Obra</label>
                  <input
                    type="text"
                    value={foremanRole}
                    onChange={(e) => setForemanRole(e.target.value)}
                    className="bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white w-full focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Foreman Digital Signature Pad */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-black uppercase text-amber-400">
                    Estampa la Firma Digital del Capataz para todo el Lote: *
                  </label>
                  <button
                    type="button"
                    onClick={clearForemanSignature}
                    className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Limpiar firma
                  </button>
                </div>

                <div className="relative border-2 border-dashed border-amber-500/40 rounded-xl bg-black/60 overflow-hidden touch-none flex flex-col items-center justify-center">
                  <canvas
                    ref={foremanCanvasRef}
                    width={400}
                    height={140}
                    onMouseDown={startForemanDrawing}
                    onMouseMove={drawForeman}
                    onMouseUp={stopForemanDrawing}
                    onMouseLeave={stopForemanDrawing}
                    onTouchStart={startForemanDrawing}
                    onTouchMove={drawForeman}
                    onTouchEnd={stopForemanDrawing}
                    className="cursor-crosshair w-full h-[120px]"
                  />
                  {!foremanHasSignature && (
                    <div className="absolute pointer-events-none text-white/30 text-xs flex flex-col items-center">
                      <PenTool className="w-5 h-5 text-amber-400/30 mb-1" />
                      <span>Rúbrica digital del Capataz para el lote</span>
                    </div>
                  )}
                  <div className="w-full bg-black/80 px-2.5 py-1 flex justify-between text-[9px] text-white/40 border-t border-white/5">
                    <span>Sello conjunto para {selectedPendingIds.length} partes</span>
                    <span className={foremanHasSignature ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {foremanHasSignature ? '✓ Firma Capturada' : 'Esperando firma...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBatchApprovalModalOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-white/70 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchForemanApproval}
                disabled={!foremanHasSignature || !foremanName.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-black py-2.5 px-5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle className="w-4 h-4" />
                Aprobar e Imputar Lote Completo a Obras
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL DE RECHAZO DE JORNADA */}
      {rejectingRecord && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" />
                Rechazar Jornada de Operario
              </h3>
              <button
                onClick={() => setRejectingRecord(null)}
                className="text-white/40 hover:text-white text-sm p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/70">
              Vas a rechazar la jornada de <strong className="text-white">{rejectingRecord.workerName}</strong> del día <strong className="text-white font-mono">{rejectingRecord.date}</strong> en <strong className="text-emerald-400">{rejectingRecord.obraName}</strong>. El coste ({rejectingRecord.calculatedCost.toFixed(2)} €) NO se imputará a la obra.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-white/70 mb-1">Motivo del Rechazo: *</label>
              <textarea
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                rows={3}
                className="bg-black/60 border border-white/15 rounded-xl p-3 text-xs text-white w-full focus:border-rose-400 focus:outline-none"
                placeholder="Indica el motivo por el cual no procede la aprobación..."
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingRecord(null)}
                className="bg-white/5 hover:bg-white/10 text-white/70 font-bold py-2 px-4 rounded-xl text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="bg-rose-600 hover:bg-rose-500 text-white font-black py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <XCircle className="w-4 h-4" />
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. CERTIFICATE MODAL: VERIFICACIÓN INDIVIDUAL COMPLETA */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181B] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Certificado Legal de Jornada
                </h3>
                <p className="text-xs text-white/50">Identificador unívoco: {viewingRecord.id}</p>
              </div>
              <button
                onClick={() => setViewingRecord(null)}
                className="text-white/40 hover:text-white text-sm p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Approval status banner in certificate */}
              {(() => {
                const rStatus = viewingRecord.approvalStatus || (viewingRecord.personalCostId ? 'approved' : 'pending');
                if (rStatus === 'approved') {
                  return (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-400 font-bold">
                      <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Jornada Aprobada Digitalmente por Capataz
                      </span>
                      <span className="font-mono text-[11px] text-white/70">Coste Imputado en Obra</span>
                    </div>
                  );
                } else if (rStatus === 'rejected') {
                  return (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300">
                      <span className="flex items-center gap-2 font-bold mb-1">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        Jornada Rechazada por Capataz
                      </span>
                      <span className="text-[11px]">Motivo: {viewingRecord.rejectionReason}</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-amber-300 font-bold">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400" />
                        Pendiente de Aprobación por Capataz
                      </span>
                      <span className="font-mono text-[10px] text-amber-400/80">Coste no asignado aún</span>
                    </div>
                  );
                }
              })()}

              <div className="grid grid-cols-2 gap-3 bg-black/40 p-3.5 rounded-xl border border-white/5">
                <div>
                  <span className="text-white/40 block text-[10px]">Operario:</span>
                  <span className="font-bold text-white text-sm">{viewingRecord.workerName}</span>
                  <span className="text-white/50 block font-mono text-[11px]">{viewingRecord.workerDni || viewingRecord.role}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[10px]">Obra Imputada:</span>
                  <span className="font-bold text-emerald-400 text-sm">{viewingRecord.obraName}</span>
                  <span className="text-white/50 block text-[10px]">ID: {viewingRecord.obraId}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-black/20 p-3 rounded-xl border border-white/5 font-mono text-center">
                <div>
                  <span className="text-white/40 block text-[9px]">Fecha</span>
                  <span className="font-bold text-white">{viewingRecord.date}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9px]">Horario</span>
                  <span className="font-bold text-white">{viewingRecord.clockIn} - {viewingRecord.clockOut}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[9px]">Horas Efectivas</span>
                  <span className="font-bold text-emerald-400">{viewingRecord.totalHours} h</span>
                </div>
              </div>

              <div className="bg-black/30 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                <div>
                  <span className="text-white/50 text-[10px] block">Imputación a Costes de Mano de Obra:</span>
                  <span className="font-mono text-xs text-white/80">
                    {viewingRecord.regularHours}h x {viewingRecord.hourlyRate}€ + {viewingRecord.overtimeHours}h extra x {viewingRecord.overtimeRate}€
                  </span>
                </div>
                <span className="text-base font-mono font-black text-emerald-400">
                  {viewingRecord.calculatedCost.toFixed(2)} €
                </span>
              </div>

              {/* Double Signatures Visual Proof: Operario + Capataz */}
              <div className="grid grid-cols-2 gap-3">
                {/* Worker Signature */}
                <div className="bg-black/60 p-3 rounded-xl border border-emerald-500/30 text-center space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 block">
                    Firma del Operario:
                  </span>
                  {viewingRecord.workerSignature ? (
                    <img
                      src={viewingRecord.workerSignature}
                      alt="Rúbrica Operario"
                      className="h-14 w-auto max-w-full mx-auto object-contain filter invert"
                    />
                  ) : (
                    <p className="text-white/30 italic text-[10px]">Sin rúbrica</p>
                  )}
                  <span className="text-[9px] text-white/40 block font-mono">
                    {viewingRecord.signatureTimestamp?.slice(0, 19).replace('T', ' ')}
                  </span>
                </div>

                {/* Capataz Signature */}
                <div className="bg-black/60 p-3 rounded-xl border border-amber-500/30 text-center space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 block">
                    VºBº Capataz de Obra:
                  </span>
                  {viewingRecord.foremanSignature ? (
                    <img
                      src={viewingRecord.foremanSignature}
                      alt="Rúbrica Capataz"
                      className="h-14 w-auto max-w-full mx-auto object-contain filter invert"
                    />
                  ) : (
                    <div className="h-14 flex items-center justify-center text-[10px] text-amber-400/70 italic">
                      Pendiente de firma
                    </div>
                  )}
                  <span className="text-[9px] text-white/40 block font-mono">
                    {viewingRecord.foremanName || 'No validado'}
                  </span>
                </div>
              </div>

              {viewingRecord.notes && (
                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-white/40 text-[10px] block">Observaciones:</span>
                  <p className="text-white/80">{viewingRecord.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-between items-center">
              {(viewingRecord.approvalStatus === 'pending' || !viewingRecord.approvalStatus) && (
                <button
                  onClick={() => {
                    handleOpenApproveModal(viewingRecord);
                    setViewingRecord(null);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <UserCheck className="w-4 h-4" />
                  Aprobar como Capataz Ahora
                </button>
              )}
              <button
                onClick={() => setViewingRecord(null)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer ml-auto"
              >
                Cerrar Certificado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
