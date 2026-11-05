import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Clock, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Building2, 
  LogOut, 
  Play, 
  Square, 
  PenTool, 
  RotateCcw, 
  Calendar, 
  ShieldCheck, 
  Coffee, 
  ChevronRight, 
  Sparkles, 
  History, 
  Smartphone, 
  ExternalLink,
  DollarSign,
  Briefcase,
  HelpCircle,
  X
} from 'lucide-react';
import { Obra, TrabajadorEmpresa, RegistroJornada, ActiveFichaje } from '../types';

interface WorkerPortalProps {
  obras: Obra[];
  trabajadoresEmpresa: TrabajadorEmpresa[];
  fichajes: RegistroJornada[];
  activeFichajes: ActiveFichaje[];
  onClockIn: (data: {
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
  }) => Promise<void>;
  onClockOut: (data: {
    activeFichajeId: string;
    exitTime: string; // HH:mm
    breakMinutes: number;
    signature: string;
    notes?: string;
    locationCoords?: { latitude: number; longitude: number; accuracy?: number };
  }) => Promise<void>;
  onExitPortal?: () => void;
}

export const WorkerPortal: React.FC<WorkerPortalProps> = ({
  obras,
  trabajadoresEmpresa,
  fichajes,
  activeFichajes,
  onClockIn,
  onClockOut,
  onExitPortal
}) => {
  // Current time & date live ticking
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = useMemo(() => {
    return currentTime.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [currentTime]);

  const timeString = useMemo(() => {
    return currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [currentTime]);

  const shortTimeString = useMemo(() => {
    return currentTime.toTimeString().slice(0, 5); // HH:mm
  }, [currentTime]);

  // Selected Worker state (persisted in localStorage for convenience on worker's device)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(() => {
    const saved = localStorage.getItem('up_last_worker_id');
    if (saved && trabajadoresEmpresa.some(t => t.id === saved)) return saved;
    return trabajadoresEmpresa[0]?.id || '';
  });

  const selectedWorker = useMemo(() => {
    return trabajadoresEmpresa.find(t => t.id === selectedWorkerId);
  }, [trabajadoresEmpresa, selectedWorkerId]);

  // Save selected worker
  useEffect(() => {
    if (selectedWorkerId) {
      localStorage.setItem('up_last_worker_id', selectedWorkerId);
    }
  }, [selectedWorkerId]);

  // Selected Obra state
  const activeObras = useMemo(() => {
    const act = obras.filter(o => o.status === 'active');
    return act.length > 0 ? act : obras;
  }, [obras]);

  const [selectedObraId, setSelectedObraId] = useState<string>(() => {
    if (selectedWorker?.defaultObraId && activeObras.some(o => o.id === selectedWorker.defaultObraId)) {
      return selectedWorker.defaultObraId;
    }
    return activeObras[0]?.id || '';
  });

  // When selected worker changes, adapt default obra if not in active shift
  useEffect(() => {
    if (selectedWorker?.defaultObraId && activeObras.some(o => o.id === selectedWorker.defaultObraId)) {
      setSelectedObraId(selectedWorker.defaultObraId);
    }
  }, [selectedWorker, activeObras]);

  // Check if current worker has an active shift
  const currentActiveShift = useMemo(() => {
    if (!selectedWorkerId) return null;
    return activeFichajes.find(a => a.workerId === selectedWorkerId) || null;
  }, [activeFichajes, selectedWorkerId]);

  // View state: 'clock' | 'history'
  const [portalTab, setPortalTab] = useState<'clock' | 'history'>('clock');

  // GPS state
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const fetchGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocalización no soportada por el navegador');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS Error:', err);
        setGpsError('No se pudo obtener la ubicación GPS (permiso denegado o sin señal)');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    fetchGps();
  }, []);

  // Clock In state
  const [clockInNotes, setClockInNotes] = useState('');
  const [isSubmittingClockIn, setIsSubmittingClockIn] = useState(false);

  // Clock Out Modal state
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [exitTimeInput, setExitTimeInput] = useState(shortTimeString);
  const [breakMinutesInput, setBreakMinutesInput] = useState<number>(30);
  const [clockOutNotes, setClockOutNotes] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(true);
  const [isSubmittingClockOut, setIsSubmittingClockOut] = useState(false);
  const [clockOutSuccessModal, setClockOutSuccessModal] = useState<{
    hours: number;
    cost: number;
    obraName: string;
    workerName: string;
  } | null>(null);

  // Digital Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // When clock out modal opens, initialize exit time & calibrate canvas resolution
  useEffect(() => {
    if (showClockOutModal) {
      setExitTimeInput(currentTime.toTimeString().slice(0, 5));
      setHasSignature(false);
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas && canvas.parentElement) {
          const rect = canvas.parentElement.getBoundingClientRect();
          if (rect.width > 50) {
            canvas.width = Math.round(rect.width - 8);
            canvas.height = 140;
          }
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showClockOutModal]);

  // Canvas drawing functions with mobile touch-coordinate scaling
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Live active shift duration calculator
  const activeDuration = useMemo(() => {
    if (!currentActiveShift) return { hours: 0, minutes: 0, seconds: 0, formatted: '00:00:00', totalMinutes: 0 };
    const startMs = currentActiveShift.clockInTimestamp || Date.now();
    const diffMs = Math.max(0, currentTime.getTime() - startMs);
    const totalSeconds = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      hours: h,
      minutes: m,
      seconds: s,
      formatted: `${pad(h)}:${pad(m)}:${pad(s)}`,
      totalMinutes: Math.floor(totalSeconds / 60)
    };
  }, [currentActiveShift, currentTime]);

  // Projected shift calculation for clock out modal
  const projectedShift = useMemo(() => {
    if (!currentActiveShift) return { totalHours: 0, regularHours: 0, overtimeHours: 0, cost: 0 };
    
    // Parse start time & exit time
    const [inH, inM] = currentActiveShift.clockIn.split(':').map(Number);
    const [outH, outM] = exitTimeInput.split(':').map(Number);
    
    let totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Crosses midnight
    
    const netMinutes = Math.max(0, totalMinutes - (breakMinutesInput || 0));
    const hours = Number((netMinutes / 60).toFixed(2));
    
    const regular = Math.min(8, hours);
    const overtime = Math.max(0, hours - 8);
    
    const hRate = currentActiveShift.hourlyRate || (selectedWorker?.standardHourlyRate || (selectedWorker?.dailyRate ? Number((selectedWorker.dailyRate / 8).toFixed(2)) : 18.0));
    const oRate = currentActiveShift.overtimeRate || (selectedWorker?.overtimeHourlyRate || Number((hRate * 1.35).toFixed(2)));
    
    const cost = Number(((regular * hRate) + (overtime * oRate)).toFixed(2));
    return {
      totalHours: hours,
      regularHours: regular,
      overtimeHours: overtime,
      cost
    };
  }, [currentActiveShift, exitTimeInput, breakMinutesInput]);

  // Handle Clock In
  const handleClockInSubmit = async () => {
    if (!selectedWorker) {
      alert('Por favor selecciona tu nombre antes de fichar.');
      return;
    }
    const obra = obras.find(o => o.id === selectedObraId);
    if (!obra) {
      alert('Por favor selecciona la obra en la que estás trabajando.');
      return;
    }

    setIsSubmittingClockIn(true);
    try {
      const hRate = selectedWorker.standardHourlyRate || 
        (selectedWorker.dailyRate ? Number((selectedWorker.dailyRate / 8).toFixed(2)) : 18.0);
      const oRate = selectedWorker.overtimeHourlyRate || Number((hRate * 1.35).toFixed(2));

      await onClockIn({
        workerId: selectedWorker.id,
        workerName: selectedWorker.name,
        workerDni: selectedWorker.dni,
        role: selectedWorker.role,
        obraId: obra.id,
        obraName: obra.name,
        hourlyRate: hRate,
        overtimeRate: oRate,
        locationCoords: gpsLocation || undefined,
        notes: clockInNotes.trim() || undefined
      });

      setClockInNotes('');
    } catch (err: any) {
      console.error(err);
      alert('Error al registrar la entrada: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmittingClockIn(false);
    }
  };

  // Handle Clock Out
  const handleClockOutSubmit = async () => {
    if (!currentActiveShift) return;
    if (!hasSignature) {
      alert('Es obligatorio firmar en el recuadro para certificar legalmente el parte de horas de la jornada.');
      return;
    }
    if (!legalAccepted) {
      alert('Debes aceptar la declaración legal sobre la exactitud del horario.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureDataUrl = canvas.toDataURL('image/png');

    setIsSubmittingClockOut(true);
    try {
      await onClockOut({
        activeFichajeId: currentActiveShift.id,
        exitTime: exitTimeInput,
        breakMinutes: breakMinutesInput,
        signature: signatureDataUrl,
        notes: clockOutNotes.trim() || undefined,
        locationCoords: gpsLocation || undefined
      });

      setShowClockOutModal(false);
      setClockOutSuccessModal({
        hours: projectedShift.totalHours,
        cost: projectedShift.cost,
        obraName: currentActiveShift.obraName,
        workerName: currentActiveShift.workerName
      });
      setClockOutNotes('');
    } catch (err: any) {
      console.error(err);
      alert('Error al registrar la salida: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmittingClockOut(false);
    }
  };

  // Filter worker history
  const workerHistory = useMemo(() => {
    if (!selectedWorkerId) return [];
    return fichajes
      .filter(f => f.workerId === selectedWorkerId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [fichajes, selectedWorkerId]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-12 selection:bg-amber-500 selection:text-white">
      {/* Top Mobile App Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                PORTAL DEL OPERARIO
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-semibold">
                  MÓVIL
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium capitalize">
                {formattedDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onExitPortal && (
              <button
                onClick={onExitPortal}
                title="Volver al panel general de gestión"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 px-2.5 py-1.5 rounded-lg transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Panel Admin</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md w-full mx-auto px-4 pt-4 flex-1 flex flex-col gap-4">
        
        {/* Live Digital Clock Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-850 border border-slate-700/80 rounded-2xl p-4 shadow-lg text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Hora Oficial en Vivo
            </span>
            <button 
              onClick={fetchGps}
              className="text-[11px] flex items-center gap-1 text-slate-400 hover:text-amber-400 transition"
            >
              <MapPin className="w-3 h-3 text-emerald-400" />
              {gpsLoading ? 'Obteniendo GPS...' : gpsLocation ? `GPS Activo (±${gpsLocation.accuracy}m)` : 'Activar GPS'}
            </button>
          </div>

          <div className="text-4xl font-black tracking-tight text-white font-mono py-1">
            {timeString}
          </div>

          {gpsLocation && (
            <div className="text-[10px] text-slate-400 bg-slate-900/60 rounded-md py-1 px-2 border border-slate-800/60 mt-1 flex items-center justify-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-emerald-400" />
              <span>Coordenadas de Obra: {gpsLocation.latitude.toFixed(4)}, {gpsLocation.longitude.toFixed(4)}</span>
            </div>
          )}
        </div>

        {/* Worker Selector Card - Paso 1 */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-400" />
              1. Identificación del Operario
            </label>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              PASO 1
            </span>
          </div>

          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            disabled={!!currentActiveShift}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-3 text-white text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none transition disabled:opacity-60 disabled:cursor-not-allowed min-h-[46px]"
          >
            {trabajadoresEmpresa.length === 0 ? (
              <option value="">No hay operarios en plantilla registrados</option>
            ) : (
              trabajadoresEmpresa.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.role} {w.dni ? `(${w.dni})` : ''}
                </option>
              ))
            )}
          </select>

          {selectedWorker && (
            <div className="mt-2.5 flex items-center justify-between text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs">
                  {selectedWorker.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-white">{selectedWorker.name}</div>
                  <div className="text-slate-400 text-[11px]">{selectedWorker.role}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Tarifa Oficial</span>
                <span className="font-bold text-amber-400">
                  {selectedWorker.standardHourlyRate || (selectedWorker.dailyRate ? (selectedWorker.dailyRate / 8).toFixed(2) : 18.0)} €/h
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic State: Active Shift vs Clock-in form */}
        {currentActiveShift ? (
          /* JORNADA EN CURSO (CLOCK OUT VIEW) */
          <div className="bg-gradient-to-b from-emerald-950/60 to-slate-850 border-2 border-emerald-500/50 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                JORNADA ACTIVA EN CURSO
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Entrada: <strong className="text-white">{currentActiveShift.clockIn}h</strong>
              </span>
            </div>

            <div className="text-center py-2">
              <span className="text-xs text-slate-400 uppercase tracking-widest block font-medium mb-1">
                Tiempo de Trabajo Transcurrido
              </span>
              <div className="text-5xl font-black font-mono tracking-tight text-emerald-300 drop-shadow">
                {activeDuration.formatted}
              </div>
            </div>

            <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" /> Obra Asignada:
                </span>
                <strong className="text-white truncate max-w-[200px]">{currentActiveShift.obraName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" /> Fecha del Turno:
                </span>
                <span className="text-slate-300 font-medium">{currentActiveShift.date}</span>
              </div>
              {currentActiveShift.locationCoords && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Geoposición Inicial:
                  </span>
                  <span className="text-emerald-400 font-mono text-[11px]">
                    {currentActiveShift.locationCoords.latitude.toFixed(3)}, {currentActiveShift.locationCoords.longitude.toFixed(3)}
                  </span>
                </div>
              )}
            </div>

            {/* Big Action: CLOCK OUT BUTTON */}
            <button
              onClick={() => setShowClockOutModal(true)}
              className="w-full min-h-[50px] py-3.5 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold rounded-xl shadow-lg shadow-red-900/30 flex items-center justify-center gap-3 active:scale-[0.98] transition text-base cursor-pointer"
            >
              <Square className="w-5 h-5 fill-current" />
              REGISTRAR SALIDA Y FIRMAR
            </button>
            <p className="text-[11px] text-center text-slate-400">
              Al pulsar Salida podrás revisar tus horas computadas, firmar digitalmente e imputar de inmediato el coste a la obra.
            </p>
          </div>
        ) : (
          /* REGISTRAR ENTRADA (CLOCK IN VIEW) - Paso 2 */
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-400" />
                2. Obra y Registro de Entrada
              </label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                PASO 2
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Obra en la que estás trabajando hoy:
              </label>
              <select
                value={selectedObraId}
                onChange={(e) => setSelectedObraId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-3 text-white text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none transition min-h-[46px]"
              >
                {activeObras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.location ? `(${o.location})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Observaciones o Tareas Iniciales (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. Comienzo encofrado planta 1ª, replanteo..."
                value={clockInNotes}
                onChange={(e) => setClockInNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-3 text-white text-sm placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition min-h-[46px]"
              />
            </div>

            {/* Big Action: CLOCK IN BUTTON */}
            <button
              onClick={handleClockInSubmit}
              disabled={isSubmittingClockIn || !selectedWorker}
              className="w-full min-h-[52px] py-3.5 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-3 active:scale-[0.98] transition text-base disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmittingClockIn ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  REGISTRAR ENTRADA AHORA ({shortTimeString}h)
                </>
              )}
            </button>

            <div className="flex items-center gap-2 p-3 bg-slate-900/70 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Fichaje seguro conforme al <strong>Art. 34.9 del Estatuto de los Trabajadores</strong>. Se guardará hora exacta y localización.
              </span>
            </div>
          </div>
        )}

        {/* Navigation Tabs for History / Info */}
        <div className="flex bg-slate-850 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setPortalTab('clock')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              portalTab === 'clock'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Terminal de Fichaje
          </button>
          <button
            onClick={() => setPortalTab('history')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              portalTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Mis Fichajes Recientes ({workerHistory.length})
          </button>
        </div>

        {/* History Tab Content */}
        {portalTab === 'history' && (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Historial de Jornadas Registradas</span>
              <span className="text-[11px] text-amber-400 font-mono">
                {workerHistory.reduce((sum, f) => sum + (f.totalHours || 0), 0).toFixed(1)}h acumuladas
              </span>
            </h3>

            {workerHistory.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No tienes fichajes anteriores registrados en el sistema.
              </div>
            ) : (
              <div className="divide-y divide-slate-700/60 max-h-80 overflow-y-auto pr-1">
                {workerHistory.slice(0, 10).map((record) => (
                  <div key={record.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>{record.date}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300 font-mono">
                          {record.clockIn} - {record.clockOut}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] truncate max-w-[200px]">
                        {record.obraName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400 font-mono">{record.totalHours.toFixed(2)}h</div>
                      <div className="text-[10px] text-slate-400 font-mono">{record.calculatedCost.toFixed(2)}€</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* MODAL: REGISTRAR SALIDA Y FIRMAR */}
      {showClockOutModal && currentActiveShift && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-850 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 max-h-[95vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                  <Square className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Cierre de Jornada y Firma</h3>
                  <p className="text-[11px] text-slate-400">{currentActiveShift.workerName} — {currentActiveShift.obraName}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowClockOutModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Time Adjustments */}
            <div className="grid grid-cols-2 gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium">Hora de Salida Efectiva</label>
                <input
                  type="time"
                  value={exitTimeInput}
                  onChange={(e) => setExitTimeInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-sm font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium flex items-center gap-1">
                  <Coffee className="w-3 h-3 text-amber-400" />
                  Descanso / Comida
                </label>
                <select
                  value={breakMinutesInput}
                  onChange={(e) => setBreakMinutesInput(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value={0}>Sin descanso (0 min)</option>
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos (Bocadillo)</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>60 minutos (1 hora comida)</option>
                  <option value={90}>90 minutos (1.5 horas)</option>
                </select>
              </div>
            </div>

            {/* Computed Summary & Real-time labor cost to be added to Obra */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Horas Netas de Trabajo:</span>
                <span className="font-bold text-white font-mono text-sm">{projectedShift.totalHours.toFixed(2)} h</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Ordinarias: {projectedShift.regularHours.toFixed(2)}h</span>
                <span>Extras: {projectedShift.overtimeHours.toFixed(2)}h</span>
              </div>
              <div className="border-t border-emerald-500/20 pt-2 flex items-center justify-between">
                <span className="font-semibold text-emerald-300 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Gasto Mano de Obra a Imputar:
                </span>
                <span className="font-black text-emerald-400 font-mono text-base">{projectedShift.cost.toFixed(2)} €</span>
              </div>
              <div className="text-[10px] text-emerald-400/90 italic">
                ✓ Se agregará de inmediato a los gastos de personal de &ldquo;{currentActiveShift.obraName}&rdquo;
              </div>
            </div>

            {/* Optional notes */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1 font-medium">Notas o Incidencias de la jornada</label>
              <input
                type="text"
                placeholder="Observaciones de avance o incidencias..."
                value={clockOutNotes}
                onChange={(e) => setClockOutNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-slate-500 focus:outline-none"
              />
            </div>

            {/* Digital Signature Canvas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5" />
                  Firma Digital del Operario (Obligatoria)
                </label>
                {hasSignature && (
                  <button
                    onClick={clearCanvas}
                    className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-0.5"
                  >
                    <RotateCcw className="w-3 h-3" /> Borrar Firma
                  </button>
                )}
              </div>
              
              <div className="bg-white rounded-xl p-1 border-2 border-slate-600 shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={130}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-32 touch-none cursor-crosshair bg-white rounded-lg"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Dibuja tu firma con el dedo o puntero sobre la zona blanca superior para validar el parte.
              </p>
            </div>

            {/* Legal Statement */}
            <label className="flex items-start gap-2 text-[11px] text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={legalAccepted}
                onChange={(e) => setLegalAccepted(e.target.checked)}
                className="mt-0.5 rounded text-amber-500 focus:ring-0"
              />
              <span>
                Certifico bajo mi responsabilidad la exactitud de los horarios marcados y la jornada prestada conforme a la normativa vigente.
              </span>
            </label>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowClockOutModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleClockOutSubmit}
                disabled={isSubmittingClockOut || !hasSignature || !legalAccepted}
                className="flex-2 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmittingClockOut ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    GUARDAR Y ASIGNAR GASTO A LA OBRA
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION MODAL */}
      {clockOutSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-850 border border-emerald-500/50 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center animate-bounce">
              <CheckCircle className="w-10 h-10" />
            </div>
            
            <h3 className="text-lg font-black text-white">¡Jornada Registrada con Éxito!</h3>
            
            <p className="text-xs text-slate-300">
              El parte de horas de <strong className="text-white">{clockOutSuccessModal.workerName}</strong> ha quedado legalmente firmado y archivado.
            </p>

            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 my-2 text-xs space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">Horas trabajadas:</span>
                <span className="font-bold text-white font-mono">{clockOutSuccessModal.hours.toFixed(2)} h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gasto generado:</span>
                <span className="font-bold text-emerald-400 font-mono">{clockOutSuccessModal.cost.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Obra destino:</span>
                <span className="font-bold text-amber-300 truncate max-w-[170px]">{clockOutSuccessModal.obraName}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-800 text-[11px] text-emerald-400 font-medium text-center">
                ✓ Coste de mano de obra añadido automáticamente al proyecto
              </div>
            </div>

            <button
              onClick={() => setClockOutSuccessModal(null)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition"
            >
              Aceptar y Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
