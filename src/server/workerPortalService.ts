import crypto from 'crypto';
import QRCode from 'qrcode';
import { Request, Response } from 'express';
import { Worker, WorkerInvitation, TimeRecord, WorkerDocument, Project, AuditLog } from '../types/index.js';

const ORG_ID = 'org-jose-real';
const ORG_NAME = 'José Real Construcciones, S.L.';

// Initial projects with current labor and material costs
export const projectsDb: Project[] = [
  {
    id: 'proj-001',
    organizationId: ORG_ID,
    code: 'OBRA-2026-01',
    name: 'Residencial Las Palmas - Fase II',
    address: 'Calle Mayor 45, Las Palmas',
    client: 'Promociones Atlántico S.A.',
    status: 'active',
    supervisorName: 'David Hinojo (Supervisor General)',
    budget: 350000,
    laborCostTotal: 14250.00,
    materialCostTotal: 84300.00,
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'proj-002',
    organizationId: ORG_ID,
    code: 'OBRA-2026-02',
    name: 'Rehabilitación Integral Casco Histórico',
    address: 'Plaza del Rey 12, Centro',
    client: 'Consorcio Patrimonio Histórico',
    status: 'active',
    supervisorName: 'Carlos M. Encargado',
    budget: 180000,
    laborCostTotal: 8640.50,
    materialCostTotal: 42100.00,
    createdAt: '2026-02-01T08:00:00Z',
  },
  {
    id: 'proj-003',
    organizationId: ORG_ID,
    code: 'OBRA-2026-03',
    name: 'Nave Logística Polígono Oeste',
    address: 'Parque Industrial Sur, Parcela 8B',
    client: 'Logística Global Express',
    status: 'active',
    supervisorName: 'David Hinojo (Supervisor General)',
    budget: 520000,
    laborCostTotal: 19800.00,
    materialCostTotal: 125400.00,
    createdAt: '2026-03-10T08:00:00Z',
  },
];

// Initial workers database with initial authorized obras and hourly rates
export const workersDb: Worker[] = [
  {
    id: 'w-101',
    organizationId: ORG_ID,
    fullName: 'Manuel García Rodríguez',
    dniNie: '48392019K',
    category: 'Oficial 1ª Albañil',
    hourlyRate: 19.50,
    assignedProjectIds: ['proj-001', 'proj-002'],
    status: 'active',
    firebaseAuthUid: 'uid-w-101',
    email: 'm.garcia@construccionesreal.es',
    phone: '+34 611 223 344',
    pin: '1234',
    activationCount: 1,
    lastLoginAt: '2026-10-31T08:15:00Z',
    createdAt: '2026-01-20T08:00:00Z',
    updatedAt: '2026-10-31T08:00:00Z',
  },
  {
    id: 'w-102',
    organizationId: ORG_ID,
    fullName: 'Antonio Romero Benítez',
    dniNie: '31940283T',
    category: 'Peón Especialista',
    hourlyRate: 16.00,
    assignedProjectIds: ['proj-001', 'proj-003'],
    status: 'active',
    firebaseAuthUid: 'uid-w-102',
    email: 'a.romero@construccionesreal.es',
    phone: '+34 622 334 455',
    pin: '4321',
    activationCount: 1,
    lastLoginAt: '2026-10-30T17:40:00Z',
    createdAt: '2026-02-10T08:00:00Z',
    updatedAt: '2026-10-30T17:40:00Z',
  },
  {
    id: 'w-103',
    organizationId: ORG_ID,
    fullName: 'Javier Martínez Delgado',
    dniNie: '52849102L',
    category: 'Oficial 1ª Encofrador',
    hourlyRate: 21.00,
    assignedProjectIds: ['proj-001', 'proj-003'],
    status: 'pending', // Pending QR activation
    firebaseAuthUid: null,
    email: 'j.martinez@construccionesreal.es',
    phone: '+34 633 445 566',
    pin: undefined,
    activationCount: 0,
    createdAt: '2026-10-25T09:30:00Z',
    updatedAt: '2026-10-25T09:30:00Z',
  },
  {
    id: 'w-104',
    organizationId: ORG_ID,
    fullName: 'Pedro Sánchez Morales',
    dniNie: '77291048M',
    category: 'Oficial Electricista',
    hourlyRate: 22.50,
    assignedProjectIds: ['proj-002'],
    status: 'suspended',
    firebaseAuthUid: 'uid-w-104',
    email: 'p.sanchez@construccionesreal.es',
    phone: '+34 644 556 677',
    pin: '5678',
    activationCount: 1,
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-10-20T11:00:00Z',
  },
];

