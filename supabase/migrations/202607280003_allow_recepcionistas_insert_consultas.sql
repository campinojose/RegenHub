drop policy if exists "asistente crea consultas" on public.consultas;
drop policy if exists "personal crea consultas" on public.consultas;

create policy "personal crea consultas" on public.consultas
  for insert to authenticated
  with check (
    public.es_rol(array['administrador','recepcionista','asistente']::public.rol_usuario[])
    and id_asistente = auth.uid()
  );