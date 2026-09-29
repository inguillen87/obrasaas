import {createPilotMediaAnalyzer,unavailableBiometricAssessment} from './pilot-media.mjs';
const pilotMedia=createPilotMediaAnalyzer();
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
  "montoTotal": 0,
  "moneda": "ARS",
  "items": [
    { "descripcion": "Nombre del producto/material", "cantidad": 1, "precioUnitario": 0, "subtotal": 0 }
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

/** Descriptive analysis only; never a storage, compliance or progress receipt. */
export async function analyzeObraPhotoWithAI(input) { return pilotMedia.analyzePhoto(input); }

/** OCR yields unverified extracted fields, never a verified worker identity. */
export async function analyzeDniWithAI(input) { return pilotMedia.analyzeDni(input); }

/** Existing string/null API; transcription is not speaker identification. */
export async function transcribeAudioWithAI(buffer,mimeType='audio/ogg') {
 const result=await pilotMedia.transcribeAudio({buffer,mimeType});return result.success?result.text:null;
}

/** Static photos and a general vision model are not a liveness verifier. */
export async function verifyFacialMatchAndLiveness() { return unavailableBiometricAssessment(); }

export async function transcribeAudioWithWhisper(input) {
 const result=await pilotMedia.transcribeAudio(input);return result.success?result.text:null;
}
