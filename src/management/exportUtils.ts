/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import ExcelJS from 'exceljs';
import { Obra, FacturaAlbaran, PersonalCost, OtrosGasto, getObraOverheadAllocationMap, getProratedPersonalCost } from './types';

/**
 * Normaliza textos eliminando caracteres molestos.
 */
function sanitize(text: string | undefined | null): string {
  if (!text) return '';
  return `${text}`.replace(/[\n\r;]/g, ' ').replace(/"/g, '""');
}

/**
 * Helper to paint cell backgrounds in a merged or normal range.
 */
function fillCellRange(ws: ExcelJS.Worksheet, range: string, argbColor: string) {
  const [start, end] = range.includes(':') ? range.split(':') : [range, range];
  const startCell = ws.getCell(start);
  const endCell = ws.getCell(end);
  const startCol = Number(startCell.col);
  const startRow = Number(startCell.row);
  const endCol = Number(endCell.col);
  const endRow = Number(endCell.row);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argbColor }
      };
    }
  }
}

/**
 * Draws custom borders around an Excel box, with an optional thick colored left vertical border.
 */
function formatCardBox(ws: ExcelJS.Worksheet, range: string, leftAccentColor?: string) {
  const [start, end] = range.split(':');
  const startCell = ws.getCell(start);
  const endCell = ws.getCell(end);
  const startCol = Number(startCell.col);
  const startRow = Number(startCell.row);
  const endCol = Number(endCell.col);
  const endRow = Number(endCell.row);

  const grayBorder = { style: 'thin', color: { argb: 'FFCBD5E1' } } as const;
  const lightGrayBorder = { style: 'thin', color: { argb: 'FFF1F5F9' } } as const;

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c);
      const border: any = {};

      if (r === startRow) border.top = grayBorder;
      if (r === endRow) border.bottom = grayBorder;

      if (c === startCol) {
        if (leftAccentColor) {
          border.left = { style: 'medium', color: { argb: leftAccentColor } };
        } else {
          border.left = grayBorder;
        }
      } else {
        border.left = lightGrayBorder;
      }

      if (c === endCol) border.right = grayBorder;

      cell.border = border;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
      };
    }
  }
}

/**
 * Apply full styling to a standard header row.
 */
function styleHeaderRow(ws: ExcelJS.Worksheet, rowNum: number, startColLetter: string, endColLetter: string, bgColor: string = 'FF0F172A') {
  const startColNum = ws.getColumn(startColLetter).number;
  const endColNum = ws.getColumn(endColLetter).number;

  for (let c = startColNum; c <= endColNum; c++) {
    const cell = ws.getCell(rowNum, c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };
  }
}

/**
 * Apply a striped background with thin slate borders to standard rows.
 */
function styleDataRow(ws: ExcelJS.Worksheet, rowNum: number, startColLetter: string, endColLetter: string, isEven: boolean) {
  const startColNum = ws.getColumn(startColLetter).number;
  const endColNum = ws.getColumn(endColLetter).number;
  const bgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

  for (let c = startColNum; c <= endColNum; c++) {
    const cell = ws.getCell(rowNum, c);
    cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // Auto alignment based on numeric types or alignment helper
    if (!cell.alignment) {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  }
}

/**
 * Sets a row as double bottom-bordered, bold texts for totals.
 */
function styleTotalsRow(ws: ExcelJS.Worksheet, rowNum: number, startColLetter: string, endColLetter: string, bgColor: string = 'FFF1F5F9') {
  const startColNum = ws.getColumn(startColLetter).number;
  const endColNum = ws.getColumn(endColLetter).number;

  for (let c = startColNum; c <= endColNum; c++) {
    const cell = ws.getCell(rowNum, c);
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgColor }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };
  }
}

/**
 * Genera y descarga un informe Excel (.xlsx) altamente profesional, visual y corporativo.
 */