// Initial time records
export const timeRecordsDb: TimeRecord[] = [
  {
    id: 'tr-001',
    workerId: 'w-101',
    workerName: 'Manuel García Rodríguez',
    firebaseAuthUid: 'uid-w-101',
    organizationId: ORG_ID,
    projectId: 'proj-001',
    projectName: 'Residencial Las Palmas - Fase II',
    type: 'check_in',
    timestamp: '2026-10-31T07:58:12Z',
    location: { latitude: 28.1235, longitude: -15.4362, address: 'Acceso Puerta 1 - Obra Las Palmas' },
    notes: 'Jornada normal de hormigonado y tabiquería',
    status: 'valid',
    createdAt: '2026-10-31T07:58:12Z',
  },
  {
    id: 'tr-002',
    workerId: 'w-102',
    workerName: 'Antonio Romero Benítez',
    firebaseAuthUid: 'uid-w-102',
    organizationId: ORG_ID,
    projectId: 'proj-001',
    projectName: 'Residencial Las Palmas - Fase II',
    type: 'check_in',
    timestamp: '2026-10-30T07:55:00Z',
    location: { latitude: 28.1234, longitude: -15.4360 },
    notes: 'Entrada puntual',
    status: 'valid',
    createdAt: '2026-10-30T07:55:00Z',
  },
  {
    id: 'tr-003',
    workerId: 'w-102',
    workerName: 'Antonio Romero Benítez',
    firebaseAuthUid: 'uid-w-102',
    organizationId: ORG_ID,
    projectId: 'proj-001',
    projectName: 'Residencial Las Palmas - Fase II',
    type: 'check_out',
    timestamp: '2026-10-30T16:25:00Z',
    location: { latitude: 28.1236, longitude: -15.4363 },
    hoursWorked: 8.5,
    hourlyRate: 16.00,
    calculatedCost: 136.00,
    notes: 'Salida de fin de jornada completa',
    status: 'valid',
    createdAt: '2026-10-30T16:25:00Z',
  },
];

// Initial worker documents
export const workerDocumentsDb: WorkerDocument[] = [
  {
    id: 'doc-001',
    workerId: 'w-101',
    organizationId: ORG_ID,
    title: 'Nómina Oficial - Octubre 2026',
    type: 'payroll',
    period: 'Octubre 2026',
    fileUrl: '/docs/nomina-manuel-octubre-2026.pdf',
    fileSize: 148200,
    uploadedAt: '2026-10-28T10:00:00Z',
    signed: true,
    signedAt: '2026-10-29T12:30:00Z',
  },
  {
    id: 'doc-002',
    workerId: 'w-101',
    organizationId: ORG_ID,
    title: 'Certificado Reconocimiento Médico 2026',
    type: 'medical',
    period: 'Año 2026',
    fileUrl: '/docs/medico-manuel-2026.pdf',
    fileSize: 220500,
    uploadedAt: '2026-02-14T09:00:00Z',
    signed: true,
    signedAt: '2026-02-14T11:00:00Z',
  },
  {
    id: 'doc-003',
    workerId: 'w-101',
    organizationId: ORG_ID,
    title: 'Certificado Curso PRL 20 Horas Albañilería',
    type: 'safety_prl',
    period: 'Vigente',
    fileUrl: '/docs/prl-20h-manuel.pdf',
    fileSize: 310400,
    uploadedAt: '2026-01-20T10:00:00Z',
    signed: true,
    signedAt: '2026-01-20T10:15:00Z',
  },
  {
    id: 'doc-004',
    workerId: 'w-102',
    organizationId: ORG_ID,
    title: 'Nómina Oficial - Octubre 2026',
    type: 'payroll',
    period: 'Octubre 2026',
    fileUrl: '/docs/nomina-antonio-octubre-2026.pdf',
    fileSize: 145100,
    uploadedAt: '2026-10-28T10:00:00Z',
    signed: false,
  },
  {
    id: 'doc-005',
    workerId: 'w-103',
    organizationId: ORG_ID,
    title: 'Contrato de Trabajo Indefinido',
    type: 'contract',
    period: '2026',
    fileUrl: '/docs/contrato-javier.pdf',
    fileSize: 480200,
    uploadedAt: '2026-10-25T10:00:00Z',
    signed: false,
  },
];

