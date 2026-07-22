-- Ejecutar esto en el SQL Editor de tu proyecto Supabase (supabase.com -> tu proyecto -> SQL Editor -> New query)

create table if not exists materiales (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,                 -- valor crudo leído del QR/código de barras
  nombre text not null,
  cantidad numeric not null default 1,
  unidad text default 'pza',
  ubicacion text,
  categoria text,
  notas text,
  registrado_por text,                  -- email de quien registró
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists materiales_codigo_key on materiales (codigo);

create index if not exists materiales_created_at_idx on materiales (created_at desc);

-- Mantener updated_at al día en cada edición
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists materiales_set_updated_at on materiales;
create trigger materiales_set_updated_at
  before update on materiales
  for each row
  execute function set_updated_at();

-- Seguridad: solo usuarios autenticados (cualquier persona con cuenta en el proyecto) pueden leer/escribir
alter table materiales enable row level security;

drop policy if exists "materiales_select_auth" on materiales;
create policy "materiales_select_auth" on materiales
  for select using (auth.role() = 'authenticated');

drop policy if exists "materiales_insert_auth" on materiales;
create policy "materiales_insert_auth" on materiales
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "materiales_update_auth" on materiales;
create policy "materiales_update_auth" on materiales
  for update using (auth.role() = 'authenticated');

drop policy if exists "materiales_delete_auth" on materiales;
create policy "materiales_delete_auth" on materiales
  for delete using (auth.role() = 'authenticated');

-- Almacenes: catálogo de ubicaciones/bodegas (independiente de "ubicacion" en
-- materiales, que sigue siendo texto libre — aquí solo se administra la lista)
create table if not exists almacenes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists almacenes_nombre_key on almacenes (nombre);

drop trigger if exists almacenes_set_updated_at on almacenes;
create trigger almacenes_set_updated_at
  before update on almacenes
  for each row
  execute function set_updated_at();

alter table almacenes enable row level security;

drop policy if exists "almacenes_select_auth" on almacenes;
create policy "almacenes_select_auth" on almacenes
  for select using (auth.role() = 'authenticated');

drop policy if exists "almacenes_insert_auth" on almacenes;
create policy "almacenes_insert_auth" on almacenes
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "almacenes_update_auth" on almacenes;
create policy "almacenes_update_auth" on almacenes
  for update using (auth.role() = 'authenticated');

drop policy if exists "almacenes_delete_auth" on almacenes;
create policy "almacenes_delete_auth" on almacenes
  for delete using (auth.role() = 'authenticated');

-- Categorías: catálogo compartido de categorías (independiente de "categoria"
-- en materiales, que sigue siendo texto libre — aquí solo se administra la lista)
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists categorias_nombre_key on categorias (nombre);

drop trigger if exists categorias_set_updated_at on categorias;
create trigger categorias_set_updated_at
  before update on categorias
  for each row
  execute function set_updated_at();

alter table categorias enable row level security;

drop policy if exists "categorias_select_auth" on categorias;
create policy "categorias_select_auth" on categorias
  for select using (auth.role() = 'authenticated');

drop policy if exists "categorias_insert_auth" on categorias;
create policy "categorias_insert_auth" on categorias
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "categorias_update_auth" on categorias;
create policy "categorias_update_auth" on categorias
  for update using (auth.role() = 'authenticated');

drop policy if exists "categorias_delete_auth" on categorias;
create policy "categorias_delete_auth" on categorias
  for delete using (auth.role() = 'authenticated');
