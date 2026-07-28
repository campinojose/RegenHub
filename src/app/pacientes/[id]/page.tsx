'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function DetallePacientePage() {
  const params = useParams()
  const router = useRouter()
  const pacienteId = params?.id as string
  const supabase = createClient()

  const [paciente, setPaciente] = useState<any>(null)
  const [consultas, setConsultas] = useState<any[]>([])
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
        setPaciente(dataPaciente)
      }

      // 2. Cargar historial de consultas CON EL DOCTOR TRATANTE
      const { data: dataConsultas, error: errorConsultas } = await supabase
        .from('consultas')
        .select(`
          id,
          created_at,
          motivo_consulta,
          peso_kg,
          talla_cm,
          imc,
          presion_arterial,
          frecuencia_cardiaca,
          temperatura_c,
          tratamiento_realizado,
          precio_consulta,
          medicamentos,
          doctores:id_doctor (
            id,
            nombre_completo,
            especialidad,
            registro_medico
          )
        `)
        .eq('id_paciente', pacienteId)
        .order('created_at', { ascending: false })

      if (errorConsultas) {
        console.error('Error al cargar consultas:', errorConsultas.message || JSON.stringify(errorConsultas))
      } else {
        setConsultas(dataConsultas || [])
      }
    } catch (error) {
      console.error('Error general:', error)
    } finally {
      setLoading(false)
    }
  }

  cargarDatosPaciente()
}, [pacienteId])

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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
            <div>
              <span className="block text-slate-400 font-semibold">Edad</span>
              <span className="font-bold text-slate-700">{paciente.edad ? `${paciente.edad} años` : 'N/A'}</span>
            </div>
            <div>
              <span className="block text-slate-400 font-semibold">Teléfono</span>
              <span className="font-bold text-slate-700">{paciente.telefono || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-slate-400 font-semibold">Correo Electrónico</span>
              <span className="font-bold text-slate-700 truncate block">{paciente.email || 'N/A'}</span>
            </div>
          </div>
        </div>

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
                          {doctor && (
                            <p className="text-xs text-slate-500">
                              {doctor.especialidad || 'Sin especialidad'} {doctor.registro_medico ? `• RM: ${doctor.registro_medico}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* FECHA Y HORA */}
                      <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        📅 {fecha}
                      </span>
                    </div>

                    {/* MOTIVO DE CONSULTA */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-1">Motivo de Consulta</h4>
                      <p className="text-sm text-slate-800 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        {item.motivo_consulta || 'Sin especificar'}
                      </p>
                    </div>

                    {/* SIGNOS VITALES SI EXISTEN */}
                    {(item.peso_kg || item.talla_cm || item.presion_arterial || item.frecuencia_cardiaca || item.temperatura_c) && (
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
                        <div>
                          <span className="block text-[10px] font-semibold text-slate-400">F. CARDÍACA</span>
                          <span className="text-xs font-bold text-slate-700">{item.frecuencia_cardiaca ? `${item.frecuencia_cardiaca} bpm` : '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-semibold text-slate-400">TEMP</span>
                          <span className="text-xs font-bold text-slate-700">{item.temperatura_c ? `${item.temperatura_c} °C` : '-'}</span>
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
                          {item.medicamentos.map((med: any, idx: number) => (
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