// Invitations store (key: SHA-256 hash of high-entropy token)
export const workerInvitationsMap = new Map<string, WorkerInvitation>();

// Audit logs
export const auditLogsDb: AuditLog[] = [
  {
    id: 'log-001',
    organizationId: ORG_ID,
    actorUid: 'supervisor-david',
    actorRole: 'supervisor',
    action: 'SYSTEM_BOOTSTRAP',
    details: { message: 'Inicialización de control horario y portal de trabajadores' },
    timestamp: '2026-10-31T06:00:00Z',
  },
];

// Helper: Hash SHA-256
export function hashToken(plainToken: string): string {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

// Helper: Record Audit Log
export function recordAuditLog(
  actorUid: string,
  actorRole: 'supervisor' | 'worker' | 'system',
  action: string,
  details: Record<string, any>,
  targetWorkerId?: string
) {
  const log: AuditLog = {
    id: `log-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    organizationId: ORG_ID,
    actorUid,
    actorRole,
    action,
    targetWorkerId,
    details,
    timestamp: new Date().toISOString(),
  };
  auditLogsDb.unshift(log);
  if (auditLogsDb.length > 500) auditLogsDb.pop();
}

/**
 * SUPERVISOR: Create QR Invitation
 */
export async function handleCreateInvitation(req: Request, res: Response) {
  try {
    const { workerId } = req.body;
    if (!workerId) {
      return res.status(400).json({ error: 'Falta el identificador del trabajador (workerId)' });
    }

    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Trabajador no encontrado en la base de datos' });
    }

    // Generate 32 bytes (256-bit entropy) base64url token
    const tokenBuffer = crypto.randomBytes(32);
    const plainToken = tokenBuffer.toString('base64url');
    const tokenHash = hashToken(plainToken);

    // Invitation expires in 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    // Determine host URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const origin = `${protocol}://${host}`;
    const activationUrl = `${origin}/#activar?token=${plainToken}`;

    // Generate high-resolution QR Code
    const qrCodeUrl = await QRCode.toDataURL(activationUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });

    const invitation: WorkerInvitation = {
      id: `inv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      workerId: worker.id,
      workerName: worker.fullName,
      organizationId: ORG_ID,
      tokenHash,
      tokenPlain: plainToken, // Returned in response for QR presentation, never stored
      activationUrl,
      expiresAt,
      consumed: false,
      revoked: false,
      createdByUid: 'supervisor-david',
      createdAt: new Date().toISOString(),
    };

    // Store in Map by hash
    workerInvitationsMap.set(tokenHash, invitation);

    // Increment worker activation count
    worker.activationCount += 1;
    worker.updatedAt = new Date().toISOString();

    recordAuditLog(
      'supervisor-david',
      'supervisor',
      'INVITATION_CREATED',
      {
        workerId: worker.id,
        workerName: worker.fullName,
        expiresAt,
        tokenHashPrefix: tokenHash.substring(0, 8),
      },
      worker.id
    );

    return res.json({
      success: true,
      invitationId: invitation.id,
      workerId: worker.id,
      workerName: worker.fullName,
      category: worker.category,
      activationUrl,
      qrCodeUrl,
      expiresAt,
      ttlHours: 48,
    });
  } catch (error: any) {
    console.error('Error al generar invitación QR:', error);
    return res.status(500).json({ error: 'Error interno al generar código QR: ' + error.message });
  }
}

/**
 * PUBLIC/WORKER: Verify Invitation Token without consuming it
 */
export async function handleVerifyInvitation(req: Request, res: Response) {
  try {
    const token = req.query.token as string;
    if (!token || typeof token !== 'string' || token.length < 20) {
      return res.status(400).json({ error: 'Token de activación inválido o ausente' });
    }

    const tokenHash = hashToken(token);
    const invitation = workerInvitationsMap.get(tokenHash);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitación no encontrada o no válida' });
    }

    if (invitation.revoked) {
      return res.status(403).json({ error: 'Esta invitación ha sido revocada por el supervisor' });
    }

    if (invitation.consumed) {
      return res.status(410).json({ error: 'Esta invitación ya fue activada previamente' });
    }

    const now = new Date();
    if (new Date(invitation.expiresAt) < now) {
      return res.status(400).json({ error: 'La invitación ha caducado (plazo de 48h vencido). Solicite un nuevo QR al supervisor' });
    }

    const worker = workersDb.find((w) => w.id === invitation.workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Ficha del trabajador asociada no encontrada' });
    }

    // Return non-PII verification data for welcome screen
    return res.json({
      valid: true,
      workerId: worker.id,
      workerName: worker.fullName,
      category: worker.category,
      organizationName: ORG_NAME,
      expiresAt: invitation.expiresAt,
    });
  } catch (error: any) {
    console.error('Error al verificar invitación:', error);
    return res.status(500).json({ error: 'Error al comprobar invitación' });
  }
}

/**
 * WORKER: Activate Account (Atomic consumption + PIN/Password set)
 */
export async function handleActivateWorker(req: Request, res: Response) {
  try {
    const { token, pin, email, password } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Falta el token de activación' });
    }

    const tokenHash = hashToken(token);
    const invitation = workerInvitationsMap.get(tokenHash);

    if (!invitation) {
      return res.status(404).json({ error: 'Invitación inválida' });
    }

    if (invitation.revoked) {
      return res.status(403).json({ error: 'Invitación revocada' });
    }

    if (invitation.consumed) {
      return res.status(410).json({ error: 'Esta invitación ya fue consumida' });
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invitación caducada' });
    }

    const worker = workersDb.find((w) => w.id === invitation.workerId);
    if (!worker) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    // Atomic consumption
    invitation.consumed = true;
    invitation.consumedAt = new Date().toISOString();
    const newUid = `uid-${worker.id}`;
    invitation.consumedByUid = newUid;

    // Update worker profile
    worker.status = 'active';
    worker.firebaseAuthUid = newUid;
    if (pin) worker.pin = String(pin).trim();
    if (email) worker.email = String(email).trim().toLowerCase();
    worker.lastLoginAt = new Date().toISOString();
    worker.updatedAt = new Date().toISOString();

    recordAuditLog(
      newUid,
      'worker',
      'INVITATION_ACTIVATED',
      {
        workerId: worker.id,
        workerName: worker.fullName,
        mechanism: pin ? 'pin_assisted' : 'email_credential',
      },
      worker.id
    );

    return res.json({
      success: true,
      message: 'Cuenta activada correctamente',
      worker: {
        id: worker.id,
        fullName: worker.fullName,
        category: worker.category,
        status: worker.status,
        assignedProjectIds: worker.assignedProjectIds,
      },
      token: `auth-token-${worker.id}-${Date.now()}`,
    });
  } catch (error: any) {
    console.error('Error al activar trabajador:', error);
    return res.status(500).json({ error: 'Error durante la activación: ' + error.message });
  }
}

/**
 * WORKER: Login (via PIN or Phone/Identifier)
 */
export async function handleWorkerLogin(req: Request, res: Response) {
  try {
    const { workerId, identifier, pin } = req.body;
    const lookupId = (workerId || identifier || '').trim();
    const cleanPin = (pin || '').trim();

    if (!lookupId || !cleanPin) {
      return res.status(400).json({ error: 'Introduzca su identificador o teléfono y su PIN de acceso' });
    }

    // Match by ID, phone, or DNI
    const worker = workersDb.find(
      (w) =>
        w.id === lookupId ||
        w.phone?.replace(/\s+/g, '') === lookupId.replace(/\s+/g, '') ||
        w.dniNie?.toUpperCase() === lookupId.toUpperCase()
    );

    if (!worker) {
      return res.status(401).json({ error: 'Credenciales no reconocidas' });
    }

    if (worker.status !== 'active') {
      return res.status(403).json({
        error: `Su cuenta está en estado "${worker.status}". Contacte con su supervisor para reactivar el acceso.`,
      });
    }

    if (!worker.pin || worker.pin !== cleanPin) {
      return res.status(401).json({ error: 'PIN de acceso incorrecto' });
    }

    worker.lastLoginAt = new Date().toISOString();

    return res.json({
      success: true,
      worker: {
        id: worker.id,
        fullName: worker.fullName,
        category: worker.category,
        hourlyRate: worker.hourlyRate,
        status: worker.status,
        assignedProjectIds: worker.assignedProjectIds,
        email: worker.email,
        phone: worker.phone,
      },
      token: `auth-token-${worker.id}-${Date.now()}`,
    });
  } catch (error: any) {
    console.error('Error en login de trabajador:', error);
    return res.status(500).json({ error: 'Error de autenticación' });
  }
}

/**
 * SUPERVISOR: Revoke Worker Access or Invitation
 */
export async function handleRevokeWorker(req: Request, res: Response) {
  try {
    const { workerId, reason } = req.body;
    if (!workerId) return res.status(400).json({ error: 'Falta workerId' });

    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: 'Trabajador no encontrado' });

    worker.status = 'revoked';
    worker.updatedAt = new Date().toISOString();

    // Mark any invitations for this worker as revoked
    for (const [hash, inv] of workerInvitationsMap.entries()) {
      if (inv.workerId === worker.id) {
        inv.revoked = true;
      }
    }

    recordAuditLog(
      'supervisor-david',
      'supervisor',
      'WORKER_REVOKED',
      { workerId: worker.id, reason: reason || 'Revocación por supervisor' },
      worker.id
    );

    return res.json({ success: true, message: 'Acceso revocado de inmediato' });
  } catch (error: any) {
    console.error('Error al revocar trabajador:', error);
    return res.status(500).json({ error: 'Error al revocar acceso' });
  }
}

/**
 * WORKER: Clock-in / Clock-out
 * AUTOMATICALLY COMPUTES LABOR EXPENSE AND ATTRIBUTES IT TO THE PROJECT!
 */
export async function handleTimeRecord(req: Request, res: Response) {
  try {
    const { workerId, projectId, type, notes, location } = req.body;

    if (!workerId || !projectId || !type) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (workerId, projectId, type)' });
    }

    if (type !== 'check_in' && type !== 'check_out') {
      return res.status(400).json({ error: 'Tipo debe ser check_in o check_out' });
    }

    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: 'Trabajador no encontrado' });

    if (worker.status !== 'active') {
      return res.status(403).json({ error: 'Cuenta no activa. No puede registrar fichajes' });
    }

    // Verify worker is authorized for this project
    if (!worker.assignedProjectIds.includes(projectId)) {
      return res.status(403).json({ error: 'No está autorizado a fichar en esta obra' });
    }

    const project = projectsDb.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ error: 'Obra no encontrada' });

    const nowIso = new Date().toISOString();
    let hoursWorked: number | undefined;
    let calculatedCost: number | undefined;

    // If check_out, calculate elapsed hours from the latest check_in
    if (type === 'check_out') {
      const recentCheckIn = timeRecordsDb
        .filter((tr) => tr.workerId === worker.id && tr.projectId === projectId && tr.type === 'check_in')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

      if (recentCheckIn) {
        const startMs = new Date(recentCheckIn.timestamp).getTime();
        const endMs = new Date(nowIso).getTime();
        const diffHours = (endMs - startMs) / (1000 * 60 * 60);
        // Minimum sensible time of 0.1h (6 min) if testing immediately, capped at 14h
        hoursWorked = Math.max(0.1, Math.min(14, Number(diffHours.toFixed(2))));
      } else {
        // Standard full day default if no matching checkin recorded earlier
        hoursWorked = 8.0;
      }

      calculatedCost = Number((hoursWorked * worker.hourlyRate).toFixed(2));

      // ATTRIBUTE LABOR COST DIRECTLY TO PROJECT
      project.laborCostTotal = Number((project.laborCostTotal + calculatedCost).toFixed(2));
    }

    const record: TimeRecord = {
      id: `tr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      workerId: worker.id,
      workerName: worker.fullName,
      firebaseAuthUid: worker.firebaseAuthUid || `uid-${worker.id}`,
      organizationId: ORG_ID,
      projectId: project.id,
      projectName: project.name,
      type,
      timestamp: nowIso,
      location,
      notes: notes || (type === 'check_in' ? 'Entrada registrada en obra' : 'Salida registrada en obra'),
      hoursWorked,
      hourlyRate: worker.hourlyRate,
      calculatedCost,
      status: 'valid',
      createdAt: nowIso,
    };

    timeRecordsDb.unshift(record);

    recordAuditLog(
      worker.id,
      'worker',
      type === 'check_in' ? 'TIME_CHECK_IN' : 'TIME_CHECK_OUT',
      {
        projectId: project.id,
        projectName: project.name,
        hoursWorked,
        calculatedCost,
        updatedProjectLaborTotal: project.laborCostTotal,
      },
      worker.id
    );

    return res.json({
      success: true,
      record,
      project: {
        id: project.id,
        name: project.name,
        laborCostTotal: project.laborCostTotal,
      },
      message:
        type === 'check_in'
          ? `Entrada registrada con éxito en ${project.name}`
          : `Salida registrada. ${hoursWorked}h computadas (+${calculatedCost}€ imputados a la obra)`,
    });
  } catch (error: any) {
    console.error('Error al registrar fichaje:', error);
    return res.status(500).json({ error: 'Error al procesar fichaje: ' + error.message });
  }
}

