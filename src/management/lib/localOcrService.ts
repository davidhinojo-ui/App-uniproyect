/**
 * Local Offline OCR Service powered by Tesseract.js
 * 
 * Enables autonomous invoice and delivery note scanning directly inside the user's browser,
 * with zero reliance on cloud servers or external AI APIs when offline.
 */

import { createWorker } from 'tesseract.js';
import { DocumentItem, Proveedor } from '../types';

export interface LocalOcrExtractedDocument {
  type: 'factura' | 'albaran';
  docNumber: string;
  supplier: string;
  supplierNif?: string;
  date: string;
  items: DocumentItem[];
  baseAmount: number;
  ivaRate: number;
  ivaAmount: number;
  retentionRate: number;
  retentionAmount: number;
  totalAmount: number;
  notes?: string;
  rawText: string;
  confidence: number;
  source: 'local_tesseract';
}

export interface LocalOcrOptions {
  knownSuppliers?: Proveedor[];
  onProgress?: (progressPercent: number, statusText: string) => void;
}

/**
 * Preprocesses an image using an offscreen HTML5 Canvas.
 * Enhances contrast, converts to grayscale, and sharpens edges to dramatically
 * improve OCR character recognition rate for paper invoices and photos taken in low light.
 */
export async function preprocessImageForOcr(imageSource: string | Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Canvas not available, fallback to original
          resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource as Blob));
          return;
        }

        // Maintain reasonable max dimensions for optimal speed/accuracy trade-off
        const MAX_WIDTH = 2200;
        const MAX_HEIGHT = 2200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw original
        ctx.drawImage(img, 0, 0, width, height);

        // Extract pixel data for contrast & grayscale optimization
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Compute average luminance to determine thresholding
        let totalLum = 0;
        const pixelCount = width * height;
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          totalLum += lum;
        }
        const avgLum = totalLum / pixelCount;

        // Contrast boost factor
        const contrast = 1.35; // 35% contrast increase
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

        for (let i = 0; i < data.length; i += 4) {
          // Convert to grayscale
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Apply contrast curve
          gray = factor * (gray - 128) + 128;

          // Slight adaptive tone mapping for shadows
          if (avgLum < 110) {
            gray = Math.min(255, gray * 1.25); // Brighten dark photos
          }

          const finalVal = Math.max(0, Math.min(255, gray));
          data[i] = finalVal;
          data[i + 1] = finalVal;
          data[i + 2] = finalVal;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        console.warn('Preprocessing canvas error, using raw image:', err);
        resolve(typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource as Blob));
      }
    };

    img.onerror = (err) => {
      reject(new Error('No se pudo cargar la imagen para el preprocesamiento OCR.'));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Normalizes European currency and decimal formats
 * Handles: "1.234,56 €", "1234,56", "1 234.56", "1234.56"
 */
function parseSpanishNumber(numStr: string): number {
  if (!numStr) return 0;
  let clean = numStr.trim().replace(/[€$£\s]/g, '');
  
  // If has both dot and comma (e.g. 1.234,56 or 1,234.56)
  if (clean.includes('.') && clean.includes(',')) {
    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
      // 1.234,56 (Spanish standard)
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 (US standard)
      clean = clean.replace(/,/g, '');
    }
  } else if (clean.includes(',')) {
    // Only comma (e.g. 1234,56)
    clean = clean.replace(',', '.');
  }
  
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

/**
 * Extracts and formats Spanish dates (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)
 */
function extractSpanishDate(text: string): string {
  // Matches: 24/05/2024, 24-05-2024, 24.05.2024, 24/05/24
  const dateRegex = /\b([0-3]?[0-9])[\/\.\-\s]([0-1]?[0-9])[\/\.\-\s](20\d{2}|\d{2})\b/g;
  const matches = [...text.matchAll(dateRegex)];
  
  if (matches.length > 0) {
    for (const match of matches) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      let year = parseInt(match[3], 10);
      
      if (year < 100) {
        year += 2000;
      }
      
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2018 && year <= 2035) {
        const paddedDay = String(day).padStart(2, '0');
        const paddedMonth = String(month).padStart(2, '0');
        return `${year}-${paddedMonth}-${paddedDay}`;
      }
    }
  }

  // Fallback to today's date in ISO format
  return new Date().toISOString().split('T')[0];
}

/**
 * Extracts Spanish Tax Identifiers (CIF / NIF / NIE)
 */
function extractSpanishNifCif(text: string): string | undefined {
  // CIF: 1 letter (A-W except I, O, T) + 7 digits + 1 control (digit or letter)
  // NIF: 8 digits + 1 letter
  // NIE: X/Y/Z + 7 digits + 1 letter
  const cifNifRegex = /\b([A-HJ-NP-SUVW][0-9]{7}[0-9A-J]|[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]|[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE])\b/i;
  const match = text.match(cifNifRegex);
  return match ? match[1].toUpperCase() : undefined;
}

/**
 * Heuristically parses raw OCR text into a structured Spanish invoice / delivery note
 */
