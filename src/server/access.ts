import type { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, organization, transact } from './persistence.js';
import { state } from './stateContext.js';
import { digest, publicData } from './credentials.js';

export async function supervisorIdentity(token:string) {
 const identity=await getAuth(adminApp()).verifyIdToken(token,true);
 if(identity.role!=='supervisor' || identity.organizationId!==organization) throw new Error('Forbidden');
 return identity.uid;
}
export function ownsWorker(workerId:unknown, ownId:string) { return typeof workerId==='string' && workerId===ownId; }
export async function access(req:Request,res:Response,next:NextFunction) {
 if(['/health','/auth/config'].includes(req.path)) return next();
 const publicPath=['/worker-portal/login','/worker-portal/activate','/worker-portal/verify'].includes(req.path);
 const supervisorPath=req.path.startsWith('/supervisor/') || req.path.startsWith('/gemini/') || ['/auth/session','/worker-portal/invitation','/worker-portal/revoke'].includes(req.path);
 const workerPath=['/worker-portal/time-records','/worker-portal/documents','/worker-portal/documents/sign','/worker-portal/projects','/auth/logout'].includes(req.path);
 if(!publicPath && !supervisorPath && !workerPath)return res.status(404).json({error:'Ruta no encontrada'});
 if(req.path==='/worker-portal/login' && (!/^\d{4,6}$/.test(String(req.body?.pin || '')) || String(req.body?.identifier || req.body?.workerId || '').length>150)) return res.status(400).json({error:'Identificador o PIN no válido'});
 const token=req.headers.authorization?.match(/^Bearer ([^ ]+)$/)?.[1];
 let uid:string|undefined;
 if(!publicPath && !token)return res.status(401).json({error:'Inicie sesión para continuar'});
 if(supervisorPath || workerPath && token?.includes('.')) {
  try { uid=await supervisorIdentity(token!); } catch {return res.status(403).json({error:'Sesión de supervisor no válida o sin permisos'});}
 }
 if(req.path.startsWith('/gemini/'))return next();
 if(uid && req.path==='/auth/logout')return res.json({success:true});
 if(req.path==='/auth/session'){
  try{await transact(async()=>true,()=>false);}catch{return res.status(503).json({error:'Almacenamiento pendiente de configuración o migración verificada'});}
  return res.json({uid,role:'supervisor',organizationId:organization});
 }
 const send=res.json.bind(res);let originalStatus=res.statusCode;
 try {
  const result=await transact(async()=>{
   state().actorUid=uid;
   if(workerPath && !uid){
    const session=state().sessions.find(s=>s.id===digest(token!));
    const worker=session && state().workers.find(w=>w.id===session.workerId);
    if(!session || session.expiresAt<=Date.now() || !worker || worker.status!=='active' || session.credentialVersion!==worker.pinHash)return {status:401,body:{error:'Sesión caducada o revocada'}};
    if(req.path==='/auth/logout'){session.expiresAt=0;return {status:200,body:{success:true}};}
    const requested=req.method==='GET'?req.query.workerId:req.body?.workerId;
    if(!ownsWorker(requested,worker.id))return {status:403,body:{error:'No puede acceder a otro trabajador'}};
    state().actorUid=worker.id;
   }
   if(req.path==='/worker-portal/login'){
    const id=digest(String(req.body.identifier || req.body.workerId || '').trim().toUpperCase());
    let attempt=state().attempts.find(a=>a.id===id);
    if(!attempt){attempt={id,count:0,until:Date.now()+15*60*1000};state().attempts.push(attempt);}
    if(attempt.until<Date.now()){attempt.count=0;attempt.until=Date.now()+15*60*1000;}
    if(attempt.count>=5)return {status:429,body:{error:'Demasiados intentos. Espere 15 minutos'}};
    attempt.count++;
   }
   return await new Promise<{status:number;body:unknown}>((resolve,reject)=>{
    res.statusCode=originalStatus;
    res.json=((body:unknown)=>{resolve({status:res.statusCode,body:publicData(body)});return res;}) as Response['json'];
    try{next();}catch(error){reject(error);}
   });
  },result=>result.status<400 || req.path==='/worker-portal/login');
  res.json=send;res.status(result.status);res.setHeader('Cache-Control','no-store');return send(result.body);
 }catch{
  res.json=send;res.statusCode=503;return send({error:'Almacenamiento no disponible. No se ha confirmado la operación'});
 }
}
