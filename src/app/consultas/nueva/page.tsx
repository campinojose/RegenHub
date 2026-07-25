'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface MedicamentoItem {
  nombre: string
  indicacion: string
  precio: number | string
}

function NuevaConsultaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pacienteId = searchParams.get('pacienteId')
  const supabase = createClient()

  // Estados de Doctores y Paciente
  const [listaDoctores, setListaDoctores] = useState<any[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [paciente, setPaciente] = useState<any>(null)
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [guardadoExitoso, setGuardadoExitoso] = useState(false)

  // Datos de la Consulta
  const [motivoConsulta, setMotivoConsulta] = useState('')
  const [pesoKg, setPesoKg] = useState('')
  const [tallaCm, setTallaCm] = useState('')
  const [presionArterial, setPresionArterial] = useState('')
  const [frecuenciaCardiaca, setFrecuenciaCardiaca] = useState('')
  const [temperatura, setTemperatura] = useState('')
  const [tratamiento, setTratamiento] = useState('')

  // Facturación y Medicamentos
  const [valorConsulta, setValorConsulta] = useState<number | string>(50000)
  const [medicamentos, setMedicamentos] = useState<MedicamentoItem[]>([
    { nombre: '', indicacion: '', precio: '' }
  ])

  useEffect(() => {
    async function loadData() {
      setLoadingData(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        // 1. Cargar todos los doctores disponibles
        const { data: docs, error: errDocs } = await supabase
          .from('doctores')
          .select('*')
          .order('nombre_completo', { ascending: true })

        if (errDocs) console.error('Error al cargar doctores:', errDocs)

        if (docs && docs.length > 0) {
          setListaDoctores(docs)
          
          // Buscar si el usuario actual coincide con alguno por ID o email
          const docCoincidente = docs.find(
            d => d.id === user.id || d.email === user.email
          )

          if (docCoincidente) {
            setSelectedDoctorId(docCoincidente.id)
          } else {
            // Si no coincide, seleccionar el primero por defecto
            setSelectedDoctorId(docs[0].id)
          }
        }

        // 2. Cargar información del paciente
        if (pacienteId) {
          const { data: pac, error: errPac } = await supabase
            .from('pacientes')
            .select('*')
            .eq('id', pacienteId)
            .maybeSingle()

          if (errPac) console.error('Error al cargar paciente:', errPac)
          if (pac) setPaciente(pac)
        }
      } catch (err) {
        console.error('Error en la carga de datos:', err)
      } finally {
        setLoadingData(false)
      }
    }

    loadData()
  }, [pacienteId])

  // Obtener el doctor seleccionado actualmente
  const doctorSeleccionado = listaDoctores.find(d => d.id === selectedDoctorId)

  // Agregar un nuevo campo de medicamento
  const handleAgregarMedicamento = () => {
    setMedicamentos([
      ...medicamentos,
      { nombre: '', indicacion: '', precio: '' }
    ])
  }

  // Eliminar medicamento
  const handleEliminarMedicamento = (index: number) => {
    setMedicamentos(medicamentos.filter((_, i) => i !== index))
  }

  // Actualizar campo de medicamento
  const handleUpdateMedicamento = (index: number, field: keyof MedicamentoItem, value: any) => {
    const updated = [...medicamentos]
    updated[index] = { ...updated[index], [field]: value }
    setMedicamentos(updated)
  }

  // Cálculos dinámicos
  const totalMedicamentos = medicamentos.reduce((acc, m) => acc + (Number(m.precio) || 0), 0)
  const valorTotal = (Number(valorConsulta) || 0) + totalMedicamentos

  // Formato Fecha Actual (DD/MM/YYYY)
  const fechaHoy = new Date().toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  // Generar la estructura limpia del ticket de resumen
  const generarTextoTicket = () => {
    const doctorNombre = doctorSeleccionado?.nombre_completo || 'Dr.'
    const pacienteNombre = paciente?.nombre_completo || 'Paciente'
    const pacienteCC = paciente?.documento_identidad || 'N/A'
    const valConsultaStr = Number(valorConsulta || 0).toLocaleString()
    const totalStr = valorTotal.toLocaleString()

    const medFiltrados = medicamentos.filter(m => m.nombre.trim() !== '')

    let lineasMedicamentos = ''
    if (medFiltrados.length > 0) {
      lineasMedicamentos = medFiltrados.map((m, idx) => {
        const num = `   2.${idx + 1}`
        const nombrePad = m.nombre.padEnd(28, ' ')
        const precioFormatted = `$ ${Number(m.precio || 0).toLocaleString()} COP`
        const indicacionStr = `       Indicación: ${m.indicacion || 'Sin especificación'}`
        return `${num} ${nombrePad} ${precioFormatted}\n${indicacionStr}`
      }).join('\n')
    } else {
      lineasMedicamentos = '   (No se recetaron medicamentos)'
    }

    return `==================================================
              RESUMEN DE ATENCIÓN Y FACTURA
==================================================
Doctor: ${doctorNombre}
Paciente: ${pacienteNombre} (CC: ${pacienteCC})
Fecha: ${fechaHoy}

--------------------------------------------------
1. Valor Consulta:                    $ ${valConsultaStr} COP
--------------------------------------------------
2. Medicamentos Recetados:

${lineasMedicamentos}
--------------------------------------------------

VALOR TOTAL A PAGAR:                $ ${totalStr} COP
==================================================`
  }

  // Guardar consulta en Supabase
  const handleGuardarConsulta = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paciente) {
      alert('Error: No se ha seleccionado o cargado ningún paciente.')
      return
    }

    if (!selectedDoctorId) {
      alert('Error: Por favor selecciona un doctor que atienda la consulta.')
      return
    }

    setLoading(true)

    let imc = null
    if (pesoKg && tallaCm) {
      const tallaM = Number(tallaCm) / 100
      imc = Number((Number(pesoKg) / (tallaM * tallaM)).toFixed(2))
    }

    // Filtrar medicamentos y formatear precios como números
    const medicamentosValidos = medicamentos
      .filter(m => m.nombre.trim() !== '')
      .map(m => ({
        nombre: m.nombre,
        indicacion: m.indicacion,
        precio: Number(m.precio) || 0
      }))

    const objetoConsulta = {
      id_paciente: paciente.id,
      id_doctor: selectedDoctorId,
      motivo_consulta: motivoConsulta,
      peso_kg: pesoKg ? Number(pesoKg) : null,
      talla_cm: tallaCm ? Number(tallaCm) : null,
      imc: imc,
      presion_arterial: presionArterial || null,
      frecuencia_cardiaca: frecuenciaCardiaca ? Number(frecuenciaCardiaca) : null,
      temperatura_c: temperatura ? Number(temperatura) : null,
      tratamiento_realizado: tratamiento || null,
      precio_consulta: Number(valorConsulta) || 0,
      medicamentos: medicamentosValidos
    }

    const { error } = await supabase.from('consultas').insert([objetoConsulta])

    if (error) {
      console.error('Error Supabase:', error)
      alert('Error al guardar la consulta: ' + error.message)
    } else {
      setGuardadoExitoso(true)
    }
    setLoading(false)
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600 font-semibold">Cargando datos del formulario...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Botón Volver */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-4 text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          ← Volver al Dashboard
        </button>

        {!paciente && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-sm">
            ⚠️ <strong>Atención:</strong> No se encontró el paciente. Ingresa desde la ficha de paciente en el Dashboard.
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          
          {/* Encabezado */}
          <div className="bg-blue-600 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Nueva Consulta Médica</h1>
              <p className="text-blue-100 text-sm mt-1">
                Paciente: <span className="font-bold underline">{paciente?.nombre_completo || 'No asignado'}</span> {paciente?.documento_identidad ? `(CC: ${paciente.documento_identidad})` : ''}
              </p>
            </div>

            {/* SELECCIONADOR DE DOCTOR */}
            <div className="bg-blue-700/80 p-3 rounded-xl border border-blue-400/30 text-right min-w-[240px]">
              <label className="block text-xs font-semibold text-blue-100 mb-1">
                Doctor Tratante:
              </label>
              {listaDoctores.length > 0 ? (
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full bg-white text-slate-800 font-bold text-xs py-1.5 px-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-300 border-none cursor-pointer"
                >
                  {listaDoctores.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.nombre_completo} {doc.especialidad ? `(${doc.especialidad})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-200 font-bold">No hay doctores registrados</p>
              )}
            </div>
          </div>

          {!guardadoExitoso ? (
            <form onSubmit={handleGuardarConsulta} className="p-6 space-y-6">
              
              {/* SELECTOR DE DOCTOR SECUNDARIO / VISIBLE EN EL FORMULARIO */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Doctor / Profesional Responsable</h3>
                  <p className="text-xs text-slate-500">Selecciona quién realiza esta atención o tratamiento</p>
                </div>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
                >
                  {listaDoctores.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.nombre_completo}
                    </option>
                  ))}
                </select>
              </div>

              {/* MOTIVO DE CONSULTA */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Motivo de Consulta *</label>
                <textarea
                  required
                  rows={3}
                  value={motivoConsulta}
                  onChange={(e) => setMotivoConsulta(e.target.value)}
                  placeholder="Motivo principal de la cita..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* SIGNOS VITALES */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h2 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Signos Vitales</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Peso (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="70"
                      value={pesoKg}
                      onChange={(e) => setPesoKg(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Talla (cm)</label>
                    <input
                      type="number"
                      placeholder="170"
                      value={tallaCm}
                      onChange={(e) => setTallaCm(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">P. Arterial</label>
                    <input
                      type="text"
                      placeholder="120/80"
                      value={presionArterial}
                      onChange={(e) => setPresionArterial(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">F. Cardíaca</label>
                    <input
                      type="number"
                      placeholder="72"
                      value={frecuenciaCardiaca}
                      onChange={(e) => setFrecuenciaCardiaca(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="36.5"
                      value={temperatura}
                      onChange={(e) => setTemperatura(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* TRATAMIENTO / OBSERVACIONES */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Tratamiento / Observaciones Médicas</label>
                <textarea
                  rows={2}
                  value={tratamiento}
                  onChange={(e) => setTratamiento(e.target.value)}
                  placeholder="Detalles del diagnóstico o procedimiento realizado..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* SECCIÓN DE FACTURACIÓN Y MEDICAMENTOS */}
              <div className="border-t border-slate-200 pt-6 space-y-4">
                <h2 className="text-base font-bold text-slate-800">Facturación y Receta Médica</h2>

                {/* 1. Valor Consulta */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-200 gap-3">
                  <span className="text-sm font-bold text-slate-700">1. Valor Consulta (COP):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-500">$</span>
                    <input
                      type="number"
                      value={valorConsulta}
                      onChange={(e) => setValorConsulta(e.target.value)}
                      className="w-40 px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                {/* 2. Medicamentos Recetados */}
                <div className="space-y-4 pt-2">
                  <label className="block text-sm font-bold text-slate-700">2. Medicamentos Recetados:</label>

                  {medicamentos.map((med, index) => (
                    <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                      {medicamentos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleEliminarMedicamento(index)}
                          className="absolute top-3 right-3 text-red-500 hover:text-red-700 text-xs font-bold"
                        >
                          ✕ Eliminar
                        </button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-8">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Ingresar Medicamento {index + 1}:
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Lithium Carbonicum"
                            value={med.nombre}
                            onChange={(e) => handleUpdateMedicamento(index, 'nombre', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">
                            Ingresar Valor Medicamento {index + 1} ($ COP):
                          </label>
                          <input
                            type="number"
                            placeholder="30000"
                            value={med.precio}
                            onChange={(e) => handleUpdateMedicamento(index, 'precio', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Indicación / Posología:
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Tomar 2 gotas cada 8h"
                          value={med.indicacion}
                          onChange={(e) => handleUpdateMedicamento(index, 'indicacion', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Botón Agregar otro medicamento */}
                  <button
                    type="button"
                    onClick={handleAgregarMedicamento}
                    className="w-full py-2.5 border-2 border-dashed border-emerald-500 hover:border-emerald-600 text-emerald-700 font-bold rounded-xl text-sm transition bg-emerald-50/30 hover:bg-emerald-50"
                  >
                    + Agregar otro medicamento
                  </button>
                </div>
              </div>

              {/* BOTÓN GUARDAR Y VER VISTA PREVIA */}
              <button
                type="submit"
                disabled={loading || !paciente || !selectedDoctorId}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-lg transition text-base"
              >
                {loading ? 'Guardando...' : 'Guardar Consulta y Generar Resumen'}
              </button>
            </form>
          ) : (
            
            /* VISTA DE RESUMEN Y TICKET DE FACTURA */
            <div className="p-8 space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-center font-semibold text-sm">
                ¡La consulta y facturación se guardaron exitosamente en el sistema!
              </div>

              {/* TICKET / FACTURA */}
              <div className="bg-slate-900 text-slate-100 p-6 rounded-xl font-mono text-xs sm:text-sm overflow-x-auto shadow-inner leading-relaxed">
                <pre className="whitespace-pre-wrap">{generarTextoTicket()}</pre>
              </div>

              {/* ACCIONES POST-GUARDADO */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  🖨️ Imprimir Resumen
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  Regresar al Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default function NuevaConsultaPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Cargando formulario...</div>}>
      <NuevaConsultaContent />
    </Suspense>
  )
}