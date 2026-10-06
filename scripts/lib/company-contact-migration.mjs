import {createHash} from 'node:crypto';

export const COMPANY_CONTACT_TARGET=Object.freeze({projectId:'prj_68NErbCqCFsDVaMak81gcwsGI9pF',teamId:'team_BV1xuY6BnEzGanfok8GAyjZv',origin:'https://obrasaas.com'});
export const COMPANY_CONTACT_GUARD='PlatformUser_superadmin_contact_required_check';
export const COMPANY_SUPERADMIN_INDEX='PlatformUser_single_superadmin_role_key';
export const COMPANY_CONTACT_SQL=`ALTER TABLE public."PlatformUser" ADD CONSTRAINT "${COMPANY_CONTACT_GUARD}" CHECK ("systemRole" <> 'SUPERADMIN' OR "primaryEmail" IS NOT NULL);
CREATE UNIQUE INDEX "${COMPANY_SUPERADMIN_INDEX}" ON public."PlatformUser" ("systemRole") WHERE "systemRole"='SUPERADMIN';
ALTER TABLE public."PlatformUser" ALTER COLUMN "primaryEmail" DROP NOT NULL;`;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const historicalGuard=/^CHECK \(\(\(lower\(TRIM\(BOTH FROM "primaryEmail"\)\) = '(?:[^']|'')+'::text\) = \("systemRole" = 'SUPERADMIN'::"SystemRole"\)\)\)$/;
const requiredGuard='CHECK ((("systemRole" <> \'SUPERADMIN\'::"SystemRole") OR ("primaryEmail" IS NOT NULL)))';
const requiredIndex=`CREATE UNIQUE INDEX "${COMPANY_SUPERADMIN_INDEX}" ON public."PlatformUser" USING btree ("systemRole") WHERE ("systemRole" = 'SUPERADMIN'::"SystemRole")`;

export function companyContactArguments(args){
 const result={mode:'DRY_RUN'},seen=new Set(),fields={'--expected-project':'expectedProject','--expected-team':'expectedTeam','--expected-fingerprint':'expectedFingerprint'};
 for(let i=0;i<args.length;i++){
  const key=args[i];if(seen.has(key)||!['--dry-run','--apply',...Object.keys(fields)].includes(key))fail('COMPANY_CONTACT_ARGUMENTS_INVALID');seen.add(key);
  if(key==='--dry-run'||key==='--apply')result.mode=key==='--apply'?'APPLY':'DRY_RUN';
  else{if(!args[i+1]||args[i+1].startsWith('--'))fail('COMPANY_CONTACT_ARGUMENTS_INVALID');result[fields[key]]=args[++i];}
 }
 if(seen.has('--apply')&&seen.has('--dry-run')||!result.expectedProject||!result.expectedTeam||result.expectedFingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(result.expectedFingerprint)||result.mode==='APPLY'&&!result.expectedFingerprint)fail('COMPANY_CONTACT_ARGUMENTS_INVALID');
 return result;
}
export function companyContactProductionContext(environment,project,command){
 const {projectId,teamId,origin}=COMPANY_CONTACT_TARGET;
 if(command.expectedProject!==projectId||command.expectedTeam!==teamId||project?.projectId!==projectId||project?.orgId!==teamId||environment.VERCEL_ENV!=='production'||environment.VERCEL_PROJECT_ID!==projectId||environment.NEXT_PUBLIC_APP_URL!==origin||environment.VERCEL_ORG_ID!==undefined&&environment.VERCEL_ORG_ID!==teamId)fail('COMPANY_CONTACT_TARGET_REJECTED');
 return {projectVerified:true,environment:'production'};
}
export async function readCompanyContactCatalog(client){
 const relation=(await client.query(`SELECT c.relkind,pg_has_role(current_user,c.relowner,'USAGE') AS "canAlter" FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='PlatformUser'`)).rows[0];
 const columns=(await client.query(`SELECT column_name,data_type,udt_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='PlatformUser' ORDER BY ordinal_position`)).rows;
 const indexes=(await client.query(`SELECT ic.relname AS indexname,pg_get_indexdef(i.indexrelid) AS indexdef,i.indisvalid,i.indisready,i.indisunique FROM pg_index i JOIN pg_class tc ON tc.oid=i.indrelid JOIN pg_namespace n ON n.oid=tc.relnamespace JOIN pg_class ic ON ic.oid=i.indexrelid WHERE n.nspname='public' AND tc.relname='PlatformUser' ORDER BY ic.relname`)).rows;
 const constraints=(await client.query(`SELECT conname,contype,convalidated,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public."PlatformUser"'::regclass ORDER BY conname`)).rows;
 const triggers=(await client.query(`SELECT tgname,pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='public."PlatformUser"'::regclass AND NOT tgisinternal ORDER BY tgname`)).rows;
 return {relation,columns,indexes,constraints,triggers};
}
export function checkCompanyContactCatalog(catalog){
 const columns=catalog.columns||[],constraints=catalog.constraints||[],indexes=catalog.indexes||[];
 const email=columns.find(row=>row.column_name==='primaryEmail'),subject=columns.find(row=>row.column_name==='clerkUserId'),role=columns.find(row=>row.column_name==='systemRole');
 const prior=constraints.find(row=>row.conname==='PlatformUser_single_superadmin_email_check'),guard=constraints.find(row=>row.conname===COMPANY_CONTACT_GUARD),rootIndex=indexes.find(row=>row.indexname===COMPANY_SUPERADMIN_INDEX);
 const activeUnique=row=>row?.indisvalid===true&&row.indisready===true&&row.indisunique===true;
 const unique=(name,column)=>indexes.some(row=>row.indexname===name&&activeUnique(row)&&row.indexdef===`CREATE UNIQUE INDEX "${name}" ON public."PlatformUser" USING btree ("${column}")`);
 const singleSuperadminByRole=activeUnique(rootIndex)&&rootIndex.indexdef===requiredIndex;
 const preserved=catalog.relation?.relkind==='r'&&email?.data_type==='text'&&email.column_default===null&&subject?.data_type==='text'&&subject.is_nullable==='NO'&&role?.udt_name==='SystemRole'&&role.is_nullable==='NO'&&
  prior?.contype==='c'&&prior.convalidated===true&&historicalGuard.test(prior.definition)&&unique('PlatformUser_primaryEmail_key','primaryEmail')&&unique('PlatformUser_clerkUserId_key','clerkUserId')&&(catalog.triggers||[]).length===0;
 const state=preserved&&email.is_nullable==='NO'&&!guard&&!rootIndex?'LEGACY':preserved&&email.is_nullable==='YES'&&guard?.contype==='c'&&guard.convalidated===true&&guard.definition===requiredGuard&&singleSuperadminByRole?'ADOPTED':'REJECTED';
 // Constraint text contains the protected historical contact. The public
 // manifest exposes only its name, invariants and an opaque catalogue digest.
 return {compatible:state!=='REJECTED',state,fingerprint:fingerprint({columns,indexes,constraints,triggers:catalog.triggers}),contactNullable:email?.is_nullable==='YES',subjectRequired:subject?.is_nullable==='NO',historicalSuperadminCheckPreserved:preserved,uniqueContactPreserved:unique('PlatformUser_primaryEmail_key','primaryEmail'),uniqueSubjectPreserved:unique('PlatformUser_clerkUserId_key','clerkUserId'),singleSuperadminByRole,constraintNames:constraints.map(row=>row.conname),indexNames:indexes.map(row=>row.indexname)};
}
async function contactAggregateCounts(client){
 const counts=(await client.query(`SELECT count(*)::int AS "platformActors",(count(*) FILTER (WHERE "systemRole"='SUPERADMIN'))::int AS superadmins FROM public."PlatformUser"`)).rows[0];
 if(!Number.isSafeInteger(counts?.platformActors)||!Number.isSafeInteger(counts?.superadmins)||counts.superadmins>1)fail('COMPANY_CONTACT_SUPERADMINS_AMBIGUOUS');return counts;
}
export async function executeCompanyContactAdoption(client,{mode='DRY_RUN',expectedFingerprint}={}){
 if(!['DRY_RUN','APPLY'].includes(mode)||expectedFingerprint!==undefined&&!/^[a-f0-9]{64}$/.test(expectedFingerprint)||mode==='APPLY'&&!expectedFingerprint)fail('COMPANY_CONTACT_COMMAND_INVALID');
 let transaction=false;
 try{
  await client.query(mode==='DRY_RUN'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL READ COMMITTED');transaction=true;
  await client.query("SET LOCAL statement_timeout='15000ms'");await client.query("SET LOCAL lock_timeout='1500ms'");await client.query("SET LOCAL idle_in_transaction_session_timeout='30000ms'");
  if(mode==='DRY_RUN'&&(await client.query("SELECT current_setting('transaction_read_only') AS readonly")).rows[0]?.readonly!=='on')fail('COMPANY_CONTACT_READ_ONLY_REQUIRED');
  let catalog=await readCompanyContactCatalog(client),before=checkCompanyContactCatalog(catalog);
  if(!before.compatible)fail('COMPANY_CONTACT_SCHEMA_REJECTED');
  const aggregateCountsBefore=await contactAggregateCounts(client);
  const matching=expectedFingerprint===undefined||expectedFingerprint===before.fingerprint,canApply=catalog.relation.canAlter===true;
  if(before.state==='LEGACY'&&!matching)fail('COMPANY_CONTACT_FINGERPRINT_CHANGED');
  let after=before,applied=false,aggregateCountsAfter=aggregateCountsBefore;
  if(mode==='APPLY'&&before.state==='LEGACY'){
   if(!canApply)fail('COMPANY_CONTACT_PERMISSION_REQUIRED');
   await client.query('LOCK TABLE public."PlatformUser" IN ACCESS EXCLUSIVE MODE');
   catalog=await readCompanyContactCatalog(client);const locked=checkCompanyContactCatalog(catalog);
   if(!locked.compatible||locked.state!=='LEGACY'||locked.fingerprint!==before.fingerprint)fail('COMPANY_CONTACT_FINGERPRINT_CHANGED');
   aggregateCountsAfter=await contactAggregateCounts(client);
   await client.query(COMPANY_CONTACT_SQL);after=checkCompanyContactCatalog(await readCompanyContactCatalog(client));
   if(!after.compatible||after.state!=='ADOPTED')fail('COMPANY_CONTACT_POSTCHECK_FAILED');applied=true;
  }
  const manifest={version:1,at:new Date().toISOString(),status:applied?'APPLIED':before.state==='ADOPTED'?'ALREADY_ADOPTED':'DRY_RUN_READY',mode,readOnly:mode==='DRY_RUN',ddlExecuted:applied,canApply,expectedFingerprintMatched:matching,before,after,
   forwardSql:COMPANY_CONTACT_SQL,rollback:{requiresZeroNullContacts:true,requiresTransaction:true,automatic:false,sql:`ALTER TABLE public."PlatformUser" ALTER COLUMN "primaryEmail" SET NOT NULL;\nALTER TABLE public."PlatformUser" DROP CONSTRAINT "${COMPANY_CONTACT_GUARD}";\nDROP INDEX public."${COMPANY_SUPERADMIN_INDEX}";`,blockedWhen:'A canonical actor has a NULL contact. Preserve it and its access; never delete or invent contacts to force rollback.'},
   aggregateBusinessCountsRead:true,aggregateCountsBefore,aggregateCountsAfter,rawBusinessRecordsReturned:false,businessDataWritten:false,clerkIdsRebound:false,contactsOverwritten:false,rolesTransferred:false,membershipsTransferred:false,credentialsPrinted:false};
  await client.query(mode==='DRY_RUN'?'ROLLBACK':'COMMIT');transaction=false;return manifest;
 }catch(error){if(transaction)await client.query('ROLLBACK');throw error;}
}
