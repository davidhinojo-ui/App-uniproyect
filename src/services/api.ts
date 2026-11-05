import { authorizedFetch } from '../supabase/http.js';
import { Worker, WorkerInvitation, TimeRecord, WorkerDocument, Project, AuditLog } from '../types/index.js';

const API_BASE = '/api';

export const api = {
  async getCurrentWorker(): Promise<Worker> { const response = await authorizedFetch('/api/worker-portal/me'); if (!response.ok) throw new Error('Inicia sesión en tu portal'); return (await response.json()).worker; },
  // SUPERVISOR: Workers
  async getWorkers(): Promise<Worker[]> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/workers`);
    if (!res.ok) throw new Error('Error al cargar trabajadores');
    const data = await res.json();
    return data.workers;
  },

  async createWorker(workerData: Partial<Worker>): Promise<Worker> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/workers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workerData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear trabajador');
    return data.worker;
  },

  async updateWorker(id: string, updates: Partial<Worker>): Promise<Worker> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/workers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar trabajador');
    return data.worker;
  },

  // SUPERVISOR: Create QR Invitation
  async createInvitation(workerId: string): Promise<WorkerInvitation> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al generar invitación QR');
    return data;
  },

  async deleteWorker(id: string): Promise<void> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/workers/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar trabajador');
  },

  // SUPERVISOR: Revoke
  async revokeWorker(workerId: string, reason?: string): Promise<void> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/workers/${workerId}/revoke-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al revocar acceso al portal');
  },

  async revokePortal(workerId: string, reason?: string): Promise<void> {
    return this.revokeWorker(workerId, reason);
  },

  async activatePortal(workerId: string): Promise<Worker> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/workers/${workerId}/activate-portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al reactivar portal');
    return data.worker;
  },

  async approveTimeRecord(
    recordId: string,
    options?: { managerName?: string; notes?: string; signature?: string }
  ): Promise<any> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/time-records/${recordId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al dar visto bueno al fichaje');
    return data;
  },

  // WORKER: Verify Token
  async verifyInvitation(token: string): Promise<{
    valid: boolean;
    workerId: string;
    workerName: string;
    category: string;
    organizationName: string;
    expiresAt: string;
  }> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/verify?token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invitación no válida');
    return data;
  },

  // WORKER: Activate Account
  async activateWorker(params: {
    token: string;
    pin?: string;
    email?: string;
    password?: string;
  }): Promise<{ worker: Partial<Worker>; token: string }> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al activar portal');
    return data;
  },

  // WORKER: Login
  async workerLogin(identifier: string, pin: string): Promise<{ worker: Worker; token: string }> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, pin }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    return data;
  },

  // WORKER: Clock-in / Clock-out
  async recordTime(params: {
    workerId: string;
    projectId: string;
    type: 'check_in' | 'check_out';
    notes?: string;
    location?: any;
  }): Promise<{ record: TimeRecord; project: Partial<Project>; message: string }> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/time-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar fichaje');
    return data;
  },

  // WORKER: Isolated queries
  async getMyTimeRecords(workerId: string): Promise<TimeRecord[]> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/time-records?workerId=${encodeURIComponent(workerId)}`);
    if (!res.ok) throw new Error('Error al obtener fichajes');
    const data = await res.json();
    return data.records;
  },

  async getMyDocuments(workerId: string): Promise<WorkerDocument[]> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/documents?workerId=${encodeURIComponent(workerId)}`);
    if (!res.ok) throw new Error('Error al obtener documentos');
    const data = await res.json();
    return data.documents;
  },

  async signDocument(docId: string, workerId: string): Promise<WorkerDocument> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/documents/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, workerId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al firmar documento');
    return data.document;
  },

  async getMyProjects(workerId: string): Promise<Project[]> {
    const res = await authorizedFetch(`${API_BASE}/worker-portal/projects?workerId=${encodeURIComponent(workerId)}`);
    if (!res.ok) throw new Error('Error al obtener obras asignadas');
    const data = await res.json();
    return data.projects;
  },

  // SUPERVISOR: General data
  async getAllProjects(): Promise<Project[]> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/projects`);
    if (!res.ok) throw new Error('Error al cargar obras');
    const data = await res.json();
    return data.projects;
  },

  async getAllTimeRecords(): Promise<TimeRecord[]> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/time-records`);
    if (!res.ok) throw new Error('Error al cargar registro general de fichajes');
    const data = await res.json();
    return data.records;
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await authorizedFetch(`${API_BASE}/supervisor/audit-logs`);
    if (!res.ok) throw new Error('Error al cargar auditoría');
    const data = await res.json();
    return data.logs;
  },
};
