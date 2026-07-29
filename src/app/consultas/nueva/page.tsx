'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { generarPDFConsulta } from '@/lib/generarPDF'
import type { Doctor, Paciente, PerfilUsuario } from '@/lib/types'

interface MedicamentoItem {
  nombre: string
  indicacion: string
  precio: number | string
}

const VALOR_CONSULTA_FIJO = 50000

function NuevaConsultaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pacienteId = searchParams.get('pacienteId')
  const supabase = useMemo(() => createClient(), [])

  // Estados de Doctores y Paciente
  const [listaDoctores, setListaDoctores] = useState<Doctor[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [perfilAsistente, setPerfilAsistente] = useState<PerfilUsuario | null>(null)
  
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [guardadoExitoso, setGuardadoExitoso] = useState(false)

  // Datos de la Consulta
  const [motivoConsulta, setMotivoConsulta] = useState('')
  const [pesoKg, setPesoKg] = useState('')
  const [tallaCm, setTallaCm] = useState('')
  const [presionArterial, setPresionArterial] = useState('')
  const [tratamiento, setTratamiento] = useState('')
  const [estadoPagoMedicamentos, setEstadoPagoMedicamentos] = useState<'pendiente' | 'pagado'>('pendiente')

  // Facturación y Medicamentos
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

        // Obtener perfil del asistente logueado
        const { data: perfil } = await supabase
          .from('perfiles_usuario')
          .select('*')
          .eq('id', user.id)
          .single()
        if (perfil) setPerfilAsistente({ ...perfil, id: user.id } as PerfilUsuario)

        // 1. Cargar todos los doctores disponibles
        const { data: docs, error: errDocs } = await supabase
          .from('doctores')
          .select('*')
          .order('nombre_completo', { ascending: true })

        if (errDocs) {
          console.error('Error al cargar doctores:', errDocs)
          alert('Error al cargar doctores: ' + errDocs.message)
        }

        if (docs && docs.length > 0) {
          setListaDoctores(docs as Doctor[])
        }

        // 2. Cargar información del paciente
        let pacienteCargado: Paciente | null = null
        if (pacienteId) {
          const { data: pac, error: errPac } = await supabase
            .from('pacientes')
            .select('*')
            .eq('id', pacienteId)
            .maybeSingle()

          if (errPac) console.error('Error al cargar paciente:', errPac)
          if (pac) {
            pacienteCargado = pac as Paciente
            setPaciente(pacienteCargado)
          }
        }

        if (docs && docs.length > 0) {
          const doctorInicialId = pacienteCargado?.id_doctor_elegido || perfil?.id_doctor_favorito || docs[0].id
          const docCoincidente = docs.find((doc) => doc.id === doctorInicialId)
          setSelectedDoctorId(docCoincidente?.id || docs[0].id)
        }
      } catch (err) {
        console.error('Error en la carga de datos:', err)
      } finally {
        setLoadingData(false)
      }
    }

    loadData()
  }, [pacienteId, router, supabase])

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
  const handleUpdateMedicamento = (index: number, field: keyof MedicamentoItem, value: MedicamentoItem[keyof MedicamentoItem]) => {
    const updated = [...medicamentos]
    updated[index] = { ...updated[index], [field]: value }
    setMedicamentos(updated)
  }

  // Cálculos dinámicos
  const totalMedicamentos = medicamentos.reduce((acc, m) => acc + (Number(m.precio) || 0), 0)
  const valorTotal = VALOR_CONSULTA_FIJO + totalMedicamentos

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
    const valConsultaStr = VALOR_CONSULTA_FIJO.toLocaleString()
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
2. Medicamentos Recetados (${estadoPagoMedicamentos === 'pagado' ? 'Pagados' : 'Pendientes'}):

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

    const totalMeds = medicamentosValidos.reduce((acc, m) => acc + m.precio, 0)
    const totalFactura = VALOR_CONSULTA_FIJO + totalMeds

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.rpc('crear_consulta', {
      estado_pago: 'pagado',
      estado_pago_medicamentos: estadoPagoMedicamentos,
      id_asistente: user?.id || null,
      id_doctor: selectedDoctorId,
      id_paciente: paciente.id,
      imc,
      medicamentos: medicamentosValidos,
      motivo_consulta: motivoConsulta,
      monto_medicamentos: totalMeds,
      peso_kg: pesoKg ? Number(pesoKg) : null,
      precio_consulta: VALOR_CONSULTA_FIJO,
      presion_arterial: presionArterial || null,
      talla_cm: tallaCm ? Number(tallaCm) : null,
      total_factura: totalFactura,
      tratamiento_realizado: tratamiento || null
    })

    const errorReal = error && typeof error === 'object' && 'message' in error && (error as { message?: string }).message

    if (errorReal) {
      console.error('Error Supabase:', error)
      alert('Error al guardar la consulta: ' + errorReal)
    } else {
      // Generar PDF automáticamente
      const doctorActual = listaDoctores.find(d => d.id === selectedDoctorId)
      generarPDFConsulta({
        pacienteNombre: paciente.nombre_completo || 'N/A',
        pacienteCC: paciente.documento_identidad || 'N/A',
        pacienteEdad: paciente.edad ?? undefined,
        pacienteSexo: paciente.sexo ?? undefined,
        pacienteDireccion: paciente.direccion ?? undefined,
        pacienteTelefono: paciente.telefono ?? undefined,
        doctorNombre: doctorActual?.nombre_completo || 'N/A',
        asistenteNombre: perfilAsistente?.nombre_completo || 'Asistente',
        pesoKg: pesoKg || undefined,
        tallaCm: tallaCm || undefined,
        imc: imc ?? undefined,
        presionArterial: presionArterial || undefined,
        motivoConsulta,
        diagnostico: tratamiento,
        valorConsulta: VALOR_CONSULTA_FIJO,
        medicamentos: medicamentosValidos,
        estadoPagoMedicamentos,
        montoMedicamentos: totalMeds,
      })
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
          onClick={() => router.push('/asistente')}
          className="mb-4 text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          ← Volver al Panel
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
                      {doc.nombre_completo}
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
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-black"
                />
              </div>

              {/* SIGNOS VITALES */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h2 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Signos Vitales</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Peso (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="70"
                      value={pesoKg}
                      onChange={(e) => setPesoKg(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Talla (cm)</label>
                    <input
                      type="number"
                      placeholder="170"
                      value={tallaCm}
                      onChange={(e) => setTallaCm(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">P. Arterial</label>
                    <input
                      type="text"
                      placeholder="120/80"
                      value={presionArterial}
                      onChange={(e) => setPresionArterial(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-black"
                    />
                  </div>
                </div>
              </div>

              {/* TRATAMIENTO / OBSERVACIONES */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Diagnóstico</label>
                <textarea
                  rows={2}
                  value={tratamiento}
                  onChange={(e) => setTratamiento(e.target.value)}
                  placeholder="Detalles del diagnóstico..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm text-black"
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
                    <div className="w-40 px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 text-sm bg-slate-100 text-center">
                      {VALOR_CONSULTA_FIJO.toLocaleString()}
                    </div>
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
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
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
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold bg-white text-black"
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
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
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

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Estado de Pago de Medicamentos</h3>
                    <p className="text-xs text-slate-500">La consulta siempre queda pagada. Aquí solo controlas si los medicamentos quedaron pendientes o ya fueron cancelados.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEstadoPagoMedicamentos('pagado')}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${estadoPagoMedicamentos === 'pagado' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400'}`}
                    >
                      Medicamentos pagados
                    </button>
                    <button
                      type="button"
                      onClick={() => setEstadoPagoMedicamentos('pendiente')}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${estadoPagoMedicamentos === 'pendiente' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-700 border-slate-300 hover:border-amber-400'}`}
                    >
                      Medicamentos pendientes
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    PDF: la consulta se mostrará como ingreso fijo de $50.000 y los medicamentos reflejarán si están pagados o pendientes.
                  </p>
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
                <div className="flex-1 bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-xl text-xs font-semibold text-center">
                  📄 El PDF se descargó automáticamente a tu dispositivo
                </div>
                <button
                  onClick={() => router.push('/asistente')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition text-sm"
                >
                  Regresar al Panel
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
