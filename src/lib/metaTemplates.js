/**
 * Meta WhatsApp Cloud API Interactive Templates & Component Builder
 * Provides Enterprise-grade Interactive Lists, Quick Reply Action Buttons, and Sectioned Pickers
 */

export function buildDirectorListMessage(state, targetNumber) {
    const projectName = state.projectConfig?.name || 'Obra Activa';
    const projectCity = state.projectConfig?.city || 'CABA';

    return {
        messaging_product: "whatsapp",
        to: targetNumber,
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: "👑 Centro de Mando Directivo"
            },
            body: {
                text: `Hola Marcelo. Obra activa: *${projectName}* (${projectCity}).\nSeleccioná una acción del menú interactivo para gestionar la obra en tiempo real:`
            },
            footer: {
                text: "ObraSaaS Enterprise ConTech • IA & Blockchain"
            },
            action: {
                button: "📋 Seleccionar Acción",
                sections: [
                    {
                        title: "👷‍♂️ Supervisión & Personal",
                        rows: [
                            {
                                id: "cmd_1",
                                title: "1️⃣ Cuadrilla & KYC",
                                description: "Ver operarios en predio, presentismo y legajos biométricos"
                            },
                            {
                                id: "cmd_8",
                                title: "8️⃣ Auditoría ART & GPS",
                                description: "Pólizas UOCRA Ley 22.250, geocerca satelital y radar CIRSOC"
                            },
                            {
                                id: "cmd_hys",
                                title: "🦺 Actas HyS & EPP",
                                description: "Cumplimiento de seguridad y actas digitales SHA-256"
                            }
                        ]
                    },
                    {
                        title: "🏗️ Avance & Incidencias",
                        rows: [
                            {
                                id: "cmd_2",
                                title: "2️⃣ Certificar Avance",
                                description: `Certificar avance de tarea (${state.avancePercentage ?? '—'}% global) con sello SHA-256`
                            },
                            {
                                id: "cmd_3",
                                title: "3️⃣ Incidencia Crítica",
                                description: "Reportar rotura/fuga y asignar Tarea de Emergencia"
                            },
                            {
                                id: "cmd_4",
                                title: "4️⃣ Replanificar Demora",
                                description: "Registrar demora de materiales y bloqueo en cronograma Gantt"
                            }
                        ]
                    },
                    {
                        title: "💰 Finanzas & Proveedores",
                        rows: [
                            {
                                id: "cmd_5",
                                title: "5️⃣ Proveedores",
                                description: "Confirmar entrega de materiales y suministros pendientes"
                            },
                            {
                                id: "cmd_6",
                                title: "6️⃣ Plan Quincenal",
                                description: "Cronograma de tareas quincenales (Quincena 1 / Quincena 2)"
                            },
                            {
                                id: "cmd_7",
                                title: "7️⃣ Rendir Caja Chica",
                                description: "Rendición de gastos en ferretería con firma contable"
                            },
                            {
                                id: "cmd_overtime",
                                title: "⏰ Horas Extras UOCRA",
                                description: "Sobrecostos CCT 76/75 al 50% y 100% y aprobación"
                            }
                        ]
                    }
                ]
            }
        }
    };
}

export function buildVictoriaListMessage(state, targetNumber) {
    const projectName = state.projectConfig?.name || 'Obra Activa';

    return {
        messaging_product: "whatsapp",
        to: targetNumber,
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: "📐 Panel de Dirección Técnica"
            },
            body: {
                text: `Hola Arq. Victoria. Supervisión técnica activa en *${projectName}*.\nElegí el módulo a auditar:`
            },
            footer: {
                text: "ObraSaaS Enterprise ConTech"
            },
            action: {
                button: "🔍 Módulos Técnicos",
                sections: [
                    {
                        title: "Control de Obra & Seguridad",
                        rows: [
                            {
                                id: "cmd_1",
                                title: "1️⃣ Cuadrilla & KYC",
                                description: "Estado biométrico y cobertura ART de la cuadrilla"
                            },
                            {
                                id: "cmd_2",
                                title: "2️⃣ Calidad Estructural",
                                description: "Ensayos de compresión CIRSOC 201 y radar meteorológico"
                            },
                            {
                                id: "cmd_hys",
                                title: "🦺 Actas HyS & EPP",
                                description: "Auditoría de seguridad y actas con firma SHA-256"
                            }
                        ]
                    },
                    {
                        title: "Sostenibilidad & Madera Modular",
                        rows: [
                            {
                                id: "cmd_sostenibilidad",
                                title: "🌱 Madera Modular & CO2",
                                description: "Módulos off-site, fijaciones Rothoblaas y balance ESG"
                            }
                        ]
                    },
                    {
                        title: "Auditoría & Finanzas",
                        rows: [
                            {
                                id: "cmd_3",
                                title: "3️⃣ Vicios & Incidencias",
                                description: "Inspección de anomalías en bitácora fotográfica"
                            },
                            {
                                id: "cmd_4",
                                title: "4️⃣ Certificaciones Q1/Q2",
                                description: "Actas de medición quincenal aprobadas para cobro"
                            },
                            {
                                id: "cmd_5",
                                title: "5️⃣ Caja Chica & AFIP",
                                description: "Auditoría de facturas y remitos con CAE validado"
                            },
                            {
                                id: "cmd_overtime",
                                title: "⏰ Horas Extras UOCRA",
                                description: "Cálculo y aprobación de sobrecostos CCT 76/75"
                            }
                        ]
                    }
                ]
            }
        }
    };
}

