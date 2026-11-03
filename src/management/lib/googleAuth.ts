/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google Auth Provider with Drive and Gmail scopes
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');

// In-memory access token cache with sessionStorage fallback
let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem('up_g_access_token') : null;
let isSigningIn = false;

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('up_g_access_token', token);
    } else {
      sessionStorage.removeItem('up_g_access_token');
    }
  }
};

/**
 * Initialize OAuth listener to monitor and capture session changes
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = cachedAccessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('up_g_access_token') : null);
      if (token) {
        cachedAccessToken = token;
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('up_g_access_token');
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Standard Sign In with Google popup handler
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo extraer el token de acceso de Google OAuth.');
    }

    setCachedAccessToken(credential.accessToken);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Error durante la autenticación de Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Access cached token
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('up_g_access_token');
    if (saved) {
      cachedAccessToken = saved;
      return saved;
    }
  }
  return null;
};

/**
 * Session wipe operation
 */
export const logout = async () => {
  await auth.signOut();
  setCachedAccessToken(null);
};
