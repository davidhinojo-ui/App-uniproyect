import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from 'firebase/auth';
let auth:Auth;
export let supervisorToken:string|null=null;
export async function loginSupervisor() {
 const response=await fetch('/api/auth/config');
 if(!response.ok)throw new Error('Falta configurar Firebase Authentication en el servidor');
 const config=await response.json();
 auth=getAuth(getApps()[0] || initializeApp(config));
 const result=await signInWithPopup(auth,new GoogleAuthProvider());
 supervisorToken=await result.user.getIdToken(true);
 const verify=await fetch('/api/auth/session',{headers:{Authorization:`Bearer ${supervisorToken}`}});
 if(!verify.ok){const error=await verify.json();supervisorToken=null;await signOut(auth);throw new Error(error.error || 'Esta cuenta no tiene permisos de supervisor para la empresa');}
}
export async function authToken() { return auth?.currentUser ? auth.currentUser.getIdToken() : supervisorToken; }
export async function logoutSupervisor(){supervisorToken=null;if(auth)await signOut(auth);}
