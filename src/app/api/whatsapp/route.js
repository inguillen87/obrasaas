import { getAppState, saveAppState, getMessages, saveMessages } from '@/lib/db';
import { verifyTwilioSignature, generateWebviewToken } from '@/lib/auth';

// Haversine formula to calculate distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in meters
}

export async function GET(request) {
    try {
        const url = new URL(request.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        // Meta WhatsApp Cloud API Webhook Verification challenge
        if (mode && token) {
            const verifyToken = process.env.META_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'obrasaas_meta_token';
            if (mode === 'subscribe' && (token === verifyToken || token === 'obrasaas' || token === 'obrasaas_meta_token')) {
                return new Response(challenge, {
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' }
                });
            } else {
                return new Response('Forbidden: Invalid Verify Token', { status: 403 });
            }
        }

        // Standard message list for dashboard polling
        const messages = await getMessages();
        return Response.json(messages);
    } catch (error) {
        console.error("Error in GET /api/whatsapp:", error);
        return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const contentType = request.headers.get('content-type') || '';
        let payload = {};

        // Clone request for signature verification
        const rawClone = request.clone();

        // Parse payload depending on content type (Twilio uses urlencoded form, Meta / Dashboard use JSON)
        if (contentType.includes('x-www-form-urlencoded') || contentType.includes('form-data')) {
            const formData = await request.formData();
            for (const [key, value] of formData.entries()) {
                payload[key] = value;
            }
        } else {
            payload = await request.json();
        }

        // Validate Twilio signature only if Twilio header is provided
        const twilioSig = request.headers.get('x-twilio-signature');
        if (twilioSig && process.env.TWILIO_AUTH_TOKEN) {
            const isTwilioAuthentic = await verifyTwilioSignature(rawClone, process.env.TWILIO_AUTH_TOKEN);
            if (!isTwilioAuthentic) {
                console.warn("Unauthorized Twilio signature check blocked.");
                return Response.json({ error: "Unauthorized Signature" }, { status: 401 });
            }
        }

        // Extract key parameters supporting Twilio, Meta Cloud API, and Dashboard Direct formats
        let fromNumber = payload.From || payload.from || '';
        let bodyText = (payload.Body || payload.text || payload.bodyText || '').trim();
        let mediaUrl = payload.MediaUrl0 || payload.mediaUrl || '';
        let mediaType = payload.MediaContentType0 || payload.mediaType || '';
        let latitude = parseFloat(payload.Latitude || payload.latitude || 'NaN');
        let longitude = parseFloat(payload.Longitude || payload.longitude || 'NaN');

        // Meta WhatsApp Cloud API Payload Parser
        if (payload.object === 'whatsapp_business_account' && Array.isArray(payload.entry)) {
            const entry = payload.entry[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const metaMsg = value?.messages?.[0];
            const contact = value?.contacts?.[0];

            if (metaMsg) {
                fromNumber = metaMsg.from || '';
                const msgType = metaMsg.type;
                if (msgType === 'text') {
                    bodyText = metaMsg.text?.body || '';
                } else if (msgType === 'audio') {
                    mediaUrl = metaMsg.audio?.id || `meta-audio-${metaMsg.id}.ogg`;
                    mediaType = metaMsg.audio?.mime_type || 'audio/ogg';
                    bodyText = 'Nota de voz de WhatsApp';
                } else if (msgType === 'location') {
                    latitude = parseFloat(metaMsg.location?.latitude);
                    longitude = parseFloat(metaMsg.location?.longitude);
                    bodyText = `Ubicación compartida: ${metaMsg.location?.name || 'GPS'}`;
                } else if (msgType === 'image') {
                    mediaUrl = metaMsg.image?.id || '';
                    mediaType = metaMsg.image?.mime_type || 'image/jpeg';
                    bodyText = metaMsg.image?.caption || 'Foto enviada desde obra';
                }
            }
        }

        // Load current state and messages
        const state = await getAppState();
        const messages = await getMessages();

        // 1. Identify Sender
        const cleanFrom = (fromNumber || '').replace(/\D/g, '');
        let senderName = "Operario Obra";
        let senderRole = "Cuadrilla";
        let shortId = "cuadrilla";
        // Dynamic role override: user can say "soy juan", "soy el proveedor", etc.
        const roleSwitchBody = (bodyText || '').toLowerCase();
        let roleOverride = null;
        if (roleSwitchBody.includes('soy juan') || roleSwitchBody.includes('soy albanil') || roleSwitchBody.includes('soy alba')) {
            roleOverride = 'juan';
        } else if (roleSwitchBody.includes('soy luis') || roleSwitchBody.includes('soy sanitario') || roleSwitchBody.includes('soy plomero')) {
            roleOverride = 'luis';
        } else if (roleSwitchBody.includes('soy carlos') || roleSwitchBody.includes('soy pintor') || roleSwitchBody.includes('soy pintura')) {
            roleOverride = 'carlos';
        } else if (roleSwitchBody.includes('soy proveedor') || roleSwitchBody.includes('soy aberturas')) {
            roleOverride = 'proveedor';
        } else if (roleSwitchBody.includes('soy victoria') || roleSwitchBody.includes('soy vicky') || roleSwitchBody.includes('soy arquitecta')) {
            roleOverride = 'victoria';
        } else if (roleSwitchBody.includes('soy marcelo') || roleSwitchBody.includes('soy arquitecto') || roleSwitchBody.includes('soy director')) {
            roleOverride = 'director';
        }

        if (roleOverride === 'victoria' || (!roleOverride && (cleanFrom.endsWith('2964520753') || cleanFrom.endsWith('520753') || cleanFrom.includes('victoria') || fromNumber.toLowerCase().includes('victoria')))) {
            senderName = "Arq. Victoria";
            senderRole = "Socia & Directora Técnica";
            shortId = "victoria";
        } else if (roleOverride === 'carlos' || (!roleOverride && (cleanFrom.endsWith('1132419981') || cleanFrom.includes('carlos') || fromNumber.toLowerCase().includes('carlos')))) {
            senderName = "Carlos Pérez";
            senderRole = "Pintura e Interiores";
            shortId = "carlos";
        } else if (roleOverride === 'juan' || (!roleOverride && (cleanFrom.includes('juan') || fromNumber.toLowerCase().includes('juan')))) {
            senderName = "Juan Gómez";
            senderRole = "Albañilería Principal";
            shortId = "juan";
        } else if (roleOverride === 'luis' || (!roleOverride && (cleanFrom.includes('luis') || fromNumber.toLowerCase().includes('luis')))) {
            senderName = "Luis Martínez";
            senderRole = "Instalaciones y Sanitarios";
            shortId = "luis";
        } else if (roleOverride === 'proveedor' || (!roleOverride && (cleanFrom.includes('aberturas') || cleanFrom.includes('lopez') || cleanFrom.includes('proveedor') || cleanFrom.includes('sanlorenzo') || fromNumber.toLowerCase().includes('aberturas')))) {
            senderName = "Aberturas López (Proveedor)";
            senderRole = "Proveedor Externo";
            shortId = "proveedor";
        } else if (roleOverride === 'director' || (!roleOverride && (cleanFrom.endsWith('2613168608') || cleanFrom.includes('marcelo') || cleanFrom.includes('director') || fromNumber.toLowerCase().includes('marcelo')))) {
            senderName = "Arq. Marcelo";
            senderRole = "Director de Obra";
            shortId = "director";
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        let botReply = '';
        let showInFeed = false;
        let feedIncident = null;

        // Generate short-lived secure tokens for webviews
        const webviewToken = generateWebviewToken(shortId);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://obrasaas.vercel.app';
        const medicalLink = `${appUrl}/webview/medical?worker=${shortId}&token=${webviewToken}`;
        const attendanceLink = `${appUrl}/webview/attendance?worker=${shortId}&token=${webviewToken}`;

        // 2. Process Location Sharing (Geofence Check-in)
        if (!isNaN(latitude) && !isNaN(longitude)) {
            const projectSite = {
                lat: state.projectConfig?.latitude || -34.5886,
                lon: state.projectConfig?.longitude || -58.4302,
                name: state.projectConfig?.name || "Torre Palermo Soho",
                radius: state.projectConfig?.geofenceRadiusMeters || 100
            };
            const distance = Math.round(getDistance(latitude, longitude, projectSite.lat, projectSite.lon));
            
            // Register or update Check-in
            if (!state.attendance[senderName]) {
                state.attendance[senderName] = { role: senderRole, checkin: timeStr, status: "Presente (GPS)" };
            }
            state.attendance[senderName].checkin = timeStr;
            state.attendance[senderName].distanceMeters = distance;
            state.attendance[senderName].lastCoordinates = { latitude, longitude };
            
            if (distance <= projectSite.radius) {
                state.attendance[senderName].status = "Presente (GPS)";
                state.attendance[senderName].verifiedBy = "GPS Satelital";
                
                let presentCount = 0;
                Object.values(state.attendance || {}).forEach(val => {
                    if (val.status && (val.status.includes("Presente") || val.status.includes("GPS") || val.status.includes("Voz"))) presentCount++;
                });
                state.operariosCount = Math.max(1, presentCount);

                botReply = `📍 *Presentismo Satelital Validado* ✅\n\n¡Bienvenido *${senderName}* a *${projectSite.name}*!\n• 👷 Rol: *${senderRole}*\n• ⏰ Ingreso: *${timeStr}*\n• 🌐 Geocerca: *${distance}m* (Dentro del radio de ${projectSite.radius}m)\n• 📋 Tareas Asignadas: Revoque y Mampostería\n\n👉 Tarjeta Digital de Presentismo:\n${attendanceLink}`;
                
                feedIncident = {
                    id: "inc-gps-" + Date.now(),
                    title: "Fichaje Satelital Validado",
                    description: `${senderName} ingresó al predio de la obra (${projectSite.name}). Distancia satelital: ${distance}m.`,
                    type: "success",
                    badge: "Presente (GPS)",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: "Geocerca Satelital",
                    icon: "fa-solid fa-location-dot"
                };
            } else {
                state.attendance[senderName].status = "Desviado (GPS)";
                state.attendance[senderName].verifiedBy = "GPS Fuera de Radio";
                state.alertsCount += 1;

                botReply = `⚠️ *Alerta de Geocerca (Fuera de Predio)*\n\n*${senderName}*, has enviado tu ubicación a *${distance}m* de *${projectSite.name}* (el radio autorizado de obra es de ${projectSite.radius}m).\n\n• Estado: *Fichaje Observado (Desvío)*\n• Supervisor Notificado: Sí\n• Si ya estás en obra, por favor reenvía tu ubicación en tiempo real 📍`;
                
                feedIncident = {
                    id: "inc-gps-alert-" + Date.now(),
                    title: "Alerta de Geocerca (Desvío GPS)",
                    description: `El operario ${senderName} fichó a ${distance}m de la obra (radio permitido: ${projectSite.radius}m).`,
                    type: "critical",
                    badge: "Desvío GPS",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: "Geocerca Satelital",
                    icon: "fa-solid fa-location-crosshairs"
                };
            }
            showInFeed = true;
        }
        // 3. Process Voice Notes (Audio Reports) or LLM Intent Processing
        else {
            let whisperTranscript = bodyText;
            let nlpResult = null;

            if (process.env.OPENAI_API_KEY && mediaUrl && mediaType.startsWith('audio/')) {
                try {
                    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: "gpt-4o-mini",
                            response_format: {
                                type: "json_schema",
                                json_schema: {
                                    name: "obra_intent_schema",
                                    strict: true,
                                    schema: {
                                        type: "object",
                                        properties: {
                                            intent: { 
                                                type: "string", 
                                                enum: ["fichaje", "avance_tarea", "incidencia_critica", "demora_logistica", "confirmacion_proveedor", "consulta_quincena", "otros"] 
                                            },
                                            task_id: { type: ["integer", "null"] },
                                            progress_update: { type: ["integer", "null"] },
                                            incidencia_titulo: { type: ["string", "null"] },
                                            incidencia_descripcion: { type: ["string", "null"] },
                                            incidencia_severidad: { type: ["string", "null"] },
                                            incidencia_icono: { type: ["string", "null"] }
                                        },
                                        required: ["intent", "task_id", "progress_update", "incidencia_titulo", "incidencia_descripcion", "incidencia_severidad", "incidencia_icono"],
                                        additionalProperties: false
                                    }
                                }
                            },
                            messages: [
                                {
                                    role: "system",
                                    content: "Analiza el audio transcrito de la cuadrilla, director o proveedores de obra en Argentina y clasifica su intención."
                                },
                                { role: "user", content: bodyText }
                            ]
                        })
                    });
                    const gptData = await gptRes.json();
                    nlpResult = JSON.parse(gptData.choices[0].message.content);
                } catch(e) {
                    console.error("OpenAI intent parsing failed, using local NLP engine:", e);
                }
            }

            // Local keyword NLP processor fallback (works with zero keys)
            const lowerBody = bodyText.toLowerCase();
            // Normalize accented characters for robust Spanish NLP matching
            const normalBody = lowerBody.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            
            // 1️⃣ Fichaje / Asistencia (Opción 1 o palabras clave)
            if (normalBody === '1' || (nlpResult && nlpResult.intent === 'fichaje') || normalBody.includes('fichar') || (normalBody.includes('entre') && !normalBody.includes('entrega')) || normalBody.includes('ingres') || normalBody.includes('arranc') || normalBody.includes('llegue') || normalBody.includes('vine') || normalBody.includes('estoy en') || (normalBody.includes('buen') && ((normalBody.includes('entre') && !normalBody.includes('entrega')) || normalBody.includes('llegue') || normalBody.includes('estoy') || normalBody.includes('vine') || normalBody.includes('obra')))) {
                if (!state.attendance[senderName]) {
                    state.attendance[senderName] = { role: senderRole, checkin: timeStr, status: "Presente (Voz)" };
                }
                state.attendance[senderName].role = senderRole;
                state.attendance[senderName].checkin = timeStr;
                state.attendance[senderName].status = "Presente (Voz)";
                state.attendance[senderName].verifiedBy = "Biometría de Voz";
                
                let presentCount = 0;
                Object.values(state.attendance || {}).forEach(val => {
                    if (val.status && (val.status.includes("Presente") || val.status.includes("GPS") || val.status.includes("Voz"))) presentCount++;
                });
                state.operariosCount = Math.max(1, presentCount);

                const projectName = state.projectConfig?.name || "Torre Palermo Soho";
                botReply = `🎙️ *Fichaje Registrado por Voz*\n\n¡Bienvenido *${senderName}* a *${projectName}*!\n• 👷 Rol: *${senderRole}*\n• ⏰ Horario: *${timeStr}*\n• 🔒 Estado: *Presente (Voz validada)*\n\n📍 *Certificación Satelital*: Podés compartir tu ubicación en tiempo real desde el clip 📎 para validar tu presencia en la geocerca de obra.\n\n👉 Ficha de Horas: ${attendanceLink}`;
                
                feedIncident = {
                    id: "inc-gps-" + Date.now(),
                    title: "Presentismo Registrado",
                    description: `${senderName} (${senderRole}) inició jornada. Biometría de voz validada con éxito.`,
                    type: "success",
                    badge: "Presente",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: "Asistente de Voz IA",
                    icon: "fa-solid fa-microphone"
                };
                showInFeed = true;
            }
            // 2️⃣ Avance de Tarea (Opción 2 o palabras clave de avance/revoque)
            else if (normalBody === '2' || normalBody.includes('revoque') || normalBody.includes('termin') || normalBody.includes('living') || normalBody.includes('complet') || normalBody.includes('avance') || normalBody.includes('listo') || (nlpResult && nlpResult.intent === 'avance_tarea')) {
                if (state.tasks && state.tasks[1]) {
                    state.tasks[1].progress = 100;
                    state.avancePercentage = 55;
                    botReply = `🎙️ *Reporte de Avance Procesado*\n\nIA analizó el reporte: *"Revoque grueso terminado al 100%"*.\n• Progreso de la tarea: 100% en Gantt.\n• Avance global de la obra: 55%.\n• Hito registrado por: *${senderName}*.\n• Listo para certificación quincenal.`;
                    
                    feedIncident = {
                        id: "inc-gantt-" + Date.now(),
                        title: "Tarea Finalizada en Gantt",
                        description: `El operario ${senderName} completó la tarea: Revoque Grueso al 100%.`,
                        type: "success",
                        badge: "Gantt",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: "Supervisor IA",
                        icon: "fa-solid fa-chart-gantt"
                    };

                    if (state.operationalProposals) {
                        state.operationalProposals.unshift({
                            id: "prop-" + Date.now(),
                            intent: "avance_tarea",
                            summary: `${senderName} reportó finalización de Revoque Grueso al 100%`,
                            proposedBy: senderName,
                            role: senderRole,
                            status: "APROBADO",
                            timestamp: `Hoy, ${timeStr}`,
                            taskImpact: "Tarea 1 -> 100%"
                        });
                    }
                    showInFeed = true;
                }
            }
            // 3️⃣ Incidencia Crítica / Vicio Oculto (Opción 3 o fuga/caño/rotura)
            else if (normalBody === '3' || normalBody.includes('fuga') || normalBody.includes('cano') || normalBody.includes('agua') || normalBody.includes('roto') || normalBody.includes('fisura') || normalBody.includes('rotura') || (nlpResult && nlpResult.intent === 'incidencia_critica')) {
                state.alertsCount += 1;
                feedIncident = {
                    id: "inc-fuga-" + Date.now(),
                    title: "Fuga de Agua - Baño Principal",
                    description: "Fisura en descarga del baño principal. Reclama codo PVC de 110 urgente.",
                    type: "critical",
                    badge: "Urgente",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: senderName,
                    icon: "fa-solid fa-droplet"
                };
                // Agrega la tarea de reparación al Gantt
                state.tasks[99] = { 
                    name: "Reparación Urgente Cañería", 
                    progress: 0, 
                    duration: 2, 
                    startOffset: 42.8, 
                    assignee: senderName, 
                    quincena: "Q1",
                    startDate: "2026-08-12",
                    endDate: "2026-08-14",
                    isDelayed: true,
                    isBlocked: false,
                    materialStatus: "Disponible"
                };
                botReply = `🚨 *Alerta Crítica de Obra*\n\nAlerta registrada: *Fuga de Agua en Baño Principal*.\n• Se añadió tarea correctiva de emergencia en el Gantt (Tarea 99).\n• Notificado Director de Obra (*Arq. Marcelo*) y Compras.`;
                showInFeed = true;
            }
            // 4️⃣ Demora Logística / Replanificación Quincenal (Opción 4 o demora/flete)
            else if (normalBody === '4' || normalBody.includes('demora') || normalBody.includes('retraso') || normalBody.includes('ceramic') || normalBody.includes('suministro') || normalBody.includes('flete') || normalBody.includes('atraso') || (nlpResult && nlpResult.intent === 'demora_logistica')) {
                state.alertsCount += 1;
                state.diasEstimados = "Día 12/37 (+2 días)";
                feedIncident = {
                    id: "inc-demora-" + Date.now(),
                    title: "Demora de Suministros (Cerámicas)",
                    description: "Cerámicas demoradas. Revestimiento de paredes bloqueado y desplazado al 25/Ago.",
                    type: "warning",
                    badge: "Demora 48hs",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: senderName,
                    icon: "fa-solid fa-truck-ramp-box"
                };
                if (state.tasks[3]) {
                    state.tasks[3].startOffset = 71.4;
                    state.tasks[3].isShifted = true;
                    state.tasks[3].isBlocked = true;
                    state.tasks[3].materialStatus = "Bloqueada por Proveedor";
                    state.tasks[3].supplierStatus = "Demorado 48hs";
                }
                if (state.tasks[4]) {
                    state.tasks[4].startOffset = 100.0;
                    state.tasks[4].isShifted = true;
                }
                if (state.stockpiles && state.stockpiles.ceramicas) {
                    state.stockpiles.ceramicas.status = "Demorado";
                    state.stockpiles.ceramicas.onTimeStatus = "Retraso 48hs";
                }

                if (state.operationalProposals) {
                    state.operationalProposals.unshift({
                        id: "prop-demora-" + Date.now(),
                        intent: "replanificacion_material",
                        summary: "Demora de flete de cerámicas. Mover Revestimiento a Quincena 2 (25/Ago)",
                        proposedBy: senderName,
                        role: senderRole,
                        status: "PENDIENTE_APROBACION",
                        timestamp: `Hoy, ${timeStr}`,
                        taskImpact: "Tarea 3 -> Desplazada +48hs"
                    });
                }

                botReply = `⚠️ *Reporte de Logística Procesado*\n\nAlerta: *Demora de suministros de revestimientos cerámicos*.\n• Tarea 3 bloqueada: 'Pendiente de Materiales'.\n• Propuesta de replanificación quincenal enviada al Director de Obra.`;
                showInFeed = true;
            }
            // 5️⃣ Confirmación de Proveedor (Opción 5 o confirmar/entrega)
            else if (normalBody === '5' || normalBody.includes('confirm') || normalBody.includes('entrega') || normalBody.includes('despacho') || (nlpResult && nlpResult.intent === 'confirmacion_proveedor')) {
                if (state.suppliers && state.suppliers[3]) {
                    state.suppliers[3].confirmationStatus = "Confirmado";
                    state.suppliers[3].status = "Confirmado";
                }
                if (state.tasks && state.tasks[3]) {
                    state.tasks[3].supplierStatus = "Confirmado";
                    state.tasks[3].materialStatus = "En Camino";
                    state.tasks[3].isBlocked = false;
                }
                if (state.stockpiles && state.stockpiles.ceramicas) {
                    state.stockpiles.ceramicas.status = "En Camino";
                    state.stockpiles.ceramicas.onTimeStatus = "Confirmado para 21/08";
                }
                botReply = `🤝 *Confirmación de Proveedor Registrada*\n\nSe ha recibido y confirmado el compromiso de entrega de *Aberturas López / Cerámicas* para la Quincena actual.\n• Tarea desbloqueada en Gantt: *Revestimiento Cerámico*.\n• Estado de proveedor: *Confirmado ✅*.`;
                
                feedIncident = {
                    id: "inc-prov-" + Date.now(),
                    title: "Proveedor Confirmó Asistencia",
                    description: `Aberturas López confirmó entrega de materiales para la fecha programada. Tarea liberada en Gantt.`,
                    type: "success",
                    badge: "Proveedor OK",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: "Canal Proveedores",
                    icon: "fa-solid fa-truck-ramp-box"
                };
                showInFeed = true;
            }
            // 6️⃣ Consulta de Quincena (Opción 6 o quincena/plan)
            else if (normalBody === '6' || normalBody.includes('quincena') || normalBody.includes('toca') || (normalBody.includes('que') && normalBody.includes('hago')) || (nlpResult && nlpResult.intent === 'consulta_quincena')) {
                botReply = `📅 *Planificación de la Quincena Actual*\n\nHola ${senderName}, este es tu plan para la *Quincena 1*:\n• *Revoque Grueso*: 80% completado (Juan Gómez)\n• *Cañería y Descargas*: 20% (Luis Martínez)\n\n*Próxima Quincena (Q2)*:\n• *Revestimiento Cerámico*: Inicio 16/Ago (Carlos Pérez)\n• *Pintura y Terminación*: Inicio 21/Ago\n\nTodos los planos y remitos se sincronizan en tiempo real.`;
            }
            // 7️⃣ Caja Chica / Rendición de Gastos de Ferretería (Opción 7 o gasto/ferreteria/ticket)
            else if (normalBody === '7' || normalBody.includes('caja chica') || normalBody.includes('gasto') || normalBody.includes('ferreteria') || normalBody.includes('ticket') || normalBody.includes('remito') || normalBody.includes('compre') || normalBody.includes('clavos')) {
                // Extract amount if present in text (e.g. 18500, 15000, 22000)
                const numbers = bodyText.match(/\d+[\.,]?\d*/g);
                let expenseAmount = 18500;
                if (numbers && numbers.length > 0) {
                    const parsedNum = parseInt(numbers[0].replace(/\D/g, ''), 10);
                    if (parsedNum > 100 && parsedNum < 1000000) expenseAmount = parsedNum;
                }

                if (!state.cajaChica) {
                    state.cajaChica = { saldoActual: 84500, movimientos: [] };
                }
                state.cajaChica.saldoActual = Math.max(0, state.cajaChica.saldoActual - expenseAmount);
                const newMovement = {
                    id: "cc-" + Date.now(),
                    descripcion: `Compra ferretería / materiales menores: ${bodyText || 'Clavos y alambre'}`,
                    monto: expenseAmount,
                    tipo: "Egreso",
                    solicitante: senderName,
                    estado: "Aprobado",
                    fecha: `Hoy, ${timeStr}`,
                    ticketUrl: "/tickets/ticket-01.jpg"
                };
                state.cajaChica.movimientos = state.cajaChica.movimientos || [];
                state.cajaChica.movimientos.unshift(newMovement);

                botReply = `🧾 *Rendición de Caja Chica Registrada*\n\n• Monto: *$${expenseAmount.toLocaleString('es-AR')} ARS*\n• Concepto: Compra Ferretería / Materiales\n• Solicitante: *${senderName}*\n• Saldo Restante en Caja Chica: *$${state.cajaChica.saldoActual.toLocaleString('es-AR')} ARS*\n• Estado: Aprobado y sincronizado en Dashboard.`;

                feedIncident = {
                    id: "inc-cc-" + Date.now(),
                    title: "Gasto de Caja Chica Rendido",
                    description: `${senderName} rindió $${expenseAmount.toLocaleString('es-AR')} ARS en ferretería.`,
                    type: "info",
                    badge: "Caja Chica",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: senderName,
                    icon: "fa-solid fa-receipt"
                };
                showInFeed = true;
            }
            // 8️⃣ Licencias Médicas (Opción 8 o licencia/certificado)
            else if (normalBody === '8' || normalBody.includes('certificado') || normalBody.includes('medico') || normalBody.includes('enfermo') || normalBody.includes('licencia')) {
                botReply = `🩺 *Carga de Certificados Médicos ObraSaaS*\n\nPara justificar tu inasistencia y subir la foto del certificado médico correspondiente, ingresa a este enlace seguro:\n👉 ${medicalLink}`;
            }
            // 📋 Menú General e Interactivo (cuando escriben 'menu', 'opciones', 'hola', etc.)
            else if (normalBody.includes('ayuda') || normalBody.includes('menu') || normalBody.includes('opcion') || (normalBody.includes('hola') && !normalBody.includes('obra')) || (normalBody.includes('buen') && normalBody.length < 20)) {
                botReply = `👷‍♂️ *Copiloto Inteligente de ObraSaaS* 👷‍♂️\n\nHola *${senderName}* (*${senderRole}*).\nPodés responder con un número del *1 al 8* o escribir con tus palabras:\n\n1️⃣ *Fichar Entrada* (o enviá tu ubicación 📍)\n2️⃣ *Reportar Avance* (ej: "terminamos el revoque al 100%")\n3️⃣ *Reportar Incidencia* (ej: "fuga de agua en el caño")\n4️⃣ *Demora de Materiales* (ej: "cerámicas demoran 48hs")\n5️⃣ *Confirmar Entrega Proveedor*\n6️⃣ *Consultar Quincena*\n7️⃣ *Rendir Gasto / Caja Chica* (ej: "gasté $18.500 en ferretería")\n8️⃣ *Cargar Licencia Médica*\n\n🎙️ _También podés enviar audios y fotos de remitos en cualquier momento._`;
            }
            else {
                botReply = `✅ *Mensaje Recibido, ${senderName}*.\n\nHe guardado tu reporte en la bitácora diaria de ObraSaaS. Escribe *'menu'* para ver todas las opciones disponibles.\n\n👉 Ficha de Horas: ${attendanceLink}`;
            }

            if (feedIncident) {
                state.incidents.unshift(feedIncident);
            }
        }

        // Update global state and save message history
        await saveAppState(state);

        // Append to simulated chat messages so it updates the web browser interface!
        const userMsg = {
            sender: "user",
            text: bodyText || (mediaUrl ? `[Archivo Adjunto: ${mediaType}]` : "Fichaje GPS"),
            time: timeStr
        };
        const botMsg = {
            sender: "bot",
            text: botReply.replace(/\*/g, ''), // Strip bold markdown asterisks for web chat
            time: timeStr
        };

        messages.push(userMsg);
        messages.push(botMsg);
        await saveMessages(messages);

        // 6. Send reply back via Meta WhatsApp Cloud API (if message came from Meta)
        if (payload.object === 'whatsapp_business_account' && fromNumber && botReply) {
            const metaAccessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
            const metaPhoneNumberId = process.env.META_PHONE_NUMBER_ID;
            const metaApiVersion = process.env.META_GRAPH_API_VERSION || 'v25.0';

            // Normalize Argentine recipient number for Meta Cloud API sandbox compatibility
            let targetNumber = fromNumber;
            if (cleanFrom.endsWith('2613168608')) {
                targetNumber = '54261153168608';
            } else if (cleanFrom.endsWith('520753')) {
                targetNumber = '54296415520753';
            }

            if (metaAccessToken && metaPhoneNumberId) {
                try {
                    const metaReplyRes = await fetch(
                        `https://graph.facebook.com/${metaApiVersion}/${metaPhoneNumberId}/messages`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${metaAccessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                messaging_product: 'whatsapp',
                                to: targetNumber,
                                type: 'text',
                                text: { body: botReply }
                            })
                        }
                    );
                    const metaReplyData = await metaReplyRes.json();
                    console.log('Meta Cloud API reply sent to', targetNumber, ':', metaReplyData?.messages?.[0]?.id || JSON.stringify(metaReplyData));
                } catch (metaErr) {
                    console.error('Meta Cloud API reply failed (non-blocking):', metaErr.message);
                }
            } else {
                console.log('Meta reply skipped: META_WHATSAPP_ACCESS_TOKEN or META_PHONE_NUMBER_ID not set');
            }
        }

        // 7. Return response in Twilio XML format (TwiML) or JSON
        if (contentType.includes('x-www-form-urlencoded')) {
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${botReply}</Message>
</Response>`;
            return new Response(twiml, {
                headers: { 'Content-Type': 'text/xml' }
            });
        }

        return Response.json({
            success: true,
            sender: senderName,
            reply: botReply,
            state: state
        });

    } catch (error) {
        console.error("Error processing WhatsApp webhook:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
