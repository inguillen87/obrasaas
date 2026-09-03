// GET /api/v1/audit/pdf — Generates & downloads Executive QA Audit Report PDF for Marcelo Guillen & Arq. Victoria
import { getAppState } from '@/lib/db';
import { generateQAAuditPdf } from '@/lib/pdfGenerator';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await getAppState();

    const pdfBuffer = generateQAAuditPdf({
      directorName: 'Marcelo Guillén',
      techDirectorName: 'Arq. Victoria',
      projectName: state.projectConfig?.name || 'Torre Palermo Soho / ObraSaaS Demo',
      dateStr: new Date().toLocaleDateString('es-AR'),
      sha256Hash: state.auditLedger?.[0]?.hash || 'a4b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8'
    });

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=ObraSaaS_Informe_Auditoria_QA_Victoria_Marcelo.pdf',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err) {
    console.error('Audit PDF error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
