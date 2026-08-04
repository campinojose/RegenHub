import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Cliente con service_role — bypassa RLS completamente
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function DELETE(req: NextRequest) {
  try {
    const { pacienteId } = await req.json()

    if (!pacienteId || typeof pacienteId !== 'string') {
      return NextResponse.json({ error: 'pacienteId requerido' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 1. Eliminar consultas relacionadas primero (evita FK constraint)
    const { error: errorConsultas } = await adminSupabase
      .from('consultas')
      .delete()
      .eq('id_paciente', pacienteId)

    if (errorConsultas) {
      console.error('Error eliminando consultas:', errorConsultas)
      return NextResponse.json({ error: errorConsultas.message }, { status: 500 })
    }

    // 2. Obtener la ruta de la foto de cédula antes de borrar el paciente
    const { data: pacienteData } = await adminSupabase
      .from('pacientes')
      .select('foto_cedula_frente')
      .eq('id', pacienteId)
      .maybeSingle()

    // 3. Eliminar el paciente
    const { error: errorPaciente } = await adminSupabase
      .from('pacientes')
      .delete()
      .eq('id', pacienteId)

    if (errorPaciente) {
      console.error('Error eliminando paciente:', errorPaciente)
      return NextResponse.json({ error: errorPaciente.message }, { status: 500 })
    }

    // 4. Limpiar foto de cédula del Storage si existe
    if (pacienteData?.foto_cedula_frente) {
      await adminSupabase.storage
        .from('cedulas-pacientes')
        .remove([pacienteData.foto_cedula_frente])
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('Error en API eliminar-paciente:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
