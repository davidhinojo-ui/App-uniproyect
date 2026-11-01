import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { context, type State } from './stateContext.js';
import { hashPin } from './credentials.js';
import { firestoreTarget } from './firestoreTarget.js';
export const organization = process.env.UNIPROYECT_ORGANIZATION_ID || 'org-jose-real';
export function adminApp() { return getApps()[0] || initializeApp({credential:applicationDefault(),projectId:process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT}); }
export function firestoreDb() {
 const {projectId,databaseId}=firestoreTarget();
 const app=adminApp();
 if(app.options.projectId!==projectId)throw new Error('Firebase app project does not match the configured Firestore project');
 const db=getFirestore(app,databaseId);
 return db;
}
const collections = {workers:'workers',projects:'projects',records:'time_records',documents:'worker_documents',audit:'audit_logs',sessions:'sessions',attempts:'login_attempts'} as const;
export async function transact<T>(action:()=>Promise<T>, commit:(result:T)=>boolean):Promise<T> {
 const db=firestoreDb();
 const root=db.collection('uniproyect_orgs').doc(organization);
 return db.runTransaction(async tx=>{
  // The lock document serializes concurrent actions, including QR consumption.
  const organizationDoc = await tx.get(root);
  if (!organizationDoc.exists || organizationDoc.get('migrationCompleted') !== true) throw new Error('Import and verify the legacy snapshot before enabling the service');
  const entries=Object.entries(collections);
  const snapshots=await Promise.all(entries.map(([,name])=>tx.get(root.collection(name))));
  const inv=await tx.get(root.collection('worker_invitations'));
  const s:any={invitations:new Map(inv.docs.map(d=>[d.id,d.data()]))};
  entries.forEach(([key],i)=>{s[key]=snapshots[i].docs.map(d=>d.data());});
  for(const w of s.workers) {if(w.pin){w.pinHash=hashPin(w.pin);delete w.pin;}}
  const result=await context.run(s as State,action);
  if(commit(result)) {
   let writes=0;
   for(let i=0;i<entries.length;i++) {
    const [key,name]=entries[i];const old=new Map(snapshots[i].docs.map(d=>[d.id,JSON.stringify(d.data())]));
    for(const item of s[key]) {
     const clean=JSON.parse(JSON.stringify(item));
     if(old.get(item.id)!==JSON.stringify(clean)) {tx.set(root.collection(name).doc(item.id),clean);writes++;}
    }
   }
   const old=new Map(inv.docs.map(d=>[d.id,JSON.stringify(d.data())]));
   for(const [id,item] of s.invitations){const clean=JSON.parse(JSON.stringify(item));delete clean.tokenPlain;delete clean.activationUrl;if(old.get(id)!==JSON.stringify(clean)){tx.set(root.collection('worker_invitations').doc(id),clean);writes++;}}
   // Fail atomically rather than silently dropping data at Firestore's write limit.
   if(writes>450)throw new Error('Migration requires an explicit batch import');
   if(writes)tx.set(root,{updatedAt:new Date().toISOString()},{merge:true});
  }
  return result;
 });
}
