import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectFirestoreBackup } from '../src/server/firestoreBackup.js';
import { firestoreTarget } from '../src/server/firestoreTarget.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const target = { projectId: 'demo-test', databaseId: 'named-db' };
const prefix = 'projects/demo-test/databases/named-db/documents/';
const fixture = () => ({
  format: 'uniproyect-firestore-rest-v1', project: target.projectId, database: target.databaseId,
  readTime: '2026-11-01T21:45:08.223530Z',
  collections: [prefix + 'obras', prefix + 'users/private-owner/obras', prefix + 'users/another-owner/obras'],
  documents: [
    { name: prefix + 'obras/project-a', fields: { name: { stringValue: 'Private work name' } } },
    { name: prefix + 'users/private-owner/obras/project-a', fields: { name: { stringValue: 'Other private name' } } },
    { name: prefix + 'users/another-owner/obras/project-a', fields: { budget: { doubleValue: 4000 } } },
  ],
});
test('historical inventory keeps root and individual users separate without exposing their values or IDs', () => {
  const result = inspectFirestoreBackup(fixture(), target);
  assert.equal(result.documents, 3);
  assert.deepEqual(result.scopes, [{ alias: 'root', documents: 1 }, { alias: 'user-1', documents: 1 }, { alias: 'user-2', documents: 1 }]);
  assert.equal(result.groups.length, 3);
  assert.equal(result.importReady, false);
  for (const value of ['private-owner', 'another-owner', 'Private work name', '4000', 'project-a']) assert.ok(!JSON.stringify(result).includes(value));
});
test('inventory refuses a foreign database, duplicate document and missing collection', () => {
  assert.throws(() => inspectFirestoreBackup(fixture(), { ...target, databaseId: 'wrong' }));
  const duplicate = fixture(); duplicate.documents.push(duplicate.documents[0]);
  assert.throws(() => inspectFirestoreBackup(duplicate, target), /Duplicate document/);
  const incomplete = fixture(); incomplete.collections.pop();
  assert.throws(() => inspectFirestoreBackup(incomplete, target), /collection missing/);
  const foreign = fixture(); foreign.documents[0].name = foreign.documents[0].name.replace('named-db', 'other-db');
  assert.throws(() => inspectFirestoreBackup(foreign, target), /Foreign/);
});
test('Firestore production requires explicit database and organization instead of silently using defaults', () => {
  assert.throws(() => firestoreTarget({ GOOGLE_CLOUD_PROJECT: 'demo-test' }));
  assert.throws(() => firestoreTarget({ GOOGLE_CLOUD_PROJECT: 'demo-test', FIRESTORE_DATABASE_ID: 'named-db' }));
  assert.deepEqual(firestoreTarget({ GOOGLE_CLOUD_PROJECT: 'demo-test', FIRESTORE_DATABASE_ID: 'named-db', UNIPROYECT_ORGANIZATION_ID: 'confirmed-org' }), target);
  assert.deepEqual(firestoreTarget({ GCLOUD_PROJECT: 'demo-test', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }), { projectId: 'demo-test', databaseId: '(default)' });
});
test('importer refuses historical JSON and gzip even with --apply, before initializing Firebase', () => {
  const folder=mkdtempSync(join(tmpdir(),'uniproyect-import-test-'));
  try {
    for (const compressed of [false,true]) {
      const file=join(folder,compressed?'backup.json.gz':'backup.json');
      const bytes=Buffer.from(JSON.stringify(fixture()));
      writeFileSync(file,compressed?gzipSync(bytes):bytes);
      const run=spawnSync(process.execPath,['--import','tsx','scripts/import-legacy-state.ts',file,'--apply'],{
        encoding:'utf8',env:{...process.env,GOOGLE_CLOUD_PROJECT:'demo-test',FIRESTORE_DATABASE_ID:'',GOOGLE_APPLICATION_CREDENTIALS:join(folder,'no-credentials.json')},
      });
      assert.notEqual(run.status,0);
      assert.match(run.stderr,/Historical Firestore backup is not a portal snapshot/);
    }
  } finally { rmSync(folder,{recursive:true,force:true}); }
});
