import { AsyncLocalStorage } from 'node:async_hooks';
import type { Worker, Project, TimeRecord, WorkerDocument, WorkerInvitation, AuditLog } from '../types/index.js';
export type Session = { id: string; workerId: string; expiresAt: number; credentialVersion: string };
export type Attempt = { id: string; count: number; until: number };
export interface State {
 workers: Worker[]; projects: Project[]; records: TimeRecord[]; documents: WorkerDocument[];
 invitations: Map<string, WorkerInvitation>; audit: AuditLog[]; sessions: Session[]; attempts: Attempt[];
 actorUid?: string;
}
export const context = new AsyncLocalStorage<State>();
export function state(): State { const s=context.getStore(); if(!s) throw new Error('Transaction context required'); return s; }
export function list<K extends keyof State>(key: K): State[K] {
 return new Proxy([], { get(_, p) { const a=state()[key] as any; const v=a[p]; return typeof v==='function'?v.bind(a):v; }, set(_,p,v){(state()[key] as any)[p]=v;return true;} }) as unknown as State[K];
}
export const invitations = new Proxy(new Map<string, WorkerInvitation>(), { get(_,p){const m=state().invitations;const v=(m as any)[p];return typeof v==='function'?v.bind(m):v;} });
