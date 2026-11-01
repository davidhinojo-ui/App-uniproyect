export function firestoreTarget(env: NodeJS.ProcessEnv = process.env) {
  const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST);
  const projectId = env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT;
  const databaseId = env.FIRESTORE_DATABASE_ID || (emulator ? '(default)' : undefined);
  if (!projectId || !databaseId) {
    throw new Error('Explicit GOOGLE_CLOUD_PROJECT and FIRESTORE_DATABASE_ID required before accessing Firestore');
  }
  if (projectId.includes('/') || databaseId.includes('/') || !projectId.trim() || !databaseId.trim()) {
    throw new Error('Invalid Firestore project or database identity');
  }
  if (!emulator && !env.UNIPROYECT_ORGANIZATION_ID) {
    throw new Error('Explicit UNIPROYECT_ORGANIZATION_ID required outside the emulator');
  }
  return { projectId, databaseId };
}
