alter table public.doctores
  drop column if exists especialidad,
  drop column if exists registro_medico,
  drop column if exists email;