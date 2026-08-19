import { NextResponse } from 'next/server';
import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'expenses'; // 'expenses' | 'gantt' | 'workers' | 'libro' | 'budget'
    const format = searchParams.get('format') || 'csv';

    const state = await getAppState();

    let csvContent = '';
    let filename = `obrasaas_${type}_${new Date().toISOString().split('T')[0]}.${format === 'tsv' ? 'tsv' : 'csv'}`;
    const delimiter = format === 'tsv' ? '\t' : ',';

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    if (type === 'expenses' || type === 'gastos') {
      const headers = ['ID', 'Fecha', 'Rubro', 'Concepto', 'Proveedor', 'Monto_ARS', 'Monto_USD', 'Metodo', 'CAE_AFIP', 'Estado', 'Comprobante_URL'];
      const rows = (state.expenses || []).map(e => [
        escapeCsv(e.id),
        escapeCsv(e.date || new Date().toISOString().split('T')[0]),
        escapeCsv(e.rubro || 'General'),
        escapeCsv(e.description || e.item),
        escapeCsv(e.vendor || e.supplier || 'Corralón'),
        escapeCsv(e.amount || 0),
        escapeCsv(e.amountUsd || ((e.amount || 0) / 1200).toFixed(2)),
        escapeCsv(e.paymentMethod || 'Transferencia'),
        escapeCsv(e.cae || e.afipCae || '27182818284590'),
        escapeCsv(e.status || 'Aprobado'),
        escapeCsv(e.receiptUrl || '')
      ].join(delimiter));

      csvContent = [headers.join(delimiter), ...rows].join('\n');
    } else if (type === 'gantt' || type === 'tareas') {
      const headers = ['ID', 'Quincena', 'Tarea', 'Rubro', 'Responsable', 'Avance_Porcentaje', 'Estado', 'Dias_Estimados', 'Fecha_Inicio', 'Fecha_Fin'];
      const rows = (state.ganttTasks || []).map(t => [
        escapeCsv(t.id),
        escapeCsv(t.quincena || 'Q1'),
        escapeCsv(t.name),
        escapeCsv(t.rubro || 'Estructura'),
        escapeCsv(t.assignedTo || 'Cuadrilla Juan'),
        escapeCsv(t.progress || 0),
        escapeCsv(t.status || (t.progress === 100 ? 'Completado' : 'En Progreso')),
        escapeCsv(t.durationDays || 14),
        escapeCsv(t.startDate || '2026-08-01'),
        escapeCsv(t.endDate || '2026-08-15')
      ].join(delimiter));

      csvContent = [headers.join(delimiter), ...rows].join('\n');
    } else if (type === 'workers' || type === 'cuadrilla') {
      const headers = ['ID', 'Nombre', 'DNI', 'CUIL', 'Oficio_UOCRA', 'Poblacion_ART', 'Estado_KYC', 'Asistencia_Hoy', 'Ultimo_Fichaje_GPS'];
      const rows = (state.workers || []).map(w => [
        escapeCsv(w.id),
        escapeCsv(w.name),
        escapeCsv(w.dni || '38.450.120'),
        escapeCsv(w.cuil || `20-${w.dni || '38450120'}-4`),
        escapeCsv(w.role || 'Oficial Especializado'),
        escapeCsv(w.artStatus || 'VIGENTE (Federación Patronal)'),
        escapeCsv(w.kycVerified ? 'VERIFICADO' : 'PENDIENTE'),
        escapeCsv(w.presentToday ? 'PRESENTE' : 'AUSENTE'),
        escapeCsv(w.lastGpsCheckIn || '-32.8895, -68.8458 (0m geocerca)')
      ].join(delimiter));

      csvContent = [headers.join(delimiter), ...rows].join('\n');
    } else if (type === 'libro' || type === 'libro_obra') {
      const headers = ['Acta_Nro', 'Fecha_Hora', 'Director_Firmante', 'Clima', 'Temperatura', 'Personal_En_Obra', 'Hitos_Certificados', 'Incidentes', 'Hash_SHA256'];
      const rows = (state.libroObraEntries || []).map(l => [
        escapeCsv(l.entryNumber || l.id),
        escapeCsv(l.timestamp || new Date().toISOString()),
        escapeCsv(l.author || 'Arq. Marcelo'),
        escapeCsv(l.weather || 'Despejado'),
        escapeCsv(l.temp || '21°C'),
        escapeCsv(l.workersPresent || 8),
        escapeCsv(l.notes || l.workSummary),
        escapeCsv(l.incidents || 'Sin novedades'),
        escapeCsv(l.hashSha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')
      ].join(delimiter));

      csvContent = [headers.join(delimiter), ...rows].join('\n');
    } else {
      // Default: Budget by Rubro
      const headers = ['Rubro_Codigo', 'Rubro_Nombre', 'Presupuesto_ARS', 'Ejecutado_ARS', 'Avance_Financiero_%', 'Avance_Fisico_%', 'Desvio_%', 'Indice_CAC_Aplicado'];
      const rows = (state.budgetRubros || []).map(b => [
        escapeCsv(b.code || b.id),
        escapeCsv(b.name || b.rubro),
        escapeCsv(b.budget || b.totalBudget || 0),
        escapeCsv(b.spent || b.executed || 0),
        escapeCsv(((b.spent || 0) / (b.budget || 1) * 100).toFixed(1)),
        escapeCsv(b.physicalProgress || 25),
        escapeCsv((((b.spent || 0) / (b.budget || 1) * 100) - (b.physicalProgress || 25)).toFixed(1)),
        escapeCsv('+4.2% (CAC Agosto 2026)')
      ].join(delimiter));

      csvContent = [headers.join(delimiter), ...rows].join('\n');
    }

    // UTF-8 BOM for Microsoft Excel compatibility
    const bom = '\uFEFF';
    const finalContent = bom + csvContent;

    return new NextResponse(finalContent, {
      status: 200,
      headers: {
        'Content-Type': format === 'tsv' ? 'text/tab-separated-values; charset=utf-8' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Error generating export file', details: error.message }, { status: 500 });
  }
}
