#!/usr/bin/env node
// Prepara, sin red ni secretos, la política privada del número propio de la empresa.
// Imprime los tres valores que el titular carga en Vercel Production y los valida con el
// mismo parser que usa producción (readOwnCompanyPolicy). No lee ni escribe base de datos,
// no llama a Meta y no maneja tokens: META_OWN_COMPANY_ACCESS_TOKEN se carga aparte.
//
//   node scripts/prepare-own-company-policy.mjs \
//     --source-head <sha de 40 caracteres del deploy de Production> \
//     --organization-id <Organization.id> --actor-id <PlatformUser.id del ADMIN> \
//     --clerk-user-id user_... --clerk-organization-id org_... --project-id <Project.id> \
//     --business-id <id Business Manager> --waba-id <id WABA> --phone-number-id <id del número> \
//     --phone "+54 9 221 204-2975" --phone-revision <revisión declarada> [--hours 4] [--issued-at ISO]
//
// Ver docs/production/piloto-numero-propio.md para obtener cada valor.
import {parseArgs} from 'node:util';
import {readOwnCompanyPolicy,ownCompanyPolicySourceDigest,META_OWN_COMPANY_TTL_MS} from '../src/lib/meta-own-company-policy.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {normalizeCompanyPhone} from '../src/lib/company-onboarding-policy.mjs';

const options={
 'source-head':{type:'string'},'organization-id':{type:'string'},'actor-id':{type:'string'},
 'clerk-user-id':{type:'string'},'clerk-organization-id':{type:'string'},'project-id':{type:'string'},
 'business-id':{type:'string'},'waba-id':{type:'string'},'phone-number-id':{type:'string'},
 phone:{type:'string'},'phone-revision':{type:'string'},hours:{type:'string',default:'4'},'issued-at':{type:'string'},
 help:{type:'boolean',short:'h'}
};
const fail=message=>{console.error('ERROR: '+message);process.exit(1);};
let values;
try{({values}=parseArgs({options,strict:true,allowPositionals:false}));}catch(error){fail(error.message);}
if(values.help){console.log('Uso: ver el encabezado de scripts/prepare-own-company-policy.mjs');process.exit(0);}
const required=['source-head','organization-id','actor-id','clerk-user-id','clerk-organization-id','project-id','business-id','waba-id','phone-number-id','phone','phone-revision'];
const missing=required.filter(name=>!values[name]?.trim());
if(missing.length)fail('faltan --'+missing.join(', --'));
const text=name=>values[name].trim();

const sourceHead=text('source-head').toLowerCase();
if(!/^[a-f0-9]{40}$/.test(sourceHead))fail('--source-head debe ser el SHA completo (40 hex) del commit desplegado en Production.');
const hours=Number(values.hours);
if(!Number.isFinite(hours)||hours<=0||hours*3600000>META_OWN_COMPANY_TTL_MS)fail('--hours debe ser mayor que 0 y como máximo '+META_OWN_COMPANY_TTL_MS/3600000+'.');
const revision=Number(text('phone-revision'));
if(!Number.isSafeInteger(revision)||revision<1)fail('--phone-revision debe ser un entero mayor o igual a 1.');
let expectedPhoneE164;
try{expectedPhoneE164=normalizeCompanyPhone(text('phone'));}catch{fail('--phone no es un número válido para la empresa.');}
const issuedMs=values['issued-at']?Date.parse(values['issued-at']):Math.floor(Date.now()/1000)*1000;
if(!Number.isFinite(issuedMs))fail('--issued-at no es una fecha ISO válida.');
const issuedAt=new Date(issuedMs).toISOString(),expiresAt=new Date(issuedMs+Math.round(hours*3600000)).toISOString();

// Mismo orden de claves que exige producción para el digest de revisión.
const policy={version:1,sourceHead,organizationId:text('organization-id'),actorId:text('actor-id'),clerkUserId:text('clerk-user-id'),clerkOrganizationId:text('clerk-organization-id'),projectId:text('project-id'),appId:OBRASAAS_META_CHANNEL.appId,businessId:text('business-id'),wabaId:text('waba-id'),phoneNumberId:text('phone-number-id'),expectedPhoneE164,companyPhoneRevision:revision,issuedAt,expiresAt};
if(policy.wabaId===OBRASAAS_META_CHANNEL.wabaId||policy.phoneNumberId===OBRASAAS_META_CHANNEL.phoneNumberId)fail('la WABA y el número deben ser los de la empresa, no los del número de prueba de ObraSaaS.');
let reviewSha256;
try{reviewSha256=ownCompanyPolicySourceDigest(policy,sourceHead);}catch{fail('la política no tiene todas las claves requeridas.');}

// Validación con el parser real, en un entorno sintético equivalente al de Production.
const environment={VERCEL_ENV:'production',VERCEL_GIT_COMMIT_SHA:sourceHead,NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,OBRASAAS_META_OWN_COMPANY_RELEASE:'own-company-number-v1',OBRASAAS_META_OWN_COMPANY_POLICY:JSON.stringify(policy),OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256:reviewSha256};
if(!readOwnCompanyPolicy(environment,issuedMs+1000))fail('producción rechazaría esta política. Revisá los IDs: organizationId, actorId y projectId son IDs internos; clerkUserId empieza con user_, clerkOrganizationId con org_, y los IDs de Meta son numéricos.');
if(Date.parse(expiresAt)<=Date.now())console.error('AVISO: la ventana ya venció; generá la política de nuevo justo antes de cargarla.');

console.log('# Cargar en Vercel → Settings → Environment Variables → Production (marcar Sensitive):');
console.log('OBRASAAS_META_OWN_COMPANY_RELEASE=own-company-number-v1');
console.log('OBRASAAS_META_OWN_COMPANY_POLICY='+JSON.stringify(policy));
console.log('OBRASAAS_META_OWN_COMPANY_POLICY_REVIEW_SHA256='+reviewSha256);
console.log('# Ventana de administración: '+issuedAt+' → '+expiresAt+' ('+hours+' h).');
console.log('# Después: Redeploy del MISMO commit '+sourceHead.slice(0,12)+' (sin cambiar el código), y dentro de la ventana');
console.log('# conectar y activar el número desde /cuenta → Número de la empresa.');
