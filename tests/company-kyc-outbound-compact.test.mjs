import assert from 'node:assert/strict';
import test from 'node:test';
import {hasCompanyKycOutboundAuthority,prepareLockedCompanyKycOutboundAuthority,fenceLockedCompanyKycOutboundAuthority} from '../src/lib/company-channel-kyc.mjs';
import {companyKycOutboundCompactProofOutput,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS,COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS} from '../scripts/verify-company-kyc-outbound-compact-postgres.mjs';
import path from 'node:path';

test('a serialized corporate KYC shape cannot create a compact outbound authority',async()=>{
 const client={query(){assert.fail('Unsealed authority must fail before any SQL');}},context={eventId:'customer_webhook_'+'a'.repeat(64)},r={kind:'LIMITED_KYC_UPLOAD',recorded:{reply:{type:'text',body:'Synthetic'}}};
 assert.equal(hasCompanyKycOutboundAuthority(client,r),false);
 await assert.rejects(prepareLockedCompanyKycOutboundAuthority(client,r,context),error=>error.code==='META_KYC_COMPANY_AUTHORITY_CHANGED');
 await assert.rejects(fenceLockedCompanyKycOutboundAuthority(client,r,context),error=>error.code==='META_KYC_COMPANY_AUTHORITY_CHANGED');
});

test('native proof may choose a fresh private output but cannot overwrite unrelated artifacts',()=>{
 const root=path.resolve('synthetic-proof-root');
 assert.equal(companyKycOutboundCompactProofOutput([],root),path.resolve(root,'.vercel/private/company-kyc-outbound-compact-postgres.json'));
 assert.equal(companyKycOutboundCompactProofOutput(['--output','.vercel/private/company-kyc-outbound-compact-postgres-original-tx-20261014.json'],root),path.resolve(root,'.vercel/private/company-kyc-outbound-compact-postgres-original-tx-20261014.json'));
 for(const args of [['--output','outside.json'],['--output','.vercel/private/unrelated.json'],['--output','.vercel/private/../company-kyc-outbound-compact-postgres.json'],['--unsafe','ignored']])assert.throws(()=>companyKycOutboundCompactProofOutput(args,root));
});
test('OWN feedback measurements are a separate additive check group from the historical thirteen',()=>{
 assert.equal(COMPANY_KYC_OUTBOUND_COMPACT_CHECKS.length,13);assert.equal(COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS.length,1);assert.equal(COMPANY_KYC_OUTBOUND_COMPACT_CHECKS.some(check=>COMPANY_KYC_CONTEXT_OUTBOUND_CHECKS.includes(check)),false);
});
