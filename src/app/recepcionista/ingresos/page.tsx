'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Consulta, Doctor } from '@/lib/types'

type Periodo = 'hoy' | 'semana' | 'mes'

const DOCTORES_FIJOS: Doctor[] = [
    { id: 'a142aea4-d90f-469f-9ff2-d56d057676cb', nombre_completo: 'Clemente Herrera' },
    { id: 'a5f41fcf-5950-4b29-aad1-ded22f57ccf2', nombre_completo: 'Andrés Herrera' },
    { id: 'c2cde56e-7fae-4ac4-b352-f3506c78137d', nombre_completo: 'Rosa Castaño' },
    { id: 'f8c7116d-1c8b-4d2f-927c-0d48296f2dfd', nombre_completo: 'Carolina Herrera' },
]

export default function IngresosRecepcionistaPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [loading, setLoading] = useState(true)
  const [perfilNombre, setPerfilNombre] = useState('')

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

      if (!perfil || (perfil.rol !== 'recepcionista' && perfil.rol !== 'doctor' && perfil.rol !== 'administrador')) {
        router.push('/asistente')
        return
      }

      let restrictedDoctorId = null
      if (perfil.nombre_completo) {
          const nombreLower = perfil.nombre_completo.toLowerCase()
          if (nombreLower.includes('clemente') || nombreLower.includes('rosa') || 
              nombreLower.includes('andrés') || nombreLower.includes('andres') || 
              nombreLower.includes('carolina')) {
              const df = DOCTORES_FIJOS.find(d => nombreLower.includes(d.nombre_completo.split(' ')[0].toLowerCase()))
              if (df) restrictedDoctorId = df.id
          }
      }
      
      // Si el rol es recepcionista o administrador, pueden ver todo.
      // Pero si son doctores restringidos, solo ven lo de ellos.
      // Si el requerimiento es estricto, aplicamos la restricción si se encontró su ID.

      setPerfilNombre(perfil.nombre_completo || '')

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

      let query = supabase
        .from('consultas')
        .select(`
          *,
          doctores:id_doctor (nombre_completo),
          pacientes:id_paciente (nombre_completo, documento_identidad)
        `)
        .gte('created_at', fechaDesde.toISOString())
        .order('created_at', { ascending: false })

      if (restrictedDoctorId) {
        query = query.eq('id_doctor', restrictedDoctorId)
      }

      const { data, error } = await query

      if (error) console.error('Error:', error)
      setConsultas((data || []) as unknown as Consulta[])
      setLoading(false)
    }
    cargarDatos()
  }, [periodo, router, supabase])

  const obtenerEstadoPagoMedicamentos = (consulta: Consulta) => consulta.estado_pago_medicamentos ?? consulta.estado_pago ?? 'pendiente'
  const obtenerMontoMedicamentos = (consulta: Consulta) => typeof consulta.monto_medicamentos === 'number'
    ? consulta.monto_medicamentos
    : Array.isArray(consulta.medicamentos)
      ? consulta.medicamentos.reduce((acc, med) => acc + (Number(med.precio) || 0), 0)
      : 0

  const totalIngresos = consultas.reduce(
    (acc, c) => acc + (c.precio_consulta || 50000) + (obtenerEstadoPagoMedicamentos(c) === 'pagado' ? obtenerMontoMedicamentos(c) : 0),
    0,
  )
  const totalPagado = totalIngresos
  const totalPendiente = consultas.reduce(
    (acc, c) => acc + (obtenerEstadoPagoMedicamentos(c) === 'pendiente' ? obtenerMontoMedicamentos(c) : 0),
    0,
  )
  const usaEstadoPagoMedicamentos = consultas.some((consulta) => Object.prototype.hasOwnProperty.call(consulta, 'estado_pago_medicamentos'))

  // Agrupar por doctor
  const porDoctor = consultas.reduce<Record<string, { total: number; count: number }>>((acc, c) => {
    const doctorNombre = c.doctores?.nombre_completo || 'Sin asignar'
    if (!acc[doctorNombre]) acc[doctorNombre] = { total: 0, count: 0 }
    acc[doctorNombre].total += (c.precio_consulta || 50000) + (obtenerEstadoPagoMedicamentos(c) === 'pagado' ? obtenerMontoMedicamentos(c) : 0)
    acc[doctorNombre].count += 1
    return acc
  }, {})

  const toggleEstadoPago = async (consultaId: string, estadoActual: string) => {
    const nuevoEstado = estadoActual === 'pagado' ? 'pendiente' : 'pagado'
    const actualizacion = usaEstadoPagoMedicamentos
      ? { estado_pago_medicamentos: nuevoEstado, estado_pago: nuevoEstado }
      : { estado_pago: nuevoEstado }

    const { error } = await supabase.from('consultas').update(actualizacion).eq('id', consultaId)
    if (error) {
      alert(`No se pudo actualizar el pago: ${error.message}`)
      return
    }
    setConsultas(prev => prev.map(c => c.id === consultaId ? { ...c, estado_pago_medicamentos: nuevoEstado } : c))
  }

  const labelPeriodo: Record<Periodo, string> = { hoy: 'Hoy', semana: 'Esta Semana', mes: 'Este Mes' }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-40">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Panel de Ingresos</h1>
          <p className="text-xs font-medium text-slate-500">Sesión actual: {perfilNombre}</p>
        </div>
        <button onClick={() => router.push('/dashboard')} className="btn-secondary">
          ← Volver al Dashboard
        </button>
      </header>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-5">

        {/* FILTROS */}
        <div className="flex gap-2 p-1 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-xl w-fit shadow-sm">
          {(['hoy', 'semana', 'mes'] as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                periodo === p 
                  ? 'bg-brand-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {labelPeriodo[p]}
            </button>
          ))}
        </div>

        {/* TARJETAS RESUMEN GLOBAL */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="glass-card p-6 flex flex-col justify-center border-l-4 border-l-brand-500">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Generado</p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">${totalIngresos.toLocaleString()}</p>
            <p className="text-[11px] font-medium text-slate-400 mt-1">COP — {labelPeriodo[periodo]}</p>
          </div>
          <div className="glass-card p-6 flex flex-col justify-center border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/50 to-white">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Recaudado</p>
            <p className="text-3xl font-bold text-emerald-700 tracking-tight">${totalPagado.toLocaleString()}</p>
            <p className="text-[11px] font-medium text-emerald-500 mt-1">Dinero ingresado efectivamente</p>
          </div>
          <div className="glass-card p-6 flex flex-col justify-center border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/50 to-white">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Pendiente</p>
            <p className="text-3xl font-bold text-amber-700 tracking-tight">${totalPendiente.toLocaleString()}</p>
            <p className="text-[11px] font-medium text-amber-500 mt-1">Saldos por cobrar</p>
          </div>
        </div>

        {/* RESUMEN POR PROFESIONAL */}
        {Object.keys(porDoctor).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(porDoctor).map(([nombre, data]) => (
              <div key={nombre} className="glass-card p-5 hover:shadow-floating transition-shadow duration-300">
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider truncate mb-1">{nombre}</p>
                <p className="text-xl font-bold text-slate-900">${data.total.toLocaleString()}</p>
                <p className="text-[11px] font-medium text-slate-500 mt-1">{data.count} atencione{data.count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        )}

        {/* TABLA */}
        {loading ? (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium text-sm tracking-wide">Cargando registros financieros...</p>
          </div>
        ) : consultas.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-slate-500 font-medium text-sm">No se encontraron consultas facturadas en este período.</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 text-xs uppercase tracking-widest">Fecha</th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 text-xs uppercase tracking-widest">Paciente</th>
                    <th className="text-left px-5 py-4 font-bold text-slate-700 text-xs uppercase tracking-widest">Profesional</th>
                    <th className="text-right px-5 py-4 font-bold text-slate-700 text-xs uppercase tracking-widest">Total Factura</th>
                    <th className="text-center px-5 py-4 font-bold text-slate-700 text-xs uppercase tracking-widest">Cobranza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {consultas.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 text-slate-500 font-medium whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-800">{c.pacientes?.nombre_completo || 'N/A'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider">
                          {c.doctores?.nombre_completo || 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-800">
                        ${((c.precio_consulta || 50000) + (obtenerEstadoPagoMedicamentos(c) === 'pagado' ? obtenerMontoMedicamentos(c) : 0)).toLocaleString()} <span className="text-slate-400 font-medium text-xs">COP</span>
                        {obtenerMontoMedicamentos(c) ? (
                          <span className="block text-[11px] font-semibold text-slate-400 mt-1">
                            Meds: ${Number(obtenerMontoMedicamentos(c)).toLocaleString()} 
                            <span className={obtenerEstadoPagoMedicamentos(c) === 'pagado' ? 'text-emerald-500 ml-1' : 'text-amber-500 ml-1'}>
                              ({obtenerEstadoPagoMedicamentos(c) === 'pagado' ? 'Pagados' : 'Pendientes'})
                            </span>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => toggleEstadoPago(c.id, obtenerEstadoPagoMedicamentos(c))}
                          className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all active:scale-95 ${
                            obtenerEstadoPagoMedicamentos(c) === 'pagado'
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                        >
                          {obtenerEstadoPagoMedicamentos(c) === 'pagado' ? '✓ Abonado' : '⏳ Cobrar Medicamentos'}
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
