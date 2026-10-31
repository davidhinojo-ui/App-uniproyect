import React, { useState } from 'react';
import { WorkerDocument, Worker } from '../../types/index.js';
import { api } from '../../services/api.js';
import { FileText, CheckCircle2, Clock, PenTool, ShieldCheck, Download, Loader2 } from 'lucide-react';

interface WorkerDocumentsProps {
  documents: WorkerDocument[];
  worker: Worker;
  onRefresh: () => void;
}

export const WorkerDocuments: React.FC<WorkerDocumentsProps> = ({
  documents,
  worker,
  onRefresh,
}) => {
  const [signingDocId, setSigningDocId] = useState<string | null>(null);

  const handleSign = async (docId: string) => {
    try {
      setSigningDocId(docId);
      await api.signDocument(docId, worker.id);
      onRefresh();
    } catch (err: any) {
      alert('Error al firmar documento: ' + err.message);
    } finally {
      setSigningDocId(null);
    }
  };

  const getDocBadge = (type: WorkerDocument['type']) => {
    switch (type) {
      case 'payroll':
        return { label: 'NÓMINA', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'contract':
        return { label: 'CONTRATO', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'safety_prl':
        return { label: 'PRL SEGURIDAD', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'medical':
        return { label: 'MÉDICO', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      default:
        return { label: 'DOCUMENTO', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    }
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" /> Mis Documentos Laborales
        </h3>
        <p className="text-xs text-slate-400">
          Nóminas oficiales, contratos y certificados de prevención de riesgos laborales.
        </p>
      </div>

      <div className="space-y-3">
        {documents.map((doc) => {
          const badge = getDocBadge(doc.type);
          const isSigning = signingDocId === doc.id;

          return (
            <div
              key={doc.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">{doc.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{doc.period || 'General'}</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.color}`}
                >
                  {badge.label}
                </span>
              </div>

              {/* Status and Action bar */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                {doc.signed ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Firmado
                    {doc.signedAt && (
                      <span className="text-[11px] text-slate-500 font-normal">
                        ({new Date(doc.signedAt).toLocaleDateString('es-ES')})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                    <Clock className="w-4 h-4" /> Pendiente de firma
                  </span>
                )}

                <div className="flex gap-2">
                  {!doc.signed && (
                    <button
                      onClick={() => handleSign(doc.id)}
                      disabled={isSigning}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {isSigning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PenTool className="w-3.5 h-3.5" />
                      )}
                      Firmar Ahora
                    </button>
                  )}

                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      alert(`Descarga de documento oficial: ${doc.title}`);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar
                  </a>
                </div>
              </div>
            </div>
          );
        })}

        {documents.length === 0 && (
          <div className="text-center py-10 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            No tienes documentos subidos por el momento.
          </div>
        )}
      </div>
    </div>
  );
};
