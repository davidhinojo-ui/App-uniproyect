-- Additive storage for the unchanged UniProyect document shapes and portal.
-- Existing normalized tables and profiles are preserved.
create table public.up_replica_documents (
  organizacion_id uuid not null references public.organizaciones(id),
  collection text not null check (collection in ('obras','documentos','personal','gastosGenerales','proveedores','trabajadores','plantillaTrabajadores','fichajes','notifications')),
  id text not null check (length(id) between 1 and 200),
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 8388608),
  updated_at timestamptz not null default now(),
  primary key (organizacion_id, collection, id)
);
alter table public.up_replica_documents enable row level security;
revoke all on public.up_replica_documents from anon, authenticated;
grant select, insert, update, delete on public.up_replica_documents to authenticated;
grant all on public.up_replica_documents to service_role;
create policy replica_supervisor_read on public.up_replica_documents for select to authenticated
using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.organizacion_id = up_replica_documents.organizacion_id and p.rol in ('administrador','supervisor')));
create policy replica_supervisor_insert on public.up_replica_documents for insert to authenticated
with check (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.organizacion_id = up_replica_documents.organizacion_id and p.rol in ('administrador','supervisor')));
create policy replica_supervisor_update on public.up_replica_documents for update to authenticated
using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.organizacion_id = up_replica_documents.organizacion_id and p.rol in ('administrador','supervisor')))
with check (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.organizacion_id = up_replica_documents.organizacion_id and p.rol in ('administrador','supervisor')));
create policy replica_supervisor_delete on public.up_replica_documents for delete to authenticated
using (exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.organizacion_id = up_replica_documents.organizacion_id and p.rol in ('administrador','supervisor')));

create table public.up_replica_portal (
  organizacion_id uuid primary key references public.organizaciones(id),
  revision bigint not null default 0,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.up_replica_portal enable row level security;
-- Contains credential hashes and worker sessions: never exposed to browser roles.
revoke all on public.up_replica_portal from anon, authenticated;
grant all on public.up_replica_portal to service_role;

create function public.up_replica_apply_documents(p_org uuid, p_ops jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare op jsonb;
begin
  if current_user <> 'service_role' and not exists (
    select 1 from public.perfiles where id = (select auth.uid()) and organizacion_id = p_org and rol in ('administrador','supervisor')
  ) then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 10000 then
    raise exception 'Lote no válido';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  for op in select value from jsonb_array_elements(p_ops) loop
    if op->>'action' = 'delete' then
      delete from public.up_replica_documents where organizacion_id=p_org and collection=op->>'collection' and id=op->>'id';
    elsif op->>'action' = 'set' then
      insert into public.up_replica_documents(organizacion_id,collection,id,data)
      values (p_org,op->>'collection',op->>'id',op->'data')
      on conflict (organizacion_id,collection,id) do update set data=excluded.data, updated_at=now();
    else raise exception 'Operación no válida'; end if;
  end loop;
end;
$$;
revoke all on function public.up_replica_apply_documents(uuid,jsonb) from public, anon;
grant execute on function public.up_replica_apply_documents(uuid,jsonb) to authenticated, service_role;

-- All portal mutations, invitation consumption and cost allocation commit atomically.
create function public.up_replica_commit_portal(p_org uuid, p_revision bigint, p_state jsonb, p_ops jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  update public.up_replica_portal set state=p_state, revision=revision+1, updated_at=now()
  where organizacion_id=p_org and revision=p_revision;
  if not found then return false; end if;
  perform public.up_replica_apply_documents(p_org,p_ops);
  return true;
end;
$$;
revoke all on function public.up_replica_commit_portal(uuid,bigint,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.up_replica_commit_portal(uuid,bigint,jsonb,jsonb) to service_role;

-- Document changes invalidate request snapshots, even if issued via the Data API.
create function public.up_replica_document_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.up_replica_portal set revision=revision+1, updated_at=now()
  where organizacion_id=coalesce(new.organizacion_id,old.organizacion_id);
  return coalesce(new,old);
end;
$$;
revoke all on function public.up_replica_document_revision() from public, anon, authenticated;
create trigger replica_document_revision after insert or update or delete on public.up_replica_documents
for each row execute function public.up_replica_document_revision();
