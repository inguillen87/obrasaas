import { getAppState, saveAppState } from '@/lib/db';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

const DEFAULT_CHANGE_ORDERS = [
  {
    id: 'co-101',
    projectId: 'obra-palermo-01',
    orderNumber: 1,
    title: 'Ampliación de Iluminación LED y Gargantas de Yeso en Living',
    description: 'Solicitud del comitente para incorporar 18 metros lineales de garganta de yeso con tira LED cálida RGBW y 6 spots embutidos en cielorraso suspendido.',
    rubroCode: 'Instalaciones Eléctricas & Yesería',
    laborAmountARS: 280000,
    materialAmountARS: 420000,
    totalAmountARS: 700000,
    totalAmountUSD: 540,
    scheduleImpactDays: 3,
    cacBaseIndex: 124.5,
    status: 'APROBADA',
    clientApprovedAt: '2026-08-16T17:30:00.000Z',
    clientSignature: 'Ing. Lucas Varela (Comitente Fideicomiso)',
    createdAt: '2026-08-15T11:00:00.000Z'
  },
  {
    id: 'co-102',
    projectId: 'obra-palermo-01',
    orderNumber: 2,
    title: 'Reemplazo de Griferías Standard por Línea FV Temple Monocomando',
    description: 'Modificación de especificación técnica en 4 baños completos y cocina principal. Requiere adaptación de chicotes y llaves de paso en termofusión.',
    rubroCode: 'Instalaciones Sanitarias & Terminaciones',
    laborAmountARS: 150000,
    materialAmountARS: 890000,
    totalAmountARS: 1040000,
    totalAmountUSD: 800,
    scheduleImpactDays: 2,
    cacBaseIndex: 128.2,
    status: 'PENDIENTE_CLIENTE',
    clientApprovedAt: null,
    clientSignature: null,
    createdAt: '2026-08-18T16:00:00.000Z'
  }
];

export async function GET(request) {
  try {
    const state = await getAppState();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let changeOrders = state.changeOrders || DEFAULT_CHANGE_ORDERS;

    if (status && status !== 'all') {
      changeOrders = changeOrders.filter(co => co.status.toLowerCase() === status.toLowerCase());
    }

    const totalApprovedARS = changeOrders
      .filter(co => co.status === 'APROBADA')
      .reduce((sum, co) => sum + (co.totalAmountARS || 0), 0);

    const totalPendingARS = changeOrders
      .filter(co => co.status === 'PENDIENTE_CLIENTE')
      .reduce((sum, co) => sum + (co.totalAmountARS || 0), 0);

    const totalScheduleDays = changeOrders
      .filter(co => co.status === 'APROBADA')
      .reduce((sum, co) => sum + (co.scheduleImpactDays || 0), 0);

    return Response.json({
      success: true,
      count: changeOrders.length,
      totals: {
        totalApprovedARS,
        totalPendingARS,
        totalScheduleDays
      },
      changeOrders
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const state = await getAppState();
    const body = await request.json();

    if (!body.title || !body.rubroCode) {
      return Response.json({ success: false, error: 'Título y Rubro son requeridos' }, { status: 400 });
    }

    const currentOrders = state.changeOrders || DEFAULT_CHANGE_ORDERS;
    const newNumber = currentOrders.length > 0 ? Math.max(...currentOrders.map(o => o.orderNumber || 0)) + 1 : 1;

    const labor = parseFloat(body.laborAmountARS) || 0;
    const material = parseFloat(body.materialAmountARS) || 0;
    const totalARS = labor + material;
    const usdRate = 1300; // Blue/MEP ref
    const totalUSD = Math.round(totalARS / usdRate);

    const newOrder = {
      id: `co-${Date.now()}`,
      projectId: state.projectConfig?.id || 'obra-palermo-01',
      orderNumber: newNumber,
      title: body.title,
      description: body.description || '',
      rubroCode: body.rubroCode,
      laborAmountARS: labor,
      materialAmountARS: material,
      totalAmountARS: totalARS,
      totalAmountUSD: totalUSD,
      scheduleImpactDays: parseInt(body.scheduleImpactDays, 10) || 0,
      cacBaseIndex: parseFloat(body.cacBaseIndex) || 128.2,
      status: 'PENDIENTE_CLIENTE',
      clientApprovedAt: null,
      clientSignature: null,
      createdAt: new Date().toISOString()
    };

    state.changeOrders = [newOrder, ...currentOrders];

    state.auditLedger = appendAuditTransaction(state.auditLedger, {
      action: 'CHANGE_ORDER_CREATED',
      actor: body.creator || 'Director de Obra',
      details: { orderNumber: newNumber, title: newOrder.title, totalARS }
    });

    await saveAppState(state);

    return Response.json({
      success: true,
      changeOrder: newOrder
    }, { status: 201 });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const state = await getAppState();
    const body = await request.json();
    const { id, status, clientSignature } = body;

    if (!id) {
      return Response.json({ success: false, error: 'ID de Change Order requerido' }, { status: 400 });
    }

    const currentOrders = state.changeOrders || DEFAULT_CHANGE_ORDERS;
    const index = currentOrders.findIndex(o => o.id === id);

    if (index === -1) {
      return Response.json({ success: false, error: 'Change Order no encontrada' }, { status: 404 });
    }

    const updated = {
      ...currentOrders[index],
      status: status || currentOrders[index].status,
      clientSignature: clientSignature || currentOrders[index].clientSignature,
      clientApprovedAt: status === 'APROBADA' ? new Date().toISOString() : currentOrders[index].clientApprovedAt
    };

    currentOrders[index] = updated;
    state.changeOrders = currentOrders;

    state.auditLedger = appendAuditTransaction(state.auditLedger, {
      action: 'CHANGE_ORDER_STATUS_UPDATED',
      actor: clientSignature || 'Comitente',
      details: { orderNumber: updated.orderNumber, status: updated.status }
    });

    await saveAppState(state);

    return Response.json({
      success: true,
      changeOrder: updated
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
