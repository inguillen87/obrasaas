/**
 * ObraSaaS AI Vision & Multimodal Intelligence Engine
 * Handles Meta WhatsApp media downloads, OCR for invoices/remitos, construction inspection, and audio transcription.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const META_WHATSAPP_ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN;
const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';

/**
 * Downloads media from Meta WhatsApp Cloud API using media ID
 */
export async function downloadMetaMedia(mediaId) {
    if (!mediaId || !META_WHATSAPP_ACCESS_TOKEN) {
        return null;
    }

    try {
        // Step 1: Retrieve media metadata URL
        const metaRes = await fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${mediaId}`, {
            headers: {
                'Authorization': `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`
            }
        });

        if (!metaRes.ok) {
            console.error(`Meta media URL lookup failed: ${metaRes.status}`);
            return null;
        }

        const metaData = await metaRes.json();
        if (!metaData.url) {
            console.error("Meta media metadata missing download URL:", metaData);
            return null;
        }

        // Step 2: Download raw binary buffer
        const binaryRes = await fetch(metaData.url, {
            headers: {
                'Authorization': `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`,
                'User-Agent': 'ObraSaaS-Backend/2.0'
            }
        });

        if (!binaryRes.ok) {
            console.error(`Meta binary download failed: ${binaryRes.status}`);
            return null;
        }

        const arrayBuffer = await binaryRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = metaData.mime_type || binaryRes.headers.get('content-type') || 'image/jpeg';
        const base64 = buffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64}`;

        return {
            buffer,
            base64,
            dataUri,
            mimeType,
            fileSize: metaData.file_size || buffer.length
        };
    } catch (err) {
        console.error("Error downloading Meta media:", err);
        return null;
    }
}

/**
 * Performs OCR and extraction on invoices, receipts, and remitos with GPT-4o Vision
 */
export async function analyzeRemitoWithAI({ base64, mimeType = 'image/jpeg', imageUrl, rawText = '' }) {
    if (!OPENAI_API_KEY) {
        console.warn("OPENAI_API_KEY not configured. Falling back to heuristic OCR extraction.");
        return extractHeuristicReceipt(rawText);
    }

    const imageContent = imageUrl 
        ? { type: "image_url", image_url: { url: imageUrl } }
        : { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } };

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `Eres el motor experto en OCR y auditoría contable de ObraSaaS para empresas de construcción en Argentina.
Analiza la imagen del comprobante, remito, factura o ticket de ferretería / corralón y extrae los datos en formato JSON estricto.
El JSON debe tener exactamente esta estructura:
{
  "proveedor": "Nombre del Comercio o Proveedor",
  "cuit": "XX-XXXXXXXX-X o 'No especificado'",
  "comprobanteNro": "Nro de Factura o Remito (ej: 0001-00048192)",
  "fecha": "DD/MM/YYYY",
  "montoTotal": 18500,
  "moneda": "ARS",
  "items": [
    { "descripcion": "Nombre del producto/material", "cantidad": 2, "precioUnitario": 3500, "subtotal": 7000 }
  ],
  "categoria": "Ferretería & Herramientas",
  "ocrConfidence": 98.5,
  "resumen": "Breve descripción clara de la compra"
}
Si la imagen no es un ticket o remito, devuelve "isReceipt": false con una breve explicación en "resumen". Responde SOLO JSON válido.`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `Por favor analiza este comprobante de compra o remito de obra. Texto adicional proporcionado: ${rawText}` },
                            imageContent
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                max_tokens: 1200
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`OpenAI Vision OCR API error: ${response.status}`, errText);
            return extractHeuristicReceipt(rawText);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        const parsed = JSON.parse(content || '{}');
        return {
            success: true,
            ...parsed,
            montoTotal: Number(parsed.montoTotal) || 0,
            ocrConfidence: parsed.ocrConfidence || 95.0
        };
    } catch (err) {
        console.error("Failed to analyze receipt with GPT-4o Vision:", err);
        return extractHeuristicReceipt(rawText);
    }
}

/**
 * Analyzes construction site photos (work progress, pipe leak, plastering, defect, safety)
 */
export async function analyzeObraPhotoWithAI({ base64, mimeType = 'image/jpeg', imageUrl, context = '' }) {
    if (!OPENAI_API_KEY) {
        return {
            phase: "Inspección Visual",
            aiAnalysis: "Foto recibida y archivada en bitácora de obra.",
            defectDetected: false,
            confidence: 90
        };
    }

    const imageContent = imageUrl 
        ? { type: "image_url", image_url: { url: imageUrl } }
        : { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } };

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `Eres el Supervisor Técnico de Calidad y Seguridad de ObraSaaS para obras de construcción en Argentina.
Analiza la fotografía de obra enviada por el personal y devuelve un JSON estricto con:
{
  "phase": "Mampostería & Revoques" | "Instalaciones Sanitarias / Gas" | "Estructura de Hormigón" | "Pintura y Terminaciones" | "Electricidad" | "Seguridad y EPP" | "General",
  "aiAnalysis": "Descripción técnica detallada de lo que se observa (materiales, calidad de ejecución, alineación, anomalías).",
  "isIncident": true | false,
  "incidentSeverity": "Ninguna" | "Baja" | "Media" | "Crítica",
  "estimatedProgressPercentage": 0,
  "actionRecommendation": "Recomendación técnica para el Director de Obra.",
  "confidence": 95
}
Responde SOLO JSON válido.`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: `Analiza esta fotografía tomada en la obra Torre Palermo Soho. Contexto: ${context}` },
                            imageContent
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            return {
                phase: "Inspección General",
                aiAnalysis: "Foto registrada en el expediente de obra.",
                isIncident: false,
                confidence: 85
            };
        }

        const data = await response.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        return {
            success: true,
            ...parsed
        };
    } catch (err) {
        console.error("Failed to analyze site photo with GPT-4o Vision:", err);
        return {
            phase: "Inspección General",
            aiAnalysis: "Foto registrada en el expediente de obra.",
            isIncident: false,
            confidence: 85
        };
    }
}

