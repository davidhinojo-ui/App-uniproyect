import { getSupabase, supervisorContext } from './client.js';

export const db = Object.freeze({ backend: 'supabase' });
type Reference = { collection: string; id?: string };
type Operation = Reference & { action: 'set' | 'delete'; data?: any };
export function collection(_db: typeof db, name: string): Reference { return { collection: name }; }
export function doc(_db: typeof db, name: string, id: string): Reference { return { collection: name, id }; }
function snapshot(rows: { id: string; data: any }[]) {
  const docs = rows.map(row => ({ id: row.id, data: () => row.data }));
  return { docs, empty: !docs.length, size: docs.length, forEach: (fn: (value: typeof docs[number]) => void) => docs.forEach(fn) };
}
export async function getDocs(reference: Reference) {
  const { supabase, organizationId } = await supervisorContext();
  const rows: { id: string; data: any }[] = [];
  // Explicit pagination avoids the default 1,000-row Data API truncation.
  for (let offset = 0; ; offset += 500) {
    const result = await supabase.from('up_replica_documents').select('id,data')
      .eq('organizacion_id', organizationId).eq('collection', reference.collection)
      .order('id').range(offset, offset + 499);
    if (result.error) throw new Error('No se pudieron consultar los datos de UniProyect.');
    rows.push(...result.data);
    if (result.data.length < 500) break;
  }
  return snapshot(rows);
}
export async function commitDocuments(operations: Operation[]) {
  const { supabase, organizationId } = await supervisorContext();
  const result = await supabase.rpc('up_replica_apply_documents', { p_org: organizationId, p_ops: operations });
  if (result.error) throw new Error('No se pudieron guardar los cambios en Supabase.');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('uniproyect:data-changed'));
}
export function setDoc(reference: Reference, data: any) { return commitDocuments([{ ...reference, action: 'set', data }]); }
export function deleteDoc(reference: Reference) { return commitDocuments([{ ...reference, action: 'delete' }]); }
export function writeBatch(_db: typeof db) {
  const operations: Operation[] = [];
  return {
    set(reference: Reference, data: any) { operations.push({ ...reference, action: 'set', data }); },
    delete(reference: Reference) { operations.push({ ...reference, action: 'delete' }); },
    commit() { return commitDocuments(operations); },
  };
}
export function onSnapshot(reference: Reference, callback: (value: ReturnType<typeof snapshot>) => void, onError?: (error: Error) => void) {
  let active = true, running = false;
  const refresh = async () => {
    if (!active || running) return;
    running = true;
    try { const value = await getDocs(reference); if (active) callback(value); }
    catch (error) { if (active) onError?.(error as Error); }
    finally { running = false; }
  };
  void refresh();
  const timer = setInterval(refresh, 15000);
  let unsubscribe = () => {};
  try { const { data } = getSupabase().auth.onAuthStateChange(() => { setTimeout(refresh, 0); }); unsubscribe = () => data.subscription.unsubscribe(); } catch { /* reported by refresh */ }
  if (typeof window !== 'undefined') window.addEventListener('uniproyect:data-changed', refresh);
  return () => { active = false; clearInterval(timer); unsubscribe(); if (typeof window !== 'undefined') window.removeEventListener('uniproyect:data-changed', refresh); };
}
