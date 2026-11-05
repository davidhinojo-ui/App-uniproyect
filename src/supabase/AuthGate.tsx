import React, { useEffect, useState } from 'react';
import { getSupabase, supervisorContext } from './client.js';
import { auth, onAuthStateChanged, type User } from './authCompat.js';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<{ uid: string; error?: string }>();
  useEffect(() => onAuthStateChanged(auth, value => { setUser(value); setReady(true); }), []);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) {
      setAccess(undefined);
      return;
    }
    let active = true;
    supervisorContext().then(({ session }) => {
      if (active && session.user.id === uid) setAccess({ uid });
    }).catch(() => {
      if (active) setAccess({ uid, error: 'No se ha podido verificar tu acceso al área de gestión.' });
    });
    return () => { active = false; };
  }, [uid]);
  if (!ready) return <p role="status" className="p-6 text-slate-300">Cargando UniProyect…</p>;
  if (uid) {
    if (access?.uid !== uid) return <p role="status" className="p-6 text-slate-300">Comprobando permisos…</p>;
    if (access.error) return <p role="alert" className="p-6 text-rose-300">{access.error}</p>;
    return <>{children}</>;
  }
  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await getSupabase().auth.signInWithPassword({ email: String(data.get('email')), password: String(data.get('password')) });
      if (result.error) throw new Error('No se pudo iniciar sesión. Comprueba tus credenciales.');
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
    <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-8 space-y-5 text-white">
      <h1 className="text-2xl font-bold">UniProyect</h1><p className="text-slate-300">Control de Obras y Costes</p>
      <label className="block">Correo electrónico<input name="email" type="email" autoComplete="username" required className="block w-full rounded-xl bg-slate-800 p-3 mt-2" /></label>
      <label className="block">Contraseña<input name="password" type="password" autoComplete="current-password" required className="block w-full rounded-xl bg-slate-800 p-3 mt-2" /></label>
      {error && <p role="alert" className="text-rose-300">{error}</p>}
      <button disabled={busy} type="submit" className="w-full rounded-xl bg-blue-600 py-3 font-bold disabled:opacity-50">{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  </main>;
}

export function SignOutButton() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [error, setError] = useState('');
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (!user) return null;
  return <div>
    <button type="button" onClick={() => { auth.signOut().catch(() => setError('No se pudo cerrar la sesión. Inténtalo de nuevo.')); }} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200">Cerrar sesión</button>
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
  </div>;
}
