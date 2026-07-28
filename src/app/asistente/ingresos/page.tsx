'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Periodo = 'hoy' | 'semana' | 'mes'

export default function IngresosAsistentePage() {
  const router = useRouter()
  const supabase = createClient()

  const [consultas, setConsultas] = useState<any[]>([])
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [loading, setLoading] = useState(true)
  const [perfilNombre, setPerfilNombre] = useState('')
  const [doctorFavoritoId, setDoctorFavoritoId] = useState<string | null>(null)

  useEffect(() => {
    async function cargarDatos() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: perfil } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!perfil || perfil.rol !== 'asistente') {
        router.push('/dashboard')
        return
      }

      setPerfilNombre(perfil.nombre_completo || '')
      setDoctorFavoritoId(perfil.id_doctor_favorito || null)

      if (!perfil.id_doctor_favorito) {
        setLoading(false)
        return
      }

      const ahora = new Date()
      let fechaDesde: Date

      if (periodo === 'hoy') {
        fechaDesde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
      } else if (periodo === 'semana') {
        const dia = ahora.getDay() || 7
        fechaDesde = new Date(ahora)
        fechaDesde.setDate(ahora.getDate() - dia + 1)
        fechaDesde.setHours(0, 0, 0, 0)
      } else {
        fechaDesde = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      }

      const { data, error } = await supabase
        .from('consultas')
        .select(`
          id, created_at, precio_consulta, total_factura, estado_pago, medicamentos,
          doctores:id_doctor (nombre_completo),
          pacientes:id_paciente (nombre_completo, documento_identidad)
        `)
        .eq('id_doctor', perfil.id_doctor_favorito)
        .gte('created_at', fechaDesde.toISOString())
        .order('created_at', { ascending: false })

      if (error) console.error('Error al cargar consultas:', error)
      setConsultas(data || [])
      setLoading(false)
    }
    cargarDatos()
  }, [periodo])

  const totalIngresos = consultas.reduce((acc, c) => acc + (c.total_factura || c.precio_consulta || 0), 0)
  const totalPagado = consultas.filter(c => c.estado_pago === 'pagado').reduce((acc, c) => acc + (c.total_factura || c.precio_consulta || 0), 0)
  const totalPendiente = totalIngresos - totalPagado

  const toggleEstadoPago = async (consultaId: string, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'pagado' ? 'pendiente' : 'pagado'
    await supabase.from('consultas').update({ estado_pago: nuevoEstado }).eq('id', consultaId)
    setConsultas(prev => prev.map(c => c.id === consultaId ? { ...c, estado_pago: nuevoEstado } : c))
  }

  const labelPeriodo: Record<Periodo, string> = { hoy: 'Hoy', semana: 'Esta Semana', mes: 'Este Mes' }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Panel de Ingresos</h1>
          <p className="text-xs text-slate-500">Asistente: {perfilNombre}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/asistente')} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            ← Volver
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-5">

        {/* FILTROS */}
        <div className="flex gap-2">
          {(['hoy', 'semana', 'mes'] as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                periodo === p
                  ? 'bg-blue-600 text-white border-blue-600 shadow'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
              }`}
            >
              {labelPeriodo[p]}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 self-center">
            {consultas.length} consultas encontradas
          </span>
        </div>

        {/* TARJETAS DE RESUMEN */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ingresos</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">${totalIngresos.toLocaleString()}</p>
            <p className="text-xs text-slate-400">COP — {labelPeriodo[periodo]}</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-200 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Pagado</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">${totalPagado.toLocaleString()}</p>
            <p className="text-xs text-emerald-500">COP</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-sm">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pendiente de Pago</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">${totalPendiente.toLocaleString()}</p>
            <p className="text-xs text-amber-500">COP</p>
          </div>
        </div>

        {/* TABLA */}
        {loading ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-slate-500 text-sm">Cargando datos...</p>
          </div>
        ) : consultas.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
            <p className="text-slate-400 text-sm">No hay consultas registradas para este período.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Fecha</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Paciente</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Doctor</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Total</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-600 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consultas.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(c.created_at).toLocaleDateString('es-CO', {
                          day: '2-digit', month: '2-digit', year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{c.pacientes?.nombre_completo || 'N/A'}</span>
                        <br />
                        <span className="text-slate-400">CC: {c.pacientes?.documento_identidad || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.doctores?.nombre_completo || 'N/A'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">
                        ${(c.total_factura || c.precio_consulta || 0).toLocaleString()}
                        <span className="text-slate-400 font-normal"> COP</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleEstadoPago(c.id, c.estado_pago)}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold transition ${
                            c.estado_pago === 'pagado'
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                        >
                          {c.estado_pago === 'pagado' ? '✓ Pagado' : '⏳ Pendiente'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
