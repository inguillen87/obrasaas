import { getAppState, saveAppState } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsappNotifications';
import { buildActionButtonsMessage } from '@/lib/metaTemplates';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// GET /api/v1/materiales — List material requests with optional filters
export async function GET(request) {
    try {
        const state = await getAppState();
        const { searchParams } = new URL(request.url);
        const estado = searchParams.get('estado');
        const urgencia = searchParams.get('urgencia');

        let requests = state.materialRequests || [];

        if (estado && estado !== 'ALL') {
            requests = requests.filter(r => r.estado === estado);
        }
        if (urgencia && urgencia !== 'ALL') {
            requests = requests.filter(r => r.urgencia === urgencia);
        }

        const allReqs = state.materialRequests || [];
        const stats = {
            total: allReqs.length,
            pendientes: allReqs.filter(r => r.estado === 'pendiente_aprobacion').length,
            aprobadas: allReqs.filter(r => r.estado === 'aprobada').length,
            despachadas: allReqs.filter(r => r.estado === 'despachada').length,
            rechazadas: allReqs.filter(r => r.estado === 'rechazada').length,
            urgentesAlta: allReqs.filter(r => r.urgencia === 'alta' && r.estado === 'pendiente_aprobacion').length
        };

        // Calculate budget impact
        const budget = state.budget || { rubros: [] };
        const totalPresupuesto = (budget.rubros || []).reduce((sum, r) => sum + (r.presupuesto || 0), 0);
        const totalEjecutado = (budget.rubros || []).reduce((sum, r) => sum + (r.ejecutado || 0), 0);
        const saldoDisponible = totalPresupuesto - totalEjecutado;
        const imprevistos = (budget.rubros || []).find(r => r.id === 'imprevistos');

        return Response.json({
            success: true,
            requests: requests.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
            stats,
            budgetImpact: {
                totalPresupuesto,
                totalEjecutado,
                saldoDisponible,
                fondoImprevistos: imprevistos?.presupuesto || 0,
                imprevistosUsados: imprevistos?.ejecutado || 0
            },
            suppliers: state.suppliers || []
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/materiales — Create new material request
export async function POST(request) {
    try {
        const body = await request.json();
        const { solicitante, rol, telefono, items, justificacion, urgencia, obraId } = body;

        if (!items || items.length === 0) {
            return Response.json({ success: false, error: 'items array is required' }, { status: 400 });
        }

        const state = await getAppState();
        const newReq = {
            id: `mat-req-${crypto.randomUUID().substring(0, 8)}`,
            obraId: obraId || state.activeProjectId,
            solicitante: solicitante || 'Operario',
            rol: rol || 'Campo',
            telefono: telefono || '',
            fecha: new Date().toISOString(),
            items,
            justificacion: justificacion || '',
            urgencia: urgencia || 'media',
            estado: 'pendiente_aprobacion',
            aprobadaPor: null,
            fechaAprobacion: null,
            proveedorAsignado: null,
            nroOrdenCompra: null
        };

        if (!state.materialRequests) state.materialRequests = [];
        state.materialRequests.push(newReq);
        await saveAppState(state);

        // Notify director via WhatsApp (non-blocking)
        try {
            const directorPhone = state.projectConfig?.techDirectorPhone || state.projectConfig?.directorPhone;
            if (directorPhone) {
                const itemsSummary = items.map(i => `• ${i.cantidad} ${i.unidad} — ${i.descripcion}`).join('\n');
                const msg = buildActionButtonsMessage(
                    `📦 *Nuevo Pedido de Materiales*\n\n*Solicitante:* ${newReq.solicitante} (${newReq.rol})\n*Urgencia:* ${newReq.urgencia.toUpperCase()}\n\n*Materiales:*\n${itemsSummary}\n\n*Justificación:* ${newReq.justificacion}`,
                    directorPhone,
                    [
                        { id: 'mat_approve', title: '✅ Aprobar' },
                        { id: 'mat_adjust', title: '✏️ Ajustar' },
                        { id: 'mat_reject', title: '❌ Rechazar' }
                    ]
                );
                await sendWhatsAppMessage(msg);
            }
        } catch (e) {
            console.warn('WhatsApp material notification failed:', e.message);
        }

        return Response.json({ success: true, request: newReq }, { status: 201 });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// PATCH /api/v1/materiales — Approve/Reject/Dispatch material request
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, estado, aprobadaPor, proveedorAsignado, observacion } = body;

        if (!id || !estado) {
            return Response.json({ success: false, error: 'id and estado are required' }, { status: 400 });
        }

        const state = await getAppState();
        const reqs = state.materialRequests || [];
        const idx = reqs.findIndex(r => r.id === id);

        if (idx === -1) {
            return Response.json({ success: false, error: 'Material request not found' }, { status: 404 });
        }

        reqs[idx].estado = estado;
        if (aprobadaPor) reqs[idx].aprobadaPor = aprobadaPor;
        if (estado === 'aprobada') {
            reqs[idx].fechaAprobacion = new Date().toISOString();
            reqs[idx].nroOrdenCompra = `OC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
        }
        if (proveedorAsignado) reqs[idx].proveedorAsignado = proveedorAsignado;
        if (observacion) reqs[idx].observacion = observacion;
        reqs[idx].updatedAt = new Date().toISOString();

        state.materialRequests = reqs;
        await saveAppState(state);

        // Notify requester via WhatsApp (non-blocking)
        try {
            const phone = (reqs[idx].telefono || '').replace(/[^\d]/g, '');
            if (phone) {
                const statusEmoji = estado === 'aprobada' ? '✅' : estado === 'rechazada' ? '❌' : '📦';
                const msg = {
                    messaging_product: 'whatsapp',
                    to: phone,
                    type: 'text',
                    text: {
                        body: `${statusEmoji} *Actualización de Pedido de Materiales*\n\nTu solicitud *${reqs[idx].id}* fue *${estado.toUpperCase().replace('_', ' ')}*${aprobadaPor ? ` por ${aprobadaPor}` : ''}.${reqs[idx].nroOrdenCompra ? `\nNro. OC: ${reqs[idx].nroOrdenCompra}` : ''}${observacion ? `\nObservación: ${observacion}` : ''}\n\n_ObraSaaS Enterprise_`
                    }
                };
                await sendWhatsAppMessage(msg);
            }
        } catch (e) {
            console.warn('WhatsApp material status notification failed:', e.message);
        }

        return Response.json({ success: true, request: reqs[idx] });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
