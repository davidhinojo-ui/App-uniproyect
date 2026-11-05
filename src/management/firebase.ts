// Compatibility exports for the existing management views. All data uses Supabase.
export { auth, googleProvider } from '../supabase/authCompat';
export { db } from '../supabase/documentCompat';
export enum OperationType { CREATE='create', UPDATE='update', DELETE='delete', LIST='list', GET='get', WRITE='write' }
export function handleFirestoreError(error: unknown, operation: OperationType, path: string | null) {
  console.error('No se pudo completar la operación de datos', operation, path);
  throw new Error('No se pudo guardar o consultar la información.');
}
