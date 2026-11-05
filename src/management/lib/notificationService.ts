/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../firebase';
import { doc, setDoc, collection } from '../../supabase/documentCompat';
import { getObraOverheadAllocationMap } from '../types';
import { sanitizeForFirestore } from './firestoreSanitizer';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type: 'document_import' | 'budget_warning' | 'system';
  read: boolean;
  meta?: {
    docId?: string;
    obraId?: string;
    percentage?: number;
    docNumber?: string;
  };
}

// Request permission for native system push notifications
export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones de escritorio.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Error solicitando permisos de notificación:', err);
    return false;
  }
}

// Retrieve current native notification permission status
export function getPushPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

// Play sublte audio sound effect for a push notification
export function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Play a dual-tone premium pleasant slide chime (emerald branding chime)
    const now = audioContext.currentTime;
    
    // First tone (D5)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5 chime up
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);
    
    // Second tone (A5) slightly delayed
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08); // A5
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.55);
    
  } catch (err) {
    console.warn('La reproducción de audio de notificación fue bloqueada o no soportada:', err);
  }
}

/**
 * Trigger a push notification.
 * This triggers:
 * 1. A native browser notification (if permission granted).
 * 2. A pleasant pleasant UI audio chime.
 * 3. Records the log entry in local systems and Firestore (if uid is provided).
 */
export async function sendPushNotification(
  notificationOrUid: string | null | Omit<AppNotification, 'id' | 'timestamp' | 'read'>,
  maybeInput?: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
): Promise<AppNotification> {
  const notificationInput = (typeof notificationOrUid === 'object' && notificationOrUid !== null)
    ? notificationOrUid
    : (maybeInput || { title: 'Notificación', body: '', type: 'system' });

  const newNotification: AppNotification = {
    ...notificationInput,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };

  // 1. Play alert chime sound
  playNotificationSound();

  // 2. Spawn native system tray push notification if permitted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(newNotification.title, {
        body: newNotification.body,
        icon: '/assets/logo.png', // Or placeholder
        tag: newNotification.type,
      });
    } catch (e) {
      console.warn('Fallo al spawnear notificación nativa:', e);
    }
  }

  // 3. Persist in cloud database
  try {
    const docRef = doc(db, 'notifications', newNotification.id);
    await setDoc(docRef, sanitizeForFirestore(newNotification));
  } catch (err) {
    console.error('No se pudo guardar la notificación en Firestore:', err);
  }

  // 4. Save to local storage cache fallback
  try {
    const cachedStr = localStorage.getItem('up_notifications') || '[]';
    const cached: AppNotification[] = JSON.parse(cachedStr);
    cached.unshift(newNotification);
    localStorage.setItem('up_notifications', JSON.stringify(cached.slice(0, 100))); // Keep last 100
  } catch (err) {
    console.warn('No se pudo cachear la notificación localmente:', err);
  }

  return newNotification;
}

/**
 * Automated manager to inspect budget limit and generate alert warnings
 * if spending exceeds 90%.
 * Persists status of warned project IDs in localStorage to prevent spamming
 * on every transaction insertion or reload.
 */
export async function checkProjectBudgetsAndNotify(
  uid: string | null,
  obras: any[],
  documentos: any[],
  personal: any[],
  gastosGenerales: any[]
): Promise<void> {
  if (obras.length === 0) return;

  const totalCompanyOverhead = gastosGenerales.reduce((acc, g) => acc + g.amount, 0) + 
                               personal.filter((p: any) => p.obraId === 'structural').reduce((acc: number, p: any) => acc + p.totalCost, 0);
  const overheadAllocationMap = getObraOverheadAllocationMap(obras, totalCompanyOverhead);

  // Read already warned budgets to avoid duplicates
  let warnedProjects: Record<string, boolean> = {};
  try {
    const saved = localStorage.getItem('up_warned_budgets');
    if (saved) warnedProjects = JSON.parse(saved);
  } catch (e) {
    console.warn(e);
  }

  let updatedWarnState = false;

  for (const obra of obras) {
    if (!obra.budget) continue;

    const oDocs = documentos.filter(d => d.obraId === obra.id);
    const oPers = personal.filter(p => p.obraId === obra.id);
    const directSpent = oDocs.reduce((acc, d) => acc + d.totalAmount, 0) + oPers.reduce((acc, p) => acc + p.totalCost, 0);
    const obraOverhead = overheadAllocationMap[obra.id]?.amount || 0;
    const spent = directSpent + obraOverhead;
    const percentage = obra.budget > 0 ? (spent / obra.budget) * 100 : 0;

    // Trigger warning if exceeds 90%
    if (percentage >= 90) {
      const warnKey = `${obra.id}-${Math.floor(percentage / 5) * 5}`; // warn per 5% step increments starting from 90%
      if (!warnedProjects[warnKey]) {
        // Record warned state first
        warnedProjects[warnKey] = true;
        updatedWarnState = true;

        // Fire notification
        await sendPushNotification(uid, {
          title: `⚠️ Alerta de Presupuesto: ${obra.name}`,
          body: `El gasto total ha superado el ${percentage.toFixed(0)}% del límite presupuestado (${spent.toLocaleString('es-ES', { maximumFractionDigits: 0 })} € de ${obra.budget.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €).`,
          type: 'budget_warning',
          meta: {
            obraId: obra.id,
            percentage: Number(percentage.toFixed(1))
          }
        });
      }
    }
  }

  if (updatedWarnState) {
    try {
      localStorage.setItem('up_warned_budgets', JSON.stringify(warnedProjects));
    } catch (e) {}
  }
}
