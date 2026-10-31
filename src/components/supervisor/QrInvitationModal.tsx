import React, { useState } from 'react';
import { WorkerInvitation } from '../../types/index.js';
import { X, Copy, Check, Printer, ShieldAlert, Clock, ExternalLink, Download } from 'lucide-react';

interface QrInvitationModalProps {
  invitation: WorkerInvitation;
  onClose: () => void;
  onRevoke: () => void;
}

export const QrInvitationModal: React.FC<QrInvitationModalProps> = ({
  invitation,
  onClose,
  onRevoke,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitation.activationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQr = () => {
    if (!invitation.qrCodeUrl) return;
    const a = document.createElement('a');
    a.href = invitation.qrCodeUrl;
    a.download = `QR-Acceso-${invitation.workerName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const expirationDate = new Date(invitation.expiresAt).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      {/* Printable Area - visible on screen and on print */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/60 print:bg-white print:border-b-2 print:border-black">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-blue-400 print:text-blue-700">
              José Real Construcciones, S.L.
            </span>
            <h3 className="text-lg font-bold text-white print:text-black">
              Acceso Individual al Portal
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 print:hidden transition-colors"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Worker summary banner */}
          <div className="bg-slate-800/80 print:bg-slate-50 border border-slate-700/60 print:border-slate-300 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 print:text-slate-600 font-medium">Trabajador autorizado:</p>
              <h4 className="text-base font-bold text-white print:text-black">{invitation.workerName}</h4>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 print:border-emerald-600 print:text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse print:hidden"></span>
                Invitación Válida
              </span>
            </div>
          </div>

          {/* QR Code Presentation */}
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-inner border border-slate-200">
            {invitation.qrCodeUrl ? (
              <img
                src={invitation.qrCodeUrl}
                alt="Código QR de Activación"
                className="w-56 h-56 object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                Generando QR...
              </div>
            )}
            <p className="mt-3 text-xs font-semibold text-slate-700 tracking-wide text-center uppercase">
              Escanea con la cámara de tu móvil para acceder
            </p>
          </div>

          {/* Instructions for worker */}
          <div className="space-y-2 text-xs text-slate-300 print:text-slate-700 bg-slate-800/40 print:bg-white p-3 rounded-xl border border-slate-700/40 print:border-slate-200">
            <p className="font-bold text-white print:text-black flex items-center gap-1.5">
              <span>📋</span> Instrucciones sencillas para el trabajador:
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-slate-300 print:text-slate-600">
              <li>Abre la cámara de tu teléfono móvil y enfoca el código QR.</li>
              <li>Toca el enlace emergente que aparecerá en pantalla.</li>
              <li>Crea tu PIN personal de 4 dígitos para entrar cuando quieras.</li>
              <li>Ya podrás registrar tus horas de entrada y salida y ver tus nóminas.</li>
            </ol>
          </div>

          {/* Expiration and Zero-Trust metadata */}
          <div className="flex items-center justify-between text-xs text-slate-400 print:text-slate-500 pt-2 border-t border-slate-800 print:border-slate-200">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              Caduca el: <strong className="text-slate-200 print:text-black">{expirationDate}</strong> (48h)
            </span>
            <span className="text-[11px] text-slate-500">Un solo uso • Encriptado SHA-256</span>
          </div>

          {/* Actions (Hidden on Print) */}
          <div className="space-y-3 pt-2 print:hidden">
            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                {copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}
              </button>

              <button
                onClick={handleDownloadQr}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium rounded-xl text-sm transition-colors cursor-pointer"
                title="Descargar imagen del QR en PNG"
              >
                <Download className="w-4 h-4" />
                Guardar QR
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium rounded-xl text-sm transition-colors cursor-pointer"
                title="Imprimir hoja de instrucciones"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>

            {/* Direct testing link */}
            <div className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/50">
              <span className="text-xs text-slate-400 truncate max-w-[280px]">
                {invitation.activationUrl}
              </span>
              <a
                href={invitation.activationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 shrink-0"
              >
                Abrir Portal <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={onRevoke}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Revocar esta invitación
              </button>
              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
