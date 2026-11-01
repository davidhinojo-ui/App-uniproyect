"use strict";
import crypto from "crypto";
import QRCode from "qrcode";
import { organization as ORG_ID } from "./persistence.js";
const ORG_NAME = "Jos\xE9 Real Construcciones, S.L.";
import { list, invitations, state } from "./stateContext.js";
import { hashPin, verifyPin, issueSession, publicData } from "./credentials.js";
export const projectsDb = list("projects");
export const workersDb = list("workers");
export const timeRecordsDb = list("records");
export const workerDocumentsDb = list("documents");
export const auditLogsDb = list("audit");
export const workerInvitationsMap = invitations;
export function hashToken(plainToken) {
  return crypto.createHash("sha256").update(plainToken).digest("hex");
}
export function recordAuditLog(actorUid, actorRole, action, details, targetWorkerId) {
  const log = {
    id: `log-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    organizationId: ORG_ID,
    actorUid,
    actorRole,
    action,
    targetWorkerId,
    details: publicData(details),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  auditLogsDb.unshift(log);
}
export async function handleCreateInvitation(req, res) {
  try {
    const { workerId } = req.body;
    if (!workerId) {
      return res.status(400).json({ error: "Falta el identificador del trabajador (workerId)" });
    }
    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) {
      return res.status(404).json({ error: "Trabajador no encontrado en la base de datos" });
    }
    const tokenBuffer = crypto.randomBytes(32);
    const plainToken = tokenBuffer.toString("base64url");
    const tokenHash = hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1e3).toISOString();
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
    const origin = process.env.PUBLIC_APP_URL;
    if (!origin || !/^https:\/\//.test(origin)) return res.status(503).json({ error: "URL p\xFAblica no configurada" });
    const activationUrl = `${origin}/#activar?token=${plainToken}`;
    const qrCodeUrl = await QRCode.toDataURL(activationUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 400,
      color: {
        dark: "#0f172a",
        light: "#ffffff"
      }
    });
    const invitation = {
      id: `inv-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      workerId: worker.id,
      workerName: worker.fullName,
      organizationId: ORG_ID,
      tokenHash,
      tokenPlain: plainToken,
      // Returned in response for QR presentation, never stored
      activationUrl,
      expiresAt,
      consumed: false,
      revoked: false,
      createdByUid: state().actorUid || "system",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    workerInvitationsMap.set(tokenHash, invitation);
    worker.activationCount += 1;
    worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordAuditLog(
      state().actorUid || "system",
      "supervisor",
      "INVITATION_CREATED",
      {
        workerId: worker.id,
        workerName: worker.fullName,
        expiresAt,
        tokenHashPrefix: tokenHash.substring(0, 8)
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
      ttlHours: 48
    });
  } catch (error) {
    console.error("Error al generar invitaci\xF3n QR:", error);
    return res.status(500).json({ error: "Error interno al generar c\xF3digo QR: " + error.message });
  }
}
export async function handleVerifyInvitation(req, res) {
  try {
    const token = req.query.token;
    if (!token || typeof token !== "string" || token.length < 20) {
      return res.status(400).json({ error: "Token de activaci\xF3n inv\xE1lido o ausente" });
    }
    const tokenHash = hashToken(token);
    const invitation = workerInvitationsMap.get(tokenHash);
    if (!invitation) {
      return res.status(404).json({ error: "Invitaci\xF3n no encontrada o no v\xE1lida" });
    }
    if (invitation.revoked) {
      return res.status(403).json({ error: "Esta invitaci\xF3n ha sido revocada por el supervisor" });
    }
    if (invitation.consumed) {
      return res.status(410).json({ error: "Esta invitaci\xF3n ya fue activada previamente" });
    }
    const now = /* @__PURE__ */ new Date();
    if (new Date(invitation.expiresAt) < now) {
      return res.status(400).json({ error: "La invitaci\xF3n ha caducado (plazo de 48h vencido). Solicite un nuevo QR al supervisor" });
    }
    const worker = workersDb.find((w) => w.id === invitation.workerId);
    if (!worker) {
      return res.status(404).json({ error: "Ficha del trabajador asociada no encontrada" });
    }
    return res.json({
      valid: true,
      workerId: worker.id,
      workerName: worker.fullName,
      category: worker.category,
      organizationName: ORG_NAME,
      expiresAt: invitation.expiresAt
    });
  } catch (error) {
    console.error("Error al verificar invitaci\xF3n:", error);
    return res.status(500).json({ error: "Error al comprobar invitaci\xF3n" });
  }
}
export async function handleActivateWorker(req, res) {
  try {
    const { token, pin, email, password } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Falta el token de activaci\xF3n" });
    }
    if (!/^\d{4,6}$/.test(String(pin || ""))) return res.status(400).json({ error: "El PIN debe tener entre 4 y 6 d\xEDgitos" });
    const tokenHash = hashToken(token);
    const invitation = workerInvitationsMap.get(tokenHash);
    if (!invitation) {
      return res.status(404).json({ error: "Invitaci\xF3n inv\xE1lida" });
    }
    if (invitation.revoked) {
      return res.status(403).json({ error: "Invitaci\xF3n revocada" });
    }
    if (invitation.consumed) {
      return res.status(410).json({ error: "Esta invitaci\xF3n ya fue consumida" });
    }
    if (new Date(invitation.expiresAt) < /* @__PURE__ */ new Date()) {
      return res.status(400).json({ error: "Invitaci\xF3n caducada" });
    }
    const worker = workersDb.find((w) => w.id === invitation.workerId);
    if (!worker) {
      return res.status(404).json({ error: "Trabajador no encontrado" });
    }
    invitation.consumed = true;
    invitation.consumedAt = (/* @__PURE__ */ new Date()).toISOString();
    const newUid = `uid-${worker.id}`;
    invitation.consumedByUid = newUid;
    worker.status = "active";
    worker.firebaseAuthUid = newUid;
    worker.pinHash = hashPin(String(pin).trim());
    delete worker.pin;
    if (email) worker.email = String(email).trim().toLowerCase();
    worker.lastLoginAt = (/* @__PURE__ */ new Date()).toISOString();
    worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordAuditLog(
      newUid,
      "worker",
      "INVITATION_ACTIVATED",
      {
        workerId: worker.id,
        workerName: worker.fullName,
        mechanism: pin ? "pin_assisted" : "email_credential"
      },
      worker.id
    );
    return res.json({
      success: true,
      message: "Cuenta activada correctamente",
      worker: {
        id: worker.id,
        fullName: worker.fullName,
        category: worker.category,
        status: worker.status,
        assignedProjectIds: worker.assignedProjectIds
      },
      token: issueSession(worker.id)
    });
  } catch (error) {
    console.error("Error al activar trabajador:", error);
    return res.status(500).json({ error: "Error durante la activaci\xF3n: " + error.message });
  }
}
export async function handleWorkerLogin(req, res) {
  try {
    const { workerId, identifier, pin } = req.body;
    const lookupId = (workerId || identifier || "").trim();
    const cleanPin = (pin || "").trim();
    if (!lookupId || !cleanPin) {
      return res.status(400).json({ error: "Introduzca su identificador o tel\xE9fono y su PIN de acceso" });
    }
    const worker = workersDb.find(
      (w) => w.id === lookupId || w.phone?.replace(/\s+/g, "") === lookupId.replace(/\s+/g, "") || w.dniNie?.toUpperCase() === lookupId.toUpperCase()
    );
    if (!worker) {
      return res.status(401).json({ error: "Credenciales no reconocidas" });
    }
    if (worker.status !== "active") {
      return res.status(403).json({
        error: `Su cuenta est\xE1 en estado "${worker.status}". Contacte con su supervisor para reactivar el acceso.`
      });
    }
    if (!verifyPin(cleanPin, worker.pinHash)) {
      return res.status(401).json({ error: "PIN de acceso incorrecto" });
    }
    worker.lastLoginAt = (/* @__PURE__ */ new Date()).toISOString();
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
        phone: worker.phone
      },
      token: issueSession(worker.id)
    });
  } catch (error) {
    console.error("Error en login de trabajador:", error);
    return res.status(500).json({ error: "Error de autenticaci\xF3n" });
  }
}
export async function handleRevokeWorker(req, res) {
  try {
    const { workerId, reason } = req.body;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: "Trabajador no encontrado" });
    worker.status = "revoked";
    worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const [hash, inv] of workerInvitationsMap.entries()) {
      if (inv.workerId === worker.id) {
        inv.revoked = true;
      }
    }
    recordAuditLog(
      state().actorUid || "system",
      "supervisor",
      "WORKER_REVOKED",
      { workerId: worker.id, reason: reason || "Revocaci\xF3n por supervisor" },
      worker.id
    );
    return res.json({ success: true, message: "Acceso revocado de inmediato" });
  } catch (error) {
    console.error("Error al revocar trabajador:", error);
    return res.status(500).json({ error: "Error al revocar acceso" });
  }
}
export async function handleTimeRecord(req, res) {
  try {
    const { workerId, projectId, type, notes, location } = req.body;
    if (!workerId || !projectId || !type) {
      return res.status(400).json({ error: "Faltan campos obligatorios (workerId, projectId, type)" });
    }
    if (type !== "check_in" && type !== "check_out") {
      return res.status(400).json({ error: "Tipo debe ser check_in o check_out" });
    }
    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: "Trabajador no encontrado" });
    if (worker.status !== "active") {
      return res.status(403).json({ error: "Cuenta no activa. No puede registrar fichajes" });
    }
    if (!worker.assignedProjectIds.includes(projectId)) {
      return res.status(403).json({ error: "No est\xE1 autorizado a fichar en esta obra" });
    }
    const project = projectsDb.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ error: "Obra no encontrada" });
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let hoursWorked;
    let calculatedCost;
    if (type === "check_out") {
      const recentCheckIn = timeRecordsDb.filter((tr) => tr.workerId === worker.id && tr.projectId === projectId && tr.type === "check_in").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      if (recentCheckIn) {
        const startMs = new Date(recentCheckIn.timestamp).getTime();
        const endMs = new Date(nowIso).getTime();
        const diffHours = (endMs - startMs) / (1e3 * 60 * 60);
        hoursWorked = Math.max(0.1, Math.min(14, Number(diffHours.toFixed(2))));
      } else {
        hoursWorked = 8;
      }
      calculatedCost = Number((hoursWorked * worker.hourlyRate).toFixed(2));
      project.laborCostTotal = Number((project.laborCostTotal + calculatedCost).toFixed(2));
    }
    const record = {
      id: `tr-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      workerId: worker.id,
      workerName: worker.fullName,
      firebaseAuthUid: worker.firebaseAuthUid || `uid-${worker.id}`,
      organizationId: ORG_ID,
      projectId: project.id,
      projectName: project.name,
      type,
      timestamp: nowIso,
      location,
      notes: notes || (type === "check_in" ? "Entrada registrada en obra" : "Salida registrada en obra"),
      hoursWorked,
      hourlyRate: worker.hourlyRate,
      calculatedCost,
      status: "valid",
      createdAt: nowIso
    };
    timeRecordsDb.unshift(record);
    recordAuditLog(
      worker.id,
      "worker",
      type === "check_in" ? "TIME_CHECK_IN" : "TIME_CHECK_OUT",
      {
        projectId: project.id,
        projectName: project.name,
        hoursWorked,
        calculatedCost,
        updatedProjectLaborTotal: project.laborCostTotal
      },
      worker.id
    );
    return res.json({
      success: true,
      record,
      project: {
        id: project.id,
        name: project.name,
        laborCostTotal: project.laborCostTotal
      },
      message: type === "check_in" ? `Entrada registrada con \xE9xito en ${project.name}` : `Salida registrada. ${hoursWorked}h computadas (+${calculatedCost}\u20AC imputados a la obra)`
    });
  } catch (error) {
    console.error("Error al registrar fichaje:", error);
    return res.status(500).json({ error: "Error al procesar fichaje: " + error.message });
  }
}
export async function handleGetWorkerTimeRecords(req, res) {
  try {
    const workerId = req.query.workerId;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const records = timeRecordsDb.filter((tr) => tr.workerId === workerId);
    return res.json({ records });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
export async function handleGetWorkerDocuments(req, res) {
  try {
    const workerId = req.query.workerId;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const documents = workerDocumentsDb.filter((doc) => doc.workerId === workerId);
    return res.json({ documents });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
export async function handleSignDocument(req, res) {
  try {
    const { docId, workerId } = req.body;
    const document = workerDocumentsDb.find((d) => d.id === docId && d.workerId === workerId);
    if (!document) return res.status(404).json({ error: "Documento no encontrado o no autorizado" });
    document.signed = true;
    document.signedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordAuditLog(
      workerId,
      "worker",
      "DOCUMENT_SIGNED",
      { docId: document.id, title: document.title },
      workerId
    );
    return res.json({ success: true, document });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
export async function handleGetWorkerProjects(req, res) {
  try {
    const workerId = req.query.workerId;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: "Trabajador no encontrado" });
    const authorized = projectsDb.filter((p) => worker.assignedProjectIds.includes(p.id));
    return res.json({ projects: authorized });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
