'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { PerfilUsuario } from '@/lib/perfil'

export default function AsistenteDashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [doctorFavorito, setDoctorFavorito] = useState<any>(null)
  const [pacientes, setPacientes] = useState<any[]>([])
  const [ultimasConsultas, setUltimasConsultas] = useState<Record<string, any>>({})
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function inicializar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Obtener perfil del asistente
      const { data: perfilData } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!perfilData || perfilData.rol !== 'asistente') {
        router.push('/dashboard')
        return
      }
      setPerfil(perfilData)

      // Obtener doctor favorito
      if (perfilData.id_doctor_favorito) {
        const { data: doc } = await supabase
          .from('doctores')
          .select('*')
          .eq('id', perfilData.id_doctor_favorito)
          .single()
        setDoctorFavorito(doc)
      }

      // Cargar todos los pacientes
      const { data: pacs } = await supabase
        .from('pacientes')
        .select('*')
        .order('created_at', { ascending: false })
      setPacientes(pacs || [])

      // Cargar la última consulta de cada paciente
      if (pacs && pacs.length > 0) {
        const { data: consultas } = await supabase
          .from('consultas')
          .select(`
            id, created_at, id_paciente,
            doctores:id_doctor (nombre_completo),
            asistente:id_asistente (
              perfiles_usuario (nombre_completo)
            )
          `)
          .order('created_at', { ascending: false })

        if (consultas) {
          const mapaUltima: Record<string, any> = {}
          for (const c of consultas) {
            if (!mapaUltima[c.id_paciente]) {
              mapaUltima[c.id_paciente] = c
            }
          }
          setUltimasConsultas(mapaUltima)
        }
      }

      setLoading(false)
    }
    inicializar()
  }, [])

  const pacientesFiltrados = pacientes.filter(p =>
    p.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.documento_identidad?.includes(busqueda)
  )

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-semibold text-sm">Cargando panel de asistente...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            🩺
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-none">Panel Asistente</h1>
            <span className="text-xs text-slate-500">
              {perfil?.nombre_completo || 'Asistente'} — Doctor favorito:{' '}
              <strong className="text-slate-700">{doctorFavorito?.nombre_completo || 'Sin asignar'}</strong>
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/asistente/ingresos')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-1.5"
          >
            📊 Ver Ingresos
          </button>
          <button
            onClick={handleCerrarSesion}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-slate-800 text-base">
            Pacientes Registrados
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
              {pacientes.length} total
            </span>
          </h2>
          <input
            type="text"
            placeholder="🔍 Buscar por nombre o cédula..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="px-3 py-2 border rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>

        <div className="space-y-2">
          {pacientesFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
              <p className="text-slate-400 text-sm">No se encontraron pacientes.</p>
            </div>
          ) : (
            pacientesFiltrados.map((paciente) => {
              const ultimaConsulta = ultimasConsultas[paciente.id]
              const doctorUltima = ultimaConsulta?.doctores?.nombre_completo
              const asistenteUltima = ultimaConsulta?.asistente?.perfiles_usuario?.nombre_completo

              return (
                <div
                  key={paciente.id}
                  className="bg-white rounded-2xl px-5 py-4 border border-slate-200 hover:border-blue-300 hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Info paciente */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-800">{paciente.nombre_completo}</h3>
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {paciente.sexo || 'N/A'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      CC: {paciente.documento_identidad || 'S/N'}
                      {paciente.telefono && ` | Tel: ${paciente.telefono}`}
                    </p>

                    {/* Indicador de última atención */}
                    {ultimaConsulta ? (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                          Última atención: {new Date(ultimaConsulta.created_at).toLocaleDateString('es-CO')}
                        </span>
                        {doctorUltima && (
                          <span className="text-[10px] bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-full border border-violet-100">
                            Dr/a: {doctorUltima}
                          </span>
                        )}
                        {asistenteUltima && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-100">
                            Asistente: {asistenteUltima}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">Sin consultas registradas</p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/pacientes/${paciente.id}`)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
                    >
                      Ver Expediente
                    </button>
                    <button
                      onClick={() => router.push(`/consultas/nueva?pacienteId=${paciente.id}`)}
                      className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition"
                    >
                      + Nueva Consulta
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
