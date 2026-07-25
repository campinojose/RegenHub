'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function DashboardPage() {
    const router = useRouter()
    const supabase = createClient()

    const [usuario, setUsuario] = useState<any>(null)
    const [pacientes, setPacientes] = useState<any[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [loading, setLoading] = useState(true)

    // Estado del modal de registro de paciente con todos sus campos
    const [modalAbierto, setModalAbierto] = useState(false)
    const [nombre, setNombre] = useState('')
    const [documento, setDocumento] = useState('')
    const [fotoDocumento, setFotoDocumento] = useState<File | null>(null)
    const [fechaNacimiento, setFechaNacimiento] = useState('')
    const [edad, setEdad] = useState('')
    const [sexo, setSexo] = useState('Masculino')
    const [direccion, setDireccion] = useState('')
    const [ciudad, setCiudad] = useState('')
    const [telefono, setTelefono] = useState('')
    const [email, setEmail] = useState('')
    const [guardandoPaciente, setGuardandoPaciente] = useState(false)

    useEffect(() => {
        async function inicializar() {
            setLoading(true)

            const { data: { user }, error: authError } = await supabase.auth.getUser()
            if (authError || !user) {
                router.push('/login')
                return
            }
            setUsuario(user)

            await cargarPacientes()
            setLoading(false)
        }

        inicializar()
    }, [])

    const cargarPacientes = async () => {
        const { data, error } = await supabase
            .from('pacientes')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error al cargar pacientes:', error)
        } else {
            setPacientes(data || [])
        }
    }

    // Calcular edad automáticamente al seleccionar fecha de nacimiento
    const handleFechaNacimientoChange = (fechaStr: string) => {
        setFechaNacimiento(fechaStr)
        if (fechaStr) {
            const hoy = new Date()
            const fechaNac = new Date(fechaStr)
            let edadCalculada = hoy.getFullYear() - fechaNac.getFullYear()
            const mes = hoy.getMonth() - fechaNac.getMonth()
            if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
                edadCalculada--
            }
            setEdad(edadCalculada.toString())
        }
    }

    const handleRegistrarPaciente = async (e: React.FormEvent) => {
        e.preventDefault()
        setGuardandoPaciente(true)

        let urlFoto = null

        // 1. Subir la foto del documento si se adjuntó
        if (fotoDocumento) {
            const fileExt = fotoDocumento.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `pacientes/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('documentos')
                .upload(filePath, fotoDocumento)

            if (uploadError) {
                console.error('Error al subir la imagen:', uploadError)
            } else {
                const { data: publicUrlData } = supabase.storage
                    .from('documentos')
                    .getPublicUrl(filePath)

                urlFoto = publicUrlData.publicUrl
            }
        }

        // 2. Insertar paciente con la información completa
        const { error } = await supabase.from('pacientes').insert([
            {
                nombre_completo: nombre,
                documento_identidad: documento || null,
                foto_documento_url: urlFoto,
                fecha_nacimiento: fechaNacimiento || null,
                edad: edad ? parseInt(edad) : null,
                genero: sexo, // O el nombre exacto de la columna en tu BD (genero/sexo)
                sexo: sexo,
                direccion: direccion || null,
                ciudad: ciudad || null,
                telefono: telefono || null,
                email: email || null,
            }
        ])

        if (error) {
            alert('Error al registrar paciente: ' + error.message)
        } else {
            alert('Paciente registrado con éxito')
            limpiarFormulario()
            setModalAbierto(false)
            cargarPacientes()
        }
        setGuardandoPaciente(false)
    }

    const limpiarFormulario = () => {
        setNombre('')
        setDocumento('')
        setFotoDocumento(null)
        setFechaNacimiento('')
        setEdad('')
        setSexo('Masculino')
        setDireccion('')
        setCiudad('')
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
                        className="w-full px-3 py-2 border rounded-xl text-xs bg-slate-50 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
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
                                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                        {paciente.sexo || paciente.genero || 'N/A'}
                                    </span>
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

                            {/* FECHA NACIMIENTO, EDAD Y SEXO */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Nacimiento</label>
                                    <input
                                        type="date"
                                        value={fechaNacimiento}
                                        onChange={(e) => handleFechaNacimientoChange(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Edad</label>
                                    <input
                                        type="number"
                                        placeholder="Años"
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
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>

                            {/* DIRECCIÓN Y CIUDAD */}
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
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Ciudad</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Cali / Bogotá"
                                        value={ciudad}
                                        onChange={(e) => setCiudad(e.target.value)}
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