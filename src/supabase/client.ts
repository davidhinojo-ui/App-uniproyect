import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://byczwnknarrnoiaoqyxa.supabase.co';
let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const env = (import.meta as any).env || {};
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url !== SUPABASE_URL || !key || !/^sb_publishable_/.test(key)) {
    throw new Error('Configura la conexión pública con Supabase de UniProyect.');
  }
  client = createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } });
  return client;
}

export async function supervisorContext() {
  const supabase = getSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Inicia sesión para acceder a los datos.');
  const profile = await supabase.from('perfiles').select('organizacion_id,rol').eq('id', session.user.id).single();
  if (profile.error || !profile.data || !['administrador', 'supervisor'].includes(profile.data.rol)) {
    throw new Error('Tu cuenta no tiene permisos de gestión.');
  }
  return { supabase, session, organizationId: profile.data.organizacion_id as string };
}
