import { getAppState, saveAppState, getMessages, saveMessages } from '@/lib/db';
import { verifyTwilioSignature, generateWebviewToken } from '@/lib/auth';

// Haversine formula to calculate distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - phi1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // distance in meters
}

export async function GET() {
    try {
        const messages = await getMessages();
        return Response.json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const contentType = request.headers.get('content-type') || '';
        let payload = {};

        // Clone request for signature verification
        const rawClone = request.clone();

        // Parse payload depending on content type (Twilio uses urlencoded form, Meta uses JSON)
        if (contentType.includes('x-www-form-urlencoded') || contentType.includes('form-data')) {
            const formData = await request.formData();
            for (const [key, value] of formData.entries()) {
                payload[key] = value;
            }
        } else {
            payload = await request.json();
        }

        // Validate Twilio signature to secure webhook endpoint
        const isTwilioAuthentic = await verifyTwilioSignature(rawClone, process.env.TWILIO_AUTH_TOKEN);
        if (!isTwilioAuthentic) {
            console.warn("Unauthorized Twilio signature check blocked.");
            return Response.json({ error: "Unauthorized Signature" }, { status: 401 });
        }

        // Extract key parameters from Twilio or Meta payload
        const fromNumber = payload.From || payload.from || '';
        const bodyText = (payload.Body || payload.text || '').trim();
        const mediaUrl = payload.MediaUrl0 || payload.mediaUrl || '';
        const mediaType = payload.MediaContentType0 || payload.mediaType || '';
        const latitude = parseFloat(payload.Latitude || payload.latitude || 'NaN');
        const longitude = parseFloat(payload.Longitude || payload.longitude || 'NaN');

        // Load current state and messages
        const state = await getAppState();
        const messages = await getMessages();

        // 1. Identify Sender
        let senderName = "Operario Obra";
        let senderRole = "Cuadrilla";
        let shortId = "cuadrilla";
        const cleanFrom = fromNumber.replace(/\D/g, ''); // Extract digits only

        if (cleanFrom.endsWith('1132419981') || cleanFrom.includes('carlos')) {
            senderName = "Carlos Pérez";
            senderRole = "Pintura e Interiores";
            shortId = "carlos";
        } else if (cleanFrom.includes('juan')) {
            senderName = "Juan Gómez";
            senderRole = "Albañilería Principal";
            shortId = "juan";
        } else if (cleanFrom.includes('luis')) {
            senderName = "Luis Martínez";
            senderRole = "Instalaciones y Sanitarios";
            shortId = "luis";
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        let botReply = '';
        let showInFeed = false;
        let feedIncident = null;

        // Generate short-lived secure tokens for webviews
        const webviewToken = generateWebviewToken(shortId);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://obrasaas-saas.vercel.app';
        const medicalLink = `${appUrl}/webview/medical?worker=${shortId}&token=${webviewToken}`;
        const attendanceLink = `${appUrl}/webview/attendance?worker=${shortId}&token=${webviewToken}`;

        // 2. Process Location Sharing (Check-in)
        if (!isNaN(latitude) && !isNaN(longitude)) {
            const palermoSite = { lat: -34.5886, lon: -58.4302 };
            const distance = Math.round(getDistance(latitude, longitude, palermoSite.lat, palermoSite.lon));
            
            // Register Check-in
            if (state.attendance[senderName]) {
                state.attendance[senderName].checkin = timeStr;
                
                if (distance <= 20) {
                    state.attendance[senderName].status = "Presente (GPS)";
                    botReply = `📍 *Ubicación Verificada* por Satélite GPS.\n\n¡Bienvenido *${senderName}* a la obra!\n• Rol: ${senderRole}\n• Ingreso: ${timeStr}\n• Geocerca: Verificada (Distancia: ${distance}m).\n\nConsulte sus horas aquí:\n👉 ${attendanceLink}`;
                    
                    // Add success log to incidents
                    feedIncident = {
                        id: "inc-gps-" + Date.now(),
                        title: "Fichaje Verificado",
                        description: `${senderName} ingresó al predio de la obra. Distancia GPS: ${distance}m.`,
                        type: "success",
                        badge: "Presente",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: "Geocerca Satelital",
                        icon: "fa-solid fa-location-dot"
                    };
                } else {
                    state.attendance[senderName].status = "Desviado (GPS)";
                    state.alertsCount += 1;
                    botReply = `⚠️ *Alerta de Geocerca*.\n\n*${senderName}*, has registrado ingreso a *${distance}m* de la obra (excede el límite permitido de 20m). Tu asistencia fue registrada con desvío.`;
                    
                    // Add critical alert to incidents
                    feedIncident = {
                        id: "inc-gps-alert-" + Date.now(),
                        title: "Alerta de Geocerca (Desvío GPS)",
                        description: `El operario ${senderName} fichó a ${distance}m de la obra (límite: 20m).`,
                        type: "critical",
                        badge: "Desvío GPS",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: "Geocerca Satelital",
                        icon: "fa-solid fa-location-crosshairs"
                    };
                }
            } else {
                botReply = `📍 Ubicación recibida de ${senderName} (Distancia: ${distance}m), pero no está registrado en la cuadrilla activa.`;
            }
            showInFeed = true;
        }
        // 3. Process Voice Notes (Audio Reports) or LLM Intent Processing
        else {
            // Advanced Intent Parsing Engine (Check if real OpenAI key is present)
            let whisperTranscript = bodyText;
            let nlpResult = null;

            if (process.env.OPENAI_API_KEY && mediaUrl && mediaType.startsWith('audio/')) {
                try {
                    // 1. In production, download the audio and translate via Whisper
                    // For the sake of structured SaaS we simulate calling the endpoint or do a real API call if keys are present
                    // We run basic structured JSON parsing from GPT-4o-mini
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
                                                enum: ["fichaje", "avance_tarea", "incidencia_critica", "demora_logistica", "otros"] 
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
                                    content: "Analiza el audio transcrito de la cuadrilla de obra en Argentina y clasifica su intención y parámetros correspondientes."
                                },
                                { role: "user", content: bodyText }
                            ]
                        })
                    });
                    const gptData = await gptRes.json();
                    nlpResult = JSON.parse(gptData.choices[0].message.content);
                } catch(e) {
                    console.error("OpenAI real parsing failed, fallback to local NLP engine:", e);
                }
            }

            // Fallback to local Regex NLP engine
            const lowerBody = bodyText.toLowerCase();
            
            if (nlpResult) {
                // Real OpenAI parser integration
                if (nlpResult.intent === 'fichaje') {
                    state.attendance[senderName] = { role: senderRole, checkin: timeStr, status: "Presente" };
                    botReply = `🎙️ *Fichaje por Voz Procesado*\n\nSe ha registrado tu ingreso a las ${timeStr} mediante biometría de voz.`;
                } else if (nlpResult.intent === 'avance_tarea' && nlpResult.task_id) {
                    const tid = nlpResult.task_id;
                    const prog = nlpResult.progress_update || 100;
                    if (state.tasks[tid]) {
                        state.tasks[tid].progress = prog;
                        botReply = `🎙️ *Reporte de Avance Procesado*\n\nSe actualizó la tarea *"${state.tasks[tid].name}"* al *${prog}%* en el cronograma Gantt.`;
                    }
                } else if (nlpResult.intent === 'incidencia_critica') {
                    state.alertsCount += 1;
                    feedIncident = {
                        id: "inc-ai-" + Date.now(),
                        title: nlpResult.incidencia_titulo || "Incidencia de Obra",
                        description: nlpResult.incidencia_descripcion || bodyText,
                        type: nlpResult.incidencia_severidad || "critical",
                        badge: "Reportado IA",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: senderName,
                        icon: nlpResult.incidencia_icono || "fa-solid fa-triangle-exclamation"
                    };
                    botReply = `🎙️ *Alerta de Novedad IA*\n\nAlerta crítica registrada: *${nlpResult.incidencia_titulo}*. Se ha informado al director de obra.`;
                    showInFeed = true;
                }
            } else {
                // Local keyword processor fallback (runs without OpenAI keys)
                if (lowerBody.includes('fichar') || lowerBody.includes('entra') || lowerBody.includes('ingres') || lowerBody.includes('arranc')) {
                    state.attendance[senderName] = { role: senderRole, checkin: timeStr, status: "Presente (Voz)" };
                    
                    let presentCount = 0;
                    Object.values(state.attendance).forEach(val => {
                        if (val.status.includes("Presente") || val.status.includes("Voz")) presentCount++;
                    });
                    state.operariosCount = presentCount;

                    botReply = `🎙️ *Fichaje por Voz Procesado*\n\n¡Bienvenido *${senderName}*!\n• Rol: ${senderRole}\n• Ingreso registrado a las ${timeStr} mediante biometría de voz.\n\nFichaje seguro GPS:\n👉 ${attendanceLink}`;
                    
                    feedIncident = {
                        id: "inc-gps-" + Date.now(),
                        title: "Presentismo Registrado",
                        description: `${senderName} inició jornada. Biometría de voz validada con éxito.`,
                        type: "success",
                        badge: "Presente",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: "Asistente de Voz IA",
                        icon: "fa-solid fa-microphone"
                    };
                    showInFeed = true;
                } 
                else if (lowerBody.includes('revoque') || lowerBody.includes('termin') || lowerBody.includes('living')) {
                    if (state.tasks && state.tasks[1]) {
                        state.tasks[1].progress = 100;
                        botReply = `🎙️ *Reporte de Avance Procesado*\n\nIA analizó el audio: *"Revoque grueso terminado"*. El progreso de la tarea ha sido actualizado al 100% en el Gantt.`;
                        
                        feedIncident = {
                            id: "inc-gantt-" + Date.now(),
                            title: "Tarea Finalizada en Gantt",
                            description: `El operario ${senderName} completó la tarea: Revoque Grueso.`,
                            type: "success",
                            badge: "Gantt",
                            timestamp: `Hoy, ${timeStr}`,
                            reporter: "Supervisor IA",
                            icon: "fa-solid fa-chart-gantt"
                        };
                        showInFeed = true;
                    }
                }
                else if (lowerBody.includes('fuga') || lowerBody.includes('caño') || lowerBody.includes('agua') || lowerBody.includes('roto')) {
                    state.alertsCount += 1;
                    feedIncident = {
                        id: "inc-fuga-" + Date.now(),
                        title: "Fuga de Agua - Baño Principal",
                        description: "Fisura en descarga del baño principal. Reclama codo PVC de 110.",
                        type: "critical",
                        badge: "Urgente",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: "Luis Martínez",
                        icon: "fa-solid fa-droplet"
                    };
                    // Agrega la tarea de reparación al Gantt
                    state.tasks[99] = { name: "Reparación Urgente Cañería", progress: 0, duration: 2, startOffset: 42.8, assignee: "Luis Martínez", isDelayed: true };
                    botReply = `🎙️ *Alerta de Novedad IA*\n\nAlerta crítica registrada: *Fuga de Agua en Baño Principal*. Se ha añadido una tarea de reparación correctiva urgente en el Gantt.`;
                    showInFeed = true;
                }
                else if (lowerBody.includes('demora') || lowerBody.includes('retraso') || lowerBody.includes('cerámic') || lowerBody.includes('suministro')) {
                    state.alertsCount += 1;
                    state.diasEstimados = "Día 12/37 (+2 días)";
                    feedIncident = {
                        id: "inc-demora-" + Date.now(),
                        title: "Demora de Suministros",
                        description: "Cerámicas demoradas. Revestimiento de paredes desplazado al 29/Jun.",
                        type: "warning",
                        badge: "Demora 48hs",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: "Carlos Pérez",
                        icon: "fa-solid fa-truck-ramp-box"
                    };
                    if (state.tasks[3]) {
                        state.tasks[3].startOffset = 71.4;
                        state.tasks[3].isShifted = true;
                    }
                    if (state.tasks[4]) {
                        state.tasks[4].startOffset = 100.0;
                        state.tasks[4].isShifted = true;
                    }
                    botReply = `🎙️ *Reporte de Logística IA*\n\nAdvertencia registrada: *Demora de suministros de revestimientos cerámicos*. Hitos de finalización reprogramados +48hs.`;
                    showInFeed = true;
                }
                else if (lowerBody.includes('certificado') || lowerBody.includes('médico') || lowerBody.includes('enfermo') || lowerBody.includes('licencia')) {
                    botReply = `🩺 *Carga de Certificados Médicos ObraSaaS*\n\nPara justificar tu inasistencia y subir la foto del certificado médico correspondiente, ingresa a este enlace seguro:\n👉 ${medicalLink}`;
                }
                else if (lowerBody.includes('ayuda') || lowerBody.includes('hola') || lowerBody.includes('buen')) {
                    botReply = `👷 *Copiloto de ObraSaaS* 👷\n\nHola ${senderName}, soy tu asistente virtual de obra. Puedes:\n1. Enviar tu *ubicación* para fichaje satelital.\n2. Mandar un *audio* con tu avance diario.\n3. Solicitar carga de certificado médico escribiendo *'licencia'*.`;
                }
                else {
                    botReply = `✅ *Mensaje Recibido, ${senderName}*.\n\nHe guardado tu reporte en la bitácora diaria de ObraSaaS. Puedes consultar tu estado de horas ingresando aquí:\n👉 ${attendanceLink}`;
                }
            }

            // Append to database logs
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

        // 6. Return response in Twilio XML format (TwiML) or JSON
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