export async function exportToExcel(
  obraSelected: Obra | 'all',
  obras: Obra[],
  documentos: FacturaAlbaran[],
  personal: PersonalCost[],
  gastosGenerales: OtrosGasto[],
  startDate?: string,
  endDate?: string
): Promise<Blob> {
  const isAll = obraSelected === 'all';
  const fechaGeneracion = new Date().toLocaleDateString('es-ES');

  // Prorrateamos todo el personal y filtramos por solapamiento (overlapDays > 0)
  const proratedPersonal = personal.map(p => getProratedPersonalCost(p, startDate, endDate));

  const docsInScope = isAll 
    ? documentos 
    : documentos.filter(d => d.obraId === obraSelected.id);

  const personalInScope = isAll
    ? proratedPersonal.filter(p => p.obraId !== 'structural' && p.overlapDays > 0)
    : proratedPersonal.filter(p => p.obraId === obraSelected.id && p.overlapDays > 0);

  const structuralPersonal = proratedPersonal.filter(p => p.obraId === 'structural' && p.overlapDays > 0);

  // Cálculos financieros
  const totalBudgetOfAllObras = obras.reduce((acc, o) => acc + o.budget, 0);
  const totalBudget = isAll ? totalBudgetOfAllObras : (obraSelected?.budget || 0);

  const materialsSpent = docsInScope.reduce((acc, d) => acc + d.totalAmount, 0);
  const laborSpent = personalInScope.reduce((acc, p) => acc + p.totalCost, 0);

  const sumGastosG = gastosGenerales.reduce((acc, g) => acc + g.amount, 0) +
                     structuralPersonal.reduce((acc, p) => acc + p.totalCost, 0);
  const overheadAllocationMap = getObraOverheadAllocationMap(obras, sumGastosG);
  const ratioPrerata = !isAll ? (overheadAllocationMap[obraSelected.id]?.percent || 0) : 1;
  const companyOverhead = isAll ? sumGastosG : (overheadAllocationMap[obraSelected.id]?.amount || 0);

  const totalSpent = materialsSpent + laborSpent + companyOverhead;
  const remainingBudget = totalBudget - totalSpent;
  const marginPercentage = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0;

  // Crear Cuaderno de Trabajo ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UniProyect OS';
  workbook.lastModifiedBy = 'UniProyect OS';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Excel Number and Percent Formats
  const CurrencyFormat = '#,##0.00" €";[Red]-#,##0.00" €";0.00" €"';
  const PercentFormat = '0.00%';

  // ==========================================
  // SHEET 1: 📊 DASHBOARD & RESUMEN FINANCIERO
  // ==========================================
  const wsDash = workbook.addWorksheet('📊 Cuadro de Mando', {
    views: [{ showGridLines: true }]
  });

  // Configuración de anchos iniciales de columnas para el Dashboard para centrar las tarjetas
  wsDash.getColumn('A').width = 4;   // Padding izquierdo
  wsDash.getColumn('B').width = 30;  // Conceptos
  wsDash.getColumn('C').width = 16;  // Margen/Dinero
  wsDash.getColumn('D').width = 16;  // Dinero
  wsDash.getColumn('E').width = 16;  // Dinero
  wsDash.getColumn('F').width = 16;  // Dinero
  wsDash.getColumn('G').width = 16;  // Dinero
  wsDash.getColumn('H').width = 16;  // Dinero
  wsDash.getColumn('I').width = 16;  // Dinero

  // 1. BANNER CORPORATIVO GRANDE
  fillCellRange(wsDash, 'B2:I3', 'FF0C0C0E'); // Fondo negro carbón premium

  const titleCell = wsDash.getCell('B2');
  titleCell.value = 'UNIPROYECT ── CONTROL OPERATIVO & RENDIMIENTO FINANCIERO';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.mergeCells('B2:I2');

  const subCell = wsDash.getCell('B3');
  subCell.value = isAll
    ? `Consolidación General de Obras ── UniProyect ── Generado el ${fechaGeneracion}`
    : `Proyecto: ${obraSelected.name} ── UniProyect ── Impreso: ${fechaGeneracion}`;
  subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF10B981' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.mergeCells('B3:I3');

  // Altura del banner
  wsDash.getRow(2).height = 24;
  wsDash.getRow(3).height = 20;

  // 2. TARJETAS KPI (Horizontalmente en B5:I7)
  wsDash.getRow(5).height = 16;
  wsDash.getRow(6).height = 24;
  wsDash.getRow(7).height = 14;

  // --- KPI Card 1: Presupuesto Contratado ---
  wsDash.mergeCells('B5:C5');
  wsDash.getCell('B5').value = 'PRESUPUESTO ACORDADO';
  wsDash.getCell('B5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
  wsDash.getCell('B5').alignment = { vertical: 'middle', horizontal: 'center' };

  wsDash.mergeCells('B6:C6');
  wsDash.getCell('B6').value = totalBudget;
  wsDash.getCell('B6').numFmt = CurrencyFormat;
  wsDash.getCell('B6').font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  wsDash.getCell('B6').alignment = { vertical: 'middle', horizontal: 'center' };

  wsDash.mergeCells('B7:C7');
  wsDash.getCell('B7').value = isAll ? `${obras.length} obras bajo gestión` : `Ubicación: ${obraSelected.location}`;
  wsDash.getCell('B7').font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
  wsDash.getCell('B7').alignment = { vertical: 'middle', horizontal: 'center' };
  formatCardBox(wsDash, 'B5:C7', 'FF10B981'); // Emerald Left Accent

  // --- KPI Card 2: Costes Acumulados ---
  wsDash.mergeCells('D5:E5');
  wsDash.getCell('D5').value = 'COSTES CONTROLADOS';
  wsDash.getCell('D5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
  wsDash.getCell('D5').alignment = { vertical: 'middle', horizontal: 'center' };

  wsDash.mergeCells('D6:E6');
  wsDash.getCell('D6').value = totalSpent;
  wsDash.getCell('D6').numFmt = CurrencyFormat;
  wsDash.getCell('D6').font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF991B1B' } }; // Red costs
  wsDash.getCell('D6').alignment = { vertical: 'middle', horizontal: 'center' };

  wsDash.mergeCells('D7:E7');
  wsDash.getCell('D7').value = `Suministros: ${materialsSpent.toLocaleString('es-ES', { maximumFractionDigits: 0 })} € | MO: ${laborSpent.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;
  wsDash.getCell('D7').font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
  wsDash.getCell('D7').alignment = { vertical: 'middle', horizontal: 'center' };
  formatCardBox(wsDash, 'D5:E7', 'FFEF4444'); // Soft Rose Left Accent

  // --- KPI Card 3: Margen Financiero ---
  wsDash.mergeCells('F5:G5');
  wsDash.getCell('F5').value = 'MARGEN NETO ESTIMADO';
  wsDash.getCell('F5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
  wsDash.getCell('F5').alignment = { vertical: 'middle', horizontal: 'center' };

  wsDash.mergeCells('F6:G6');
  wsDash.getCell('F6').value = remainingBudget;
  wsDash.getCell('F6').numFmt = CurrencyFormat;
  wsDash.getCell('F6').font = { 
    name: 'Segoe UI', 
    size: 14, 
    bold: true, 
    color: { argb: remainingBudget >= 0 ? 'FF047857' : 'FFB91C1C' } 
  };
  wsDash.getCell('F6').alignment = { vertical: 'middle', horizontal: 'center' };

  wsDash.mergeCells('F7:G7');
  wsDash.getCell('F7').value = remainingBudget >= 0 ? 'Excedente Positivo' : 'Día de Desviación';
  wsDash.getCell('F7').font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
  wsDash.getCell('F7').alignment = { vertical: 'middle', horizontal: 'center' };
  formatCardBox(wsDash, 'F5:G7', 'FF3B82F6'); // Sky Blue Left Accent

  // --- KPI Card 4: Rentabilidad % ---
  wsDash.mergeCells('H5:I5');
  wsDash.getCell('H5').value = 'RENDIMIENTO DE OBRA';
  wsDash.getCell('H5').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF64748B' } };
  wsDash.getCell('H5').alignment = { vertical: 'middle', horizontal: 'center' };

  wsDash.mergeCells('H6:I6');
  wsDash.getCell('H6').value = marginPercentage / 100;
  wsDash.getCell('H6').numFmt = PercentFormat;
  wsDash.getCell('H6').font = { 
    name: 'Segoe UI', 
    size: 14, 
    bold: true, 
    color: { argb: marginPercentage >= 15 ? 'FF047857' : marginPercentage >= 10 ? 'FFD97706' : 'FFEF4444' } 
  };
  wsDash.getCell('H6').alignment = { vertical: 'middle', horizontal: 'center' };

  wsDash.mergeCells('H7:I7');
  wsDash.getCell('H7').value = marginPercentage >= 15 ? 'Rentabilidad Excelente' : marginPercentage >= 10 ? 'Margen Aceptable' : 'Alerta de Ineficiencia';
  wsDash.getCell('H7').font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
  wsDash.getCell('H7').alignment = { vertical: 'middle', horizontal: 'center' };
  formatCardBox(wsDash, 'H5:I7', 'FFF59E0B'); // Amber Left Accent


  // 3. SECCIÓN DE ALERTA DE RIESGO (Si margen es crítico)
  let rowOffset = 9;
  if (marginPercentage < 10 && totalBudget > 0) {
    wsDash.mergeCells(`B${rowOffset}:I${rowOffset + 1}`);
    const alertCell = wsDash.getCell(`B${rowOffset}`);
    alertCell.value = '⚠️ ATENZACIÓN ── ATRAPAMIENTO CORPORATIVO DE MARGEN DE BENEFICIO:\n' +
                      'El rendimiento neto de los libros auditados está por debajo del 10%. Por favor, verifique el incremento en proveedores de materiales, aplique controles de auditoría sobre albaranes sin facturar y examine los ratios de asistencia de peones.';
    alertCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF991B1B' } };
    alertCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    
    // Rellenamos el fondo de la alerta con rosa claro y borde rojo
    fillCellRange(wsDash, `B${rowOffset}:I${rowOffset + 1}`, 'FFFFEAEA');
    for (let c = 2; c <= 9; c++) {
      wsDash.getCell(rowOffset, c).border = {
        top: { style: 'thin', color: { argb: 'FFFCA5A5' } },
        bottom: { style: 'thin', color: { argb: 'FFFCA5A5' } },
        left: c === 2 ? { style: 'medium', color: { argb: 'FFEF4444' } } : undefined,
        right: c === 9 ? { style: 'thin', color: { argb: 'FFFCA5A5' } } : undefined,
      };
      wsDash.getCell(rowOffset + 1, c).border = {
        top: undefined,
        bottom: { style: 'thin', color: { argb: 'FFFCA5A5' } },
        left: c === 2 ? { style: 'medium', color: { argb: 'FFEF4444' } } : undefined,
        right: c === 9 ? { style: 'thin', color: { argb: 'FFFCA5A5' } } : undefined,
      };
    }
    
    rowOffset += 3;
  } else {
    rowOffset += 1;
  }


  // 4. TABLA 1: ESTRUCTURA INTERNA DE COSTES CONTROLADOS
  wsDash.getCell(`B${rowOffset}`).value = 'ESTRUCTURA OPERATIVA DE COSTES';
  wsDash.getCell(`B${rowOffset}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  wsDash.mergeCells(`B${rowOffset}:E${rowOffset}`);
  rowOffset += 1;

  // Cabecera de la tabla
  wsDash.getCell(`B${rowOffset}`).value = 'Módulo de Expendio';
  wsDash.getCell(`C${rowOffset}`).value = 'Coste Asignado (€)';
  wsDash.getCell(`D${rowOffset}`).value = 'Distribución %';
  wsDash.getCell(`E${rowOffset}`).value = 'Estado de Alerta';
  styleHeaderRow(wsDash, rowOffset, 'B', 'E', 'FF334155'); // Gris pizarra
  wsDash.getRow(rowOffset).height = 20;
  rowOffset += 1;

  // Fila Materiales
  wsDash.getCell(`B${rowOffset}`).value = 'Suministros Materiales y Subcontratas';
  wsDash.getCell(`C${rowOffset}`).value = materialsSpent;
  wsDash.getCell(`C${rowOffset}`).numFmt = CurrencyFormat;
  wsDash.getCell(`C${rowOffset}`).alignment = { horizontal: 'right' };
  wsDash.getCell(`D${rowOffset}`).value = totalSpent > 0 ? (materialsSpent / totalSpent) : 0;
  wsDash.getCell(`D${rowOffset}`).numFmt = PercentFormat;
  wsDash.getCell(`D${rowOffset}`).alignment = { horizontal: 'right' };
  wsDash.getCell(`E${rowOffset}`).value = 'Control Operativo';
  wsDash.getCell(`E${rowOffset}`).alignment = { horizontal: 'center' };
  styleDataRow(wsDash, rowOffset, 'B', 'E', false);
  rowOffset += 1;

  // Fila Mano de Obra
  wsDash.getCell(`B${rowOffset}`).value = 'Mano de Obra y Control de Personal';
  wsDash.getCell(`C${rowOffset}`).value = laborSpent;
  wsDash.getCell(`C${rowOffset}`).numFmt = CurrencyFormat;
  wsDash.getCell(`C${rowOffset}`).alignment = { horizontal: 'right' };
  wsDash.getCell(`D${rowOffset}`).value = totalSpent > 0 ? (laborSpent / totalSpent) : 0;
  wsDash.getCell(`D${rowOffset}`).numFmt = PercentFormat;
  wsDash.getCell(`D${rowOffset}`).alignment = { horizontal: 'right' };
  wsDash.getCell(`E${rowOffset}`).value = 'Activo';
  wsDash.getCell(`E${rowOffset}`).alignment = { horizontal: 'center' };
  styleDataRow(wsDash, rowOffset, 'B', 'E', true);
  rowOffset += 1;

  // Fila Overhead
  wsDash.getCell(`B${rowOffset}`).value = isAll ? 'Gastos Generales / Estructurales' : 'Gastos Generales Repercutidos';
  wsDash.getCell(`C${rowOffset}`).value = companyOverhead;
  wsDash.getCell(`C${rowOffset}`).numFmt = CurrencyFormat;
  wsDash.getCell(`C${rowOffset}`).alignment = { horizontal: 'right' };
  wsDash.getCell(`D${rowOffset}`).value = totalSpent > 0 ? (companyOverhead / totalSpent) : 0;
  wsDash.getCell(`D${rowOffset}`).numFmt = PercentFormat;
  wsDash.getCell(`D${rowOffset}`).alignment = { horizontal: 'right' };
  wsDash.getCell(`E${rowOffset}`).value = isAll ? 'Overhead General' : `Cuota Pró-rata (${(ratioPrerata*100).toFixed(1)}%)`;
  wsDash.getCell(`E${rowOffset}`).alignment = { horizontal: 'center' };
  styleDataRow(wsDash, rowOffset, 'B', 'E', false);
  rowOffset += 1;

  // Totales
  wsDash.getCell(`B${rowOffset}`).value = 'SUMATORIO TOTAL DE EGRESOS';
  wsDash.getCell(`C${rowOffset}`).value = totalSpent;
  wsDash.getCell(`C${rowOffset}`).numFmt = CurrencyFormat;
  wsDash.getCell(`C${rowOffset}`).alignment = { horizontal: 'right' };
  wsDash.getCell(`D${rowOffset}`).value = totalSpent > 0 ? 1 : 0;
  wsDash.getCell(`D${rowOffset}`).numFmt = PercentFormat;
  wsDash.getCell(`D${rowOffset}`).alignment = { horizontal: 'right' };
  wsDash.getCell(`E${rowOffset}`).value = 'Consolidado';
  wsDash.getCell(`E${rowOffset}`).alignment = { horizontal: 'center' };
  styleTotalsRow(wsDash, rowOffset, 'B', 'E');
  rowOffset += 3;


  // 5. TABLA 2: COMPARATIVA DE PROYECTOS (SI ES CONSOLIDADO 'ALL') / ÚLTIMOS DOCUMENTOS (SI ES UNA SOLA)
  if (isAll) {
    wsDash.getCell(`B${rowOffset}`).value = 'PANORÁMICA DIGITAL COMPARATIVA DE OBRAS';
    wsDash.getCell(`B${rowOffset}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    wsDash.mergeCells(`B${rowOffset}:I${rowOffset}`);
    rowOffset += 1;

    // Table Headers
    const tableCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    wsDash.getCell(`B${rowOffset}`).value = 'Obra / Proyecto Adjudicado';
    wsDash.getCell(`C${rowOffset}`).value = 'Presupuesto (€)';
    wsDash.getCell(`D${rowOffset}`).value = 'Suministros (€)';
    wsDash.getCell(`E${rowOffset}`).value = 'Personal (€)';
    wsDash.getCell(`F${rowOffset}`).value = 'Overhead Reper. (€)';
    wsDash.getCell(`G${rowOffset}`).value = 'Egresos Totales (€)';
    wsDash.getCell(`H${rowOffset}`).value = 'Margen Neto (€)';
    wsDash.getCell(`I${rowOffset}`).value = 'Rendimiento %';
    styleHeaderRow(wsDash, rowOffset, 'B', 'I', 'FF047857'); // Verde Corporativo
    wsDash.getRow(rowOffset).height = 20;
    rowOffset += 1;

    let subSumBudget = 0;
    let subSumMat = 0;
    let subSumPers = 0;
    let subSumOverhead = 0;
    let subSumTotal = 0;
    let subSumMargen = 0;

    obras.forEach((obr, index) => {
      // Filtrar costes específicos de este proyecto
      const obrDocs = documentos.filter(d => d.obraId === obr.id);
      const obrPers = personal.filter(p => p.obraId === obr.id);

      const obrMat = obrDocs.reduce((acc, d) => acc + d.totalAmount, 0);
      const obrLab = obrPers.reduce((acc, p) => acc + p.totalCost, 0);
      
      const pRatio = totalBudgetOfAllObras > 0 ? (obr.budget / totalBudgetOfAllObras) : 0;
      const obrOverhead = pRatio * sumGastosG;

      const obrTotalSpent = obrMat + obrLab + obrOverhead;
      const obMargen = obr.budget - obrTotalSpent;
      const obMargenPerc = obr.budget > 0 ? (obMargen / obr.budget) : 0;

      wsDash.getCell(`B${rowOffset}`).value = obr.name;
      wsDash.getCell(`C${rowOffset}`).value = obr.budget;
      wsDash.getCell(`C${rowOffset}`).numFmt = CurrencyFormat;
      wsDash.getCell(`C${rowOffset}`).alignment = { horizontal: 'right' };
      
      wsDash.getCell(`D${rowOffset}`).value = obrMat;
      wsDash.getCell(`D${rowOffset}`).numFmt = CurrencyFormat;
      wsDash.getCell(`D${rowOffset}`).alignment = { horizontal: 'right' };

      wsDash.getCell(`E${rowOffset}`).value = obrLab;
      wsDash.getCell(`E${rowOffset}`).numFmt = CurrencyFormat;
      wsDash.getCell(`E${rowOffset}`).alignment = { horizontal: 'right' };

      wsDash.getCell(`F${rowOffset}`).value = obrOverhead;
      wsDash.getCell(`F${rowOffset}`).numFmt = CurrencyFormat;
      wsDash.getCell(`F${rowOffset}`).alignment = { horizontal: 'right' };

      wsDash.getCell(`G${rowOffset}`).value = obrTotalSpent;
      wsDash.getCell(`G${rowOffset}`).numFmt = CurrencyFormat;
      wsDash.getCell(`G${rowOffset}`).alignment = { horizontal: 'right' };

      wsDash.getCell(`H${rowOffset}`).value = obMargen;
      wsDash.getCell(`H${rowOffset}`).numFmt = CurrencyFormat;
      wsDash.getCell(`H${rowOffset}`).font = { bold: true, color: { argb: obMargen >= 0 ? 'FF047857' : 'FF991B1B' } };
      wsDash.getCell(`H${rowOffset}`).alignment = { horizontal: 'right' };

      wsDash.getCell(`I${rowOffset}`).value = obMargenPerc;
      wsDash.getCell(`I${rowOffset}`).numFmt = PercentFormat;
      wsDash.getCell(`I${rowOffset}`).font = { bold: true };
      wsDash.getCell(`I${rowOffset}`).alignment = { horizontal: 'right' };

      styleDataRow(wsDash, rowOffset, 'B', 'I', index % 2 === 1);

      subSumBudget += obr.budget;
      subSumMat += obrMat;
      subSumPers += obrLab;
      subSumOverhead += obrOverhead;
      subSumTotal += obrTotalSpent;
      subSumMargen += obMargen;

      rowOffset += 1;
    });

    // Totales de la comparativa
    const totMargenPPercent = subSumBudget > 0 ? (subSumMargen / subSumBudget) : 0;
    wsDash.getCell(`B${rowOffset}`).value = 'RESUMEN TOTAL CARTERA';
    wsDash.getCell(`C${rowOffset}`).value = subSumBudget;
    wsDash.getCell(`C${rowOffset}`).numFmt = CurrencyFormat;
    wsDash.getCell(`C${rowOffset}`).alignment = { horizontal: 'right' };

    wsDash.getCell(`D${rowOffset}`).value = subSumMat;
    wsDash.getCell(`D${rowOffset}`).numFmt = CurrencyFormat;
    wsDash.getCell(`D${rowOffset}`).alignment = { horizontal: 'right' };

    wsDash.getCell(`E${rowOffset}`).value = subSumPers;
    wsDash.getCell(`E${rowOffset}`).numFmt = CurrencyFormat;
    wsDash.getCell(`E${rowOffset}`).alignment = { horizontal: 'right' };

    wsDash.getCell(`F${rowOffset}`).value = subSumOverhead;
    wsDash.getCell(`F${rowOffset}`).numFmt = CurrencyFormat;
    wsDash.getCell(`F${rowOffset}`).alignment = { horizontal: 'right' };

    wsDash.getCell(`G${rowOffset}`).value = subSumTotal;
    wsDash.getCell(`G${rowOffset}`).numFmt = CurrencyFormat;
    wsDash.getCell(`G${rowOffset}`).alignment = { horizontal: 'right' };

    wsDash.getCell(`H${rowOffset}`).value = subSumMargen;
    wsDash.getCell(`H${rowOffset}`).numFmt = CurrencyFormat;
    wsDash.getCell(`H${rowOffset}`).alignment = { horizontal: 'right' };

    wsDash.getCell(`I${rowOffset}`).value = totMargenPPercent;
    wsDash.getCell(`I${rowOffset}`).numFmt = PercentFormat;
    wsDash.getCell(`I${rowOffset}`).alignment = { horizontal: 'right' };

    styleTotalsRow(wsDash, rowOffset, 'B', 'I');

  } else {
    // Si es una sola Obra, mostramos los Top 5 Suministros y Top 5 Fichajes en paralelo
    wsDash.getCell(`B${rowOffset}`).value = 'HISTOGRAMA RESUMIDO DE MOVIMIENTOS RECIENTES';
    wsDash.getCell(`B${rowOffset}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    wsDash.mergeCells(`B${rowOffset}:I${rowOffset}`);
    rowOffset += 1;

    // Subtítulos
    wsDash.mergeCells(`B${rowOffset}:E${rowOffset}`);
    wsDash.getCell(`B${rowOffset}`).value = 'Top Suministros de Materiales';
    wsDash.getCell(`B${rowOffset}`).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF047857' } };
    wsDash.getCell(`B${rowOffset}`).alignment = { horizontal: 'center' };

    wsDash.mergeCells(`F${rowOffset}:I${rowOffset}`);
    wsDash.getCell(`F${rowOffset}`).value = 'Top Control de Mano de Obra';
    wsDash.getCell(`F${rowOffset}`).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };
    wsDash.getCell(`F${rowOffset}`).alignment = { horizontal: 'center' };

    rowOffset += 1;

    // Headers de mini tablas
    wsDash.getCell(`B${rowOffset}`).value = 'Proveedor';
    wsDash.getCell(`C${rowOffset}`).value = 'Documento';
    wsDash.getCell(`D${rowOffset}`).value = 'Fecha';
    wsDash.getCell(`E${rowOffset}`).value = 'Neto (€)';
    styleHeaderRow(wsDash, rowOffset, 'B', 'E', 'FF334155');

    wsDash.getCell(`F${rowOffset}`).value = 'Operario';
    wsDash.getCell(`G${rowOffset}`).value = 'Fecha';
    wsDash.getCell(`H${rowOffset}`).value = 'Horas';
    wsDash.getCell(`I${rowOffset}`).value = 'Coste (€)';
    styleHeaderRow(wsDash, rowOffset, 'F', 'I', 'FF1E293B');

    rowOffset += 1;

    const topDocs = docsInScope.slice(0, 5);
    const topMO = personalInScope.slice(0, 5);

    const maxLines = Math.max(topDocs.length, topMO.length);

    for (let index = 0; index < maxLines; index++) {
      const d = topDocs[index];
      const m = topMO[index];

      // Izquierda: Suministro
      if (d) {
        wsDash.getCell(`B${rowOffset}`).value = d.supplier;
        wsDash.getCell(`C${rowOffset}`).value = `${d.type.toUpperCase()} ${d.docNumber}`;
        wsDash.getCell(`D${rowOffset}`).value = d.date;
        wsDash.getCell(`E${rowOffset}`).value = d.totalAmount;
        wsDash.getCell(`E${rowOffset}`).numFmt = CurrencyFormat;
        wsDash.getCell(`E${rowOffset}`).alignment = { horizontal: 'right' };
      } else {
        wsDash.getCell(`B${rowOffset}`).value = '-';
        wsDash.getCell(`C${rowOffset}`).value = '-';
        wsDash.getCell(`D${rowOffset}`).value = '-';
        wsDash.getCell(`E${rowOffset}`).value = 0;
        wsDash.getCell(`E${rowOffset}`).numFmt = CurrencyFormat;
      }
      styleDataRow(wsDash, rowOffset, 'B', 'E', index % 2 === 1);

      // Derecha: Mano de obra
      if (m) {
        wsDash.getCell(`F${rowOffset}`).value = m.workerName;
        wsDash.getCell(`G${rowOffset}`).value = m.date;
        wsDash.getCell(`H${rowOffset}`).value = m.hours;
        wsDash.getCell(`H${rowOffset}`).alignment = { horizontal: 'right' };
        wsDash.getCell(`I${rowOffset}`).value = m.totalCost;
        wsDash.getCell(`I${rowOffset}`).numFmt = CurrencyFormat;
        wsDash.getCell(`I${rowOffset}`).alignment = { horizontal: 'right' };
      } else {
        wsDash.getCell(`F${rowOffset}`).value = '-';
        wsDash.getCell(`G${rowOffset}`).value = '-';
        wsDash.getCell(`H${rowOffset}`).value = 0;
        wsDash.getCell(`I${rowOffset}`).value = 0;
        wsDash.getCell(`I${rowOffset}`).numFmt = CurrencyFormat;
      }
      styleDataRow(wsDash, rowOffset, 'F', 'I', index % 2 === 1);

      rowOffset += 1;
    }
  }


  // ==========================================
  // SHEET 2: 🧾 MATERIALES Y SUMINISTROS
  // ==========================================
  const wsDocs = workbook.addWorksheet('🧾 Materiales y Suministros');
  wsDocs.views = [{ showGridLines: true }];

  // Title Block
  wsDocs.getCell('A1').value = 'UNIPROYECT ── REGISTRO DE SUMINISTROS Y SUBCONTRATAS';
  wsDocs.getCell('A1').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF047857' } };
  
  const subtitleLabel = isAll 
    ? 'Auditoría consolidada de adquisiciones' 
    : `Proyecto auditado: ${obraSelected.name} (Fecha de exportación: ${fechaGeneracion})`;
  wsDocs.getCell('A2').value = subtitleLabel;
  wsDocs.getCell('A2').font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF555555' } };

  // Headers
  const docHeaders = [
    'ID del Documento',
    'Obra / Proyecto',
    'Tipo',
    'Nº Factura / Albarán',
    'Proveedor',
    'Fecha',
    'Base Imponible (€)',
    'IVA (%)',
    'Cuota IVA (€)',
    'Retención (%)',
    'Importe Retenido (€)',
    'Total Neto (€)',
    'Concepto / Notas'
  ];

  docHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + i); // A, B, C...
    wsDocs.getCell(`${colLetter}4`).value = h;
  });
  styleHeaderRow(wsDocs, 4, 'A', 'M', 'FF047857');
  wsDocs.getRow(4).height = 24;

  // Insertar filas de documentos
  let docRowOffset = 5;
  docsInScope.forEach((doc, index) => {
    const obraLabel = obras.find(o => o.id === doc.obraId)?.name || 'Sin asignar';
    
    wsDocs.getCell(`A${docRowOffset}`).value = doc.id;
    wsDocs.getCell(`B${docRowOffset}`).value = obraLabel;
    wsDocs.getCell(`C${docRowOffset}`).value = doc.type.toUpperCase();
    wsDocs.getCell(`C${docRowOffset}`).alignment = { horizontal: 'center' };
    wsDocs.getCell(`D${docRowOffset}`).value = doc.docNumber;
    wsDocs.getCell(`E${docRowOffset}`).value = doc.supplier;
    
    wsDocs.getCell(`F${docRowOffset}`).value = doc.date;
    wsDocs.getCell(`F${docRowOffset}`).alignment = { horizontal: 'center' };

    // Números reales
    wsDocs.getCell(`G${docRowOffset}`).value = doc.baseAmount;
    wsDocs.getCell(`G${docRowOffset}`).numFmt = CurrencyFormat;
    wsDocs.getCell(`G${docRowOffset}`).alignment = { horizontal: 'right' };

    wsDocs.getCell(`H${docRowOffset}`).value = doc.ivaRate / 100;
    wsDocs.getCell(`H${docRowOffset}`).numFmt = '0%';
    wsDocs.getCell(`H${docRowOffset}`).alignment = { horizontal: 'right' };

    wsDocs.getCell(`I${docRowOffset}`).value = doc.ivaAmount;
    wsDocs.getCell(`I${docRowOffset}`).numFmt = CurrencyFormat;
    wsDocs.getCell(`I${docRowOffset}`).alignment = { horizontal: 'right' };

    wsDocs.getCell(`J${docRowOffset}`).value = doc.retentionRate / 100;
    wsDocs.getCell(`J${docRowOffset}`).numFmt = '0%';
    wsDocs.getCell(`J${docRowOffset}`).alignment = { horizontal: 'right' };

    wsDocs.getCell(`K${docRowOffset}`).value = doc.retentionAmount;
    wsDocs.getCell(`K${docRowOffset}`).numFmt = CurrencyFormat;
    wsDocs.getCell(`K${docRowOffset}`).alignment = { horizontal: 'right' };

    wsDocs.getCell(`L${docRowOffset}`).value = doc.totalAmount;
    wsDocs.getCell(`L${docRowOffset}`).numFmt = CurrencyFormat;
    wsDocs.getCell(`L${docRowOffset}`).alignment = { horizontal: 'right' };

    wsDocs.getCell(`M${docRowOffset}`).value = doc.notes || '';

    styleDataRow(wsDocs, docRowOffset, 'A', 'M', index % 2 === 1);
    docRowOffset += 1;
  });

  // Totales de Documentos
  const docLen = docsInScope.length;
  wsDocs.getCell(`A${docRowOffset}`).value = 'TOTAL EXPENDIOS AUDITADOS';
  wsDocs.mergeCells(`A${docRowOffset}:F${docRowOffset}`);
  
  // Fórmulas de Excel para autosuma
  wsDocs.getCell(`G${docRowOffset}`).value = { formula: `=SUM(G5:G${docRowOffset - 1})` };
  wsDocs.getCell(`G${docRowOffset}`).numFmt = CurrencyFormat;
  wsDocs.getCell(`G${docRowOffset}`).alignment = { horizontal: 'right' };

  wsDocs.getCell(`I${docRowOffset}`).value = { formula: `=SUM(I5:I${docRowOffset - 1})` };
  wsDocs.getCell(`I${docRowOffset}`).numFmt = CurrencyFormat;
  wsDocs.getCell(`I${docRowOffset}`).alignment = { horizontal: 'right' };

  wsDocs.getCell(`K${docRowOffset}`).value = { formula: `=SUM(K5:K${docRowOffset - 1})` };
  wsDocs.getCell(`K${docRowOffset}`).numFmt = CurrencyFormat;
  wsDocs.getCell(`K${docRowOffset}`).alignment = { horizontal: 'right' };

  wsDocs.getCell(`L${docRowOffset}`).value = { formula: `=SUM(L5:L${docRowOffset - 1})` };
  wsDocs.getCell(`L${docRowOffset}`).numFmt = CurrencyFormat;
  wsDocs.getCell(`L${docRowOffset}`).alignment = { horizontal: 'right' };

  styleTotalsRow(wsDocs, docRowOffset, 'A', 'M');


  // ==========================================
  // SHEET 3: 📦 DETALLE DE PARTIDAS
  // ==========================================
  const wsItems = workbook.addWorksheet('📦 Detalle de Partidas');
  wsItems.views = [{ showGridLines: true }];

  // Title Block
  wsItems.getCell('A1').value = 'DETALLE INDIVIDUAL DE PRODUCTOS, RECURSOS Y MATERIALES';
  wsItems.getCell('A1').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF047857' } };
  wsItems.getCell('A2').value = `Desglose de partidas de compra de suministros correspondientes a la selección de obra`;
  wsItems.getCell('A2').font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF555555' } };

  // Headers
  const itemHeaders = [
    'Nº Factura / Albarán',
    'Proveedor',
    'Material / Concepto',
    'Cantidad',
    'Unidad',
    'Precio Unitario (€)',
    'Subtotal Neto (€)'
  ];

  itemHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + i);
    wsItems.getCell(`${colLetter}4`).value = h;
  });
  styleHeaderRow(wsItems, 4, 'A', 'G', 'FF334155');
  wsItems.getRow(4).height = 24;

  let itemRowOffset = 5;
  docsInScope.forEach((doc, docIndex) => {
    (doc.items || []).forEach((item, itemIndex) => {
      wsItems.getCell(`A${itemRowOffset}`).value = doc.docNumber;
      wsItems.getCell(`B${itemRowOffset}`).value = doc.supplier;
      wsItems.getCell(`C${itemRowOffset}`).value = item.name;
      
      wsItems.getCell(`D${itemRowOffset}`).value = item.quantity;
      wsItems.getCell(`D${itemRowOffset}`).numFmt = '#,##0.00';
      wsItems.getCell(`D${itemRowOffset}`).alignment = { horizontal: 'right' };

      wsItems.getCell(`E${itemRowOffset}`).value = item.unit;
      wsItems.getCell(`E${itemRowOffset}`).alignment = { horizontal: 'center' };

      wsItems.getCell(`F${itemRowOffset}`).value = item.price;
      wsItems.getCell(`F${itemRowOffset}`).numFmt = CurrencyFormat;
      wsItems.getCell(`F${itemRowOffset}`).alignment = { horizontal: 'right' };

      wsItems.getCell(`G${itemRowOffset}`).value = item.total;
      wsItems.getCell(`G${itemRowOffset}`).numFmt = CurrencyFormat;
      wsItems.getCell(`G${itemRowOffset}`).alignment = { horizontal: 'right' };

      styleDataRow(wsItems, itemRowOffset, 'A', 'G', itemRowOffset % 2 === 1);
      itemRowOffset += 1;
    });
  });

  // Totales
  wsItems.getCell(`A${itemRowOffset}`).value = 'SUMATORIO DE PARTIDAS ANALIZADAS';
  wsItems.mergeCells(`A${itemRowOffset}:F${itemRowOffset}`);
  wsItems.getCell(`G${itemRowOffset}`).value = { formula: `=SUM(G5:G${itemRowOffset - 1})` };
  wsItems.getCell(`G${itemRowOffset}`).numFmt = CurrencyFormat;
  wsItems.getCell(`G${itemRowOffset}`).alignment = { horizontal: 'right' };
  styleTotalsRow(wsItems, itemRowOffset, 'A', 'G');


  // ==========================================
  // SHEET 4: 👷 CONTROL DE PERSONAL
  // ==========================================
  const wsPers = workbook.addWorksheet('👷 Control de Personal');
  wsPers.views = [{ showGridLines: true }];

  // Title Block
  wsPers.getCell('A1').value = 'UNIPROYECT ── AUDITORÍA DE REGISTROS DE PERSONAL';
  wsPers.getCell('A1').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF047857' } };
  wsPers.getCell('A2').value = `Consolidación de horas de peonaje, oficiales y mandos por fecha y pro-rata`;
  wsPers.getCell('A2').font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF555555' } };

  const persHeaders = [
    'ID Registro',
    'Obra / Proyecto',
    'Operario',
    'Fecha Jornada',
    'Especialidad / Puesto',
    'Horas Trabajadas',
    'Precio por Hora (€)',
    'Coste Total (€)',
    'Descripción / Notas'
  ];

  persHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + i);
    wsPers.getCell(`${colLetter}4`).value = h;
  });
  styleHeaderRow(wsPers, 4, 'A', 'I', 'FF047857');
  wsDocs.getRow(4).height = 24;

  let persRowOffset = 5;
  personalInScope.forEach((p, index) => {
    const obraLabel = obras.find(o => o.id === p.obraId)?.name || 'Sin asignar';

    wsPers.getCell(`A${persRowOffset}`).value = p.id;
    wsPers.getCell(`B${persRowOffset}`).value = obraLabel;
    wsPers.getCell(`C${persRowOffset}`).value = p.workerName;
    wsPers.getCell(`D${persRowOffset}`).value = p.date;
    wsPers.getCell(`D${persRowOffset}`).alignment = { horizontal: 'center' };
    wsPers.getCell(`E${persRowOffset}`).value = p.role;
    
    wsPers.getCell(`F${persRowOffset}`).value = p.hours;
    wsPers.getCell(`F${persRowOffset}`).numFmt = '#,##0.0';
    wsPers.getCell(`F${persRowOffset}`).alignment = { horizontal: 'right' };

    wsPers.getCell(`G${persRowOffset}`).value = p.hourlyRate;
    wsPers.getCell(`G${persRowOffset}`).numFmt = CurrencyFormat;
    wsPers.getCell(`G${persRowOffset}`).alignment = { horizontal: 'right' };

    wsPers.getCell(`H${persRowOffset}`).value = p.totalCost;
    wsPers.getCell(`H${persRowOffset}`).numFmt = CurrencyFormat;
    wsPers.getCell(`H${persRowOffset}`).alignment = { horizontal: 'right' };

    let noteText = p.notes || '';
    if ((p as any).hasProration) {
      const prorationNote = `[Prorrateado: ${((p as any).prorationFactor * 100).toFixed(1)}% del sueldo base de ${(p as any).originalTotalCost.toFixed(2)} € por ${(p as any).overlapDays}/${(p as any).totalDays} días]`;
      noteText = noteText ? `${noteText} ${prorationNote}` : prorationNote;
    }
    wsPers.getCell(`I${persRowOffset}`).value = noteText;

    styleDataRow(wsPers, persRowOffset, 'A', 'I', index % 2 === 1);
    persRowOffset += 1;
  });

  // Totales
  wsPers.getCell(`A${persRowOffset}`).value = 'TOTAL JORNADAS AUDITADAS';
  wsPers.mergeCells(`A${persRowOffset}:E${persRowOffset}`);

  wsPers.getCell(`F${persRowOffset}`).value = { formula: `=SUM(F5:F${persRowOffset - 1})` };
  wsPers.getCell(`F${persRowOffset}`).numFmt = '#,##0.0';
  wsPers.getCell(`F${persRowOffset}`).alignment = { horizontal: 'right' };

  wsPers.getCell(`H${persRowOffset}`).value = { formula: `=SUM(H5:H${persRowOffset - 1})` };
  wsPers.getCell(`H${persRowOffset}`).numFmt = CurrencyFormat;
  wsPers.getCell(`H${persRowOffset}`).alignment = { horizontal: 'right' };

  styleTotalsRow(wsPers, persRowOffset, 'A', 'I');


  // ==========================================
  // SHEET 5: 🏢 GASTOS INDIRECTOS Y OVERHEAD
  // ==========================================
  const wsOver = workbook.addWorksheet('🏢 Gastos Indirectos');
  wsOver.views = [{ showGridLines: true }];

  wsOver.getCell('A1').value = 'UNIPROYECT ── TRANSPORTE, SEGUROS Y GASTOS GENERALES';
  wsOver.getCell('A1').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF047857' } };
  
  const overheadSubtitle = isAll 
    ? 'Control analítico consolidado de Overhead / Estructura del período contable'
    : `Deducción e imputación analítica de la Obra: ${obraSelected.name} ── Ratio Adjudicada: ${(ratioPrerata*100).toFixed(2)}%`;
  wsOver.getCell('A2').value = overheadSubtitle;
  wsOver.getCell('A2').font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF555555' } };

  const overHeaders = [
    'ID Gasto',
    'Categoría / Concepto',
    'Descripción Operación',
    'Fecha Registro',
    'Importe Total Empresa (€)',
    'Proporcionalidad Repercutida',
    'Importe Repercutido Obra (€)',
    'Notas'
  ];

  overHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + i);
    wsOver.getCell(`${colLetter}4`).value = h;
  });
  styleHeaderRow(wsOver, 4, 'A', 'H', 'FF334155');
  wsOver.getRow(4).height = 24;

  let overRowOffset = 5;
  const combinedOverHead = [
    ...gastosGenerales.map(g => ({
      id: g.id,
      category: g.category,
      description: g.description,
      date: g.date,
      amount: g.amount,
      notes: g.notes || ''
    })),
    ...structuralPersonal.map(p => {
      let notesText = p.notes || '';
      if ((p as any).hasProration) {
        const prorationNote = `[Prorrateado: ${((p as any).prorationFactor * 100).toFixed(1)}% del sueldo base de ${(p as any).originalTotalCost.toFixed(2)} € por ${(p as any).overlapDays}/${(p as any).totalDays} días]`;
        notesText = notesText ? `${notesText} ${prorationNote}` : prorationNote;
      }
      return {
        id: p.id,
        category: 'Personal de Oficina/Estructura',
        description: `${p.workerName} (${p.role})`,
        date: p.date,
        amount: p.totalCost,
        notes: notesText
      };
    })
  ];

  combinedOverHead.forEach((g, index) => {
    const proratedRowGasto = isAll ? g.amount : (ratioPrerata * g.amount);

    wsOver.getCell(`A${overRowOffset}`).value = g.id;
    wsOver.getCell(`B${overRowOffset}`).value = g.category;
    wsOver.getCell(`C${overRowOffset}`).value = g.description;
    
    wsOver.getCell(`D${overRowOffset}`).value = g.date;
    wsOver.getCell(`D${overRowOffset}`).alignment = { horizontal: 'center' };

    wsOver.getCell(`E${overRowOffset}`).value = g.amount;
    wsOver.getCell(`E${overRowOffset}`).numFmt = CurrencyFormat;
    wsOver.getCell(`E${overRowOffset}`).alignment = { horizontal: 'right' };

    wsOver.getCell(`F${overRowOffset}`).value = isAll ? 1.0 : ratioPrerata;
    wsOver.getCell(`F${overRowOffset}`).numFmt = PercentFormat;
    wsOver.getCell(`F${overRowOffset}`).alignment = { horizontal: 'right' };

    wsOver.getCell(`G${overRowOffset}`).value = proratedRowGasto;
    wsOver.getCell(`G${overRowOffset}`).numFmt = CurrencyFormat;
    wsOver.getCell(`G${overRowOffset}`).alignment = { horizontal: 'right' };

    wsOver.getCell(`H${overRowOffset}`).value = g.notes || '';

    styleDataRow(wsOver, overRowOffset, 'A', 'H', index % 2 === 1);
    overRowOffset += 1;
  });

  // Totales
  wsOver.getCell(`A${overRowOffset}`).value = 'SUMA TOTAL OVERHEAD / SEGUROS';
  wsOver.mergeCells(`A${overRowOffset}:D${overRowOffset}`);

  wsOver.getCell(`E${overRowOffset}`).value = { formula: `=SUM(E5:E${overRowOffset - 1})` };
  wsOver.getCell(`E${overRowOffset}`).numFmt = CurrencyFormat;
  wsOver.getCell(`E${overRowOffset}`).alignment = { horizontal: 'right' };

  wsOver.getCell(`G${overRowOffset}`).value = { formula: `=SUM(G5:G${overRowOffset - 1})` };
  wsOver.getCell(`G${overRowOffset}`).numFmt = CurrencyFormat;
  wsOver.getCell(`G${overRowOffset}`).alignment = { horizontal: 'right' };

  styleTotalsRow(wsOver, overRowOffset, 'A', 'H');


  // ==========================================
  // PROPAGACIÓN DE ANCHO AUTOMÁTICO DE COLUMNAS
  // ==========================================
  // Hacemos que todas las columnas de la hoja 2 a 5 se auto-dimensionen de acuerdo al tamaño de su contenido
  const detailSheets = [wsDocs, wsItems, wsPers, wsOver];
  detailSheets.forEach(ws => {
    ws.columns.forEach(column => {
      let maxLen = 0;
      column.eachCell!({ includeEmpty: true }, cell => {
        let textVal = '';
        if (cell.value) {
          if (typeof cell.value === 'object' && 'formula' in cell.value) {
            // Saltamos celdas con fórmulas matemáticas para evitar [object Object]
            textVal = 'TOTAL GENERAL EXCEL';
          } else {
            textVal = cell.value.toString();
          }
        }
        const cellLength = textVal.length;
        if (cellLength > maxLen) {
          maxLen = cellLength;
        }
      });
      // Dejamos un margen confortable de 3.5 caracteres
      column.width = Math.max(maxLen + 3.5, 11);
    });
  });

  // Devolvemos el búfer binario en formato de Blob descargable
  const buffer = await workbook.xlsx.writeBuffer();
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return fileBlob;
}

