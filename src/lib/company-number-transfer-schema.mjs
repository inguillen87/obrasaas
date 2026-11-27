import {digest,WorkspaceError} from './workspace-policy.mjs';
// Reviewed, explicit schema adoption only. Importing this module never migrates.
// Existing phone/WABA UNIQUE keys and company anchor immutability remain intact.
export const COMPANY_NUMBER_TRANSFER_SQL=`
CREATE TABLE public."WhatsAppAssetTransfer"(
 id text PRIMARY KEY,"destinationOrganizationId" text NOT NULL,"destinationProjectId" text NOT NULL,
 "sourceOrganizationId" text NOT NULL,"sourceProjectId" text NOT NULL,"sourceConnectionId" text NOT NULL,
 "actorId" text NOT NULL,"requestDigest" text NOT NULL CHECK("requestDigest"~'^[a-f0-9]{64}$'),
 plan jsonb NOT NULL,state text NOT NULL CHECK(state IN ('PREPARED','EXCHANGING','EXCHANGE_UNKNOWN','GRANT_READY','COMMITTING','COMMITTED','CLOSED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),"expiresAt" timestamptz NOT NULL,
 "encryptedGrant" text,"grantDigest" text,"grantVerifiedAt" timestamptz,"destinationConnectionId" text,
 "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),"committedAt" timestamptz,"authorizationDigest" text,"commitDigest" text,"closeDigest" text,
 FOREIGN KEY("destinationProjectId","destinationOrganizationId") REFERENCES public."Project"(id,"organizationId") ON DELETE RESTRICT,
 FOREIGN KEY("sourceProjectId","sourceOrganizationId") REFERENCES public."Project"(id,"organizationId") ON DELETE RESTRICT,
 FOREIGN KEY("sourceConnectionId","sourceProjectId") REFERENCES public."WhatsAppConnection"(id,"projectId") ON DELETE RESTRICT,
 CHECK("sourceOrganizationId"<>"destinationOrganizationId")
);
CREATE UNIQUE INDEX asset_transfer_active_source ON public."WhatsAppAssetTransfer"("sourceConnectionId") WHERE state NOT IN ('COMMITTED','CLOSED');
CREATE UNIQUE INDEX asset_transfer_active_destination ON public."WhatsAppAssetTransfer"("destinationProjectId") WHERE state NOT IN ('COMMITTED','CLOSED');
CREATE FUNCTION public.asset_transfer_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ASSET_TRANSFER_RECEIPT_IMMUTABLE'; END IF;
 IF TG_OP='INSERT' THEN IF NEW.state<>'PREPARED' OR NEW.revision<>1 OR NEW."encryptedGrant" IS NOT NULL OR NEW."destinationConnectionId" IS NOT NULL OR NEW."committedAt" IS NOT NULL THEN RAISE EXCEPTION 'ASSET_TRANSFER_STATE_REJECTED'; END IF; RETURN NEW; END IF;
 IF (to_jsonb(NEW)-ARRAY['state','revision','encryptedGrant','grantDigest','grantVerifiedAt','destinationConnectionId','committedAt','authorizationDigest','commitDigest','closeDigest']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','revision','encryptedGrant','grantDigest','grantVerifiedAt','destinationConnectionId','committedAt','authorizationDigest','commitDigest','closeDigest']) OR OLD.state IN ('COMMITTED','CLOSED') THEN RAISE EXCEPTION 'ASSET_TRANSFER_RECEIPT_IMMUTABLE'; END IF;
 IF NOT COALESCE((OLD.state='PREPARED' AND NEW.state='EXCHANGING' AND NEW."authorizationDigest" IS NOT NULL AND NEW.revision=OLD.revision+1 OR OLD.state='EXCHANGING' AND NEW.state='EXCHANGE_UNKNOWN' AND NEW.revision=OLD.revision+1 OR OLD.state='EXCHANGING' AND NEW.state='GRANT_READY' AND NEW."encryptedGrant" LIKE 'v2.%' AND NEW."grantDigest"~'^[a-f0-9]{64}$' AND NEW."grantVerifiedAt" IS NOT NULL AND NEW.revision=OLD.revision+1 OR OLD.state IN ('PREPARED','EXCHANGING','EXCHANGE_UNKNOWN','GRANT_READY') AND NEW.state='CLOSED' AND NEW."closeDigest" IS NOT NULL AND NEW.revision=OLD.revision+1 OR OLD.state='GRANT_READY' AND NEW.state='COMMITTING' AND NEW."destinationConnectionId" IS NOT NULL AND NEW."commitDigest" IS NOT NULL AND NEW.revision=OLD.revision OR OLD.state='COMMITTING' AND NEW.state='COMMITTED' AND NEW."committedAt" IS NOT NULL AND NEW.revision=OLD.revision+1),false) THEN RAISE EXCEPTION 'ASSET_TRANSFER_STATE_REJECTED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_transfer_intent_guard BEFORE INSERT OR UPDATE OR DELETE ON public."WhatsAppAssetTransfer" FOR EACH ROW EXECUTE FUNCTION public.asset_transfer_intent_guard();
CREATE TABLE public."WhatsAppAssetRetirement"(
 "sourceConnectionId" text PRIMARY KEY REFERENCES public."WhatsAppConnection"(id) ON DELETE RESTRICT,
 "transferId" text NOT NULL UNIQUE REFERENCES public."WhatsAppAssetTransfer"(id) ON DELETE RESTRICT,
 "wabaId" text NOT NULL,"phoneNumberId" text NOT NULL,"generation" integer NOT NULL CHECK(generation>0),
 "sourceOrganizationId" text NOT NULL,"sourceProjectId" text NOT NULL,"destinationConnectionId" text NOT NULL,
 "sourceSnapshot" jsonb NOT NULL,"retiredMetadata" jsonb NOT NULL,"retiredAt" timestamptz NOT NULL,
 FOREIGN KEY("sourceProjectId","sourceOrganizationId") REFERENCES public."Project"(id,"organizationId") ON DELETE RESTRICT,
 UNIQUE("wabaId",generation)
);
CREATE TABLE public."WhatsAppActiveAsset"(
 "wabaId" text PRIMARY KEY,"phoneNumberId" text NOT NULL UNIQUE,"connectionId" text NOT NULL UNIQUE REFERENCES public."WhatsAppConnection"(id) ON DELETE RESTRICT,
 "organizationId" text NOT NULL,"projectId" text NOT NULL,generation integer NOT NULL CHECK(generation>0),"transferId" text NOT NULL UNIQUE REFERENCES public."WhatsAppAssetTransfer"(id) ON DELETE RESTRICT,
 FOREIGN KEY("projectId","organizationId") REFERENCES public."Project"(id,"organizationId") ON DELETE RESTRICT
);
CREATE TABLE public."WhatsAppAssetQuarantine"(
 id text PRIMARY KEY,"payloadDigest" text NOT NULL,"wabaId" text NOT NULL,"phoneNumberId" text,"encryptedPayload" text NOT NULL,
 reason text NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION public.asset_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'ASSET_HISTORY_IMMUTABLE'; END $$;
CREATE TRIGGER asset_retirement_immutable BEFORE UPDATE OR DELETE ON public."WhatsAppAssetRetirement" FOR EACH ROW EXECUTE FUNCTION public.asset_history_immutable();
CREATE FUNCTION public.asset_retirement_authorized() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE t public."WhatsAppAssetTransfer"; c jsonb; BEGIN
 SELECT * INTO STRICT t FROM public."WhatsAppAssetTransfer" WHERE id=NEW."transferId" FOR UPDATE;
 SELECT to_jsonb(x) INTO STRICT c FROM public."WhatsAppConnection" x WHERE id=NEW."sourceConnectionId" FOR UPDATE;
 IF t.state<>'COMMITTING' OR t."sourceConnectionId"<>NEW."sourceConnectionId" OR t."sourceOrganizationId"<>NEW."sourceOrganizationId" OR t."sourceProjectId"<>NEW."sourceProjectId" OR t."destinationConnectionId" IS DISTINCT FROM NEW."destinationConnectionId" OR t."encryptedGrant" IS NULL OR t."grantDigest" IS NULL OR t."grantVerifiedAt" IS NULL OR t."grantVerifiedAt"<clock_timestamp()-interval '60 seconds' OR t."expiresAt"<=clock_timestamp() OR NEW."sourceSnapshot" IS DISTINCT FROM (c-ARRAY['encryptedAccessToken','encryptedPin']) OR c->>'phoneNumberId' IS DISTINCT FROM NEW."phoneNumberId" OR c->>'whatsappBusinessId' IS DISTINCT FROM NEW."wabaId" OR NEW."retiredMetadata"->'assetRetirement'->>'transferId' IS DISTINCT FROM t.id OR NEW."retiredMetadata"->'assetRetirement'->>'state' IS DISTINCT FROM 'RETIRED' THEN RAISE EXCEPTION 'ASSET_RETIREMENT_PROOF_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_retirement_authorized BEFORE INSERT ON public."WhatsAppAssetRetirement" FOR EACH ROW EXECUTE FUNCTION public.asset_retirement_authorized();
CREATE FUNCTION public.asset_connection_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE h public."WhatsAppAssetRetirement"; BEGIN
 IF TG_OP='INSERT' THEN IF NEW."phoneNumberId" IS NULL THEN RAISE EXCEPTION 'ASSET_NEW_OWNER_REQUIRED'; END IF; RETURN NEW; END IF;
 SELECT * INTO h FROM public."WhatsAppAssetRetirement" WHERE "sourceConnectionId"=OLD.id;
 IF h."sourceConnectionId" IS NOT NULL THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ASSET_RETIRED_OWNER_IMMUTABLE'; END IF;
  IF OLD."phoneNumberId" IS NULL THEN IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'ASSET_RETIRED_OWNER_IMMUTABLE'; END IF;
  ELSIF NEW."phoneNumberId" IS NOT NULL OR NEW."whatsappBusinessId" IS NOT NULL OR NEW.enabled IS DISTINCT FROM false OR NEW."projectId"<>OLD."projectId" OR NEW."encryptedAccessToken" IS DISTINCT FROM OLD."encryptedAccessToken" OR NEW.metadata IS DISTINCT FROM h."retiredMetadata" OR (to_jsonb(NEW)-ARRAY['phoneNumberId','whatsappBusinessId','enabled','metadata','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['phoneNumberId','whatsappBusinessId','enabled','metadata','updatedAt']) THEN RAISE EXCEPTION 'ASSET_RETIREMENT_PROOF_REQUIRED'; END IF;
 ELSIF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public."WhatsAppActiveAsset" WHERE "connectionId"=OLD.id) AND (NEW."phoneNumberId" IS DISTINCT FROM OLD."phoneNumberId" OR NEW."whatsappBusinessId" IS DISTINCT FROM OLD."whatsappBusinessId") THEN RAISE EXCEPTION 'ASSET_ACTIVE_CHANGE_REQUIRES_TRANSFER';
 ELSIF TG_OP='UPDATE' AND NEW."phoneNumberId" IS NULL THEN RAISE EXCEPTION 'ASSET_RETIREMENT_PROOF_REQUIRED';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER asset_connection_guard BEFORE INSERT OR UPDATE OR DELETE ON public."WhatsAppConnection" FOR EACH ROW EXECUTE FUNCTION public.asset_connection_guard();
-- Null means a proved retirement, never a fake substitute phone ID. Historical
-- assets remain immutable in WhatsAppAssetRetirement; active UNIQUE keys stay.
ALTER TABLE public."WhatsAppConnection" ALTER COLUMN "phoneNumberId" DROP NOT NULL;
CREATE FUNCTION public.asset_active_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE h public."WhatsAppAssetRetirement"; t public."WhatsAppAssetTransfer"; c record; BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'ASSET_ACTIVE_OWNER_IMMUTABLE'; END IF;
 SELECT * INTO STRICT t FROM public."WhatsAppAssetTransfer" WHERE id=NEW."transferId" FOR UPDATE;
 SELECT * INTO STRICT h FROM public."WhatsAppAssetRetirement" WHERE "transferId"=NEW."transferId";
 SELECT x.id,x."phoneNumberId",x."whatsappBusinessId",x."projectId",p."organizationId" INTO STRICT c FROM public."WhatsAppConnection" x JOIN public."Project" p ON p.id=x."projectId" WHERE x.id=NEW."connectionId";
 IF t.state<>'COMMITTING' OR t."destinationOrganizationId"<>NEW."organizationId" OR t."destinationProjectId"<>NEW."projectId" OR h."destinationConnectionId"<>NEW."connectionId" OR h."generation"<>NEW.generation OR c."phoneNumberId" IS DISTINCT FROM NEW."phoneNumberId" OR c."whatsappBusinessId" IS DISTINCT FROM NEW."wabaId" OR c."projectId" IS DISTINCT FROM NEW."projectId" OR c."organizationId" IS DISTINCT FROM NEW."organizationId" OR TG_OP='UPDATE' AND (OLD."connectionId"<>h."sourceConnectionId" OR NEW.generation<>OLD.generation+1 OR OLD."wabaId"<>NEW."wabaId" OR OLD."phoneNumberId"<>NEW."phoneNumberId") OR TG_OP='INSERT' AND NEW.generation<>1 THEN RAISE EXCEPTION 'ASSET_ACTIVE_OWNER_PROOF_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_active_owner_guard BEFORE INSERT OR UPDATE OR DELETE ON public."WhatsAppActiveAsset" FOR EACH ROW EXECUTE FUNCTION public.asset_active_owner_guard();
CREATE FUNCTION public.asset_webhook_owner_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE a public."WhatsAppActiveAsset"; h public."WhatsAppAssetRetirement"; BEGIN
 IF NEW.provider NOT IN ('meta-customer-v1','meta-customer-outbound-v1') THEN RETURN NEW; END IF;
 SELECT * INTO h FROM public."WhatsAppAssetRetirement" WHERE "sourceConnectionId"=NEW.payload->>'channelId';
 IF h."sourceConnectionId" IS NOT NULL THEN
  IF TG_OP='UPDATE' THEN IF NEW.payload IS DISTINCT FROM OLD.payload OR NEW."projectId" IS DISTINCT FROM OLD."projectId" OR NEW.provider<>OLD.provider THEN RAISE EXCEPTION 'ASSET_HISTORICAL_SOURCE_IMMUTABLE'; END IF; RETURN NEW; END IF;
  IF NEW.provider<>'meta-customer-v1' OR NEW."projectId" IS DISTINCT FROM h."sourceProjectId" OR NEW.payload->>'organizationId' IS DISTINCT FROM h."sourceOrganizationId" OR NEW.payload->'retiredObservation'->>'transferId' IS DISTINCT FROM h."transferId" OR NEW.payload->'retiredObservation'->>'generation' IS DISTINCT FROM h.generation::text THEN RAISE EXCEPTION 'ASSET_RETIRED_DISPATCH_REJECTED'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO a FROM public."WhatsAppActiveAsset" WHERE "connectionId"=NEW.payload->>'channelId';
 IF a."connectionId" IS NOT NULL AND (NEW."projectId" IS DISTINCT FROM a."projectId" OR NEW.payload->>'organizationId' IS DISTINCT FROM a."organizationId" OR NEW.payload->'assetOwnership'->>'transferId' IS DISTINCT FROM a."transferId" OR NEW.payload->'assetOwnership'->>'generation' IS DISTINCT FROM a.generation::text) THEN RAISE EXCEPTION 'ASSET_ROUTER_VERSION_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_webhook_owner_guard BEFORE INSERT OR UPDATE ON public."WebhookEvent" FOR EACH ROW EXECUTE FUNCTION public.asset_webhook_owner_guard();
CREATE TABLE public."WhatsAppAssetTransferSchema"(id integer PRIMARY KEY CHECK(id=1),version integer NOT NULL CHECK(version=1),contract text NOT NULL,"catalogFingerprint" text NOT NULL);
`;
export const COMPANY_NUMBER_TRANSFER_CONTRACT=digest(COMPANY_NUMBER_TRANSFER_SQL);
export async function transferSchemaReady(client){
 const present=(await client.query(`SELECT to_regclass('public."WhatsAppAssetTransferSchema"') IS NOT NULL AS ready`)).rows[0]?.ready;if(!present)return false;
 const marker=(await client.query(`SELECT version,contract,"catalogFingerprint" FROM public."WhatsAppAssetTransferSchema" WHERE id=1`)).rows[0];
 const keys=(await client.query(`SELECT count(*)::int AS n FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND r.relname='WhatsAppConnection' AND i.indisunique AND i.indisvalid AND i.indisready AND (pg_get_indexdef(i.indexrelid) LIKE '%("phoneNumberId")%' OR pg_get_indexdef(i.indexrelid) LIKE '%("whatsappBusinessId")%')`)).rows[0]?.n;
 const triggers=(await client.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname=ANY($1::text[]) AND tgenabled='O' AND NOT tgisinternal`,[['asset_retirement_immutable','asset_retirement_authorized','asset_connection_guard','asset_active_owner_guard','asset_webhook_owner_guard','asset_transfer_intent_guard','company_channel_immutable']])).rows[0]?.n;
 return marker?.version===1&&marker.contract===COMPANY_NUMBER_TRANSFER_CONTRACT&&keys===2&&triggers===7&&marker.catalogFingerprint===await transferCatalogFingerprint(client);
}
export async function requireTransferSchema(client){if(!await transferSchemaReady(client))throw new WorkspaceError('COMPANY_TRANSFER_SCHEMA_REQUIRED',409);}

export async function transferCatalogFingerprint(client){
 const catalog=(await client.query(`SELECT
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable,'default',column_default) ORDER BY table_name,ordinal_position),'[]'::jsonb) FROM information_schema.columns WHERE table_schema='public' AND (table_name=ANY($1::text[]) OR table_name='WhatsAppConnection' AND column_name='phoneNumberId')) AS columns,
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('table',r.relname,'name',c.conname,'valid',c.convalidated,'definition',pg_get_constraintdef(c.oid)) ORDER BY r.relname,c.conname),'[]'::jsonb) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid WHERE c.connamespace='public'::regnamespace AND r.relname=ANY($1::text[])) AS constraints,
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('name',r.relname,'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,'definition',pg_get_indexdef(i.indexrelid)) ORDER BY r.relname),'[]'::jsonb) FROM pg_index i JOIN pg_class r ON r.oid=i.indexrelid JOIN pg_class t ON t.oid=i.indrelid WHERE r.relnamespace='public'::regnamespace AND t.relname=ANY($1::text[])) AS indexes,
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) ORDER BY t.tgname),'[]'::jsonb) FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgname LIKE 'asset_%') AS triggers`,[['WhatsAppAssetTransfer','WhatsAppAssetRetirement','WhatsAppActiveAsset','WhatsAppAssetQuarantine','WhatsAppAssetTransferSchema']])).rows[0];
 return digest(catalog);
}
