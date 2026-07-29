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

  // Facturación
  valorConsulta: number
  medicamentos: { nombre: string; indicacion: string; precio: number }[]
  estadoPagoMedicamentos: 'pendiente' | 'pagado'
  montoMedicamentos: number
}

type DocumentoConTabla = jsPDF & { lastAutoTable?: { finalY: number } }

function obtenerFinTabla(doc: jsPDF): number {
  return (doc as DocumentoConTabla).lastAutoTable?.finalY ?? 0
}

export function generarPDFConsulta(datos: DatosPDF): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const ahora = new Date()
  const fechaStr = ahora.toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
  const horaStr = ahora.toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit'
  })

  const margen = 15
  const anchoUtil = 210 - margen * 2
  let y = 20

  // ── ENCABEZADO ──────────────────────────────────────────────────────────
  doc.setFillColor(37, 99, 235) // azul
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('RegenHub — Medicina Regenerativa', margen, 13)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha: ${fechaStr}   Hora: ${horaStr}`, margen, 21)
  doc.text('HISTORIA CLÍNICA Y FACTURA DE ATENCIÓN', 210 - margen, 21, { align: 'right' })

  y = 36
  doc.setTextColor(30, 30, 30)

  // ── DATOS DEL PACIENTE ─────────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(241, 245, 249)
  doc.rect(margen, y - 4, anchoUtil, 6, 'F')
  doc.text('DATOS DEL PACIENTE', margen + 2, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const col1x = margen
  const col2x = margen + anchoUtil / 2

  doc.text(`Nombre: ${datos.pacienteNombre}`, col1x, y)
  doc.text(`CC: ${datos.pacienteCC}`, col2x, y); y += 5
  doc.text(`Edad: ${datos.pacienteEdad ?? 'N/A'} años`, col1x, y)
  doc.text(`Sexo: ${datos.pacienteSexo ?? 'N/A'}`, col2x, y); y += 5
  doc.text(`Dirección: ${datos.pacienteDireccion ?? 'N/A'}`, col1x, y)
  doc.text(`Teléfono: ${datos.pacienteTelefono ?? 'N/A'}`, col2x, y); y += 8

  // ── PROFESIONAL Y ASISTENTE ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(241, 245, 249)
  doc.rect(margen, y - 4, anchoUtil, 6, 'F')
  doc.text('PROFESIONAL Y ASISTENTE', margen + 2, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.text(`Profesional que atendió: ${datos.doctorNombre}`, col1x, y)
  doc.text(`Registrado por: ${datos.asistenteNombre}`, col2x, y); y += 8

  // ── SIGNOS VITALES ────────────────────────────────────────────────────
  const tieneSignos = datos.pesoKg || datos.tallaCm || datos.presionArterial
  if (tieneSignos) {
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(241, 245, 249)
    doc.rect(margen, y - 4, anchoUtil, 6, 'F')
    doc.text('SIGNOS VITALES', margen + 2, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    const signosData = [
      ['Peso', datos.pesoKg ? `${datos.pesoKg} kg` : '-'],
      ['Talla', datos.tallaCm ? `${datos.tallaCm} cm` : '-'],
      ['IMC', datos.imc ? String(datos.imc) : '-'],
      ['Presión Arterial', datos.presionArterial || '-'],
    ]

    autoTable(doc, {
      startY: y,
      head: [['Parámetro', 'Valor']],
      body: signosData,
      margin: { left: margen },
      tableWidth: anchoUtil,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 'auto' } }
    })
    y = obtenerFinTabla(doc) + 6
  }

  // ── DIAGNÓSTICO ───────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(241, 245, 249)
  doc.rect(margen, y - 4, anchoUtil, 6, 'F')
  doc.text('MOTIVO Y DIAGNÓSTICO', margen + 2, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  const motivoLineas = doc.splitTextToSize(`Motivo: ${datos.motivoConsulta}`, anchoUtil)
  doc.text(motivoLineas, margen, y)
  y += motivoLineas.length * 4 + 2

  if (datos.diagnostico) {
    const diagLineas = doc.splitTextToSize(`Diagnóstico: ${datos.diagnostico}`, anchoUtil)
    doc.text(diagLineas, margen, y)
    y += diagLineas.length * 4 + 4
  } else {
    y += 4
  }

  // ── MEDICAMENTOS ──────────────────────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(241, 245, 249)
  doc.rect(margen, y - 4, anchoUtil, 6, 'F')
  doc.text('RECETA MÉDICA Y MEDICAMENTOS', margen + 2, y)
  y += 4

  const medRows = datos.medicamentos.length > 0
    ? datos.medicamentos.map((m, i) => [
        `${i + 1}. ${m.nombre}`,
        m.indicacion || 'Sin indicación',
        `$ ${m.precio.toLocaleString()} COP`
      ])
    : [['Sin medicamentos recetados', '', '']]

  autoTable(doc, {
    startY: y,
    head: [['Medicamento', 'Indicación', 'Precio']],
    body: medRows,
    margin: { left: margen },
    tableWidth: anchoUtil,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 35, halign: 'right' } }
  })
  y = obtenerFinTabla(doc) + 6

  // ── FACTURA ───────────────────────────────────────────────────────────
  const totalMedicamentos = datos.montoMedicamentos || datos.medicamentos.reduce((acc, m) => acc + m.precio, 0)
  const totalFactura = datos.valorConsulta + totalMedicamentos
  const montoPagado = datos.valorConsulta + (datos.estadoPagoMedicamentos === 'pagado' ? totalMedicamentos : 0)
  const saldoPendiente = Math.max(totalFactura - montoPagado, 0)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(241, 245, 249)
  doc.rect(margen, y - 4, anchoUtil, 6, 'F')
  doc.text('RESUMEN DE FACTURA', margen + 2, y)
  y += 4

  autoTable(doc, {
    startY: y,
    body: [
      ['Valor consulta:', `$ ${datos.valorConsulta.toLocaleString()} COP`],
      ['Total medicamentos:', `$ ${totalMedicamentos.toLocaleString()} COP`],
      ['TOTAL FACTURADO:', `$ ${totalFactura.toLocaleString()} COP`],
      ['Ingreso por consulta:', `$ ${datos.valorConsulta.toLocaleString()} COP`],
      ['Medicamentos pagados:', `$ ${(datos.estadoPagoMedicamentos === 'pagado' ? totalMedicamentos : 0).toLocaleString()} COP`],
      ['Saldo pendiente medicamentos:', `$ ${saldoPendiente.toLocaleString()} COP`],
      ['Estado de medicamentos:', datos.estadoPagoMedicamentos === 'pagado' ? '✓ PAGADOS' : '⏳ PENDIENTES'],
    ],
    margin: { left: margen + anchoUtil * 0.4 },
    tableWidth: anchoUtil * 0.6,
    styles: { fontSize: 9, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    bodyStyles: { lineColor: [203, 213, 225], lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { halign: 'right', cellWidth: 'auto' }
    },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [37, 99, 235]
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
      }
    }
  })
  y = obtenerFinTabla(doc) + 12

  // ── PIE DE PÁGINA ─────────────────────────────────────────────────────
  doc.setDrawColor(203, 213, 225)
  doc.line(margen, y, margen + 70, y)
  y += 4
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Firma: ${datos.doctorNombre}`, margen, y)
  doc.text('Documento generado digitalmente por RegenHub', 210 - margen, y, { align: 'right' })

  // ── GUARDAR ───────────────────────────────────────────────────────────
  const nombreArchivo = `consulta_${datos.pacienteCC}_${fechaStr.replace(/\//g, '-')}.pdf`
  doc.save(nombreArchivo)
}
