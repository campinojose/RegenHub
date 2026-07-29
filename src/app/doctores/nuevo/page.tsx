'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function CrearDoctorPage() {
  const router = useRouter()
  const supabase = createClient()

  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGuardarDoctor = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.from('doctores').insert([
      {
        nombre_completo: nombre,
      }
    ])

    if (error) {
      alert('Error al guardar doctor: ' + error.message)
    } else {
      alert('Doctor creado exitosamente')
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">Panel de Administración</span>
          <h1 className="text-xl font-bold text-slate-800">Registrar Nuevo Doctor</h1>
        </div>

        <form onSubmit={handleGuardarDoctor} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo del Doctor *</label>
            <input
              type="text"
              required
              placeholder="Ej: Dr. Jose David"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-bold rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition"
            >
              {loading ? 'Guardando...' : 'Guardar Doctor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}