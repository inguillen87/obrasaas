import { getAppState, saveAppState } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsappNotifications';
import { buildActionButtonsMessage } from '@/lib/metaTemplates';

export const dynamic = 'force-dynamic';

// POST /api/v1/calendario/notify — Send WhatsApp reminder for an appointment
export async function POST(request) {
    try {
        const body = await request.json();
        const appointmentId = body.appointmentId || body.id;
        const type = body.type || 'manual'; // type: '24h' | '48h' | 'manual'

        const state = await getAppState();
        const appts = state.calendarAppointments || [];
        const appt = appts.find(a => a.id === appointmentId);

        if (!appt) {
            return Response.json({ success: false, error: 'Appointment not found' }, { status: 404 });
        }

        // Build WhatsApp notification
        const targetNumber = (appt.telefono || '').replace(/[^\d]/g, '');
        if (!targetNumber) {
            return Response.json({ success: false, error: 'No phone number for this appointment' }, { status: 400 });
        }

        const messageBody = `📅 *Recordatorio de Cita — ObraSaaS*\n\n` +
            `*${appt.title}*\n` +
            `📆 Fecha: ${appt.fecha}\n` +
            `🕐 Hora: ${appt.hora}\n` +
            `📋 Tipo: ${appt.tipo}\n` +
            `👥 Participantes: ${(appt.participantes || []).join(', ')}\n` +
            `${appt.notas ? `📝 Notas: ${appt.notas}` : ''}\n\n` +
            `_¿Confirmás tu asistencia?_`;

        const message = buildActionButtonsMessage(
            messageBody,
            targetNumber,
            [
                { id: 'cita_confirm', title: '✅ Confirmo' },
                { id: 'cita_reschedule', title: '🔄 Reprogramar' }
            ]
        );

        let whatsappResult = { sent: false };
        try {
            whatsappResult = await sendWhatsAppMessage(message);
        } catch (e) {
            console.warn('WhatsApp notification failed (non-fatal):', e.message);
        }

        // Mark reminder as sent
        const idx = appts.findIndex(a => a.id === appointmentId);
        if (type === '24h') appts[idx].recordatorio24hEnviado = true;
        if (type === '48h') appts[idx].recordatorio48hEnviado = true;
        appts[idx].ultimoRecordatorio = new Date().toISOString();
        state.calendarAppointments = appts;
        await saveAppState(state);

        return Response.json({
            success: true,
            whatsappSent: whatsappResult?.sent || false,
            appointment: appts[idx]
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
