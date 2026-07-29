-- Crea primero estos usuarios en Supabase Auth y reemplaza cada UUID_... por el id real del usuario.
-- Estos perfiles deben quedar enlazados con el doctor correspondiente para que solo vean
-- y editen los pacientes asignados a ese doctor.

insert into public.perfiles_usuario (id, nombre_completo, rol, id_doctor_favorito)
values
	-- Usuario de Carolina Herrera: lo usa ella misma para sus propias consultas.
	('ec38b9c1-d836-42d7-b94d-ca4615dcec91', 'Carolina Herrera', 'doctor', 'f8c7116d-1c8b-4d2f-927c-0d48296f2dfd'),

	-- Usuario de Doña Rosa: lo usa Lourdes para crear consultas de Rosa personalmente.
	('7b592886-7489-4feb-a30f-057127754ec5', 'Rosa Castaño', 'doctor', 'c2cde56e-7fae-4ac4-b352-f3506c78137d'),

	-- Usuario de Don Clemente: lo usa Carolina para crear consultas de Clemente personalmente.
	('6119be8b-cb28-4336-b8e3-1bb23abd54bd', 'Clemente Herrera', 'doctor', 'a142aea4-d90f-469f-9ff2-d56d057676cb'),

	-- Usuario de Andrés Herrera: lo usa Rosa para crear consultas de Andrés personalmente.
	('335294ce-44f0-4944-9527-6559a6b721cf', 'Andrés Herrera', 'doctor', 'a5f41fcf-5950-4b29-aad1-ded22f57ccf2')
on conflict (id) do update set
	nombre_completo = excluded.nombre_completo,
	rol = excluded.rol,
	id_doctor_favorito = excluded.id_doctor_favorito;

-- Si también quieres crear los perfiles de apoyo con nombre de la persona que opera el login,
-- duplica el bloque anterior en otra tabla o cambia el nombre_completo por el operador real.
