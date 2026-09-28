import crypto from 'crypto';
import { authorizeLegacyService, exactSecretMatch } from './legacy-access-boundary.js';

// ============================================================================
// ObraSaaS Enterprise Auth & Security Module
// Unified token generation, verification, and webhook signature validation
// ============================================================================

const webviewSecret = () => process.env.WEBVIEW_TOKEN_SECRET || '';
const metaSecret = () => process.env.META_APP_SECRET || '';

// ============================================================================
// 1. Webview Token Generator & Verifier (Unified)
// Used by: WhatsApp route (generates links) AND /api/auth/verify (validates)
// ============================================================================

/**
 * Generates an HMAC-SHA256 webview token with a 2-hour validity window.
 * This is used to create secure links sent via WhatsApp for KYC, Attendance, Medical.
 * @param {string} workerId - Worker short ID (e.g., 'juan', 'carlos', 'director')
 * @returns {string} 16-char hex token
 */
export function generateWebviewToken(workerId) {
    if (!webviewSecret() || typeof workerId !== 'string' || !workerId) throw new Error('Signed access is not configured.');
    const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60 * 2)); // 2-hour window
    return crypto
        .createHmac('sha256', webviewSecret())
        .update(`${workerId}-${hourBucket}`)
        .digest('hex')
        .substring(0, 16);
}

/**
 * Verifies a webview token against the current AND previous time windows.
 * Checks both the current 2-hour bucket and the previous one for grace period.
 * @param {string} workerId - Worker short ID
 * @param {string} token - Token to verify
 * @returns {boolean}
 */
export function verifyWebviewToken(workerId, token) {
    if (!webviewSecret() || typeof workerId !== 'string' || !workerId || typeof token !== 'string' || !/^[a-f0-9]{16}$/.test(token)) return false;

    // Check current window
    const currentBucket = Math.floor(Date.now() / (1000 * 60 * 60 * 2));
    const currentToken = crypto
        .createHmac('sha256', webviewSecret())
        .update(`${workerId}-${currentBucket}`)
        .digest('hex')
        .substring(0, 16);

    if (exactSecretMatch(token, currentToken)) return true;

    // Check previous window (grace period for tokens generated near boundary)
    const prevToken = crypto
        .createHmac('sha256', webviewSecret())
        .update(`${workerId}-${currentBucket - 1}`)
        .digest('hex')
        .substring(0, 16);

    return exactSecretMatch(token, prevToken);
}

// ============================================================================
// 2. Meta WhatsApp Webhook Signature Verification
// Validates X-Hub-Signature-256 header to prevent spoofed webhooks
// ============================================================================

/**
 * Verifies the Meta WhatsApp Cloud API webhook signature.
 * @param {Request} request - Incoming request object
 * @param {string} rawBody - Raw request body string
 * @returns {boolean}
 */
export function verifyMetaWebhookSignature(request, rawBody) {
    if (!metaSecret()) return false;

    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) return false;

    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', metaSecret())
        .update(rawBody)
        .digest('hex');

    // Timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
}

// ============================================================================
// 3. API Authentication Middleware
// Protects sensitive endpoints (DELETE /api/state, POST /api/project, etc.)
// ============================================================================

/**
 * Validates internal API secret from request headers.
 * @param {Request} request
 * @returns {{ authorized: boolean, reason?: string }}
 */
export function verifyApiAuth(request) {
    return authorizeLegacyService(request)
        ? { authorized: true }
        : { authorized: false, reason: 'Missing or invalid service credential' };
}

// ============================================================================
// 4. Message Deduplication Cache (In-Memory TTL)
// Prevents duplicate webhook processing from Meta retries
// ============================================================================

const processedMessages = new Map();
const MESSAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if a message ID has already been processed.
 * @param {string} messageId - Meta message ID (wamid.xxx)
 * @returns {boolean} true if already processed (duplicate)
 */
export function isMessageDuplicate(messageId) {
    if (!messageId) return false;

    // Clean expired entries periodically
    if (processedMessages.size > 500) {
        const now = Date.now();
        for (const [id, timestamp] of processedMessages) {
            if (now - timestamp > MESSAGE_TTL_MS) {
                processedMessages.delete(id);
            }
        }
    }

    if (processedMessages.has(messageId)) {
        return true;
    }

    processedMessages.set(messageId, Date.now());
    return false;
}

// ============================================================================
// 5. Legacy Twilio Signature Verification (Backward Compatibility)
// ============================================================================

export async function verifyTwilioSignature(request, authToken) {
    if (!authToken) return false;

    try {
        const signature = request.headers.get('x-twilio-signature');
        if (!signature) return false;

        const url = request.url;
        const clone = request.clone();
        const formData = await clone.formData();

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
        console.error("Error validating Twilio signature:", e);
        return false;
    }
}