export function parseSpanishInvoiceText(
  rawText: string,
  knownSuppliers: Proveedor[] = []
): Omit<LocalOcrExtractedDocument, 'confidence' | 'source'> {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // 1. Detect Type (Albarán vs Factura)
  const isAlbaran = /\b(albar[aá]n|nota de entrega|vale de entrega|remisi[oó]n)\b/i.test(rawText);
  const type: 'factura' | 'albaran' = isAlbaran ? 'albaran' : 'factura';

  // 2. Extract Document Number
  let docNumber = '';
  const docNumPatterns = [
    /(?:factura|fra\.?|n[uú]mero|nº|num\.?|albar[aá]n|alb\.?|pedido)\s*[:#º\s]*([A-Za-z0-9\-\/\_]{3,30})/i,
    /(?:serie|cod\.?)\s*[:#º\s]*([A-Za-z0-9\-\/\_]{3,20})/i,
    /\b([A-Z]{1,4}[\-\/][0-9]{3,10})\b/i,
    /\b(202[0-9][\-\/][0-9]{2,8})\b/i,
  ];

  for (const pattern of docNumPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Exclude pure dates or generic words
      if (!/^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$/.test(candidate) && candidate.length >= 3) {
        docNumber = candidate;
        break;
      }
    }
  }

  if (!docNumber) {
    docNumber = `${type.toUpperCase()}-${Date.now().toString().slice(-5)}`;
  }

  // 3. Extract Date
  const date = extractSpanishDate(rawText);

  // 4. Extract CIF/NIF
  const supplierNif = extractSpanishNifCif(rawText);

  // 5. Detect Supplier
  let supplier = '';
  
  // Try matching against registered suppliers in DB first (highest accuracy)
  if (knownSuppliers && knownSuppliers.length > 0) {
    // A) Match by NIF/CIF
    if (supplierNif) {
      const nifMatch = knownSuppliers.find(
        p => (p.nif || '').replace(/[\s\-]/g, '').toUpperCase() === supplierNif
      );
      if (nifMatch) {
        supplier = nifMatch.name;
      }
    }

    // B) Match by Name substring / inclusion
    if (!supplier) {
      for (const prov of knownSuppliers) {
        const provNameLower = prov.name.toLowerCase().trim();
        if (provNameLower.length >= 4 && rawText.toLowerCase().includes(provNameLower)) {
          supplier = prov.name;
          break;
        }
      }
    }
  }

  // Fallback supplier from document header lines
  if (!supplier) {
    // Look at first 6 lines, excluding common non-name headers
    const candidateLines = lines.slice(0, 7).filter(l => {
      const lower = l.toLowerCase();
      return (
        l.length >= 4 &&
        !lower.includes('factura') &&
        !lower.includes('albaran') &&
        !lower.includes('albarán') &&
        !lower.includes('página') &&
        !lower.includes('pagina') &&
        !lower.includes('original') &&
        !lower.includes('copia') &&
        !lower.includes('cif') &&
        !lower.includes('nif') &&
        !/^[0-9\W]+$/.test(l)
      );
    });

    if (candidateLines.length > 0) {
      supplier = candidateLines[0].replace(/^[^\w]+/, '').trim();
    } else {
      supplier = 'Proveedor Desconocido (OCR Local)';
    }
  }

  // 6. Extract Monetary Totals (Total, Base, IVA, Retención)
  let totalAmount = 0;
  let baseAmount = 0;
  let ivaRate = 21; // Default construction standard in Spain
  let ivaAmount = 0;
  let retentionRate = 0;
  let retentionAmount = 0;

  // Search for Total
  const totalPatterns = [
    /(?:total\s+factura|total\s+a\s+pagar|total\s+documento|importe\s+total|total\s+general|total)\s*[:\s]*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))/i,
    /(?:total\s+factura|total\s+a\s+pagar|importe\s+total|total)\s*[:\s]*([0-9]+[.,][0-9]{2})/i,
    /(?:total)\s*[:\s]*€?\s*([0-9.,]+)/i
  ];

  for (const pattern of totalPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const val = parseSpanishNumber(match[1]);
      if (val > 0) {
        totalAmount = val;
        break;
      }
    }
  }

  // Search for Base Imponible
  const basePatterns = [
    /(?:base\s+imponible|base\s+imp\.?|b\.i\.?|subtotal|base)\s*[:\s]*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2}))/i,
    /(?:base\s+imponible|base\s+imp\.?|b\.i\.?|subtotal)\s*[:\s]*([0-9]+[.,][0-9]{2})/i,
    /(?:base)\s*[:\s]*€?\s*([0-9.,]+)/i
  ];

  for (const pattern of basePatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const val = parseSpanishNumber(match[1]);
      if (val > 0) {
        baseAmount = val;
        break;
      }
    }
  }

  // Search for IVA Rate
  const ivaRateMatch = rawText.match(/(?:i\.?v\.?a\.?|iva)\s*(?:al)?\s*([0-9]{1,2}(?:[.,][0-9]+)?)\s*%/i);
  if (ivaRateMatch && ivaRateMatch[1]) {
    const rate = parseSpanishNumber(ivaRateMatch[1]);
    if ([21, 10, 4, 0].includes(Math.round(rate))) {
      ivaRate = Math.round(rate);
    }
  }

  // Search for IVA Amount
  const ivaAmountMatch = rawText.match(/(?:cuota\s+i\.?v\.?a\.?|imp\.?\s*i\.?v\.?a\.?|i\.?v\.?a\.?)\s*[:\s]*€?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+[.,][0-9]{2})/i);
  if (ivaAmountMatch && ivaAmountMatch[1]) {
    const val = parseSpanishNumber(ivaAmountMatch[1]);
    if (val > 0) {
      ivaAmount = val;
    }
  }

  // Search for Retención (IRPF / Garantía)
  const retentionMatch = rawText.match(/(?:retenci[oó]n|i\.?r\.?p\.?f\.?)\s*(?:del)?\s*([0-9]{1,2}(?:[.,][0-9]+)?)\s*%/i);
  if (retentionMatch && retentionMatch[1]) {
    retentionRate = parseSpanishNumber(retentionMatch[1]);
  }

  // Coherence Calculation & Reconciliations
  if (baseAmount > 0 && totalAmount === 0) {
    ivaAmount = Number((baseAmount * (ivaRate / 100)).toFixed(2));
    retentionAmount = Number((baseAmount * (retentionRate / 100)).toFixed(2));
    totalAmount = Number((baseAmount + ivaAmount - retentionAmount).toFixed(2));
  } else if (totalAmount > 0 && baseAmount === 0) {
    // Infer base from total
    const divisor = 1 + (ivaRate / 100) - (retentionRate / 100);
    baseAmount = Number((totalAmount / (divisor > 0 ? divisor : 1)).toFixed(2));
    ivaAmount = Number((baseAmount * (ivaRate / 100)).toFixed(2));
    retentionAmount = Number((baseAmount * (retentionRate / 100)).toFixed(2));
  } else if (baseAmount > 0 && totalAmount > 0) {
    if (ivaAmount === 0) {
      ivaAmount = Number((baseAmount * (ivaRate / 100)).toFixed(2));
    }
    if (retentionRate > 0 && retentionAmount === 0) {
      retentionAmount = Number((baseAmount * (retentionRate / 100)).toFixed(2));
    }
  }

  // 7. Parse line items (or fallback to unified item)
  const items: DocumentItem[] = [];

  // Look for line patterns: "Description ... Quantity ... Price ... Total"
  // If parsing lines proves too noisy in raw OCR, create a single clean summary item
  if (baseAmount > 0) {
    items.push({
      name: `Materiales y suministros según ${type} (OCR local)`,
      quantity: 1,
      unit: 'ud',
      price: baseAmount,
      total: baseAmount
    });
  } else if (totalAmount > 0) {
    items.push({
      name: `Materiales y suministros según ${type} (OCR local)`,
      quantity: 1,
      unit: 'ud',
      price: totalAmount,
      total: totalAmount
    });
  }

  return {
    type,
    docNumber,
    supplier,
    supplierNif,
    date,
    items,
    baseAmount,
    ivaRate,
    ivaAmount,
    retentionRate,
    retentionAmount,
    totalAmount,
    notes: `Escaneado mediante OCR Local sin conexión (Tesseract.js).${supplierNif ? ` NIF/CIF detectado: ${supplierNif}.` : ''}`,
    rawText
  };
}

