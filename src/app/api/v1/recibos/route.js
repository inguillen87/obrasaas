import { getAppState, saveAppState } from '@/lib/db';
import { generateWebviewToken } from '@/lib/auth';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

// GET /api/v1/recibos — List of quincenal payslips with digital signatures
export async function GET() {
    try {
        const state = await getAppState();
        const workers = state.workerRegistry || [
            { id: 'juan', name: 'Juan Zapata', role: 'Oficial Armador', trade: 'Armador', dni: '38.452.190', phone: '+5491138452190' },
            { id: 'carlos', name: 'Carlos Gómez', role: 'Oficial Albañil', trade: 'Albañilería', dni: '35.120.441', phone: '+5491135120441' },
            { id: 'luis', name: 'Luis Martínez', role: 'Medio Oficial Plomero', trade: 'Instalaciones', dni: '40.892.110', phone: '+5491140892110' },
            { id: 'marcelo', name: 'Marcelo Rodríguez', role: 'Capataz General', trade: 'Supervisión', dni: '28.331.002', phone: '+5492613168608' }
        ];

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://obrasaas.vercel.app';
        const receipts = workers.map((w, idx) => {
            const isSigned = idx === 0; // First worker signed for demonstration
            const shortId = w.id || w.name.toLowerCase().split(' ')[0];
            const token = generateWebviewToken(shortId);

            return {
                id: `rec-${w.dni || idx}`,
                workerId: shortId,
                workerName: w.name,
                role: w.role || w.trade,
                dni: w.dni || '38.000.000',
                phone: w.phone,
                period: '1ra Quincena — Agosto 2026',
                convenio: 'UOCRA CCT 76/75',
                sueldoBruto: 513830,
                descuentos: 161590,
                sueldoNeto: 352240,
                status: isSigned ? 'FIRMADO' : 'PENDIENTE_FIRMA',
                signedAt: isSigned ? '2026-08-20 14:32:10' : null,
                signatureHash: isSigned ? 'SHA256:7f8a9b2c3d4e5f6a1b2c3d4e5f6a7b8c' : null,
                signUrl: `${appUrl}/webview/recibos?worker=${shortId}&token=${token}`
            };
        });

        return Response.json({
            success: true,
            total: receipts.length,
            signedCount: receipts.filter(r => r.status === 'FIRMADO').length,
            pendingCount: receipts.filter(r => r.status === 'PENDIENTE_FIRMA').length,
            period: '1ra Quincena — Agosto 2026',
            receipts
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/recibos — Sign or update payslip record
export async function POST(request) {
    try {
        const body = await request.json();
        const { workerId, signatureData, signatureHash } = body;

        const state = await getAppState();
        state.workerReceipts = state.workerReceipts || {};
        state.workerReceipts[workerId] = {
            workerId,
            signedAt: new Date().toISOString(),
            signatureHash: signatureHash || 'SHA256:' + Date.now(),
            status: 'FIRMADO'
        };

        state.auditLedger = appendAuditTransaction(state.auditLedger, {
            action: 'FIRMA_RECIBO_UOCRA',
            actor: workerId,
            details: { hash: signatureHash }
        });

        await saveAppState(state);

        return Response.json({ success: true, status: 'FIRMADO', workerId });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
