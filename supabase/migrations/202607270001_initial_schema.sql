-- RegenHub: esquema inicial, auditoría básica y acceso por roles.
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario' and typnamespace = 'public'::regnamespace) then
    create type public.rol_usuario as enum ('administrador', 'recepcionista', 'asistente', 'doctor');
  end if;

  if not exists (select 1 from pg_type where typname = 'estado_pago' and typnamespace = 'public'::regnamespace) then
    create type public.estado_pago as enum ('pendiente', 'pagado');
  end if;
end
$$;

create table if not exists public.doctores (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null check (char_length(trim(nombre_completo)) >= 3),
  created_at timestamptz not null default now()
);

create table if not exists public.perfiles_usuario (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol public.rol_usuario not null default 'recepcionista',
  id_doctor_favorito uuid references public.doctores(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null check (char_length(trim(nombre_completo)) >= 3),
  documento_identidad text unique,
  fecha_registro date not null default current_date,
  id_doctor_elegido uuid references public.doctores(id) on delete set null,
  edad smallint not null check (edad between 1 and 105),
  sexo text,
  direccion text,
  barrio text,
  telefono text,
  email text,
  foto_cedula_frente text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  id_paciente uuid not null references public.pacientes(id) on delete cascade,
  id_doctor uuid not null references public.doctores(id),
  id_asistente uuid references public.perfiles_usuario(id),
  motivo_consulta text not null,
  peso_kg numeric(5,2), talla_cm numeric(5,2), imc numeric(5,2),
  presion_arterial text,
  tratamiento_realizado text,
  precio_consulta numeric(12,2) not null default 0 check (precio_consulta >= 0),
  total_factura numeric(12,2) not null default 0 check (total_factura >= 0),
  estado_pago public.estado_pago not null default 'pendiente',
  medicamentos jsonb not null default '[]'::jsonb check (jsonb_typeof(medicamentos) = 'array'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists consultas_paciente_fecha_idx on public.consultas (id_paciente, created_at desc);
create index if not exists consultas_doctor_fecha_idx on public.consultas (id_doctor, created_at desc);

create or replace function public.es_rol(roles public.rol_usuario[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles_usuario where id = auth.uid() and rol = any(roles));
$$;

create or replace function public.actualizar_modificado() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists perfiles_updated on public.perfiles_usuario;
drop trigger if exists pacientes_updated on public.pacientes;
drop trigger if exists consultas_updated on public.consultas;

create trigger perfiles_updated before update on public.perfiles_usuario for each row execute function public.actualizar_modificado();
create trigger pacientes_updated before update on public.pacientes for each row execute function public.actualizar_modificado();
create trigger consultas_updated before update on public.consultas for each row execute function public.actualizar_modificado();

alter table public.doctores enable row level security;
alter table public.perfiles_usuario enable row level security;
alter table public.pacientes enable row level security;
alter table public.consultas enable row level security;

drop policy if exists "personal ve doctores" on public.doctores;
drop policy if exists "admin gestiona doctores" on public.doctores;
drop policy if exists "usuario ve su perfil" on public.perfiles_usuario;
drop policy if exists "admin gestiona perfiles" on public.perfiles_usuario;
drop policy if exists "personal ve pacientes" on public.pacientes;
drop policy if exists "recepcion y admin crean pacientes" on public.pacientes;
drop policy if exists "admin actualiza pacientes" on public.pacientes;
drop policy if exists "recepcion y admin eliminan pacientes" on public.pacientes;
drop policy if exists "personal ve consultas" on public.consultas;
drop policy if exists "personal crea consultas" on public.consultas;
drop policy if exists "recepcion actualiza pago" on public.consultas;

create policy "personal ve doctores" on public.doctores for select to authenticated using (true);
create policy "admin gestiona doctores" on public.doctores for all to authenticated using (public.es_rol(array['administrador']::public.rol_usuario[])) with check (public.es_rol(array['administrador']::public.rol_usuario[]));
create policy "usuario ve su perfil" on public.perfiles_usuario for select to authenticated using (id = auth.uid() or public.es_rol(array['administrador']::public.rol_usuario[]));
create policy "admin gestiona perfiles" on public.perfiles_usuario for all to authenticated using (public.es_rol(array['administrador']::public.rol_usuario[])) with check (public.es_rol(array['administrador']::public.rol_usuario[]));
create policy "personal ve pacientes" on public.pacientes for select to authenticated using (true);
create policy "recepcion y admin crean pacientes" on public.pacientes for insert to authenticated with check (public.es_rol(array['administrador','recepcionista']::public.rol_usuario[]));
create policy "admin actualiza pacientes" on public.pacientes for update to authenticated using (public.es_rol(array['administrador']::public.rol_usuario[]));
create policy "recepcion y admin eliminan pacientes" on public.pacientes for delete to authenticated using (public.es_rol(array['administrador','recepcionista']::public.rol_usuario[]));
create policy "personal ve consultas" on public.consultas for select to authenticated using (true);
create policy "personal crea consultas" on public.consultas for insert to authenticated with check (public.es_rol(array['administrador','recepcionista','asistente']::public.rol_usuario[]) and id_asistente = auth.uid());
create policy "recepcion actualiza pago" on public.consultas for update to authenticated using (public.es_rol(array['administrador','recepcionista','asistente']::public.rol_usuario[]));

insert into storage.buckets (id, name, public) values ('cedulas-pacientes', 'cedulas-pacientes', false) on conflict (id) do update set public = false;
drop policy if exists "personal administra cedulas" on storage.objects;
create policy "personal administra cedulas" on storage.objects for all to authenticated using (bucket_id = 'cedulas-pacientes' and public.es_rol(array['administrador','recepcionista']::public.rol_usuario[])) with check (bucket_id = 'cedulas-pacientes' and public.es_rol(array['administrador','recepcionista']::public.rol_usuario[]));
