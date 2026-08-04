'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Consulta, Doctor, Paciente } from '@/lib/types'

interface MedicamentoItem {
  nombre: string
  indicacion: string
  precio: number | string
  pagado: boolean
}

type ConsultaEditRow = {
  id: string
  id_paciente?: string | null
  id_doctor?: string | null
  created_at?: string | null
  motivo_consulta: string | null
  tratamiento_realizado: string | null
  medicamentos: { nombre: string; indicacion: string; precio: number; pagado?: boolean }[] | null
  precio_consulta: number | null
  monto_medicamentos: number | null
  estado_pago_medicamentos: 'pendiente' | 'pagado' | null
  total_factura?: number | null
  estado_pago?: 'pendiente' | 'pagado' | null
  pacientes?: Paciente[] | Paciente | null
  doctores?: Doctor[] | Doctor | null
}

const VALOR_CONSULTA_FIJO = 50000

export default function EditarConsultaPage() {
  const params = useParams()
  const router = useRouter()
  const consultaId = params?.id as string
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [consulta, setConsulta] = useState<ConsultaEditRow | null>(null)
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [motivoConsulta, setMotivoConsulta] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [medicamentos, setMedicamentos] = useState<MedicamentoItem[]>([{ nombre: '', indicacion: '', precio: '', pagado: false }])
  const [usaEstadoPagoMedicamentos, setUsaEstadoPagoMedicamentos] = useState(true)

  useEffect(() => {
    async function cargarConsulta() {
      if (!consultaId) return
      setLoading(true)

      const { data, error } = await supabase
        .from('consultas')
        .select(`
          *,
          pacientes:id_paciente (id, nombre_completo, documento_identidad, edad, sexo, telefono),
          doctores:id_doctor (id, nombre_completo)
        `)
        .eq('id', consultaId)
        .single()

      if (error) {
        console.error('Error al cargar consulta:', error)
        setConsulta(null)
        setLoading(false)
        return
      }

      const consultaCargada = data as unknown as ConsultaEditRow
      setUsaEstadoPagoMedicamentos(Object.prototype.hasOwnProperty.call(consultaCargada, 'estado_pago_medicamentos'))

      const pacienteRelacionado = Array.isArray(consultaCargada.pacientes)
        ? consultaCargada.pacientes[0] || null
        : consultaCargada.pacientes || null

      const doctorRelacionado = Array.isArray(consultaCargada.doctores)
        ? consultaCargada.doctores[0] || null
        : consultaCargada.doctores || null

      setConsulta(consultaCargada)
      setPaciente(pacienteRelacionado as Paciente | null)
      setDoctor(doctorRelacionado as Doctor | null)
      setMotivoConsulta(consultaCargada.motivo_consulta || '')
      setTratamiento(consultaCargada.tratamiento_realizado || '')
      
      const globalEstadoPago = consultaCargada.estado_pago_medicamentos || consultaCargada.estado_pago || 'pendiente'

      setMedicamentos(
        Array.isArray(consultaCargada.medicamentos) && consultaCargada.medicamentos.length > 0
          ? consultaCargada.medicamentos.map((med) => ({
              nombre: med.nombre,
              indicacion: med.indicacion,
              precio: med.precio,
              // Si no tiene la propiedad 'pagado' (consultas antiguas), inferirlo del estado global de la consulta
              pagado: med.pagado ?? (globalEstadoPago === 'pagado')
            }))
          : [{ nombre: '', indicacion: '', precio: '', pagado: false }]
      )
      setLoading(false)
    }

    cargarConsulta()
  }, [consultaId, supabase])

  const totalMedicamentos = medicamentos.reduce((acc, med) => acc + (Number(med.precio) || 0), 0)
  const totalMedicamentosPagados = medicamentos.reduce((acc, med) => acc + (med.pagado ? (Number(med.precio) || 0) : 0), 0)
  const totalFactura = VALOR_CONSULTA_FIJO + totalMedicamentos

  // Estado global calculado para guardarlo
  const todosPagados = medicamentos.filter(m => m.nombre.trim() !== '' && Number(m.precio) > 0).every(m => m.pagado)
  const algunoPagado = medicamentos.some(m => m.pagado && Number(m.precio) > 0)
  const estadoPagoMedicamentosGlobal: 'pagado' | 'pendiente' = (todosPagados && algunoPagado) ? 'pagado' : 'pendiente'


  const handleUpdateMedicamento = (index: number, field: keyof MedicamentoItem, value: any) => {
    setMedicamentos((actuales) => {
      const copia = [...actuales]
      copia[index] = { ...copia[index], [field]: value }
      return copia
    })
  }

  const agregarMedicamento = () => {
    setMedicamentos((actuales) => [...actuales, { nombre: '', indicacion: '', precio: '', pagado: false }])
  }

  const eliminarMedicamento = (index: number) => {
    setMedicamentos((actuales) => actuales.filter((_, currentIndex) => currentIndex !== index))
  }

  const guardarCambios = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!consultaId) return

    setGuardando(true)
    const medicamentosValidos = medicamentos
      .filter((med) => med.nombre.trim() !== '')
      .map((med) => ({
        nombre: med.nombre.trim(),
        indicacion: med.indicacion.trim(),
        precio: Number(med.precio) || 0,
        pagado: med.pagado
      }))

    const montoMedicamentosPagados = medicamentosValidos.reduce((acc, med) => acc + (med.pagado ? med.precio : 0), 0)

    const { error } = await supabase
      .from('consultas')
      .update({
        motivo_consulta: motivoConsulta.trim(),
        tratamiento_realizado: tratamiento.trim(),
        medicamentos: medicamentosValidos,
        precio_consulta: VALOR_CONSULTA_FIJO,
        monto_medicamentos: montoMedicamentosPagados,
        total_factura: VALOR_CONSULTA_FIJO + medicamentosValidos.reduce((acc, med) => acc + med.precio, 0),
        estado_pago: 'pagado',
        ...(usaEstadoPagoMedicamentos ? { estado_pago_medicamentos: estadoPagoMedicamentosGlobal } : {}),
      })
      .eq('id', consultaId)

    if (error) {
      alert('No se pudo actualizar la historia clínica: ' + error.message)
      setGuardando(false)
      return
    }

    alert('Historia clínica actualizada con éxito')
    router.push(`/pacientes/${consulta?.id_paciente || paciente?.id || ''}`)
    setGuardando(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <p className="text-slate-600 font-semibold text-sm">Cargando historia clínica...</p>
      </div>
    )
  }

  if (!consulta || !paciente) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md text-center max-w-sm w-full space-y-4">
          <p className="text-slate-800 font-bold">No se encontró la consulta solicitada.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-xl text-sm"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => router.back()}
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ← Volver
        </button>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">Editar historia clínica</span>
            <h1 className="text-2xl font-bold text-slate-800 mt-1">{paciente.nombre_completo}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Doctor: <span className="font-semibold text-slate-700">{doctor?.nombre_completo || 'N/A'}</span>
            </p>
          </div>

          <form onSubmit={guardarCambios} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Motivo de consulta</label>
              <textarea
                rows={3}
                value={motivoConsulta}
                onChange={(e) => setMotivoConsulta(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Tratamiento / Diagnóstico</label>
              <textarea
                rows={4}
                value={tratamiento}
                onChange={(e) => setTratamiento(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-black"
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Medicamentos</h2>
                  <p className="text-xs text-slate-500">Ajusta la receta y el estado de pago individual de cada medicamento.</p>
                </div>
                {medicamentos.some(m => m.nombre.trim() !== '') && (
                  <div className="text-right text-xs font-semibold text-slate-500">
                    Total: <span className="text-slate-800 font-bold">${totalMedicamentos.toLocaleString()}</span>
                    {' · '}
                    Pagado: <span className="text-emerald-700 font-bold">${totalMedicamentosPagados.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-2">
                {medicamentos.map((medicamento, index) => (
                  <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 relative">
                    {medicamentos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => eliminarMedicamento(index)}
                        className="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xs font-bold"
                      >
                        ✕ Eliminar
                      </button>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-8">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Medicamento {index + 1}</label>
                        <input
                          type="text"
                          value={medicamento.nombre}
                          onChange={(e) => handleUpdateMedicamento(index, 'nombre', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Valor</label>
                        <input
                          type="number"
                          value={medicamento.precio}
                          onChange={(e) => handleUpdateMedicamento(index, 'precio', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold bg-white text-black"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Indicación</label>
                      <input
                        type="text"
                        value={medicamento.indicacion}
                        onChange={(e) => handleUpdateMedicamento(index, 'indicacion', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                      />
                    </div>
                    
                    {/* ESTADO DE PAGO INDIVIDUAL */}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs font-semibold text-slate-500">Estado de pago:</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateMedicamento(index, 'pagado', true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${medicamento.pagado ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400 hover:text-emerald-600'}`}
                      >
                        ✓ Pagado
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateMedicamento(index, 'pagado', false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${!medicamento.pagado ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-amber-400 hover:text-amber-600'}`}
                      >
                        ⏳ Pendiente
                      </button>
                      {Number(medicamento.precio) > 0 && (
                        <span className={`text-xs font-bold ml-auto ${medicamento.pagado ? 'text-emerald-600' : 'text-amber-600'}`}>
                          ${Number(medicamento.precio).toLocaleString()} COP
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={agregarMedicamento}
                  className="w-full py-2.5 border-2 border-dashed border-emerald-500 hover:border-emerald-600 text-emerald-700 font-bold rounded-xl text-sm transition bg-emerald-50/30 hover:bg-emerald-50"
                >
                  + Agregar otro medicamento
                </button>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-slate-700">
              <div className="flex flex-wrap gap-4">
                <span><strong>Consulta fija:</strong> $ {VALOR_CONSULTA_FIJO.toLocaleString()} COP</span>
                <span><strong>Total medicamentos pagados:</strong> $ {totalMedicamentosPagados.toLocaleString()} COP</span>
                <span><strong>Total factura pagado:</strong> $ {(VALOR_CONSULTA_FIJO + totalMedicamentosPagados).toLocaleString()} COP</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-lg transition text-base"
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
