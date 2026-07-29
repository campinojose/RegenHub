alter table public.pacientes
  add column if not exists id_doctor_elegido uuid references public.doctores(id) on delete set null;