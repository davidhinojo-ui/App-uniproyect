import React, { useState } from 'react';
import { loginSupervisor } from '../../services/supervisorAuth.js';
export function SupervisorLogin({onSuccess,onWorker}:{onSuccess:()=>void;onWorker:()=>void}) {
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
  <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full space-y-4">
   <h1 className="text-xl font-bold text-white">Acceso a UniProyect</h1>
   <p>Inicia sesión con tu cuenta autorizada para gestionar obras y trabajadores.</p>
   {error && <p role="alert" className="text-rose-300">{error}</p>}
   <button type="button" disabled={busy} className="bg-blue-600 text-white rounded-xl p-3 w-full" onClick={async()=>{setBusy(true);setError('');try{await loginSupervisor();onSuccess();}catch(e){setError(e instanceof Error?e.message:'No se pudo iniciar sesión');}finally{setBusy(false);}}}>Entrar como supervisor con Google</button>
   <button type="button" className="bg-slate-800 rounded-xl p-3 w-full" onClick={onWorker}>Portal del trabajador</button>
  </div>
 </main>;
}
