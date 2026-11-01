import { test } from 'node:test';
import assert from 'node:assert/strict';
import { context, type State } from '../src/server/stateContext.js';
import { hashPin,verifyPin,issueSession,digest,publicData } from '../src/server/credentials.js';
import { handleActivateWorker,handleWorkerLogin,handleRevokeWorker } from '../src/server/workerPortalService.js';
import { ownsWorker, access } from '../src/server/access.js';
const fresh=():State=>({workers:[],projects:[],records:[],documents:[],audit:[],sessions:[],attempts:[],invitations:new Map()});
async function call(handler:any,body:any){let status=200;let data:any;await handler({body,query:{}},{status(n:number){status=n;return this;},json(v:any){data=v;return this;}});return {status,data};}

test('PIN hashes have random salts, constant-time validation, no plaintext',()=>{
 const a=hashPin('9382'),b=hashPin('9382');assert.notEqual(a,b);assert.ok(verifyPin('9382',a));assert.ok(!verifyPin('1111',a));assert.ok(!verifyPin('9382','garbage'));
});
test('API sanitization strips credentials recursively',()=>{assert.deepEqual(publicData({worker:{pin:'secret',pinHash:'hash',id:'a'},items:[{tokenHash:'h',tokenPlain:'t'}]}),{worker:{id:'a'},items:[{}]});});
test('request state is isolated across concurrent requests',async()=>{
 const a=fresh(),b=fresh();await Promise.all([context.run(a,async()=>{await new Promise(r=>setTimeout(r,10));issueWorker();}),context.run(b,async()=>{issueWorker();})]);
 assert.equal(a.workers.length,1);assert.equal(b.workers.length,1);
 function issueWorker(){const s=context.getStore()!;s.workers.push({id:'worker'} as any);}
});
test('bearer sessions are random and only their hashes are retained',()=>context.run(fresh(),()=>{
 context.getStore()!.workers.push({id:'w',pinHash:hashPin('9382')} as any);
 const a=issueSession('w'),b=issueSession('w');assert.notEqual(a,b);assert.equal(context.getStore()!.sessions[0].id,digest(a));assert.ok(!JSON.stringify(context.getStore()!.sessions).includes(a));
}));
test('activation validates PIN before consuming QR, then prevents reuse',async()=>context.run(fresh(),async()=>{
 const s=context.getStore()!;s.workers.push({id:'w',activationCount:0,status:'pending'} as any);
 s.invitations.set(digest('test-invitation'),{id:'i',workerId:'w',expiresAt:new Date(Date.now()+60000).toISOString(),consumed:false,revoked:false} as any);
 assert.equal((await call(handleActivateWorker,{token:'test-invitation',pin:'x'})).status,400);
 assert.equal(s.invitations.get(digest('test-invitation'))!.consumed,false);
 const result=await call(handleActivateWorker,{token:'test-invitation',pin:'9382'});assert.equal(result.status,200);assert.equal(s.sessions.length,1);assert.ok(s.workers[0].pinHash);assert.equal(s.workers[0].pin,undefined);
 assert.equal((await call(handleActivateWorker,{token:'test-invitation',pin:'9382'})).status,410);
}));
test('PIN login rejects wrong PIN and suspended worker',async()=>context.run(fresh(),async()=>{
 const s=context.getStore()!;s.workers.push({id:'w',status:'active',pinHash:hashPin('9382')} as any);
 assert.equal((await call(handleWorkerLogin,{identifier:'w',pin:'0000'})).status,401);
 assert.equal((await call(handleWorkerLogin,{identifier:'w',pin:'9382'})).status,200);
 s.workers[0].status='suspended';assert.equal((await call(handleWorkerLogin,{identifier:'w',pin:'9382'})).status,403);
}));
test('owner guard refuses another worker and ambiguous parameters',()=>{assert.ok(ownsWorker('a','a'));assert.ok(!ownsWorker('b','a'));assert.ok(!ownsWorker(['a','b'],'a'));});
test('supervisor endpoints deny anonymous callers before storage access',async()=>{
 for(const path of ['/supervisor/workers','/worker-portal/invitation','/worker-portal/revoke','/gemini/analyze']){
  let code=200;let next=false;await access({path,headers:{},method:'POST'} as any,{status(n:number){code=n;return this;},json(){return this;}} as any,()=>{next=true;});assert.equal(code,401);assert.equal(next,false);
 }
});
