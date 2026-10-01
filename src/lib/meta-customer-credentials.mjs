import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
import {WorkspaceError} from './workspace-policy.mjs';

// Enterprise AES-256-GCM credential format, strengthened with tenant/asset AAD.
// The shared demo credential is deliberately outside this vault.
function key(environment){
 const encoded=environment.META_CUSTOMER_CREDENTIALS_KEY||environment.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
 if(typeof encoded!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw new WorkspaceError('META_CUSTOMER_VAULT_UNAVAILABLE',503);
 const decoded=Buffer.from(encoded,'base64');if(decoded.length!==32)throw new WorkspaceError('META_CUSTOMER_VAULT_UNAVAILABLE',503);return decoded;
}
const aad=context=>Buffer.from(JSON.stringify(['obrasaas-customer-v2',context.organizationId,context.projectId,context.purpose,context.resourceId]));
export function customerVaultConfigured(environment=process.env){try{key(environment);return true;}catch{return false;}}
export function encryptCustomerSecret(value,context,environment=process.env){
 if(typeof value!=='string'||!value.length||value.length>262144)throw new WorkspaceError('META_CUSTOMER_SECRET_INVALID');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(environment),nonce);cipher.setAAD(aad(context));
 const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return ['v2',nonce.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function decryptCustomerSecret(value,context,environment=process.env){
 try{const parts=String(value).split('.');if(parts.length!==4||parts[0]!=='v2')throw new Error();
  const nonce=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[2],'base64url');if(nonce.length!==12||tag.length!==16)throw new Error();
  const decipher=createDecipheriv('aes-256-gcm',key(environment),nonce);decipher.setAAD(aad(context));decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString('utf8');
 }catch{throw new WorkspaceError('META_CUSTOMER_CREDENTIAL_SCOPE_REJECTED',409);}
}
export const customerSecretDigest=value=>createHash('sha256').update(value).digest('hex');
