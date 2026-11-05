import crypto from 'node:crypto';
export function hashPin(pin: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${crypto.scryptSync(pin, salt, 32).toString('hex')}`;
}
export function verifyPin(pin: string, stored: string) {
  const [algorithm, salt, hash] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !/^[0-9a-f]{64}$/.test(hash || '')) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(pin, salt, 32), Buffer.from(hash, 'hex'));
}
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
export function publicWorker(worker: any) {
  if (!worker) return worker;
  const { pin, password, ...safe } = worker;
  return safe;
}
