import { getSupabase } from './client.js';
export async function authorizedFetch(input: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const isWorker = input.startsWith('/api/worker-portal/') && !/\/(invitation|revoke)(?:\?|$)/.test(input);
  if (isWorker) {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('uniproyect_worker_token') : null;
    const directPortal = typeof window !== 'undefined' && /portal|login-operario|w=|workerId=|token=/.test(window.location.hash + window.location.search);
    if (token && directPortal) headers.set('Authorization', `Bearer ${token}`);
    else {
      const { data } = await getSupabase().auth.getSession();
      if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
      else if (token) headers.set('Authorization', `Bearer ${token}`);
    }
  } else {
    const { data } = await getSupabase().auth.getSession();
    if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...options, headers });
}
