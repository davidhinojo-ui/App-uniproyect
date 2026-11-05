/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  initAuth, googleSignIn, logout, getAccessToken 
} from '../lib/googleAuth';
import { 
  listDriveFiles, downloadFileAsBase64, GoogleDriveItem, getOrCreateDriveFolderAtPath, uploadBinaryToDriveFolder 
} from '../lib/googleDriveService';
import { User } from '../../supabase/authCompat';
import { 
  Folder, FileText, ChevronRight, RefreshCw, 
  Search, ArrowLeft, LogOut, CheckCircle, AlertCircle, Sparkles, Loader2, HardDrive,
  FolderPlus, UploadCloud, Info
} from 'lucide-react';

interface GoogleDriveExplorerProps {
  onImportDocument: (base64Data: string, mimeType: string, filename: string) => Promise<void>;
  isProcessing: boolean;
}

export default function GoogleDriveExplorer({ onImportDocument, isProcessing }: GoogleDriveExplorerProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Drive navigating state
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string, name: string }>>([
    { id: 'root', name: 'Mi Unidad' }
  ]);
  const [driveItems, setDriveItems] = useState<GoogleDriveItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // OCR processing info specific to Drive Explorer
  const [importingFileId, setImportingFileId] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Uniproyect unified folder provisioning
  const [importsFolderId, setImportsFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);

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

  // 1.5 Automatic folder discovery & provisioning within the authenticated account
  useEffect(() => {
    const ensureImportsFolderExists = async () => {
      if (accessToken && !needsAuth) {
        setIsCreatingFolder(true);
        try {
          const folderId = await getOrCreateDriveFolderAtPath(accessToken, ['Control_Uniproyect']);
          setImportsFolderId(folderId);
        } catch (err: any) {
          console.error("No se pudo pre-crear o localizar la carpeta Uniproyect:", err);
        } finally {
          setIsCreatingFolder(false);
        }
      } else {
        setImportsFolderId(null);
      }
    };
    ensureImportsFolderExists();
  }, [accessToken, needsAuth]);

  // 2. Fetch files when folder changes or token updates
  useEffect(() => {
    if (accessToken && !needsAuth) {
      loadFilesFromFolder(currentFolderId);
    }
  }, [accessToken, currentFolderId, needsAuth]);

  const loadFilesFromFolder = async (folderId: string) => {
    if (!accessToken) return;
    setIsLoadingItems(true);
    setErrorMsg('');
    setImportSuccessMsg('');
    try {
      const items = await listDriveFiles(accessToken, folderId);
      setDriveItems(items);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error al leer Google Drive: ${err.message || err}.`);
    } finally {
      setIsLoadingItems(false);
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
      setErrorMsg(`No se pudo iniciar sesión: ${err.message || err}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('¿Desea desconectar su cuenta de Google Drive?')) {
      await logout();
      setCurrentUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setDriveItems([]);
      setCurrentFolderId('root');
      setFolderHistory([{ id: 'root', name: 'Mi Unidad' }]);
    }
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderHistory(prev => [...prev, { id: folderId, name: folderName }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const updatedHistory = folderHistory.slice(0, index + 1);
    setFolderHistory(updatedHistory);
    setCurrentFolderId(updatedHistory[updatedHistory.length - 1].id);
  };

  const handleNavigateUp = () => {
    if (folderHistory.length <= 1) return;
    const updatedHistory = folderHistory.slice(0, -1);
    setFolderHistory(updatedHistory);
    setCurrentFolderId(updatedHistory[updatedHistory.length - 1].id);
  };

  // Import file triggered
  const handleImportFile = async (item: GoogleDriveItem) => {
    if (!accessToken) return;
    setImportingFileId(item.id);
    setErrorMsg('');
    setImportSuccessMsg('');
    try {
      // 1. Download file content from Drive as base64
      const fileData = await downloadFileAsBase64(accessToken, item.id);
      
      // 2. Submit file to parent OCR analysis function
      await onImportDocument(
        `data:${fileData.mimeType};base64,${fileData.base64Data}`,
        fileData.mimeType,
        fileData.filename
      );
      
      setImportSuccessMsg(`¡Archivo "${item.name}" importado y estructurado con éxito!`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Fallo de importación: ${err.message || err}`);
    } finally {
      setImportingFileId(null);
    }
  };

  // Upload local binary file to Google Drive current folder
  const handleBinaryUploadToDrive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setIsUploadingToDrive(true);
    setErrorMsg('');
    setImportSuccessMsg('');
    try {
      await uploadBinaryToDriveFolder(accessToken, currentFolderId, file, file.name);
      setImportSuccessMsg(`¡Archivo "${file.name}" subido correctamente a Google Drive en este directorio!`);
      // Reload current folder contents
      await loadFilesFromFolder(currentFolderId);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Fallo de subida a Google Drive: ${err.message || err}`);
    } finally {
      setIsUploadingToDrive(false);
    }
  };


  // Filter items in the current directory against the query
  const filteredItems = driveItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  return (
    <div className="bg-[#111112] rounded-2xl border border-white/5 overflow-hidden shadow-xl" id="drive-component-wrapper">
      
      {/* Dynamic Header */}
      <div className="border-b border-white/5 p-4 bg-[#141416] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 leading-snug">
              Explorador de Google Drive
            </h4>
            <p className="text-[10px] text-white/50">Busque y cargue facturas o albaranes digitales en la nube.</p>
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
              <span className="text-white font-semibold truncate max-w-[120px]">{currentUser.displayName || 'Conectado'}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-white/40 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              title="Cerrar Sesión Google Drive"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Pane */}
      {needsAuth ? (
        <div className="p-8 text-center flex flex-col items-center justify-center min-h-[250px] space-y-4" id="drive-no-auth-view">
          <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-3xl mb-1 animate-pulse">
            <HardDrive className="w-10 h-10" />
          </div>
          <h5 className="text-sm font-bold text-white/95">Conecte su cuenta de Google Drive</h5>
          <p className="text-[11px] text-white/50 max-w-sm leading-relaxed">
            Permite a Uniproyect explorar las carpetas de su nube de Google para indexar o importar facturas, evitando tener que descargarlas manualmente del correo.
          </p>

          {/* Styled standard Sign In with Google Button */}
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
        <div className="p-4 space-y-4" id="drive-auth-view">
          
          {/* Diagnostic status alerts */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {importSuccessMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-400 animate-fadeIn">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {/* Connected cloud folder info & Shortcut */}
          {importsFolderId && (
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mb-1" id="drive-sync-shortcut-card">
              <div className="flex items-start gap-2.5">
                <div className="bg-emerald-500/10 p-1.5 rounded-lg text-emerald-400 mt-0.5 sm:mt-0">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11.5px] font-extrabold text-white block">📁 Carpeta de Sincronización en tu Google Drive</span>
                  <span className="text-[10px] text-emerald-400 font-mono block">Mi Unidad / Control_Uniproyect</span>
                  <p className="text-[10px] text-white/50 mt-0.5">Sube aquí tus archivos. Se guardarán en tu cuenta y la IA de Uniproyect podrá analizarlos.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setCurrentFolderId(importsFolderId);
                    setFolderHistory([
                      { id: 'root', name: 'Mi Unidad' },
                      { id: importsFolderId, name: 'Control_Uniproyect' }
                    ]);
                  }}
                  disabled={currentFolderId === importsFolderId}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold select-none cursor-pointer text-black font-extrabold transition-all border ${
                    currentFolderId === importsFolderId 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-not-allowed opacity-50' 
                      : 'bg-[#10B981] hover:bg-emerald-400 border-[#10B981] active:scale-[0.98]'
                  }`}
                >
                  Abrir Carpeta
                </button>
              </div>
            </div>
          )}

          {/* Upload Local File Directly to Google Drive */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" id="drive-direct-upload-card">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-500/10 p-1.5 rounded-lg text-blue-400">
                <UploadCloud className="w-4 h-4 shrink-0" />
              </div>
              <div>
                <span className="font-bold text-white block">Subir un Fichero local a Google Drive</span>
                <span className="text-[10px] text-white/50 block">Sube un documento a la carpeta de Drive seleccionada: <span className="font-mono text-white/70">{folderHistory[folderHistory.length - 1]?.name}</span></span>
              </div>
            </div>
            <div className="relative shrink-0">
              <label 
                htmlFor="file-upload-drive" 
                className={`px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10.5px] font-bold border border-white/15 cursor-pointer flex items-center gap-1.5 active:scale-[0.98] select-none transition ${
                  isUploadingToDrive ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploadingToDrive ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Subiendo...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Examinar y Subir</span>
                  </>
                )}
              </label>
              <input 
                id="file-upload-drive" 
                type="file" 
                accept="application/pdf,image/*" 
                onChange={handleBinaryUploadToDrive} 
                disabled={isUploadingToDrive}
                className="hidden" 
              />
            </div>
          </div>

          {/* Navigation Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between" id="drive-dirs-bar">
            
            {/* Breadcrumbs navigation */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin text-xs text-white/50 shrink-0">
              {folderHistory.length > 1 && (
                <button 
                  onClick={handleNavigateUp}
                  className="bg-white/5 hover:bg-white/10 p-1.5 rounded-lg text-white transition-colors cursor-pointer mr-1"
                  title="Subir un nivel"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
              
              {folderHistory.map((folder, index) => (
                <React.Fragment key={folder.id}>
                  {index > 0 && <span className="text-white/20 select-none">/</span>}
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`hover:text-[#10B981] transition-colors cursor-pointer whitespace-nowrap font-semibold ${
                      index === folderHistory.length - 1 ? 'text-white' : ''
                    }`}
                  >
                    {folder.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Quick Filter Search input */}
            <div className="relative flex-1 max-w-sm self-stretch sm:self-auto">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-2.5" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar archivos del directorio..."
                className="w-full bg-[#1A1A1D] rounded-lg border border-white/5 pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Directory listing tree */}
          <div className="bg-[#18181B] rounded-xl border border-white/5 overflow-hidden max-h-[320px] overflow-y-auto scrollbar-thin" id="drive-results-table">
            {isLoadingItems ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <span className="text-xs text-white/40">Sincronizando ficheros de Google Drive...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-white/40 flex flex-col items-center justify-center gap-1">
                <FileText className="w-8 h-8 text-white/20 mb-1" />
                <span>No se encontraron archivos en este directorio.</span>
                <button 
                  onClick={() => loadFilesFromFolder(currentFolderId)}
                  className="text-emerald-500 hover:underline mt-2 font-bold cursor-pointer"
                >
                  Recargar carpeta
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredItems.map(item => {
                  const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                  const isLoadableFile = isSupportedFile(item.mimeType);
                  const isBeingImported = importingFileId === item.id;

                  return (
                    <div 
                      key={item.id}
                      className="p-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-4 text-xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isFolder ? (
                          <Folder className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                        ) : (
                          <FileText className="w-4.5 h-4.5 text-blue-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="text-white font-semibold truncate block pr-2">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-white/40 block">
                            {isFolder ? 'Carpeta de archivos' : `${isLoadableFile ? 'Factura/Albarán legible' : 'Archivo no compatible'}`}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isFolder ? (
                          <button
                            onClick={() => handleFolderClick(item.id, item.name)}
                            className="bg-white/5 hover:bg-[#10B981] hover:text-black text-white p-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer font-bold"
                          >
                            <span>Abrir</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : isLoadableFile ? (
                          <button
                            onClick={() => handleImportFile(item)}
                            disabled={isProcessing || isBeingImported}
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 text-black disabled:text-white/40 font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow"
                          >
                            {isBeingImported ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Importando...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Escanear con IA</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] text-white/30 italic pr-2">No compatible</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-[10px] text-white/40 flex items-center justify-between px-1" id="drive-footer-fine-print">
            <span>Soportado: PDFs escaneados, imágenes JPEG, PNG y WEBP.</span>
            <button 
              onClick={() => loadFilesFromFolder(currentFolderId)}
              className="text-white/40 hover:text-[#10B981] flex items-center gap-1 transition-colors cursor-pointer font-bold"
            >
              <RefreshCw className="w-3 h-3" />
              Sincronizar ahora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
