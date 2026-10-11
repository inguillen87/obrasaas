import {digest,WorkspaceError} from './workspace-policy.mjs';

// Additive adoption only. Existing credential IDs, anchors, ciphertext and
// Flow keys/leases are never copied or updated by this schema.
export const COMPANY_CHANNEL_SCHEMA_SQL = `
ALTER TABLE public."Project" ADD CONSTRAINT "company_project_owner_key" UNIQUE(id,"organizationId");
ALTER TABLE public."WhatsAppConnection" ADD CONSTRAINT "company_connection_anchor_key" UNIQUE(id,"projectId");
ALTER TABLE public."TenantMembership" ADD CONSTRAINT "company_membership_principal_key" UNIQUE(id,"organizationId","userId");
ALTER TABLE public."Worker" ADD CONSTRAINT "company_worker_project_key" UNIQUE(id,"projectId");
CREATE UNIQUE INDEX "company_waba_owner_key" ON public."WhatsAppConnection"("whatsappBusinessId") WHERE "whatsappBusinessId" IS NOT NULL;
CREATE TABLE public."WhatsAppCompanyChannel" (
 "connectionId" text PRIMARY KEY,"organizationId" text NOT NULL,"anchorProjectId" text NOT NULL,
 mode text NOT NULL DEFAULT 'PROJECT_ONLY' CHECK(mode IN ('PROJECT_ONLY','PREPARED','COMPANY','SUSPENDED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),"updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT "company_channel_owner_key" UNIQUE("connectionId","organizationId"),
 CONSTRAINT "company_channel_anchor_fk" FOREIGN KEY("connectionId","anchorProjectId") REFERENCES public."WhatsAppConnection"(id,"projectId") ON DELETE RESTRICT,
 CONSTRAINT "company_channel_tenant_fk" FOREIGN KEY("anchorProjectId","organizationId") REFERENCES public."Project"(id,"organizationId") ON DELETE RESTRICT
);
CREATE TABLE public."WhatsAppChannelProjectAssignment" (
 "connectionId" text NOT NULL,"organizationId" text NOT NULL,"projectId" text NOT NULL,
 status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),"updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY("connectionId","projectId"),CONSTRAINT "company_assignment_tenant_key" UNIQUE("connectionId","organizationId","projectId"),
 CONSTRAINT "company_assignment_channel_fk" FOREIGN KEY("connectionId","organizationId") REFERENCES public."WhatsAppCompanyChannel"("connectionId","organizationId") ON DELETE RESTRICT,
 CONSTRAINT "company_assignment_project_fk" FOREIGN KEY("projectId","organizationId") REFERENCES public."Project"(id,"organizationId") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "company_assignment_active_project_key" ON public."WhatsAppChannelProjectAssignment"("projectId") WHERE status='ACTIVE';
CREATE TABLE public."WhatsAppCompanyRoute" (
 id text PRIMARY KEY,"organizationId" text NOT NULL,"connectionId" text NOT NULL,"senderHmac" text NOT NULL CHECK("senderHmac"~'^[a-f0-9]{64}$'),
 "actorId" text NOT NULL,"membershipId" text NOT NULL,epoch integer NOT NULL DEFAULT 1 CHECK(epoch>0),
 "projectId" text,"workerId" text,"assignmentRevision" integer,"bindingId" text,
 "encryptedState" text NOT NULL,"updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT "company_route_sender_key" UNIQUE("organizationId","connectionId","senderHmac"),
 CONSTRAINT "company_route_owner_key" UNIQUE(id,"organizationId","connectionId"),
 CONSTRAINT "company_route_member_fk" FOREIGN KEY("membershipId","organizationId","actorId") REFERENCES public."TenantMembership"(id,"organizationId","userId") ON DELETE RESTRICT,
 CONSTRAINT "company_route_channel_fk" FOREIGN KEY("connectionId","organizationId") REFERENCES public."WhatsAppCompanyChannel"("connectionId","organizationId") ON DELETE RESTRICT,
 CONSTRAINT "company_route_assignment_fk" FOREIGN KEY("connectionId","organizationId","projectId") REFERENCES public."WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId") ON DELETE RESTRICT,
 CONSTRAINT "company_route_worker_fk" FOREIGN KEY("workerId","projectId") REFERENCES public."Worker"(id,"projectId") ON DELETE RESTRICT,
 CONSTRAINT "company_route_pm_fk" FOREIGN KEY("projectId","membershipId") REFERENCES public."ProjectMembership"("projectId","tenantMembershipId") ON DELETE RESTRICT,
 CONSTRAINT "company_route_shape" CHECK (("projectId" IS NULL AND "workerId" IS NULL AND "assignmentRevision" IS NULL AND "bindingId" IS NULL) OR ("projectId" IS NOT NULL AND "workerId" IS NOT NULL AND "assignmentRevision">0 AND "bindingId" IS NOT NULL))
);
CREATE TABLE public."WhatsAppCompanyEventRoute" (
 "sourceEventId" text PRIMARY KEY REFERENCES public."WebhookEvent"(id) ON DELETE RESTRICT,
 "payloadDigest" text NOT NULL CHECK("payloadDigest"~'^[a-f0-9]{64}$'),"organizationId" text NOT NULL,"connectionId" text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('SELECTION','BINDING','FIELD')),"routeId" text,"routeEpoch" integer,
 "actorId" text NOT NULL,"membershipId" text NOT NULL,"projectId" text,"workerId" text,"assignmentRevision" integer,"bindingId" text,
 "encryptedResult" text,"createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT "company_event_member_fk" FOREIGN KEY("membershipId","organizationId","actorId") REFERENCES public."TenantMembership"(id,"organizationId","userId") ON DELETE RESTRICT,
 CONSTRAINT "company_event_channel_fk" FOREIGN KEY("connectionId","organizationId") REFERENCES public."WhatsAppCompanyChannel"("connectionId","organizationId") ON DELETE RESTRICT,
 CONSTRAINT "company_event_route_fk" FOREIGN KEY("routeId","organizationId","connectionId") REFERENCES public."WhatsAppCompanyRoute"(id,"organizationId","connectionId") ON DELETE RESTRICT,
 CONSTRAINT "company_event_assignment_fk" FOREIGN KEY("connectionId","organizationId","projectId") REFERENCES public."WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId") ON DELETE RESTRICT,
 CONSTRAINT "company_event_worker_fk" FOREIGN KEY("workerId","projectId") REFERENCES public."Worker"(id,"projectId") ON DELETE RESTRICT,
 CONSTRAINT "company_event_pm_fk" FOREIGN KEY("projectId","membershipId") REFERENCES public."ProjectMembership"("projectId","tenantMembershipId") ON DELETE RESTRICT,
 CONSTRAINT "company_event_shape" CHECK ((kind='SELECTION' AND "projectId" IS NULL AND "workerId" IS NULL AND "assignmentRevision" IS NULL AND "bindingId" IS NULL) OR (kind IN ('BINDING','FIELD') AND "projectId" IS NOT NULL AND "workerId" IS NOT NULL AND "assignmentRevision">0 AND "bindingId" IS NOT NULL))
);
CREATE FUNCTION public.company_channel_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='WhatsAppCompanyEventRoute' THEN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-'encryptedResult') IS DISTINCT FROM (to_jsonb(OLD)-'encryptedResult') THEN RAISE EXCEPTION 'COMPANY_SOURCE_ROUTE_IMMUTABLE'; END IF;
 ELSIF TG_TABLE_NAME='WhatsAppCompanyChannel' THEN
  IF TG_OP='DELETE' OR NEW."connectionId"<>OLD."connectionId" OR NEW."organizationId"<>OLD."organizationId" OR NEW."anchorProjectId"<>OLD."anchorProjectId" THEN RAISE EXCEPTION 'COMPANY_CHANNEL_ANCHOR_IMMUTABLE'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER "company_event_immutable" BEFORE UPDATE OR DELETE ON public."WhatsAppCompanyEventRoute" FOR EACH ROW EXECUTE FUNCTION public.company_channel_immutable();
CREATE TRIGGER "company_channel_immutable" BEFORE UPDATE OR DELETE ON public."WhatsAppCompanyChannel" FOR EACH ROW EXECUTE FUNCTION public.company_channel_immutable();
INSERT INTO public."WhatsAppCompanyChannel"("connectionId","organizationId","anchorProjectId") SELECT c.id,p."organizationId",c."projectId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId";
INSERT INTO public."WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status) SELECT "connectionId","organizationId","anchorProjectId",'ACTIVE' FROM public."WhatsAppCompanyChannel";
CREATE FUNCTION public.company_channel_seed_legacy() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE owner_id text; BEGIN
 SELECT "organizationId" INTO STRICT owner_id FROM public."Project" WHERE id=NEW."projectId";
 INSERT INTO public."WhatsAppCompanyChannel"("connectionId","organizationId","anchorProjectId") VALUES(NEW.id,owner_id,NEW."projectId");
 INSERT INTO public."WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status) VALUES(NEW.id,owner_id,NEW."projectId",'ACTIVE');
 RETURN NEW;
END $$;
CREATE TRIGGER "company_seed_legacy" AFTER INSERT ON public."WhatsAppConnection" FOR EACH ROW EXECUTE FUNCTION public.company_channel_seed_legacy();
CREATE TABLE public."WhatsAppCompanySchema" (id integer PRIMARY KEY CHECK(id=1),version integer NOT NULL CHECK(version=1),contract text NOT NULL,"catalogFingerprint" text NOT NULL CHECK("catalogFingerprint"~'^[a-f0-9]{64}$'));
`;
export const COMPANY_CHANNEL_SCHEMA_CONTRACT=digest(COMPANY_CHANNEL_SCHEMA_SQL);
const constraints=['company_channel_anchor_fk','company_channel_tenant_fk','company_assignment_channel_fk','company_assignment_project_fk','company_route_member_fk','company_route_assignment_fk','company_route_worker_fk','company_route_pm_fk','company_route_shape','company_event_member_fk','company_event_channel_fk','company_event_route_fk','company_event_assignment_fk','company_event_worker_fk','company_event_pm_fk','company_event_shape'];
export async function companyChannelCatalogFingerprint(client){
 const tables=['WhatsAppCompanyChannel','WhatsAppChannelProjectAssignment','WhatsAppCompanyRoute','WhatsAppCompanyEventRoute'];
 const catalog=(await client.query(`SELECT
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('table_name',table_name,'column_name',column_name,'data_type',data_type,'is_nullable',is_nullable,'column_default',column_default) ORDER BY table_name,ordinal_position),'[]'::json) FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])) AS columns,
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('relname',r.relname,'conname',c.conname,'contype',c.contype,'convalidated',c.convalidated,'definition',pg_get_constraintdef(c.oid)) ORDER BY r.relname,c.conname),'[]'::json) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid WHERE c.connamespace='public'::regnamespace AND (c.conname LIKE 'company_%' OR r.relname=ANY($1::text[]))) AS keys,
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('relname',c.relname,'indisvalid',i.indisvalid,'indisready',i.indisready,'indisunique',i.indisunique,'definition',pg_get_indexdef(c.oid)) ORDER BY c.relname),'[]'::json) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_class r ON r.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace AND (c.relname LIKE 'company_%' OR r.relname=ANY($1::text[]))) AS indexes,
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('relname',r.relname,'tgname',t.tgname,'tgenabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(t.tgfoid)) ORDER BY r.relname,t.tgname),'[]'::json) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid WHERE r.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgname LIKE 'company_%') AS triggers`,[tables])).rows[0];
 return digest({columns:catalog.columns,keys:catalog.keys,indexes:catalog.indexes,triggers:catalog.triggers});
}
export async function companyChannelSchemaReady(client) {
 const shape=(await client.query(`SELECT to_regclass('public."WhatsAppCompanySchema"') IS NOT NULL AS present,
  (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='WhatsAppCompanySchema' AND column_name='catalogFingerprint') AS count`)).rows[0];
 if(!shape?.present||shape.count!==1)return false;
 const marker=(await client.query(`SELECT version,contract,"catalogFingerprint",
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('conname',conname,'convalidated',convalidated) ORDER BY conname),'[]'::json) FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname=ANY($1::text[])) AS catalog,
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('relname',c.relname,'indisvalid',i.indisvalid,'indisready',i.indisready,'indisunique',i.indisunique) ORDER BY c.relname),'[]'::json) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY($2::text[])) AS indexes,
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('tgname',tgname,'tgenabled',tgenabled) ORDER BY tgname),'[]'::json) FROM pg_trigger WHERE tgname=ANY($3::text[]) AND NOT tgisinternal) AS triggers
  FROM public."WhatsAppCompanySchema" WHERE id=1`,[constraints,['company_waba_owner_key','company_assignment_active_project_key'],['company_event_immutable','company_channel_immutable','company_seed_legacy']])).rows[0];
 if(marker?.version!==1||marker.contract!==COMPANY_CHANNEL_SCHEMA_CONTRACT)return false;
 const {catalog,indexes,triggers}=marker;
 return catalog.length===constraints.length&&catalog.every(row=>row.convalidated)&&indexes.length===2&&indexes.every(row=>row.indisvalid&&row.indisready&&row.indisunique)&&triggers.length===3&&triggers.every(row=>row.tgenabled==='O')&&marker.catalogFingerprint===await companyChannelCatalogFingerprint(client);
}
export async function requireCompanyChannelSchema(client) {if(!await companyChannelSchemaReady(client))throw new WorkspaceError('COMPANY_CHANNEL_CATALOG_REQUIRED',409);}
