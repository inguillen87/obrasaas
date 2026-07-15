import crypto from 'node:crypto';

const VERSION = 'v1';

function encryptionKey() {
  const encoded = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY is required.');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY must be 32 random bytes encoded as base64.');
  }
  return key;
}

export function encryptCredential(value) {
  if (!value || typeof value !== 'string') throw new Error('Credential value is required.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptCredential(payload) {
  const [version, iv, authTag, ciphertext] = String(payload || '').split('.');
  if (version !== VERSION || !iv || !authTag || !ciphertext) {
    throw new Error('Credential payload is invalid.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function credentialLastFour(value) {
  return String(value || '').slice(-4) || null;
}
