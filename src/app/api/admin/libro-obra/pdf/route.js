// GET /api/admin/libro-obra/pdf — Generates & downloads official Libro de Obra Daily Log PDF
import { getAppState } from '@/lib/db';
import { generateLibroObraPdf } from '@/lib/pdfGenerator';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const state = await getAppState();
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    const entry = (state.libroObra || []).find(e => !dateParam || e.date === dateParam) || {
      date: new Date().toISOString().split('T')[0],
      weather: 'Despejado 21°C - CIRSOC 201 Apto',
      workersPresent: (state.workerRegistry || []).length || 8,
      tasksPerformed: 'Hormigonado de vigas de encadenado y revoque grueso en frente.',
      ordersDelivered: 'Verificar nivelación y estanqueidad de cañerías antes del llenado.',
      signedBy: state.projectConfig?.director?.name || 'Arq. Marcelo',
      hash: state.auditLedger?.[0]?.hash || '8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5b'
    };

    const pdfBuffer = generateLibroObraPdf({
      date: entry.date,
      projectName: state.projectConfig?.name || 'Torre Palermo Soho',
      weather: entry.weather || 'Despejado 21°C',
      workersPresent: entry.workersPresent || 8,
      tasksPerformed: entry.tasksPerformed || 'Trabajos de albañilería general.',
      ordersDelivered: entry.ordersDelivered || 'Controlar uso de EPP y línea de vida.',
      signedBy: entry.signedBy || state.projectConfig?.director?.name || 'Arq. Marcelo',
      hash: entry.hash || '8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5b'
    });

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Libro_de_Obra_${entry.date}.pdf"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err) {
    console.error('Libro de Obra PDF error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
