export type RolUsuario = 'administrador' | 'recepcionista' | 'asistente' | 'doctor'

export interface PerfilUsuario {
  id: string
  nombre_completo: string
  rol: RolUsuario
  id_doctor_favorito: string | null
}

export interface Doctor {
  id: string
  nombre_completo: string
}

export interface Paciente {
  id: string
  nombre_completo: string
  documento_identidad: string | null
  fecha_registro: string
  id_doctor_elegido: string | null
  edad: number | null
  sexo: string | null
  direccion: string | null
  barrio: string | null
  telefono: string | null
  email: string | null
  foto_cedula_frente: string | null
  created_at: string
}

export interface Medicamento {
  nombre: string
  indicacion: string
  precio: number
}

export interface Consulta {
  id: string
  created_at: string
  id_paciente: string
  id_doctor: string
  precio_consulta: number | null
  total_factura: number | null
  estado_pago: 'pendiente' | 'pagado'
  estado_pago_medicamentos: 'pendiente' | 'pagado'
  monto_medicamentos: number | null
  medicamentos: Medicamento[] | null
  motivo_consulta?: string | null
  peso_kg?: number | null
  talla_cm?: number | null
  imc?: number | null
  presion_arterial?: string | null
  tratamiento_realizado?: string | null
  doctores?: Pick<Doctor, 'id' | 'nombre_completo'> | null
  pacientes?: Pick<Paciente, 'nombre_completo' | 'documento_identidad'> | null
  asistente?: { perfiles_usuario?: Pick<PerfilUsuario, 'nombre_completo'> | null } | null
}
