/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import {
  workersDb,
  projectsDb,
  timeRecordsDb,
  auditLogsDb,
  handleCreateInvitation,
  handleVerifyInvitation,
  handleActivateWorker,
  handleWorkerLogin,
  handleRevokeWorker,
  handleTimeRecord,
  handleGetWorkerTimeRecords,
  handleGetWorkerDocuments,
  handleSignDocument,
  handleGetWorkerProjects,
  recordAuditLog,
} from './src/server/workerPortalService.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
// The compiled entry point always serves the production build.
const isProduction = process.env.NODE_ENV === 'production' || process.argv[1]?.endsWith('server.cjs');

// Increase payload limits to handle image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Lazy initialization for Gemini Client
let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Falta la variable de entorno GEMINI_API_KEY.');
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Helper function for calling Gemini with retry and fallback models
const generateContentWithRetry = async (contents: any, config: any) => {
  const ai = getGemini();
  // Use valid multimodal models with distinct quota pools
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-1.5-flash'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    // If a model is rate-limited (429), don't waste time retrying the same model repeatedly; switch immediately to the next model
    const maxAttemptsForModel = 2;

    for (let attempt = 1; attempt <= maxAttemptsForModel; attempt++) {
      try {
        console.log(`[IA] Procesando documento con ${modelName} (Intento ${attempt}/${maxAttemptsForModel})...`);
        const res = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });
        console.log(`[IA] Éxito al procesar documento con modelo: ${modelName}`);
        return res;
      } catch (error: any) {
        lastError = error;
        const status = error?.status || error?.code || 500;
        const message = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
        
        const isRateLimit = 
          status === 429 || 
          status === 'RESOURCE_EXHAUSTED' || 
          message.includes('429') || 
          message.includes('RESOURCE_EXHAUSTED') ||
          message.includes('Quota exceeded') ||
          message.includes('rate-limit') ||
          message.includes('free_tier_requests');

        const isServerError = 
          status === 503 || 
          status === 500 || 
          status === 'UNAVAILABLE' || 
          message.includes('503') || 
          message.includes('UNAVAILABLE') ||
          message.includes('high demand') ||
          message.includes('temporarily unavailable');

        console.warn(`[IA] Error en ${modelName} (intento ${attempt}): [${status}] ${message.slice(0, 160)}...`);

        if (isRateLimit) {
          // If rate limited, jumping immediately to next model gives the highest success rate because quotas are tracked per-model
          console.log(`[IA] Cuota alcanzada en ${modelName}. Cambiando inmediatamente al siguiente modelo de respaldo...`);
          break; // Exit attempts for this model and try next model
        } else if (isServerError && attempt < maxAttemptsForModel) {
          const delay = 1200 * attempt;
          console.log(`[IA] Error de servidor temporal. Reintentando en ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-transient or last attempt for this model
          break;
        }
      }
    }
  }
  throw lastError;
};

// API endpoint for document recognition using Gemini
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { base64Data, mimeType, filename } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Falta el archivo en formato Base64 o el mimeType.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Servidor no configurado: Falta la clave GEMINI_API_KEY en las variables de entorno.' 
      });
    }

    // Clean base64 pattern (in case it contains "data:image/png;base64,")
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

    const systemPrompt = `
      Eres un experto contable y administrativo de primer nivel especializado en el sector de la construcción y obras en España.
      Analiza el archivo adjunto (imagen o PDF de una o varias páginas).
      
      MUY IMPORTANTE: El archivo puede contener múltiples páginas y/o corresponder a VARIOS documentos contables distintos de forma consecutiva (por ejemplo, página 1 es un albarán de compra de hormigón y página 2 es una factura de suministros, o son distintas entregas/facturas del mismo o varios proveedores).
      Debes segmentar y extraer de forma inteligente todos los documentos independientes que logres identificar. Cada uno de ellos debe mapearse como un elemento individual dentro del array "documents".
      Si todo el archivo constituye un único documento (incluso si es multipágina), añade un único elemento al array "documents".

      Para asegurar un reconocimiento de datos impecable y evitar fallos de lectura, sigue estas instrucciones de tolerancia a fallos:
      1. 'type': Determina rigurosamente si es "factura" (oficial con IVA e importes definitivos) o "albaran" (remisión, nota de entrega, vale o documento sin desglose de impuestos definitivo). Por defecto, usa "factura".
      2. 'docNumber': Número de documento. Si el campo está borroso, manuscrito, falta o es indescifrable, NO devuelvas un error. Genera un identificador coherente, por ejemplo: un código secuencial basado en el proveedor o que comience con 'S/N-' seguido de la fecha, o un identificador aleatorio como 'IA-773821'.
      3. 'supplier': Razón social o nombre del emisor. Si no se puede determinar, usa el logotipo o indicios claros, o en su defecto "Proveedor No Identificado".
      4. 'date': Fecha en formato YYYY-MM-DD. Si no es descifrable, asume la fecha actual ("2026-06-10") o la que deduzcas del contexto.
      5. 'items': Lista detallada de productos/materiales. Cada línea debe tener descripción, cantidad (por defecto 1), unidad (m3, kg, ud, etc. por defecto "ud"), precio unitario y total. Si no hay desglose disponible de partidas, crea obligatoriamente una única partida consolidada con el concepto 'Suministros unificados en OCR por IA' cuyo valor 'total' equivalga a la base imponible total.
      6. 'baseAmount': Base imponible. Si no viene explícita pero tienes el totalAmount, calcúlala deduciendo el IVA (totalAmount / (1 + IVA/100)).
      7. 'ivaRate': IVA en porcentaje entero (ej: 21, 10, 4, 0). En España, por defecto asume 21 si no está claro.
      8. 'ivaAmount': Importe del IVA. Si no viene especificado, calcúlalo como baseAmount * (ivaRate / 100).
      9. 'retentionRate': Porcentaje de retención de garantía (frecuente en subcontratas, ej: 2 o 5) o IRPF si existiera, o 0 si no hay.
      10. 'retentionAmount': Importe deducido por retención. Calcúlalo como baseAmount * (retentionRate / 100).
      11. 'totalAmount': El importe final a pagar neto. Si no viene visible, calcúlalo como baseAmount + ivaAmount - retentionAmount.
      
      No omitas ningún campo obligatorio y calcula matemáticamente las relaciones si faltan cifras parciales. Provee siempre datos coherentes en formato numérico puro.
    `;

    const response = await generateContentWithRetry(
      {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: systemPrompt,
          },
        ],
      },
      {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { 
                    type: Type.STRING, 
                    description: 'Tipo de documento: "factura" o "albaran".' 
                  },
                  docNumber: { 
                    type: Type.STRING, 
                    description: 'Número identificativo. Si no existe o es ilegible, genera uno que comience con "S/N-" o "IA-".' 
                  },
                  supplier: { 
                    type: Type.STRING, 
                    description: 'Razón social del proveedor o emisor. Si no se puede leer, colocar "Proveedor no identificado".' 
                  },
                  date: { 
                    type: Type.STRING, 
                    description: 'Fecha de emisión en formato YYYY-MM-DD. Si no se lee, usar fecha actual por defecto.' 
                  },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: 'Descripción o concepto del material, producto o servicio.' },
                        quantity: { type: Type.NUMBER, description: 'Cantidad facturada, por defecto 1.' },
                        unit: { type: Type.STRING, description: 'Unidad de medida (ej: ud, m3, kg, l, h, etc., por defecto ud).' },
                        price: { type: Type.NUMBER, description: 'Precio unitario.' },
                        total: { type: Type.NUMBER, description: 'Importe de la línea (cantidad x precio).' },
                      },
                      required: ['name', 'total'],
                    },
                    description: 'Desglose detallado de los productos o servicios. Si falta, generar uno consolidado.',
                  },
                  baseAmount: { 
                    type: Type.NUMBER, 
                    description: 'Base imponible total antes de IVA.' 
                  },
                  ivaRate: { 
                    type: Type.NUMBER, 
                    description: 'Porcentaje de IVA en entero (ej. 21 para 21%).' 
                  },
                  ivaAmount: { 
                    type: Type.NUMBER, 
                    description: 'Importe resultante de la cuota de IVA.' 
                  },
                  retentionRate: { 
                    type: Type.NUMBER, 
                    description: 'Porcentaje de retención de obra o fianza (ej. 2 o 5), por defecto 0.' 
                  },
                  retentionAmount: { 
                    type: Type.NUMBER, 
                    description: 'Importe total de retención deducido, por defecto 0.' 
                  },
                  totalAmount: { 
                    type: Type.NUMBER, 
                    description: 'Importe total neto del documento.' 
                  },
                  notes: {
                    type: Type.STRING,
                    description: 'Comentarios adicionales o incidencias detectadas en la lectura.',
                  },
                },
                required: ['type', 'docNumber', 'supplier', 'date', 'baseAmount', 'totalAmount'],
              },
              description: 'Lista de facturas y albaranes identificados en el archivo subido.',
            },
          },
          required: ['documents'],
        },
      }
    );

    const resultText = response.text || '{"documents":[]}';
    const parsedResult = JSON.parse(resultText.trim());

    res.json(parsedResult);
  } catch (error: any) {
    console.error('Error al analizar documento con Gemini:', error);
    const msg = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
    const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('rate-limit');
    
    res.status(isRateLimit ? 429 : 500).json({ 
      error: isRateLimit
        ? 'Límite temporal de consultas IA alcanzado (Rate limit de la API). Por favor, espere 15-20 segundos antes de reintentar.'
        : 'Error al procesar el reconocimiento por IA: ' + (error.message || error),
    });
  }
});

// API endpoint for structural expenses (Gastos Estructurales / Indirectos) recognition using Gemini
app.post('/api/gemini/analyze-structural-expense', async (req, res) => {
  try {
    const { base64Data, mimeType, filename } = req.body;

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Falta el archivo en formato Base64 o el mimeType.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Servidor no configurado: Falta la clave GEMINI_API_KEY en las variables de entorno.' 
      });
    }

    // Clean base64 pattern (in case it contains "data:image/png;base64,")
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

    const structuralPrompt = `
      Eres un experto en contabilidad analítica, auditoría y control de costes para empresas de construcción en España (José Real Construcciones, S.L. / Uniproyect).
      Analiza el archivo adjunto (imagen o documento PDF de una o varias páginas) correspondiente a facturas, tickets, recibos, nóminas o pólizas de GASTOS ESTRUCTURALES E INDIRECTOS DE EMPRESA.

      MUY IMPORTANTE: El archivo puede contener una o múltiples páginas con uno o varios justificantes de gasto.
      Debes segmentar y extraer de forma inteligente todos los gastos independientes que identifiques dentro del array "expenses".
      Si es un único gasto o factura, devuelve un único elemento en el array "expenses".

      Las categorías estructurales admitidas son EXACTAMENTE una de las siguientes:
      1. 'Personal de Estructura / Oficina' (Nóminas de oficina, gerencia, técnicos fijos, cuotas patronales SS oficina)
      2. 'Alquileres y Almacén' (Arrendamiento de nave central, campa de acopio, oficinas centrales, módulos comunes)
      3. 'Seguros Corporativos' (Seguro RC Construcción, Todo Riesgo empresa, Seguro Decenal LOE, Póliza Accidentes Convenio)
      4. 'Combustible y Vehículos' (Gasoil/gasolina furgonetas e inspectores, talleres mecánicos, ITV, neumáticos, seguros flota)
      5. 'Suministros y Oficina' (Electricidad Endesa/Iberdrola, agua, telefonía móvil/fibra Movistar/Vodafone, papelería, tóner)
      6. 'Software, BIM y Control' (Licencias Presto, AutoCAD, Revit, CYPE, software de control, hosting, Google Workspace)
      7. 'Asesoría y Administración' (Honorarios gestoría laboral, fiscal, contable, notaría, auditorías, registro mercantil)
      8. 'Prevención de Riesgos (PRL)' (Servicio Prevención Ajeno SPA, reconocimientos médicos Cualitis/Quirónsalud, cursos TPC 20h)
      9. 'Ferretería y Utillaje' (Herramienta manual, brocas, discos de corte, consumibles de taller no vinculados a obra concreta)
      10. 'Publicidad y Uniformes' (Ropa de trabajo serigrafiada, chalecos, lonas publicitarias, rotulación vehículos, web)
      11. 'Impuestos, Licencias y Avales' (Tasas municipales, IBI sedes fijas, comisiones y avales bancarios, colegiaciones)
      12. 'Otros Gastos Indirectos' (Cualquier otro coste operativo general de la compañía no tipificado arriba)

      Reglas para los campos:
      - 'category': Asigna estrictamente una de las 12 categorías anteriores basada en el emisor y concepto.
      - 'description': Descripción clara, profesional y concisa (ej: "Factura Cepsa repostaje gasoil furgoneta Iveco", "Suministro eléctrico oficinas centrales Endesa", "Póliza semestral RC Mapfre").
      - 'supplier': Nombre o razón social del emisor / proveedor (ej: Repsol, Endesa, Mapfre, Asesoría Guadalete, etc.).
      - 'docNumber': Número de factura o justificante. Si no aparece, genera uno con formato 'S/N-YYYYMMDD' o 'IA-EXP...'.
      - 'date': Fecha del documento en formato YYYY-MM-DD.
      - 'amount': Importe TOTAL del gasto con impuestos incluidos (€).
      - 'baseAmount': Base imponible antes de IVA (€). Si falta, calcúlala (amount / (1 + ivaRate/100)).
      - 'ivaRate': Porcentaje de IVA aplicable (por defecto 21 si no se indica otro, o 0 si está exento/suplido).
      - 'ivaAmount': Cuota de IVA en euros.
      - 'notes': Observaciones, método de pago identificado (domiciliación, tarjeta, transferencia), NIF/CIF del emisor o periodo facturado.
    `;

    const response = await generateContentWithRetry(
      {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: structuralPrompt,
          },
        ],
      },
      {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            expenses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { 
                    type: Type.STRING, 
                    description: 'Categoría exacta del gasto estructural.' 
                  },
                  description: { 
                    type: Type.STRING, 
                    description: 'Descripción concisa y profesional del concepto del gasto.' 
                  },
                  supplier: { 
                    type: Type.STRING, 
                    description: 'Razón social del proveedor o emisor del documento.' 
                  },
                  docNumber: { 
                    type: Type.STRING, 
                    description: 'Número de factura o justificante.' 
                  },
                  date: { 
                    type: Type.STRING, 
                    description: 'Fecha de emisión en formato YYYY-MM-DD.' 
                  },
                  amount: { 
                    type: Type.NUMBER, 
                    description: 'Importe total neto a pagar con IVA incluido (€).' 
                  },
                  baseAmount: { 
                    type: Type.NUMBER, 
                    description: 'Base imponible antes de IVA (€).' 
                  },
                  ivaRate: { 
                    type: Type.NUMBER, 
                    description: 'Porcentaje de IVA aplicado (ej: 21).' 
                  },
                  ivaAmount: { 
                    type: Type.NUMBER, 
                    description: 'Importe de la cuota de IVA (€).' 
                  },
                  notes: { 
                    type: Type.STRING, 
                    description: 'Observaciones, detalles de pago o notas del documento.' 
                  },
                },
                required: ['category', 'description', 'date', 'amount'],
              },
              description: 'Lista de gastos estructurales extraídos del archivo subido.',
            },
          },
          required: ['expenses'],
        },
      }
    );

    const resultText = response.text || '{"expenses":[]}';
    const parsedResult = JSON.parse(resultText.trim());

    res.json(parsedResult);
  } catch (error: any) {
    console.error('Error al analizar gasto estructural con Gemini:', error);
    const msg = typeof error?.message === 'string' ? error.message : JSON.stringify(error);
    const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('rate-limit');

    res.status(isRateLimit ? 429 : 500).json({ 
      error: isRateLimit
        ? 'Límite temporal de consultas IA alcanzado (Rate limit de la API). Por favor, espere 15-20 segundos antes de reintentar.'
        : 'Error al procesar el reconocimiento IA del gasto estructural: ' + (error.message || error),
    });
  }
});

// ==========================================
// RUTAS API: PORTAL DE TRABAJADORES (AISLAMIENTO ZERO-TRUST)
// ==========================================
app.post('/api/worker-portal/invitation', handleCreateInvitation);
app.get('/api/worker-portal/verify', handleVerifyInvitation);
app.post('/api/worker-portal/activate', handleActivateWorker);
app.post('/api/worker-portal/login', handleWorkerLogin);
app.post('/api/worker-portal/revoke', handleRevokeWorker);
app.post('/api/worker-portal/time-records', handleTimeRecord);
app.get('/api/worker-portal/time-records', handleGetWorkerTimeRecords);
app.get('/api/worker-portal/documents', handleGetWorkerDocuments);
app.post('/api/worker-portal/documents/sign', handleSignDocument);
app.get('/api/worker-portal/projects', handleGetWorkerProjects);

// ==========================================
// RUTAS API: PANEL DE SUPERVISIÓN
// ==========================================
app.get('/api/supervisor/workers', (req, res) => {
  res.json({ workers: workersDb });
});

app.post('/api/supervisor/workers', (req, res) => {
  try {
    const { fullName, dniNie, category, hourlyRate, assignedProjectIds, email, phone } = req.body;
    if (!fullName || !category || !hourlyRate) {
      return res.status(400).json({ error: 'Faltan campos requeridos (nombre, categoría, coste/hora)' });
    }

    const newWorker = {
      id: `w-${Date.now().toString().slice(-4)}`,
      organizationId: 'org-jose-real',
      fullName: String(fullName).trim(),
      dniNie: String(dniNie || '').trim().toUpperCase(),
      category: String(category).trim(),
      hourlyRate: Number(hourlyRate),
      assignedProjectIds: Array.isArray(assignedProjectIds) ? assignedProjectIds : ['proj-001'],
      status: 'pending' as const,
      firebaseAuthUid: null,
      email: email ? String(email).trim().toLowerCase() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      activationCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    workersDb.push(newWorker);
    recordAuditLog('supervisor-david', 'supervisor', 'WORKER_CREATED', { workerId: newWorker.id, name: newWorker.fullName }, newWorker.id);

    res.json({ success: true, worker: newWorker });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/supervisor/workers/:id', (req, res) => {
  try {
    const worker = workersDb.find((w) => w.id === req.params.id);
    if (!worker) return res.status(404).json({ error: 'Trabajador no encontrado' });

    const { fullName, category, hourlyRate, assignedProjectIds, status, email, phone } = req.body;
    if (fullName) worker.fullName = fullName;
    if (category) worker.category = category;
    if (hourlyRate !== undefined) worker.hourlyRate = Number(hourlyRate);
    if (assignedProjectIds) worker.assignedProjectIds = assignedProjectIds;
    if (status) worker.status = status;
    if (email !== undefined) worker.email = email;
    if (phone !== undefined) worker.phone = phone;
    worker.updatedAt = new Date().toISOString();

    recordAuditLog('supervisor-david', 'supervisor', 'WORKER_UPDATED', { workerId: worker.id, changes: req.body }, worker.id);

    res.json({ success: true, worker });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/supervisor/projects', (req, res) => {
  res.json({ projects: projectsDb });
});

app.get('/api/supervisor/time-records', (req, res) => {
  res.json({ records: timeRecordsDb });
});

app.get('/api/supervisor/audit-logs', (req, res) => {
  res.json({ logs: auditLogsDb });
});

// Start integration with Vite or production file serving
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  
  if (!isProduction) {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('Vite Dev Middleware montado con éxito (HMR deshabilitado).');
    } catch (err) {
      console.warn('Vite Dev fallback a estáticos en dist:', err);
    }
  }

  // Ensure production dist and SPA routing are always served
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log('Servidor de producción estático configurado en: ' + distPath);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Uniproyect] Servidor web de Control de Gastos ejecutándose sobre http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Uniproyect] Error fatal al iniciar servidor:', err);
  process.exit(1);
});
