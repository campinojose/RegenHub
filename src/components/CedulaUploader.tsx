'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Props {
  label: string
  onUploadComplete: (url: string) => void
}

export default function CedulaUploader({ label, onUploadComplete }: Props) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const supabase = createClient()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    setUploading(true)

    try {
      // 1. Subir archivo al bucket privado 'cedulas-pacientes'
      const { error: uploadError } = await supabase.storage
        .from('cedulas-pacientes')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. Guardar la ruta del archivo
      onUploadComplete(filePath)

      // 3. Crear vista previa local
      setPreview(URL.createObjectURL(file))
    } catch (error) {
      alert('Error subiendo la imagen de la cédula')
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      
      <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center bg-slate-50 hover:bg-blue-50/30 transition cursor-pointer flex flex-col items-center justify-center min-h-[130px]">
        {preview ? (
          <img src={preview} alt="Vista previa cédula" className="h-24 object-cover rounded-lg shadow-sm" />
        ) : (
          <div className="flex flex-col items-center text-slate-500">
            <svg className="w-8 h-8 mb-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h0.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-medium">
              {uploading ? 'Subiendo...' : 'Tomar foto o subir archivo'}
            </span>
          </div>
        )}
        
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          disabled={uploading}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>
    </div>
  )
}