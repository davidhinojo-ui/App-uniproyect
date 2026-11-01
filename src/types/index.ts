export type WorkerStatus = 'pending' | 'active' | 'suspended' | 'revoked';

export interface Worker {
  id: string;
  organizationId: string;
  fullName: string;
  dniNie: string;
  category: string;
  hourlyRate: number; // Coste/hora en € para imputación automática a obras
  assignedProjectIds: string[]; // Obras en las que está autorizado a fichar
  status: WorkerStatus;
  firebaseAuthUid?: string | null;
  email?: string;
  phone?: string;
  pinHash?: string; // Server only; never returned by APIs
  pin?: string; // Para modalidad B (PIN numérico de 4-6 dígitos)
  activationCount: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerInvitation {
  id: string;
  workerId: string;
  workerName: string;
  organizationId: string;
  tokenHash: string;
  tokenPlain?: string; // Solo en respuesta temporal de generación para construir QR
  qrCodeUrl?: string;  // Data URL base64 del código QR generado
  activationUrl: string;
  expiresAt: string;
  consumed: boolean;
  consumedAt?: string;
  consumedByUid?: string;
  revoked: boolean;
  createdByUid: string;
  createdAt: string;
}

export type TimeRecordType = 'check_in' | 'check_out';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
}

export interface TimeRecord {
  id: string;
  workerId: string;
  workerName: string;
  firebaseAuthUid: string;
  organizationId: string;
  projectId: string;
  projectName: string;
  type: TimeRecordType;
  timestamp: string;
  location?: LocationCoordinates;
  notes?: string;
  hoursWorked?: number;
  hourlyRate?: number;
  calculatedCost?: number; // Gasto imputado = hoursWorked * hourlyRate
  status: 'valid' | 'pending_review' | 'rejected';
  createdAt: string;
}

export type DocumentType = 'payroll' | 'contract' | 'safety_prl' | 'certificate' | 'medical';

export interface WorkerDocument {
  id: string;
  workerId: string;
  organizationId: string;
  title: string;
  type: DocumentType;
  period?: string;
  fileUrl: string;
  fileSize?: number;
  uploadedAt: string;
  signed: boolean;
  signedAt?: string;
}

export interface Project {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  address: string;
  client: string;
  status: 'active' | 'paused' | 'completed';
  supervisorName: string;
  laborCostTotal: number; // Total acumulado por fichajes de trabajadores
  materialCostTotal?: number;
  budget?: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorUid: string;
  actorRole: 'supervisor' | 'worker' | 'system';
  action: string;
  targetWorkerId?: string;
  details: Record<string, any>;
  timestamp: string;
}
