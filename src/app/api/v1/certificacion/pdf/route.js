// GET /api/v1/certificacion/pdf — Generates & downloads official PDF Certificate of Progress
import { getAppState } from '@/lib/db';
import { generateCertificationPdf } from '@/lib/pdfGenerator';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const state = await getAppState();
    const { searchParams } = new URL(request.url);
    const quincena = searchParams.get('quincena') || 'Quincena 1 - Agosto 2026';

    const pdfBuffer = generateCertificationPdf({
      projectName: state.projectConfig?.name || 'Torre Palermo Soho',
      projectCity: `${state.projectConfig?.city || 'CABA'}, ${state.projectConfig?.province || 'Argentina'}`,
      directorName: state.projectConfig?.director?.name || 'Arq. Marcelo Fernández',
      directorRole: state.projectConfig?.director?.role || 'Director de Obra (Mat. CPAU)',
      periodName: quincena,
      overallProgress: parseFloat(state.avancePercentage) || 55.0,
      financialAmount: state.budget?.totalEjecutado || 1950000,
      sha256Signature: state.auditLedger?.[0]?.hash || '8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5be3b0c44298fc1c149afbf4c8996fb924',
      rubros: state.budget?.rubros || []
    });

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Certificado_Avance_ObraSaaS.pdf"',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err) {
    console.error('PDF Generation error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
