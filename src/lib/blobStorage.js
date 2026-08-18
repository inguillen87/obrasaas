// ============================================================================
// ObraSaaS Enterprise Blob Storage
// Uploads KYC images (DNI, Selfie) to Vercel Blob Storage instead of 
// storing raw base64 in PostgreSQL JSONB (which causes massive DB bloat)
// ============================================================================

import { put } from '@vercel/blob';

/**
 * Upload a base64 image to Vercel Blob Storage.
 * Returns the public URL of the uploaded blob.
 * Falls back to storing a truncated reference if Blob is not configured.
 * 
 * @param {string} base64Data - Raw base64 string (without data:image prefix)
 * @param {string} filename - Descriptive filename (e.g., 'kyc-juan-dni-front.jpg')
 * @param {string} contentType - MIME type (default: 'image/jpeg')
 * @returns {Promise<string>} URL of the uploaded blob, or placeholder string
 */
export async function uploadImageToBlob(base64Data, filename, contentType = 'image/jpeg') {
    // Check if Vercel Blob is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.warn('BLOB_READ_WRITE_TOKEN not configured. Storing image reference only.');
        // Return a placeholder instead of the full base64 to prevent DB bloat
        const sizeKB = Math.round((base64Data.length * 3) / 4 / 1024);
        return `[IMAGE_PENDING_UPLOAD:${filename}:${sizeKB}KB]`;
    }

    try {
        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Upload to Vercel Blob (default to private as configured in Vercel Storage)
        let blob;
        try {
            blob = await put(filename, buffer, {
                access: 'private',
                contentType,
                addRandomSuffix: true,
            });
        } catch (privateErr) {
            if (privateErr.message?.includes('public access')) {
                blob = await put(filename, buffer, {
                    access: 'public',
                    contentType,
                    addRandomSuffix: true,
                });
            } else {
                throw privateErr;
            }
        }

        console.log(`✅ Image uploaded to Blob: ${blob.url} (${Math.round(buffer.length / 1024)}KB)`);
        return blob.url;
    } catch (err) {
        console.error('Vercel Blob upload error:', err.message);
        // Fallback: store a reference instead of full base64
        const sizeKB = Math.round((base64Data.length * 3) / 4 / 1024);
        return `[UPLOAD_FAILED:${filename}:${sizeKB}KB:${err.message}]`;
    }
}

/**
 * Upload KYC document images (DNI front + Selfie) to blob storage.
 * @param {string} workerId - Worker ID for filename
 * @param {string} dniFrontBase64 - DNI front image as raw base64
 * @param {string} selfieBase64 - Selfie image as raw base64
 * @returns {Promise<{dniFrontUrl: string, selfieUrl: string}>}
 */
export async function uploadKycImages(workerId, dniFrontBase64, selfieBase64) {
    const timestamp = Date.now();
    const sanitizedId = (workerId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '');
    
    const [dniFrontUrl, selfieUrl] = await Promise.all([
        uploadImageToBlob(
            dniFrontBase64,
            `kyc/${sanitizedId}/dni-front-${timestamp}.jpg`,
            'image/jpeg'
        ),
        uploadImageToBlob(
            selfieBase64,
            `kyc/${sanitizedId}/selfie-${timestamp}.jpg`,
            'image/jpeg'
        )
    ]);

    return { dniFrontUrl, selfieUrl };
}
