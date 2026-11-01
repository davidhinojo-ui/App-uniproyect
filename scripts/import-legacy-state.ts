/** Run only after an authenticated, consistent backup of the old live process has been secured. */
import { readFileSync } from 'node:fs';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp, organization } from '../src/server/persistence.js';
import { hashPin } from '../src/server/credentials.js';
const file=process.argv[2];
if(!file || !process.env.GOOGLE_CLOUD_PROJECT)throw new Error('Snapshot path and explicit GOOGLE_CLOUD_PROJECT required');
const snapshot=JSON.parse(readFileSync(file,'utf8'));
const mapping={workers:'workers',projects:'projects',records:'time_records',documents:'worker_documents',invitations:'worker_invitations',audit:'audit_logs'};
const entries:any[]=[];
for(const [key,collection] of Object.entries(mapping)){
 if(!Array.isArray(snapshot[key]))throw new Error(`Snapshot missing ${key}; partial imports are forbidden`);
 const seen=new Set();
 for(const source of snapshot[key]){
  const item=JSON.parse(JSON.stringify(source));
  const id=key==='invitations'?item.tokenHash:item.id;
  if(typeof id!=='string' || id.includes('/') || !id || seen.has(id) || item.organizationId!==organization)throw new Error(`Invalid or duplicate identity in ${key}`);
  seen.add(id);
  if(key==='workers' && item.pin){item.pinHash=hashPin(item.pin);delete item.pin;}
  if(key==='invitations'){delete item.tokenPlain;delete item.activationUrl;}
  entries.push({collection,id,item});
 }
}
if(entries.length>450)throw new Error('Snapshot exceeds atomic import size; staged migration required');
if(!process.argv.includes('--apply')){console.log(JSON.stringify({valid:true,records:entries.length,applied:false}));process.exit(0);}
const root=getFirestore(adminApp()).collection('uniproyect_orgs').doc(organization);
await getFirestore(adminApp()).runTransaction(async tx=>{
 const existing=await tx.get(root);
 const collections=await Promise.all(Object.values(mapping).map(name=>tx.get(root.collection(name).limit(1))));
 if(existing.exists || collections.some(s=>!s.empty))throw new Error('Destination not empty: refusing overwrite');
 for(const {collection,id,item} of entries)tx.create(root.collection(collection).doc(id),item);
 tx.create(root,{migrationCompleted:true,importedRecords:entries.length,importedAt:new Date().toISOString()});
});
console.log(JSON.stringify({applied:true,records:entries.length}));