export function buildWorkerListMessage(state, senderName, senderRole, targetNumber) {
    const projectName = state.projectConfig?.name || 'Obra Activa';

    return {
        messaging_product: "whatsapp",
        to: targetNumber,
        type: "interactive",
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: `👷 Copiloto — ${senderName}`
            },
            body: {
                text: `Hola ${senderName} (${senderRole}).\nEstás asignado a *${projectName}*. Seleccioná tu reporte:`
            },
            footer: {
                text: "ObraSaaS Asistencia & Partes Diarios"
            },
            action: {
                button: "📱 Menú de Operario",
                sections: [
                    {
                        title: "Ingreso & Asistencia",
                        rows: [
                            {
                                id: "cmd_1",
                                title: "1️⃣ Fichar Asistencia",
                                description: "Validar ingreso por ubicación GPS o tarjeta digital"
                            }
                        ]
                    },
                    {
                        title: "Novedades de Campo",
                        rows: [
                            {
                                id: "cmd_2",
                                title: "2️⃣ Reportar Avance",
                                description: "Informar porcentaje de avance en tu tarea asignada"
                            },
                            {
                                id: "cmd_3",
                                title: "3️⃣ Reportar Incidencia",
                                description: "Avisar rotura de cañería, vicio o falta de herramienta"
                            },
                            {
                                id: "cmd_4",
                                title: "4️⃣ Demora de Materiales",
                                description: "Notificar atraso de corralón o falta de suministros"
                            }
                        ]
                    },
                    {
                        title: "Comprobantes, Sueldos & Salud",
                        rows: [
                            {
                                id: "cmd_7",
                                title: "7️⃣ Recibo de Sueldo",
                                description: "Ver y firmar digitalmente tu recibo quincenal UOCRA"
                            },
                            {
                                id: "cmd_5",
                                title: "5️⃣ Rendir Gasto / Ticket",
                                description: "Enviar foto de ticket para reintegro de caja chica"
                            },
                            {
                                id: "cmd_6",
                                title: "6️⃣ Licencia Médica",
                                description: "Cargar certificado de médico y días de reposo"
                            }
                        ]
                    }
                ]
            }
        }
    };
}

export function buildActionButtonsMessage(bodyText, targetNumber, buttons = []) {
    return {
        messaging_product: "whatsapp",
        to: targetNumber,
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: bodyText
            },
            action: {
                buttons: buttons.map((b, i) => ({
                    type: "reply",
                    reply: {
                        id: b.id || `btn_${i + 1}`,
                        title: b.title.substring(0, 20) // WhatsApp limit: 20 chars per button title
                    }
                }))
            }
        }
    };
}

export function buildCirsocApprovalButtons(targetNumber, projectName = 'Torre Palermo', elemento = 'Losa Nivel +2') {
    return buildActionButtonsMessage(
        `📐 *Auditoría Estructural CIRSOC 201*\n\n*Obra:* ${projectName}\n*Elemento:* ${elemento}\n*Estado:* Armadura colocada y encofrado estanco.\n\n_¿Autoriza el inicio del colado de hormigón elaborado?_`,
        targetNumber,
        [
            { id: "cirsoc_approve", title: "✅ Aprobar Llenado" },
            { id: "cirsoc_observe", title: "⚠️ Con Observación" },
            { id: "cirsoc_reject", title: "🚨 Rechazar Armadura" }
        ]
    );
}