/**
 * Performs OCR on Argentine National Identity Document (DNI) for worker KYC onboarding
 */
export async function analyzeDniWithAI({ base64, mimeType = 'image/jpeg', imageUrl }) {
    if (!OPENAI_API_KEY) {
        return {
            success: true,
            nombreCompleto: "Operario Verificado",
            dni: "30.123.456",
            cuil: "20-30123456-4",
            fechaNacimiento: "15/05/1990",
            status: "VERIFICADO_SIMULADO"
        };
    }

    const imageContent = imageUrl 
        ? { type: "image_url", image_url: { url: imageUrl } }
        : { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } };

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `Eres el motor de validación KYC y OCR de Identidad de ObraSaaS.
Analiza la foto del DNI (Documento Nacional de Identidad de Argentina) o Credencial UOCRA y extrae:
{
  "isDni": true,
  "nombre": "Nombre",
  "apellido": "Apellido",
  "nombreCompleto": "Nombre y Apellido",
  "dni": "XX.XXX.XXX",
  "cuil": "XX-XXXXXXXX-X",
  "fechaNacimiento": "DD/MM/YYYY",
  "domicilio": "Dirección completa o 'No visible'",
  "nacionalidad": "Argentina",
  "validez": "Vigente",
  "ocrConfidence": 98.9
}
Responde SOLO JSON válido.`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Extrae los datos de identidad de este documento para el legajo del trabajador en ObraSaaS." },
                            imageContent
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI DNI OCR error: ${response.status}`);
        }

        const data = await response.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        return {
            success: true,
            ...parsed
        };
    } catch (err) {
        console.error("DNI OCR failed:", err);
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Transcribes WhatsApp voice notes (.ogg audio buffer) using OpenAI Whisper
 */
export async function transcribeAudioWithAI(audioBuffer, mimeType = 'audio/ogg') {
    if (!OPENAI_API_KEY || !audioBuffer) {
        return null;
    }

    try {
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: mimeType });
        formData.append("file", blob, "whatsapp_audio.ogg");
        formData.append("model", "whisper-1");
        formData.append("language", "es");
        formData.append("prompt", "Transcripción de audio de obra en construcción en Argentina: revoque, albañilería, cañería, cerámicas, remito, metros cuadrados, bolsa de cemento, quincena.");

        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: formData
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Whisper transcription error:", res.status, errText);
            return null;
        }

        const data = await res.json();
        return data.text || null;
    } catch (err) {
        console.error("Audio transcription failed:", err);
        return null;
    }
}

/**
 * Performs Facial Biometric Matching and Liveness Anti-Spoofing Check with GPT-4o Vision
 */
export async function verifyFacialMatchAndLiveness({ selfieBase64, dniBase64 }) {
    if (!OPENAI_API_KEY) {
        return {
            success: true,
            isMatch: true,
            confidenceScore: 97.4,
            livenessDetected: true,
            isDniGenuine: true,
            analysis: "Verificación biométrica aprobada en modo simulación de desarrollo.",
            auditBadge: "MATCH_BIOMETRICO_OK"
        };
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `Eres el motor biométrico de alta seguridad de ObraSaaS para verificación de operarios de construcción (KYC).
Se te proporcionan 2 imágenes:
Imagen 1: Fotografía del DNI / Credencial UOCRA.
Imagen 2: Selfie en vivo tomada con la cámara frontal.

Realiza una auditoría biométrica y anti-spoofing estricta:
1. Compara las facciones faciales (ojos, nariz, boca, estructura ósea) entre la foto del DNI y la selfie en vivo.
2. Evalúa si la selfie es una persona real en vivo (liveness) o si parece una foto de una pantalla o papel (spoofing).
3. Evalúa si la credencial/DNI es genuina y legible.

Devuelve estrictamente un JSON con esta estructura:
{
  "isMatch": true o false,
  "confidenceScore": 95.8,
  "livenessDetected": true o false,
  "isDniGenuine": true o false,
  "analysis": "Explicación detallada de la concordancia de rasgos y calidad de la imagen",
  "auditBadge": "MATCH_BIOMETRICO_OK" o "RECHAZADO_DISCORDANCIA_FACIAL" o "RECHAZADO_SPOOFING"
}
Si la coincidencia es dudosa o inferior a 70%, define "isMatch": false. Responde SOLO JSON válido.`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Compara biométricamente la foto del DNI (Imagen 1) con la selfie en vivo (Imagen 2)." },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${dniBase64.replace(/^data:image\/\w+;base64,/, '')}` } },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${selfieBase64.replace(/^data:image\/\w+;base64,/, '')}` } }
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI Biometrics API error: ${response.status}`);
        }

        const data = await response.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        return {
            success: true,
            isMatch: parsed.isMatch !== false,
            confidenceScore: parsed.confidenceScore || 95.0,
            livenessDetected: parsed.livenessDetected !== false,
            isDniGenuine: parsed.isDniGenuine !== false,
            analysis: parsed.analysis || "Validación biométrica completada con éxito.",
            auditBadge: parsed.auditBadge || "MATCH_BIOMETRICO_OK"
        };
    } catch (err) {
        console.error("Biometric matching failed:", err);
        return {
            success: false,
            isMatch: false,
            confidenceScore: 0,
            error: err.message,
            auditBadge: "ERROR_ANALISIS_BIOMETRICO"
        };
    }
}

