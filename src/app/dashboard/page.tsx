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
    const [perfil, setPerfil] = useState<any>(null)
    const [doctorRestringidoId, setDoctorRestringidoId] = useState<string | null>(null)

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

    const cargarPacientes = useCallback(async (doctorId?: string | null) => {
        let query = supabase
            .from('pacientes')
            .select('*')
            .order('created_at', { ascending: false })

        if (doctorId) {
            query = query.eq('id_doctor_elegido', doctorId)
        }

        const { data, error } = await query

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

            const { data: perfilData } = await supabase
                .from('perfiles_usuario')
                .select('*')
                .eq('id', user.id)
                .single()
            setPerfil(perfilData)

            let restrictedDoctorId = null
            if (perfilData && perfilData.nombre_completo) {
                const nombreLower = perfilData.nombre_completo.toLowerCase()
                if (nombreLower.includes('clemente') || nombreLower.includes('rosa') || 
                    nombreLower.includes('andrés') || nombreLower.includes('andres') || 
                    nombreLower.includes('carolina')) {
                    const df = DOCTORES_FIJOS.find(d => nombreLower.includes(d.nombre_completo.split(' ')[0].toLowerCase()))
                    if (df) restrictedDoctorId = df.id
                }
            }
            setDoctorRestringidoId(restrictedDoctorId)

            await cargarDoctores()
            await cargarPacientes(restrictedDoctorId)
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
                cargarPacientes(doctorRestringidoId)
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


    return (
        <div className="min-h-screen bg-surface-50 flex flex-col">
            {/* HEADER */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none">RegenHub</h1>
                        <span className="text-xs text-slate-500 font-medium">
                            Conectado como <strong className="text-brand-700">{usuario?.email || 'Administrador'}</strong>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/recepcionista/ingresos')}
                        className="btn-secondary text-brand-700 border-brand-200 hover:bg-brand-50 hover:border-brand-300"
                    >
                        📊 Ingresos
                    </button>
                    {!doctorRestringidoId && (
                        <button
                            onClick={() => setModalAbierto(true)}
                            className="btn-primary"
                        >
                            + Nuevo Paciente
                        </button>
                    )}
                    <button
                        onClick={handleCerrarSesion}
                        className="btn-secondary text-slate-500"
                    >
                        Salir
                    </button>
                </div>
            </header>

            {/* CONTENIDO PRINCIPAL */}
            <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* COLUMNA IZQUIERDA: PACIENTES */}
                <section className="glass-card p-5 h-[calc(100vh-140px)] flex flex-col">
                    <h2 className="font-bold text-slate-900 text-lg mb-4 tracking-tight">Pacientes</h2>

                    <div className="relative mb-4">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o cédula..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="input-premium pl-9"
                        />
                    </div>

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
                                    className="p-3.5 bg-white border border-slate-100 rounded-xl hover:border-brand-200 hover:bg-brand-50/30 hover:shadow-sm cursor-pointer transition-all flex justify-between items-center group"
                                >
                                    <div>
                                        <h3 className="font-semibold text-sm text-slate-800 group-hover:text-brand-800 transition-colors">{paciente.nombre_completo}</h3>
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                                            <span>CC {paciente.documento_identidad || 'S/N'}</span>
                                            {paciente.telefono && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span>{paciente.telefono}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                            {paciente.sexo || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* COLUMNA DERECHA */}
                <section className="md:col-span-2 glass-card p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm">
                        📋
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">Historia Médica</h3>
                    <p className="text-sm font-medium text-slate-500 max-w-sm">
                        Selecciona un paciente del listado para ver sus consultas, diagnósticos e información general.
                    </p>
                </section>
            </main>

            {/* MODAL COMPLETO DE REGISTRO DE PACIENTE */}
            {modalAbierto && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-floating max-w-xl w-full my-8 space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200/50">
                        <div className="border-b border-slate-100 pb-4 mb-2">
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Registrar Nuevo Paciente</h3>
                            <p className="text-sm font-medium text-slate-500 mt-1">Ingresa la información personal y de contacto.</p>
                        </div>

                        <form onSubmit={handleRegistrarPaciente} className="space-y-5">

                            {/* NOMBRE COMPLETO */}
                            <div>
                                <label className="label-premium">Nombre Completo *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: María Rodríguez"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                    className="input-premium"
                                />
                            </div>

                            {/* DOCUMENTO Y FOTO DELANTERA */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label-premium">Documento (C.C.) *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: 1104821170"
                                        value={documento}
                                        onChange={(e) => setDocumento(e.target.value)}
                                        className="input-premium"
                                    />
                                </div>

                                <div>
                                    <label className="label-premium">Foto Delantera del Documento</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setFotoDocumento(e.target.files?.[0] || null)}
                                        className="w-full text-sm text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* FECHA PRIMERA CONSULTA, EDAD Y SEXO */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="label-premium">Fecha Ingreso</label>
                                    <input
                                        type="date"
                                        value={created_at}
                                        onChange={(e) => setcreated_at(e.target.value)}
                                        className="input-premium"
                                    />
                                </div>
                                <div>
                                    <label className="label-premium">Edad</label>
                                    <input
                                        type="number"
                                        placeholder="Años"
                                        required
                                        min="1"
                                        max="105"
                                        step="1"
                                        value={edad}
                                        onChange={(e) => setEdad(e.target.value)}
                                        className="input-premium"
                                    />
                                </div>
                                <div>
                                    <label className="label-premium">Sexo</label>
                                    <select
                                        value={sexo}
                                        onChange={(e) => setSexo(e.target.value)}
                                        className="input-premium"
                                    >
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                    </select>
                                </div>
                            </div>

                            {/* DIRECCIÓN Y Barrio */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label-premium">Dirección</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Calle 10 # 4-20"
                                        value={direccion}
                                        onChange={(e) => setDireccion(e.target.value)}
                                        className="input-premium"
                                    />
                                </div>

                                <div>
                                    <label className="label-premium">Barrio</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Ciudad 2000"
                                        value={barrio}
                                        onChange={(e) => setBarrio(e.target.value)}
                                        className="input-premium"
                                    />
                                </div>
                            </div>

                            {/* TELÉFONO Y EMAIL */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="label-premium">WhatsApp</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 3002276845"
                                        value={telefono}
                                        onChange={(e) => setTelefono(e.target.value)}
                                        className="input-premium"
                                    />
                                </div>

                                <div>
                                    <label className="label-premium">Email</label>
                                    <input
                                        type="email"
                                        placeholder="paciente@ejemplo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input-premium"
                                    />
                                </div>
                            </div>

                            {/* Profesional elegido */}
                            <div>
                                <label className="label-premium">Profesional Asignado *</label>
                                <select
                                    required
                                    value={doctorElegidoId}
                                    onChange={(e) => setDoctorElegidoId(e.target.value)}
                                    className="input-premium"
                                >
                                    {doctores.length === 0 ? (
                                        <option value="">No hay doctores registrados</option>
                                    ) : (
                                        doctores.map((doctor) => (
                                            <option key={doctor.id} value={doctor.id}>
                                                Dr(a). {doctor.nombre_completo}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="flex gap-3 pt-5 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        limpiarFormulario()
                                        setModalAbierto(false)
                                    }}
                                    className="btn-secondary flex-1"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardandoPaciente}
                                    className="btn-primary flex-1"
                                >
                                    {guardandoPaciente ? 'Guardando...' : 'Guardar Paciente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
