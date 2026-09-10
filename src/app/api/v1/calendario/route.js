import { getAppState, saveAppState } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsappNotifications';
import { buildActionButtonsMessage } from '@/lib/metaTemplates';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// GET /api/v1/calendario — List appointments with optional filters
export async function GET(request) {
    try {
        const state = await getAppState();
        const { searchParams } = new URL(request.url);
        const estado = searchParams.get('estado');
        const tipo = searchParams.get('tipo');
        const desde = searchParams.get('desde');
        const hasta = searchParams.get('hasta');

        let appointments = state.calendarAppointments || [];

        if (estado && estado !== 'ALL') {
            appointments = appointments.filter(a => a.estado === estado);
        }
        if (tipo && tipo !== 'ALL') {
            appointments = appointments.filter(a => a.tipo === tipo);
        }
        if (desde) {
            appointments = appointments.filter(a => a.fecha >= desde);
        }
        if (hasta) {
            appointments = appointments.filter(a => a.fecha <= hasta);
        }

        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        const allAppts = state.calendarAppointments || [];
        const stats = {
            citasEstaSemana: allAppts.filter(a => a.fecha >= weekStartStr && a.fecha <= weekEndStr).length,
            pendientesConfirmacion: allAppts.filter(a => a.estado === 'programada').length,
            visitasCumplidas: allAppts.filter(a => a.estado === 'completada').length,
            alertasReprogramacion: allAppts.filter(a => a.estado === 'cancelada' || a.estado === 'reprogramada').length
        };

        return Response.json({
            success: true,
            appointments: appointments.sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora)),
            stats
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/calendario — Create new appointment
export async function POST(request) {
    try {
        const title = body.title;
        const obraId = body.obraId || body.obra;
        const fecha = body.fecha || body.date;
        const hora = body.hora || body.time;
        const tipo = body.tipo || 'Visita Comitente';
        const participantes = Array.isArray(body.participantes) ? body.participantes : Array.isArray(body.participants) ? body.participants : (body.participantes || body.participants ? String(body.participantes || body.participants).split(',').map(s => s.trim()) : []);
        const telefono = body.telefono || body.phone || '';
        const notas = body.notas || body.notes || '';

        if (!title || !fecha || !hora) {
            return Response.json({ success: false, error: 'title, fecha/date and hora/time are required' }, { status: 400 });
        }

        const state = await getAppState();
        const newAppt = {
            id: `cita-${crypto.randomUUID().substring(0, 8)}`,
            title,
            obraId: obraId || state.activeProjectId,
            fecha,
            hora,
            tipo: tipo || 'Visita Comitente',
            participantes: participantes || [],
            telefono: telefono || '',
            estado: 'programada',
            recordatorio24hEnviado: false,
            recordatorio48hEnviado: false,
            notas: notas || '',
            createdAt: new Date().toISOString()
        };

        if (!state.calendarAppointments) state.calendarAppointments = [];
        state.calendarAppointments.push(newAppt);
        await saveAppState(state);

        return Response.json({ success: true, appointment: newAppt }, { status: 201 });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// PATCH /api/v1/calendario — Update appointment status
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, estado, notas } = body;

        if (!id) {
            return Response.json({ success: false, error: 'id is required' }, { status: 400 });
        }

        const state = await getAppState();
        const appts = state.calendarAppointments || [];
        const idx = appts.findIndex(a => a.id === id);

        if (idx === -1) {
            return Response.json({ success: false, error: 'Appointment not found' }, { status: 404 });
        }

        if (estado) appts[idx].estado = estado;
        if (notas !== undefined) appts[idx].notas = notas;
        appts[idx].updatedAt = new Date().toISOString();

        state.calendarAppointments = appts;
        await saveAppState(state);

        return Response.json({ success: true, appointment: appts[idx] });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
