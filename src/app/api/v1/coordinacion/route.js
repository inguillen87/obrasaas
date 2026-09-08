import { getAppState, saveAppState } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsappNotifications';
import { appendAuditTransaction } from '@/lib/auditLedger';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// GET /api/v1/coordinacion — List Visual Task Alerts & Stats
export async function GET(request) {
    try {
        const state = await getAppState();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const urgency = searchParams.get('urgency');

        let alerts = state.visualTaskAlerts || [];

        if (status && status !== 'ALL') {
            alerts = alerts.filter(a => a.status === status);
        }
        if (urgency && urgency !== 'ALL') {
            alerts = alerts.filter(a => a.urgency === urgency);
        }

        const stats = {
            total: (state.visualTaskAlerts || []).length,
            pendientes: (state.visualTaskAlerts || []).filter(a => a.status === 'PENDIENTE').length,
            enCorreccion: (state.visualTaskAlerts || []).filter(a => a.status === 'EN_CORRECCION').length,
            resueltos: (state.visualTaskAlerts || []).filter(a => a.status === 'RESUELTO').length,
            aprobados: (state.visualTaskAlerts || []).filter(a => a.status === 'APROBADO_DIRECCION').length,
            criticos: (state.visualTaskAlerts || []).filter(a => a.urgency === 'CRITICA').length
        };

        return Response.json({
            success: true,
            alerts: alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            stats,
            workers: state.workerRegistry || []
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/coordinacion — Create Visual Task Alert with Photo Markup & WhatsApp Notification
export async function POST(request) {
    try {
        const body = await request.json();
        const {
            title,
            description,
            sector,
            assignedTo,
            assignedRole,
            assignedPhone,
            assignedBy,
            urgency,
            deadline,
            originalPhotoUrl,
            annotatedPhotoUrl,
            markupData
        } = body;

        if (!title || !assignedTo) {
            return Response.json({ success: false, error: 'Título y Responsable son obligatorios' }, { status: 400 });
        }

        const state = await getAppState();
        state.visualTaskAlerts = state.visualTaskAlerts || [];

        const newId = `vta-${Date.now().toString(36)}`;
        const nowIso = new Date().toISOString();

        // Calculate SHA-256 Hash for legal tracking
        const hashPayload = JSON.stringify({ newId, title, description, sector, assignedTo, assignedBy, nowIso });
        const hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

        const newAlert = {
            id: newId,
            title,
            description: description || 'Sin descripción adicional.',
            sector: sector || 'Sector General de Obra',
            assignedTo,
            assignedRole: assignedRole || 'Cuadrilla',
            assignedPhone: assignedPhone || '',
            assignedBy: assignedBy || 'Dirección de Obra (ObraSaaS)',
            urgency: urgency || 'ALTA', // CRITICA | ALTA | MEDIA
            deadline: deadline || '24 hs',
            status: 'PENDIENTE',
            originalPhotoUrl: originalPhotoUrl || annotatedPhotoUrl || null,
            annotatedPhotoUrl: annotatedPhotoUrl || null,
            markupData: markupData || { textAnnotations: [], shapes: [] },
            whatsappAlertSent: false,
            whatsappSentAt: null,
            resolutionPhotoUrl: null,
            resolutionNotes: null,
            hash,
            createdAt: nowIso
        };

        // Trigger WhatsApp Notification to assigned party if phone is present
        let waResult = null;
        if (assignedPhone) {
            const cleanPhone = assignedPhone.replace(/\D/g, '');
            const urgencyBadge = urgency === 'CRITICA' ? '🚨 CRÍTICA (Bloqueante)' : urgency === 'ALTA' ? '⚠️ ALTA (24hs)' : 'ℹ️ MEDIA';
            const projName = state.projectConfig?.name || 'Torre Palermo Soho';

            const waMessage = `🚨 *ALERTA DE TAREA PENDIENTE — ObraSaaS*\n\n` +
                `Hola *${assignedTo}*, se te asignó una tarea de resolución obligatoria en obra:\n\n` +
                `📍 *Obra:* ${projName}\n` +
                `📌 *Sector:* ${newAlert.sector}\n` +
                `⚡ *Prioridad:* ${urgencyBadge}\n` +
                `⏰ *Plazo Límite:* ${newAlert.deadline}\n` +
                `👤 *Asignado por:* ${newAlert.assignedBy}\n\n` +
                `📋 *Problema Detectado:*\n*${newAlert.title}*\n\n` +
                `📝 *Instrucción Técnica:*\n${newAlert.description}\n\n` +
                (annotatedPhotoUrl ? `📸 *Foto con Marcación Técnica:* ${annotatedPhotoUrl}\n\n` : '') +
                `_Por favor confirmar recepción y enviar foto de resolución al terminar._\n` +
                `_ObraSaaS ConTech • Trazabilidad SHA-256_`;

            try {
                waResult = await sendWhatsAppMessage(cleanPhone, waMessage);
                if (waResult?.success) {
                    newAlert.whatsappAlertSent = true;
                    newAlert.whatsappSentAt = new Date().toISOString();
                }
            } catch (waErr) {
                console.warn('Could not send WhatsApp alert to worker:', waErr.message);
            }
        }

        // Insert into state
        state.visualTaskAlerts.unshift(newAlert);

        // Record in cryptographic audit ledger
        state.auditLedger = appendAuditTransaction(state.auditLedger || [], {
            action: 'NUEVA_ALERTA_VISUAL_TAREA',
            actor: assignedBy || 'Dirección de Obra',
            details: {
                ticketId: newId,
                title: newAlert.title,
                assignedTo: newAlert.assignedTo,
                sector: newAlert.sector,
                urgency: newAlert.urgency,
                whatsappSent: newAlert.whatsappAlertSent
            }
        });

        // Also push to active incidents feed
        state.incidents = state.incidents || [];
        state.incidents.unshift({
            id: `inc-vta-${Date.now()}`,
            title: `[Alerta Tarea] ${newAlert.title}`,
            description: `${newAlert.sector}: ${newAlert.description} (Asignado a: ${newAlert.assignedTo})`,
            type: urgency === 'CRITICA' ? 'danger' : 'warning',
            badge: urgency === 'CRITICA' ? 'Vicio Crítico' : 'Tarea Pendiente',
            timestamp: `Hoy, ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
            reporter: newAlert.assignedBy,
            icon: 'fa-solid fa-camera-retro'
        });

        await saveAppState(state);

        return Response.json({
            success: true,
            alert: newAlert,
            whatsappNotification: waResult
        }, { status: 201 });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// PATCH /api/v1/coordinacion — Update Task Status or attach resolution
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, status, resolutionNotes, resolutionPhotoUrl, signedBy } = body;

        if (!id) {
            return Response.json({ success: false, error: 'ID de alerta requerido' }, { status: 400 });
        }

        const state = await getAppState();
        state.visualTaskAlerts = state.visualTaskAlerts || [];

        const alertIndex = state.visualTaskAlerts.findIndex(a => a.id === id);
        if (alertIndex === -1) {
            return Response.json({ success: false, error: 'Alerta no encontrada' }, { status: 404 });
        }

        const alert = state.visualTaskAlerts[alertIndex];

        if (status) alert.status = status;
        if (resolutionNotes) alert.resolutionNotes = resolutionNotes;
        if (resolutionPhotoUrl) alert.resolutionPhotoUrl = resolutionPhotoUrl;
        alert.updatedAt = new Date().toISOString();

        if (status === 'APROBADO_DIRECCION') {
            alert.approvedBy = signedBy || 'Dirección de Obra';
            alert.approvedAt = new Date().toISOString();
        }

        state.auditLedger = appendAuditTransaction(state.auditLedger || [], {
            action: 'ACTUALIZACION_ALERTA_VISUAL',
            actor: signedBy || 'Dirección de Obra',
            details: {
                ticketId: id,
                newStatus: status,
                title: alert.title
            }
        });

        await saveAppState(state);

        return Response.json({
            success: true,
            alert
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
