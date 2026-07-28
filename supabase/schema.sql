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

-- Ubicación exacta dentro del almacén (independiente de "ubicacion", que
-- sigue siendo el almacén/bodega en general) y datos adicionales del
-- formulario de registro.
alter table materiales add column if not exists pasillo text;
alter table materiales add column if not exists estante text;
alter table materiales add column if not exists nivel text;
alter table materiales add column if not exists proveedor text;
alter table materiales add column if not exists estado text not null default 'Disponible'
  check (estado in ('Disponible', 'En uso', 'Prestado', 'Dañado', 'En reparación', 'Agotado'));

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

-- Perfiles: datos adicionales de cada usuario que Supabase Auth no guarda
-- directamente (nombre, teléfono) — se llenan solos al registrarse, vía el
-- trigger de más abajo, tomando el metadata que manda signUp().
create table if not exists perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  telefono text,
  email text,
  created_at timestamptz not null default now()
);

alter table perfiles enable row level security;

-- A diferencia de las demás tablas (compartidas entre todo el equipo), un
-- perfil es privado: cada quien solo ve/edita el suyo.
drop policy if exists "perfiles_select_own" on perfiles;
create policy "perfiles_select_own" on perfiles
  for select using (auth.uid() = id);

drop policy if exists "perfiles_update_own" on perfiles;
create policy "perfiles_update_own" on perfiles
  for update using (auth.uid() = id);

drop policy if exists "perfiles_insert_own" on perfiles;
create policy "perfiles_insert_own" on perfiles
  for insert with check (auth.uid() = id);

-- Trigger: al crearse un usuario en auth.users, crea su fila en "perfiles"
-- tomando nombre/telefono del metadata que mandó signUp(). security definer
-- porque el trigger corre sobre auth.users (fuera del control del usuario) y
-- necesita permiso para escribir en perfiles saltándose la política de
-- arriba (que exige auth.uid() = id, y en este punto aún no hay sesión).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, telefono, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'nombre',
    new.raw_user_meta_data ->> 'telefono',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- Movimientos: historial de cambios de cantidad de un material (entradas,
-- salidas, transferencias entre ubicaciones, ajustes de inventario). A
-- partir de aquí "cantidad" en materiales ya no se edita a mano desde el
-- formulario — cada cambio real queda como un renglón aquí, y es esta
-- tabla (vía el trigger de abajo) la que actualiza materiales.cantidad,
-- nunca el frontend directamente.
create table if not exists movimientos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiales (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida', 'transferencia', 'ajuste')),
  -- Para entrada/salida/transferencia es la cantidad movida (siempre > 0).
  -- Para ajuste es el nuevo valor absoluto de la cantidad (puede ser 0, p.
  -- ej. para dejar el inventario en cero, pero no negativo).
  cantidad numeric not null check (cantidad >= 0 and (tipo = 'ajuste' or cantidad > 0)),
  destino text,                         -- solo aplica (y se exige) para 'transferencia'
  responsable text not null,
  observaciones text,
  created_at timestamptz not null default now(),
  check (tipo <> 'transferencia' or destino is not null)
);

create index if not exists movimientos_material_id_idx on movimientos (material_id);
create index if not exists movimientos_created_at_idx on movimientos (created_at desc);

alter table movimientos enable row level security;

drop policy if exists "movimientos_select_auth" on movimientos;
create policy "movimientos_select_auth" on movimientos
  for select using (auth.role() = 'authenticated');

drop policy if exists "movimientos_insert_auth" on movimientos;
create policy "movimientos_insert_auth" on movimientos
  for insert with check (auth.role() = 'authenticated');

-- Sin políticas de update/delete a propósito: un movimiento ya guardado no
-- se edita ni se borra (es un historial/bitácora), así que ni siquiera un
-- usuario autenticado puede hacerlo — corregir algo se hace con un nuevo
-- movimiento de tipo 'ajuste', no reescribiendo el pasado.

-- Fase 4: almacén real (FK) en vez de solo texto libre en "ubicacion", y
-- lo mismo para el origen/destino de un movimiento — antes "destino" era
-- cualquier texto (ej. "Frente de obra 2"), ahora tiene que ser un
-- almacén que ya exista en el catálogo. "ubicacion" y "destino" (texto)
-- se conservan y quedan sincronizados solos, para que nada de lo que ya
-- lee/filtra por texto (Almacenes, Listado, Dashboard, Estadísticas, los
-- exports a PDF/Excel) se rompa.
alter table materiales add column if not exists almacen_id uuid references almacenes (id) on delete set null;

update materiales m
set almacen_id = a.id
from almacenes a
where m.almacen_id is null
  and m.ubicacion is not null
  and a.nombre = m.ubicacion;

create or replace function sincronizar_ubicacion_texto()
returns trigger as $$
begin
  if new.almacen_id is not null then
    select nombre into new.ubicacion from almacenes where id = new.almacen_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists materiales_sincronizar_ubicacion on materiales;
