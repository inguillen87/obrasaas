import { getAppState, saveAppState } from '@/lib/db';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

const DEFAULT_RFIS = [
  {
    id: 'rfi-101',
    projectId: 'obra-palermo-01',
    rfiNumber: 1,
    subject: 'Cota de nivel de pase de cañería en viga V3',
    question: 'En el plano Sanitario Rev. 02 se indica pase a +2.45m, pero en el plano de Estructura CIRSOC la viga V3 descuelga hasta +2.30m. ¿A qué cota exacta se debe perforar el encofrado?',
    suggestedAnswer: 'Bajar el pase a +2.15m con camisa de PVC reforzado de 110mm.',
    officialAnswer: 'Aprobada la cota +2.15m. Se debe colocar refuerzo de 2 varillas Ø10 según detalle E-04.',
    status: 'RESPONDIDO',
    ballInCourt: 'Subcontratista Sanitarias (Luis Martínez)',
    discipline: 'Sanitarias',
    pinCoordinates: { x: 68, y: 28 },
    costImpact: 0,
    scheduleImpactDays: 0,
    createdAt: '2026-08-18T14:30:00.000Z',
    updatedAt: '2026-08-18T16:15:00.000Z'
  },
  {
    id: 'rfi-102',
    projectId: 'obra-palermo-01',
    rfiNumber: 2,
    subject: 'Modificación de ubicación de tablero seccional T-2',
    question: 'El tabique de durlock donde iba el tablero T-2 fue reemplazado por carpintería vidriada en el anteproyecto comitente. ¿Reubicar a columna C4?',
    suggestedAnswer: 'Reubicar en nicho embutido sobre mampostería este.',
    officialAnswer: null,
    status: 'EN_REVISION',
    ballInCourt: 'Director Técnico (Arq. Marcelo)',
    discipline: 'Eléctricas',
    pinCoordinates: { x: 82, y: 60 },
    costImpact: 45000,
    scheduleImpactDays: 1,
    createdAt: '2026-08-19T09:00:00.000Z',
    updatedAt: '2026-08-19T09:00:00.000Z'
  }
];

export async function GET(request) {
  try {
    const state = await getAppState();
    const { searchParams } = new URL(request.url);
    const discipline = searchParams.get('discipline');
    const status = searchParams.get('status');

    let rfis = state.rfis || DEFAULT_RFIS;

    if (discipline && discipline !== 'all') {
      rfis = rfis.filter(r => r.discipline.toLowerCase() === discipline.toLowerCase());
    }
    if (status && status !== 'all') {
      rfis = rfis.filter(r => r.status.toLowerCase() === status.toLowerCase());
    }

    return Response.json({
      success: true,
      count: rfis.length,
      rfis
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const state = await getAppState();
    const body = await request.json();

    if (!body.subject || !body.question) {
      return Response.json({ success: false, error: 'Asunto y Pregunta son requeridos' }, { status: 400 });
    }

    const currentRfis = state.rfis || DEFAULT_RFIS;
    const newNumber = currentRfis.length > 0 ? Math.max(...currentRfis.map(r => r.rfiNumber || 0)) + 1 : 1;

    const newRfi = {
      id: `rfi-${Date.now()}`,
      projectId: state.projectConfig?.id || 'obra-palermo-01',
      rfiNumber: newNumber,
      subject: body.subject,
      question: body.question,
      suggestedAnswer: body.suggestedAnswer || null,
      officialAnswer: null,
      status: 'ABIERTO',
      ballInCourt: body.ballInCourt || 'Director Técnico (Arq. Marcelo)',
      discipline: body.discipline || 'Arquitectura',
      pinCoordinates: body.pinCoordinates || { x: 50, y: 50 },
      costImpact: parseFloat(body.costImpact) || 0,
      scheduleImpactDays: parseInt(body.scheduleImpactDays, 10) || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.rfis = [newRfi, ...currentRfis];

    state.auditLedger = appendAuditTransaction(state.auditLedger, {
      action: 'RFI_CREATED',
      actor: body.reporter || 'Inspector de Obra',
      details: { rfiNumber: newNumber, subject: newRfi.subject, discipline: newRfi.discipline }
    });

    await saveAppState(state);

    return Response.json({
      success: true,
      rfi: newRfi,
      whatsappNotification: `📋 *NUEVO RFI #${newNumber} CREADO*\n• Asunto: *${newRfi.subject}*\n• Disciplina: ${newRfi.discipline}\n• Responsable: ${newRfi.ballInCourt}\n• Consulta: "${newRfi.question}"\n\n_Gestionado vía ObraSaaS Enterprise Engine_`
    }, { status: 201 });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const state = await getAppState();
    const body = await request.json();
    const { id, officialAnswer, status, ballInCourt } = body;

    if (!id) {
      return Response.json({ success: false, error: 'ID de RFI requerido' }, { status: 400 });
    }

    const currentRfis = state.rfis || DEFAULT_RFIS;
    const index = currentRfis.findIndex(r => r.id === id);

    if (index === -1) {
      return Response.json({ success: false, error: 'RFI no encontrado' }, { status: 404 });
    }

    const updated = {
      ...currentRfis[index],
      officialAnswer: officialAnswer !== undefined ? officialAnswer : currentRfis[index].officialAnswer,
      status: status || (officialAnswer ? 'RESPONDIDO' : currentRfis[index].status),
      ballInCourt: ballInCourt || currentRfis[index].ballInCourt,
      updatedAt: new Date().toISOString()
    };

    currentRfis[index] = updated;
    state.rfis = currentRfis;

    state.auditLedger = appendAuditTransaction(state.auditLedger, {
      action: 'RFI_UPDATED',
      actor: 'Director de Obra',
      details: { rfiNumber: updated.rfiNumber, status: updated.status }
    });

    await saveAppState(state);

    return Response.json({
      success: true,
      rfi: updated
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
