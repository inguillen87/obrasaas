import crypto from 'crypto';

const SECRET_KEY = process.env.JWT_SECRET || 'obrasaas-super-secret-key-123456';

/**
 * Genera un token HMAC temporal (validez de 2 horas) para un operario.
 * De esta forma se envían enlaces seguros por WhatsApp sin exponer credenciales.
 */
export function generateWebviewToken(workerPhone) {
    const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60 * 2)); // Ventana temporal de 2 horas
    return crypto
        .createHmac('sha256', SECRET_KEY)
        .update(`${workerPhone}-${hourBucket}`)
        .digest('hex')
        .substring(0, 16); // Token corto y amigable para URLs móviles
}

/**
 * Valida si un token HMAC recibido en el Webview es correcto para el operario.
 */
export function verifyWebviewToken(workerPhone, token) {
    if (!workerPhone || !token) return false;
    const expected = generateWebviewToken(workerPhone);
    return expected === token;
}

/**
 * Valida la firma criptográfica X-Twilio-Signature para asegurar que la petición
 * proviene realmente de los servidores de Twilio.
 */
export async function verifyTwilioSignature(request, authToken) {
    if (!authToken) {
        // Si no está configurado el token de Twilio, salteamos la verificación en desarrollo
        return true;
    }

    try {
        const signature = request.headers.get('x-twilio-signature');
        if (!signature) return false;

        const url = request.url;
        
        // Clonar request para leer formdata sin consumir el body original
        const clone = request.clone();
        const formData = await clone.formData();
        
        // Twilio ordena todos los parámetros alfabéticamente
        const params = {};
        for (const [key, value] of formData.entries()) {
            params[key] = value;
        }

        const sortedKeys = Object.keys(params).sort();
        let signatureString = url;
        
        for (const key of sortedKeys) {
            signatureString += key + params[key];
        }

        const expectedSignature = crypto
            .createHmac('sha1', authToken)
            .update(signatureString)
            .digest('base64');

        return expectedSignature === signature;
    } catch (e) {
        console.error("Error validando firma de Twilio:", e);
        return false;
    }
}