export function buildRemitoConfirmButtons(targetNumber, material = 'Cemento Loma Negra (200 bolsas)', proveedor = 'Corralón Palermo') {
    return buildActionButtonsMessage(
        `📸 *Recepción de Materiales (OCR AFIP)*\n\n*Material:* ${material}\n*Proveedor:* ${proveedor}\n*Comprobante:* Remito Oficial Detectado.\n\n_¿Confirmás el ingreso para actualizar el stock y caja chica?_`,
        targetNumber,
        [
            { id: "remito_confirm", title: "✅ Confirmar Stock" },
            { id: "remito_edit", title: "✏️ Modificar Cantidad" },
            { id: "remito_photo", title: "📸 Reenviar Foto" }
        ]
    );
}

export function buildPayslipNotificationButtons(targetNumber, workerName = 'Juan Zapata', quincena = '1ra Quincena', signUrl = '') {
    return buildActionButtonsMessage(
        `📄 *Recibo de Sueldo UOCRA (CCT 76/75)*\n\nHola ${workerName}, tu recibo correspondiente a la *${quincena}* está listo para su firma digital.\n\nLink seguro: ${signUrl}`,
        targetNumber,
        [
            { id: "payslip_sign", title: "✍️ Firmar Recibo" },
            { id: "payslip_view", title: "👁️ Ver Detalle" }
        ]
    );
}

// NEW: Inspection approval template for safety/structural inspections
export function buildInspectionApprovalButtons(targetNumber, inspectionType = 'Seguridad e Higiene', projectName = 'Torre Palermo', inspector = 'Ing. Mendez', score = 0, itemsFailed = []) {
    const failedSummary = itemsFailed.length > 0 
        ? `\n\n⚠️ *Observaciones (${itemsFailed.length}):*\n${itemsFailed.slice(0, 3).map(f => `• ${f.desc}: ${f.note || 'Sin detalle'}`).join('\n')}`
        : '\n\n✅ Sin observaciones críticas.';

    return buildActionButtonsMessage(
        `📋 *Inspección ${inspectionType}*\n\n*Obra:* ${projectName}\n*Inspector:* ${inspector}\n*Score:* ${score}%${failedSummary}\n\n_¿Cómo procede con esta inspección?_`,
        targetNumber,
        [
            { id: "insp_approve", title: "✅ Aprobar" },
            { id: "insp_observe", title: "⚠️ Observar" },
            { id: "insp_reject", title: "❌ Rechazar" }
        ]
    );
}

// NEW: ART/Insurance policy expiration alert
export function buildArtExpirationAlert(targetNumber, workerName, artCompany, expirationDate, daysRemaining) {
    const urgency = daysRemaining <= 7 ? '🚨 URGENTE' : daysRemaining <= 30 ? '⚠️ ATENCIÓN' : 'ℹ️ AVISO';
    return buildActionButtonsMessage(
        `${urgency} *Vencimiento de ART*\n\n*Operario:* ${workerName}\n*Aseguradora:* ${artCompany}\n*Vencimiento:* ${expirationDate}\n*Días restantes:* ${daysRemaining}\n\n_Ley 22.250 — El operario NO puede trabajar con ART vencida._`,
        targetNumber,
        [
            { id: "art_renew", title: "📞 Gestionar Póliza" },
            { id: "art_suspend", title: "⏸️ Suspender Operario" }
        ]
    );
}

// NEW: Weather interruption notification
export function buildWeatherAlertMessage(targetNumber, projectName, weatherCondition, recommendation) {
    return buildActionButtonsMessage(
        `🌧️ *Alerta Meteorológica*\n\n*Obra:* ${projectName}\n*Condición:* ${weatherCondition}\n*Recomendación:* ${recommendation}\n\n_¿Registrar suspensión parcial en el Libro de Obra Digital?_`,
        targetNumber,
        [
            { id: "weather_suspend", title: "⏸️ Suspender Tareas" },
            { id: "weather_continue", title: "✅ Continuar Obra" }
        ]
    );
}

