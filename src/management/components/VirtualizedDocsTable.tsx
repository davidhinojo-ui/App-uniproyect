import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FacturaAlbaran, Obra, Proveedor } from '../types';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  Eye, 
  Edit3, 
  Trash2, 
  Zap, 
  ChevronUp, 
  ChevronDown,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  CheckSquare,
  Square,
  Filter
} from 'lucide-react';

export interface VirtualizedDocsTableProps {
  documents: FacturaAlbaran[];
  obras: Obra[];
  proveedores: Proveedor[];
  selectedDocIds: string[];
  docSortBy: 'date' | 'totalAmount' | 'docNumber' | 'supplier' | 'category';
  docSortOrder: 'asc' | 'desc';
  onSort: (column: 'date' | 'totalAmount' | 'docNumber' | 'supplier' | 'category') => void;
  onToggleSelectDoc: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenDocModal: (doc: FacturaAlbaran) => void;
  onDeleteDoc: (id: string) => void;
  onViewFullscreen: (imageUrl: string, title: string) => void;
}

export const VirtualizedDocsTable: React.FC<VirtualizedDocsTableProps> = ({
  documents,
  obras,
  proveedores,
  selectedDocIds,
  docSortBy,
  docSortOrder,
  onSort,
  onToggleSelectDoc,
  onToggleSelectAll,
  onOpenDocModal,
  onDeleteDoc,
  onViewFullscreen,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showScrollControls, setShowScrollControls] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const mobilePageSize = 25;

  // Fast O(1) maps to eliminate repetitive lookups across thousands of rows
  const obraMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of obras) {
      map.set(o.id, o.name);
    }
    return map;
  }, [obras]);

  const provCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of proveedores) {
      map.set(p.name.trim().toLowerCase(), p.category);
    }
    return map;
  }, [proveedores]);

  const getDocCategory = (doc: FacturaAlbaran) => {
    if (doc.category) return doc.category;
    const cat = provCategoryMap.get(doc.supplier.trim().toLowerCase());
    return cat || 'Otros Suministros';
  };

  // Virtualizer instance: dynamically calculates and renders only visible items + overscan
  const rowVirtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68, // Default comfortable row height
    overscan: 8, // Pre-render 8 items above and below to ensure silky smooth 60fps scrolling
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Calculate spacer padding for native HTML table rendering
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  // Reset scroll if filtering reduces total records significantly
  const prevCountRef = useRef(documents.length);
  useEffect(() => {
    if (parentRef.current && parentRef.current.scrollTop > 0 && documents.length < prevCountRef.current) {
      if (parentRef.current.scrollTop >= totalSize) {
        rowVirtualizer.scrollToOffset(0);
      }
    }
    prevCountRef.current = documents.length;
  }, [documents.length, totalSize, rowVirtualizer]);

  // Monitor scroll offset to show back-to-top button
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShowScrollControls(el.scrollTop > 260);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const allFilteredSelected = documents.length > 0 && documents.every(d => selectedDocIds.includes(d.id));

  // Sort indicator helper
  const renderSortIndicator = (column: 'date' | 'totalAmount' | 'docNumber' | 'supplier' | 'category') => {
    if (docSortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 opacity-30 inline-block ml-1" />;
    }
    return docSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#10B981] inline-block ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#10B981] inline-block ml-1" />
    );
  };

  // Mobile paginated documents list
  const mobileVisibleDocs = useMemo(() => {
    return documents.slice(0, mobilePage * mobilePageSize);
  }, [documents, mobilePage, mobilePageSize]);

  return (
    <div className="bg-[#151515] rounded-2xl border border-white/5 shadow-sm overflow-hidden flex flex-col relative" id="docs-table-card">
      {/* Performance & Virtualization Status Header */}
      <div className="px-4 md:px-5 py-2.5 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#10B981]/15 text-[#059669] dark:text-[#10B981] text-[10px] font-mono font-bold tracking-wide">
            <Zap className="w-3 h-3" />
            <span className="hidden sm:inline">VIRTUALIZADO</span>
            <span className="sm:hidden">RÁPIDO</span>
          </span>
          <span className="text-[11px] text-slate-600 dark:text-white/60">
            <strong className="text-slate-900 dark:text-white">{documents.length}</strong> documentos
            {selectedDocIds.length > 0 && (
              <span className="text-amber-500 font-bold ml-1.5">
                ({selectedDocIds.length} seleccionados)
              </span>
            )}
          </span>
        </div>

        {/* Mobile Selection & Sort Trigger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="touch-target px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-white/80 flex items-center gap-1.5 active:scale-95"
          >
            {allFilteredSelected ? (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Deseleccionar</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 text-white/40" />
                <span>Sel. todos</span>
              </>
            )}
          </button>
        </div>

        {/* Desktop Quick jump navigation buttons */}
        {documents.length > 15 && (
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => rowVirtualizer.scrollToOffset(0, { behavior: 'smooth' })}
              className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] font-bold text-slate-700 hover:text-slate-900 dark:text-white/70 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
              title="Desplazar al primer registro"
            >
              <ChevronUp className="w-3 h-3" />
              Inicio
            </button>
            <button
              onClick={() => rowVirtualizer.scrollToIndex(documents.length - 1, { align: 'end', behavior: 'smooth' })}
              className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] font-bold text-slate-700 hover:text-slate-900 dark:text-white/70 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer"
              title="Desplazar al último registro"
            >
              <ChevronDown className="w-3 h-3" />
              Final
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          1. MOBILE / TOUCH CARD VIEW (block md:hidden)
          Optimized for phone screens: large touch targets >= 44px, clean badges,
          immediate obra context, quick photo preview & actions.
         ========================================================================= */}
      <div className="block md:hidden p-3 space-y-3 bg-[#111111]" id="docs-mobile-cards-container">
        {documents.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-500 dark:text-white/40 text-xs font-medium">
            <FileText className="w-10 h-10 mx-auto text-white/20 mb-2" />
            No se encontraron facturas ni albaranes con los filtros actuales.
          </div>
        ) : (
          <>
            {mobileVisibleDocs.map((doc) => {
              const relatedWork = obraMap.get(doc.obraId) || 'Sin obra asignada';
              const isSelected = selectedDocIds.includes(doc.id);
              const categoryName = getDocCategory(doc);

              return (
                <div
                  key={doc.id}
                  className={`rounded-2xl p-4 transition-all border ${
                    isSelected 
                      ? 'bg-emerald-950/25 border-[#10B981]/50 shadow-md shadow-emerald-950/20' 
                      : 'bg-[#181818] border-white/5 hover:border-white/10'
                  }`}
                  id={`mobile-doc-card-${doc.id}`}
                >
                  {/* Top row: Checkbox, Doc number, type badge, status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-3">
                      {/* 44px minimum touch area for mobile finger tapping */}
                      <button
                        type="button"
                        onClick={() => onToggleSelectDoc(doc.id)}
                        className="touch-target w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/15 text-white/80 active:scale-95 shrink-0 mt-0.5"
                        title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                        aria-label={`Seleccionar documento ${doc.docNumber}`}
                      >
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-sm border border-white/30" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-white font-extrabold text-sm tracking-tight">
                            {doc.docNumber || 'S/N'}
                          </span>
                          <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md ${
                            doc.type === 'factura'
                              ? 'bg-emerald-500/15 text-[#10B981] border border-emerald-500/20'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                          }`}>
                            {doc.type === 'factura' ? 'Factura' : 'Albarán'}
                          </span>
                        </div>

                        <span className="text-[10px] text-white/40 font-mono flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3 text-white/30" />
                          {doc.date || 'Sin fecha'}
                        </span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 ${
                      doc.status === 'paid' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : doc.status === 'pending' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                          : 'bg-white/10 text-white/60'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        doc.status === 'paid' ? 'bg-emerald-400' :
                        doc.status === 'pending' ? 'bg-amber-400' : 'bg-white/40'
                      }`}></span>
                      {doc.status === 'paid' ? 'Pagado' : doc.status === 'pending' ? 'Pendiente' : 'Borrador'}
                    </span>
                  </div>

                  {/* Middle row: Supplier & assigned Obra */}
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white/90 truncate mr-2" title={doc.supplier}>
                        {doc.supplier || 'Proveedor no especificado'}
                      </span>
                      <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                        {categoryName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-white/70">
                      <Building2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                      <span className="truncate font-medium" title={relatedWork}>
                        {relatedWork}
                      </span>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="mt-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[9.5px] uppercase font-bold text-white/40 block">Base Imponible</span>
                      <span className="font-mono text-xs text-white/70">
                        {(Number(doc.baseAmount) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9.5px] uppercase font-bold text-emerald-400 block">Total con IVA</span>
                      <span className="font-mono text-sm font-black text-white">
                        {(Number(doc.totalAmount) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Bar: touch targets >= 44px */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-end gap-2">
                    {doc.imageUrl && (
                      <button
                        type="button"
                        onClick={() => onViewFullscreen(doc.imageUrl || '', `${doc.supplier} (${doc.docNumber})`)}
                        className="touch-target px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                        title="Ver documento en pantalla completa"
                      >
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span>Ver Foto</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenDocModal(doc)}
                      className="touch-target px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                      title="Editar documento"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-white/60" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteDoc(doc.id)}
                      className="touch-target p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 active:scale-95 transition-all"
                      title="Eliminar documento"
                      aria-label="Eliminar documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Load more mobile cards button */}
            {documents.length > mobileVisibleDocs.length && (
              <button
                type="button"
                onClick={() => setMobilePage(prev => prev + 1)}
                className="w-full touch-target py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-xs text-center active:scale-98 transition-all"
              >
                Cargar más documentos ({documents.length - mobileVisibleDocs.length} restantes)
              </button>
            )}
          </>
        )}
      </div>

      {/* =========================================================================
          2. DESKTOP / LARGE TABLET VIEW (hidden md:block)
          High-performance virtualized TanStack table with column sorting.
         ========================================================================= */}
      <div 
        ref={parentRef} 
        className="hidden md:block overflow-auto max-h-[620px] relative scroll-smooth" 
        id="docs-table-scroll"
      >
        <table className="w-full text-left font-sans text-xs border-collapse" id="docs-table">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#141416] border-b border-slate-200 dark:border-white/5 shadow-xs">
            <tr className="text-slate-600 dark:text-white/40 uppercase text-[10px] tracking-wider font-semibold select-none">
              <th className="px-5 py-3.5 w-12 text-center bg-inherit">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 dark:border-white/10 bg-white dark:bg-[#151515] focus:ring-0 text-[#10B981] accent-[#10B981] cursor-pointer"
                  title="Seleccionar todos los filtrados"
                />
              </th>
              <th 
                className="px-5 py-3.5 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap min-w-[160px] bg-inherit" 
                onClick={() => onSort('docNumber')}
              >
                Nº Documento / Tipo {renderSortIndicator('docNumber')}
              </th>
              <th 
                className="px-5 py-3.5 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap min-w-[180px] bg-inherit" 
                onClick={() => onSort('supplier')}
              >
                Emisor Proveedor {renderSortIndicator('supplier')}
              </th>
              <th 
                className="px-5 py-3.5 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap min-w-[140px] bg-inherit" 
                onClick={() => onSort('category')}
              >
                Categoría {renderSortIndicator('category')}
              </th>
              <th 
                className="px-5 py-3.5 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap min-w-[100px] bg-inherit" 
                onClick={() => onSort('date')}
              >
                Fecha {renderSortIndicator('date')}
              </th>
              <th className="px-5 py-3.5 min-w-[160px] bg-inherit">Obra / Proyecto</th>
              <th className="px-5 py-3.5 text-right font-sans min-w-[110px] bg-inherit">Base Imp. (€)</th>
              <th 
                className="px-5 py-3.5 text-right font-sans cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap min-w-[120px] bg-inherit" 
                onClick={() => onSort('totalAmount')}
              >
                Total Neto (€) {renderSortIndicator('totalAmount')}
              </th>
              <th className="px-5 py-3.5 min-w-[110px] bg-inherit">Estado</th>
              <th className="px-5 py-3.5 text-center w-28 bg-inherit">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-800 dark:text-white/80">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-12 text-center text-slate-500 dark:text-white/40 font-medium">
                  No se encontraron registros de facturaciones/albaranes coincidiendo con los parámetros.
                </td>
              </tr>
            ) : (
              <>
                {/* Virtual Spacer Top */}
                {paddingTop > 0 && (
                  <tr style={{ height: `${paddingTop}px` }} aria-hidden="true">
                    <td colSpan={10} style={{ padding: 0, border: 'none', height: `${paddingTop}px` }} />
                  </tr>
                )}

                {/* Virtualized Visible Rows */}
                {virtualRows.map((virtualRow) => {
                  const doc = documents[virtualRow.index];
                  if (!doc) return null;
                  const relatedWork = obraMap.get(doc.obraId) || 'Sin obra';
                  const isSelected = selectedDocIds.includes(doc.id);
                  const categoryName = getDocCategory(doc);

                  return (
                    <tr 
                      key={doc.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className={`hover:bg-slate-100/70 dark:hover:bg-white/5 transition-colors ${
                        isSelected ? 'bg-emerald-50/80 dark:bg-emerald-950/20' : ''
                      }`} 
                      id={`row-doc-${doc.id}`}
                    >
                      <td className="px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelectDoc(doc.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-white/10 bg-white dark:bg-[#151515] focus:ring-0 text-[#10B981] accent-[#10B981] cursor-pointer"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <strong className="font-mono text-slate-900 dark:text-white font-bold block">{doc.docNumber}</strong>
                          <span className={`text-[9.5px] uppercase font-black px-1.5 py-0.5 rounded-md mt-1 inline-block ${
                            doc.type === 'factura' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-[#10B981]/15 dark:text-[#10B981]' 
                              : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/60'
                          }`}>
                            {doc.type === 'factura' ? 'Factura' : 'Albarán'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white/90">{doc.supplier}</td>
                      <td className="px-5 py-4">
                        <span className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 px-2 py-0.8 rounded text-[10px] font-medium inline-block truncate max-w-[150px]">
                          {categoryName}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-600 dark:text-white/50 whitespace-nowrap">{doc.date}</td>
                      <td className="px-5 py-4 text-slate-700 dark:text-white/70 max-w-[150px] truncate" title={relatedWork}>
                        {relatedWork}
                      </td>
                      <td className="px-5 py-4 font-mono text-right text-slate-700 dark:text-white/60 whitespace-nowrap">
                        {(Number(doc.baseAmount) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 font-mono text-right text-slate-900 dark:text-white font-black whitespace-nowrap">
                        {(Number(doc.totalAmount) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap ${
                          doc.status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400' 
                            : doc.status === 'pending' 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400' 
                              : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/60'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            doc.status === 'paid' ? 'bg-emerald-600 dark:bg-emerald-400' :
                            doc.status === 'pending' ? 'bg-amber-600 dark:bg-amber-400' : 'bg-slate-500 dark:bg-white/40'
                          }`}></span>
                          {doc.status === 'paid' ? 'Pagado' : doc.status === 'pending' ? 'Pendiente' : 'Borrador'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex gap-1.5 justify-center items-center">
                          {doc.imageUrl && (
                            <button
                              onClick={() => onViewFullscreen(doc.imageUrl || '', `${doc.supplier} (${doc.docNumber})`)}
                              className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                              title="Ver en Pantalla Completa"
                              id={`btn-fullscreen-doc-${doc.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onOpenDocModal(doc)}
                            className="text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title="Editar documento"
                            id={`btn-edit-doc-${doc.id}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteDoc(doc.id)}
                            className="text-slate-500 dark:text-white/40 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                            title="Eliminar documento"
                            id={`btn-del-doc-${doc.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Virtual Spacer Bottom */}
                {paddingBottom > 0 && (
                  <tr style={{ height: `${paddingBottom}px` }} aria-hidden="true">
                    <td colSpan={10} style={{ padding: 0, border: 'none', height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Scroll to Top Pill */}
      {showScrollControls && (
        <button
          onClick={() => rowVirtualizer.scrollToOffset(0, { behavior: 'smooth' })}
          className="absolute bottom-4 right-6 bg-[#10B981] hover:bg-[#059669] text-white font-extrabold px-3 py-1.5 rounded-full text-xs shadow-lg flex items-center gap-1.5 z-20 transition-all duration-200 animate-fadeIn cursor-pointer"
          title="Volver arriba"
        >
          <ChevronUp className="w-4 h-4" />
          Arriba
        </button>
      )}
    </div>
  );
};
