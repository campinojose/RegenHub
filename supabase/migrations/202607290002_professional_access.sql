create or replace function public.doctor_actual_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id_doctor_favorito
  from public.perfiles_usuario
  where id = auth.uid();
$$;

drop policy if exists "personal ve pacientes" on public.pacientes;
drop policy if exists "profesionales ven sus pacientes" on public.pacientes;
drop policy if exists "personal ve consultas" on public.consultas;
drop policy if exists "profesionales ven sus consultas" on public.consultas;
drop policy if exists "personal crea consultas" on public.consultas;
drop policy if exists "profesionales crean consultas propias" on public.consultas;
drop policy if exists "recepcion actualiza pago" on public.consultas;
drop policy if exists "profesionales actualizan sus consultas" on public.consultas;

create policy "personal ve pacientes"
on public.pacientes
for select
to authenticated
using (public.es_rol(array['administrador','recepcionista']::public.rol_usuario[]));

create policy "profesionales ven sus pacientes"
on public.pacientes
for select
to authenticated
using (
  public.es_rol(array['asistente','doctor']::public.rol_usuario[])
  and id_doctor_elegido = public.doctor_actual_id()
);

create policy "personal ve consultas"
on public.consultas
for select
to authenticated
using (public.es_rol(array['administrador','recepcionista']::public.rol_usuario[]));

create policy "profesionales ven sus consultas"
on public.consultas
for select
to authenticated
using (
  public.es_rol(array['asistente','doctor']::public.rol_usuario[])
  and id_doctor = public.doctor_actual_id()
);

create policy "personal crea consultas"
on public.consultas
for insert
to authenticated
with check (
  public.es_rol(array['administrador','recepcionista']::public.rol_usuario[])
  or (
    public.es_rol(array['asistente','doctor']::public.rol_usuario[])
    and id_asistente = auth.uid()
    and id_doctor = public.doctor_actual_id()
    and exists (
      select 1
      from public.pacientes p
      where p.id = id_paciente
        and p.id_doctor_elegido = public.doctor_actual_id()
    )
  )
);

create policy "recepcion actualiza pago"
on public.consultas
for update
to authenticated
using (public.es_rol(array['administrador','recepcionista']::public.rol_usuario[]));

create policy "profesionales actualizan sus consultas"
on public.consultas
for update
to authenticated
using (
  public.es_rol(array['asistente','doctor']::public.rol_usuario[])
  and id_doctor = public.doctor_actual_id()
  and exists (
    select 1
    from public.pacientes p
    where p.id = id_paciente
      and p.id_doctor_elegido = public.doctor_actual_id()
  )
)
with check (
  public.es_rol(array['asistente','doctor']::public.rol_usuario[])
  and id_doctor = public.doctor_actual_id()
  and exists (
    select 1
    from public.pacientes p
    where p.id = id_paciente
      and p.id_doctor_elegido = public.doctor_actual_id()
  )
);