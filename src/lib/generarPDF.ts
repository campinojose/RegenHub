import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface DatosPDF {
  // Paciente
  pacienteNombre: string
  pacienteCC: string
  pacienteEdad?: string | number
  pacienteSexo?: string
  pacienteDireccion?: string
  pacienteTelefono?: string

  // Profesional / Asistente
  doctorNombre: string
  asistenteNombre: string

  // Signos vitales
  pesoKg?: string | number
  tallaCm?: string | number
  imc?: string | number
  presionArterial?: string

  // Consulta
  motivoConsulta: string
  diagnostico: string

  // Facturación (solo interno — no aparece en PDF)
  valorConsulta: number
  medicamentos: { nombre: string; indicacion: string; precio: number; pagado?: boolean }[]
  estadoPagoMedicamentos: 'pendiente' | 'pagado'
  montoMedicamentos: number
}

type DocumentoConTabla = jsPDF & { lastAutoTable?: { finalY: number } }

function obtenerFinTabla(doc: jsPDF): number {
  return (doc as DocumentoConTabla).lastAutoTable?.finalY ?? 0
}

export function generarPDFConsulta(datos: DatosPDF): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const margen = 20
  const anchoUtil = 210 - margen * 2
  let y = 0

  // ── ENCABEZADO ELEGANTE ──────────────────────────────────────────────────
  // Fondo superior suave
  doc.setFillColor(248, 250, 252) // slate-50
  doc.rect(0, 0, 210, 45, 'F')
  
  // Acento de color (línea superior)
  doc.setFillColor(37, 99, 235) // blue-600
  doc.rect(0, 0, 210, 6, 'F')

  y = 25
  doc.setTextColor(30, 41, 59) // slate-800
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('RECETA MÉDICA', margen, y)
  
  doc.setTextColor(100, 116, 139) // slate-500
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  // Fecha actual formateada
  const ahora = new Date()
  const fechaStr = ahora.toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  doc.text(fechaStr, 210 - margen, y, { align: 'right' })

  y = 55

  // ── INFORMACIÓN DEL PACIENTE ──────────────────────────────────────────────
  doc.setFillColor(241, 245, 249) // slate-100
  doc.roundedRect(margen, y, anchoUtil, 25, 3, 3, 'F')
  
  y += 8
  doc.setTextColor(51, 65, 85) // slate-700
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('PACIENTE', margen + 5, y)
  
  y += 6
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42) // slate-900
  doc.text(datos.pacienteNombre, margen + 5, y)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105) // slate-600
  doc.text(`ID: ${datos.pacienteCC}`, 210 - margen - 5, y, { align: 'right' })
  
  if (datos.pacienteEdad) {
      y += 6
      doc.setFontSize(9)
      doc.text(`Edad: ${datos.pacienteEdad} años`, margen + 5, y)
  }

  y += 20

  // ── MEDICAMENTOS ────────────────────────────────────────────────────────
  const medFiltrados = datos.medicamentos.filter(m => m.nombre.trim() !== '')

  doc.setTextColor(30, 41, 59)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TRATAMIENTO', margen, y)
  y += 5

  if (medFiltrados.length === 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(148, 163, 184) // slate-400
    doc.text('No se recetaron medicamentos en esta consulta.', margen, y + 5)
    y += 15
  } else {
    const medRows = medFiltrados.map((m, i) => [
      { content: `${i + 1}`, styles: { halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235] } },
      { content: m.nombre, styles: { fontStyle: 'bold' } },
      m.indicacion || 'Sin indicaciones especiales',
    ])

    autoTable(doc, {
      startY: y,
      head: [['#', 'Medicamento', 'Posología / Indicaciones']],
      body: medRows,
      margin: { left: margen, right: margen },
      tableWidth: anchoUtil,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: { top: 6, bottom: 6, left: 4, right: 4 },
        textColor: [51, 65, 85], // slate-700
      },
      headStyles: {
        textColor: [100, 116, 139], // slate-500
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
        fillColor: [255,255,255],
      },
      bodyStyles: {
        lineColor: [226, 232, 240], // slate-200
        lineWidth: { bottom: 0.1 },
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 60, textColor: [15, 23, 42] }, // slate-900
        2: { cellWidth: 'auto' },
      },
      didParseCell: function (data) {
          if (data.section === 'head') {
              data.cell.styles.lineWidth = { bottom: 0.5 };
              data.cell.styles.lineColor = [203, 213, 225]; // slate-300
          }
      }
    })

    y = obtenerFinTabla(doc) + 25
  }

  // ── FIRMA ─────────────────────────────────────────────────────────────
  // Si la tabla es muy larga y la firma queda muy abajo, pasamos a nueva página
  if (y > 250) {
      doc.addPage()
      y = margen + 10
  }

  doc.setDrawColor(203, 213, 225) // slate-300
  doc.setLineWidth(0.5)
  doc.line(margen, y, margen + 70, y)
  
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text(datos.doctorNombre, margen, y)
  
  y += 5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('Médico Tratante', margen, y)

  // ── GUARDAR ─────────────────────────────────────────────────────────────
  const fechaDocStr = ahora.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).replace(/\//g, '-')

  const nombreArchivo = `receta_${datos.pacienteCC}_${fechaDocStr}.pdf`
  doc.save(nombreArchivo)
}