/**
 * Genera y descarga un listado formateado en Excel (.xlsx) de los documentos filtrados en la pestaña Facturación.
 */
export async function exportDocsListToExcel(
  docs: FacturaAlbaran[],
  obras: Obra[]
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'UniProyect OS';
  workbook.lastModifiedBy = 'UniProyect OS';
  workbook.created = new Date();

  const CurrencyFormat = '#,##0.00" €";[Red]-#,##0.00" €";0.00" €"';

  const ws = workbook.addWorksheet('Lista de Documentos', {
    views: [{ showGridLines: true }]
  });

  // Title Block
  ws.getCell('A1').value = 'UNIPROYECT ── EXPORTACIÓN DE FACTURAS Y ALBARANES';
  ws.getCell('A1').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF047857' } };
  
  ws.getCell('A2').value = `Total registros emitidos: ${docs.length} unidades ── Generado el ${new Date().toLocaleString('es-ES')}`;
  ws.getCell('A2').font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF555555' } };

  // Headers
  const headers = [
    'ID Documento',
    'Obra / Proyecto',
    'Tipo Documento',
    'Número Documento',
    'Fecha Registro',
    'Proveedor / Emisor',
    'Base Imponible (€)',
    'Tipo de IVA (%)',
    'Cuota IVA (€)',
    'Suma Retención (%)',
    'Cuota Retención (€)',
    'Total Líquido Soportado (€)',
    'Estado de Pago',
    'Comentarios/Detalle'
  ];

  headers.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + i);
    ws.getCell(`${colLetter}4`).value = h;
  });
  styleHeaderRow(ws, 4, 'A', 'N', 'FF047857');
  ws.getRow(4).height = 24;

  let rowOffset = 5;
  docs.forEach((doc, index) => {
    const obra = obras.find(o => o.id === doc.obraId);
    const obraName = obra ? obra.name : 'Sin asignar';

    ws.getCell(`A${rowOffset}`).value = doc.id;
    ws.getCell(`B${rowOffset}`).value = obraName;
    ws.getCell(`C${rowOffset}`).value = doc.type === 'factura' ? 'Factura' : 'Albarán';
    ws.getCell(`C${rowOffset}`).alignment = { horizontal: 'center' };
    ws.getCell(`D${rowOffset}`).value = doc.docNumber;
    ws.getCell(`E${rowOffset}`).value = doc.date;
    ws.getCell(`E${rowOffset}`).alignment = { horizontal: 'center' };
    ws.getCell(`F${rowOffset}`).value = doc.supplier;

    ws.getCell(`G${rowOffset}`).value = doc.baseAmount;
    ws.getCell(`G${rowOffset}`).numFmt = CurrencyFormat;
    ws.getCell(`G${rowOffset}`).alignment = { horizontal: 'right' };

    ws.getCell(`H${rowOffset}`).value = doc.ivaRate / 100;
    ws.getCell(`H${rowOffset}`).numFmt = '0%';
    ws.getCell(`H${rowOffset}`).alignment = { horizontal: 'right' };

    ws.getCell(`I${rowOffset}`).value = doc.ivaAmount;
    ws.getCell(`I${rowOffset}`).numFmt = CurrencyFormat;
    ws.getCell(`I${rowOffset}`).alignment = { horizontal: 'right' };

    ws.getCell(`J${rowOffset}`).value = doc.retentionRate / 100;
    ws.getCell(`J${rowOffset}`).numFmt = '0%';
    ws.getCell(`J${rowOffset}`).alignment = { horizontal: 'right' };

    ws.getCell(`K${rowOffset}`).value = doc.retentionAmount;
    ws.getCell(`K${rowOffset}`).numFmt = CurrencyFormat;
    ws.getCell(`K${rowOffset}`).alignment = { horizontal: 'right' };

    ws.getCell(`L${rowOffset}`).value = doc.totalAmount;
    ws.getCell(`L${rowOffset}`).numFmt = CurrencyFormat;
    ws.getCell(`L${rowOffset}`).alignment = { horizontal: 'right' };

    ws.getCell(`M${rowOffset}`).value = doc.status === 'paid' ? 'Pagado' : doc.status === 'draft' ? 'Borrador' : 'Pendiente';
    ws.getCell(`M${rowOffset}`).alignment = { horizontal: 'center' };
    ws.getCell(`N${rowOffset}`).value = doc.notes || '';

    styleDataRow(ws, rowOffset, 'A', 'N', index % 2 === 1);
    rowOffset += 1;
  });

  // Totales
  ws.getCell(`A${rowOffset}`).value = 'SUMATORIO DE AUDITORÍA';
  ws.mergeCells(`A${rowOffset}:F${rowOffset}`);

  ws.getCell(`G${rowOffset}`).value = { formula: `=SUM(G5:G${rowOffset - 1})` };
  ws.getCell(`G${rowOffset}`).numFmt = CurrencyFormat;
  ws.getCell(`G${rowOffset}`).alignment = { horizontal: 'right' };

  ws.getCell(`I${rowOffset}`).value = { formula: `=SUM(I5:I${rowOffset - 1})` };
  ws.getCell(`I${rowOffset}`).numFmt = CurrencyFormat;
  ws.getCell(`I${rowOffset}`).alignment = { horizontal: 'right' };

  ws.getCell(`K${rowOffset}`).value = { formula: `=SUM(K5:K${rowOffset - 1})` };
  ws.getCell(`K${rowOffset}`).numFmt = CurrencyFormat;
  ws.getCell(`K${rowOffset}`).alignment = { horizontal: 'right' };

  ws.getCell(`L${rowOffset}`).value = { formula: `=SUM(L5:L${rowOffset - 1})` };
  ws.getCell(`L${rowOffset}`).numFmt = CurrencyFormat;
  ws.getCell(`L${rowOffset}`).alignment = { horizontal: 'right' };

  styleTotalsRow(ws, rowOffset, 'A', 'N');

  // Auto column-widths
  ws.columns.forEach(column => {
    let maxLen = 0;
    column.eachCell!({ includeEmpty: true }, cell => {
      let textVal = '';
      if (cell.value) {
        if (typeof cell.value === 'object' && 'formula' in cell.value) {
          textVal = 'SUMATORIO DE AUDITORÍA';
        } else {
          textVal = cell.value.toString();
        }
      }
      const cellLength = textVal.length;
      if (cellLength > maxLen) {
        maxLen = cellLength;
      }
    });
    column.width = Math.max(maxLen + 3.5, 11);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return fileBlob;
}