create trigger materiales_sincronizar_ubicacion
  before insert or update on materiales
  for each row
  execute function sincronizar_ubicacion_texto();

alter table movimientos add column if not exists almacen_origen_id uuid references almacenes (id) on delete set null;
alter table movimientos add column if not exists almacen_destino_id uuid references almacenes (id) on delete set null;

-- Quién registró el movimiento, tomado de la sesión activa en el
-- servidor — nunca de un texto que mande el frontend. "responsable" se
-- conserva solo como nombre visible (se llena con el correo de quien
-- tiene la sesión).
alter table movimientos add column if not exists usuario_id uuid references auth.users (id) on delete set null;

-- Fija el usuario real y sincroniza "destino" (texto) con el nombre del
-- almacén de destino elegido, para no depender de que el frontend mande
-- los dos campos por separado.
create or replace function preparar_movimiento()
returns trigger as $$
begin
  new.usuario_id := auth.uid();

  if new.almacen_destino_id is not null then
    select nombre into new.destino from almacenes where id = new.almacen_destino_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists movimientos_preparar on movimientos;
create trigger movimientos_preparar
  before insert on movimientos
  for each row
  execute function preparar_movimiento();

-- Quita la regla vieja que exigía "destino" (texto) en toda transferencia
-- — la reemplaza la validación de almacenes de aplicar_movimiento(), con
-- mensajes más claros. Se busca por definición porque Postgres le puso un
-- nombre autogenerado que no se conoce de antemano.
do $$
declare
  nombre_constraint text;
begin
  select conname into nombre_constraint
  from pg_constraint
  where conrelid = 'movimientos'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%destino is not null%';

  if nombre_constraint is not null then
    execute format('alter table movimientos drop constraint %I', nombre_constraint);
  end if;
end $$;

-- Aplica el efecto del movimiento sobre materiales.cantidad (y, desde la
-- Fase 4, también sobre materiales.almacen_id). Corre en el servidor sin
-- importar qué cliente insertó el movimiento (frontend, SQL Editor, otro
-- script), así que la integridad no depende de que el frontend "se porte
-- bien".
--
-- Sobre la transferencia: hoy un material vive en un solo almacén con una
-- sola cantidad (no existe todavía una tabla de existencias por almacén),
-- así que una transferencia mueve TODO lo que hay — no se puede dejar
-- una parte en cada almacén. Si algún día se necesita partir cantidades
-- entre almacenes, esto hay que rediseñarlo con una tabla de existencias
-- (material + almacén + cantidad) como fuente real de la verdad.
create or replace function aplicar_movimiento()
returns trigger as $$
declare
  cantidad_actual numeric;
  almacen_actual uuid;
begin
  -- "for update" bloquea la fila del material hasta que termine esta
  -- transacción, para que dos movimientos simultáneos sobre el mismo
  -- material no lean el mismo "cantidad_actual"/"almacen_actual" y se
  -- pisen entre sí.
  select cantidad, almacen_id into cantidad_actual, almacen_actual
  from materiales where id = new.material_id for update;

  if cantidad_actual is null then
    raise exception 'El material de este movimiento no existe.';
  end if;

  if new.tipo = 'entrada' then
    if new.almacen_destino_id is null then
      raise exception 'Una entrada necesita el almacén de destino.';
    end if;
    update materiales
    set cantidad = cantidad_actual + new.cantidad,
        almacen_id = new.almacen_destino_id
    where id = new.material_id;

  elsif new.tipo = 'salida' then
    if new.almacen_origen_id is null then
      raise exception 'Una salida necesita el almacén de origen.';
    end if;
    if almacen_actual is not null and new.almacen_origen_id <> almacen_actual then
      raise exception 'El material no está en el almacén de origen indicado.';
    end if;
    if new.cantidad > cantidad_actual then
      raise exception 'No hay suficiente cantidad disponible (actual: %, solicitada: %).', cantidad_actual, new.cantidad;
    end if;
    update materiales set cantidad = cantidad_actual - new.cantidad where id = new.material_id;

  elsif new.tipo = 'transferencia' then
    if new.almacen_origen_id is null or new.almacen_destino_id is null then
      raise exception 'Una transferencia necesita almacén de origen y de destino.';
    end if;
    if new.almacen_origen_id = new.almacen_destino_id then
      raise exception 'El almacén de origen y de destino no pueden ser el mismo.';
    end if;
    if almacen_actual is not null and new.almacen_origen_id <> almacen_actual then
      raise exception 'El material no está en el almacén de origen indicado.';
    end if;
    if new.cantidad <> cantidad_actual then
      raise exception 'Una transferencia debe ser por toda la cantidad actual (%); todavía no se pueden mover cantidades parciales.', cantidad_actual;
    end if;
    update materiales set almacen_id = new.almacen_destino_id where id = new.material_id;

  elsif new.tipo = 'ajuste' then
    update materiales set cantidad = new.cantidad where id = new.material_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists movimientos_aplicar on movimientos;
create trigger movimientos_aplicar
  after insert on movimientos
  for each row
  execute function aplicar_movimiento();
