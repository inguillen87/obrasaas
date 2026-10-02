import {WorkspaceError} from './workspace-policy.mjs';

// Trusted factory capabilities, never selected by a request field or an env flag.
export const META_CUSTOMER_PROTOCOL=Object.freeze({purpose:'CUSTOMER',provider:'meta-customer-v1',eventPrefix:'customer_webhook_',payloadPurpose:'webhook',proofPurpose:'webhook-proof',scheme:'meta-hmac-sha256-v1',credentialPurpose:'access-token',credentialFormat:'tenant-aad-v2'});
export const META_DEMO_PILOT_PROTOCOL=Object.freeze({purpose:'DEMO_PILOT',provider:'meta-demo-pilot-v1',eventPrefix:'demo_webhook_',payloadPurpose:'demo-webhook',proofPurpose:'demo-webhook-proof',scheme:'meta-demo-hmac-sha256-v1',credentialPurpose:'demo-access-token',credentialFormat:'demo-tenant-aad-v2'});
export function resolveMetaCloudProtocol(value=META_CUSTOMER_PROTOCOL){
 if(value!==META_CUSTOMER_PROTOCOL&&value!==META_DEMO_PILOT_PROTOCOL)throw new WorkspaceError('META_CLOUD_PROTOCOL_REJECTED',403);
 return value;
}
export function metaCloudEventId(protocol,externalId){resolveMetaCloudProtocol(protocol);if(!/^[a-f0-9]{64}$/.test(externalId||''))throw new WorkspaceError('META_CLOUD_PROTOCOL_REJECTED',403);return protocol.eventPrefix+externalId;}
export function metaCloudEventMatches(protocol,eventId){resolveMetaCloudProtocol(protocol);return typeof eventId==='string'&&eventId.startsWith(protocol.eventPrefix)&&/^[a-f0-9]{64}$/.test(eventId.slice(protocol.eventPrefix.length));}
