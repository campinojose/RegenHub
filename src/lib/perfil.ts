import { createClient } from '@/lib/supabase'

export interface PerfilUsuario {
  id: string
  nombre_completo: string
  rol: 'recepcionista' | 'asistente'
  id_doctor_favorito: string | null
}

/**
 * Obtiene el perfil del usuario actualmente autenticado desde la tabla perfiles_usuario.
 * Retorna null si no existe perfil o hay error.
 */
export async function obtenerPerfil(): Promise<PerfilUsuario | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('perfiles_usuario')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !data) return null

  return data as PerfilUsuario
}
