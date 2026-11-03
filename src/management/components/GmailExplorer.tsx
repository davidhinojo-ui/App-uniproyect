/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  initAuth, googleSignIn, logout 
} from '../lib/googleAuth';
import { 
  searchGmailMessages, downloadGmailAttachmentAsBase64, GmailMessageItem, GmailAttachmentMeta 
} from '../lib/gmailService';
import { User } from 'firebase/auth';
import { 
  Mail, FileText, ChevronRight, RefreshCw, 
  Search, ArrowLeft, LogOut, CheckCircle, AlertCircle, Sparkles, Loader2, Inbox, Calendar, User as UserIcon
} from 'lucide-react';

interface GmailExplorerProps {
  onImportDocument: (base64Data: string, mimeType: string, filename: string) => Promise<void>;
  isProcessing: boolean;
}

export default function GmailExplorer({ onImportDocument, isProcessing }: GmailExplorerProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Gmail emails state
  const [emails, setEmails] = useState<GmailMessageItem[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // OCR processing info specific to Gmail Explorer
  const [importingAttachmentId, setImportingAttachmentId] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // 1. Listen for auth changes on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
        setErrorMsg('');
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Load emails automatically if authenticated
  useEffect(() => {
    if (accessToken && !needsAuth) {
      loadEmails(searchQuery);
    }
  }, [accessToken, needsAuth]);

  const loadEmails = async (queryStr: string) => {
    if (!accessToken) return;
    setIsLoadingEmails(true);
    setErrorMsg('');
    setImportSuccessMsg('');
    try {
      const results = await searchGmailMessages(accessToken, queryStr);
      setEmails(results);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error al acceder a Gmail: ${err.message || err}.`);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      const result = await googleSignIn();
      if (result) {
        setAccessToken(result.accessToken);
        setCurrentUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setErrorMsg(`No se pudo iniciar sesión con Google: ${err.message || err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('¿Desea desconectar su cuenta de Gmail?')) {
      await logout();
      setCurrentUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setEmails([]);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEmails(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadEmails('');
  };

  // Convert attachment to base64 and send for OCR analysis
  const handleImportAttachment = async (messageId: string, item: GmailAttachmentMeta) => {
    if (!accessToken) return;
    setImportingAttachmentId(item.attachmentId);
    setErrorMsg('');
    setImportSuccessMsg('');
    try {
      // 1. Download attachment contents through API (returns Base64 string from standard index)
      const base64Content = await downloadGmailAttachmentAsBase64(accessToken, messageId, item.attachmentId);
      
      // 2. Submit to parent OCR parser
      await onImportDocument(
        `data:${item.mimeType};base64,${base64Content}`,
        item.mimeType,
        item.filename
      );
      
      setImportSuccessMsg(`¡Adjunto "${item.filename}" importado y analizado con éxito!`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Fallo de importación del adjunto: ${err.message || err}`);
    } finally {
      setImportingAttachmentId(null);
    }
  };

  const isSupportedFile = (mimeType: string) => {
    const supported = [
      'application/pdf', 
      'image/png', 
      'image/jpeg', 
      'image/jpg', 
      'image/webp'
    ];
    return supported.includes(mimeType);
  };

  const formatEmailDate = (dateVal: string) => {
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return dateVal;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-[#111112] rounded-2xl border border-white/5 overflow-hidden shadow-xl" id="gmail-component-wrapper">
      
      {/* Dynamic Header */}
      <div className="border-b border-white/5 p-4 bg-[#141416] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#10B981]/10 p-2 rounded-xl text-[#10B981]">
            <Mail className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 leading-snug">
              Auditor de Bandeja Gmail
            </h4>
            <p className="text-[10px] text-white/50">Recupere facturas enviadas a su correo sin salir de Uniproyect.</p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-3 bg-[#1A1A1D] px-3 py-1.5 rounded-lg border border-white/5 self-stretch sm:self-auto text-xs justify-between">
            <div className="flex items-center gap-2">
              {currentUser.photoURL ? (
                <img referrerPolicy="no-referrer" src={currentUser.photoURL} alt="Avatar" className="w-5 h-5 rounded-full" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-black font-extrabold flex items-center justify-center text-[10px]">
                  {currentUser.displayName?.[0] || 'U'}
                </div>
              )}
              <span className="text-white font-semibold truncate max-w-[120px]">{currentUser.displayName || 'Bandeja Vinculada'}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-white/40 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              title="Desconectar cuenta de Gmail"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {needsAuth ? (
        <div className="p-8 text-center flex flex-col items-center justify-center min-h-[250px] space-y-4" id="gmail-no-auth-view">
          <div className="bg-[#10B981]/10 text-[#10B981] p-4 rounded-3xl mb-1 animation-pulse">
            <Mail className="w-10 h-10" />
          </div>
          <h5 className="text-sm font-bold text-white/95">Vincule su correo para extraer facturas</h5>
          <p className="text-[11px] text-white/50 max-w-sm leading-relaxed">
            Uniproyect recopilará de forma segura comunicaciones con adjuntos (PDFs o imágenes) sobre cobros, materiales, albaranes o subcontratas directamente de su bandeja de entrada.
          </p>

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="group font-bold bg-white text-black hover:bg-slate-100 py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md border border-white/10 disabled:opacity-50"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
            )}
            <span>{isLoggingIn ? 'Autenticando...' : 'Iniciar Sesión con Google'}</span>
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-4" id="gmail-auth-view">
          
          {/* Diagnostic feedback */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {importSuccessMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-400 animate-fadeIn font-sans">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {/* Search Controls */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2.5 items-center">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-2.5" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Introducir término (ej. 'materiales', 'hormigón', 'proveedor')..."
                className="w-full bg-[#1A1A1D] rounded-xl border border-white/5 pl-9 pr-8 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500 font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-2.5 text-white/40 hover:text-white text-[11px] font-bold"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoadingEmails}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {isLoadingEmails ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
              ) : (
                <Search className="w-3 h-3" />
              )}
              <span>Buscar</span>
            </button>
          </form>

          {/* Quick preset filters */}
          <div className="flex gap-1.5 flex-wrap items-center text-[10.5px]">
            <span className="text-white/40 font-semibold">Filtros rápidos de bandeja:</span>
            <button
              type="button"
              onClick={() => { setSearchQuery('factura'); loadEmails('factura'); }}
              className="bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-md px-2 py-0.5"
            >
              "Facturas"
            </button>
            <button
              type="button"
              onClick={() => { setSearchQuery('albaran'); loadEmails('albaran'); }}
              className="bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-md px-2 py-0.5"
            >
              "Albaranes"
            </button>
            <button
              type="button"
              onClick={() => { setSearchQuery('recibo'); loadEmails('recibo'); }}
              className="bg-white/5 hover:bg-white/10 border border-white/5 text-white rounded-md px-2 py-0.5"
            >
              "Recibos"
            </button>
          </div>

          {/* Email Messages list */}
          <div className="bg-[#18181B] rounded-xl border border-white/5 overflow-hidden max-h-[300px] overflow-y-auto scrollbar-thin" id="gmail-results-list">
            {isLoadingEmails ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <span className="text-xs text-white/40">Escrudiñando emails en Gmail...</span>
              </div>
            ) : emails.length === 0 ? (
              <div className="p-12 text-center text-xs text-white/40 flex flex-col items-center justify-center gap-1.5">
                <Inbox className="w-8 h-8 text-white/20 mb-1" />
                <span className="font-semibold">No se encontraron correos con archivos compatibles</span>
                <p className="text-[10px] text-white/30 max-w-xs leading-normal">
                  Por defecto, filtramos su correo para encontrar archivos adjuntos legibles (PDF/PNG/JPEG) con palabras clave sobre materiales o facturación. Experimente con otra búsqueda en la barra superior.
                </p>
                <button 
                  onClick={() => loadEmails(searchQuery)}
                  className="text-emerald-500 hover:underline mt-2 font-bold cursor-pointer"
                >
                  Actualizar bandeja
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {emails.map(msg => (
                  <div key={msg.id} className="p-3.5 hover:bg-white/5 transition-colors flex flex-col gap-2 relative">
                    
                    {/* Message Meta (Sender, Subject, Date) */}
                    <div className="flex justify-between items-start gap-4 text-[11px]">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 text-white/80 font-bold">
                          <UserIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate pr-1">{msg.from}</span>
                        </div>
                        <h5 className="text-[11.5px] text-white font-extrabold line-clamp-1">{msg.subject}</h5>
                      </div>
                      <div className="text-[10px] text-white/35 font-mono whitespace-nowrap flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatEmailDate(msg.date)}
                      </div>
                    </div>

                    {/* Email snippet */}
                    <p className="text-[10.5px] text-white/50 line-clamp-1 italic italic-font-mono select-none">
                      "{msg.snippet}"
                    </p>

                    {/* Email attachments parser box */}
                    <div className="bg-[#1C1C1E] rounded-lg border border-white/5 p-2 mt-1 space-y-1.5">
                      <div className="text-[9.5px] font-bold text-white/40 uppercase tracking-widest pl-1">
                        Archivos Adjuntos Detectados ({msg.attachments.length})
                      </div>
                      <div className="divide-y divide-white/5">
                        {msg.attachments.map((attach, idx) => {
                          const isCompatible = isSupportedFile(attach.mimeType);
                          const isBeingImported = importingAttachmentId === attach.attachmentId;

                          return (
                            <div key={attach.attachmentId} className="flex items-center justify-between py-1.5 pl-1 shrink-0 text-xs gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <div className="truncate">
                                  <span className="text-white font-medium block truncate text-[11px]">{attach.filename}</span>
                                  <span className="text-[9px] text-white/40 block">
                                    Size: {formatBytes(attach.size)} • {attach.mimeType}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isCompatible ? (
                                  <button
                                    onClick={() => handleImportAttachment(msg.id, attach)}
                                    disabled={isProcessing || isBeingImported}
                                    className="bg-[#10B981] hover:bg-[#10B981]/90 disabled:bg-white/10 text-black disabled:text-white/40 text-[10.5px] font-extrabold px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    {isBeingImported ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Importando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-3 h-3" />
                                        <span>Escanear con IA</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-[9.5px] text-white/30 italic">No compatible</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[10px] text-white/40 flex items-center justify-between px-1" id="gmail-footer-fine-print">
            <span>Soportado: PDFs e imágenes del correo de construcción o facturas.</span>
            <button 
              onClick={() => loadEmails(searchQuery)}
              className="text-white/40 hover:text-[#10B981] flex items-center gap-1 transition-colors cursor-pointer font-bold"
            >
              <RefreshCw className="w-3 h-3" />
              Sincronizar Bandeja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
