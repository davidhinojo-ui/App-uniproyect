import type { Worker, Project, TimeRecord, WorkerDocument, AuditLog, WorkerInvitation } from '../types/index.js';
export type DocumentWrite = { collection: string; id: string; action: 'set' | 'delete'; data?: any };
export interface PortalState {
  organizationId: string; organizationName: string; workers: Worker[]; projects: Project[];
  records: TimeRecord[]; documents: WorkerDocument[]; logs: AuditLog[];
  invitations: Map<string, WorkerInvitation>;
  sessions: Record<string, { workerId: string; expiresAt: number }>;
  attempts: Record<string, { count: number; until: number }>;
}
export function decodeState(organizationId: string, organizationName: string, value: any = {}): PortalState {
  return { organizationId, organizationName, workers: value.workers || [], projects: value.projects || [],
    records: value.records || [], documents: value.documents || [], logs: value.logs || [],
    invitations: new Map(value.invitations || []), sessions: value.sessions || {}, attempts: value.attempts || {} };
}
export function encodeState(state: PortalState) {
  const now = Date.now();
  state.sessions = Object.fromEntries(Object.entries(state.sessions).filter(([, session]) => session.expiresAt > now));
  state.attempts = Object.fromEntries(Object.entries(state.attempts).filter(([, attempt]) => attempt.until > now));
  return JSON.parse(JSON.stringify({ ...state, invitations: [...state.invitations] }));
}
