import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types/index.js';
import { api } from '../../services/api.js';
import { ShieldCheck, Lock, AlertTriangle, FileCode, CheckCircle2, RefreshCw } from 'lucide-react';

export const SecurityAuditTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      console.error('Error al cargar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const dirtyDozenTests = [
    { id: 1, name: 'Reutilización de QR ya activado', status: 'REVISAR', detail: 'Consumo atómico con invalidación inmediata del hash' },
    { id: 2, name: 'Fuerza bruta de tokens QR', status: 'REVISAR', detail: '256 bits de entropía criptográfica (32 bytes base64url)' },
    { id: 3, name: 'Invitación caducada (>48h)', status: 'REVISAR', detail: 'TTL de 48h con rechazo 400 Bad Request en servidor' },
    { id: 4, name: 'Lectura transversal de nóminas', status: 'REVISAR', detail: 'Sesión del trabajador y comprobación de propiedad en servidor' },
    { id: 5, name: 'Suplantación en fichaje (Horizontal)', status: 'REVISAR', detail: 'La sesión debe corresponder al trabajador que ficha' },
    { id: 6, name: 'Fichaje en obra no autorizada', status: 'REVISAR', detail: 'Bloqueo 403 Forbidden si projectId ∉ assignedProjectIds' },
    { id: 7, name: 'Escalada a rol Supervisor', status: 'REVISAR', detail: 'Verificación estricta de claim supervisor en servidor' },
    { id: 8, name: 'Modificación de tarifas por operario', status: 'REVISAR', detail: 'hourlyRate protegido exclusivamente para supervisores' },
    { id: 9, name: 'Inyección de parámetros en URL', status: 'REVISAR', detail: 'Validación estricta de tokens base64url en backend' },
    { id: 10, name: 'Revocación en tiempo real', status: 'REVISAR', detail: 'Bloqueo instantáneo con worker.status === "revoked"' },
    { id: 11, name: 'Cero tokens planos en base de datos', status: 'REVISAR', detail: 'Solo se persiste SHA-256(token), nunca texto plano' },
    { id: 12, name: 'Dispositivos compartidos en obra', status: 'REVISAR', detail: 'Revocación de sesión en servidor y limpieza de credenciales locales' },
  ];

  return (
    <div className="space-y-6">
      {/* Dirty Dozen Matrix */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Matriz de Seguridad Zero-Trust ("Dirty Dozen")
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Catálogo de controles. Esta pantalla no ejecuta ni certifica pruebas de seguridad.
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
            REVISIÓN DE CONTROLES
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dirtyDozenTests.map((t) => (
            <div
              key={t.id}
              className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono font-bold text-blue-400">#0{t.id}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {t.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">{t.name}</h4>
                <p className="text-[11px] text-slate-400 mt-1">{t.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inmutable Audit Log Table */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" /> Registro Inmutable de Auditoría
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Trazabilidad técnica de accesos, emisiones de QR y modificaciones sensibles.
            </p>
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer"
            title="Refrescar auditoría"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Acción</th>
                <th className="py-2.5 px-3">Actor / Rol</th>
                <th className="py-2.5 px-3">Detalles Técnicos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-700/30">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                    {new Date(log.timestamp).toLocaleString('es-ES')}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono font-bold text-blue-400 text-[11px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-white font-medium">{log.actorUid}</span>{' '}
                    <span className="text-[10px] text-slate-500">({log.actorRole})</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
