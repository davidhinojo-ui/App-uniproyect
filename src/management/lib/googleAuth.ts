import { auth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, getGoogleToken, type User } from '../../supabase/authCompat';
export { auth };
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
let cachedToken: string | null = null;
export const setCachedAccessToken = (token: string | null) => { cachedToken = token; };
export function initAuth(success?: (user: User, token: string) => void, failure?: () => void) {
  return onAuthStateChanged(auth, user => { const token = cachedToken || getGoogleToken(); if (user && token) success?.(user, token); else { cachedToken = null; failure?.(); } });
}
export async function googleSignIn(): Promise<{ user: User; accessToken: string } | null> { return signInWithPopup(auth, provider); }
export async function getAccessToken() { return cachedToken || getGoogleToken(); }
export async function logout() { await auth.signOut(); cachedToken = null; }
