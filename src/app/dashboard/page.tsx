'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Doctor, Paciente } from '@/lib/types'

const DOCTORES_FIJOS: Doctor[] = [
    { id: 'a142aea4-d90f-469f-9ff2-d56d057676cb', nombre_completo: 'Clemente Herrera' },
    { id: 'a5f41fcf-5950-4b29-aad1-ded22f57ccf2', nombre_completo: 'Andrés Herrera' },
    { id: 'c2cde56e-7fae-4ac4-b352-f3506c78137d', nombre_completo: 'Rosa Castaño' },
    { id: 'f8c7116d-1c8b-4d2f-927c-0d48296f2dfd', nombre_completo: 'Carolina Herrera' },
]

function crearRutaDocumento(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    return `pacientes/${crypto.randomUUID()}.${extension}`
}

export default function DashboardPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    const [usuario, setUsuario] = useState<{ email?: string | null } | null>(null)
    const [doctores, setDoctores] = useState<Doctor[]>(DOCTORES_FIJOS)
    const [pacientes, setPacientes] = useState<Paciente[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [loading, setLoading] = useState(true)

    // Obtener la fecha de hoy en formato YYYY-MM-DD local
    const obtenerFechaHoy = () => {
        const hoy = new Date()
        const yyyy = hoy.getFullYear()
        const mm = String(hoy.getMonth() + 1).padStart(2, '0')
        const dd = String(hoy.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
    }

    // Estado del modal de registro de paciente con todos sus campos
    const [modalAbierto, setModalAbierto] = useState(false)
    const [nombre, setNombre] = useState('')
    const [documento, setDocumento] = useState('')
    const [fotoDocumento, setFotoDocumento] = useState<File | null>(null)
    const [created_at, setcreated_at] = useState(obtenerFechaHoy())
    const [edad, setEdad] = useState('')
    const [sexo, setSexo] = useState('Masculino')
    const [doctorElegidoId, setDoctorElegidoId] = useState('')
    const [direccion, setDireccion] = useState('')
    const [barrio, setBarrio] = useState('')
    const [telefono, setTelefono] = useState('')
    const [email, setEmail] = useState('')
    const [guardandoPaciente, setGuardandoPaciente] = useState(false)
    const [eliminandoPacienteId, setEliminandoPacienteId] = useState<string | null>(null)

    const cargarPacientes = useCallback(async () => {
        const { data, error } = await supabase
            .from('pacientes')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error al cargar pacientes:', error)
            return
        }
        setPacientes((data || []) as Paciente[])
    }, [supabase])

    const cargarDoctores = useCallback(async () => {
        const { data, error } = await supabase
            .from('doctores')
            .select('id, nombre_completo')
            .in('id', DOCTORES_FIJOS.map((doctor) => doctor.id))
            .order('nombre_completo', { ascending: true })

        if (error) {
            console.error('Error al cargar doctores:', error)
            return
        }

        const doctoresPorId = new Map((data || []).map((doctor) => [doctor.id, doctor] as const))
        const lista = DOCTORES_FIJOS.map((doctor) => (doctoresPorId.get(doctor.id) || doctor) as Doctor)
        setDoctores(lista)
        setDoctorElegidoId((actual) => actual || lista[0]?.id || '')
    }, [supabase])

    useEffect(() => {
        async function inicializar() {
            setLoading(true)

            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError || !user) {
                router.push('/login')
                return
            }
            setUsuario(user)

            await cargarDoctores()
            await cargarPacientes()
            setLoading(false)
        }

        inicializar()
    }, [cargarPacientes, router, supabase])

    const handleRegistrarPaciente = async (e: React.FormEvent) => {
        e.preventDefault()

        const nombreLimpio = nombre.trim()
        if (nombreLimpio.length < 3) {
            alert('El nombre completo debe tener al menos 3 caracteres.')
            return
        }

        const edadNumerica = Number(edad)
        if (!Number.isInteger(edadNumerica) || edadNumerica < 1 || edadNumerica > 105) {
            alert('La edad debe ser un número entero entre 1 y 105 años.')
            return
        }
        setGuardandoPaciente(true)

        let urlFoto = null

        // 1. Subir la foto del documento si se adjuntó
        if (fotoDocumento) {
            if (!fotoDocumento.type.startsWith('image/') || fotoDocumento.size > 5 * 1024 * 1024) {
                alert('La cédula debe ser una imagen de máximo 5 MB.')
                setGuardandoPaciente(false)
                return
            }
            const filePath = crearRutaDocumento(fotoDocumento)

            const { error: uploadError } = await supabase.storage
                .from('cedulas-pacientes')
                .upload(filePath, fotoDocumento)

            if (uploadError) {
                console.error('Error al subir la imagen:', uploadError)
            } else {
                urlFoto = filePath
            }
        }

        // 2. Insertar paciente con la información completa
        const { data, error } = await supabase.from('pacientes').insert([
            {
                nombre_completo: nombreLimpio,
                documento_identidad: documento || null,
                foto_cedula_frente: urlFoto,
                fecha_registro: created_at || null,
                id_doctor_elegido: doctorElegidoId || null,
                edad: edadNumerica,
                sexo: sexo,
                direccion: direccion || null,
                barrio: barrio || null,
                telefono: telefono || null,
                email: email || null,
            }
        ]).select('id').single()

        if (error) {
            alert('Error al registrar paciente: ' + error.message)
        } else {
            alert('Paciente registrado con éxito')
            limpiarFormulario()
            setModalAbierto(false)
            const pacienteId = typeof data?.id === 'string' ? data.id.trim() : ''
            if (pacienteId) {
                router.push(`/pacientes/${encodeURIComponent(pacienteId)}`)
            } else {
                cargarPacientes()
            }
        }
        setGuardandoPaciente(false)
    }

    const limpiarFormulario = () => {
        setNombre('')
        setDocumento('')
        setFotoDocumento(null)
        setcreated_at(obtenerFechaHoy())
        setEdad('')
        setSexo('Masculino')
        setDoctorElegidoId((actual) => actual || doctores[0]?.id || DOCTORES_FIJOS[0]?.id || '')
        setDireccion('')
        setBarrio('')
        setTelefono('')
        setEmail('')
    }

    const pacientesFiltrados = pacientes.filter(p =>
        p.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.documento_identidad?.includes(busqueda)
    )

    const handleCerrarSesion = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const handleEliminarPaciente = async (paciente: Paciente) => {
        const confirmado = window.confirm(
            `Eliminar a ${paciente.nombre_completo}? Esta acción eliminará también sus consultas y no se puede deshacer.`
        )
        if (!confirmado) return

        setEliminandoPacienteId(paciente.id)
        const { error } = await supabase.from('pacientes').delete().eq('id', paciente.id)

        if (error) {
            alert(`No se pudo eliminar el paciente: ${error.message}`)
            setEliminandoPacienteId(null)
            return
        }

        if (paciente.foto_cedula_frente) {
            const { error: storageError } = await supabase.storage
                .from('cedulas-pacientes')
                .remove([paciente.foto_cedula_frente])
            if (storageError) console.error('No se pudo eliminar la cédula:', storageError)
        }

        setPacientes((actuales) => actuales.filter((actual) => actual.id !== paciente.id))
        setEliminandoPacienteId(null)
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
                        +
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 leading-none">Panel Médico y Consultorio</h1>
                        <span className="text-xs text-slate-500">
                            Usuario: <strong className="text-slate-700">{usuario?.email || 'Administrador'}</strong>
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/recepcionista/ingresos')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition"
                    >
                        📊 Ver Ingresos
                    </button>
                    <button
                        onClick={() => setModalAbierto(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition"
                    >
                        + Registrar Paciente
                    </button>
                    <button
                        onClick={handleCerrarSesion}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </header>

            {/* CONTENIDO PRINCIPAL */}
            <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* COLUMNA IZQUIERDA: PACIENTES */}
                <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-140px)]">
                    <h2 className="font-bold text-slate-800 text-base mb-3">Pacientes Registrados</h2>

                    <input
                        type="text"
                        placeholder="🔍 Buscar por nombre o cédula..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 mb-4 outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    />

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {loading ? (
                            <p className="text-xs text-slate-400 text-center py-4">Cargando pacientes...</p>
                        ) : pacientesFiltrados.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No se encontraron pacientes.</p>
                        ) : (
                            pacientesFiltrados.map((paciente) => (
                                <div
                                    key={paciente.id}
                                    onClick={() => router.push(`/pacientes/${paciente.id}`)}
                                    className="p-3 border border-slate-100 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition flex justify-between items-center"
                                >
                                    <div>
                                        <h3 className="font-bold text-xs text-slate-800">{paciente.nombre_completo}</h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            C.C. {paciente.documento_identidad || 'S/N'} {paciente.telefono ? `| Tel: ${paciente.telefono}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                            {paciente.sexo || 'N/A'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(evento) => {
                                                evento.stopPropagation()
                                                handleEliminarPaciente(paciente)
                                            }}
                                            disabled={eliminandoPacienteId === paciente.id}
                                            className="text-[10px] font-bold text-red-600 hover:text-red-700 disabled:text-slate-400"
                                            aria-label={`Eliminar a ${paciente.nombre_completo}`}
                                        >
                                            {eliminandoPacienteId === paciente.id ? 'Eliminando…' : 'Eliminar'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* COLUMNA DERECHA */}
                <section className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl mb-2">
                        📋
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                        Selecciona un paciente de la lista de la izquierda para ver su historia médica.
                    </p>
                </section>
            </main>

            {/* MODAL COMPLETO DE REGISTRO DE PACIENTE */}
            {modalAbierto && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-2xl p-6 shadow-xl max-w-xl w-full my-8 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-800">Registrar Nuevo Paciente</h3>
                            <p className="text-xs text-slate-500">Ingresa la información personal del paciente.</p>
                        </div>

                        <form onSubmit={handleRegistrarPaciente} className="space-y-4">

                            {/* NOMBRE COMPLETO */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: María Rodríguez Castano"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                />
                            </div>

                            {/* DOCUMENTO Y FOTO DELANTERA */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Documento de Identidad (C.C.) *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: 1104821170"
                                        value={documento}
                                        onChange={(e) => setDocumento(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Foto Delantera del Documento</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setFotoDocumento(e.target.files?.[0] || null)}
                                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                </div>
                            </div>

                            {/* FECHA PRIMERA CONSULTA, EDAD Y SEXO */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Primera Consulta</label>
                                    <input
                                        type="date"
                                        value={created_at}
                                        onChange={(e) => setcreated_at(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Edad</label>
                                    <input
                                        type="number"
                                        placeholder="Años"
                                        required
                                        min="1"
                                        max="105"
                                        step="1"
                                        value={edad}
                                        onChange={(e) => setEdad(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Sexo / Género</label>
                                    <select
                                        value={sexo}
                                        onChange={(e) => setSexo(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    >
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                    </select>
                                </div>
                            </div>

                            {/* DIRECCIÓN Y Barrio */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Dirección de Residencia</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Calle 10 # 4-20"
                                        value={direccion}
                                        onChange={(e) => setDireccion(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Barrio</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Ciudad 2000 / Calipso"
                                        value={barrio}
                                        onChange={(e) => setBarrio(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>

                                
                            </div>

                            {/* TELÉFONO Y EMAIL */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 30022768456"
                                        value={telefono}
                                        onChange={(e) => setTelefono(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                                    <input
                                        type="email"
                                        placeholder="paciente@ejemplo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>
                            </div>

                            {/* Profesional elegido */}
                            <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Profesional Elegido *</label>
                                    <select
                                        required
                                        value={doctorElegidoId}
                                        onChange={(e) => setDoctorElegidoId(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    >
                                        {doctores.length === 0 ? (
                                            <option value="">No hay doctores registrados</option>
                                        ) : (
                                            doctores.map((doctor) => (
                                                <option key={doctor.id} value={doctor.id}>
                                                    {doctor.nombre_completo}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="flex gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        limpiarFormulario()
                                        setModalAbierto(false)
                                    }}
                                    className="flex-1 py-2.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardandoPaciente}
                                    className="flex-1 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
                                >
                                    {guardandoPaciente ? 'Guardando Paciente...' : 'Guardar Paciente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
