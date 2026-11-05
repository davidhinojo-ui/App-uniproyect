import crypto from 'crypto';
import { validateShift } from './shiftValidation.js';
import QRCode from 'qrcode';
import { Request, Response } from 'express';
import { Worker, WorkerInvitation, TimeRecord, WorkerDocument, Project, AuditLog } from '../types/index.js';
import type { PortalState, DocumentWrite } from './replicaState.js';
import { hashPin, verifyPin } from './replicaSecurity.js';
export function createPortalService(state: PortalState, writes: DocumentWrite[], management: Record<string, any[]>) {
  const collection = (_db: unknown, name: string) => name;
  const doc = (_db: unknown, collection: string, id: string) => ({ collection, id });
  const getDocs = async (name: string) => {
    const docs = (management[name] || []).map(data => ({ id: data.id, data: () => data }));
    return { empty: !docs.length, forEach: (fn: (d: typeof docs[number]) => void) => docs.forEach(fn) };
  };
  const setDoc = async (ref: { collection: string; id: string }, data: any, options?: { merge?: boolean }) => {
    const previous = management[ref.collection]?.find(item => item.id === ref.id) || {};
    writes.push({ ...ref, action: 'set', data: JSON.parse(JSON.stringify(options?.merge ? { ...previous, ...data } : data)) });
  };
  const deleteDoc = async (ref: { collection: string; id: string }) => { writes.push({ ...ref, action: 'delete' }); };
  const issueSession = (workerId: string) => {
    const token = crypto.randomBytes(32).toString('base64url');
    state.sessions[crypto.createHash('sha256').update(token).digest('hex')] = { workerId, expiresAt: Date.now() + 12*60*60*1000 };
    return token;
  };

const ORG_ID = state.organizationId;
const ORG_NAME = state.organizationName;

const firestoreDb = true;

// Initial registered projects: strictly registered obras from Firestore
const projectsDb: Project[] = state.projects;

// Real registered workers from Firestore collection plantillaTrabajadores
const workersDb: Worker[] = state.workers;

// Synchronize memory cache with authoritative Firestore collections
async function syncFromFirestore(): Promise<void> {
  if (!firestoreDb) return;
  try {
    const [workersSnap, obrasSnap] = await Promise.all([
      getDocs(collection(firestoreDb, 'plantillaTrabajadores')),
      getDocs(collection(firestoreDb, 'obras'))
    ]);

    {
      projectsDb.length = 0;
      obrasSnap.forEach((d) => {
        const data = d.data();
        projectsDb.push({
          id: d.id,
          organizationId: ORG_ID,
          code: data.code || d.id,
          name: data.name,
          address: data.location || '',
          client: data.description || '',
          status: data.status === 'on_hold' ? 'paused' : (data.status || 'active'),
          supervisorName: 'David Hinojo (Supervisor General)',
          budget: Number(data.budget) || 0,
          laborCostTotal: (management.personal || []).filter(item => item.obraId === d.id).reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0),
          createdAt: data.startDate || new Date().toISOString(),
        });
      });
    }

    {
      const previousWorkers = new Map(workersDb.map(worker => [worker.id, worker]));
      workersDb.length = 0;
      workersSnap.forEach((d) => {
        const data = d.data();
        const stdRate = Number(data.standardHourlyRate) || (data.dailyRate ? Number((data.dailyRate / 8).toFixed(2)) : 14.0);
        workersDb.push({
          ...previousWorkers.get(d.id),
          id: d.id,
          organizationId: ORG_ID,
          fullName: data.name,
          dniNie: data.dni || '',
          category: data.role || 'Oficial de Obra',
          hourlyRate: stdRate,
          assignedProjectIds: previousWorkers.get(d.id)?.assignedProjectIds ?? projectsDb.map(p => p.id),
          status: data.active === false ? 'suspended' : (previousWorkers.get(d.id)?.status || 'pending'),
          phone: data.phone || '',
          activationCount: previousWorkers.get(d.id)?.activationCount ?? 0,
          createdAt: previousWorkers.get(d.id)?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    }
    console.log(`[WorkerPortalService] Sincronización exitosa: ${workersDb.length} trabajadores y ${projectsDb.length} obras reales.`);
  } catch (err) {
    console.warn('[WorkerPortalService] Fallo al sincronizar desde Firestore:', err);
  }
}

// Initial worker documents: strictly authentic, clean state
const workerDocumentsDb: WorkerDocument[] = state.documents;

// Time records: strictly recorded work shifts
const timeRecordsDb: TimeRecord[] = state.records;

// Invitations store (key: SHA-256 hash of high-entropy token)
const workerInvitationsMap = state.invitations;

// Audit logs
const auditLogsDb: AuditLog[] = state.logs;

// Helper: Hash SHA-256
function hashToken(plainToken: string): string {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

// Helper: Record Audit Log
function recordAuditLog(
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
async function handleCreateInvitation(req: Request, res: Response) {
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
    // Direct worker portal URL (no app needed; scanning directly opens the worker's own portal)
    const activationUrl = `${origin}/#portal?w=${encodeURIComponent(worker.id)}&token=${encodeURIComponent(plainToken)}`;

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
    workerInvitationsMap.set(tokenHash, { ...invitation, tokenPlain: undefined, activationUrl: '' });

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
async function handleVerifyInvitation(req: Request, res: Response) {
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
async function handleActivateWorker(req: Request, res: Response) {
  try {
    const { token, pin, email, password } = req.body;
    if (!/^\d{4,6}$/.test(String(pin || ''))) return res.status(400).json({ error: 'El PIN debe contener de 4 a 6 números' });
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
    if (pin) worker.pin = hashPin(String(pin).trim());
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
      token: issueSession(worker.id),
    });
  } catch (error: any) {
    console.error('Error al activar trabajador:', error);
    return res.status(500).json({ error: 'Error durante la activación: ' + error.message });
  }
}

/**
 * WORKER: Login (via PIN or Phone/Identifier)
 */
async function handleWorkerLogin(req: Request, res: Response) {
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

    if (!worker.pin || !verifyPin(cleanPin, worker.pin)) {
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
      token: issueSession(worker.id),
    });
  } catch (error: any) {
    console.error('Error en login de trabajador:', error);
    return res.status(500).json({ error: 'Error de autenticación' });
  }
}

/**
 * SUPERVISOR / GERENTE: Revoke Worker Access or Portal
 */
async function handleRevokeWorker(req: Request, res: Response) {
  try {
    const workerId = req.body.workerId || req.params.id;
    const reason = req.body.reason;
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
      'gerente',
      'supervisor',
      'WORKER_PORTAL_REVOKED',
      { workerId: worker.id, fullName: worker.fullName, reason: reason || 'Portal eliminado/revocado por el Gerente' },
      worker.id
    );

    return res.json({ success: true, message: `Portal revocado para ${worker.fullName}` });
  } catch (error: any) {
    console.error('Error al revocar trabajador:', error);
    return res.status(500).json({ error: 'Error al revocar portal: ' + error.message });
  }
}

/**
 * SUPERVISOR / GERENTE: Reactivate Worker Portal
 */
async function handleActivateWorkerPortal(req: Request, res: Response) {
  try {
    const workerId = req.body.workerId || req.params.id;
    if (!workerId) return res.status(400).json({ error: 'Falta workerId' });

    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: 'Trabajador no encontrado' });

    worker.status = 'active';
    worker.updatedAt = new Date().toISOString();

    recordAuditLog(
      'gerente',
      'supervisor',
      'WORKER_PORTAL_ACTIVATED',
      { workerId: worker.id, fullName: worker.fullName },
      worker.id
    );

    return res.json({ success: true, message: `Portal reactivado para ${worker.fullName}`, worker });
  } catch (error: any) {
    console.error('Error al reactivar portal:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * SUPERVISOR / GERENTE: Delete Worker Card & Access
 */
async function handleDeleteWorker(req: Request, res: Response) {
  try {
    const workerId = req.params.id || req.body.workerId;
    if (!workerId) return res.status(400).json({ error: 'Falta workerId' });

    const idx = workersDb.findIndex((w) => w.id === workerId);
    if (idx === -1) return res.status(404).json({ error: 'Trabajador no encontrado' });

    const worker = workersDb[idx];
    workersDb.splice(idx, 1);

    // Invalidate any active invitations
    for (const [hash, inv] of workerInvitationsMap.entries()) {
      if (inv.workerId === workerId) {
        workerInvitationsMap.delete(hash);
      }
    }

    // Delete from Firestore 'plantillaTrabajadores' if configured
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, 'plantillaTrabajadores', workerId));
        console.log(`[WorkerPortalService] Tarjeta de trabajador eliminada de Firestore: ${workerId}`);
      } catch (fErr) {
        console.warn('[WorkerPortalService] Error al eliminar de Firestore plantillaTrabajadores:', fErr);
      }
    }

    recordAuditLog(
      'gerente',
      'supervisor',
      'WORKER_DELETED',
      { workerId, fullName: worker.fullName },
      workerId
    );

    return res.json({ success: true, message: `Tarjeta de ${worker.fullName} eliminada correctamente`, workerId });
  } catch (error: any) {
    console.error('Error al eliminar trabajador:', error);
    return res.status(500).json({ error: 'Error al eliminar trabajador: ' + error.message });
  }
}