// NEW: Daily progress summary for directors
export function buildDailySummaryMessage(state, targetNumber) {
    const projectName = state.projectConfig?.name || 'Obra';
    const avance = state.avancePercentage || 0;
    const operarios = Object.values(state.attendance || {}).filter(a => a.status === 'Presente').length;
    const totalOps = Object.keys(state.attendance || {}).length;
    const incidents = (state.incidents || []).filter(i => i.type === 'danger' || i.type === 'critical').length;
    const tasks = Object.values(state.tasks || {});
    const completedTasks = tasks.filter(t => t.progress === 100).length;

    return {
        messaging_product: "whatsapp",
        to: targetNumber,
        type: "text",
        text: {
            body: `📊 *Resumen Diario — ${projectName}*\n\n` +
                `🏗️ Avance Global: *${avance}%*\n` +
                `👷 Operarios Presentes: *${operarios}/${totalOps}*\n` +
                `✅ Tareas Completadas: *${completedTasks}/${tasks.length}*\n` +
                `🚨 Incidencias Críticas: *${incidents}*\n\n` +
                `📅 ${new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
                `_Enviado por ObraSaaS Enterprise — IA & Real-Time_`
        }
    };
}

// NEW: Libro de Obra digital entry confirmation
export function buildLibroObraConfirmation(targetNumber, entry) {
    return buildActionButtonsMessage(
        `📖 *Nuevo Asiento en Libro de Obra*\n\n*Fecha:* ${entry.date}\n*Clima:* ${entry.weather} ${entry.temperature ? `(${entry.temperature}°C)` : ''}\n*Operarios:* ${entry.workersPresent || entry.workers}\n*Tareas:* ${(entry.tasksPerformed || entry.tasks || '').substring(0, 100)}...\n*Firmante:* ${entry.signedBy || entry.director}\n*Hash SHA-256:* ${(entry.hash || '').substring(0, 16)}...\n\n_¿Confirma el asiento como Director de Obra?_`,
        targetNumber,
        [
            { id: "libro_confirm", title: "✅ Confirmar Asiento" },
            { id: "libro_edit", title: "✏️ Editar Asiento" }
        ]
    );
}

// Sprint Sep 2026 — Cita Reminder Template
export function buildCitaReminderMessage(targetNumber, appointment) {
    const { title, fecha, hora, tipo, participantes, notas } = appointment;
    return buildActionButtonsMessage(
        `📅 *Recordatorio de Cita — ObraSaaS*\n\n` +
        `*${title}*\n` +
        `📆 Fecha: ${fecha}\n` +
        `🕐 Hora: ${hora}\n` +
        `📋 Tipo: ${tipo}\n` +
        `👥 Participantes: ${(participantes || []).join(', ')}\n` +
        `${notas ? `📝 ${notas}` : ''}\n\n` +
        `_¿Confirmás tu asistencia a esta cita de obra?_`,
        targetNumber,
        [
            { id: 'cita_confirm', title: '✅ Confirmo Cita' },
            { id: 'cita_reschedule', title: '🔄 Reprogramar' }
        ]
    );
}

// Sprint Sep 2026 — Material Request Approved Notification
export function buildMaterialAprobadoMessage(targetNumber, request) {
    const itemsSummary = (request.items || []).map(i => `• ${i.cantidad} ${i.unidad} — ${i.descripcion}`).join('\n');
    return buildActionButtonsMessage(
        `✅ *Pedido de Material Aprobado*\n\n` +
        `*Solicitante:* ${request.solicitante} (${request.rol})\n` +
        `*Nro. OC:* ${request.nroOrdenCompra || 'Pendiente'}\n` +
        `*Proveedor:* ${request.proveedorAsignado || 'Por asignar'}\n\n` +
        `*Materiales:*\n${itemsSummary}\n\n` +
        `*Aprobado por:* ${request.aprobadaPor}\n` +
        `_El pedido será despachado al corralón/proveedor asignado._`,
        targetNumber,
        [
            { id: 'mat_track', title: '📦 Ver Estado' },
            { id: 'mat_contact', title: '📞 Contactar Prov.' }
        ]
    );
}

// Sprint Sep 2026 — End-of-Day Photo Report Request
export function buildEodReportRequest(targetNumber, workerName, projectName = 'Obra Activa') {
    return {
        messaging_product: 'whatsapp',
        to: targetNumber,
        type: 'text',
        text: {
            body: `📸 *Reporte Diario de Avance — 17:00 hs*\n\n` +
                `Hola ${workerName}, es hora del cierre de jornada en *${projectName}*.\n\n` +
                `Por favor enviá *una foto del sector donde trabajaste hoy* para registrar el avance físico en el Libro de Obra Digital.\n\n` +
                `📌 La foto quedará documentada con fecha, hora y geolocalización automática.\n\n` +
                `_ObraSaaS — Registro Diario Automatizado_`
        }
    };
}
