/**
 * Firestore Utilities & Data Sanitization
 * 
 * Firestore SDK rejects any document write containing fields with value `undefined`.
 * This utility recursively purges `undefined` properties from plain objects and arrays
 * so they can be safely stored via `setDoc`, `addDoc`, `updateDoc`, or `writeBatch`.
 */

export function sanitizeForFirestore<T = any>(val: T): T {
  if (val === null || typeof val !== 'object') {
    return val;
  }

  if (Array.isArray(val)) {
    return val
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined) as any;
  }

  // Handle special Firestore types or Dates if needed
  if (val instanceof Date) {
    return val as any;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) {
    if (value !== undefined) {
      const sanitizedVal = sanitizeForFirestore(value);
      if (sanitizedVal !== undefined) {
        cleaned[key] = sanitizedVal;
      }
    }
  }

  return cleaned as T;
}
