import assert from 'node:assert/strict';
import test from 'node:test';
import { pilotImportProviderDiagnostic, pilotImportPublicDiagnostic } from '../src/lib/whatsapp/pilot-import-diagnostics.js';
import { pilotImportErrorMessage } from '../src/app/dashboard/integrations/pilot-import-helpers.js';
const codes=['META_PILOT_TOKEN_EXPIRY_REQUIRED','META_PILOT_TOKEN_EXPIRED','META_PILOT_TOKEN_TTL_INSUFFICIENT','META_TOKEN_APP_MISMATCH','META_SCOPES_INCOMPLETE','PHONE_WABA_MISMATCH'];
for(const code of codes)test('known credential rejection carries a safe recovery message: '+code,()=>{
 const error={status:403,code,message:'SECRET-MUST-NOT-APPEAR'};
 const result=pilotImportProviderDiagnostic(error);
 assert.equal(result.changeRequired,true);
 assert.equal(pilotImportPublicDiagnostic(400,'PILOT_IMPORT_VALIDATION_FAILED',result.code),result);
 assert.equal(pilotImportErrorMessage(400,'PILOT_IMPORT_VALIDATION_FAILED',result.code),result.message);
 assert.ok(!JSON.stringify(result).includes(error.message));assert.ok(Object.isFrozen(result));
});
for(const error of [null,{}, {status:500,code:codes[0]}, {status:'403',code:codes[0]}, {status:403,code:'__proto__'}, {status:403,code:'META_190'}, {status:403,code:codes[0]+' ' }])test('unrecognized failure keeps existing uncertain handling: '+JSON.stringify(error),()=>assert.equal(pilotImportProviderDiagnostic(error),null));
for(const [status,code,diagnostic] of [[500,'PILOT_IMPORT_VALIDATION_FAILED','PILOT_TOKEN_NOT_TEMPORARY'],[403,'DENIED','PILOT_TOKEN_NOT_TEMPORARY'],[400,'PILOT_IMPORT_VALIDATION_FAILED','__proto__'],[400,'PILOT_IMPORT_VALIDATION_FAILED','<script>secret</script>']])test('public reason cannot override another error class: '+diagnostic+status,()=>{
 assert.equal(pilotImportPublicDiagnostic(status,code,diagnostic),null);
 assert.equal(pilotImportErrorMessage(status,code,diagnostic),pilotImportErrorMessage(status,code));
});
test('no-expiration diagnosis is the importer policy, not an assertion that Meta failed',()=>{
 const diagnostic=pilotImportProviderDiagnostic({status:403,code:codes[0]});
 assert.match(diagnostic.message,/sin vencimiento/);assert.match(diagnostic.message,/importador piloto exige/);assert.match(diagnostic.message,/no cambies la clave/);
});