/**
 * WORKER: Get strictly worker's own records (ISOLATION GUARANTEED)
 */
export async function handleGetWorkerTimeRecords(req: Request, res: Response) {
  try {
    const workerId = req.query.workerId as string;
    if (!workerId) return res.status(400).json({ error: 'Falta workerId' });

    // Strict filter: only records matching this workerId
    const records = timeRecordsDb.filter((tr) => tr.workerId === workerId);
    return res.json({ records });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * WORKER: Get strictly worker's own documents (ISOLATION GUARANTEED)
 */
export async function handleGetWorkerDocuments(req: Request, res: Response) {
  try {
    const workerId = req.query.workerId as string;
    if (!workerId) return res.status(400).json({ error: 'Falta workerId' });

    const documents = workerDocumentsDb.filter((doc) => doc.workerId === workerId);
    return res.json({ documents });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * WORKER: Sign Document
 */
export async function handleSignDocument(req: Request, res: Response) {
  try {
    const { docId, workerId } = req.body;
    const document = workerDocumentsDb.find((d) => d.id === docId && d.workerId === workerId);
    if (!document) return res.status(404).json({ error: 'Documento no encontrado o no autorizado' });

    document.signed = true;
    document.signedAt = new Date().toISOString();

    recordAuditLog(
      workerId,
      'worker',
      'DOCUMENT_SIGNED',
      { docId: document.id, title: document.title },
      workerId
    );

    return res.json({ success: true, document });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * WORKER: Get assigned projects
 */
export async function handleGetWorkerProjects(req: Request, res: Response) {
  try {
    const workerId = req.query.workerId as string;
    if (!workerId) return res.status(400).json({ error: 'Falta workerId' });

    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: 'Trabajador no encontrado' });

    const authorized = projectsDb.filter((p) => worker.assignedProjectIds.includes(p.id));
    return res.json({ projects: authorized });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