/**
 * SUPERVISOR / GERENTE: Give Visto Bueno / Approval to Time Record
 * Automatically imputes calculated labor expense directly to the obra in Firestore 'personal' collection!
 */
async function handleApproveTimeRecord(req: Request, res: Response) {
  try {
    const recordId = req.params.id || req.body.recordId;
    const { managerName, notes, signature } = req.body;

    if (!recordId) return res.status(400).json({ error: 'Falta recordId' });

    const record = timeRecordsDb.find((r) => r.id === recordId);
    if (!record) return res.status(404).json({ error: 'Fichaje no encontrado' });
    if (record.type !== 'check_out' || record.hoursWorked == null) {
      return res.status(409).json({ error: 'Solo se puede aprobar una salida con jornada calculada.' });
    }
    if ((record as any).approvalStatus === 'approved') {
      return res.json({ success: true, record, costId: `cost-fichaje-${record.id}`, totalCost: record.calculatedCost ?? 0 });
    }

    const worker = workersDb.find((w) => w.id === record.workerId);
    const hourlyRate = record.hourlyRate ?? worker?.hourlyRate ?? 14.0;
    const hours = record.hoursWorked;
    const totalCost = Number((record.calculatedCost ?? (hours * hourlyRate)).toFixed(2));
    const nowIso = new Date().toISOString();

    record.status = 'valid';
    (record as any).approvalStatus = 'approved';
    (record as any).approvedAt = nowIso;
    (record as any).managerName = managerName || 'Gerente de Obra';
    (record as any).managerSignature = signature;
    (record as any).managerNotes = notes;

    const costId = `cost-fichaje-${record.id}`;

    // DIRECT LABOR COST IMPUTATION TO FIRESTORE 'personal' COLLECTION!
    if (firestoreDb) {
      try {
        const personalDoc = {
          id: costId,
          obraId: record.projectId,
          workerName: record.workerName,
          workerCatalogId: record.workerId,
          date: record.timestamp ? record.timestamp.split('T')[0] : nowIso.split('T')[0],
          role: worker?.category || 'Oficial de Obra',
          hours,
          hourlyRate,
          totalCost,
          costType: 'horas',
          notes: `[Visto Bueno Gerente: ${managerName || 'Gerente'}] Fichaje Portal en ${record.projectName || 'Obra'}. ${notes || ''}`.trim(),
          fichajeId: record.id,
          createdAt: nowIso,
        };
        await setDoc(doc(firestoreDb, 'personal', costId), personalDoc);
        console.log(`[WorkerPortalService] Coste imputado en Firestore 'personal' (${costId}): ${totalCost}€ a obra ${record.projectId}`);

        // Update fichaje in Firestore
        await setDoc(doc(firestoreDb, 'fichajes', record.id), {
          id: record.id,
          workerId: record.workerId,
          workerName: record.workerName,
          obraId: record.projectId,
          obraName: record.projectName,
          date: record.timestamp ? record.timestamp.split('T')[0] : nowIso.split('T')[0],
          totalHours: hours,
          hourlyRate,
          calculatedCost: totalCost,
          status: 'completed',
          approvalStatus: 'approved',
          approvedAt: nowIso,
          foremanName: managerName || 'Gerente de Obra',
          foremanSignature: signature || '',
          foremanNotes: notes || '',
          personalCostId: costId,
          updatedAt: nowIso,
        }, { merge: true });
      } catch (fsErr) {
        console.error('[WorkerPortalService] Error al escribir coste en Firestore:', fsErr);
      }
    }

    // Update in-memory project labor total
    const project = projectsDb.find((p) => p.id === record.projectId);
    if (project) {
      project.laborCostTotal = Number(((project.laborCostTotal || 0) + totalCost).toFixed(2));
    }

    recordAuditLog(
      'gerente',
      'supervisor',
      'TIME_RECORD_APPROVED',
      {
        recordId: record.id,
        workerName: record.workerName,
        projectId: record.projectId,
        costAdded: totalCost,
        managerName: managerName || 'Gerente',
      },
      record.workerId
    );

    return res.json({
      success: true,
      message: `Visto bueno otorgado por el Gerente. ${totalCost.toFixed(2)}€ imputados a la obra`,
      record,
      costId,
      totalCost,
    });
  } catch (error: any) {
    console.error('Error al aprobar fichaje:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * WORKER: Clock-in / Clock-out
 * Saves shift and prepares it for Gerente approval and cost allocation
 */
async function handleTimeRecord(req: Request, res: Response) {
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
      return res.status(403).json({ error: 'El portal de este trabajador está inactivo o ha sido revocado. Contacte con el Gerente.' });
    }

    const project = projectsDb.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ error: 'Obra no encontrada en el registro' });

    if (!worker.assignedProjectIds.includes(projectId)) {
      return res.status(403).json({ error: 'Esta obra no está asignada al trabajador.' });
    }

    const nowIso = new Date().toISOString();
    let hoursWorked: number | undefined;
    let calculatedCost: number | undefined;

    const shift = validateShift(timeRecordsDb, worker.id, projectId, type, nowIso);
    if ('error' in shift) return res.status(409).json({ error: shift.error });
    hoursWorked = shift.hoursWorked;
    if (type === 'check_out') {
      calculatedCost = Number(((hoursWorked ?? 0) * worker.hourlyRate).toFixed(2));
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
    (record as any).approvalStatus = 'pending';

    timeRecordsDb.unshift(record);

    // Persist the completed shift in management, removing its former active row atomically.
    if (firestoreDb) {
      try {
        const entry = type === 'check_in' ? record : timeRecordsDb.find(item => item.workerId === worker.id && item.projectId === project.id && item.type === 'check_in');
        const clock = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
        if (type === 'check_out' && entry) await deleteDoc(doc(firestoreDb, 'fichajes', entry.id));
        const fichajeDoc = {
          id: record.id,
          workerId: worker.id,
          workerName: worker.fullName,
          workerDni: worker.dniNie || '',
          role: worker.category,
          obraId: project.id,
          obraName: project.name,
          date: nowIso.split('T')[0],
          clockIn: clock(entry?.timestamp || nowIso),
          clockOut: type === 'check_out' ? clock(nowIso) : '',
          breakMinutes: 0,
          totalHours: hoursWorked || 0,
          regularHours: hoursWorked ? Math.min(8, hoursWorked) : 0,
          overtimeHours: hoursWorked ? Math.max(0, hoursWorked - 8) : 0,
          hourlyRate: worker.hourlyRate,
          overtimeRate: Number((worker.hourlyRate * 1.35).toFixed(2)),
          calculatedCost: calculatedCost || 0,
          status: type === 'check_out' ? 'completed' : 'active',
          approvalStatus: 'pending',
          notes: record.notes || '',
          locationCoords: location ? { latitude: location.latitude, longitude: location.longitude } : undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await setDoc(doc(firestoreDb, 'fichajes', record.id), fichajeDoc);
      } catch (fErr) {
        console.warn('[WorkerPortalService] No se pudo escribir en Firestore fichajes:', fErr);
      }
    }

    recordAuditLog(
      worker.id,
      'worker',
      type === 'check_in' ? 'TIME_CHECK_IN' : 'TIME_CHECK_OUT',
      {
        projectId: project.id,
        projectName: project.name,
        hoursWorked,
        calculatedCost,
        approvalStatus: 'pending',
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
          : `Salida registrada (${hoursWorked}h). Fichaje enviado al Gerente para visto bueno e imputación de costes.`,
    });
  } catch (error: any) {
    console.error('Error al registrar fichaje:', error);
    return res.status(500).json({ error: 'Error al procesar fichaje: ' + error.message });
  }
}

/**
 * WORKER: Get strictly worker's own records (ISOLATION GUARANTEED)
 */
async function handleGetWorkerTimeRecords(req: Request, res: Response) {
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
async function handleGetWorkerDocuments(req: Request, res: Response) {
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
async function handleSignDocument(req: Request, res: Response) {
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
async function handleGetWorkerProjects(req: Request, res: Response) {
  try {
    const workerId = req.query.workerId as string;
    if (!workerId) return res.status(400).json({ error: 'Falta workerId' });

    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: 'Trabajador no encontrado' });

    const authorized = projectsDb.filter((p) =>
      worker.assignedProjectIds.includes(p.id)
    );
    return res.json({ projects: authorized });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

return { projectsDb, workersDb, timeRecordsDb, workerDocumentsDb, auditLogsDb, workerInvitationsMap, syncFromFirestore, hashToken, recordAuditLog, handleCreateInvitation, handleVerifyInvitation, handleActivateWorker, handleWorkerLogin, handleRevokeWorker, handleActivateWorkerPortal, handleDeleteWorker, handleApproveTimeRecord, handleTimeRecord, handleGetWorkerTimeRecords, handleGetWorkerDocuments, handleSignDocument, handleGetWorkerProjects };
}
