import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { getSupabase } from './client.js';

// View-model compatibility keeps the existing screens and Google integration intact.
export interface User {
  uid: string; email: string | null; displayName: string | null; photoURL: string | null;
  emailVerified: boolean; isAnonymous: boolean; tenantId: string | null;
  providerData: { providerId: string; uid: string; email: string | null; displayName: string | null; photoURL: string | null }[];
}
function mapUser(user: SupabaseUser | undefined): User | null {
  if (!user) return null;
  const result = { uid: user.id, email: user.email ?? null,
    displayName: user.user_metadata?.full_name ?? user.email ?? null,
    photoURL: user.user_metadata?.avatar_url ?? null,
    emailVerified: !!user.email_confirmed_at, isAnonymous: !!user.is_anonymous, tenantId: null };
  return { ...result, providerData: (user.identities ?? []).map(identity => ({
    providerId: identity.provider, uid: identity.id, email: result.email,
    displayName: result.displayName, photoURL: result.photoURL,
  })) };
}
let currentUser: User | null = null;
let providerToken: string | null = null;
function update(session: Session | null) {
  currentUser = mapUser(session?.user);
  providerToken = session?.provider_token ?? (session ? providerToken : null);
}
export const auth = { get currentUser() { return currentUser; }, signOut: () => signOut(auth) };
export function onAuthStateChanged(_auth: typeof auth, callback: (user: User | null) => void) {
  let active = true;
  try {
    const client = getSupabase();
    client.auth.getSession().then(({ data }) => { if (active) { update(data.session); callback(currentUser); } });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      update(session); if (active) callback(currentUser);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  } catch { queueMicrotask(() => { if (active) callback(null); }); return () => { active = false; }; }
}
export class GoogleAuthProvider {
  scopes = new Set<string>();
  addScope(scope: string) { this.scopes.add(scope); }
  static credentialFromResult(result: { accessToken?: string }) { return { accessToken: result.accessToken ?? providerToken }; }
}
export const googleProvider = new GoogleAuthProvider();
export async function signInWithPopup(_auth: typeof auth, provider: GoogleAuthProvider): Promise<{ user: User; accessToken: string }> {
  const { error } = await getSupabase().auth.signInWithOAuth({ provider: 'google', options: {
    redirectTo: window.location.origin + '/', scopes: [...provider.scopes].join(' '),
    queryParams: { prompt: 'consent', access_type: 'offline' },
  } });
  if (error) throw new Error('No se pudo iniciar la conexión con Google.');
  // Supabase OAuth uses a full-page redirect. This call intentionally never resolves before navigation.
  return new Promise(() => {});
}
export async function signOut(_auth: typeof auth) {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
  update(null);
}
export function getGoogleToken() { return providerToken; }
