'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Consulta, Doctor, Paciente } from '@/lib/types'

const DOCTORES_FIJOS = new Map([
  ['a142aea4-d90f-469f-9ff2-d56d057676cb', 'Clemente Herrera'],
  ['a5f41fcf-5950-4b29-aad1-ded22f57ccf2', 'Andrés Herrera'],
  ['c2cde56e-7fae-4ac4-b352-f3506c78137d', 'Rosa Castaño'],
  ['f8c7116d-1c8b-4d2f-927c-0d48296f2dfd', 'Carolina Herrera'],
])

export default function DetallePacientePage() {
  const params = useParams()
  const router = useRouter()
  const pacienteId = params?.id as string
  const supabase = useMemo(() => createClient(), [])

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [doctorElegido, setDoctorElegido] = useState<Doctor | null>(null)
  const [fotoCedulaUrl, setFotoCedulaUrl] = useState<string | null>(null)
  const [visorCedulaAbierto, setVisorCedulaAbierto] = useState(false)
  const [zoomCedula, setZoomCedula] = useState(1)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  async function cargarDatosPaciente() {
    if (!pacienteId) return
    setLoading(true)

    try {
      // 1. Cargar datos del paciente
      const { data: dataPaciente, error: errorPaciente } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', pacienteId)
        .single()

      if (errorPaciente) {
        console.error('Error al cargar paciente:', errorPaciente.message || errorPaciente)
      } else {
        const pacienteCargado = dataPaciente as Paciente
        setPaciente(pacienteCargado)

        if (pacienteCargado.id_doctor_elegido) {
          const { data: dataDoctor, error: errorDoctor } = await supabase
            .from('doctores')
            .select('id, nombre_completo')
            .eq('id', pacienteCargado.id_doctor_elegido)
            .maybeSingle()

          if (errorDoctor) {
            console.error('Error al cargar doctor elegido:', errorDoctor.message || errorDoctor)
            setDoctorElegido(null)
          } else {
            setDoctorElegido((dataDoctor || null) as Doctor | null)
          }
        } else {
          setDoctorElegido(null)
        }

        if (pacienteCargado.foto_cedula_frente) {
          const { data: signedUrlData } = await supabase.storage
            .from('cedulas-pacientes')
            .createSignedUrl(pacienteCargado.foto_cedula_frente, 60 * 10)

          setFotoCedulaUrl(signedUrlData?.signedUrl || null)
        } else {
          setFotoCedulaUrl(null)
        }
      }

      // 2. Cargar historial de consultas CON EL DOCTOR TRATANTE
      const { data: dataConsultas, error: errorConsultas } = await supabase
        .from('consultas')
        .select(`
          *,
          doctores:id_doctor (
            id,
            nombre_completo
          )
        `)
        .eq('id_paciente', pacienteId)
        .order('created_at', { ascending: false })

      if (errorConsultas) {
        console.error('Error al cargar consultas:', errorConsultas.message || JSON.stringify(errorConsultas))
      } else {
        setConsultas((dataConsultas || []) as unknown as Consulta[])
      }
    } catch (error) {
      console.error('Error general:', error)
    } finally {
      setLoading(false)
    }
  }

  cargarDatosPaciente()
  }, [pacienteId, supabase])

  const obtenerMontoMedicamentos = (consulta: Consulta) => {
    if (typeof consulta.monto_medicamentos === 'number') {
      return consulta.monto_medicamentos
    }

    return Array.isArray(consulta.medicamentos)
      ? consulta.medicamentos.reduce((acc, med) => acc + (Number(med.precio) || 0), 0)
      : 0
  }

  const obtenerEstadoPagoMedicamentos = (consulta: Consulta) => consulta.estado_pago_medicamentos ?? consulta.estado_pago ?? 'pendiente'
  const obtenerTotalConsulta = (consulta: Consulta) => (consulta.precio_consulta || 50000) + (obtenerEstadoPagoMedicamentos(consulta) === 'pagado' ? obtenerMontoMedicamentos(consulta) : 0)

  const doctorVisible = doctorElegido?.nombre_completo || (paciente?.id_doctor_elegido ? DOCTORES_FIJOS.get(paciente.id_doctor_elegido) : null)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <p className="text-slate-600 font-semibold text-sm">Cargando expediente del paciente...</p>
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md text-center max-w-sm w-full space-y-4">
          <p className="text-slate-800 font-bold">No se encontró el paciente solicitado.</p>
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

        {/* BOTÓN VOLVER Y ACCIÓN RÁPIDA */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            ← Volver al Dashboard
          </button>

          <button
            onClick={() => router.push(`/consultas/nueva?pacienteId=${paciente.id}`)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow transition text-sm flex items-center gap-2"
          >
            + Nueva Consulta / Tratamiento
          </button>
        </div>

        {/* TARJETA DE DATOS DEL PACIENTE */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-200">
          <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">
                Expediente del Paciente
              </span>
              <h1 className="text-2xl font-bold text-slate-800">{paciente.nombre_completo}</h1>
              <p className="text-sm text-slate-500 mt-1">
                CC / Identificación: <span className="font-semibold text-slate-700">{paciente.documento_identidad || 'N/A'}</span>
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[180px_1fr] mb-5">
            <button
              type="button"
              onClick={() => fotoCedulaUrl && setVisorCedulaAbierto(true)}
              className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center min-h-[180px] relative group"
              aria-label="Abrir foto de la cédula en pantalla completa"
            >
              {fotoCedulaUrl ? (
                <img
                  src={fotoCedulaUrl}
                  alt={`Cédula de ${paciente.nombre_completo}`}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                />
              ) : (
                <span className="text-xs font-semibold text-slate-400">Sin foto de cédula</span>
              )}
              {fotoCedulaUrl && (
                <span className="absolute inset-x-0 bottom-0 bg-slate-950/55 text-white text-[11px] font-semibold py-2 opacity-0 group-hover:opacity-100 transition">
                  Click para ampliar
                </span>
              )}
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm bg-slate-50/60 rounded-2xl p-4 border border-slate-100">
              <div>
                <span className="block text-slate-400 font-semibold">Doctor elegido</span>
                <span className="font-bold text-slate-700">{doctorVisible || 'No asignado'}</span>
                {paciente.id_doctor_elegido && !doctorVisible && (
                  <span className="block text-[11px] text-slate-400 mt-1 break-all">ID guardado: {paciente.id_doctor_elegido}</span>
                )}
              </div>
              <div>
                <span className="block text-slate-400 font-semibold">Fecha de registro</span>
                <span className="font-bold text-slate-700">
                  {paciente.fecha_registro
                    ? new Date(paciente.fecha_registro).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })
                    : 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-slate-400 font-semibold">Teléfono</span>
                <span className="font-bold text-slate-700">{paciente.telefono || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-semibold">Edad</span>
                <span className="font-bold text-slate-700">{paciente.edad || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {visorCedulaAbierto && fotoCedulaUrl && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/95 p-4 sm:p-8 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              setVisorCedulaAbierto(false)
              setZoomCedula(1)
            }}
          >
            <div className="relative w-full h-full max-w-[96vw] max-h-[96vh] flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setVisorCedulaAbierto(false)
                  setZoomCedula(1)
                }}
                className="absolute top-0 right-0 z-10 rounded-full bg-white/10 text-white px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/20"
              >
                Cerrar
              </button>
              <div className="absolute top-0 left-0 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={(evento) => {
                    evento.stopPropagation()
                    setZoomCedula((valor) => Math.min(3, Number((valor + 0.2).toFixed(1))))
                  }}
                  className="rounded-full bg-white/10 text-white w-11 h-11 flex items-center justify-center text-xl font-bold backdrop-blur hover:bg-white/20"
                  aria-label="Aumentar zoom"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={(evento) => {
                    evento.stopPropagation()
                    setZoomCedula((valor) => Math.max(1, Number((valor - 0.2).toFixed(1))))
                  }}
                  className="rounded-full bg-white/10 text-white w-11 h-11 flex items-center justify-center text-2xl font-bold backdrop-blur hover:bg-white/20"
                  aria-label="Disminuir zoom"
                >
                  −
                </button>
              </div>
              <img
                src={fotoCedulaUrl}
                alt={`Cédula de ${paciente.nombre_completo}`}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl bg-white transition-transform duration-150"
                style={{ transform: `scale(${zoomCedula})` }}
                onClick={(evento) => evento.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* SECCIÓN DE HISTORIAL DE ATENCIONES */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Historial de Consultas y Tratamientos</h2>
            <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-full">
              {consultas.length} registros
            </span>
          </div>

          {consultas.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-3">
              <p className="text-slate-500 text-sm">Este paciente no tiene atenciones ni tratamientos registrados aún.</p>
              <button
                onClick={() => router.push(`/consultas/nueva?pacienteId=${paciente.id}`)}
                className="text-blue-600 hover:underline font-bold text-sm"
              >
                Crear la primera consulta aquí
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {consultas.map((item) => {
                const doctor = item.doctores
                const fecha = new Date(item.created_at).toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })

                return (
                  <div key={item.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                    
                    {/* ENCABEZADO DE LA CONSULTA CON EL DOCTOR TRATANTE */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                      
                      {/* INFORMACIÓN DEL DOCTOR TRATANTE */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg">
                          👨‍⚕️
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                            Doctor Tratante
                          </span>
                          <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                            {doctor ? doctor.nombre_completo : 'Doctor no asignado'}
                          </h3>
                        </div>
                      </div>

                      {/* FECHA Y HORA */}
                      <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        📅 {fecha}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-blue-50/70 rounded-xl p-3 border border-blue-100">
                        <span className="block text-blue-500 font-bold uppercase tracking-wider text-[10px]">Consulta fija</span>
                        <span className="block text-slate-800 font-bold mt-1">$ {Number(item.precio_consulta || 50000).toLocaleString()} COP</span>
                      </div>
                      <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-100">
                        <span className="block text-amber-600 font-bold uppercase tracking-wider text-[10px]">Medicamentos</span>
                        <span className="block text-slate-800 font-bold mt-1">
                          $ {obtenerMontoMedicamentos(item).toLocaleString()} COP
                        </span>
                        <span className={`inline-flex mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold ${obtenerEstadoPagoMedicamentos(item) === 'pagado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {obtenerEstadoPagoMedicamentos(item) === 'pagado' ? 'Pagados' : 'Pendientes'}
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">Balance</span>
                        <span className="block text-slate-800 font-bold mt-1">
                          $ {obtenerTotalConsulta(item).toLocaleString()} COP
                        </span>
                        {obtenerEstadoPagoMedicamentos(item) === 'pendiente' && obtenerMontoMedicamentos(item) > 0 && (
                          <span className="block text-[10px] text-amber-600 mt-2 font-semibold">
                            Pendiente: $ {obtenerMontoMedicamentos(item).toLocaleString()} COP
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => router.push(`/consultas/${item.id}/editar`)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Editar tratamiento
                      </button>
                    </div>

                    {/* MOTIVO DE CONSULTA */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Motivo de Consulta</h4>
                      <p className="text-sm text-slate-800 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        {item.motivo_consulta || 'Sin especificar'}
                      </p>
                    </div>

                    {/* SIGNOS VITALES SI EXISTEN */}
                    {(item.peso_kg || item.talla_cm || item.presion_arterial) && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-center">
                        <div>
                          <span className="block text-[10px] font-semibold text-slate-400">PESO</span>
                          <span className="text-xs font-bold text-slate-700">{item.peso_kg ? `${item.peso_kg} kg` : '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold text-slate-400">TALLA</span>
                          <span className="text-xs font-bold text-slate-700">{item.talla_cm ? `${item.talla_cm} cm` : '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold text-slate-400">P. ARTERIAL</span>
                          <span className="text-xs font-bold text-slate-700">{item.presion_arterial || '-'}</span>
                        </div>
                      </div>
                    )}

                    {/* TRATAMIENTO Y OBSERVACIONES */}
                    {item.tratamiento_realizado && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Tratamiento / Observaciones</h4>
                        <p className="text-sm text-slate-800 bg-blue-50/40 p-3 rounded-xl border border-blue-100">
                          {item.tratamiento_realizado}
                        </p>
                      </div>
                    )}

                    {/* MEDICAMENTOS RECETADOS */}
                    {Array.isArray(item.medicamentos) && item.medicamentos.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Medicamentos Recetados</h4>
                        <div className="space-y-2">
                          {item.medicamentos.map((med, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                              <div>
                                <span className="font-bold text-slate-800">{med.nombre}</span>
                                {med.indicacion && <span className="text-slate-500 block">Indicación: {med.indicacion}</span>}
                              </div>
                              {med.precio && <span className="font-semibold text-slate-600">${Number(med.precio).toLocaleString()} COP</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
