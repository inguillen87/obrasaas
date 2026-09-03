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

