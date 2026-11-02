/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, X, AlertTriangle, FileCheck, ShieldAlert, Sparkles, Volume2, Settings } from 'lucide-react';
import { AppNotification, requestPushPermission, getPushPermissionStatus, sendPushNotification } from '../lib/notificationService';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeForFirestore } from '../lib/firestoreSanitizer';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationCenterProps {
  uid?: string | null;
  onSelectObra?: (obraId: string) => void;
  onSelectTab?: (tab: 'dashboard' | 'obras' | 'documentos') => void;
}

export default function NotificationCenter({ onSelectObra, onSelectTab }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load from localStorage initially and sync with central Firestore notifications
  useEffect(() => {
    // 1. Initial load from local
    try {
      const cached = localStorage.getItem('up_notifications');
      if (cached) {
        setNotifications(JSON.parse(cached));
      }
    } catch (e) {
      console.warn(e);
    }

    // 2. Browser native permission status
    setPermissionStatus(getPushPermissionStatus());

    // 3. Central Firestore synchronizer
    const unsub = onSnapshot(
      collection(db, 'notifications'),
      (snap) => {
        const list: AppNotification[] = [];
        snap.forEach((d) => {
          list.push(d.data() as AppNotification);
        });
        // Sort by timestamp descending
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setNotifications(list);
        localStorage.setItem('up_notifications', JSON.stringify(list));

        // Check if there's a highly recent unread notification (less than 6 seconds ago) to show as toast
        if (list.length > 0) {
          const newest = list[0];
          const ageMs = Date.now() - new Date(newest.timestamp).getTime();
          if (!newest.read && ageMs < 6000) {
            setActiveToast(newest);
          }
        }
      },
      (err) => {
        console.warn("Error o estado offline en notificaciones centralizadas:", err);
      }
    );
    return () => unsub();
  }, []);

  // Click outside listener to dismiss notification dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle permission request
  const handleRequestPermission = async () => {
    const granted = await requestPushPermission();
    setPermissionStatus(getPushPermissionStatus());
    
    // Send a system trigger test to show success
    if (granted) {
      await sendPushNotification(null, {
        title: '✔️ ¡Notificaciones push activadas!',
        body: 'Las alertas del control de gastos y nuevos documentos se enviarán a tu escritorio en tiempo real.',
        type: 'system',
      });
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('up_notifications', JSON.stringify(updated));
      return updated;
    });

    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.read) {
          const docRef = doc(db, 'notifications', n.id);
          batch.set(docRef, sanitizeForFirestore({ ...n, read: true }));
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Error al marcar como leídos en Firestore:", err);
    }
  };

  // Mark single as read
  const handleMarkAsRead = async (notif: AppNotification) => {
    if (notif.read) return;

    setNotifications((prev) => {
      const updated = prev.map(n => n.id === notif.id ? { ...n, read: true } : n);
      localStorage.setItem('up_notifications', JSON.stringify(updated));
      return updated;
    });

    try {
      const docRef = doc(db, 'notifications', notif.id);
      await setDoc(docRef, sanitizeForFirestore({ ...notif, read: true }));
    } catch (err) {
      console.error(err);
    }
  };

  // Delete single notification
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNotifications((prev) => {
      const updated = prev.filter(n => n.id !== id);
      localStorage.setItem('up_notifications', JSON.stringify(updated));
      return updated;
    });

    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error(err);
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    setNotifications([]);
    localStorage.setItem('up_notifications', '[]');
    setIsOpen(false);

    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        const docRef = doc(db, 'notifications', n.id);
        batch.delete(docRef);
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate a test push notification
  const handleSimulateNotification = async () => {
    const randomSeed = Math.random();
    if (randomSeed < 0.5) {
      // Simulate budget warning
      await sendPushNotification(null, {
        title: '⚠️ Exceso Presupuesto: Residencial Los Arcos',
        body: 'El gasto acumulado (materiales, personal e indirectos) alcanza los 147.200 € (92% de los 160.000 € previstos de límite).',
        type: 'budget_warning',
        meta: {
          obraId: 'mock-1',
          percentage: 92
        }
      });
    } else {
      // Simulate doc import
      await sendPushNotification(null, {
        title: '📂 Factura Indexada Correctamente',
        body: 'Se ha detectado e importado un nuevo documento de "Hormigones Guadalete" por importe de 1.452,00 € en la carpeta Control_Uniproyect.',
        type: 'document_import',
        meta: {
          docNumber: 'FL-2026-928'
        }
      });
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative" ref={panelRef} id="notification-center-root">
      {/* 1. Header Trigger Indicator (Bell) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-xl border transition-all text-xs flex items-center justify-center cursor-pointer ${
          isOpen
            ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
            : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/80 hover:text-white'
        }`}
        title="Centro de Notificaciones y Alertas de Gastos de Obras"
        id="btn-bell-toggle"
      >
        <Bell className="w-4 h-4" />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9.5px] font-black font-mono w-5 h-5 flex items-center justify-center rounded-full border border-[#0A0A0A] animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 2. Push Toast sliding banner */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-6 z-50 max-w-sm w-full bg-[#1A1A1C] border border-emerald-500/30 rounded-2xl p-4 shadow-2xl flex items-start gap-3 no-print cursor-pointer"
            onClick={() => {
              handleMarkAsRead(activeToast);
              setActiveToast(null);
              setIsOpen(true);
            }}
            id="toast-floating-banner"
          >
            <div className="p-2.5 rounded-xl bg-[#10B981]/10 text-[#10B981] shrink-0">
              {activeToast.type === 'budget_warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              ) : activeToast.type === 'document_import' ? (
                <FileCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <Sparkles className="w-5 h-5 text-sky-400" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="text-[10px] text-white/50 block font-mono uppercase tracking-wider">Notificación Push Recibida</span>
              <h4 className="text-white font-extrabold text-xs block leading-tight mt-0.5">{activeToast.title}</h4>
              <p className="text-white/70 text-[10.5px] line-clamp-2 mt-1 leading-normal">{activeToast.body}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              className="text-white/40 hover:text-white p-1 rounded-xl hover:bg-white/5 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Main Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#121214] border border-white/10 rounded-2xl shadow-3xl overflow-hidden z-50 text-left no-print"
            id="notifications-panel-container"
          >
            {/* Panel Header */}
            <div className="p-4 border-b border-white/5 bg-white/2">
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#10B981]" />
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Alertas y Avisos</h3>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    Marcar leídos
                  </button>
                )}
              </div>
              <p className="text-[10.5px] text-white/50">Recibe avisos sobre límites de obras e importación de facturas de tu Drive.</p>
            </div>

            {/* Desktop System Settings helper */}
            <div className="px-4 py-2 bg-white/2 border-b border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 text-white/60">
                  <Settings className="w-3.5 h-3.5 text-white/40" />
                  <span>Notificaciones Web Push:</span>
                </div>
                <div className="flex items-center">
                  {permissionStatus === 'granted' ? (
                    <span className="text-emerald-400 font-extrabold font-mono flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                      ACTIVADO
                    </span>
                  ) : permissionStatus === 'denied' ? (
                    <span className="text-rose-400 font-bold font-mono">DENEGADO</span>
                  ) : (
                    <span className="text-amber-400 font-bold font-mono">PENDIENTE</span>
                  )}
                </div>
              </div>

              {permissionStatus !== 'granted' && (
                <button
                  onClick={handleRequestPermission}
                  className="w-full text-center text-[10px] py-1 bg-[#10B981] hover:bg-[#0D9668] text-black font-extrabold rounded-md shadow transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3 h-3" />
                  {permissionStatus === 'denied' 
                    ? '¿Permiso denegado? Haz clic para volver a solicitar' 
                    : 'Permitir notificaciones de escritorio / Push'}
                </button>
              )}
            </div>

            {/* List wrap */}
            <div className="max-h-[340px] overflow-y-auto divide-y divide-white/5" id="notifications-list-wrapper">
              {notifications.length === 0 ? (
                <div className="p-8 text-center" id="empty-state-placeholder">
                  <Bell className="w-8 h-8 text-white/10 mx-auto mb-2.5" />
                  <p className="text-xs text-white/40 font-medium">Bandeja de alertas vacía</p>
                  <p className="text-[10px] text-white/30 max-w-[200px] mx-auto mt-1 leading-normal">
                    Las alertas aparecerán cuando subas documentos o se supere presupuesto.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      handleMarkAsRead(notif);
                      if (notif.meta?.obraId && onSelectObra) {
                        onSelectObra(notif.meta.obraId);
                        if (onSelectTab) onSelectTab('dashboard');
                      } else if (notif.type === 'document_import' && onSelectTab) {
                        onSelectTab('documentos');
                      }
                    }}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer text-left ${
                      notif.read ? 'bg-transparent text-white/60' : 'bg-[#10B981]/5 text-white hover:bg-[#10B981]/10'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {notif.type === 'budget_warning' ? (
                        <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      ) : notif.type === 'document_import' ? (
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                          <FileCheck className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/20">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-[11.5px] font-extrabold text-white/95 leading-normal truncate block">{notif.title}</h4>
                        <span className="text-[8.5px] text-white/40 font-mono shrink-0 pt-0.5">
                          {new Date(notif.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/70 leading-normal mt-0.5 font-sans">{notif.body}</p>
                      
                      {/* Sub-actions or links inside notifications */}
                      {notif.meta?.obraId && (
                        <span className="inline-flex items-center gap-1.5 text-[8.5px] font-extrabold text-[#10B981] bg-[#10B981]/5 border border-[#10B981]/20 px-1.5 py-0.5 rounded mt-1.5 font-mono">
                          🔍 Ver panel de obra
                        </span>
                      )}
                      {notif.type === 'document_import' && (
                        <span className="inline-flex items-center gap-1.5 text-[8.5px] font-extrabold text-sky-400 bg-sky-500/5 border border-sky-500/20 px-1.5 py-0.5 rounded mt-1.5 font-mono">
                          📁 Ver listado facturas
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="text-white/20 hover:text-rose-500 hover:bg-rose-500/10 p-1 rounded-md transition-all pt-0 shrink-0"
                      title="Eliminar esta alerta"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Simulated Debug Trigger & Clear Actions */}
            <div className="p-3 bg-white/2 border-t border-white/5 flex items-center justify-between gap-2">
              <button
                onClick={handleSimulateNotification}
                className="text-[9.5px] bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981]/25 px-2.5 py-1.5 rounded-lg font-black tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1"
                title="Genera alertas de prueba para verificar sonidos y la campana"
              >
                <Sparkles className="w-3 h-3 text-[#10B981]" />
                Simular Alerta
              </button>

              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[9.5px] text-white/40 hover:text-rose-400 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all text-xs flex items-center gap-1 cursor-pointer font-bold"
                >
                  <Trash2 className="w-3 h-3" />
                  Borrar todo
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
