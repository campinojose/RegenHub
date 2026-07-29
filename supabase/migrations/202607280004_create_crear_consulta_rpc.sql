create or replace function public.crear_consulta(
  id_paciente uuid,
  id_doctor uuid,
  id_asistente uuid,
  motivo_consulta text,
  peso_kg numeric default null,
  talla_cm numeric default null,
  imc numeric default null,
  presion_arterial text default null,
  tratamiento_realizado text default null,
  precio_consulta numeric default 0,
  total_factura numeric default 0,
  estado_pago public.estado_pago default 'pendiente',
  medicamentos jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_consulta_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.es_rol(array['administrador','recepcionista','asistente']::public.rol_usuario[]) then
    raise exception 'Not authorized';
  end if;

  insert into public.consultas (
    id_paciente,
    id_doctor,
    id_asistente,
    motivo_consulta,
    peso_kg,
    talla_cm,
    imc,
    presion_arterial,
    tratamiento_realizado,
    precio_consulta,
    total_factura,
    estado_pago,
    medicamentos
  ) values (
    crear_consulta.id_paciente,
    crear_consulta.id_doctor,
    crear_consulta.id_asistente,
    crear_consulta.motivo_consulta,
    crear_consulta.peso_kg,
    crear_consulta.talla_cm,
    crear_consulta.imc,
    crear_consulta.presion_arterial,
    crear_consulta.tratamiento_realizado,
    crear_consulta.precio_consulta,
    crear_consulta.total_factura,
    crear_consulta.estado_pago,
    crear_consulta.medicamentos
  )
  returning id into nueva_consulta_id;

  return nueva_consulta_id;
end;
$$;

grant execute on function public.crear_consulta(
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  numeric,
  numeric,
  text,
  text,
  numeric,
  numeric,
  public.estado_pago,
  jsonb
) to authenticated;