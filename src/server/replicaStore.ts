import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { decodeState, encodeState, type DocumentWrite, type PortalState } from './replicaState.js';
export const SUPABASE_ORIGIN = 'https://byczwnknarrnoiaoqyxa.supabase.co';
export function replicaConfig() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_ORGANIZATION_ID } = process.env;
  if (SUPABASE_URL !== SUPABASE_ORIGIN || !SUPABASE_SECRET_KEY || !SUPABASE_ORGANIZATION_ID) {
    throw new Error('La conexión del servidor con Supabase está pendiente de configurar.');
  }
  return { url: SUPABASE_URL, secret: SUPABASE_SECRET_KEY, organizationId: SUPABASE_ORGANIZATION_ID };
}
export function createStore() {
  const config = replicaConfig();
  const client = createClient(config.url, config.secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    config,
    async supervisor(req: Request) {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw Object.assign(new Error('Inicia sesión para acceder.'), { status: 401 });
      const user = await client.auth.getUser(token);
      if (user.error || !user.data.user) throw Object.assign(new Error('Sesión no válida.'), { status: 401 });
      const profile = await client.from('perfiles').select('id,organizacion_id,rol').eq('id', user.data.user.id).single();
      if (profile.error || profile.data?.organizacion_id !== config.organizationId || !['administrador','supervisor'].includes(profile.data.rol)) {
        throw Object.assign(new Error('No tienes permisos de gestión.'), { status: 403 });
      }
      return profile.data;
    },
    async load() {
      const init = await client.from('up_replica_portal').upsert({ organizacion_id: config.organizationId }, { onConflict: 'organizacion_id', ignoreDuplicates: true });
      if (init.error) throw new Error('No se pudo abrir la base del portal.');
      const snapshot = await client.from('up_replica_portal').select('revision,state').eq('organizacion_id',config.organizationId).single();
      const organization = await client.from('organizaciones').select('nombre').eq('id',config.organizationId).single();
      if (snapshot.error || organization.error) throw new Error('No se pudieron consultar los datos del portal.');
      const management: Record<string, any[]> = {};
      for (let offset=0;;offset+=500) {
        const rows = await client.from('up_replica_documents').select('collection,id,data').eq('organizacion_id',config.organizationId).order('collection').order('id').range(offset,offset+499);
        if (rows.error) throw new Error('No se pudieron consultar los datos de gestión.');
        for (const row of rows.data) (management[row.collection] ??= []).push({ ...row.data, id: row.id });
        if (rows.data.length < 500) break;
      }
      return { revision: snapshot.data.revision, state: decodeState(config.organizationId, organization.data.nombre, snapshot.data.state), management };
    },
    async commit(revision: number, state: PortalState, operations: DocumentWrite[]) {
      const result = await client.rpc('up_replica_commit_portal', { p_org: config.organizationId, p_revision: revision, p_state: encodeState(state), p_ops: operations });
      if (result.error) throw new Error('No se guardaron los cambios. Vuelve a intentarlo.');
      return result.data === true;
    },
  };
}
