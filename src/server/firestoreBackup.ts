type RawDocument = { name: string; fields?: Record<string, unknown> };

/** Inspect paths and field names only. Never flatten different users or expose values/UIDs. */
export function inspectFirestoreBackup(input: unknown, expected: { projectId: string; databaseId: string }) {
  const backup = input as Record<string, any>;
  if (!backup || backup.format !== 'uniproyect-firestore-rest-v1' ||
      backup.project !== expected.projectId || backup.database !== expected.databaseId ||
      typeof backup.readTime !== 'string' || !Number.isFinite(Date.parse(backup.readTime)) ||
      !Array.isArray(backup.documents) || !Array.isArray(backup.collections)) {
    throw new Error('Unsupported backup format, identity or read time');
  }
  const prefix = `projects/${expected.projectId}/databases/${expected.databaseId}/documents/`;
  function path(name: unknown, document: boolean) {
    if (typeof name !== 'string' || !name.startsWith(prefix)) throw new Error('Foreign or invalid backup path');
    const parts = name.slice(prefix.length).split('/');
    if (parts.some(part => !part || part === '.' || part === '..') || parts.length % 2 !== (document ? 0 : 1)) {
      throw new Error('Invalid document or collection path');
    }
    return parts;
  }
  const collections = new Set<string>();
  for (const name of backup.collections) {
    path(name, false);
    if (collections.has(name)) throw new Error('Duplicate collection in backup');
    collections.add(name);
  }
  const names = new Set<string>();
  const scopes = new Map<string, { alias: string; documents: number }>();
  const groups = new Map<string, { documents: number; fields: Set<string> }>();
  for (const doc of backup.documents as RawDocument[]) {
    if (!doc || typeof doc !== 'object') throw new Error('Invalid backup document');
    const parts = path(doc.name, true);
    if (names.has(doc.name)) throw new Error('Duplicate document in backup');
    names.add(doc.name);
    if (!collections.has(doc.name.slice(0, doc.name.lastIndexOf('/')))) throw new Error('Document collection missing from backup inventory');
    if (doc.fields !== undefined && (!doc.fields || typeof doc.fields !== 'object' || Array.isArray(doc.fields))) {
      throw new Error('Invalid document fields');
    }
    const scoped = parts[0] === 'users';
    const scopeKey = scoped ? `user:${parts[1]}` : '(root)';
    if (!scopes.has(scopeKey)) {
      scopes.set(scopeKey, { alias: scoped ? `user-${[...scopes.keys()].filter(k => k !== '(root)').length + 1}` : 'root', documents: 0 });
    }
    scopes.get(scopeKey)!.documents++;
    const pattern = parts.filter((_, i) => i % 2 === 0).join('/');
    const key = `${scopes.get(scopeKey)!.alias}/${pattern}`;
    if (!groups.has(key)) groups.set(key, { documents: 0, fields: new Set() });
    const group = groups.get(key)!;
    group.documents++;
    for (const field of Object.keys(doc.fields || {})) group.fields.add(field);
  }
  return {
    format: 'uniproyect-firestore-inventory-v1',
    project: backup.project, database: backup.database, readTime: backup.readTime,
    documents: names.size, collections: collections.size,
    scopes: [...scopes.values()],
    groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, group]) => ({
      path, documents: group.documents, fields: [...group.fields].sort(),
    })),
    importReady: false,
    reason: 'Historical schema requires explicit ownership and field mapping; this inventory does not validate a restore or authorize a migration.',
  };
}
