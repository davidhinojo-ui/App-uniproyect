// src/server/workerPortalService.ts
import crypto from "crypto";

// src/server/shiftValidation.ts
function validateShift(records, workerId, projectId, type, now) {
  const latest = records.filter((record) => record.workerId === workerId).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  if (type === "check_in") {
    return latest?.type === "check_in" ? { error: "Ya existe una entrada abierta. Registre la salida antes de volver a entrar." } : {};
  }
  if (!latest || latest.type !== "check_in") {
    return { error: "No existe una entrada abierta para registrar esta salida." };
  }
  if (latest.projectId !== projectId) {
    return { error: "La salida debe corresponder a la obra de la entrada abierta." };
  }
  const elapsed = Date.parse(now) - Date.parse(latest.timestamp);
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    return { error: "La fecha de la entrada no permite calcular la jornada." };
  }
  return { hoursWorked: Math.min(14, Number((elapsed / 36e5).toFixed(2))) };
}

// src/server/workerPortalService.ts
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
var ORG_ID = "org-jose-real";
var ORG_NAME = "Jos\xE9 Real Construcciones, S.L.";
var firestoreDb = null;
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    firestoreDb = getFirestore(app, config.firestoreDatabaseId);
    console.log("[WorkerPortalService] Firestore inicializado con base de datos:", config.firestoreDatabaseId);
  }
} catch (e) {
  console.warn("[WorkerPortalService] Inicializaci\xF3n de Firestore omitida o fallida:", e);
}
var projectsDb = [
  {
    id: "obra-1788795466519",
    organizationId: ORG_ID,
    code: "OBRA-REHAB",
    name: "REHABILITACION CIBIERTA EDIF. RESIDENCIAL",
    address: "Arcos de la Frontera",
    client: "Comunidad de Propietarios",
    status: "active",
    supervisorName: "David Hinojo (Supervisor General)",
    budget: 45e3,
    laborCostTotal: 0,
    createdAt: "2026-09-01T08:00:00Z"
  },
  {
    id: "obra-1788795466897",
    organizationId: ORG_ID,
    code: "100626",
    name: "100626_Obra Tom\xE1s Garc\xEDa Figueras",
    address: "Jerez de la Frontera",
    client: "Tom\xE1s Garc\xEDa Figueras",
    status: "active",
    supervisorName: "David Hinojo (Supervisor General)",
    budget: 85e3,
    laborCostTotal: 0,
    createdAt: "2026-09-15T08:00:00Z"
  },
  {
    id: "obra-1788795467133",
    organizationId: ORG_ID,
    code: "OBRA-ESPERA",
    name: "REFORMA ESPERA",
    address: "Espera (C\xE1diz)",
    client: "Reforma Integral Vivienda",
    status: "active",
    supervisorName: "David Hinojo (Supervisor General)",
    budget: 32e3,
    laborCostTotal: 0,
    createdAt: "2026-09-20T08:00:00Z"
  },
  {
    id: "obra-1792510754303",
    organizationId: ORG_ID,
    code: "OBRA-AGUAS",
    name: "PLAZA DE LAS AGUAS",
    address: "Arcos de la Frontera",
    client: "Ayuntamiento de Arcos",
    status: "active",
    supervisorName: "David Hinojo (Supervisor General)",
    budget: 12e4,
    laborCostTotal: 0,
    createdAt: "2026-10-01T08:00:00Z"
  },
  {
    id: "obra-1793129569377",
    organizationId: ORG_ID,
    code: "OBRA-PERRO",
    name: "CUESTA EL PERRO",
    address: "Arcos de la Frontera",
    client: "Pavimentaci\xF3n y Accesos",
    status: "active",
    supervisorName: "David Hinojo (Supervisor General)",
    budget: 64e3,
    laborCostTotal: 0,
    createdAt: "2026-10-10T08:00:00Z"
  }
];
var workersDb = [
  {
    id: "trab-emp-1788362023057",
    organizationId: ORG_ID,
    fullName: "JOSE MANUEL ORDO\xD1EZ ROND\xC1N",
    dniNie: "44052426C",
    category: "Encargado de Obra",
    hourlyRate: 22,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    phone: "653284276",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1788447093726",
    organizationId: ORG_ID,
    fullName: "JUAN PABLO MANCHE\xD1O PERDIGONES",
    dniNie: "31714722E",
    category: "Oficial de 1\xAA Alba\xF1il",
    hourlyRate: 18.5,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1788447139258",
    organizationId: ORG_ID,
    fullName: "ALFONSO LUIS FLORES MACIAS",
    dniNie: "75776604E",
    category: "Pe\xF3n Especialista",
    hourlyRate: 15.5,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1788447322110",
    organizationId: ORG_ID,
    fullName: "RAFAEL JIMENEZ GALINDO",
    dniNie: "53154499G",
    category: "Oficial de 1\xAA Alba\xF1il",
    hourlyRate: 18.5,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1788448423610",
    organizationId: ORG_ID,
    fullName: "ANDR\xC9S MANCHE\xD1O LOPEZ",
    dniNie: "",
    category: "Oficial de 1\xAA Alba\xF1il",
    hourlyRate: 18,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1788448552984",
    organizationId: ORG_ID,
    fullName: "DAVID BAREA FERNANDEZ",
    dniNie: "",
    category: "Oficial de 1\xAA Alba\xF1il",
    hourlyRate: 18,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1788448806082",
    organizationId: ORG_ID,
    fullName: "ABRAHAM MANCHE\xD1O LOPEZ",
    dniNie: "32057606E",
    category: "Gruista",
    hourlyRate: 20,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1791209906770",
    organizationId: ORG_ID,
    fullName: "Jes\xFAs Collantes",
    dniNie: "",
    category: "Pe\xF3n Ordinario",
    hourlyRate: 14.5,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1791210035818",
    organizationId: ORG_ID,
    fullName: "MARCOS JESUS COLLANTES GUERRERO",
    dniNie: "31737970V",
    category: "Oficial de 1\xAA Alba\xF1il",
    hourlyRate: 18.5,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  },
  {
    id: "trab-emp-1791297516908",
    organizationId: ORG_ID,
    fullName: "JORGE NAVES",
    dniNie: "74927270D",
    category: "Oficial de 1\xAA Alba\xF1il",
    hourlyRate: 18,
    assignedProjectIds: ["obra-1788795466897", "obra-1788795466519", "obra-1788795467133", "obra-1792510754303", "obra-1793129569377"],
    status: "active",
    activationCount: 1,
    createdAt: "2026-09-01T08:00:00Z",
    updatedAt: "2026-10-31T08:00:00Z"
  }
];
async function syncFromFirestore() {
  if (!firestoreDb) return;
  try {
    const [workersSnap, obrasSnap] = await Promise.all([
      getDocs(collection(firestoreDb, "plantillaTrabajadores")),
      getDocs(collection(firestoreDb, "obras"))
    ]);
    if (!obrasSnap.empty) {
      projectsDb.length = 0;
      obrasSnap.forEach((d) => {
        const data = d.data();
        projectsDb.push({
          id: d.id,
          organizationId: ORG_ID,
          code: data.code || d.id,
          name: data.name,
          address: data.location || "",
          client: data.description || "",
          status: data.status === "on_hold" ? "paused" : data.status || "active",
          supervisorName: "David Hinojo (Supervisor General)",
          budget: Number(data.budget) || 0,
          laborCostTotal: 0,
          createdAt: data.startDate || (/* @__PURE__ */ new Date()).toISOString()
        });
      });
    }
    if (!workersSnap.empty) {
      workersDb.length = 0;
      workersSnap.forEach((d) => {
        const data = d.data();
        const stdRate = Number(data.standardHourlyRate) || Number(data.hourlyRate) || (data.dailyRate ? Number((data.dailyRate / 8).toFixed(2)) : void 0) || 18;
        workersDb.push({
          id: d.id,
          organizationId: ORG_ID,
          fullName: data.name,
          dniNie: data.dni || "",
          category: data.role || "Oficial de Obra",
          hourlyRate: stdRate,
          assignedProjectIds: projectsDb.map((p) => p.id),
          status: data.active === false ? "suspended" : "active",
          phone: data.phone || "",
          activationCount: 1,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      });
    }
    console.log(`[WorkerPortalService] Sincronizaci\xF3n exitosa: ${workersDb.length} trabajadores y ${projectsDb.length} obras reales.`);
  } catch (err) {
    console.warn("[WorkerPortalService] Fallo al sincronizar desde Firestore:", err);
  }
}
var workerDocumentsDb = [];
var timeRecordsDb = [];
var workerInvitationsMap = /* @__PURE__ */ new Map();
var auditLogsDb = [
  {
    id: "log-001",
    organizationId: ORG_ID,
    actorUid: "supervisor-david",
    actorRole: "supervisor",
    action: "SYSTEM_BOOTSTRAP",
    details: { message: "Inicializaci\xF3n de control horario y portal de trabajadores" },
    timestamp: "2026-10-31T06:00:00Z"
  }
];
function hashToken(plainToken) {
  return crypto.createHash("sha256").update(plainToken).digest("hex");
}
function recordAuditLog(actorUid, actorRole, action, details, targetWorkerId) {
  const log = {
    id: `log-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    organizationId: ORG_ID,
    actorUid,
    actorRole,
    action,
    targetWorkerId,
    details,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  auditLogsDb.unshift(log);
  if (auditLogsDb.length > 500) auditLogsDb.pop();
}
async function handleCreateInvitation(req, res) {
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
    const origin = `${protocol}://${host}`;
    const activationUrl = `${origin}/#portal?w=${encodeURIComponent(worker.id)}&token=${encodeURIComponent(plainToken)}`;
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
      createdByUid: "supervisor-david",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    workerInvitationsMap.set(tokenHash, invitation);
    worker.activationCount += 1;
    worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordAuditLog(
      "supervisor-david",
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
async function handleVerifyInvitation(req, res) {
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
async function handleActivateWorker(req, res) {
  try {
    const { token, pin, email, password } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Falta el token de activaci\xF3n" });
    }
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
    if (pin) worker.pin = String(pin).trim();
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
      token: `auth-token-${worker.id}-${Date.now()}`
    });
  } catch (error) {
    console.error("Error al activar trabajador:", error);
    return res.status(500).json({ error: "Error durante la activaci\xF3n: " + error.message });
  }
}
async function handleWorkerLogin(req, res) {
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
    if (!worker.pin || worker.pin !== cleanPin) {
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
      token: `auth-token-${worker.id}-${Date.now()}`
    });
  } catch (error) {
    console.error("Error en login de trabajador:", error);
    return res.status(500).json({ error: "Error de autenticaci\xF3n" });
  }
}
async function handleRevokeWorker(req, res) {
  try {
    const workerId = req.body.workerId || req.params.id;
    const reason = req.body.reason;
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
      "gerente",
      "supervisor",
      "WORKER_PORTAL_REVOKED",
      { workerId: worker.id, fullName: worker.fullName, reason: reason || "Portal eliminado/revocado por el Gerente" },
      worker.id
    );
    return res.json({ success: true, message: `Portal revocado para ${worker.fullName}` });
  } catch (error) {
    console.error("Error al revocar trabajador:", error);
    return res.status(500).json({ error: "Error al revocar portal: " + error.message });
  }
}
async function handleActivateWorkerPortal(req, res) {
  try {
    const workerId = req.body.workerId || req.params.id;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: "Trabajador no encontrado" });
    worker.status = "active";
    worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    recordAuditLog(
      "gerente",
      "supervisor",
      "WORKER_PORTAL_ACTIVATED",
      { workerId: worker.id, fullName: worker.fullName },
      worker.id
    );
    return res.json({ success: true, message: `Portal reactivado para ${worker.fullName}`, worker });
  } catch (error) {
    console.error("Error al reactivar portal:", error);
    return res.status(500).json({ error: error.message });
  }
}
async function handleDeleteWorker(req, res) {
  try {
    const workerId = req.params.id || req.body.workerId;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const idx = workersDb.findIndex((w) => w.id === workerId);
    if (idx === -1) return res.status(404).json({ error: "Trabajador no encontrado" });
    const worker = workersDb[idx];
    workersDb.splice(idx, 1);
    for (const [hash, inv] of workerInvitationsMap.entries()) {
      if (inv.workerId === workerId) {
        workerInvitationsMap.delete(hash);
      }
    }
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, "plantillaTrabajadores", workerId));
        console.log(`[WorkerPortalService] Tarjeta de trabajador eliminada de Firestore: ${workerId}`);
      } catch (fErr) {
        console.warn("[WorkerPortalService] Error al eliminar de Firestore plantillaTrabajadores:", fErr);
      }
    }
    recordAuditLog(
      "gerente",
      "supervisor",
      "WORKER_DELETED",
      { workerId, fullName: worker.fullName },
      workerId
    );
    return res.json({ success: true, message: `Tarjeta de ${worker.fullName} eliminada correctamente`, workerId });
  } catch (error) {
    console.error("Error al eliminar trabajador:", error);
    return res.status(500).json({ error: "Error al eliminar trabajador: " + error.message });
  }
}
async function handleUpdateWorker(req, res) {
  try {
    const workerId = req.params.id || req.body.workerId;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: "Trabajador no encontrado" });
    const { fullName, category, hourlyRate, assignedProjectIds, status, email, phone, dniNie } = req.body;
    if (fullName) worker.fullName = fullName;
    if (dniNie !== void 0) worker.dniNie = dniNie;
    if (category) worker.category = category;
    if (hourlyRate !== void 0 && !isNaN(Number(hourlyRate))) {
      worker.hourlyRate = Number(hourlyRate);
    }
    if (assignedProjectIds) worker.assignedProjectIds = assignedProjectIds;
    if (status) worker.status = status;
    if (email !== void 0) worker.email = email;
    if (phone !== void 0) worker.phone = phone;
    worker.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (firestoreDb) {
      try {
        await setDoc(doc(firestoreDb, "plantillaTrabajadores", worker.id), {
          id: worker.id,
          name: worker.fullName,
          role: worker.category,
          standardHourlyRate: worker.hourlyRate,
          hourlyRate: worker.hourlyRate,
          dailyRate: Math.round(worker.hourlyRate * 8),
          overtimeHourlyRate: Number((worker.hourlyRate * 1.35).toFixed(2)),
          phone: worker.phone || "",
          dni: worker.dniNie || "",
          active: worker.status === "active",
          updatedAt: worker.updatedAt
        }, { merge: true });
        console.log(`[WorkerPortalService] Tarifa de trabajador actualizada en Firestore: ${worker.fullName} -> ${worker.hourlyRate}\u20AC/h`);
      } catch (fErr) {
        console.warn("[WorkerPortalService] Error actualizando plantillaTrabajadores en Firestore:", fErr);
      }
    }
    recordAuditLog("supervisor-david", "supervisor", "WORKER_UPDATED", { workerId: worker.id, hourlyRate: worker.hourlyRate, changes: req.body }, worker.id);
    return res.json({ success: true, worker });
  } catch (err) {
    console.error("Error al actualizar trabajador:", err);
    return res.status(500).json({ error: err.message });
  }
}
async function handleApproveTimeRecord(req, res) {
  try {
    const recordId = req.params.id || req.body.recordId;
    const { managerName, notes, signature } = req.body;
    if (!recordId) return res.status(400).json({ error: "Falta recordId" });
    const record = timeRecordsDb.find((r) => r.id === recordId);
    if (!record) return res.status(404).json({ error: "Fichaje no encontrado" });
    const worker = workersDb.find((w) => w.id === record.workerId);
    const hourlyRate = record.hourlyRate || worker?.hourlyRate || (worker?.dailyRate ? Number((worker.dailyRate / 8).toFixed(2)) : 18);
    const hours = record.hoursWorked || 8;
    const totalCost = Number((record.calculatedCost || hours * hourlyRate).toFixed(2));
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    record.status = "valid";
    record.approvalStatus = "approved";
    record.approvedAt = nowIso;
    record.managerName = managerName || "Gerente de Obra";
    record.managerSignature = signature;
    record.managerNotes = notes;
    const costId = `cost-fichaje-${record.id}`;
    if (firestoreDb) {
      try {
        const personalDoc = {
          id: costId,
          obraId: record.projectId,
          workerName: record.workerName,
          workerCatalogId: record.workerId,
          date: record.timestamp ? record.timestamp.split("T")[0] : nowIso.split("T")[0],
          role: worker?.category || "Oficial de Obra",
          hours,
          hourlyRate,
          totalCost,
          costType: "horas",
          notes: `[Visto Bueno Gerente: ${managerName || "Gerente"}] Fichaje Portal en ${record.projectName || "Obra"}. ${notes || ""}`.trim(),
          fichajeId: record.id,
          createdAt: nowIso
        };
        await setDoc(doc(firestoreDb, "personal", costId), personalDoc);
        console.log(`[WorkerPortalService] Coste imputado en Firestore 'personal' (${costId}): ${totalCost}\u20AC a obra ${record.projectId}`);
        await setDoc(doc(firestoreDb, "fichajes", record.id), {
          id: record.id,
          workerId: record.workerId,
          workerName: record.workerName,
          obraId: record.projectId,
          obraName: record.projectName,
          date: record.timestamp ? record.timestamp.split("T")[0] : nowIso.split("T")[0],
          totalHours: hours,
          hourlyRate,
          calculatedCost: totalCost,
          status: "completed",
          approvalStatus: "approved",
          approvedAt: nowIso,
          foremanName: managerName || "Gerente de Obra",
          foremanSignature: signature || "",
          foremanNotes: notes || "",
          personalCostId: costId,
          updatedAt: nowIso
        }, { merge: true });
      } catch (fsErr) {
        console.error("[WorkerPortalService] Error al escribir coste en Firestore:", fsErr);
      }
    }
    const project = projectsDb.find((p) => p.id === record.projectId);
    if (project) {
      project.laborCostTotal = Number(((project.laborCostTotal || 0) + totalCost).toFixed(2));
    }
    recordAuditLog(
      "gerente",
      "supervisor",
      "TIME_RECORD_APPROVED",
      {
        recordId: record.id,
        workerName: record.workerName,
        projectId: record.projectId,
        costAdded: totalCost,
        managerName: managerName || "Gerente"
      },
      record.workerId
    );
    return res.json({
      success: true,
      message: `Visto bueno otorgado por el Gerente. ${totalCost.toFixed(2)}\u20AC imputados a la obra`,
      record,
      costId,
      totalCost
    });
  } catch (error) {
    console.error("Error al aprobar fichaje:", error);
    return res.status(500).json({ error: error.message });
  }
}
async function handleTimeRecord(req, res) {
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
      return res.status(403).json({ error: "El portal de este trabajador est\xE1 inactivo o ha sido revocado. Contacte con el Gerente." });
    }
    const project = projectsDb.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ error: "Obra no encontrada en el registro" });
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let hoursWorked;
    let calculatedCost;
    const shift = validateShift(timeRecordsDb, worker.id, projectId, type, nowIso);
    if ("error" in shift) return res.status(409).json({ error: shift.error });
    hoursWorked = shift.hoursWorked;
    if (type === "check_out") {
      calculatedCost = Number(((hoursWorked ?? 0) * worker.hourlyRate).toFixed(2));
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
    record.approvalStatus = "pending";
    timeRecordsDb.unshift(record);
    if (firestoreDb) {
      try {
        const fichajeDoc = {
          id: record.id,
          workerId: worker.id,
          workerName: worker.fullName,
          workerDni: worker.dniNie || "",
          role: worker.category,
          obraId: project.id,
          obraName: project.name,
          date: nowIso.split("T")[0],
          clockIn: type === "check_in" ? new Date(nowIso).toTimeString().slice(0, 5) : "08:00",
          clockOut: type === "check_out" ? new Date(nowIso).toTimeString().slice(0, 5) : "",
          breakMinutes: 0,
          totalHours: hoursWorked || 0,
          regularHours: hoursWorked ? Math.min(8, hoursWorked) : 0,
          overtimeHours: hoursWorked ? Math.max(0, hoursWorked - 8) : 0,
          hourlyRate: worker.hourlyRate,
          overtimeRate: Number((worker.hourlyRate * 1.35).toFixed(2)),
          calculatedCost: calculatedCost || 0,
          status: type === "check_out" ? "completed" : "active",
          approvalStatus: "pending",
          notes: record.notes || "",
          locationCoords: location ? { latitude: location.latitude, longitude: location.longitude } : void 0,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        await setDoc(doc(firestoreDb, "fichajes", record.id), fichajeDoc);
      } catch (fErr) {
        console.warn("[WorkerPortalService] No se pudo escribir en Firestore fichajes:", fErr);
      }
    }
    recordAuditLog(
      worker.id,
      "worker",
      type === "check_in" ? "TIME_CHECK_IN" : "TIME_CHECK_OUT",
      {
        projectId: project.id,
        projectName: project.name,
        hoursWorked,
        calculatedCost,
        approvalStatus: "pending"
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
      message: type === "check_in" ? `Entrada registrada con \xE9xito en ${project.name}` : `Salida registrada (${hoursWorked}h). Fichaje enviado al Gerente para visto bueno e imputaci\xF3n de costes.`
    });
  } catch (error) {
    console.error("Error al registrar fichaje:", error);
    return res.status(500).json({ error: "Error al procesar fichaje: " + error.message });
  }
}
async function handleGetWorkerTimeRecords(req, res) {
  try {
    const workerId = req.query.workerId;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const records = timeRecordsDb.filter((tr) => tr.workerId === workerId);
    return res.json({ records });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
async function handleGetWorkerDocuments(req, res) {
  try {
    const workerId = req.query.workerId;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const documents = workerDocumentsDb.filter((doc2) => doc2.workerId === workerId);
    return res.json({ documents });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
async function handleSignDocument(req, res) {
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
async function handleGetWorkerProjects(req, res) {
  try {
    const workerId = req.query.workerId;
    if (!workerId) return res.status(400).json({ error: "Falta workerId" });
    const worker = workersDb.find((w) => w.id === workerId);
    if (!worker) return res.status(404).json({ error: "Trabajador no encontrado" });
    const authorized = projectsDb.filter(
      (p) => !worker.assignedProjectIds || worker.assignedProjectIds.length === 0 || worker.assignedProjectIds.includes(p.id)
    );
    return res.json({ projects: authorized.length > 0 ? authorized : projectsDb });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
export {
  auditLogsDb,
  firestoreDb,
  handleActivateWorker,
  handleActivateWorkerPortal,
  handleApproveTimeRecord,
  handleCreateInvitation,
  handleDeleteWorker,
  handleGetWorkerDocuments,
  handleGetWorkerProjects,
  handleGetWorkerTimeRecords,
  handleRevokeWorker,
  handleSignDocument,
  handleTimeRecord,
  handleUpdateWorker,
  handleVerifyInvitation,
  handleWorkerLogin,
  hashToken,
  projectsDb,
  recordAuditLog,
  syncFromFirestore,
  timeRecordsDb,
  workerDocumentsDb,
  workerInvitationsMap,
  workersDb
};
