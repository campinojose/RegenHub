drop function if exists public.crear_consulta(
  public.estado_pago,
  uuid,
  uuid,
  uuid,
  numeric,
  jsonb,
  text,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  text
);

create or replace function public.crear_consulta(
  estado_pago public.estado_pago,
  estado_pago_medicamentos public.estado_pago,
  id_asistente uuid,
  id_doctor uuid,
  id_paciente uuid,
  imc numeric,
  medicamentos jsonb,
  motivo_consulta text,
  monto_medicamentos numeric,
  peso_kg numeric,
  precio_consulta numeric,
  presion_arterial text,
  talla_cm numeric,
  total_factura numeric,
  tratamiento_realizado text
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

  if not public.es_rol(array['administrador','recepcionista','asistente','doctor']::public.rol_usuario[]) then
    raise exception 'Not authorized';
  end if;

  insert into public.consultas (
    estado_pago,
    estado_pago_medicamentos,
    id_asistente,
    id_doctor,
    id_paciente,
    imc,
    medicamentos,
    motivo_consulta,
    monto_medicamentos,
    peso_kg,
    precio_consulta,
    presion_arterial,
    talla_cm,
    total_factura,
    tratamiento_realizado
  ) values (
    crear_consulta.estado_pago,
    crear_consulta.estado_pago_medicamentos,
    crear_consulta.id_asistente,
    crear_consulta.id_doctor,
    crear_consulta.id_paciente,
    crear_consulta.imc,
    crear_consulta.medicamentos,
    crear_consulta.motivo_consulta,
    crear_consulta.monto_medicamentos,
    crear_consulta.peso_kg,
    crear_consulta.precio_consulta,
    crear_consulta.presion_arterial,
    crear_consulta.talla_cm,
    crear_consulta.total_factura,
    crear_consulta.tratamiento_realizado
  )
  returning id into nueva_consulta_id;

  return nueva_consulta_id;
end;
$$;

grant execute on function public.crear_consulta(
  public.estado_pago,
  public.estado_pago,
  uuid,
  uuid,
  uuid,
  numeric,
  jsonb,
  text,
  numeric,
  numeric,
  numeric,
  text,
  numeric,
  numeric,
  text
) to authenticated;
