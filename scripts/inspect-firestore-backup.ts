import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { inspectFirestoreBackup } from '../src/server/firestoreBackup.js';

const [file, projectId, databaseId] = process.argv.slice(2);
if (!file || !projectId || !databaseId) throw new Error('Usage: node --import tsx scripts/inspect-firestore-backup.ts BACKUP.json.gz PROJECT DATABASE');
const bytes = readFileSync(file);
const backup = JSON.parse(gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 }).toString('utf8'));
const inventory = inspectFirestoreBackup(backup, { projectId, databaseId });
console.log(JSON.stringify({ ...inventory, sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2));
