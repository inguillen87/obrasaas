import { getAppState } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ReportPage() {
    const state = await getAppState();

    // Parse timeline dates safely
    const cleanDias = String(state.diasEstimados || "12/35").replace(/Día\s*|Da\s*|D.a\s*/gi, "");
    const match = cleanDias.match(/(\d+)\/(\d+)/);
    let currentDay = 12;
    let totalDays = 35;
    if (match) {
        currentDay = parseInt(match[1]) || 12;
        totalDays = parseInt(match[2]) || 35;
    }
    totalDays = totalDays || 35;
    const timelinePercentage = Math.round((currentDay / totalDays) * 100);

    // Calculate budget metrics (from state or presupuesto, not hardcoded)
    const totalBudget = state.projectConfig?.totalBudget || 4995000;
    const progressVal = parseFloat(state.avancePercentage) || 0;
    const executedBudget = Math.round(totalBudget * (progressVal / 100));
    const remainingBudget = totalBudget - executedBudget;

    const formattedTotalBudget = totalBudget.toLocaleString('es-AR');
    const formattedExecutedBudget = executedBudget.toLocaleString('es-AR');
    const formattedRemainingBudget = remainingBudget.toLocaleString('es-AR');

    const tasks = Object.values(state.tasks || {});
    const incidents = state.incidents || [];
    const attendance = Object.entries(state.attendance || {});
    const stockpiles = Object.values(state.stockpiles || {});

    const projectName = state.projectConfig?.name || 'Obra';
    const projectCity = state.projectConfig?.city || 'CABA';

    return (
        <html lang="es">
            <head>
                <title>Reporte_Semanal_{projectName.replace(/\s+/g, '_')}.pdf</title>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@600;700;800&display=swap" />
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
                <style>{`
                    body {
                        font-family: 'Inter', sans-serif;
                        color: #1e293b;
                        background: #fff;
                        padding: 30px;
                        margin: 0;
                        line-height: 1.4;
                    }
                    .report-header {
                        display: flex;
                        justify-content: space-between;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 20px;
                        margin-bottom: 24px;
                    }
                    .logo-section h2 {
                        font-family: 'Outfit', sans-serif;
                        font-weight: 800;
                        font-size: 1.4rem;
                        color: #ff9f1c;
                        margin: 0 0 4px 0;
                    }
                    .logo-section span {
                        font-size: 0.75rem;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .meta-section {
                        text-align: right;
                        font-size: 0.8rem;
                        color: #64748b;
                    }
                    .meta-section h3 {
                        font-family: 'Outfit', sans-serif;
                        font-size: 1.2rem;
                        color: #0f172a;
                        margin: 0 0 6px 0;
                        text-transform: uppercase;
                    }
                    .grid-2 {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 24px;
                    }
                    .card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 16px;
                    }
                    .card h4 {
                        font-family: 'Outfit', sans-serif;
                        margin: 0 0 12px 0;
                        font-size: 0.95rem;
                        color: #0f172a;
                        border-bottom: 1px solid #cbd5e1;
                        padding-bottom: 6px;
                        text-transform: uppercase;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.75rem;
                        margin-bottom: 20px;
                    }
                    th {
                        background: #f1f5f9;
                        color: #334155;
                        padding: 8px 10px;
                        text-align: left;
                        font-weight: 700;
                        border-bottom: 2px solid #cbd5e1;
                    }
                    td {
                        padding: 8px 10px;
                        border-bottom: 1px solid #e2e8f0;
                    }
                    .progress-bar-container {
                        width: 100px;
                        height: 8px;
                        background: #e2e8f0;
                        border-radius: 4px;
                        overflow: hidden;
                        display: inline-block;
                        vertical-align: middle;
                        margin-right: 8px;
                    }
                    .progress-bar-fill {
                        height: 100%;
                        border-radius: 4px;
                    }
                    .badge {
                        font-size: 0.65rem;
                        font-weight: 700;
                        padding: 2px 6px;
                        border-radius: 4px;
                    }
                    .badge-success { background: #d1fae5; color: #065f46; }
                    .badge-warning { background: #fef3c7; color: #92400e; }
                    .badge-danger { background: #fee2e2; color: #991b1b; }
                    .badge-info { background: #e0f2fe; color: #075985; }
                    
                    @media print {
                        body {
                            padding: 0;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                `}</style>
            </head>
            <body>
                {/* Print Control bar for browser visualization */}
                <div className="no-print" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', fontFamily: 'Inter, sans-serif' }}>
                    <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
                        <i className="fa-solid fa-circle-info" style={{ marginRight: '6px' }}></i> Vista de impresión optimizada para PDF Vectorial.
                    </div>
                    <button onClick={() => window.print()} style={{ background: '#ff9f1c', border: 'none', color: '#000', fontWeight: 700, padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                        <i className="fa-solid fa-print"></i> Abrir Impresora / Guardar PDF
                    </button>
                </div>

                <div className="report-header">
                    <div className="logo-section">
                        <h2>ObraSaaS / Innovar Latam</h2>
                        <span>Monitoreo Satelital & Inteligencia Artificial</span>
                    </div>
                    <div className="meta-section">
                        <h3>Reporte Ejecutivo Semanal</h3>
                        <strong>Proyecto:</strong> {projectName}<br />
                        <strong>Fecha Emisión:</strong> {new Date().toLocaleDateString('es-AR')}<br />
                        <strong>Estado Obra:</strong> {state.avancePercentage}% Completado
                    </div>
                </div>

                {/* Timeline and Budget Cards */}
                <div className="grid-2">
                    <div className="card">
                        <h4>Cronograma y Plazos</h4>
                        <div style={{ fontSize: '0.8rem', marginBottom: '8px' }}>
                            <strong>Jornada Actual:</strong> {state.diasEstimados}
                        </div>
                        <div style={{ fontSize: '0.8rem', marginBottom: '12px' }}>
                            <strong>Progreso de Plazo:</strong> {timelinePercentage}% transcurrido
                        </div>
                        <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${timelinePercentage}%`, height: '100%', background: '#ff9f1c' }}></div>
                        </div>
                    </div>

                    <div className="card">
                        <h4>Estado Presupuestario (ARS)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                            <div>
                                <span style={{ color: '#64748b' }}>Presupuesto Total:</span><br />
                                <strong>${formattedTotalBudget}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>Presupuesto Ejecutado:</span><br />
                                <strong style={{ color: '#059669' }}>${formattedExecutedBudget}</strong>
                            </div>
                            <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                                <span style={{ color: '#64748b' }}>Remanente de Caja:</span><br />
                                <strong>${formattedRemainingBudget}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tasks Table */}
                <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', margin: '24px 0 10px 0', textTransform: 'uppercase' }}>Estado de Tareas Activas (Gantt)</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Tarea</th>
                            <th>Responsable</th>
                            <th>Progreso</th>
                            <th>Duración Est.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.map((task, idx) => {
                            const taskProgress = parseFloat(task.progress) || 0;
                            const isDone = taskProgress === 100;
                            const color = isDone ? '#10b981' : taskProgress === 0 ? '#94a3b8' : '#f59e0b';
                            return (
                                <tr key={idx}>
                                    <td style={{ fontWeight: 600 }}>{task.name}</td>
                                    <td>{task.assignee || 'Sin asignar'}</td>
                                    <td>
                                        <div className="progress-bar-container">
                                            <div className="progress-bar-fill" style={{ width: `${taskProgress}%`, background: color }}></div>
                                        </div>
                                        <strong>{taskProgress}%</strong>
                                    </td>
                                    <td>{task.duration} días</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Presentism and Insumos Cards */}
                <div className="grid-2">
                    <div>
                        <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', margin: '12px 0 10px 0', textTransform: 'uppercase' }}>Presentismo del Personal</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Operario</th>
                                    <th>Rol</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attendance.map(([workerName, details], idx) => {
                                    const isPresent = details.status.includes('Presente') || details.status.includes('Voz');
                                    const isLeave = details.status.includes('Licencia');
                                    const badgeClass = isPresent ? 'badge-success' : isLeave ? 'badge-warning' : 'badge-danger';
                                    return (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{workerName}</td>
                                            <td>{details.role}</td>
                                            <td>
                                                <span className={`badge ${badgeClass}`}>{details.status}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', margin: '12px 0 10px 0', textTransform: 'uppercase' }}>Logística de Acopios</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Material</th>
                                    <th>Cantidad</th>
                                    <th>Estado Insumo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockpiles.map((item, idx) => {
                                    const isCritical = item.status === 'Crítico';
                                    const isSent = item.status.includes('Enviada');
                                    const isOk = item.status.includes('OK');
                                    const badgeClass = isCritical ? 'badge-danger' : isSent ? 'badge-warning' : isOk ? 'badge-success' : 'badge-info';
                                    return (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{item.name}</td>
                                            <td>{item.current} {item.unit}</td>
                                            <td>
                                                <span className={`badge ${badgeClass}`}>{item.status}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Incidents timeline */}
                <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem', margin: '24px 0 10px 0', textTransform: 'uppercase' }}>Bitácora de Novedades e Incidencias</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Reporte / Evento</th>
                            <th>Detalle</th>
                            <th>Emisor</th>
                            <th>Severidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {incidents.slice(0, 5).map((inc, idx) => {
                            const isCritical = inc.type === 'critical';
                            const isWarning = inc.type === 'warning';
                            const isSuccess = inc.type === 'success';
                            const badgeClass = isCritical ? 'badge-danger' : isWarning ? 'badge-warning' : isSuccess ? 'badge-success' : 'badge-info';
                            return (
                                <tr key={idx}>
                                    <td style={{ fontWeight: 600 }}>{inc.title}</td>
                                    <td>{inc.description}</td>
                                    <td>{inc.reporter}</td>
                                    <td>
                                        <span className={`badge ${badgeClass}`}>{inc.badge || inc.type}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', borderTop: '1px solid #cbd5e1', paddingTop: '20px' }}>
                    <div style={{ textAlign: 'center', width: '200px', fontSize: '0.75rem', color: '#64748b' }}>
                        <div style={{ fontStyle: 'italic', marginBottom: '8px', fontSize: '0.9rem', color: '#000' }}>Ing. Marcelo Guillén</div>
                        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}><strong>Supervisor Técnico</strong><br />Innovar Latam</div>
                    </div>
                    <div style={{ textAlign: 'center', width: '200px', fontSize: '0.75rem', color: '#64748b' }}>
                        <div style={{ height: '24px' }}></div>
                        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px' }}><strong>Firma Digital</strong><br />Auditoría ObraSaaS</div>
                    </div>
                </div>

                {/* Autostart print on load for printing automation */}
                <script dangerouslySetInnerHTML={{ __html: `
                    window.addEventListener('DOMContentLoaded', () => {
                        // Si está abierto como diálogo de impresión directo
                        if (window.location.search.includes('print=true')) {
                            setTimeout(() => { window.print(); }, 500);
                        }
                    });
                `}} />
            </body>
        </html>
    );
}