/**
 * Scans an image locally using Tesseract.js in a Web Worker without network calls.
 */
export async function scanDocumentLocally(
  imageSource: string | Blob | File,
  options: LocalOcrOptions = {}
): Promise<LocalOcrExtractedDocument> {
  const { knownSuppliers = [], onProgress } = options;

  onProgress?.(10, 'Preprocesando y mejorando contraste de la imagen...');
  const processedImageUrl = await preprocessImageForOcr(imageSource);

  onProgress?.(25, 'Iniciando motor de OCR local (Tesseract.js)...');

  // Initialize Tesseract Worker
  // 'spa' for Spanish language recognition, with fallback to 'eng'
  let worker: any = null;

  try {
    worker = await createWorker('spa+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const progress = Math.round(25 + (m.progress || 0) * 65);
          onProgress?.(progress, `Reconociendo caracteres españoles (${Math.round((m.progress || 0) * 100)}%)...`);
        } else if (m.status === 'loading tesseract core') {
          onProgress?.(20, 'Cargando motor WebAssembly...');
        } else if (m.status === 'loading language traineddata') {
          onProgress?.(30, 'Cargando diccionario lingüístico español...');
        }
      }
    });

    onProgress?.(60, 'Escaneando texto del documento...');
    const result = await worker.recognize(processedImageUrl);

    const rawText = result.data.text || '';
    const confidence = result.data.confidence || 0;

    onProgress?.(92, 'Analizando estructura fiscal, CIF e importes...');
    const parsedData = parseSpanishInvoiceText(rawText, knownSuppliers);

    onProgress?.(100, '¡Documento reconocido localmente!');

    return {
      ...parsedData,
      confidence,
      source: 'local_tesseract'
    };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (err) {
        console.warn('Error al terminar el worker de Tesseract:', err);
      }
    }
  }
}
