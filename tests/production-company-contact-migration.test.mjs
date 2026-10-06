import assert from 'node:assert/strict';
import test from 'node:test';
import {COMPANY_CONTACT_TARGET,COMPANY_CONTACT_GUARD,COMPANY_SUPERADMIN_INDEX,companyContactArguments,companyContactProductionContext,checkCompanyContactCatalog} from '../scripts/lib/company-contact-migration.mjs';
const catalog=()=>({relation:{relkind:'r',canAlter:true},columns:[{column_name:'clerkUserId',data_type:'text',is_nullable:'NO',column_default:null},{column_name:'primaryEmail',data_type:'text',is_nullable:'NO',column_default:null},{column_name:'systemRole',data_type:'USER-DEFINED',udt_name:'SystemRole',is_nullable:'NO'}],indexes:['clerkUserId','primaryEmail'].map(column=>({indexname:'PlatformUser_'+column+'_key',indexdef:`CREATE UNIQUE INDEX "PlatformUser_${column}_key" ON public."PlatformUser" USING btree ("${column}")`,indisvalid:true,indisready:true,indisunique:true})),constraints:[{conname:'PlatformUser_single_superadmin_email_check',contype:'c',convalidated:true,definition:'CHECK (((lower(TRIM(BOTH FROM "primaryEmail")) = \'protected@example.test\'::text) = ("systemRole" = \'SUPERADMIN\'::"SystemRole")))'}],triggers:[]});
const args=['--expected-project',COMPANY_CONTACT_TARGET.projectId,'--expected-team',COMPANY_CONTACT_TARGET.teamId];
test('contact migration defaults to read-only and apply requires a reviewed fingerprint',()=>{
 assert.equal(companyContactArguments(args).mode,'DRY_RUN');assert.throws(()=>companyContactArguments([...args,'--apply']),{code:'COMPANY_CONTACT_ARGUMENTS_INVALID'});
 assert.equal(companyContactArguments([...args,'--apply','--expected-fingerprint','a'.repeat(64)]).mode,'APPLY');
 for(const extra of [['--dry-run','--apply'],['--unknown'],['--expected-fingerprint','secret'],['--apply','--apply']])assert.throws(()=>companyContactArguments([...args,...extra]));
});
test('production contact migration binds project, team and production origin before connecting',()=>{
 const env={VERCEL_ENV:'production',VERCEL_PROJECT_ID:COMPANY_CONTACT_TARGET.projectId,NEXT_PUBLIC_APP_URL:COMPANY_CONTACT_TARGET.origin},project={projectId:COMPANY_CONTACT_TARGET.projectId,orgId:COMPANY_CONTACT_TARGET.teamId},command=companyContactArguments(args);
 assert.equal(companyContactProductionContext(env,project,command).projectVerified,true);
 for(const patch of [{VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'other'},{NEXT_PUBLIC_APP_URL:'https://elsewhere.example'},{VERCEL_ORG_ID:'other'}])assert.throws(()=>companyContactProductionContext({...env,...patch},project,command));
});
test('catalogue accepts only the protected legacy contact contract and redacts its email',()=>{
 const before=checkCompanyContactCatalog(catalog());assert.equal(before.state,'LEGACY');assert.match(before.fingerprint,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(before).includes('protected@example.test'));
 for(const mutate of [v=>{v.indexes.pop();},v=>{v.constraints[0].definition='CHECK (true)';},v=>{v.constraints[0].convalidated=false;},v=>{v.columns[0].is_nullable='YES';},v=>{v.columns[1].is_nullable='YES';},v=>{v.triggers.push({tgname:'unexpected'});}]){const value=catalog();mutate(value);assert.equal(checkCompanyContactCatalog(value).state,'REJECTED');}
 for(const index of [0,1])for(const property of ['indisvalid','indisready','indisunique']){const value=catalog();value.indexes[index][property]=false;const rejected=checkCompanyContactCatalog(value);assert.equal(rejected.state,'REJECTED');assert.notEqual(rejected.fingerprint,before.fingerprint);}
});
test('nullable contact is adopted only with a validated guard forbidding null superadmins',()=>{
 const value=catalog();value.columns[1].is_nullable='YES';value.constraints.push({conname:COMPANY_CONTACT_GUARD,contype:'c',convalidated:true,definition:'CHECK ((("systemRole" <> \'SUPERADMIN\'::"SystemRole") OR ("primaryEmail" IS NOT NULL)))'});
 value.indexes.push({indexname:COMPANY_SUPERADMIN_INDEX,indexdef:`CREATE UNIQUE INDEX "${COMPANY_SUPERADMIN_INDEX}" ON public."PlatformUser" USING btree ("systemRole") WHERE ("systemRole" = 'SUPERADMIN'::"SystemRole")`,indisvalid:true,indisready:true,indisunique:true});
 assert.equal(checkCompanyContactCatalog(value).state,'ADOPTED');assert.equal(checkCompanyContactCatalog(value).singleSuperadminByRole,true);
 const missing=structuredClone(value);missing.indexes.pop();assert.equal(checkCompanyContactCatalog(missing).state,'REJECTED');
 const fake=structuredClone(value);fake.indexes[2].indexdef=fake.indexes[2].indexdef.replace('CREATE UNIQUE INDEX','CREATE INDEX');assert.equal(checkCompanyContactCatalog(fake).state,'REJECTED');
 for(const property of ['indisvalid','indisready','indisunique']){const broken=structuredClone(value);broken.indexes[2][property]=false;assert.equal(checkCompanyContactCatalog(broken).state,'REJECTED');assert.notEqual(checkCompanyContactCatalog(broken).fingerprint,checkCompanyContactCatalog(value).fingerprint);}
 value.constraints[1].definition='CHECK (true)';assert.equal(checkCompanyContactCatalog(value).state,'REJECTED');
});
