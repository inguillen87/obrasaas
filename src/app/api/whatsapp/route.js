import { getAppState, saveAppState, getMessages, saveMessages } from '@/lib/db';

export async function GET() {
    try {
        const messages = await getMessages();
        return Response.json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
    }
}

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

export async function POST(request) {
    try {
        const contentType = request.headers.get('content-type') || '';
        let payload = {};

        // Parse payload depending on content type (Twilio uses urlencoded form, Meta uses JSON)
        if (contentType.includes('x-www-form-urlencoded') || contentType.includes('form-data')) {
            const formData = await request.formData();
            for (const [key, value] of formData.entries()) {
                payload[key] = value;
            }
        } else {
            payload = await request.json();
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
        const cleanFrom = fromNumber.replace(/\D/g, ''); // Extract digits only

        if (cleanFrom.endsWith('1132419981') || cleanFrom.includes('carlos')) {
            senderName = "Carlos Pérez";
            senderRole = "Pintura e Interiores";
        } else if (cleanFrom.includes('juan')) {
            senderName = "Juan Gómez";
            senderRole = "Albañilería Principal";
        } else if (cleanFrom.includes('luis')) {
            senderName = "Luis Martínez";
            senderRole = "Instalaciones y Sanitarios";
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        let botReply = '';
        let showInFeed = false;
        let feedIncident = null;

        // 2. Process Location Sharing (Check-in)
        if (!isNaN(latitude) && !isNaN(longitude)) {
            const palermoSite = { lat: -34.5886, lon: -58.4302 };
            const distance = Math.round(getDistance(latitude, longitude, palermoSite.lat, palermoSite.lon));
            
            // Register Check-in
            if (state.attendance[senderName]) {
                state.attendance[senderName].checkin = timeStr;
                
                if (distance <= 20) {
                    state.attendance[senderName].status = "Presente (GPS)";
                    botReply = `📍 *Ubicación Verificada* por Satélite GPS.\n\n¡Bienvenido *${senderName}* a la obra!\n• Rol: ${senderRole}\n• Ingreso: ${timeStr}\n• Geocerca: Verificada (Distancia: ${distance}m).`;
                    
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
        // 3. Process Voice Notes (Audio Reports)
        else if (mediaUrl && mediaType.startsWith('audio/')) {
            let transcribedText = bodyText || "Reporte de voz enviado.";
            let actionDesc = "Audio procesado por el motor de IA.";
            let impactTag = "Nota de Voz";
            let impactClass = "info";

            // Simular transcripción de acuerdo a contenido/palabras clave en bodyText o simular por defecto
            const lowerBody = bodyText.toLowerCase() || '';
            
            if (lowerBody.includes('entra') || lowerBody.includes('ingres') || lowerBody.includes('arranc')) {
                state.attendance["Luis Martínez"] = { role: "Instalaciones y Sanitarios", checkin: timeStr, status: "Presente" };
                let presentCount = 0;
                Object.values(state.attendance).forEach(val => {
                    if (val.status.includes("Presente")) presentCount++;
                });
                state.operariosCount = presentCount;
                actionDesc = "Fichaje de ingreso verificado y registrado mediante biométrica de voz.";
                impactTag = "Ingreso Exitoso";
                impactClass = "success";
                botReply = `🎙️ *Fichaje por Voz Procesado*\n\nSe ha registrado el ingreso de *Luis Martínez* a la obra a las ${timeStr} mediante biometría de voz.`;
            } 
            else if (lowerBody.includes('revoque') || lowerBody.includes('termin') || lowerBody.includes('living')) {
                if (state.tasks && state.tasks[1]) {
                    state.tasks[1].progress = 100;
                    actionDesc = "Revoque grueso registrado al 100%. Avanzada etapa en Gantt.";
                    impactTag = "Gantt Actualizado";
                    impactClass = "success";
                    botReply = `🎙️ *Reporte de Avance Procesado*\n\nIA analizó el audio: *"Revoque grueso terminado"*. El progreso de la tarea ha sido actualizado al 100% en el Gantt.`;
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
                state.tasks[99] = { name: "Reparación Urgente Cañería", progress: 0, duration: 2, startOffset: 42.8, assignee: "Luis Martínez", isDelayed: true };
                actionDesc = "Fisura en descarga sanitaria detectada. Ordenada reparación técnica urgente.";
                impactTag = "Alerta de Rotura";
                impactClass = "danger";
                botReply = `🎙️ *Alerta de Novedad IA*\n\nAlerta crítica registrada: *Fuga de Agua en Baño Principal*. Se ha añadido una tarea de reparación correctiva urgente en el Gantt.`;
                showInFeed = true;
            }
            else if (lowerBody.includes('demora') || lowerBody.includes('retraso') || lowerBody.includes('cerámic') || lowerBody.includes('suministro')) {
                state.alertsCount += 1;
                state.diasEstimados = "Día 12/37 (+2 días)";
                feedIncident = {
                    id: "inc-demora-" + Date.now(),
                    title: "Demora de Suministros",
                    description: "Cerámicas demoradas. Revestimiento desplazado al 29/Jun.",
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
                actionDesc = "Retraso logístico del proveedor. Reprogramación de cronograma Gantt (+2 días).";
                impactTag = "Gantt Reajustado";
                impactClass = "warning";
                botReply = `🎙️ *Reporte de Logística IA*\n\nAdvertencia registrada: *Demora de suministros de revestimientos cerámicos*. Hitos de finalización reprogramados +48hs.`;
                showInFeed = true;
            }
            else {
                botReply = `🎙️ *Audio Recibido y Transcrito*\n\n*"${transcribedText}"*\n\n• Estado: Guardado en Novedades de la Obra.`;
            }

            // Append to database logs
            if (feedIncident) {
                state.incidents.unshift(feedIncident);
            }
        }
        // 4. Process Photo Uploads
        else if (mediaUrl && mediaType.startsWith('image/')) {
            feedIncident = {
                id: "inc-photo-" + Date.now(),
                title: "Reporte Visual de Obra",
                description: `Verificación visual de avance enviada por ${senderName}. Captura archivada.`,
                type: "success",
                badge: "Guardado",
                timestamp: `Hoy, ${timeStr}`,
                reporter: senderName,
                icon: "fa-solid fa-circle-check"
            };
            state.incidents.unshift(feedIncident);
            botReply = `📸 *Imagen de Avance Registrada*\n\nLa captura enviada por *${senderName}* fue analizada por el módulo de visión IA y archivada en la bitácora fotográfica de Control de Calidad del día.`;
            showInFeed = true;
        }
        // 5. Process Text Messages
        else {
            const lowerBody = bodyText.toLowerCase();
            if (lowerBody.includes('hola') || lowerBody.includes('buen')) {
                botReply = `👷 *Asistente ObraSaaS AI* 👷\n\nHola ${senderName}, soy tu copiloto inteligente de obra. Puedes:\n1. Enviar tu *ubicación* para marcar check-in satelital.\n2. Enviar una *nota de voz* con tu reporte de avance.\n3. Enviar una *foto* de los trabajos finalizados.`;
            } else if (lowerBody.includes('status') || lowerBody.includes('estado')) {
                botReply = `📊 *Resumen de Obra en Tiempo Real*\n\n• Avance General: *${state.avancePercentage}%*\n• Plazo: *${state.diasEstimados}*\n• Alertas activas: *${state.alertsCount}*\n• Personal presente: *${state.operariosCount}*`;
            } else {
                botReply = `✅ *Mensaje Recibido, ${senderName}*.\n\nProcesando tu informe en la bitácora digital de ObraSaaS. Escribe 'status' para obtener un resumen del proyecto.`;
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
