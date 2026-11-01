import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp,transact,organization } from '../src/server/persistence.js';
import { state } from '../src/server/stateContext.js';
import { issueSession,hashPin,digest } from '../src/server/credentials.js';
import { handleActivateWorker } from '../src/server/workerPortalService.js';
import express from 'express';
import { access } from '../src/server/access.js';
let emulator:ReturnType<typeof spawn>;
let root:ReturnType<ReturnType<typeof getFirestore>['doc']>;
let db:ReturnType<typeof getFirestore>;
before(async()=>{
 const jar=process.env.FIRESTORE_EMULATOR_JAR;
 assert.ok(jar,'FIRESTORE_EMULATOR_JAR required; integration tests must not target production');
 const portServer=createServer();portServer.listen(0,'127.0.0.1');await once(portServer,'listening');const addr=portServer.address() as any;const port=addr.port;await new Promise<void>(r=>portServer.close(()=>r()));
 process.env.FIRESTORE_EMULATOR_HOST=`127.0.0.1:${port}`;process.env.GCLOUD_PROJECT='demo-uniproyect-security';
 emulator=spawn('java',['-jar',jar,'--host','127.0.0.1','--port',String(port),'--project_id','demo-uniproyect-security'],{stdio:'ignore'});
 let ready=false;for(let i=0;i<150;i++){try{await fetch(`http://127.0.0.1:${port}/`);ready=true;break;}catch{await setTimeout(100);}if(emulator.exitCode!==null)break;}
 assert.ok(ready,'Firestore emulator failed to start');
 db=getFirestore(adminApp());root=db.collection('uniproyect_orgs').doc(organization);
 await root.create({migrationCompleted:true});
 await root.collection('workers').doc('test-worker').create({id:'test-worker',organizationId:organization,status:'active',activationCount:0,pinHash:hashPin('9382')});
});
after(async()=>{if(db)await db.terminate();if(emulator && emulator.exitCode===null){const end=once(emulator,'close');emulator.kill();await end;}});
const commit=()=>true;
test('writes survive a new server-side read without shared process arrays',async()=>{
 await transact(async()=>{state().workers[0].activationCount=3;return true;},commit);
 assert.equal(await transact(async()=>state().workers[0].activationCount,()=>false),3);
 assert.equal((await root.collection('workers').doc('test-worker').get()).get('activationCount'),3);
});
test('aborted operation never persists partial mutations',async()=>{
 await transact(async()=>{state().workers[0].activationCount=900;return false;},()=>false);
 assert.equal((await root.collection('workers').doc('test-worker').get()).get('activationCount'),3);
});
test('concurrent transactions preserve both increments',async()=>{
 await Promise.all([1,2].map(()=>transact(async()=>{state().workers[0].activationCount++;return true;},commit)));
 assert.equal((await root.collection('workers').doc('test-worker').get()).get('activationCount'),5);
});
test('opaque sessions persist as hashes, without bearer value',async()=>{
 const token=await transact(async()=>issueSession('test-worker'),commit);
 const saved=await root.collection('sessions').doc(digest(token)).get();assert.ok(saved.exists);assert.ok(!JSON.stringify(saved.data()).includes(token));
});
test('concurrent activation consumes invitation once',async()=>{
 await root.collection('worker_invitations').doc(digest('one-use')).create({id:'i',workerId:'test-worker',organizationId:organization,expiresAt:new Date(Date.now()+60000).toISOString(),consumed:false,revoked:false});
 const activate=()=>transact(async()=>{let code=200;await handleActivateWorker({body:{token:'one-use',pin:'9382'}} as any,{status(n:number){code=n;return this;},json(){return this;}} as any);return code;},code=>code<400);
 const result=await Promise.all([activate(),activate()]);assert.deepEqual(result.sort(),[200,410]);
});
test('HTTP worker sessions cannot read another worker; revoke is immediate',async()=>{
 const token=await transact(async()=>issueSession('test-worker'),commit);
 const app=express();app.use(express.json());app.use('/api',access);app.get('/api/worker-portal/projects',(req,res)=>res.json({projects:[]}));app.post('/api/auth/logout',(req,res)=>res.json({success:true}));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address() as any;const base=`http://127.0.0.1:${address.port}`;const headers={Authorization:`Bearer ${token}`};
 try{
 assert.equal((await fetch(base+'/api/worker-portal/projects?workerId=another',{headers})).status,403);
 assert.equal((await fetch(base+'/api/worker-portal/projects?workerId=test-worker',{headers})).status,200);
 assert.equal((await fetch(base+'/api/auth/logout',{headers,method:'POST'})).status,200);
 assert.equal((await fetch(base+'/api/worker-portal/projects?workerId=test-worker',{headers})).status,401);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
test('durable state survives two independent application processes',async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const exec=promisify(execFile);
 const prefix="import {transact} from './src/server/persistence.ts';import {state} from './src/server/stateContext.ts';";
 await exec(process.execPath,['--import','tsx','--input-type=module','-e',prefix+"await transact(async()=>{state().workers[0].activationCount=19;return true;},()=>true);process.exit(0);"],{env:process.env});
 const result=await exec(process.execPath,['--import','tsx','--input-type=module','-e',prefix+"console.log(await transact(async()=>state().workers[0].activationCount,()=>false));process.exit(0);"],{env:process.env});
 assert.equal(result.stdout.trim(),'19');
});
