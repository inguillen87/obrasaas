import {digest} from '../../src/lib/workspace-policy.mjs';
import {requireCompanyChannelSchema} from '../../src/lib/company-channel-schema.mjs';
import {COMPANY_NUMBER_TRANSFER_SQL,COMPANY_NUMBER_TRANSFER_CONTRACT,transferCatalogFingerprint,requireTransferSchema} from '../../src/lib/company-number-transfer-schema.mjs';
// A caller must supply a reviewed, owned connection. This module opens no DB,
// reads no credentials and never adopts implicitly in an HTTP request.
export async function executeCompanyNumberTransferAdoption(client,{mode='DRY_RUN',expectedFingerprint=null}={}){
 if(!['DRY_RUN','APPLY'].includes(mode)||mode==='APPLY'&&!/^[a-f0-9]{64}$/.test(expectedFingerprint||''))throw new Error('COMPANY_TRANSFER_ADOPTION_INPUT_INVALID');
 await client.query(mode==='DRY_RUN'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL SERIALIZABLE');
 try{
  await requireCompanyChannelSchema(client);
  if(mode==='APPLY')await client.query('LOCK TABLE public."WhatsAppConnection",public."WhatsAppCompanyChannel" IN SHARE ROW EXCLUSIVE MODE');
  const state=(await client.query(`SELECT to_regclass('public."WhatsAppAssetTransferSchema"') IS NOT NULL AS installed,(SELECT count(*)::int FROM public."WhatsAppConnection" WHERE "phoneNumberId" IS NULL) AS nulls,(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',c.relname,'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,'definition',pg_get_indexdef(i.indexrelid)) ORDER BY c.relname),'[]'::jsonb) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public."WhatsAppConnection"'::regclass) AS indexes,(SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='WhatsAppConnection' AND column_name='phoneNumberId') AS nullable`)).rows[0];
  if(state.installed||state.nulls!==0||state.nullable!=='NO')throw new Error('COMPANY_TRANSFER_ADOPTION_CONTEXT_CHANGED');
  const fingerprint=digest({contract:COMPANY_NUMBER_TRANSFER_CONTRACT,state});
  if(mode==='DRY_RUN'){await client.query('ROLLBACK');return {mode,readOnly:true,fingerprint,status:'REVIEW_REQUIRED'};}
  if(fingerprint!==expectedFingerprint)throw new Error('COMPANY_TRANSFER_ADOPTION_CONTEXT_CHANGED');
  await client.query(COMPANY_NUMBER_TRANSFER_SQL);
  const catalogFingerprint=await transferCatalogFingerprint(client);
  await client.query(`INSERT INTO public."WhatsAppAssetTransferSchema"(id,version,contract,"catalogFingerprint") VALUES(1,1,$1,$2)`,[COMPANY_NUMBER_TRANSFER_CONTRACT,catalogFingerprint]);
  await requireTransferSchema(client);await client.query('COMMIT');return {mode,readOnly:false,fingerprint,catalogFingerprint,status:'APPLIED'};
 }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}
}

// Before first use only. A used migration is a retained compatibility floor:
// disabling its release flag never removes history or callback/send fences.
export async function rollbackUnusedCompanyNumberTransferAdoption(client,{expectedCatalogFingerprint}={}){
 if(!/^[a-f0-9]{64}$/.test(expectedCatalogFingerprint||''))throw new Error('COMPANY_TRANSFER_ADOPTION_INPUT_INVALID');
 await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
 try{
  await requireTransferSchema(client);await client.query('LOCK TABLE public."WhatsAppConnection",public."WhatsAppAssetTransfer",public."WhatsAppAssetRetirement",public."WhatsAppActiveAsset",public."WhatsAppAssetQuarantine" IN ACCESS EXCLUSIVE MODE');
  if(await transferCatalogFingerprint(client)!==expectedCatalogFingerprint)throw new Error('COMPANY_TRANSFER_ADOPTION_CONTEXT_CHANGED');
  const used=(await client.query(`SELECT EXISTS(SELECT 1 FROM public."WhatsAppAssetTransfer") OR EXISTS(SELECT 1 FROM public."WhatsAppAssetRetirement") OR EXISTS(SELECT 1 FROM public."WhatsAppActiveAsset") OR EXISTS(SELECT 1 FROM public."WhatsAppAssetQuarantine") AS used`)).rows[0]?.used;
  if(used)throw new Error('COMPANY_TRANSFER_HISTORY_REQUIRES_COMPATIBILITY_FLOOR');
  await client.query(`ALTER TABLE public."WhatsAppConnection" ALTER COLUMN "phoneNumberId" SET NOT NULL;DROP TRIGGER asset_webhook_owner_guard ON public."WebhookEvent";DROP TRIGGER asset_connection_guard ON public."WhatsAppConnection";DROP TABLE public."WhatsAppActiveAsset",public."WhatsAppAssetRetirement",public."WhatsAppAssetTransfer",public."WhatsAppAssetQuarantine",public."WhatsAppAssetTransferSchema";DROP FUNCTION public.asset_webhook_owner_guard(),public.asset_connection_guard(),public.asset_active_owner_guard(),public.asset_retirement_authorized(),public.asset_history_immutable(),public.asset_transfer_intent_guard();`);
  await client.query('COMMIT');return {status:'ROLLED_BACK_UNUSED_ONLY',historyRemoved:false};
 }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}
}
