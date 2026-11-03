import React, { useState } from 'react';
import { FacturaAlbaran, Obra } from '../types';
import { Check, Sparkles } from 'lucide-react';

interface DuplicateGroupCardProps {
  group: {
    key: string;
    docs: FacturaAlbaran[];
    supplier: string;
    docNumber: string;
    type: 'factura' | 'albaran';
  };
  bestDoc: FacturaAlbaran;
  obras: Obra[];
  onResolve: (groupKey: string, keepDocId: string) => Promise<void>;
  loading: boolean;
}

export const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({
  group,
  bestDoc,
  obras,
  onResolve,
  loading
}) => {
  const [selectedKeepId, setSelectedKeepId] = useState<string>(bestDoc.id);

  const getObraName = (obraId: string) => {
    return obras.find(o => o.id === obraId)?.name || 'Sin obra';
  };

  const typeLabel = group.type === 'factura' ? 'Factura' : 'Albarán';

  return (
    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl overflow-hidden shadow-xs hover:shadow-sm transition-shadow">
      {/* Card Header */}
      <div className="bg-slate-100/70 border-b border-slate-200/50 px-5 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md ${
            group.type === 'factura' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
          }`}>
            {typeLabel}
          </span>
          <span className="font-mono text-xs font-black text-slate-800">Nº {group.docNumber}</span>
          <span className="text-slate-400">|</span>
          <span className="text-xs font-bold text-slate-700">{group.supplier}</span>
        </div>
        <div className="text-[10px] text-slate-500 font-medium">
          Contiene <strong className="text-slate-800 font-bold">{group.docs.length} copias</strong> repetidas
        </div>
      </div>

      {/* Copies container */}
      <div className="p-4 space-y-2.5">
        <div className="grid grid-cols-1 gap-2">
          {group.docs.map((doc) => {
            const isSelected = selectedKeepId === doc.id;
            const isRecommended = bestDoc.id === doc.id;
            
            return (
              <div 
                key={doc.id}
                onClick={() => setSelectedKeepId(doc.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  isSelected 
                    ? 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20' 
                    : 'bg-white hover:bg-slate-50/50 border-slate-200'
                }`}
              >
                {/* Selector indicator & content */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected 
                      ? 'border-amber-500 bg-amber-500 text-white' 
                      : 'border-slate-300 bg-white'
                  }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[4]" />}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 flex-1 min-w-0">
                    {/* Column 1: Obra */}
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wide">Obra / Proyecto</span>
                      <span className="text-xs font-semibold text-slate-800 truncate block" title={getObraName(doc.obraId)}>
                        {getObraName(doc.obraId)}
                      </span>
                    </div>

                    {/* Column 2: Date */}
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wide">Fecha & Adjunto</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-slate-600 block">{doc.date}</span>
                        {doc.imageUrl && (
                          <span className="text-[10px] text-amber-500 bg-amber-100 px-1 rounded font-bold" title="Contiene documento digital adjunto">📄 PDF/Imagen</span>
                        )}
                      </div>
                    </div>

                    {/* Column 3: Amount */}
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wide">Importe Total Neto</span>
                      <span className="text-xs font-black text-slate-900 block font-mono">
                        {doc.totalAmount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>

                    {/* Column 4: Status and recommendation */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        doc.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                        doc.status === 'pending' ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {doc.status === 'paid' ? 'Pagado' : doc.status === 'pending' ? 'Pendiente' : 'Borrador'}
                      </span>
                      
                      {isRecommended && (
                        <span className="bg-amber-100 text-amber-800 text-[8.5px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Esta copia posee más información rellena o confirmada">
                          <Sparkles className="w-2.5 h-2.5 text-amber-600" /> RECOMENDADO (Completo)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes Column */}
                {doc.notes && (
                  <div className="text-[10px] text-slate-400 max-w-xs truncate border-l border-slate-200 pl-2 self-stretch flex items-center">
                    {doc.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Card Actions */}
        <div className="flex justify-between items-center bg-slate-100/40 p-2.5 rounded-xl border border-slate-200/50">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <span className="text-amber-500 font-bold">⚠️</span>
            <span>Se conservará la copia seleccionada y se eliminarán las otras repetidas de este grupo.</span>
          </div>
          <button
            onClick={() => onResolve(group.key, selectedKeepId)}
            disabled={loading}
            className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-black py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            Conservar Selección ✓
          </button>
        </div>
      </div>
    </div>
  );
};
