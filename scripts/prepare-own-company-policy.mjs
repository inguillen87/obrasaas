#!/usr/bin/env node
// Prepara la política del número propio sin red, base de datos ni tokens.
// Usa el mismo parser que producción antes de imprimir los valores de configuración.
import {parseArgs} from 'node:util';
import {
  readOwnCompanyPolicy,
  ownCompanyPolicySourceDigest,
  META_OWN_COMPANY_TTL_MS,
} from '../src/lib/meta-own-company-policy.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {normalizeCompanyPhone} from '../src/lib/company-onboarding-policy.mjs';

const options = {
  'source-head': {type: 'string'},
  'organization-id': {type: 'string'},
  'actor-id': {type: 'string'},
  'clerk-user-id': {type: 'string'},
  'clerk-organization-id': {type: 'string'},
  'project-id': {type: 'string'},
  'business-id': {type: 'string'},
  'waba-id': {type: 'string'},
  'phone-number-id': {type: 'string'},
  phone: {type: 'string'},
  'phone-revision': {type: 'string'},
  hours: {type: 'string', default: '4'},
  'issued-at': {type: 'string'},
  help: {type: 'boolean', short: 'h'},
};
const fail = message => {
  console.error('ERROR: ' + message);
  process.exit(1);
};
let values;
try {
  ({values} = parseArgs({options, strict: true, allowPositionals: false}));
} catch (error) {
  fail(error.message);
}
if (values.help) {
  console.log(`Uso: node scripts/prepare-own-company-policy.mjs
  --source-head <SHA de producción, 40 caracteres>
  --organization-id <Organization.id> --actor-id <PlatformUser.id del ADMIN>
  --clerk-user-id <user_...> --clerk-organization-id <org_...>
  --project-id <Project.id> --business-id <Business ID>
  --waba-id <WABA ID> --phone-number-id <Phone number ID>
  --phone <número E.164> --phone-revision <revisión declarada>
  [--hours 4] [--issued-at <fecha ISO con zona horaria>]

Valida la política con el reloj actual. Una fecha futura o una ventana vencida
se rechazan sin imprimir configuración. No lee ni guarda tokens.
Ver docs/production/piloto-numero-propio.md.`);
  process.exit(0);
}
const required = [
  'source-head', 'organization-id', 'actor-id', 'clerk-user-id',
  'clerk-organization-id', 'project-id', 'business-id', 'waba-id',
  'phone-number-id', 'phone', 'phone-revision',
];
const missing = required.filter(name => !values[name]?.trim());
if (missing.length) fail('faltan --' + missing.join(', --'));
const text = name => values[name].trim();
const sourceHead = text('source-head').toLowerCase();
if (!/^[a-f0-9]{40}$/.test(sourceHead)) {
  fail('--source-head debe ser el SHA completo (40 hex) del commit desplegado en Production.');
}
const hours = Number(values.hours);
const durationMs = Math.round(hours * 3600000);
if (!Number.isFinite(hours) || durationMs < 1000 || durationMs > META_OWN_COMPANY_TTL_MS) {
  fail('--hours debe definir una ventana de al menos un segundo y como máximo ' + META_OWN_COMPANY_TTL_MS / 3600000 + ' horas.');
}
const revision = Number(text('phone-revision'));
if (!Number.isSafeInteger(revision) || revision < 1) {
  fail('--phone-revision debe ser un entero mayor o igual a 1.');
}
let expectedPhoneE164;
try {
  expectedPhoneE164 = normalizeCompanyPhone(text('phone'));
} catch {
  fail('--phone no es un número válido para la empresa.');
}
const currentMs = Date.now();
const issuedInput = values['issued-at'];
if (issuedInput && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(issuedInput)) {
  fail('--issued-at debe ser una fecha ISO con hora y zona horaria explícitas.');
}
const issuedMs = issuedInput ? Date.parse(issuedInput) : Math.floor(currentMs / 1000) * 1000;
if (!Number.isFinite(issuedMs)) fail('--issued-at no es una fecha válida.');
if (issuedMs > currentMs) fail('--issued-at está en el futuro; generá la política cuando vayas a usarla.');
if (issuedMs + durationMs <= currentMs) fail('la ventana ya venció; generá una política vigente.');
const issuedAt = new Date(issuedMs).toISOString();
const expiresAt = new Date(issuedMs + durationMs).toISOString();

// Orden canónico de claves para el digest de revisión de producción.
const policy = {
  version: 1, sourceHead,
  organizationId: text('organization-id'), actorId: text('actor-id'),
  clerkUserId: text('clerk-user-id'), clerkOrganizationId: text('clerk-organization-id'),
  projectId: text('project-id'), appId: OBRASAAS_META_CHANNEL.appId,
  businessId: text('business-id'), wabaId: text('waba-id'),
  phoneNumberId: text('phone-number-id'), expectedPhoneE164,
  companyPhoneRevision: revision, issuedAt, expiresAt,
};
if (policy.wabaId === OBRASAAS_META_CHANNEL.wabaId || policy.phoneNumberId === OBRASAAS_META_CHANNEL.phoneNumberId) {
  fail('la WABA y el número deben ser los de la empresa, no los del número de prueba de ObraSaaS.');
}
const reviewSha256 = ownCompanyPolicySourceDigest(policy, sourceHead);
const environment = {
  VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: sourceHead,
  NEXT_PUBLIC_META_APP_ID: OBRASAAS_META_CHANNEL.appId,
  OBRASAAS_META_OWN_COMPANY_RELEASE: 'own-company-number-v1',
  OBRASAAS_META_OWN_COMPANY_POLICY: JSON.stringify(policy),
  OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256: reviewSha256,
};
if (!readOwnCompanyPolicy(environment, Date.now())) {
  fail('producción rechazaría esta política. Revisá la ventana vigente y los IDs: organizationId, actorId y projectId son internos; los de Clerk empiezan con user_ y org_; los de Meta son numéricos.');
}
console.log('# Cargar en Vercel → Settings → Environment Variables → Production (Sensitive):');
console.log('OBRASAAS_META_OWN_COMPANY_RELEASE=own-company-number-v1');
console.log('OBRASAAS_META_OWN_COMPANY_POLICY=' + JSON.stringify(policy));
console.log('OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256=' + reviewSha256);
console.log('# Ventana de administración: ' + issuedAt + ' → ' + expiresAt + ' (' + hours + ' h).');
console.log('# Redeploy del MISMO commit ' + sourceHead.slice(0, 12) + '; conectar y activar dentro de la ventana.');
