import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { state } from './stateContext.js';
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function hashPin(pin:string) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(pin,salt,32).toString('hex')}`; }
export function verifyPin(pin:string,hash?:string) {
 if(!hash || !/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(hash)) return false;
 const [salt,value]=hash.split(':');return timingSafeEqual(scryptSync(pin,salt,32),Buffer.from(value,'hex'));
}
export function issueSession(workerId:string) {
 const token=randomBytes(32).toString('base64url');
 const worker=state().workers.find(w=>w.id===workerId)!;
 state().sessions.push({id:digest(token),workerId,expiresAt:Date.now()+8*60*60*1000,credentialVersion:worker.pinHash || ''});
 return token;
}
export function publicData(value:unknown):unknown {
 return JSON.parse(JSON.stringify(value, (key,v)=>['pin','pinHash','tokenHash','tokenPlain','password','refreshToken'].includes(key)?undefined:v));
}
