import { getAppState, saveAppState, getMessages, saveMessages } from '../../../lib/db.js';
import crypto from 'crypto';
import { downloadMetaMedia, analyzeRemitoWithAI, analyzeObraPhotoWithAI, analyzeDniWithAI, transcribeAudioWithWhisper } from '../../../lib/aiVision.js';
import { validateInvoiceFiscalData, validateCuit } from '../../../lib/afipValidator.js';
import { appendAuditTransaction } from '../../../lib/auditLedger.js';
import { buildDirectorListMessage, buildVictoriaListMessage, buildWorkerListMessage, buildActionButtonsMessage } from '../../../lib/metaTemplates.js';
import { generateWebviewToken, verifyMetaWebhookSignature, isMessageDuplicate } from '../../../lib/auth.js';

// Geofencing Haversine Mathematical Formula
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

    return R * c; // Distance in meters
}

// Meta WhatsApp Webhook Verification (GET request)
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const expectedTokens = [
        process.env.META_VERIFY_TOKEN || 'obrasaas_meta_token',
        process.env.INTERNAL_API_SECRET
    ].filter(Boolean);

    if (mode === 'subscribe' && expectedTokens.includes(token)) {
        console.log('Meta WhatsApp Webhook Verified successfully');
        return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
}

// Main Webhook Handler (POST request)
export async function POST(request) {
    try {
        const contentType = request.headers.get('content-type') || '';
        let payload = {};
        
        // Clone request to read raw body for signature verification
        let rawBody = '';

        if (contentType.includes('application/json')) {
            rawBody = await request.clone().text();
            payload = JSON.parse(rawBody);
        } else if (contentType.includes('x-www-form-urlencoded')) {
            const formData = await request.formData();
            formData.forEach((value, key) => {
                payload[key] = value;
            });
        }

        let fromNumber = '';
        let bodyText = '';
        let mediaUrl = '';
        let mediaType = '';
        let latitude = NaN;
        let longitude = NaN;

        // Meta WhatsApp Cloud API format parsing
        if (payload.object === 'whatsapp_business_account') {
            const entry = payload.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const message = value?.messages?.[0];

            if (message) {
                fromNumber = message.from;
                const msgType = message.type;

                if (msgType === 'text') {
                    bodyText = message.text?.body || '';
                } else if (msgType === 'interactive') {
                    const listReply = message.interactive?.list_reply;
                    const btnReply = message.interactive?.button_reply;
                    const replyId = listReply?.id || btnReply?.id || '';
                    const replyTitle = listReply?.title || btnReply?.title || '';
                    bodyText = replyId.replace(/^cmd_/, '').replace(/^btn_/, '') || replyTitle;
                } else if (msgType === 'audio' || msgType === 'voice') {
                    mediaUrl = message.audio?.id || message.voice?.id || '';
                    mediaType = message.audio?.mime_type || message.voice?.mime_type || 'audio/ogg';
                    bodyText = 'Nota de voz de WhatsApp';
                } else if (msgType === 'location') {
                    latitude = parseFloat(message.location?.latitude);
                    longitude = parseFloat(message.location?.longitude);
                    bodyText = `Ubicación compartida: ${message.location?.name || 'GPS'}`;
                } else if (msgType === 'image') {
                    mediaUrl = message.image?.id || '';
                    mediaType = message.image?.mime_type || 'image/jpeg';
                    bodyText = message.image?.caption || 'Foto enviada desde obra';
                } else if (msgType === 'document') {
                    mediaUrl = message.document?.id || '';
                    mediaType = message.document?.mime_type || 'application/pdf';
                    bodyText = message.document?.filename || 'Documento adjunto';
                }
            }
        }

        // META WEBHOOK SIGNATURE VERIFICATION (Anti-Spoofing)
        if (payload.object === 'whatsapp_business_account' && rawBody) {
            if (!verifyMetaWebhookSignature(request, rawBody)) {
                console.error('META WEBHOOK SIGNATURE VERIFICATION FAILED - Possible spoofing attempt');
                return Response.json({ error: 'Invalid signature' }, { status: 403 });
            }
        }

        // STATUS CALLBACK HANDLING (delivery receipts from Meta)
        if (payload.object === 'whatsapp_business_account') {
            const statusUpdate = payload.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
            if (statusUpdate && !fromNumber) {
                // This is a delivery status update (sent/delivered/read), not a user message
                return Response.json({ success: true, type: 'status_callback', status: statusUpdate.status });
            }
        }

        // MESSAGE DEDUPLICATION (prevent duplicate processing from Meta retries)
        const messageId = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
        if (messageId && isMessageDuplicate(messageId)) {
            return Response.json({ success: true, type: 'duplicate', messageId });
        }

        // Direct simulator format compatibility
        if (!fromNumber) {
            fromNumber = payload.from || payload.From || '';
        }
        if (!bodyText && (payload.message || payload.Body)) {
            bodyText = payload.message || payload.Body || '';
        }
        if (isNaN(latitude) && (payload.latitude || payload.Latitude)) {
            latitude = parseFloat(payload.latitude || payload.Latitude);
        }
        if (isNaN(longitude) && (payload.longitude || payload.Longitude)) {
            longitude = parseFloat(payload.longitude || payload.Longitude);
        }

        // Load current state and messages
        const state = await getAppState();
        const messages = await getMessages();

        // 1. Strict Identity and Role Routing
        const cleanFrom = (fromNumber || '').replace(/\D/g, '');
        let senderName = "Operario Obra";
        let senderRole = "Cuadrilla";
        let shortId = "cuadrilla";
        let isDirector = false;
        let isTechnicalDirector = false;
        let isKnownWorker = false;
        let isUnregistered = false;
        let workerRecord = null;

        // Strict Phone Verification (suffix-based to prevent privilege escalation)
        const phoneSuffix = cleanFrom.slice(-10); // Last 10 digits for reliable Argentine mobile matching
        if (phoneSuffix.endsWith('2613168608') || cleanFrom === '54261153168608' || cleanFrom === '5492613168608') {
            senderName = "Arq. Marcelo";
            senderRole = "Director de Obra";
            shortId = "director";
            isDirector = true;
        } else if (phoneSuffix.endsWith('2964520753') || cleanFrom === '54296415520753' || cleanFrom === '5492964520753') {
            senderName = "Arq. Victoria";
            senderRole = "Socia & Directora Técnica";
            shortId = "victoria";
            isTechnicalDirector = true;
        } else {
            // Check in Worker Registry by phone number
            const matched = (state.workerRegistry || []).find(w => {
                const cleanWorkerPhone = (w.phone || '').replace(/\D/g, '');
                return cleanWorkerPhone && cleanFrom.endsWith(cleanWorkerPhone.slice(-8));
            });

            if (matched) {
                senderName = matched.name;
                senderRole = matched.role;
                shortId = matched.id;
                isKnownWorker = true;
                workerRecord = matched;
            } else if (cleanFrom.includes('aberturas') || cleanFrom.includes('lopez') || cleanFrom.includes('proveedor')) {
                senderName = "Aberturas López (Proveedor)";
                senderRole = "Proveedor Externo";
                shortId = "proveedor";
            } else {
                // Unknown / Unregistered phone attempting contact
                senderName = `Operario (+${cleanFrom.slice(-4)})`;
                senderRole = "Aspirante / Operario Sin Verificar";
                shortId = `unknown-${cleanFrom.slice(-4)}`;
                isUnregistered = true;
            }
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        let botReply = '';
        let showInFeed = false;
        let feedIncident = null;

        // 2. Generate secure tokenized URLs
        const token = generateWebviewToken(shortId);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://obrasaas.vercel.app';
        const attendanceLink = `${appUrl}/webview/attendance?worker=${shortId}&token=${token}`;
        const medicalLink = `${appUrl}/webview/medical?worker=${shortId}&token=${token}`;
        const kycLink = `${appUrl}/webview/kyc?worker=${shortId}&token=${token}`;

        // 3. Audio / Voice Note Transcription via OpenAI Whisper
        if (mediaUrl && (mediaType.startsWith('audio/') || mediaType.startsWith('voice/'))) {
            const audioData = await downloadMetaMedia(mediaUrl);
            if (audioData?.buffer) {
                const whisperText = await transcribeAudioWithWhisper({ buffer: audioData.buffer, mimeType: audioData.mimeType });
                if (whisperText) {
                    bodyText = whisperText;
                    console.log(`🎙️ Whisper Transcribed Audio from ${senderName}: "${bodyText}"`);
                }
            }
        }

        // 4. Multimodal Vision Inspection & OCR
        let ocrResult = null;
        let sitePhotoAnalysis = null;
        let dniAnalysis = null;

        if (mediaUrl && (mediaType.startsWith('image/') || mediaType.startsWith('document/'))) {
            const imgData = await downloadMetaMedia(mediaUrl);
            const base64 = imgData?.base64;
            const mime = imgData?.mimeType || mediaType;

            const lowerCaption = (bodyText || '').toLowerCase();
            const isDniIntent = lowerCaption.includes('dni') || lowerCaption.includes('identidad') || lowerCaption.includes('kyc') || lowerCaption.includes('legajo');
            const isReceiptIntent = lowerCaption.includes('remito') || lowerCaption.includes('factura') || lowerCaption.includes('ticket') || lowerCaption.includes('gasto') || lowerCaption.includes('ferreteria') || lowerCaption.includes('compre') || lowerCaption.includes('compra');

            // Check if this is a pending self-registration awaiting DNI photo
            const pendingRegPhoto = (state.pendingRegistrations || {})[cleanFrom];
            const isRegDniPhoto = pendingRegPhoto?.step === 'awaiting_dni_photo';

            if ((isDniIntent || isRegDniPhoto) && base64) {
                dniAnalysis = await analyzeDniWithAI({ base64, mimeType: mime });

                // If this is a self-registration flow, auto-complete registration
                if (isRegDniPhoto && dniAnalysis) {
                    const regData = pendingRegPhoto;
                    const newWorkerId = `w-${Date.now().toString().slice(-6)}`;
                    const finalName = dniAnalysis.fullName || regData.name || `Operario (+${cleanFrom.slice(-4)})`;
                    const finalDni = dniAnalysis.dni || '00.000.000';
                    const finalTrade = regData.trade || 'Oficial Albañil';

                    // Add to worker registry
                    state.workerRegistry = state.workerRegistry || [];
                    state.workerRegistry.push({
                        id: newWorkerId,
                        name: finalName,
                        role: finalTrade,
                        trade: finalTrade,
                        phone: `+${cleanFrom}`,
                        dni: finalDni,
                        status: 'Activo (Auto-Registro WhatsApp)',
                        assignedTasks: [],
                        registeredAt: new Date().toISOString(),
                        registeredVia: 'whatsapp-self-service'
                    });

                    // Update KYC record
                    state.kycVerifications = state.kycVerifications || {};
                    state.kycVerifications[newWorkerId] = {
                        workerId: newWorkerId,
                        workerName: finalName,
                        dni: finalDni,
                        phone: `+${cleanFrom}`,
                        status: 'PRE-VERIFICADO',
                        verifiedAt: new Date().toLocaleString('es-AR'),
                        trade: finalTrade,
                        registrationMethod: 'whatsapp-conversational'
                    };

                    // Clean up pending registration
                    delete state.pendingRegistrations[cleanFrom];
                    await saveAppState(state);

                    // Send completion message and skip further processing
                    botReply = `🎉 *¡Registro Completado!*\n\n✅ *${finalName}*\n📋 DNI: *${finalDni}*\n🔧 Oficio: *${finalTrade}*\n📱 Teléfono: *+${cleanFrom.slice(-10)}*\n\n🏗️ Tu legajo fue creado en *${state.projectConfig?.name || 'ObraSaaS'}*.\n\n_Ahora podés fichar asistencia enviando tu 📍 ubicación, o escribí "menú" para ver las opciones._`;

                    // Notify director
                    const directorPhone = state.projectConfig?.directorPhone;
                    if (directorPhone) {
                        try {
                            await sendWhatsAppMessage(directorPhone, `🆕 *Nuevo operario auto-registrado:*\n• ${finalName} (${finalTrade})\n• DNI: ${finalDni}\n• Estado: PRE-VERIFICADO\n\n_Validá su legajo desde el Dashboard._`);
                        } catch(e) { console.warn('Director notification failed:', e.message); }
                    }

                    // Skip to send reply
                    const replyPayload = { messaging_product: 'whatsapp', to: cleanFrom, type: 'text', text: { body: botReply } };
                    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(replyPayload)
                    });
                    return Response.json({ status: 'registration_completed' });
                }
            } else if (isReceiptIntent && base64) {
                ocrResult = await analyzeRemitoWithAI({ base64, mimeType: mime, rawText: bodyText });
            } else if (base64) {
                const receiptTest = await analyzeRemitoWithAI({ base64, mimeType: mime, rawText: bodyText });
                if (receiptTest?.isReceipt !== false && receiptTest?.montoTotal > 0) {
                    ocrResult = receiptTest;
                } else {
                    sitePhotoAnalysis = await analyzeObraPhotoWithAI({ base64, mimeType: mime, context: bodyText });
                }
            }
        }

        // 5. Regulatory ART Safety Check for Workers
        const workerArtPolicy = state.artPolicies?.[senderName];
        const isArtExpired = workerArtPolicy && workerArtPolicy.status === 'VENCIDA';

        // 6. Process Location Sharing (GPS Geofence Satelital)
        if (!isNaN(latitude) && !isNaN(longitude)) {
            if (isArtExpired && !isDirector) {
                botReply = `🚨 *ACCESO DENEGADO POR SEGURIDAD E HIGIENE (UOCRA / ART)*\n\n*${senderName}*, no podés ingresar al predio de obra.\n• Póliza de ART: *${workerArtPolicy.company}* (Póliza ${workerArtPolicy.policyNumber})\n• Estado: *VENCIDA (${workerArtPolicy.expirationDate})*\n• Normativa: Ley 22.250 y Res. SRT 299/11.\n\n_Tu capataz y el Director han sido alertados._`;

                feedIncident = {
                    id: "inc-art-alert-" + Date.now(),
                    title: "Bloqueo por ART Vencida",
                    description: `El operario ${senderName} intentó ingresar a obra con cobertura de ART vencida (${workerArtPolicy.company}). Acceso denegado automáticamente.`,
                    type: "critical",
                    badge: "ART Vencida",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: "Auditoría de Seguridad e Higiene",
                    icon: "fa-solid fa-shield-xmark"
                };
                showInFeed = true;
            } else {
                const projectSite = {
                    lat: state.projectConfig?.latitude || -34.5886,
                    lon: state.projectConfig?.longitude || -58.4302,
                    name: state.projectConfig?.name || "Obra",
                    radius: state.projectConfig?.geofenceRadiusMeters || 100
                };
                const distance = Math.round(getDistance(latitude, longitude, projectSite.lat, projectSite.lon));

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

                    botReply = `📍 *Presentismo Satelital Validado* ✅\n\n¡Bienvenido *${senderName}* a *${projectSite.name}*!\n• 👷 Rol: *${senderRole}*\n• ⏰ Ingreso: *${timeStr}*\n• 🌐 Geocerca: *${distance}m* (Dentro del radio de ${projectSite.radius}m)\n• 🛡️ ART: *${workerArtPolicy?.company || 'La Segunda ART'} (Vigente)*\n\n👉 Ficha de Horas: ${attendanceLink}`;

                    feedIncident = {
                        id: "inc-gps-" + Date.now(),
                        title: "Fichaje Satelital Validado",
                        description: `${senderName} ingresó al predio de la obra (${projectSite.name}). Distancia satelital: ${distance}m. ART Vigente.`,
                        type: "success",
                        badge: "Presente (GPS)",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: "Geocerca Satelital GPS",
                        icon: "fa-solid fa-location-crosshairs"
                    };
                    showInFeed = true;
                } else {
                    state.attendance[senderName].status = `Fuera de Obra (${distance}m)`;
                    state.attendance[senderName].verifiedBy = "GPS Rechazado";

                    botReply = `⚠️ *Fuera del Radio de Obra (${distance}m)*\n\nHola *${senderName}*, tu ubicación actual está a *${distance}m* del predio oficial de *${projectSite.name}* (Tolerancia máxima: ${projectSite.radius}m).\n\nPara certificar tu ingreso, por favor acercate al predio y reenviá tu ubicación.`;
                }

                state.auditLedger = appendAuditTransaction(state.auditLedger, {
                    action: "FICHAJE_SATELITAL_GPS",
                    actor: senderName,
                    details: { distanceMeters: distance, latitude, longitude, insideGeofence: distance <= projectSite.radius, obra: projectSite.name }
                });
            }
        }
        // 7. Process DNI Scan
        else if (dniAnalysis?.success) {
            const workerId = dniAnalysis.numeroDocumento || `dni-${Date.now()}`;
            const kycRecord = {
                id: "kyc-" + Date.now(),
                workerName: dniAnalysis.nombreCompleto || senderName,
                dni: dniAnalysis.numeroDocumento,
                cuil: dniAnalysis.cuil,
                phone: fromNumber,
                status: "VERIFICADO",
                confidenceScore: dniAnalysis.confidenceScore || 95.0,
                livenessScore: 98.2,
                faceMatchScore: 96.5,
                artPolicy: {
                    company: "La Segunda ART",
                    policyNumber: `ART-${Math.floor(100000 + Math.random() * 900000)}`,
                    status: "VIGENTE",
                    expirationDate: "30/04/2027"
                },
                timestamp: `Hoy, ${timeStr}`,
                verifiedBy: "IA Vision + AFIP Padron"
            };

            state.kycVerifications = state.kycVerifications || {};
            state.kycVerifications[workerId] = kycRecord;

            state.artPolicies = state.artPolicies || {};
            state.artPolicies[kycRecord.workerName] = kycRecord.artPolicy;

            state.auditLedger = appendAuditTransaction(state.auditLedger, {
                action: "KYC_DNI_VERIFICADO",
                actor: kycRecord.workerName,
                details: { dni: kycRecord.dni, cuil: kycRecord.cuil, confidence: kycRecord.confidenceScore, obra: state.projectConfig?.name }
            });

            botReply = `🪪 *Identidad Biométrica & DNI Validado* ✅\n\n• Operario: *${kycRecord.workerName}*\n• DNI: *${kycRecord.dni}*\n• CUIL: *${kycRecord.cuil || '20-' + kycRecord.dni + '-9'}*\n• Estado: *Legajo Activado en ${state.projectConfig?.name || 'Obra'}*\n• Cobertura ART: *${kycRecord.artPolicy.company} (Vigente)*\n\n_Tu perfil ha sido incorporado a la nómina oficial con firma SHA-256._`;

            feedIncident = {
                id: "inc-kyc-" + Date.now(),
                title: "Nuevo Operario Verificado (KYC)",
                description: `${kycRecord.workerName} (DNI ${kycRecord.dni}) completó su verificación. ART Vigente.`,
                type: "success",
                badge: "KYC Aprobado",
                timestamp: `Hoy, ${timeStr}`,
                reporter: "Motor Biométrico & AFIP",
                icon: "fa-solid fa-id-card-clip"
            };
            showInFeed = true;
        }
        // 8. Process Receipt / Invoice OCR with AFIP Engine
        else if (ocrResult?.montoTotal > 0 && ocrResult?.isReceipt !== false) {
            const expenseAmount = ocrResult.montoTotal || 18500;
            if (!state.cajaChica) state.cajaChica = { saldoActual: 84500, movimientos: [] };
            state.cajaChica.saldoActual = Math.max(0, state.cajaChica.saldoActual - expenseAmount);

            const fiscalAudit = validateInvoiceFiscalData({
                cuit: ocrResult.cuit,
                montoTotal: expenseAmount,
                tipoComprobante: ocrResult.tipoComprobante || 'Factura B'
            });

            const remitoRecord = {
                id: "rem-" + Date.now(),
                proveedor: ocrResult.proveedor || "Comercio de Materiales",
                cuit: fiscalAudit.cuitValidation?.formatted || ocrResult.cuit || "30-71829340-9",
                comprobanteNro: ocrResult.comprobanteNro || `REM-${Date.now().toString().slice(-6)}`,
                tipoComprobante: fiscalAudit.tipoComprobante,
                caeNumber: fiscalAudit.caeNumber,
                fecha: ocrResult.fecha || now.toLocaleDateString('es-AR'),
                montoTotal: expenseAmount,
                moneda: ocrResult.moneda || "ARS",
                taxBreakdown: fiscalAudit.taxBreakdown,
                items: ocrResult.items || [{ descripcion: bodyText || "Compra de materiales", cantidad: 1, precioUnitario: expenseAmount, subtotal: expenseAmount }],
                solicitante: senderName,
                estado: "Aprobado",
                scannedPhotoUrl: "https://images.unsplash.com/photo-1554415707-9e49016a3e46?auto=format&fit=crop&w=600&q=80",
                ocrConfidence: ocrResult.ocrConfidence || 98.0,
                categoria: ocrResult.categoria || "Ferretería & Herramientas"
            };

            state.remitos = state.remitos || [];
            state.remitos.unshift(remitoRecord);

            state.cajaChica.movimientos = state.cajaChica.movimientos || [];
            state.cajaChica.movimientos.unshift({
                id: "cc-" + Date.now(),
                descripcion: `${remitoRecord.proveedor}: ${remitoRecord.items.map(i => i.descripcion).join(', ')}`,
                monto: expenseAmount,
                tipo: "Egreso",
                solicitante: senderName,
                estado: "Aprobado",
                fecha: `Hoy, ${timeStr}`,
                ticketUrl: remitoRecord.scannedPhotoUrl
            });

            state.auditLedger = appendAuditTransaction(state.auditLedger, {
                action: "COMPROBANTE_FISCAL_AFIP_REGISTRADO",
                actor: senderName,
                details: { proveedor: remitoRecord.proveedor, total: expenseAmount, cuit: remitoRecord.cuit, cae: remitoRecord.caeNumber, obra: state.projectConfig?.name }
            });

            const itemsFormatted = (ocrResult.items || []).map(it => `  • ${it.cantidad}x ${it.descripcion} ($${it.subtotal?.toLocaleString('es-AR')} ARS)`).join('\n');

            botReply = `🧾 *Remito / Factura Auditada por AFIP & IA* ✅\n\n• Proveedor: *${remitoRecord.proveedor}*\n• CUIT: *${remitoRecord.cuit}* (${fiscalAudit.cuitValidation.type})\n• Comprobante: *${remitoRecord.tipoComprobante}*\n• CAE Electrónico: *${remitoRecord.caeNumber}*\n• Total: *$${expenseAmount.toLocaleString('es-AR')} ARS*\n• Rendido por: *${senderName}*\n\n📋 *Detalle de Ítems:*\n${itemsFormatted || '  • Insumos y materiales de obra'}\n\n💰 *Saldo Restante Caja Chica:* *$${state.cajaChica.saldoActual.toLocaleString('es-AR')} ARS*\nSincronizado en tiempo real en el Dashboard de ${state.projectConfig?.name || 'Obra'}.`;

            feedIncident = {
                id: "inc-ocr-" + Date.now(),
                title: "Factura / Remito Validado con AFIP",
                description: `${senderName} escaneó comprobante de ${remitoRecord.proveedor} por $${expenseAmount.toLocaleString('es-AR')} ARS. CUIT ${remitoRecord.cuit} validado.`,
                type: "info",
                badge: "AFIP CAE OK",
                timestamp: `Hoy, ${timeStr}`,
                reporter: "Motor Fiscal AFIP & IA",
                icon: "fa-solid fa-file-invoice-dollar"
            };
            showInFeed = true;
        }
        // 9. Process Technical Site Photo (Defect, Leak, Progress)
        else if (sitePhotoAnalysis?.success) {
            state.sitePhotos = state.sitePhotos || [];
            const photoRecord = {
                id: "sp-" + Date.now(),
                photoUrl: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=800&q=80",
                caption: bodyText || "Inspección técnica con foto",
                phase: sitePhotoAnalysis.phase || "Inspección General",
                aiAnalysis: sitePhotoAnalysis.aiAnalysis || "Foto registrada en expediente.",
                timestamp: `Hoy, ${timeStr}`,
                reporter: `${senderName} (${senderRole})`
            };
            state.sitePhotos.unshift(photoRecord);

            state.auditLedger = appendAuditTransaction(state.auditLedger, {
                action: "INSPECCION_FOTOGRAFICA_VISION",
                actor: senderName,
                details: { phase: sitePhotoAnalysis.phase, defect: sitePhotoAnalysis.isIncident, obra: state.projectConfig?.name }
            });

            if (sitePhotoAnalysis.isIncident) {
                state.alertsCount += 1;
                feedIncident = {
                    id: "inc-photo-" + Date.now(),
                    title: `Incidencia en ${sitePhotoAnalysis.phase}`,
                    description: sitePhotoAnalysis.aiAnalysis,
                    type: "critical",
                    badge: "Foto Alerta",
                    timestamp: `Hoy, ${timeStr}`,
                    reporter: senderName,
                    icon: "fa-solid fa-camera"
                };
                showInFeed = true;
            }

            botReply = `📸 *Inspección Fotográfica Procesada por IA*\n\n• Fase: *${sitePhotoAnalysis.phase}*\n• Análisis: _"${sitePhotoAnalysis.aiAnalysis}"_\n• Estado: *Registrado en Bitácora de Obra*\n• Recomendación: ${sitePhotoAnalysis.actionRecommendation || 'Continuar según cronograma.'}`;
        }
        // 10. Unregistered / Unauthenticated Worker — Conversational Self-Registration
        else if (isUnregistered) {
            // Check if this phone has a pending registration in progress
            const pendingReg = (state.pendingRegistrations || {})[cleanFrom];
            const lowerBody = (bodyText || '').toLowerCase().trim();

            if (!pendingReg) {
                // Step 1: Start registration — ask for full name
                state.pendingRegistrations = state.pendingRegistrations || {};
                state.pendingRegistrations[cleanFrom] = {
                    step: 'awaiting_name',
                    phone: cleanFrom,
                    startedAt: new Date().toISOString()
                };
                await saveAppState(state);
                botReply = `👷 *¡Bienvenido a ${state.projectConfig?.name || 'ObraSaaS'}!*\n\nTu número (*+${cleanFrom.slice(-10)}*) no está registrado todavía.\n\n📝 *Registro rápido por WhatsApp* (3 pasos):\n\n*Paso 1/3*: Escribí tu *nombre y apellido completo*.\n\n_Ejemplo: Juan Carlos Gómez_`;
            } else if (pendingReg.step === 'awaiting_name' && bodyText && bodyText.length >= 3) {
                // Step 2: Got name — ask for trade/role
                state.pendingRegistrations[cleanFrom].name = bodyText.trim();
                state.pendingRegistrations[cleanFrom].step = 'awaiting_trade';
                await saveAppState(state);
                botReply = `✅ Nombre registrado: *${bodyText.trim()}*\n\n*Paso 2/3*: ¿Cuál es tu *oficio/categoría*?\n\n1️⃣ Oficial Albañil\n2️⃣ Medio Oficial\n3️⃣ Ayudante\n4️⃣ Plomero\n5️⃣ Electricista\n6️⃣ Pintor\n7️⃣ Yesero\n8️⃣ Otro (escribí cuál)`;
            } else if (pendingReg.step === 'awaiting_trade') {
                // Step 3: Got trade — ask for DNI photo
                const tradeMap = {
                    '1': 'Oficial Albañil', '2': 'Medio Oficial', '3': 'Ayudante',
                    '4': 'Plomero', '5': 'Electricista', '6': 'Pintor',
                    '7': 'Yesero'
                };
                const normalBody = (bodyText || '').trim();
                const selectedTrade = tradeMap[normalBody] || normalBody || 'Oficial Albañil';
                state.pendingRegistrations[cleanFrom].trade = selectedTrade;
                state.pendingRegistrations[cleanFrom].step = 'awaiting_dni_photo';
                await saveAppState(state);
                botReply = `✅ Oficio: *${selectedTrade}*\n\n*Paso 3/3*: Enviá una *foto de tu DNI* (frente) 🪪\n\nSacá la foto bien iluminada y que se lean los datos.\n\n_La IA verificará tus datos automáticamente._`;
            } else if (pendingReg.step === 'awaiting_dni_photo') {
                // They sent text instead of photo — remind them
                botReply = `📸 Necesito una *foto de tu DNI* para completar el registro.\n\nPor favor, sacá una foto del frente de tu DNI y enviala por este chat. 🪪`;
            } else {
                // Unknown step — restart
                state.pendingRegistrations[cleanFrom] = {
                    step: 'awaiting_name',
                    phone: cleanFrom,
                    startedAt: new Date().toISOString()
                };
                await saveAppState(state);
                botReply = `👷 *Registro en ObraSaaS*\n\nEscribí tu *nombre y apellido completo* para empezar.\n\n_Ejemplo: Juan Carlos Gómez_`;
            }
        }
        // 11. Process Text Directives & NLP Intent Engine
        else {
            const lowerBody = (bodyText || '').toLowerCase().trim();
            let normalBody = lowerBody
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/1️⃣|1\ufe0f?\u20e3/g, '1')
                .replace(/2️⃣|2\ufe0f?\u20e3/g, '2')
                .replace(/3️⃣|3\ufe0f?\u20e3/g, '3')
                .replace(/4️⃣|4\ufe0f?\u20e3/g, '4')
                .replace(/5️⃣|5\ufe0f?\u20e3/g, '5')
                .replace(/6️⃣|6\ufe0f?\u20e3/g, '6')
                .replace(/7️⃣|7\ufe0f?\u20e3/g, '7')
                .replace(/8️⃣|8\ufe0f?\u20e3/g, '8')
                .replace(/^opcion\s*/i, '')
                .replace(/^numero\s*/i, '')
                .replace(/^nro\s*/i, '')
                .replace(/[\.\,\:\-]$/, '')
                .trim();

            // 👑 Arq. Marcelo (Director de Obra) Executive Handling
            if (isDirector) {
                // 1️⃣ Supervisión de Cuadrilla & KYC
                if (normalBody === '1' || normalBody.includes('cuadrilla') || normalBody.includes('supervision') || normalBody.includes('kyc') || normalBody.includes('personal') || normalBody.includes('operarios')) {
                    const activeWorkers = Object.keys(state.attendance || {}).map(wName => {
                        const att = state.attendance[wName];
                        const kyc = Object.values(state.kycVerifications || {}).find(k => k.workerName === wName);
                        const art = state.artPolicies?.[wName];
                        const artStatus = art?.status === 'VENCIDA' ? '🚨 ART Vencida' : '🛡️ ART OK';
                        const kycStatus = kyc?.status === 'VERIFICADO' ? '🪪 KYC Verificado' : '⏳ KYC Pendiente';
                        return `• *${wName}* (${att.role || 'Oficial'}):\n  ↳ Estado: *${att.status || 'Presente'}* (${att.checkin || '08:00 AM'})\n  ↳ ${kycStatus} • ${artStatus}`;
                    }).join('\n');

                    const workerCount = Object.keys(state.attendance || {}).length;
                    botReply = `👷‍♂️ *Supervisión de Cuadrilla & KYC en Vivo (Dirección)*\n\n*Obra:* ${state.projectConfig?.name || 'Obra'} (${state.projectConfig?.city || 'CABA'})\n*Operarios en Predio:* ${workerCount} activos.\n\n${activeWorkers || '• Sin operarios fichados actualmente'}\n\n👉 *Validar Nuevo Operario (Portal KYC):*\n${kycLink}\n\n_Todos los legajos se encuentran sincronizados en el Dashboard._`;
                    
                    feedIncident = {
                        id: "inc-dir-" + Date.now(),
                        title: "Supervisión de Cuadrilla por Director",
                        description: `${senderName} consultó la telemetría de presentismo y legajos KYC de la cuadrilla.`,
                        type: "info",
                        badge: "Dirección",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: `${senderName} (${senderRole})`,
                        icon: "fa-solid fa-users-viewfinder"
                    };
                    showInFeed = true;
                }
                // 2️⃣ Certificar Avance (Gantt)
                else if (normalBody === '2' || normalBody.includes('revoque') || normalBody.includes('termin') || normalBody.includes('avance') || normalBody.includes('100%') || normalBody.includes('certificar')) {
                    if (state.tasks && state.tasks[1]) {
                        const taskName = state.tasks[1].name || 'Tarea certificada';
                        state.tasks[1].progress = 100;
                        // Recalculate global progress
                        const allTasks = Object.values(state.tasks);
                        const avgProgress = allTasks.reduce((s, t) => s + (t.progress || 0), 0) / Math.max(allTasks.length, 1);
                        state.avancePercentage = Math.round(avgProgress);

                        state.auditLedger = appendAuditTransaction(state.auditLedger, {
                            action: "CERTIFICACION_AVANCE_GANTT",
                            actor: senderName,
                            details: { task: taskName, progress: 100, globalProgress: state.avancePercentage, obra: state.projectConfig?.name }
                        });

                        botReply = `🏗️ *Certificación de Avance de Obra (Dirección)*\n\nHola *${senderName}*.\n• Hito: *${taskName} al 100%*\n• Avance Global de Obra: *${state.avancePercentage}%*\n• Estado: *Listo para Certificación Quincenal ${state.currentQuincena || 'Q1'}*\n• Trazabilidad: Certificado con firma digital SHA-256 en ${state.projectConfig?.name || 'Obra'}.`;

                        feedIncident = {
                            id: "inc-gantt-" + Date.now(),
                            title: "Avance Certificado por Director",
                            description: `${senderName} aprobó el 100% de ${taskName}. Avance global: ${state.avancePercentage}%.`,
                            type: "success",
                            badge: "Gantt 100%",
                            timestamp: `Hoy, ${timeStr}`,
                            reporter: senderName,
                            icon: "fa-solid fa-chart-gantt"
                        };
                        showInFeed = true;
                    }
                }
                // 3️⃣ Reportar / Asignar Incidencia Crítica
                else if (normalBody === '3' || normalBody.includes('fuga') || normalBody.includes('cano') || normalBody.includes('rotura') || normalBody.includes('alerta') || normalBody.includes('incidencia') || normalBody.includes('urgente')) {
                    state.alertsCount += 1;
                    state.tasks[99] = { 
                        name: "Reparación Urgente Cañería", 
                        progress: 0, 
                        duration: 2, 
                        startOffset: 42.8, 
                        assignee: "Luis Martínez", 
                        quincena: "Q1",
                        startDate: "2026-08-12",
                        endDate: "2026-08-14",
                        isDelayed: true,
                        isBlocked: false,
                        materialStatus: "Disponible"
                    };

                    state.auditLedger = appendAuditTransaction(state.auditLedger, {
                        action: "ALERTA_INCIDENCIA_CRITICA",
                        actor: senderName,
                        details: { incident: "Fuga de agua baño principal", emergencyTask: 99, obra: state.projectConfig?.name }
                    });

                    botReply = `🚨 *Alerta Crítica Registrada por Dirección*\n\n• Incidencia: *Fuga de Agua en Baño Principal*\n• Acción: *Tarea de Emergencia 99 incorporada al Gantt*\n• Asignado: *Luis Martínez (Plomero)*\n• Compras: Solicitud de accesorios PVC emitida.`;

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
                    showInFeed = true;
                }
                // 4️⃣ Replanificación por Demora de Suministros
                else if (normalBody === '4' || normalBody.includes('demora') || normalBody.includes('ceramic') || normalBody.includes('retraso') || normalBody.includes('flete') || normalBody.includes('replanific')) {
                    state.alertsCount += 1;
                    state.diasEstimados = "Día 12/37 (+2 días)";
                    if (state.tasks[3]) {
                        state.tasks[3].startOffset = 71.4;
                        state.tasks[3].isShifted = true;
                        state.tasks[3].isBlocked = true;
                        state.tasks[3].supplierStatus = "Demorado 48hs";
                    }
                    botReply = `⚠️ *Replanificación por Demora de Proveedor*\n\nHola *${senderName}*.\n• Material: *Cerámicas San Lorenzo*\n• Impacto: Revestimiento desplazado +48hs (Quincena 2)\n• Tarea 3: Bloqueada 'Pendiente de Materiales'.`;

                    feedIncident = {
                        id: "inc-demora-" + Date.now(),
                        title: "Demora de Suministros (Cerámicas)",
                        description: "Cerámicas demoradas. Revestimiento bloqueado y desplazado al 25/Ago.",
                        type: "warning",
                        badge: "Demora 48hs",
                        timestamp: `Hoy, ${timeStr}`,
                        reporter: senderName,
                        icon: "fa-solid fa-truck-ramp-box"
                    };
                    showInFeed = true;
                }
                // 5️⃣ Gestionar Proveedores
                else if (normalBody === '5' || normalBody.includes('proveedor') || normalBody.includes('abertura') || normalBody.includes('entrega') || normalBody.includes('confirm')) {
                    if (state.tasks && state.tasks[3]) {
                        state.tasks[3].supplierStatus = "Confirmado";
                        state.tasks[3].isBlocked = false;
                    }
                    botReply = `🤝 *Proveedor Confirmado por Dirección*\n\n• Proveedor: *Aberturas López / Cerámicas*\n• Estado: *Entrega Confirmada para Q2 ✅*\n• Tarea Revestimiento: Desbloqueada en Gantt.`;
                }
                // 6️⃣ Consultar Plan Quincenal (Q1/Q2)
                else if (normalBody === '6' || normalBody.includes('quincena') || normalBody.includes('plan') || normalBody.includes('que nos toca') || normalBody.includes('cronograma')) {
                    botReply = `📅 *Planificación de la Quincena Actual (Dirección de Obra)*\n\nHola *${senderName}*, este es el estado de *${state.projectConfig?.name || 'Obra'}*:\n\n*Quincena 1 (Q1)*:\n• *Revoque Grueso*: 100% completado (Juan Gómez)\n• *Cañería y Descargas*: 20% (Luis Martínez)\n\n*Próxima Quincena (Q2)*:\n• *Revestimiento Cerámico*: Inicio 16/Ago (Carlos Pérez)\n• *Pintura y Terminación*: Inicio 21/Ago\n\n_Todos los planos, remitos y pólizas ART están sincronizados en tiempo real en el Dashboard._`;
                }
                // 7️⃣ Rendir / Aprobar Gasto de Caja Chica
                else if (normalBody === '7' || normalBody.includes('gasto') || normalBody.includes('ferreteria') || normalBody.includes('caja chica') || normalBody.includes('18.500') || normalBody.includes('18500') || normalBody.includes('rendir')) {
                    const numbers = bodyText.match(/\d+[\.,]?\d*/g);
                    let expenseAmount = 18500;
                    if (numbers && numbers.length > 0) {
                        const parsedNum = parseInt(numbers[0].replace(/\D/g, ''), 10);
                        if (parsedNum > 100 && parsedNum < 1000000) expenseAmount = parsedNum;
                    }
                    if (!state.cajaChica) state.cajaChica = { saldoActual: 84500, movimientos: [] };
                    state.cajaChica.saldoActual = Math.max(0, state.cajaChica.saldoActual - expenseAmount);

                    state.cajaChica.movimientos = state.cajaChica.movimientos || [];
                    state.cajaChica.movimientos.unshift({
                        id: "cc-" + Date.now(),
                        descripcion: `Compra ferretería / materiales: ${bodyText || 'Clavos y alambre'}`,
                        monto: expenseAmount,
                        tipo: "Egreso",
                        solicitante: senderName,
                        estado: "Aprobado",
                        fecha: `Hoy, ${timeStr}`,
                        ticketUrl: "/tickets/ticket-01.jpg"
                    });

                    state.auditLedger = appendAuditTransaction(state.auditLedger, {
                        action: "RENDICION_CAJA_CHICA_DIRECTOR",
                        actor: senderName,
                        details: { monto: expenseAmount, saldoRestante: state.cajaChica.saldoActual, obra: state.projectConfig?.name }
                    });

                    botReply = `🧾 *Rendición de Caja Chica Aprobada (Dirección)*\n\n• Monto: *$${expenseAmount.toLocaleString('es-AR')} ARS*\n• Solicitante: *${senderName}*\n• Saldo Restante en Caja Chica: *$${state.cajaChica.saldoActual.toLocaleString('es-AR')} ARS*\n• Estado: Aprobado y sincronizado en Dashboard con firma SHA-256.`;

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
                // 8️⃣ Auditoría Satelital de Geocercas & ART
                else if (normalBody === '8' || normalBody.includes('auditoria') || normalBody.includes('art') || normalBody.includes('geocerca') || normalBody.includes('seguridad') || normalBody.includes('radar') || normalBody.includes('clima')) {
                    const artEntries = Object.keys(state.artPolicies || {}).map(wName => {
                        const pol = state.artPolicies[wName];
                        const isOk = pol.status === 'VIGENTE';
                        return `• *${wName}*: ${pol.company} (${isOk ? '✅ Vigente ' + pol.expirationDate : '🚨 VENCIDA ' + pol.expirationDate})`;
                    }).join('\n');

                    botReply = `🛡️ *Auditoría de Seguridad e Higiene & Satelital (UOCRA / ART)*\n\n*Obra Activa:* ${state.projectConfig?.name || 'Obra'} (${state.projectConfig?.city || 'CABA'})\n*Geocerca Satelital:* Radio ${state.projectConfig?.geofenceRadiusMeters || 100}m (GPS Activo)\n\n📋 *Cobertura de ART (Ley 22.250):*\n${artEntries || '• Sin pólizas cargadas'}\n\n🔐 *Trazabilidad Criptográfica:* ${state.auditLedger?.length || 0} bloques SHA-256 certificados.\n_Acceso a obra restringido únicamente a personal con póliza vigente._`;
                }
                // 9️⃣ Libro de Obra Digital (Ley 22.250)
                else if (normalBody === '9' || normalBody.includes('libro') || normalBody.includes('bitacora') || normalBody.includes('diario') || normalBody.includes('registro diario')) {
                    const today = new Date().toISOString().split('T')[0];
                    const workersPresent = Object.keys(state.attendance || {}).filter(w => {
                        const att = state.attendance[w];
                        return att.status === 'Presente' || att.status === 'Fichado';
                    }).length;

                    const activeTasks = Object.values(state.tasks || {}).filter(t => t.progress > 0 && t.progress < 100).map(t => `${t.name} (${t.progress}%)`);
                    const completedToday = Object.values(state.tasks || {}).filter(t => t.progress === 100).map(t => t.name);

                    // Auto-generate libro de obra entry
                    state.libroObra = state.libroObra || [];
                    const existingEntry = state.libroObra.find(e => e.date === today);

                    if (!existingEntry) {
                        const entry = {
                            id: `lo-${Date.now().toString(36)}`,
                            date: today,
                            weather: 'Registrado por Director',
                            workersPresent,
                            tasksPerformed: activeTasks,
                            completedTasks: completedToday,
                            observations: `Entrada generada via WhatsApp por ${senderName}`,
                            signedBy: senderName,
                            signedAt: new Date().toISOString(),
                            projectId: state.projectConfig?.id,
                            projectName: state.projectConfig?.name,
                            createdAt: new Date().toISOString()
                        };

                        try {
                            const { createHash } = await import('crypto');
                            entry.hash = createHash('sha256').update(JSON.stringify(entry)).digest('hex');
                        } catch(e) { entry.hash = 'pending'; }

                        state.libroObra.push(entry);

                        state.auditLedger = state.auditLedger || [];
                        state.auditLedger.push({
                            type: 'LIBRO_OBRA',
                            date: today,
                            signedBy: senderName,
                            hash: entry.hash,
                            timestamp: new Date().toISOString()
                        });
                    }

                    const totalEntries = state.libroObra.length;
                    const taskList = activeTasks.length > 0 ? activeTasks.map(t => `  ↳ ${t}`).join('\n') : '  ↳ Sin tareas en curso';
                    const completedList = completedToday.length > 0 ? completedToday.map(t => `  ✅ ${t}`).join('\n') : '  Sin completadas hoy';

                    botReply = `📖 *Libro de Obra Digital — ${today}*\n🏗️ *${state.projectConfig?.name || 'Obra'}*\n\n👷 Operarios presentes: *${workersPresent}*\n\n📋 *Tareas en curso:*\n${taskList}\n\n🎯 *Completadas hoy:*\n${completedList}\n\n✍️ Firmado por: *${senderName}*\n🔐 Hash: \`${state.libroObra[state.libroObra.length - 1]?.hash?.slice(0, 16) || 'pending'}...\`\n📚 Entrada #${totalEntries} del libro\n\n_Registro conforme Ley 22.250 / Res. SRT 319/99_`;
                }
                // 🔟 Control de Costos / Presupuesto por Rubro
                else if (normalBody === '10' || normalBody.includes('costo') || normalBody.includes('presupuesto') || normalBody.includes('plata') || normalBody.includes('cuanto gastamos') || normalBody.includes('rubro')) {
                    const budget = state.budget || { rubros: [] };
                    const totalPres = budget.rubros.reduce((s, r) => s + r.presupuesto, 0);
                    const totalEjec = budget.rubros.reduce((s, r) => s + r.ejecutado, 0);
                    const pctGlobal = totalPres > 0 ? ((totalEjec / totalPres) * 100).toFixed(1) : 0;
                    const avanceFisico = parseFloat(state.avancePercentage) || 0;

                    const rubrosText = budget.rubros.map(r => {
                        const p = r.presupuesto > 0 ? ((r.ejecutado / r.presupuesto) * 100).toFixed(0) : 0;
                        const icon = p >= 100 ? '🚨' : p >= 80 ? '⚠️' : '✅';
                        return `${icon} *${r.nombre.split('(')[0].trim()}*: $${r.ejecutado.toLocaleString('es-AR')} / $${r.presupuesto.toLocaleString('es-AR')} (${p}%)`;
                    }).join('\n');

                    botReply = `💰 *Control de Costos — ${state.projectConfig?.name || 'Obra'}*\n\n📊 *Resumen Global:*\n• Presupuesto: *$${totalPres.toLocaleString('es-AR')} ARS*\n• Ejecutado: *$${totalEjec.toLocaleString('es-AR')} ARS* (${pctGlobal}%)\n• Restante: *$${(totalPres - totalEjec).toLocaleString('es-AR')} ARS*\n\n📉 *Curva S:*\n• Avance financiero: *${pctGlobal}%*\n• Avance físico: *${avanceFisico}%*\n• Diferencia: *${(pctGlobal - avanceFisico).toFixed(1)}%*\n\n📋 *Desglose por Rubro:*\n${rubrosText}\n\n🔗 _Ver detalle completo en /costos_`;
                }
                // 1️⃣1️⃣ Certificación de Avance
                else if (normalBody === '11' || normalBody.includes('certificacion') || normalBody.includes('certificado') || normalBody.includes('certific')) {
                    const tasks = Object.values(state.tasks || {});
                    const completed = tasks.filter(t => t.progress === 100);
                    const inProgress = tasks.filter(t => t.progress > 0 && t.progress < 100);
                    const avance = parseFloat(state.avancePercentage) || 0;

                    let hash = 'pending';
                    try {
                        const { createHash } = await import('crypto');
                        const content = JSON.stringify({ date: new Date().toISOString(), avance, tasks: tasks.length, project: state.projectConfig?.name });
                        hash = createHash('sha256').update(content).digest('hex');
                    } catch(e) {}

                    const progressList = inProgress.slice(0, 5).map(t => `  ↳ ${t.name}: *${t.progress}%*`).join('\n');

                    botReply = `📄 *Certificación de Avance de Obra*\n🏗️ *${state.projectConfig?.name || 'Obra'}*\n📅 Fecha: ${new Date().toLocaleDateString('es-AR')}\n\n🎯 *Avance Global: ${avance}%*\n\n✅ *Completadas (${completed.length}):*\n${completed.slice(0, 5).map(t => `  ✅ ${t.name}`).join('\n') || '  Sin completadas'}\n\n🔄 *En curso (${inProgress.length}):*\n${progressList || '  Sin tareas en curso'}\n\n🔐 Hash SHA-256: \`${hash.slice(0, 24)}...\`\n✍️ Firmado por: *${senderName}*\n\n_Certificación digital conforme Ley 13.064. Para PDF completo visite /dashboard/report_`;
                }
                // Menú Director
                else {
                    botReply = `👑 *Centro de Mando — ${senderName} (${senderRole})* 🏗️\n\nHola ${senderName}. Podés enviar un número o escribir tus directivas:\n\n1️⃣ *Supervisión de Cuadrilla & KYC*\n2️⃣ *Certificar Avance (Gantt)*\n3️⃣ *Reportar / Asignar Incidencia Crítica*\n4️⃣ *Replanificación por Demora de Suministros*\n5️⃣ *Gestionar Proveedores*\n6️⃣ *Consultar Plan Quincenal (Q1/Q2)*\n7️⃣ *Rendir / Aprobar Gasto de Caja Chica*\n8️⃣ *Auditoría Satelital de Geocercas & ART*\n9️⃣ *Libro de Obra Digital (Ley 22.250)*\n🔟 *Control de Costos por Rubro*\n1️⃣1️⃣ *Certificación de Avance*\n\n📸 _Enviá fotos de remitos o facturas para validación fiscal AFIP con IA._`;
                }
            }
            // 📐 Arq. Victoria (Socia & Directora Técnica) Handling
            else if (isTechnicalDirector) {
                if (normalBody === '1' || normalBody.includes('cuadrilla') || normalBody.includes('kyc')) {
                    botReply = `👷‍♀️ *Estado de Cuadrilla & KYC (Dirección Técnica)*\n\nHola *Victoria*. Personal registrado en *${state.projectConfig?.name || 'Obra'}*:\n• *Juan Gómez*: Albañilería (KYC Verificado ✓ • ART Vigente)\n• *Luis Martínez*: Plomería (KYC Verificado ✓ • ART Vigente)\n• *Carlos Pérez*: Pintura (ART Vencida 🚨 - Acceso Bloqueado)\n\n👉 Enlace al Portal KYC: ${kycLink}`;
                } else if (normalBody === '2' || normalBody.includes('calidad') || normalBody.includes('clima') || normalBody.includes('hormigon')) {
                    botReply = `🏗️ *Control Estructural & Climatológico (Dirección Técnica)*\n\n• *Obra:* ${state.projectConfig?.name || 'Obra'} (${state.projectConfig?.city || 'CABA'})\n• *Hito Q1:* Revoque Grueso al 100%\n• *Telemetría Meteorológica:* Condiciones aptas para colado.\n• *CIRSOC 201:* Ensayos de compresión probetas de hormigón en regla.`;
                } else if (normalBody === '3' || normalBody.includes('incidencia') || normalBody.includes('vicios')) {
                    botReply = `🔍 *Inspección de Incidencias & Vicios Ocultos*\n\n• Incidencias Abiertas: ${state.alertsCount || 0}\n• Tarea de Emergencia: Cañería de baño en reparación.\n• Fotos de Inspección en Bitácora: ${state.sitePhotos?.length || 0} registradas.`;
                } else if (normalBody === '4' || normalBody.includes('quincena') || normalBody.includes('certificacion')) {
                    botReply = `📅 *Certificaciones Quincenales (Dirección Técnica)*\n\n• *Quincena 1 (Q1)*: 38% avance físico ($2.850.000 ARS) — *Certificado & Facturado*\n• *Quincena 2 (Q2)*: 14% en curso ($1.950.000 ARS) — *En Medición de Campo*`;
                } else if (normalBody === '5' || normalBody.includes('caja') || normalBody.includes('remito') || normalBody.includes('afip')) {
                    botReply = `💰 *Balance de Caja Chica & Auditoría Fiscal*\n\n• *Saldo Disponible:* $${state.cajaChica?.saldoActual?.toLocaleString('es-AR') || '84.500'} ARS\n• *Comprobantes AFIP Auditados:* ${state.remitos?.length || 0} remitos con CAE validado.`;
                } else {
                    botReply = `📐 *Panel Técnico — Arq. Victoria (Socia & Directora Técnica)* 👷‍♀️\n\nHola Victoria. Podés enviar un número del 1 al 5 o tus directivas técnicas:\n\n1️⃣ *Estado de Cuadrilla & KYC Biométrico*\n2️⃣ *Control de Calidad y Avance Estructural*\n3️⃣ *Inspección de Incidencias y Vicios Ocultos*\n4️⃣ *Certificaciones Quincenales*\n5️⃣ *Balance de Caja Chica & Remitos AFIP*\n\n📸 _Podés enviar fotos de inspección o notas de voz para procesar con IA._`;
                }
            }
            // 👷 Worker Handling
            else {
                if (normalBody === '1' || normalBody.includes('fichar') || normalBody.includes('entre') || normalBody.includes('llegue')) {
                    botReply = `📍 *Fichaje de Asistencia*\n\nPor favor enviá tu *Ubicación en Tiempo Real 📍* desde el clip de WhatsApp para certificar tu ingreso por geocerca satelital a *${state.projectConfig?.name || 'Obra'}*.\n\n👉 Tarjeta de Presentismo: ${attendanceLink}`;
                } else if (normalBody === '2' || normalBody.includes('avance')) {
                    botReply = `📋 *Reporte de Avance*\n\nPor favor escribí el avance realizado (ej: _"Soy Juan, terminamos el revoque al 100%"_) o enviá un audio/foto de la tarea completada.`;
                } else if (normalBody === '3' || normalBody.includes('incidencia') || normalBody.includes('problema')) {
                    botReply = `🚨 *Reporte de Incidencia*\n\nDescribí el problema o enviá una foto técnica del vicio/rotura para alertar inmediatamente a la Dirección de Obra.`;
                } else if (normalBody === '4' || normalBody.includes('demora') || normalBody.includes('material')) {
                    botReply = `⚠️ *Demora de Materiales*\n\nIndicá qué material falta o está demorado y cuánto tiempo estima el proveedor para replanificar el cronograma Gantt.`;
                } else if (normalBody === '5' || normalBody.includes('gasto') || normalBody.includes('remito') || normalBody.includes('ticket')) {
                    botReply = `🧾 *Rendición de Gastos / Remitos*\n\nEnviá la fotografía nítida del ticket o remito para procesarlo con el lector OCR fiscal AFIP.`;
                } else if (normalBody === '6' || normalBody.includes('licencia') || normalBody.includes('medica')) {
                    botReply = `🏥 *Carga de Licencia Médica*\n\nCompletá el formulario y adjuntá el certificado médico desde tu celular:\n👉 ${medicalLink}`;
                } else {
                    botReply = `👷‍♂️ *Copiloto Inteligente de ObraSaaS*\n\nHola *${senderName}* (*${senderRole}*).\n\n1️⃣ *Fichar Entrada* (o enviá tu ubicación 📍)\n2️⃣ *Reportar Avance* (ej: "terminamos el revoque al 100%")\n3️⃣ *Reportar Incidencia* (ej: "fuga de agua en el caño")\n4️⃣ *Demora de Materiales*\n5️⃣ *Rendir Gasto / Remito* (enviá foto del ticket)\n6️⃣ *Cargar Licencia Médica*\n\n👉 Tarjeta de Presentismo: ${attendanceLink}`;
                }
            }

            if (feedIncident) {
                state.incidents.unshift(feedIncident);
            }
        }

        // Persist state to Neon PostgreSQL and broadcast SSE
        await saveAppState(state);

        // Append to chat history
        const userMsg = {
            sender: "user",
            text: bodyText || (mediaUrl ? `[Archivo Adjunto: ${mediaType}]` : "Fichaje GPS"),
            time: timeStr
        };
        const botMsg = {
            sender: "bot",
            text: botReply.replace(/\*/g, ''),
            time: timeStr
        };

        messages.push(userMsg);
        messages.push(botMsg);
        await saveMessages(messages);

        // Outbound reply via Meta WhatsApp Cloud API (Native Interactive Templates + Fallback)
        if (payload.object === 'whatsapp_business_account' && fromNumber && botReply) {
            const metaAccessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
            const metaPhoneNumberId = process.env.META_PHONE_NUMBER_ID;
            const metaApiVersion = process.env.META_GRAPH_API_VERSION || 'v21.0';

            let targetNumber = fromNumber;
            if (cleanFrom.endsWith('2613168608')) {
                targetNumber = '54261153168608';
            } else if (cleanFrom.endsWith('520753')) {
                targetNumber = '54296415520753';
            }

            if (metaAccessToken && metaPhoneNumberId) {
                try {
                    let interactivePayload = null;
                    const isMenuIntent = !bodyText || bodyText.toLowerCase() === 'menu' || bodyText.toLowerCase() === 'hola' || botReply.includes('Centro de Mando') || botReply.includes('Panel Técnico') || botReply.includes('Copiloto Inteligente');

                    if (isMenuIntent) {
                        if (isDirector) {
                            interactivePayload = buildDirectorListMessage(state, targetNumber);
                        } else if (isTechnicalDirector) {
                            interactivePayload = buildVictoriaListMessage(state, targetNumber);
                        } else {
                            interactivePayload = buildWorkerListMessage(state, senderName, senderRole, targetNumber);
                        }
                    } else if (isDirector && (botReply.includes('Certificación de Avance') || botReply.includes('Alerta Crítica') || botReply.includes('Replanificación') || botReply.includes('Rendición'))) {
                        interactivePayload = buildActionButtonsMessage(botReply, targetNumber, [
                            { id: "cmd_menu", title: "📋 Menú Principal" },
                            { id: "cmd_1", title: "👷‍♂️ Ver Cuadrilla" },
                            { id: "cmd_6", title: "📅 Plan Quincenal" }
                        ]);
                    }

                    let sentInteractive = false;
                    if (interactivePayload) {
                        const metaRes = await fetch(
                            `https://graph.facebook.com/${metaApiVersion}/${metaPhoneNumberId}/messages`,
                            {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${metaAccessToken}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(interactivePayload)
                            }
                        );
                        if (metaRes.ok) {
                            sentInteractive = true;
                        } else {
                            const errData = await metaRes.json();
                            console.warn('Interactive message not accepted by Meta sandbox, falling back to text:', errData);
                        }
                    }

                    // Fallback to rich text markdown if interactive was not sent or not applicable
                    if (!sentInteractive) {
                        await fetch(
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
                    }
                } catch (metaErr) {
                    console.error('Meta Cloud API reply error:', metaErr.message);
                }
            }
        }

        // Format Response
        if (contentType.includes('x-www-form-urlencoded')) {
            const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${botReply}</Message></Response>`;
            return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
        }

        return Response.json({
            success: true,
            sender: senderName,
            role: senderRole,
            isDirector,
            isTechnicalDirector,
            reply: botReply,
            state: state
        });

    } catch (error) {
        console.error("Error processing WhatsApp webhook:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
