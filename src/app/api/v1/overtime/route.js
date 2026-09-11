import { getAppState, saveAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/overtime — Overtime Records & Financial Labor Impact (UOCRA CCT 76/75)
export async function GET(request) {
    try {
        const state = await getAppState();
        const records = state.overtimeRecords || [];

        const totalHours50 = records.reduce((sum, r) => sum + (Number(r.hours50) || 0), 0);
        const totalHours100 = records.reduce((sum, r) => sum + (Number(r.hours100) || 0), 0);
        const totalAmountARS = records.reduce((sum, r) => sum + (Number(r.totalAmountARS) || 0), 0);
        
        const approvedRecords = records.filter(r => r.status === 'APROBADA');
        const pendingRecords = records.filter(r => r.status === 'PENDIENTE');

        const approvedAmountARS = approvedRecords.reduce((sum, r) => sum + (Number(r.totalAmountARS) || 0), 0);
        const pendingAmountARS = pendingRecords.reduce((sum, r) => sum + (Number(r.totalAmountARS) || 0), 0);

        // Group by worker
        const byWorker = records.reduce((acc, r) => {
            const name = r.workerName || 'Operario';
            if (!acc[name]) {
                acc[name] = { totalHours: 0, amountARS: 0, count: 0 };
            }
            acc[name].totalHours += (Number(r.hours50) || 0) + (Number(r.hours100) || 0);
            acc[name].amountARS += (Number(r.totalAmountARS) || 0);
            acc[name].count += 1;
            return acc;
        }, {});

        return Response.json({
            success: true,
            records,
            stats: {
                totalHours50,
                totalHours100,
                totalHoursCombined: totalHours50 + totalHours100,
                totalAmountARS,
                approvedAmountARS,
                pendingAmountARS,
                recordsCount: records.length,
                pendingCount: pendingRecords.length,
                approvedCount: approvedRecords.length,
                byWorker,
                cctReference: 'UOCRA Convenio Colectivo de Trabajo 76/75'
            }
        });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

// POST /api/v1/overtime — Record or Approve Overtime Hours
export async function POST(request) {
    try {
        const body = await request.json();
        const { action = 'create' } = body;
        const state = await getAppState();
        state.overtimeRecords = state.overtimeRecords || [];

        if (action === 'approve') {
            const { id, approvedBy = 'Arq. Victoria Schiaffino' } = body;
            const record = state.overtimeRecords.find(r => r.id === id);
            if (!record) {
                return Response.json({ success: false, error: 'Registro de horas extras no encontrado' }, { status: 404 });
            }
            record.status = 'APROBADA';
            record.approvedBy = approvedBy;
            record.approvedAt = new Date().toISOString();

            await saveAppState(state);

            return Response.json({
                success: true,
                record,
                message: `Horas extras de ${record.workerName} aprobadas por ${approvedBy}`
            });
        }

        // Action: create
        const {
            workerName = 'Juan Gómez',
            trade = 'Oficial Albañil',
            workerId = 'w-1',
            date = new Date().toISOString().split('T')[0],
            dayType = 'Día Hábil Prolongado (50%)',
            hours50 = 0,
            hours100 = 0,
            hourlyBaseARS = 4850,
            concept = 'Extensión de jornada por colado crítico de hormigón',
            quincena = 'Q1 - Septiembre 2026'
        } = body;

        const h50 = Number(hours50) || 0;
        const h100 = Number(hours100) || 0;
        const base = Number(hourlyBaseARS) || 4850;

        // Formula UOCRA: Horas al 50% = base * 1.5. Horas al 100% = base * 2.0
        const totalAmountARS = Math.round((h50 * base * 1.5) + (h100 * base * 2.0));

        const newRecord = {
            id: `ot-${Date.now().toString(36)}`,
            workerId,
            workerName,
            trade,
            date,
            dayType: h100 > 0 ? 'Sábado Tarde / Domingo (100%)' : dayType,
            hours50: h50,
            hours100: h100,
            hourlyBaseARS: base,
            totalAmountARS,
            concept,
            quincena,
            status: 'PENDIENTE',
            approvedBy: null,
            approvedAt: null,
            createdAt: new Date().toISOString()
        };

        state.overtimeRecords.unshift(newRecord);
        await saveAppState(state);

        return Response.json({
            success: true,
            record: newRecord,
            message: `Cargadas ${h50 + h100}hs extras para ${workerName} ($${totalAmountARS.toLocaleString('es-AR')} ARS) pendiente de aprobación`
        }, { status: 201 });
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
