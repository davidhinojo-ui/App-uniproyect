/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Obra, FacturaAlbaran, PersonalCost, OtrosGasto, getObraOverheadAllocationMap, getProratedPersonalCost } from '../types';
import { FileSpreadsheet, Printer, Eye, Calendar, RefreshCw, Cloud, Loader2, TrendingUp } from 'lucide-react';
import { getAccessToken, googleSignIn } from '../lib/googleAuth';
import { uploadReportToDrive, getOrCreateDriveFolderAtPath, uploadFileToFolder, uploadBinaryToDriveFolder } from '../lib/googleDriveService';
import { exportToExcel } from '../exportUtils';
// @ts-ignore
import html2pdf from 'html2pdf.js';
// @ts-ignore
import { jsPDF } from 'jspdf';
// @ts-ignore
import autoTable from 'jspdf-autotable';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

interface ReportViewerProps {
  selectedObraId: string | 'all';
  obras: Obra[];
  documentos: FacturaAlbaran[];
  personal: PersonalCost[];
  gastosGenerales: OtrosGasto[];
}

export default function ReportViewer({
  selectedObraId,
  obras,
  documentos,
  personal,
  gastosGenerales,
}: ReportViewerProps) {
  // Sync selectedObraId state from parent component, allowing local granular overrides too
  const [localObraId, setLocalObraId] = useState(selectedObraId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Google Drive backup / export state
  const [isExportingToDrive, setIsExportingToDrive] = useState(false);
  const [driveExportLink, setDriveExportLink] = useState<string | null>(null);
  const [driveExportError, setDriveExportError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportToGoogleDrive = async () => {
    setIsExportingToDrive(true);
    setDriveExportLink(null);
    setDriveExportError(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        // Prompt connection if key not cached in-memory
        const result = await googleSignIn();
        if (result) {
          token = result.accessToken;
        } else {
          throw new Error('Debe autenticarse primero con su cuenta de Google.');
        }
      }

      if (!token) {
        throw new Error('Debe iniciar sesión para exportar informes.');
      }

      const obraLabel = currentObra === 'all' ? 'Consolidado_Global_Todas_Las_Obras' : currentObra.name;
      const periodLabel = `${startDate || 'Inicial'} hasta ${endDate || 'Actual'}`;
      const fileName = `Informe_Balance_${obraLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.md`;

      const textDescription = `
## UNIPROYECT - REPORTE DE BALANCE DE GASTOS DE OBRA
---
* **Proyecto / Obra Analizada:** ${obraLabel}
* **Rango de Fechas analizado:** ${periodLabel}
* **Importe Consolidado Acumulado:** ${grandTotalCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}

### 📋 Costes Operativos de Balance
1. **Materiales e Insumos (Facturas / Albaranes):** ${totalMaterials.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} (${filteredDocs.length} documentos validados)
2. **Partes de Mano de Obra Registrados:** ${totalLabor.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} (${totalLaborHours.toFixed(1)} horas oficiales)
3. **Imputación de Gastos Indirectos Generales:** ${companyOverhead.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}

---

### 🧱 Detalle Itemizado de Documentos Registrados
${filteredDocs.map(doc => `* **${doc.supplier}** (Ref: ${doc.docNumber}): **${doc.totalAmount.toFixed(2)} €** [${doc.type === 'factura' ? 'Factura' : 'Albarán'} - ${doc.date}]`).join('\n') || 'Ninguno documento imputado.'}

### 👷 Horas y Especialistas de Personal
${filteredPersonal.map(p => `* **${p.workerName}** (${p.role}): ${p.hours.toFixed(1)}h a **${p.hourlyRate} €/h** • total **${p.totalCost.toFixed(2)} €** [Fec: ${p.date}]${(p as any).hasProration ? ` (Prorrateado: ${((p as any).prorationFactor * 100).toFixed(0)}%)` : ''}`).join('\n') || 'Ningún parte registrado.'}
`;

      const structuredReport = {
        obra: obraLabel,
        rangoFechas: periodLabel,
        detallesFinancieros: {
          costoMateriales: totalMaterials,
          totalDocumentos: filteredDocs.length,
          costoPersonal: totalLabor,
          totalHorasManoObra: totalLaborHours,
          gastosGeneralesAsignados: companyOverhead,
          granCostoTotal: grandTotalCost
        }
      };

      const result = await uploadReportToDrive(token, fileName, textDescription, structuredReport);
      setDriveExportLink(result.webViewLink);
    } catch (err: any) {
      console.error(err);
      setDriveExportError(err.message || 'No se pudo subir el archivo del informe balance.');
    } finally {
      setIsExportingToDrive(false);
    }
  };

  useEffect(() => {
    setLocalObraId(selectedObraId);
  }, [selectedObraId]);

  const currentObra = localObraId === 'all' 
    ? 'all' 
    : obras.find(o => o.id === localObraId) || 'all';

  // --- COMPREHENSIVE FILTERING ENGINE ---
  const filteredDocs = documentos.filter(doc => {
    // Obra filter
    if (localObraId !== 'all' && doc.obraId !== localObraId) {
      return false;
    }
    // Date start filter
    if (startDate && doc.date < startDate) {
      return false;
    }
    // Date end filter
    if (endDate && doc.date > endDate) {
      return false;
    }
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const filteredPersonal = personal.map(p => {
    return getProratedPersonalCost(p, startDate, endDate);
  }).filter(p => {
    // Obra filter
    if (localObraId !== 'all') {
      if (p.obraId !== localObraId) return false;
    } else {
      if (p.obraId === 'structural') return false;
    }
    // Date filter: only include if there is an overlap
    if (p.overlapDays <= 0) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const filteredPersonalStructural = personal.map(p => {
    return getProratedPersonalCost(p, startDate, endDate);
  }).filter(p => {
    if (p.obraId !== 'structural') return false;
    if (p.overlapDays <= 0) return false;
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const filteredGastosGenerales = gastosGenerales.filter(g => {
    // Gastos generales are usually centralized, so we filter them by date range
    if (startDate && g.date < startDate) {
      return false;
    }
    if (endDate && g.date > endDate) {
      return false;
    }
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const combinedStructuralExpenses = [
    ...filteredGastosGenerales.map(g => ({
      id: g.id,
      category: g.category,
      description: g.description,
      date: g.date,
      amount: g.amount
    })),
    ...filteredPersonalStructural.map(p => ({
      id: p.id,
      category: 'Personal de Oficina/Estructura',
      description: `${p.workerName} (${p.role})`,
      date: p.date,
      amount: p.totalCost
    }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  // --- MATH BALANCES ---
  const totalBase = filteredDocs.reduce((sum, d) => sum + d.baseAmount, 0);
  const totalIva = filteredDocs.reduce((sum, d) => sum + d.ivaAmount, 0);
  const totalRetention = filteredDocs.reduce((sum, d) => sum + d.retentionAmount, 0);
  const totalMaterials = filteredDocs.reduce((sum, d) => sum + d.totalAmount, 0);
  
  const totalLabor = filteredPersonal.reduce((sum, p) => sum + p.totalCost, 0);
  const totalLaborHours = filteredPersonal.reduce((sum, p) => sum + p.hours, 0);

  const totalBudgetOfAllObras = obras.reduce((sum, o) => sum + o.budget, 0);
  const totalFilteredOverhead = filteredGastosGenerales.reduce((sum, g) => sum + g.amount, 0) +
                                filteredPersonalStructural.reduce((sum, p) => sum + p.totalCost, 0);

  const overheadAllocationMap = getObraOverheadAllocationMap(obras, totalFilteredOverhead);

  const companyOverhead = localObraId === 'all'
    ? totalFilteredOverhead
    : (overheadAllocationMap[localObraId]?.amount || 0);

  const grandTotalCost = totalMaterials + totalLabor + companyOverhead;
  const totalBudget = localObraId === 'all'
    ? obras.reduce((sum, o) => sum + o.budget, 0)
    : (currentObra === 'all' ? 0 : currentObra.budget);

  const currentBudgetProgress = totalBudget > 0 ? (grandTotalCost / totalBudget) * 100 : 0;
  const grossProfitMargin = totalBudget - grandTotalCost;
  const isProfit = grossProfitMargin >= 0;

  // --- TREND AND ACCUMULATED BUDGET CHART DATA ---
  const getMonthlyTrendData = () => {
    const monthsSet = new Set<string>();
    
    filteredDocs.forEach(d => {
      if (d.date && d.date.length >= 7) {
        monthsSet.add(d.date.substring(0, 7));
      }
    });
    filteredPersonal.forEach(p => {
      if (p.date && p.date.length >= 7) {
        monthsSet.add(p.date.substring(0, 7));
      }
    });
    filteredGastosGenerales.forEach(g => {
      if (g.date && g.date.length >= 7) {
        monthsSet.add(g.date.substring(0, 7));
      }
    });

    const sortedMonths = Array.from(monthsSet).sort();
    
    let runningTotal = 0;
    const ratio = localObraId !== 'all'
      ? (overheadAllocationMap[localObraId]?.percent || 0)
      : 1;

    return sortedMonths.map(month => {
      // Sum docs in this month
      const materials = filteredDocs
        .filter(d => d.date && d.date.startsWith(month))
        .reduce((sum, d) => sum + d.totalAmount, 0);
        
      // Sum labor in this month
      const labor = filteredPersonal
        .filter(p => p.date && p.date.startsWith(month))
        .reduce((sum, p) => sum + p.totalCost, 0);
        
      // Sum overhead/gastosGenerales in this month
      const overheadRaw = filteredGastosGenerales
        .filter(g => g.date && g.date.startsWith(month))
        .reduce((sum, g) => sum + g.amount, 0);
        
      const overhead = localObraId === 'all' 
        ? overheadRaw 
        : overheadRaw * ratio;
        
      const totalMonth = materials + labor + overhead;
      runningTotal += totalMonth;
      
      // Format month name to Spanish, e.g. "May 26"
      let label = month;
      try {
        const [year, monthNum] = month.split('-');
        const dateObj = new Date(Number(year), Number(monthNum) - 1, 1);
        const textStr = dateObj.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        label = textStr.charAt(0).toUpperCase() + textStr.slice(1);
      } catch (e) {
        // Fallback
      }

      return {
        month,
        label,
        Materiales: Number(materials.toFixed(2)),
        Personal: Number(labor.toFixed(2)),
        Indirectos: Number(overhead.toFixed(2)),
        'Gasto Mensual': Number(totalMonth.toFixed(2)),
        'Gasto Acumulado': Number(runningTotal.toFixed(2)),
        'Presupuesto': totalBudget // flat budget ceiling
      };
    });
  };

  const chartData = getMonthlyTrendData();

  // Custom polished Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1A1C] border border-white/10 p-4 rounded-xl shadow-2xl text-xs space-y-1.5 text-left font-sans text-white">
          <p className="font-bold text-white mb-2 border-b border-white/5 pb-1 flex items-center gap-1.5">
            <span className="text-[#10B981]">📅</span> {label}
          </p>
          {payload.map((pld: any) => {
            const isCumulative = pld.name === 'Gasto Acumulado';
            const isBudget = pld.name === 'Presupuesto' || pld.name === 'Presupuesto Límite';
            
            let colorClass = 'text-white';
            if (pld.name === 'Materiales') colorClass = 'text-amber-400';
            else if (pld.name === 'Personal') colorClass = 'text-sky-400';
            else if (pld.name === 'Indirectos') colorClass = 'text-violet-400';
            else if (isCumulative) colorClass = 'text-emerald-400 font-bold';
            else if (isBudget) colorClass = 'text-red-400 font-bold';

            return (
              <div key={pld.name} className="flex justify-between items-center gap-6">
                <span className={`text-white/60 font-medium ${isCumulative ? 'underline' : ''}`}>{pld.name}:</span>
                <span className={`font-mono font-bold ${colorClass}`}>
                  {pld.value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // --- ACTIONS ---
  const triggerPDFPrint = () => {
    setIsExportingPDF(true);
    
    try {
      // 1. Initialize jsPDF Document (A4 portrait)
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      
      const selectedObra = obras.find(o => o.id === localObraId);
      const obraLabel = localObraId === 'all' ? 'Consolidado_Todas_Las_Obras' : (selectedObra?.name || 'Obra');
      const filename = `INFORME_BALANCE_${obraLabel.toUpperCase().replace(/[^A-Za-z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      // 2. Add Company Header and Logo (Vector Drawings)
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
        doc.text('UNIPROYECT', 33, 25.5);

        // Company Metadata Context on Top Right
        doc.setTextColor(71, 85, 105); // slate-600
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text('UNIPROYECT', 195, 17, { align: 'right' });
        doc.text('NIF: B-56755085', 195, 21, { align: 'right' });
        doc.text('C/ Amapola 8, 11.630, Arcos de la Frontera', 195, 25, { align: 'right' });
        doc.text('Telf: [TELÉFONO EMPRESA] | Correo: empresa@ejemplo.invalid', 195, 29, { align: 'right' });

        // Flat Colored Divider Line
        doc.setDrawColor(16, 185, 129); // Emerald Line
        doc.setLineWidth(0.8);
        doc.line(15, 33, 195, 33);
      };

      drawDocumentHeader();

      // 3. Audit Meta Context Filter Panel
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.4);
      doc.roundedRect(15, 37, 180, 18, 2, 2, 'FD');

      // Audited Obra Name
      doc.setTextColor(100, 116, 139); // slate-400
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('OBRA AUDITADA Y CONTROL', 19, 41.5);
      
      let obraText = currentObra === 'all' ? 'CONSOLIDADO GENERAL DE OBRAS' : currentObra.name.toUpperCase();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59); // slate-800
      // Prevent overlap into the next column by truncating if needed
      if (doc.getTextWidth(obraText) > 80) {
        let truncated = obraText;
        while (truncated.length > 0 && doc.getTextWidth(truncated + '...') > 80) {
          truncated = truncated.slice(0, -1);
        }
        obraText = truncated + '...';
      }
      doc.text(obraText, 19, 46.5);

      if (currentObra !== 'all') {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        let locText = `Ubicación: ${currentObra.location}`;
        if (doc.getTextWidth(locText) > 80) {
          let truncated = locText;
          while (truncated.length > 0 && doc.getTextWidth(truncated + '...') > 80) {
            truncated = truncated.slice(0, -1);
          }
          locText = truncated + '...';
        }
        doc.text(locText, 19, 51);
      }

      const formatSpanishDate = (dateStr: string | null) => {
        if (!dateStr || dateStr.trim() === '') return 'Sin límite';
        const parts = dateStr.trim().split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
      };

      // Temporal Period Filter
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('PERIODO TEMPORAL', 105, 41.5);
      
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const startFmt = formatSpanishDate(startDate);
      const endFmt = formatSpanishDate(endDate);
      const rangeText = `${startFmt}  a  ${endFmt}`;
      doc.text(rangeText, 105, 46.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text('Filtro contable de cuentas', 105, 51);

      // Financial status indicator block
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('ESTADO GENERAL', 153, 41.5);

      if (isProfit) {
        doc.setFillColor(209, 250, 229); // emerald-100 banner
        doc.roundedRect(153, 44, 37, 6, 1, 1, 'F');
        doc.setTextColor(4, 120, 87); // emerald-700
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text('PRESUPUESTO OPTIMO', 156, 48);
      } else {
        doc.setFillColor(254, 226, 226); // red-100 banner
        doc.roundedRect(153, 44, 37, 6, 1, 1, 'F');
        doc.setTextColor(185, 28, 28); // red-700
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text('DESVIACION NEGATIVA', 155.5, 48);
      }

      // 4. Balanced Key KPI metrics cards side-by-side
      let cardY = 59;
      let cardH = 14;
      let cardW = 57;
      let gap = 4.5;

      // Card 1: Presupuesto Inicial Adjudicado
      let cardX1 = 15;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cardX1, cardY, cardW, cardH, 1.5, 1.5, 'FD');
      
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('PRESUPUESTO INICIAL ADJUDICADO', cardX1 + 4, cardY + 4);
      
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalBudget), cardX1 + 4, cardY + 10);

      // Card 2: Gastos Totales de Ejecución
      let cardX2 = cardX1 + cardW + gap;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cardX2, cardY, cardW, cardH, 1.5, 1.5, 'FD');
      
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('GASTOS REALES DE EJECUCIÓN', cardX2 + 4, cardY + 4);
      
      doc.setTextColor(30, 41, 59); // slate-800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalCost), cardX2 + 4, cardY + 10);

      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(`Consumo presupuestario: ${currentBudgetProgress.toFixed(1)}%`, cardX2 + 4, cardY + 12.8);

      // Card 3: Margen de Utilidad Estimado
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
      doc.text('MARGEN DE UTILIDAD ESTIMADO', cardX3 + 4, cardY + 4);
      
      if (isProfit) {
        doc.setTextColor(13, 148, 136); // teal-600
      } else {
        doc.setTextColor(220, 38, 38); // red-600
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grossProfitMargin), cardX3 + 4, cardY + 10);

      const computedProfitPercent = totalBudget > 0 ? (grossProfitMargin / totalBudget * 100).toFixed(1) : '0';
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(`Rendimiento bruto: ${computedProfitPercent}%`, cardX3 + 4, cardY + 12.8);

      // 5. Build dynamic tables structured for printing
      let nextY = 78;

      // 5.1 PREPARING SECTION TITLE HELPER
      const drawSectionTitle = (title: string, yPos: number): number => {
        if (yPos + 15 > 280) {
          doc.addPage();
          yPos = 20;
        }
        doc.setTextColor(15, 23, 42); // slate-900 / black
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(title, 15, yPos);
        return yPos + 3;
      };

      // TABLE 1: Materials
      nextY = drawSectionTitle('1. Suministros, Materiales y Subcontratas Homologadas (Lotes e IA)', nextY);

      const matRows = filteredDocs.map((doc, idx) => [
        doc.docNumber || '',
        doc.supplier || '',
        doc.date || '',
        doc.baseAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        `${doc.ivaAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${doc.ivaRate}%)`,
        `${doc.retentionAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${doc.retentionRate}%)`,
        doc.totalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ]);

      // Totals row for Materials
      matRows.push([
        'TOTAL MATERIALES Y SUMINISTROS',
        '',
        '',
        totalBase.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
        totalIva.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
        totalRetention.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €',
        totalMaterials.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €'
      ]);

      autoTable(doc, {
        startY: nextY,
        margin: { left: 15, right: 15, bottom: 20 },
        head: [['Nº DoC', 'Proveedor / Emisor', 'Fecha', 'Base Imp. (€)', 'IVA (€)', 'Retención (€)', 'Total Neto (€)']],
        body: matRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.8, font: 'helvetica' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 20 },
          1: { halign: 'left', cellWidth: 52 },
          2: { halign: 'left', cellWidth: 18 },
          3: { halign: 'right', cellWidth: 22 },
          4: { halign: 'right', cellWidth: 22 },
          5: { halign: 'right', cellWidth: 22 },
          6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 }
        },
        didParseCell: function (data) {
          if (data.row.index === matRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [248, 250, 252];
            if (data.column.index === 6) {
              data.cell.styles.textColor = [16, 185, 129];
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable.finalY + 12;

      // TABLE 2: Labor Cost
      nextY = drawSectionTitle('2. Costes de Mano de Obra Consumida (Partes de Trabajo en Obra)', nextY);

      const laborRows = filteredPersonal.map(p => {
        let hoursStr = `${p.hours.toFixed(1)} h`;
        if ((p as any).hasProration) {
          hoursStr += `\n(Prorrata: ${((p as any).prorationFactor * 100).toFixed(1)}%)`;
        }
        let rateStr = `${p.hourlyRate.toFixed(2)} €/h`;
        if (p.costType === 'mensual') {
          rateStr += `\n(${(p as any).originalTotalCost.toFixed(2)} €/mes)`;
        }
        let costStr = `${p.totalCost.toFixed(2)} €`;
        if ((p as any).hasProration) {
          costStr += `\n(Orig: ${(p as any).originalTotalCost.toFixed(2)} €)`;
        }

        return [
          p.workerName || '',
          p.role || '',
          p.date || '',
          hoursStr,
          rateStr,
          costStr
        ];
      });

      // Total row for Labor
      laborRows.push([
        'TOTAL MANO DE OBRA Y PARTES',
        '',
        '',
        `${totalLaborHours.toFixed(1)} h`,
        '',
        `${totalLabor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      ]);

      autoTable(doc, {
        startY: nextY,
        margin: { left: 15, right: 15, bottom: 20 },
        head: [['Operario / Trabajador', 'Especialidad / Cargo', 'Fecha Registro', 'Horas imputadas', 'Tarifa Contratada', 'Coste Imputado (€)']],
        body: laborRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.8, font: 'helvetica' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 },
          1: { halign: 'left', cellWidth: 45 },
          2: { halign: 'left', cellWidth: 24 },
          3: { halign: 'right', cellWidth: 22 },
          4: { halign: 'right', cellWidth: 22 },
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }
        },
        didParseCell: function (data) {
          if (data.row.index === laborRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [248, 250, 252];
            if (data.column.index === 5) {
              data.cell.styles.textColor = [16, 185, 129];
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable.finalY + 12;

      // TABLE 3: Indirect expenses
      nextY = drawSectionTitle('3. Gastos Indirectos de Empresa y Repercusión Estructural', nextY);

      const overheadRows = combinedStructuralExpenses.map(g => {
        const itemRatio = localObraId === 'all' ? 1.0 : (overheadAllocationMap[localObraId]?.percent || 0);
        const proratedAmount = g.amount * itemRatio;
        return [
          g.category || '',
          g.description || '',
          g.date || '',
          `${g.amount.toFixed(2)} €`,
          `${(itemRatio * 100).toFixed(2)} %`,
          `${proratedAmount.toFixed(2)} €`
        ];
      });

      // Total row for Overhead
      overheadRows.push([
        'TOTAL GASTOS GENERALES Y CORPORATIVOS',
        '',
        '',
        `${totalFilteredOverhead.toFixed(2)} €`,
        `${(localObraId !== 'all' ? (overheadAllocationMap[localObraId]?.percent || 0) * 100 : 100).toFixed(2)} %`,
        `${companyOverhead.toFixed(2)} €`
      ]);

      autoTable(doc, {
        startY: nextY,
        margin: { left: 15, right: 15, bottom: 20 },
        head: [['Categoría Gasto', 'Concepto / Descripción', 'Fecha Devengo', 'Gasto Empresa (€)', 'Repercusión Contable', 'Cuota Imputada (€)']],
        body: overheadRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.8, font: 'helvetica' },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 42 },
          1: { halign: 'left', cellWidth: 48 },
          2: { halign: 'left', cellWidth: 24 },
          3: { halign: 'right', cellWidth: 22 },
          4: { halign: 'right', cellWidth: 22 },
          5: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }
        },
        didParseCell: function (data) {
          if (data.row.index === overheadRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [248, 250, 252];
            if (data.column.index === 5) {
              data.cell.styles.textColor = [16, 185, 129];
            }
          }
        }
      });

      nextY = (doc as any).lastAutoTable.finalY + 12;

      // 5.4 FINAL FOOTER BAR BLOCK SUM
      if (nextY + 28 > 280) {
        doc.addPage();
        nextY = 20;
      }

      doc.setFillColor(30, 41, 59); // slate-800 background
      doc.roundedRect(15, nextY, 180, 20, 1.5, 1.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const sumLabel = currentObra === 'all'
        ? 'INFORME DE CONTROL ACUMULADO GLOBAL CONSOLIDADO (UNIPROYECT)'
        : `BALANCES CONSOLIDADOS FINALES PARA LA OBRA: ${currentObra.name.toUpperCase()}`;
      doc.text(sumLabel, 20, nextY + 6.5);

      doc.setTextColor(209, 250, 229); // emerald-100
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('Auditoría sumaria del volumen de compras de materiales, partes de mano de obra y de la estructura corporativa general.', 20, nextY + 11.2);
      doc.text(`Grado de imputación presupuestaria general: ${currentBudgetProgress.toFixed(1)}% de ejecución realizado.`, 20, nextY + 15.2);

      const totalFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalCost);
      doc.setTextColor(16, 185, 129); // emerald green
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(totalFormatted, 190, nextY + 12, { align: 'right' });

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('COSTE TOTAL NETO IMPUTADO', 190, nextY + 16.5, { align: 'right' });

      nextY += 28;

      // 5.5 SIGNATURE STAMP BLOCK
      if (nextY + 24 > 280) {
        doc.addPage();
        nextY = 20;
      }

      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.4);

      // Representative 1 signature
      doc.line(30, nextY + 13, 85, nextY + 13);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.text('Certificación contable de consumos', 30, nextY + 17);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Dpto. Administración - Uniproyect', 30, nextY + 21);

      // Representative 2 signature
      doc.line(125, nextY + 13, 180, nextY + 13);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.text('Dirección Facultativa de Obra', 125, nextY + 17);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('UniProyect', 125, nextY + 21);

      // 6. Second pass: Draw Running Headers on page > 1, page decoration borders, and page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Draw running footer page number
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Página ${i} de ${totalPages}`, 195, 292, { align: 'right' });

        // Draw document watermark string reference with copyright of DHG
        const refStr = `ID AUDIT: UNIPROYECT-BAL-${localObraId === 'all' ? 'CONSOLIDADO' : localObraId.toUpperCase()}    |    Copyright © DHG. Todos los derechos reservados.`;
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
          doc.text('INFORME DE BALANCE DE OBRA Y CONTROL DE EJECUCIÓN', 15, 10);
          doc.text(new Date().toLocaleDateString('es-ES'), 195, 10, { align: 'right' });

          doc.setDrawColor(16, 185, 129); // emerald accent thin border
          doc.setLineWidth(0.4);
          doc.line(15, 11.5, 195, 11.5);
        }
      }

      // Save the generated vector PDF trigger download
      doc.save(filename);
      setIsExportingPDF(false);

    } catch (error) {
      console.error('[jsPDF Generation Error]:', error);
      setIsExportingPDF(false);
    }
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setLocalObraId('all');
  };

  // Custom high fidelity Excel (.xlsx) report generation utilizing ExcelJS
  const triggerExcelExportFiltered = async () => {
    try {
      const fechaGeneracion = new Date().toLocaleDateString('es-ES');
      const selectedObra = localObraId === 'all' ? 'all' : (obras.find(o => o.id === localObraId) || 'all');
      
      const fileBlob = await exportToExcel(
        selectedObra,
        obras,
        filteredDocs,
        personal,
        filteredGastosGenerales,
        startDate,
        endDate
      );

      const url = URL.createObjectURL(fileBlob);
      const link = document.createElement('a');
      
      const filePrefix = localObraId === 'all' ? 'CONSOLIDADO_FILTRADO' : `OBRA_${(obras.find(o => o.id === localObraId)?.name || 'FILTRADA').toUpperCase().replace(/\s+/g, '_')}`;
      const exportFileName = `INFORME_GASTOS_${filePrefix}_${fechaGeneracion.replace(/\//g, '-')}.xlsx`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', exportFileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Auto-save export spreadsheet copy to Google Drive if authorized
      getAccessToken().then(async (token) => {
        if (token) {
          try {
            const obraLabel = localObraId === 'all' 
              ? 'Consolidado' 
              : (obras.find(o => o.id === localObraId)?.name || 'Consolidado');
              
            const driveFolderId = await getOrCreateDriveFolderAtPath(token, [
              "UniProyect",
              obraLabel,
              "Informes Financieros y Balances"
            ]);
            await uploadBinaryToDriveFolder(token, driveFolderId, fileBlob, exportFileName);
            console.log('[Drive Backup] Financial Report XLSX synced successfully to Google Drive.');
          } catch (err) {
            console.error('[Drive Backup Error] Failed to sync financial statement:', err);
          }
        }
      });
    } catch (err) {
      console.error('Error generating Excel report:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="report-view-module">
      
      {/* 1. MASTER CONTROL PANEL FOR REAL-TIME FILTERING & MODAL TRIGGER */}
      <div className="bg-[#151515] rounded-2xl p-5 border border-white/5 shadow-sm space-y-4 no-print" id="report-filter-bar">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <span className="text-[#10B981]">📋</span> Sistema de Control e Informes de Obra
            </h3>
            <p className="text-[11px] text-white/50">Configure los filtros de obra y periodos de tiempo contables para inspeccionar o generar balances.</p>
          </div>
          <button
            onClick={() => setShowPreviewModal(true)}
            className="bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:scale-[1.01] active:scale-[0.99]"
            id="btn-trigger-main-preview"
          >
            <Eye className="w-4.5 h-4.5 text-black" strokeWidth={2.5} />
            Previsualizar Informe
          </button>
        </div>

        {/* Dynamic Inputs grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/5 pt-4">
          <div id="filter-obra-wrapper">
            <label className="block text-[10px] uppercase font-black text-[#10B981] tracking-wider mb-1.5">Obra / Proyecto Adjudicado</label>
            <select
              value={localObraId}
              onChange={(e) => setLocalObraId(e.target.value)}
              className="w-full bg-[#202022] rounded-lg border border-white/15 px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-[#10B981] cursor-pointer"
            >
              <option value="all">Todas las obras unificadas (Consolidado)</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div id="filter-start-date-wrapper">
            <label className="block text-[10px] uppercase font-black text-white/50 tracking-wider mb-1.5">Acotar Desde (Fecha de Inicio)</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#202022] rounded-lg border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#10B981] cursor-pointer"
              />
            </div>
          </div>

          <div id="filter-end-date-wrapper">
            <label className="block text-[10px] uppercase font-black text-white/50 tracking-wider mb-1.5">Acotar Hasta (Fecha de Fin)</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#202022] rounded-lg border border-white/15 px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#10B981] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Action Triggers footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
          <div className="text-[10px] text-white/40 font-mono">
            {startDate || endDate || localObraId !== 'all' ? (
              <span className="text-amber-400 font-bold">Filtros Activos</span>
            ) : (
              <span>Mostrando histórico completo</span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(startDate || endDate || localObraId !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer font-bold border border-white/5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Limpiar Filtros
              </button>
            )}

            <button
              onClick={triggerExcelExportFiltered}
              className="bg-[#202022] hover:bg-[#2e2e30] text-white font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
              id="btn-report-excel-filtered"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Descargar Informe Excel (.xlsx)
            </button>
            
            <button
              onClick={triggerPDFPrint}
              disabled={isExportingPDF}
              className="bg-gradient-to-r from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 text-red-200 hover:text-white disabled:opacity-50 font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-red-500/30"
              id="btn-report-pdf-direct"
            >
              {isExportingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 text-red-400" />
                  <span>Exportar PDF (DIN A4)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN REPORT CANVAS SHEET */}
      <div className={`bg-[#151515] print:bg-white text-white print:text-black rounded-3xl border border-white/5 print:border-slate-300 shadow-md p-8 md:p-12 print-container font-sans ${showPreviewModal ? 'no-print' : ''}`} id="printable-report-card">
        
        {/* Letterhead */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-2 border-[#10B981] print:border-black pb-6" id="report-letterhead-box">
          <div className="flex items-center gap-4" id="report-letterhead-logo">
            <div className="bg-[#10B981] print:bg-black p-2.5 rounded-xl text-black print:text-white flex items-center justify-center font-black">
              <svg className="w-10 h-8 stroke-current text-black print:text-white" viewBox="0 0 100 60" fill="none" strokeWidth="3">
                <path d="M5 45h90M10 45V30h12v15M25 45V20h14v25M42 45V35h10V25h12v20M67 45V32h8v13M78 45V37h10v8M42 25V18h14V8h8v37" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-xl tracking-wider font-extrabold text-white print:text-black uppercase leading-none">Uniproyect</div>
              <p className="text-[10px] text-[#10B981] print:text-slate-500 uppercase tracking-widest font-black mt-1">UniProyect</p>
            </div>
          </div>

          <div className="text-xs text-white/70 print:text-slate-600 space-y-1 font-mono md:text-right" id="report-letterhead-data">
            <h4 className="font-extrabold text-[#10B981] print:text-[#111] leading-none">UNIPROYECT</h4>
            <p>NIF: B-56755085</p>
            <p>C/ Amapola 8, 11.630, Arcos de la Frontera</p>
            <p>Telf: [TELÉFONO EMPRESA] | Correo: empresa@ejemplo.invalid</p>
          </div>
        </div>

        {/* Audit Meta Context */}
        <div className="my-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs bg-white/5 print:bg-slate-50 rounded-2xl p-5 border border-white/5 print:border-slate-100" id="report-audit-meta">
          <div>
            <span className="text-[10px] uppercase font-bold text-white/40 print:text-slate-400 block tracking-wider font-sans">OBRA AUDITADA Y CONTROL</span>
            <span className="font-extrabold text-white print:text-black text-sm mt-1 block">
              {currentObra === 'all' ? 'CONSOLIDADO GENERAL DE OBRAS' : currentObra.name.toUpperCase()}
            </span>
            {currentObra !== 'all' && (
              <span className="text-white/60 print:text-slate-500 block font-sans mt-1">Ubicación: {currentObra.location}</span>
            )}
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-white/40 print:text-slate-400 block tracking-wider font-sans">PERIODO TEMPORAL</span>
            <span className="font-semibold text-white print:text-slate-800 text-sm mt-1 block font-mono">
              {startDate || 'Ilimitado'} ➔ {endDate || 'Ilimitado'}
            </span>
            <span className="text-white/60 print:text-slate-500 block font-sans mt-0.5 font-sans">Filtro contable de cuentas</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-white/40 print:text-slate-400 block tracking-wider font-sans">ESTADO GENERAL</span>
            <span className={`font-extrabold text-xs uppercase px-2.5 py-1 rounded-md inline-block mt-1 ${isProfit ? 'bg-emerald-500/10 print:bg-emerald-50 text-emerald-400 print:text-emerald-700 font-sans' : 'bg-red-500/10 print:bg-red-50 text-red-400 print:text-red-700 font-sans'}`}>
              {isProfit ? '✓ Presupuesto Óptimo' : '⚠️ Desviación Negativa'}
            </span>
          </div>
        </div>

        {/* Consolidated summary panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" id="report-metrics-grid">
          <div className="border border-white/5 print:border-slate-200 rounded-xl p-4 text-center">
            <span className="text-[10px] uppercase font-bold text-white/40 print:text-slate-400 block tracking-wider font-sans">Presupuesto Inicial Adjudicado</span>
            <span className="text-xl font-black text-[#10B981] print:text-black block font-mono mt-1">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalBudget)}</span>
          </div>
          <div className="border border-white/5 print:border-slate-200 rounded-xl p-4 text-center">
            <span className="text-[10px] uppercase font-bold text-white/40 print:text-slate-400 block tracking-wider font-sans">Gastos Totales de Ejecución</span>
            <span className="text-xl font-black text-[#10B981] print:text-black block font-mono mt-1">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalCost)}</span>
            <span className="text-[10px] text-white/50 print:text-slate-500 mt-1 block font-sans">Rendimiento: {currentBudgetProgress.toFixed(1)}% consumido</span>
          </div>
          <div className={`border rounded-xl p-4 text-center ${isProfit ? 'bg-emerald-500/5 border-emerald-500/15 print:bg-emerald-50/20 print:border-emerald-100' : 'bg-red-500/5 border-red-500/15 print:bg-red-50/20 print:border-red-100'}`}>
            <span className="text-[10px] uppercase font-bold text-white/40 print:text-slate-400 block tracking-wider font-sans">Margen de Utilidad Estimado</span>
            <span className={`text-xl font-black block font-mono mt-1 ${isProfit ? 'text-emerald-400 print:text-emerald-700' : 'text-red-400 print:text-red-600'}`}>
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grossProfitMargin)}
            </span>
            <span className="text-[10px] text-white/50 print:text-slate-500 mt-1 block font-sans">Rendimiento Bruto: {totalBudget > 0 ? (grossProfitMargin / totalBudget * 100).toFixed(1) : 0}%</span>
          </div>
        </div>

        {/* Trend chart panel */}
        <div className="border border-white/5 print:border-slate-200 rounded-2xl p-6 bg-white/[0.02] mb-8 no-print" id="report-trend-chart-card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
            <div>
              <h4 className="font-extrabold text-sm text-[#10B981] flex items-center gap-2 font-sans uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-[#10B981]" />
                Tendencia de Gastos Mensuales y Balance Acumulado
              </h4>
              <p className="text-[10px] text-white/50 mt-0.5">
                Representación de los costes mensuales desglosados (eje izquierdo) y el progreso total acumulado frente al presupuesto adjudicado (eje derecho).
              </p>
            </div>
            {chartData.length > 0 && (
              <div className="text-[11px] font-mono text-white/40 bg-white/5 px-2.5 py-1 rounded-lg">
                Puntos de análisis: <strong className="text-white font-bold">{chartData.length} meses</strong>
              </div>
            )}
          </div>

          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-black/20 rounded-2xl border border-white/5">
              <Calendar className="w-8 h-8 text-white/20 mb-2 animate-pulse" />
              <p className="text-xs text-white/60 font-bold">Sin datos históricos suficientes</p>
              <p className="text-[10px] text-white/40 mt-1">No hay partidas de materiales o partes de cooperarios registrados en las fechas seleccionadas.</p>
            </div>
          ) : (
            <div className="w-full h-[340px] pr-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="label" 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="font-mono"
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#38BDF8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v).toLocaleString('es-ES')} €`}
                    className="font-mono"
                    label={{ value: 'Gasto Mensual', angle: -90, position: 'insideLeft', fill: '#38BDF8', fontSize: 10, style: { textAnchor: 'middle' }, offset: 5 }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#10B981"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v).toLocaleString('es-ES')} €`}
                    className="font-mono"
                    label={{ value: 'Acumulado / Presupuesto', angle: 90, position: 'insideRight', fill: '#10B981', fontSize: 10, style: { textAnchor: 'middle' }, offset: 5 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={40} 
                    content={({ payload }) => (
                      <div className="flex flex-wrap justify-center gap-4 text-[10px] font-sans font-bold text-white/70 mb-4 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                          <span>Materiales (Eje Izq.)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-sky-500 inline-block" />
                          <span>Personal (Eje Izq.)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-violet-500 inline-block" />
                          <span>G. Indirectos (Eje Izq.)</span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                          <span className="w-3.5 h-0.5 rounded bg-emerald-400 inline-block" />
                          <span className="text-emerald-400">Gasto Acumulado (Eje Der.)</span>
                        </div>
                        {totalBudget > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-red-500 inline-block" />
                            <span className="text-red-400">Presupuesto (Eje Der.)</span>
                          </div>
                        )}
                      </div>
                    )}
                  />
                  <Bar yAxisId="left" dataKey="Materiales" stackId="costs" fill="#F59E0B" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="left" dataKey="Personal" stackId="costs" fill="#0EA5E9" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                  <Bar yAxisId="left" dataKey="Indirectos" stackId="costs" fill="#8B5CF6" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="Gasto Acumulado" 
                    stroke="#10B981" 
                    strokeWidth={3} 
                    dot={{ r: 4, strokeWidth: 1, fill: '#151515' }}
                    activeDot={{ r: 6 }} 
                  />
                  {totalBudget > 0 && (
                    <ReferenceLine 
                      yAxisId="right"
                      y={totalBudget} 
                      stroke="#EF4444" 
                      strokeDasharray="4 4" 
                      strokeWidth={2}
                      label={{ 
                        value: `Límite Licitación: ${totalBudget.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`, 
                        fill: '#EF4444', 
                        position: 'top', 
                        fontSize: 9,
                        fontWeight: 'black',
                        className: 'font-mono tracking-wider'
                      }} 
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Section division details */}
        <div className="space-y-8" id="report-section-details">
          
          {/* Materials supply table */}
          <div id="section-materials">
            <h4 className="font-extrabold text-xs text-[#10B981] print:text-black uppercase tracking-widest border-b border-white/10 print:border-slate-300 pb-2 mb-3 font-sans">
              1. Proveedores, Suministro de Materiales y Subcontratas (Lotes e IA)
            </h4>
            <table className="w-full text-left text-xs" id="table-report-materials">
              <thead>
                <tr className="text-white/40 print:text-slate-400 font-bold border-b border-white/5 print:border-slate-200 uppercase text-[9px] tracking-wider">
                  <th className="py-2">Nº DoC</th>
                  <th className="py-2">Proveedor / Emisor</th>
                  <th className="py-2">Fecha</th>
                  <th className="py-2 text-right">Base Imp. (€)</th>
                  <th className="py-2 text-right">IVA (€)</th>
                  <th className="py-2 text-right">Retención (€)</th>
                  <th className="py-2 text-right">Total Neto Documento (€)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-slate-100 text-white/80 print:text-slate-700 font-mono">
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-white/40 print:text-slate-400 font-sans">No se encontraron facturas o albaranes dentro de los parámetros estipulados.</td>
                  </tr>
                ) : (
                  filteredDocs.map(doc => (
                    <tr key={doc.id}>
                      <td className="py-2.5 font-bold text-white print:text-slate-900">{doc.docNumber}</td>
                      <td className="py-2.5 font-sans font-medium text-white/90 print:text-slate-800">{doc.supplier}</td>
                      <td className="py-2.5 text-white/50 print:text-slate-500">{doc.date}</td>
                      <td className="py-2.5 text-right">{doc.baseAmount.toFixed(2)}</td>
                      <td className="py-2.5 text-right text-white/50 print:text-slate-500">{doc.ivaAmount.toFixed(2)} ({doc.ivaRate}%)</td>
                      <td className="py-2.5 text-right text-white/50 print:text-slate-500">{doc.retentionAmount.toFixed(2)} ({doc.retentionRate}%)</td>
                      <td className="py-2.5 text-right text-white print:text-slate-950 font-bold">{doc.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
                <tr className="font-bold bg-white/5 print:bg-slate-50 text-white print:text-slate-950 border-t-2 border-white/10 print:border-slate-200">
                  <td colSpan={3} className="py-3 px-2 font-sans text-right">TOTAL MATERIALES:</td>
                  <td className="py-3 text-right">{totalBase.toFixed(2)} €</td>
                  <td className="py-3 text-right">{totalIva.toFixed(2)} €</td>
                  <td className="py-3 text-right">{totalRetention.toFixed(2)} €</td>
                  <td className="py-3 text-right text-[#10B981] print:text-black">{totalMaterials.toFixed(2)} €</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Personal cost items table */}
          <div className="page-break animate-fadeIn" id="section-labor">
            <h4 className="font-extrabold text-xs text-[#10B981] print:text-black uppercase tracking-widest border-b border-white/10 print:border-slate-300 pb-2 mb-3 font-sans">
              2. Costes de Mano de Obra (Operarios y Partes de Trabajo en Obra)
            </h4>
            <table className="w-full text-left text-xs" id="table-report-labor">
              <thead>
                <tr className="text-white/40 print:text-slate-400 font-bold border-b border-white/5 print:border-slate-200 uppercase text-[9px] tracking-wider">
                  <th className="py-2">Operario</th>
                  <th className="py-2">Especialidad / Cargo</th>
                  <th className="py-2">Fecha Log</th>
                  <th className="py-2 text-right">Horas de trabajo</th>
                  <th className="py-2 text-right">Tarifa Estipulada (€)</th>
                  <th className="py-2 text-right">Coste Sometido (€)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-slate-100 text-white/80 print:text-slate-700 font-mono">
                {filteredPersonal.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-white/40 print:text-slate-400 font-sans">Sin partes de mano de obra registrados en esta selección hídrica de fechas.</td>
                  </tr>
                ) : (
                  filteredPersonal.map(p => (
                    <tr key={p.id}>
                      <td className="py-2.5 font-sans font-bold text-white/90 print:text-slate-800">
                        <div>{p.workerName}</div>
                        {(p as any).hasProration && (
                          <div className="text-[10px] text-emerald-400 font-sans font-normal leading-normal">
                            Periodo: {(p as any).costStartStr} a {(p as any).costEndStr}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 font-sans text-white/60 print:text-slate-600">{p.role}</td>
                      <td className="py-2.5 text-white/50 print:text-slate-500">{p.date}</td>
                      <td className="py-2.5 text-right">
                        <div>{p.hours.toFixed(1)} h</div>
                        {(p as any).hasProration && (
                          <div className="text-[10px] text-emerald-400/80 font-sans font-normal">
                            Prorrata: {((p as any).prorationFactor * 100).toFixed(1)}% ({(p as any).overlapDays}/{(p as any).totalDays} d)
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <div>{p.hourlyRate.toFixed(2)} /h</div>
                        {p.costType === 'mensual' && (
                          <div className="text-[9px] text-white/40 print:text-slate-400 font-sans font-normal">
                            Sueldo: {(p as any).originalTotalCost.toFixed(2)} €/m
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-white print:text-slate-950 font-bold">
                        <div>{p.totalCost.toFixed(2)} €</div>
                        {(p as any).hasProration && (
                          <div className="text-[10px] line-through text-white/30 print:text-slate-400 font-normal">
                            {(p as any).originalTotalCost.toFixed(2)} €
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="font-bold bg-white/5 print:bg-slate-50 text-white print:text-slate-950 border-t-2 border-white/10 print:border-slate-200">
                  <td colSpan={3} className="py-3 px-2 font-sans text-right">TOTAL MANO DE OBRA:</td>
                  <td className="py-3 text-right">{totalLaborHours} h</td>
                  <td></td>
                  <td className="py-3 text-right text-[#10B981] print:text-black">{totalLabor.toFixed(2)} €</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Generalized corporate structures - show detailed table with proportional allocation / repercussion */}
          <div id="section-overhead" className="animate-fadeIn">
            <h4 className="font-extrabold text-xs text-[#10B981] print:text-black uppercase tracking-widest border-b border-white/10 print:border-slate-300 pb-2 mb-3 font-sans">
              3. Gastos Indirectos y Costes Estructurales Repercutidos
            </h4>

            {localObraId !== 'all' && (
              <div className="bg-white/5 print:bg-slate-50 rounded-xl p-5 border border-white/5 print:border-slate-200 mb-6 space-y-3">
                <p className="text-xs text-white/70 print:text-slate-600 font-sans">
                  Los gastos indirectos y de estructura general de la empresa se repercuten sobre cada obra de forma proporcional según su volumen económico en concordancia con el presupuesto licitado/contraído.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="bg-[#1A1A1A] print:bg-white p-3 rounded-lg border border-white/5 print:border-slate-150">
                    <span className="text-[10px] text-white/40 print:text-slate-400 block tracking-wide uppercase font-sans">Gastos Estructurales Totales</span>
                    <span className="font-bold text-white print:text-black text-sm mt-1 block">{totalFilteredOverhead.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="bg-[#1A1A1A] print:bg-white p-3 rounded-lg border border-white/5 print:border-slate-150">
                    <span className="text-[10px] text-white/40 print:text-slate-400 block tracking-wide uppercase font-sans">Presupuesto Esta Obra</span>
                    <span className="font-bold text-white print:text-black text-sm mt-1 block">{totalBudget.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="bg-[#1A1A1A] print:bg-white p-3 rounded-lg border border-white/5 print:border-slate-150">
                    <span className="text-[10px] text-white/40 print:text-slate-400 block tracking-wide uppercase font-sans">Volumen Cartera Total</span>
                    <span className="font-bold text-white print:text-black text-sm mt-1 block">{totalBudgetOfAllObras.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="bg-[#10B981]/10 border border-[#10B981]/20 print:bg-slate-100 p-3 rounded-lg">
                    <span className="text-[10px] text-[#10B981] print:text-slate-705 block tracking-wide uppercase font-sans font-bold">Cuota Repercutida ({(localObraId !== 'all' ? (overheadAllocationMap[localObraId]?.percent || 0) * 100 : 100).toFixed(2)}%)</span>
                    <span className="font-black text-[#10B981] print:text-black text-sm mt-1 block">{companyOverhead.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80 print:text-slate-705" id="table-report-overhead">
                <thead>
                  <tr className="text-white/40 print:text-slate-400 font-bold border-b border-white/5 print:border-slate-200 uppercase text-[9px] tracking-wider">
                    <th className="py-2">Categoría</th>
                    <th className="py-2">Concepto de Gasto</th>
                    <th className="py-2">Fecha Devengo</th>
                    <th className="py-2 text-right">Importe Total Empresa (€)</th>
                    <th className="py-2 text-right">Repercusión (%)</th>
                    <th className="py-2 text-right">Sometido a Obra (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 print:divide-slate-100 font-mono text-white/85">
                  {combinedStructuralExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-white/40 print:text-slate-400 font-sans">No hay gastos estructurales registrados.</td>
                    </tr>
                  ) : (
                    combinedStructuralExpenses.map(g => {
                      const itemRatio = localObraId === 'all' ? 1.0 : (overheadAllocationMap[localObraId]?.percent || 0);
                      const proratedAmount = g.amount * itemRatio;
                      return (
                        <tr key={g.id}>
                          <td className="py-2.5 font-sans font-bold text-white print:text-slate-900">{g.category}</td>
                          <td className="py-2.5 font-sans text-white/60 print:text-slate-600">{g.description}</td>
                          <td className="py-2.5 text-white/50 print:text-slate-500">{g.date}</td>
                          <td className="py-2.5 text-right text-white/40 print:text-slate-400">{g.amount.toFixed(2)} €</td>
                          <td className="py-2.5 text-right text-white/60 print:text-slate-500">{(itemRatio * 105).toFixed(2).replace('105', '100') /* safeguard % structure */} {(itemRatio * 100).toFixed(2)} %</td>
                          <td className="py-2.5 text-right text-white print:text-slate-950 font-bold">{proratedAmount.toFixed(2)} €</td>
                        </tr>
                      );
                    })
                  )}
                  <tr className="font-bold bg-white/5 print:bg-slate-50 text-white print:text-slate-950 border-t-2 border-white/10 print:border-slate-200">
                    <td colSpan={3} className="py-3 px-2 font-sans text-right">TOTAL GASTOS GENERALES REPERCUTIDOS:</td>
                    <td className="py-3 text-right font-mono text-white/40 print:text-slate-400">{totalFilteredOverhead.toFixed(2)} €</td>
                    <td className="py-3 text-right font-mono text-white/60 print:text-slate-500">{(localObraId !== 'all' ? (overheadAllocationMap[localObraId]?.percent || 0) * 100 : 100).toFixed(2)} %</td>
                    <td className="py-3 text-right font-mono text-[#10B981] print:text-black">{companyOverhead.toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Grand Balance total panel */}
          <div className="bg-[#10B981] print:bg-slate-900 text-black print:text-white rounded-xl p-6 font-sans text-xs flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 animate-fadeIn" id="report-final-consolidated">
            <div className="space-y-1">
              <h5 className="font-black text-sm uppercase tracking-wider font-sans">Gran Total de Gastos Controlados</h5>
              <p className="text-black/60 print:text-slate-400 font-sans">Cómputo consolidado de compras de materiales, partes de mano de obra y estructura empresarial.</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono tracking-tight block">
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalCost)}
              </span>
            </div>
          </div>
        </div>

        {/* Legal Signatures block */}
        <div className="mt-16 grid grid-cols-2 gap-12 text-center text-[10px] text-white/40 print:text-slate-500 border-t border-white/10 print:border-slate-200 pt-10 page-break-inside-avoid animate-fadeIn" id="report-signatures-panel">
          <div>
            <div className="h-16 flex items-end justify-center pb-2 underline font-sans italic text-white/30 print:text-slate-300">Firma Manual / Sello Administrativo</div>
            <div className="font-extrabold text-white print:text-slate-800 uppercase tracking-widest font-sans" id="firm-gerente-sign">Fdo. D. Responsable de empresa</div>
            <div className="text-white/40 print:text-slate-400 font-sans">Gerente General - UniProyect</div>
          </div>
          <div>
            <div className="h-16 flex items-end justify-center pb-2 underline font-sans italic text-white/30 print:text-slate-300">Firma Manual / Certificación Técnica</div>
            <div className="font-extrabold text-white print:text-slate-800 uppercase tracking-widest font-sans" id="firm-direccion-sign">Fdo. Dirección Facultativa</div>
            <div className="text-white/40 print:text-slate-400 font-sans">Aprobación Justificación de Costes de Obra</div>
          </div>
        </div>
      </div>

      {/* 3. STUNNING MODIFIED FLOATING FULL SCREEN REPORT PREVIEW DIALOG MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fadeIn" id="preview-report-modal">
          <div className="bg-[#1C1C1E] rounded-3xl border border-white/10 shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto flex flex-col" id="preview-report-modal-body">
            
            {/* Modal header */}
            <div className="border-b border-white/5 px-6 py-4 flex justify-between items-center bg-[#252528] rounded-t-3xl no-print" id="preview-report-header">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2 font-sans">
                  <span className="text-[#10B981]">👁️</span> Previsualización del Informe Balance
                </h3>
                <p className="text-[10px] text-white/50 leading-normal font-sans">Inspeccione la hoja de cuenta contable certificada y desgloses resultantes antes de imprimir.</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-white/40 hover:text-white text-base font-bold p-1 cursor-pointer transition-colors"
                id="btn-close-preview-modal"
              >
                ✕
              </button>
            </div>

            {/* Quick adjustable filters bar inside modal */}
            <div className="bg-[#151515] border-b border-white/5 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs no-print" id="preview-quick-filters">
              <div>
                <span className="block text-[9px] uppercase font-bold text-[#10B981] mb-1 font-sans">Filtro Proyecto</span>
                <select
                  value={localObraId}
                  onChange={(e) => setLocalObraId(e.target.value)}
                  className="w-full bg-[#202022] rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-[#10B981]"
                >
                  <option value="all">Ver todas las obras unificadas</option>
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-white/40 mb-1 font-sans">Filtrar Desde (Inicio)</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#202022] rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#10B981]"
                />
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-white/40 mb-1 font-sans">Filtrar Hasta (Fin)</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#202022] rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>

            {/* Scrollable sheet content */}
            <div className="p-6 md:p-8 flex-1 bg-[#121214] overflow-y-auto" id="preview-report-scrollable">
              <div className="bg-white text-black p-8 md:p-12 rounded-2xl shadow-xl max-w-4xl mx-auto border border-slate-200 print-container" id="preview-sheet-paper">
                
                {/* Paper header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b-2 border-black pb-5">
                  <div className="flex items-center gap-3">
                    <div className="bg-black p-2 rounded-xl text-white flex items-center justify-center font-black">
                      <svg className="w-8 h-6 stroke-current text-white" viewBox="0 0 100 60" fill="none" strokeWidth="4">
                        <path d="M5 45h90M10 45V30h12v15M25 45V20h14v25M42 45V35h10V25h12v20M67 45V32h8v13M78 45V37h10v8M42 25V18h14V8h8v37" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-lg tracking-wider font-extrabold text-black uppercase leading-none font-sans">Uniproyect</div>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold font-sans mt-0.5">UniProyect</p>
                    </div>
                  </div>

                  <div className="text-[9px] text-slate-600 space-y-0.5 font-mono md:text-right">
                    <h4 className="font-extrabold text-black leading-none font-sans">UNIPROYECT</h4>
                    <p>NIF: B-56755085</p>
                    <p>C/ Amapola 8, Arcos de la Frontera</p>
                    <p>Telf: [TELÉFONO EMPRESA] | empresa@ejemplo.invalid</p>
                  </div>
                </div>

                {/* Audit Context */}
                <div className="my-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-sans">OBRA AUDITADA</span>
                    <span className="font-extrabold text-black text-xs block font-sans">
                      {currentObra === 'all' ? 'CONSOLIDADO UNIFICADO GENERAL' : currentObra.name.toUpperCase()}
                    </span>
                    {currentObra !== 'all' && (
                      <span className="text-slate-500 block text-[9px] mt-0.5 font-sans">Ubicación: {currentObra.location}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-sans">RANGO FILTRADO</span>
                    <span className="font-semibold text-[#111] text-xs block font-mono">
                      {startDate || 'Cualquiera'} ➔ {endDate || 'Cualquiera'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-sans">SALDO FINANCIERO</span>
                    <span className={`font-extrabold text-[9px] uppercase px-2 py-0.5 rounded inline-block font-sans ${isProfit ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                      {isProfit ? '✓ Presupuesto Óptimo' : '⚠️ Desviación Negativa'}
                    </span>
                  </div>
                </div>

                {/* KPI block inside PDF */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="border border-slate-200 rounded-lg p-3 text-center bg-slate-50/50">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Presupuesto Inicial Adjudicado</span>
                    <span className="text-sm font-black text-black block font-mono mt-0.5">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalBudget)}</span>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3 text-center bg-slate-100/50">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Gastos Totales de Ejecución</span>
                    <span className="text-sm font-black text-black block font-mono mt-0.5">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalCost)}</span>
                  </div>
                  <div className={`border rounded-lg p-3 text-center ${isProfit ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Margen Estimado de Utilidad</span>
                    <span className={`text-sm font-black block font-mono mt-0.5 ${isProfit ? 'text-emerald-800' : 'text-red-700'}`}>
                      {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grossProfitMargin)}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Part 1: Materials */}
                  <div>
                    <h5 className="font-extrabold text-[10px] text-black uppercase tracking-wider border-b border-slate-200 pb-1 mb-2 font-sans">1. Materiales de Obra y Suministros Homologados</h5>
                    <table className="w-full text-left text-[9px]">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-200 uppercase text-[8px] tracking-wider">
                          <th className="py-1">Doc Nº</th>
                          <th className="py-1">Proveedor</th>
                          <th className="py-1">Fecha</th>
                          <th className="py-1 text-right">Base (€)</th>
                          <th className="py-1 text-right font-sans">IVA (€)</th>
                          <th className="py-1 text-right font-bold text-black font-sans">Total Neto (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                        {filteredDocs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-2 text-center text-slate-400 font-sans">Sin registros de facturas o albaranes dentro de la selección.</td>
                          </tr>
                        ) : (
                          filteredDocs.map(doc => (
                            <tr key={doc.id}>
                              <td className="py-1.5 font-bold text-slate-900">{doc.docNumber}</td>
                              <td className="py-1.5 font-sans font-medium text-slate-800">{doc.supplier}</td>
                              <td className="py-1.5 text-slate-500">{doc.date}</td>
                              <td className="py-1.5 text-right">{doc.baseAmount.toFixed(2)}</td>
                              <td className="py-1.5 text-right text-slate-500">{doc.ivaAmount.toFixed(2)} ({doc.ivaRate}%)</td>
                              <td className="py-1.5 text-right text-slate-900 font-bold">{doc.totalAmount.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                        {filteredDocs.length > 0 && (
                          <tr className="font-bold bg-slate-50 text-slate-900 border-t border-slate-200">
                            <td colSpan={3} className="py-2 px-1 font-sans text-right">Total Materiales:</td>
                            <td className="py-2 text-right">{totalBase.toFixed(2)} €</td>
                            <td className="py-2 text-right">{totalIva.toFixed(2)} €</td>
                            <td className="py-2 text-right text-black">{totalMaterials.toFixed(2)} €</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Part 2: Labor */}
                  <div>
                    <h5 className="font-extrabold text-[10px] text-black uppercase tracking-wider border-b border-slate-200 pb-1 mb-2 font-sans">2. Imputaciones de Mano de Obra y Personal</h5>
                    <table className="w-full text-left text-[9px]">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-200 uppercase text-[8px] tracking-wider">
                          <th className="py-1">Operario</th>
                          <th className="py-1">Cargo</th>
                          <th className="py-1">Fecha</th>
                          <th className="py-1 text-right">Horas</th>
                          <th className="py-1 text-right">Tarifa (€)</th>
                          <th className="py-1 text-right font-bold text-black font-sans">Total Coste (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                        {filteredPersonal.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-2 text-center text-slate-400 font-sans">Sin logs de personal dentro del periodo.</td>
                          </tr>
                        ) : (
                          filteredPersonal.map(p => (
                            <tr key={p.id}>
                              <td className="py-1.5 font-sans font-bold text-slate-800">
                                <div>{p.workerName}</div>
                                {(p as any).hasProration && (
                                  <div className="text-[7.5px] text-emerald-600 font-sans font-normal leading-normal">
                                    Prorrata Periodo ({(p as any).costStartStr} - {(p as any).costEndStr})
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 font-sans text-slate-500">{p.role}</td>
                              <td className="py-1.5 text-slate-500">{p.date}</td>
                              <td className="py-1.5 text-right">
                                <div>{p.hours.toFixed(1)} h</div>
                                {(p as any).hasProration && (
                                  <div className="text-[7.5px] text-emerald-600 font-sans font-normal leading-normal">
                                    {((p as any).prorationFactor * 100).toFixed(1)}% ({(p as any).overlapDays}/{(p as any).totalDays} d)
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 text-right">
                                <div>{p.hourlyRate.toFixed(2)} /h</div>
                                {p.costType === 'mensual' && (
                                  <div className="text-[7px] text-slate-400 font-sans font-normal">
                                    Base: {(p as any).originalTotalCost.toFixed(2)} €
                                  </div>
                                )}
                              </td>
                              <td className="py-1.5 text-right text-slate-900 font-bold">
                                <div>{p.totalCost.toFixed(2)} €</div>
                                {(p as any).hasProration && (
                                  <div className="text-[7.5px] line-through text-slate-400 font-sans font-normal">
                                    {(p as any).originalTotalCost.toFixed(2)} €
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                        {filteredPersonal.length > 0 && (
                          <tr className="font-bold bg-slate-50 text-slate-900 border-t border-slate-200">
                            <td colSpan={3} className="py-2 px-1 font-sans text-right">Total Mano de Obra:</td>
                            <td className="py-2 text-right">{totalLaborHours} h</td>
                            <td></td>
                            <td className="py-2 text-right text-black">{totalLabor.toFixed(2)} €</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Part 3: General if Consolidated or Proportional with Formulas */}
                  <div>
                    <h5 className="font-extrabold text-[10px] text-black uppercase tracking-wider border-b border-slate-200 pb-1 mb-2 font-sans text-left">
                      3. Gastos Indirectos e Imputaciones de Costes de Estructura de Empresa
                    </h5>

                    {localObraId !== 'all' && (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-[10.5px] text-slate-700 mb-3 space-y-2">
                        <p className="font-sans text-left text-[9px] leading-relaxed">
                          Sometido el reparto analítico de costes de estructura corporativa proporcionalmente según el volumen económico del presupuesto de la obra sobre el total de obras vivas.
                        </p>
                        <div className="grid grid-cols-4 gap-2 font-mono text-center">
                          <div className="bg-white p-1 rounded border border-slate-150">
                            <span className="text-[7px] text-slate-450 block uppercase font-sans">Gastos Estructura</span>
                            <span className="font-bold text-slate-900 block mt-0.5 text-[10px]">{totalFilteredOverhead.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-150">
                            <span className="text-[7px] text-slate-455 block uppercase font-sans">Presupuesto Obra</span>
                            <span className="font-bold text-slate-900 block mt-0.5 text-[10px]">{totalBudget.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          </div>
                          <div className="bg-white p-1 rounded border border-slate-150">
                            <span className="text-[7px] text-slate-455 block uppercase font-sans">Presupuesto Total</span>
                            <span className="font-bold text-slate-900 block mt-0.5 text-[10px]">{totalBudgetOfAllObras.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          </div>
                          <div className="bg-slate-900 text-white p-1 rounded">
                            <span className="text-[7px] text-slate-300 block uppercase font-sans">Repercutido ({(localObraId !== 'all' ? (overheadAllocationMap[localObraId]?.percent || 0) * 100 : 100).toFixed(2)}%)</span>
                            <span className="font-bold block mt-0.5 text-[10px]">{companyOverhead.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <table className="w-full text-left text-[9px] mb-4">
                      <thead>
                        <tr className="text-slate-400 font-bold border-b border-slate-200 uppercase text-[8px] tracking-wider">
                          <th className="py-1">Categoría</th>
                          <th className="py-1">Descripción Concepto</th>
                          <th className="py-1">Fecha Devengo</th>
                          <th className="py-1 text-right font-bold text-black font-sans">Total Empresa (€)</th>
                          <th className="py-1 text-right font-bold text-black font-sans">Coef. (%)</th>
                          <th className="py-1 text-right font-bold text-black font-sans">Imputado Obra (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-slate-705">
                        {combinedStructuralExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-2 text-center text-slate-400 font-sans">Sin gastos de empresa generales en este periodo.</td>
                          </tr>
                        ) : (
                          combinedStructuralExpenses.map(g => {
                            const itemRatio = localObraId === 'all' ? 1.0 : (overheadAllocationMap[localObraId]?.percent || 0);
                            const proratedAmount = g.amount * itemRatio;
                            return (
                              <tr key={g.id}>
                                <td className="py-1.5 font-sans font-bold text-slate-900 text-left">{g.category}</td>
                                <td className="py-1.5 font-sans text-slate-600 text-left">{g.description}</td>
                                <td className="py-1.5 text-slate-500 text-left">{g.date}</td>
                                <td className="py-1.5 text-right text-slate-500">{g.amount.toFixed(2)}</td>
                                <td className="py-1.5 text-right text-slate-500">{(itemRatio * 100).toFixed(2)} %</td>
                                <td className="py-1.5 text-right text-slate-950 font-bold">{proratedAmount.toFixed(2)}</td>
                              </tr>
                            );
                          })
                        )}
                        {combinedStructuralExpenses.length > 0 && (
                          <tr className="font-bold bg-slate-50 text-slate-900 border-t border-slate-200">
                            <td colSpan={3} className="py-2 px-1 font-sans text-right">Sumatoria Gastos Estructurales:</td>
                            <td className="py-2 text-right text-slate-500">{totalFilteredOverhead.toFixed(2)} €</td>
                            <td className="py-2 text-right text-slate-500">{(localObraId !== 'all' ? (overheadAllocationMap[localObraId]?.percent || 0) * 100 : 100).toFixed(2)} %</td>
                            <td className="py-2 text-right text-black">{companyOverhead.toFixed(2)} €</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary balance row in PDF paper inside modal */}
                  <div className="bg-slate-900 text-white rounded-xl p-4 mt-5 flex justify-between items-center text-xs">
                    <div>
                      <h6 className="font-bold uppercase tracking-wider text-[10px] font-sans">Gran Total Consolidado de Gastos de Ejecución</h6>
                      <p className="text-slate-400 text-[8px] font-sans">Cómputo certificado resultante del intervalo de balance seleccionado.</p>
                    </div>
                    <div>
                      <span className="text-base font-black font-mono">
                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalCost)}
                      </span>
                    </div>
                  </div>

                  {/* Signatures inside PDF */}
                  <div className="mt-12 grid grid-cols-2 gap-8 text-center text-[8px] text-slate-500 border-t border-slate-150 pt-6">
                    <div>
                      <div className="h-10 flex items-end justify-center pb-1 underline font-sans italic text-slate-350">Firma Autorizada</div>
                      <div className="font-extrabold text-slate-800 uppercase tracking-wider font-sans">Responsable de empresa - Gerente</div>
                    </div>
                    <div>
                      <div className="h-10 flex items-end justify-center pb-1 underline font-sans italic text-slate-350">Certificación de Obra</div>
                      <div className="font-extrabold text-slate-800 uppercase tracking-wider font-sans">Dirección Facultativa</div>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* Modal actions footer */}
            <div className="border-t border-white/5 p-4 flex flex-col gap-3 bg-[#1C1C1E] rounded-b-3xl no-print" id="preview-report-footer">
              
              {/* Dynamic feedback messages */}
              {driveExportError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 flex items-center gap-1.5 font-sans">
                  <span>⚠️ {driveExportError}</span>
                </div>
              )}

              {driveExportLink && (
                <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between gap-1.5 font-sans animate-fadeIn">
                  <span className="font-semibold">✔️ ¡Fichero respaldado en la carpeta principal "Uniproyect"!</span>
                  <a 
                    href={driveExportLink} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="underline text-emerald-300 hover:text-emerald-200 font-extrabold flex items-center gap-1"
                  >
                    Ver archivo en Google Drive →
                  </a>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setDriveExportLink(null);
                    setDriveExportError(null);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer font-sans"
                >
                  Cerrar vista previa
                </button>
                
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  {/* Google Drive Export Button */}
                  <button
                    onClick={handleExportToGoogleDrive}
                    disabled={isExportingToDrive}
                    className="bg-slate-800 hover:bg-slate-750 disabled:bg-slate-800/40 border border-white/15 hover:border-white/20 text-white font-extrabold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed font-sans shadow"
                  >
                    {isExportingToDrive ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                        <span>Exportando...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4 text-emerald-400" />
                        <span>Respaldar en Google Drive</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={triggerExcelExportFiltered}
                    className="bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10 font-sans"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Descargar Informe Excel (.xlsx)
                  </button>
                  <button
                    onClick={triggerPDFPrint}
                    disabled={isExportingPDF}
                    className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 font-extrabold py-2 px-5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg font-sans"
                  >
                    {isExportingPDF ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Generando PDF...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4 text-white" />
                        <span>Exportar PDF (DIN A4)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. REVOLUTIONARY DEDICATED OFF-SCREEN DIN A4 HIGH RATIO PRINT ENGINE CANVAS */}
      <div 
        id="preview-sheet-paper-pdf-export" 
        className="font-sans p-10 select-none pointer-events-none"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '0px',
          width: '794px', // Standard pixels for A4 width at 96 dpi (793.7px)
          backgroundColor: '#ffffff',
          color: '#000000',
          boxSizing: 'border-box'
        }}
      >
        {/* Paper header */}
        <div className="flex justify-between items-center pb-5" style={{ borderBottom: '2px solid #000000' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl flex items-center justify-center font-black" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
              <svg className="w-8 h-6 stroke-current" style={{ stroke: '#ffffff' }} viewBox="0 0 100 60" fill="none" strokeWidth="4">
                <path d="M5 45h90M10 45V30h12v15M25 45V20h14v25M42 45V35h10V25h12v20M67 45V32h8v13M78 45V37h10v8M42 25V18h14V8h8v37" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-lg tracking-wider font-extrabold uppercase leading-none" style={{ color: '#000000' }}>Uniproyect</div>
              <p className="text-[9px] uppercase tracking-widest font-bold mt-0.5" style={{ color: '#64748b' }}>UniProyect</p>
            </div>
          </div>

          <div className="text-[9px] font-mono text-right leading-relaxed" style={{ color: '#475569' }}>
            <h4 className="font-extrabold leading-none font-sans" style={{ color: '#000000' }}>UNIPROYECT</h4>
            <p className="mt-0.5">NIF: B-56755085</p>
            <p>C/ Amapola 8, Arcos de la Frontera</p>
            <p>Telf: [TELÉFONO EMPRESA] | empresa@ejemplo.invalid</p>
          </div>
        </div>

        {/* Audit Context */}
        <div className="my-4 grid grid-cols-3 gap-3 text-[10px] rounded-lg p-3" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div>
            <span className="text-[8px] uppercase font-bold block tracking-wider font-sans" style={{ color: '#94a3b8' }}>OBRA ANALIZADA</span>
            <span className="font-extrabold text-[11px] block mt-0.5" style={{ color: '#0f172a' }}>
              {currentObra === 'all' ? 'CONSOLIDADO UNIFICADO GENERAL' : currentObra.name.toUpperCase()}
            </span>
            {currentObra !== 'all' && (
              <span className="block text-[8px] mt-0.5" style={{ color: '#64748b' }}>Ubicación: {currentObra.location}</span>
            )}
          </div>
          <div>
            <span className="text-[8px] uppercase font-bold block tracking-wider font-sans" style={{ color: '#94a3b8' }}>RANGO FILTRADO</span>
            <span className="font-semibold text-[11px] block mt-0.5 font-mono" style={{ color: '#0f172a' }}>
              {startDate || 'Cualquiera'} ➔ {endDate || 'Cualquiera'}
            </span>
          </div>
          <div>
            <span className="text-[8px] uppercase font-bold block tracking-wider font-sans" style={{ color: '#94a3b8' }}>SALDO FINANCIERO</span>
            <span 
              className="font-extrabold text-[8px] uppercase px-1.5 py-0.5 rounded inline-block mt-0.5 font-sans"
              style={isProfit ? { backgroundColor: '#ecfdf5', color: '#065f46' } : { backgroundColor: '#fef2f2', color: '#991b1b' }}
            >
              {isProfit ? '✓ Presupuesto Óptimo' : '⚠️ Desviación Negativa'}
            </span>
          </div>
        </div>

        {/* KPI block inside PDF */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg p-2.5 text-center" style={{ border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <span className="text-[8px] uppercase font-bold block" style={{ color: '#94a3b8' }}>Presupuesto Inicial Adjudicado</span>
            <span className="text-xs font-black block font-mono mt-0.5" style={{ color: '#000000' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalBudget)}</span>
          </div>
          <div className="rounded-lg p-2.5 text-center" style={{ border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
            <span className="text-[8px] uppercase font-bold block" style={{ color: '#94a3b8' }}>Gastos Totales de Ejecución</span>
            <span className="text-xs font-black block font-mono mt-0.5" style={{ color: '#000000' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalCost)}</span>
          </div>
          <div 
            className="rounded-lg p-2.5 text-center" 
            style={{ 
              border: isProfit ? '1px solid #a7f3d0' : '1px solid #fecaca', 
              backgroundColor: isProfit ? '#ecfdf5' : '#fef2f2' 
            }}
          >
            <span className="text-[8px] uppercase font-bold block" style={{ color: '#94a3b8' }}>Margen Estimado de Utilidad</span>
            <span 
              className="text-xs font-black block font-mono mt-0.5" 
              style={{ color: isProfit ? '#065f46' : '#b91c1c' }}
            >
              {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grossProfitMargin)}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Part 1: Materials */}
          <div>
            <h5 className="font-extrabold text-[9px] uppercase tracking-wider pb-0.5 mb-1.5 text-left" style={{ color: '#000000', borderBottom: '1px solid #e2e8f0' }}>1. Materiales de Obra y Suministros Homologados</h5>
            <table className="w-full text-left text-[8.5px]">
              <thead>
                <tr className="font-bold uppercase text-[7px] tracking-wider" style={{ color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
                  <th className="py-0.5">Doc Nº</th>
                  <th className="py-0.5">Proveedor</th>
                  <th className="py-0.5">Fecha</th>
                  <th className="py-0.5 text-right font-sans">Base (€)</th>
                  <th className="py-0.5 text-right font-sans">IVA (€)</th>
                  <th className="py-0.5 text-right font-bold font-sans" style={{ color: '#000000' }}>Total Neto (€)</th>
                </tr>
              </thead>
              <tbody className="font-mono" style={{ color: '#334155' }}>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-1 text-center font-sans" style={{ color: '#94a3b8' }}>Sin registros de facturas o albaranes dentro de la selección.</td>
                  </tr>
                ) : (
                  filteredDocs.map(doc => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td className="py-1 font-bold" style={{ color: '#0f172a' }}>{doc.docNumber}</td>
                      <td className="py-1 font-sans font-medium" style={{ color: '#1e293b' }}>{doc.supplier}</td>
                      <td className="py-1" style={{ color: '#64748b' }}>{doc.date}</td>
                      <td className="py-1 text-right">{doc.baseAmount.toFixed(2)}</td>
                      <td className="py-1 text-right" style={{ color: '#64748b' }}>{doc.ivaAmount.toFixed(2)} ({doc.ivaRate}%)</td>
                      <td className="py-1 text-right font-bold" style={{ color: '#0f172a' }}>{doc.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
                {filteredDocs.length > 0 && (
                  <tr className="font-bold" style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderTop: '1px solid #e2e8f0' }}>
                    <td colSpan={3} className="py-1 px-1 font-sans text-right">Total Materiales:</td>
                    <td className="py-1 text-right">{totalBase.toFixed(2)} €</td>
                    <td className="py-1 text-right">{totalIva.toFixed(2)} €</td>
                    <td className="py-1 text-right" style={{ color: '#000000' }}>{totalMaterials.toFixed(2)} €</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Part 2: Labor */}
          <div>
            <h5 className="font-extrabold text-[9px] uppercase tracking-wider pb-0.5 mb-1.5 text-left" style={{ color: '#000000', borderBottom: '1px solid #e2e8f0' }}>2. Imputaciones de Mano de Obra y Personal</h5>
            <table className="w-full text-left text-[8.5px]">
              <thead>
                <tr className="font-bold uppercase text-[7px] tracking-wider" style={{ color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
                  <th className="py-0.5">Operario</th>
                  <th className="py-0.5">Cargo</th>
                  <th className="py-0.5">Fecha</th>
                  <th className="py-0.5 text-right font-sans mb-1.5">Horas</th>
                  <th className="py-0.5 text-right font-sans">Tarifa (€)</th>
                  <th className="py-0.5 text-right font-bold font-sans" style={{ color: '#000000' }}>Total Coste (€)</th>
                </tr>
              </thead>
              <tbody className="font-mono" style={{ color: '#334155' }}>
                {filteredPersonal.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-1 text-center font-sans" style={{ color: '#94a3b8' }}>Sin logs de personal dentro del periodo.</td>
                  </tr>
                ) : (
                  filteredPersonal.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td className="py-1 font-sans font-bold text-left" style={{ color: '#1e293b' }}>
                        <div>{p.workerName}</div>
                      </td>
                      <td className="py-1 font-sans text-left" style={{ color: '#64748b' }}>{p.role}</td>
                      <td className="py-1 text-left" style={{ color: '#64748b' }}>{p.date}</td>
                      <td className="py-1 text-right">{p.hours.toFixed(1)} h</td>
                      <td className="py-1 text-right">{p.hourlyRate.toFixed(2)} /h</td>
                      <td className="py-1 text-right font-bold" style={{ color: '#0f172a' }}>{p.totalCost.toFixed(2)} €</td>
                    </tr>
                  ))
                )}
                {filteredPersonal.length > 0 && (
                  <tr className="font-bold" style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderTop: '1px solid #e2e8f0' }}>
                    <td colSpan={3} className="py-1 px-1 font-sans text-right block-total">Total Mano de Obra:</td>
                    <td className="py-1 text-right">{totalLaborHours} h</td>
                    <td></td>
                    <td className="py-1 text-right" style={{ color: '#000000' }}>{totalLabor.toFixed(2)} €</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Part 3: Overheads */}
          <div>
            <h5 className="font-extrabold text-[9px] uppercase tracking-wider pb-0.5 mb-1.5 text-left" style={{ color: '#000000', borderBottom: '1px solid #e2e8f0' }}>
              3. Gastos Indirectos e Imputaciones de Estructura de Empresa
            </h5>

            {localObraId !== 'all' && (
              <div className="rounded-lg p-2.5 border text-[9.5px] mb-2" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#334155' }}>
                <p className="font-sans text-left text-[8px] leading-relaxed mb-1.5" style={{ color: '#64748b' }}>
                  Sometido el reparto analítico de costes de estructura corporativa proporcionalmente según el volumen económico del presupuesto de la obra sobre el total de obras vivas.
                </p>
                <div className="grid grid-cols-4 gap-1.5 font-mono text-center text-[9px]">
                  <div className="p-1 rounded border" style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}>
                    <span className="text-[6.5px] block uppercase font-sans" style={{ color: '#94a3b8' }}>Gastos Estructura</span>
                    <span className="font-bold block mt-0.5" style={{ color: '#0f172a' }}>{totalFilteredOverhead.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="p-1 rounded border" style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}>
                    <span className="text-[6.5px] block uppercase font-sans" style={{ color: '#94a3b8' }}>Presupuesto Obra</span>
                    <span className="font-bold block mt-0.5" style={{ color: '#0f172a' }}>{totalBudget.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="p-1 rounded border" style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}>
                    <span className="text-[6.5px] block uppercase font-sans" style={{ color: '#94a3b8' }}>Presupuesto Total</span>
                    <span className="font-bold block mt-0.5" style={{ color: '#0f172a' }}>{totalBudgetOfAllObras.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="p-1 rounded" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                    <span className="text-[6.5px] block uppercase font-sans" style={{ color: '#cbd5e1' }}>Repercutido ({(localObraId !== 'all' ? (overheadAllocationMap[localObraId]?.percent || 0) * 100 : 105).toFixed(2)}%)</span>
                    <span className="font-bold block mt-0.5 text-white">{companyOverhead.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                </div>
              </div>
            )}

            <table className="w-full text-left text-[8.5px]">
              <thead>
                <tr className="font-bold uppercase text-[7px] tracking-wider" style={{ color: '#94a3b8', borderBottom: '1px solid #e2e8f0' }}>
                  <th className="py-0.5">Categoría</th>
                  <th className="py-0.5">Descripción Concepto</th>
                  <th className="py-0.5">Fecha</th>
                  <th className="py-0.5 text-right font-bold font-sans" style={{ color: '#000000' }}>Total (€)</th>
                  <th className="py-0.5 text-right font-bold font-sans" style={{ color: '#000000' }}>Coef. (%)</th>
                  <th className="py-0.5 text-right font-bold font-sans" style={{ color: '#000000' }}>Imputado (€)</th>
                </tr>
              </thead>
              <tbody className="font-mono" style={{ color: '#334155' }}>
                {combinedStructuralExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-1 text-center font-sans" style={{ color: '#94a3b8' }}>Sin gastos de empresa generales en este periodo.</td>
                  </tr>
                ) : (
                  combinedStructuralExpenses.map(g => {
                    const itemRatio = localObraId === 'all' ? 1.0 : (overheadAllocationMap[localObraId]?.percent || 0);
                    const proratedAmount = g.amount * itemRatio;
                    return (
                      <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="py-1 font-sans font-bold text-left" style={{ color: '#0f172a' }}>{g.category}</td>
                        <td className="py-1 font-sans text-left" style={{ color: '#475569' }}>{g.description}</td>
                        <td className="py-1 text-left" style={{ color: '#64748b' }}>{g.date}</td>
                        <td className="py-1 text-right" style={{ color: '#64748b' }}>{g.amount.toFixed(2)}</td>
                        <td className="py-1 text-right" style={{ color: '#64748b' }}>{(itemRatio * 100).toFixed(2)} %</td>
                        <td className="py-1 text-right font-bold" style={{ color: '#0f172a' }}>{proratedAmount.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
                {combinedStructuralExpenses.length > 0 && (
                  <tr className="font-bold" style={{ backgroundColor: '#f8fafc', color: '#0f172a', borderTop: '1px solid #e2e8f0' }}>
                    <td colSpan={3} className="py-1 px-1 font-sans text-right">Sumatoria Gastos Estructurales:</td>
                    <td className="py-1 text-right" style={{ color: '#64748b' }}>{totalFilteredOverhead.toFixed(2)} €</td>
                    <td className="py-1 text-right" style={{ color: '#64748b' }}>{(localObraId !== 'all' ? (overheadAllocationMap[localObraId]?.percent || 0) * 100 : 100).toFixed(2)} %</td>
                    <td className="py-1 text-right" style={{ color: '#000000' }}>{companyOverhead.toFixed(2)} €</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Consolidated balance footer row */}
          <div className="rounded-xl p-3 flex justify-between items-center text-[10px] mt-3" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
            <div>
              <h6 className="font-bold uppercase tracking-wider text-[8px]" style={{ color: '#ffffff' }}>Gran Total Consolidado de Gastos de Ejecución</h6>
              <p className="text-[6.5px]" style={{ color: '#94a3b8' }}>Cómputo certificado resultante del intervalo de balance seleccionado.</p>
            </div>
            <div>
              <span className="text-sm font-black font-mono" style={{ color: '#ffffff' }}>
                {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalCost)}
              </span>
            </div>
          </div>

          {/* Signatures inside PDF */}
          <div className="mt-6 grid grid-cols-2 gap-6 text-center text-[7px] pt-3 pb-1" style={{ borderTop: '1px solid #cbd5e1', color: '#64748b' }}>
            <div>
              <div className="h-6 flex items-end justify-center pb-1 underline italic" style={{ color: '#94a3b8' }}>Firma Autorizada</div>
              <div className="font-extrabold uppercase tracking-wider" style={{ color: '#1e293b' }}>Responsable de empresa - Gerente</div>
            </div>
            <div>
              <div className="h-6 flex items-end justify-center pb-1 underline italic" style={{ color: '#94a3b8' }}>Certificación de Obra</div>
              <div className="font-extrabold uppercase tracking-wider" style={{ color: '#1e293b' }}>Dirección Facultativa</div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
