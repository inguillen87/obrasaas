import {digest, WorkspaceError} from './workspace-policy.mjs';
import {createPlanImport} from './plan-import-store.mjs';
import {decodePlanSource} from './plan-import-policy.mjs';
import {META_CUSTOMER_PROTOCOL} from './meta-cloud-protocol.mjs';
import {decryptCustomerSecret} from './meta-customer-credentials.mjs';
import {lockOwnCompanyIssuer} from './meta-own-company-policy.mjs';
import {metaPlanImportContextDigest, requireMetaPlanImportOrigin, requireMetaPlanImportRole} from './meta-plan-import-origin.mjs';

const preparedId = eventId => 'meta_field_plan_' + digest(eventId);
const identity = r => digest([metaPlanImportContextDigest(r), r.connection.encryptedAccessToken,
  r.connection.metadata?.ownCompany || null, r.connection.metadata?.ownCompanyRuntime || null,
  r.event.id, r.event.payload.payloadDigest]);
const text = body => ({type: 'text', body});
const sourceErrors = new Set(['META_CUSTOMER_MEDIA_INVALID', 'META_CUSTOMER_MEDIA_REJECTED',
  'META_CUSTOMER_MEDIA_INTEGRITY', 'META_PLAN_IMPORT_SOURCE_INTEGRITY', 'PLAN_IMPORT_FILE_INVALID', 'PLAN_IMPORT_FILE_TOO_LARGE']);

// A narrow transport composition of the existing import engine. There is no
// chat decision method and no synthetic Clerk session or office role upgrade.
export function createMetaPlanImportTransport({within, resolve, saved, record, result,
  seal, unseal, writePending, commitFence, operationIdFor, environment,
  protocol, provider, put, get, analyzer}) {
  const configured = protocol === META_CUSTOMER_PROTOCOL && typeof provider?.downloadPlanSource === 'function' &&
    typeof put === 'function' && typeof get === 'function' && typeof analyzer?.analyze === 'function';
  async function renew(client, r) {
    const updated = await client.query(`UPDATE public."WebhookEvent"
      SET "leaseExpiresAt"=clock_timestamp()+interval '180 seconds'
      WHERE id=$1 AND status='PENDING' AND "leaseToken"=$2 AND "leaseExpiresAt">clock_timestamp()`,
    [r.event.id, r.event.leaseToken]);
    if (updated.rowCount !== 1) throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED', 409);
  }
  function checkPrepared(r, prepared) {
    if (identity(r) !== prepared.identityDigest || prepared.projectId !== r.project.id ||
        prepared.scope !== r.scope || prepared.workerId !== r.worker.id) {
      throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED', 409);
    }
    requireMetaPlanImportRole(r, prepared.command.consent);
  }
  async function prepare(client, r, command, state, existing = null) {
    if (!configured) throw new WorkspaceError('META_PLAN_IMPORT_NOT_CONFIGURED', 503);
    await requireMetaPlanImportOrigin(client, r, command, state, environment, {reservationReadOnly: Boolean(existing)});
    const key = preparedId(r.event.id), input = {command, state};
    const inputDigest = digest(input);
    if (existing) {
      if (existing.version !== 1 || existing.projectId !== r.project.id ||
          existing.eventId !== r.event.id || existing.payloadDigest !== r.event.payload.payloadDigest ||
          existing.channelBindingId !== r.channelBinding.id || existing.inputDigest !== inputDigest ||
          existing.operationId !== operationIdFor(r.event.id, 'PLAN_IMPORT')) {
        throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_CONTEXT_CHANGED', 409);
      }
    } else {
      await client.query(`INSERT INTO public."AuditLog"
        (id,"organizationId","actorId",action,"entityType","entityId",metadata)
        VALUES($1,$2,$3,'meta.field.plan.prepared','Worker',$4,$5::jsonb)`,
      [key, r.member.organizationId, r.member.actorId, r.worker.id, JSON.stringify({
        version: 1, projectId: r.project.id, eventId: r.event.id,
        payloadDigest: r.event.payload.payloadDigest, channelBindingId: r.channelBinding.id,
        operationId: operationIdFor(r.event.id, 'PLAN_IMPORT'), inputDigest,
        encryptedInput: seal(r, 'field-plan-prepared', key, input)
      })]);
      await writePending(client, r, state);
    }
    await renew(client, r);
    const token = decryptCustomerSecret(r.connection.encryptedAccessToken, {
      organizationId: r.member.organizationId, projectId: r.connection.projectId,
      purpose: protocol.credentialPurpose, resourceId: r.connection.phoneNumberId
    }, environment);
    return {planning: true, command, state, token, identityDigest: identity(r),
      projectId: r.project.id, scope: r.scope, workerId: r.worker.id,
      userId: r.member.clerkUserId, connection: r.connection,
      ownCompanyCapability: r.ownCompanyCapability,
      operationId: operationIdFor(r.event.id, 'PLAN_IMPORT')};
  }
  return {
    configured,
    prepare,
    async recover(client, r) {
      const row = (await client.query(`SELECT metadata FROM public."AuditLog"
        WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4
          AND action='meta.field.plan.prepared'`,
      [preparedId(r.event.id), r.member.organizationId, r.member.actorId, r.worker.id])).rows[0]?.metadata;
      if (!row) return null;
      const input = unseal(r, 'field-plan-prepared', preparedId(r.event.id), row.encryptedInput);
      return prepare(client, r, input.command, input.state, row);
    },
    async execute(context, prepared) {
      if (!configured) throw new WorkspaceError('META_PLAN_IMPORT_NOT_CONFIGURED', 503);
      const own = prepared.connection?.metadata?.ownCompany || Object.hasOwn(prepared.connection?.metadata || {}, 'ownCompanyRuntime');
      const beforeExternal = () => within(async client => {
        const r = await resolve(client, context);
        checkPrepared(r, prepared);
        await requireMetaPlanImportOrigin(client, r, prepared.command, prepared.state, environment);
        if (own) await lockOwnCompanyIssuer(client, r.connection, {environment});
        await commitFence(client, r);
        await renew(client, r);
      });
      const external = fn => async (...args) => {await beforeExternal(); return fn(...args);};
      const session = Object.freeze({userId: prepared.userId});
      let phase = 'OBSERVE';
      const workspace = {projectOperation: (s, input, writable, callback) => within(async client => {
        const r = await resolve(client, context);
        checkPrepared(r, prepared);
        if (s !== session || s.userId !== r.member.clerkUserId || input.projectId !== r.project.id ||
            input.scope !== prepared.scope || typeof writable !== 'boolean') {
          throw new WorkspaceError('META_CHANNEL_CONTEXT_CHANGED', 409);
        }
        await requireMetaPlanImportOrigin(client, r, prepared.command, prepared.state, environment, {reservationReadOnly: phase === 'OBSERVE'});
        await commitFence(client, r);
        // Only this import composition receives the verified office role.
        // Field operations continue to use their deliberately restricted role.
        const value = await callback(client, {...r.member, channelProof: {
          provider: protocol.provider, eventId: r.event.id, channelId: r.connection.id,
          payloadDigest: r.event.payload.payloadDigest, bindingId: r.channelBinding.id
        }}, prepared.scope, r.project);
        await commitFence(client, r);
        return value;
      })};
      const imports = createPlanImport({workspace, put: external(put), get: external(get),
        analyzer: {analyze: external((...args) => analyzer.analyze(...args))}, environment: () => environment});
      const base = {projectId: prepared.projectId, scope: prepared.scope};
      // Observe a prior reservation before any download. Pending/expired/failed
      // attempts are reported, not repeated or substituted with another id.
      const prior = await imports.read(session, {...base, operationId: prepared.operationId});
      let attached = prior;
      if (prior.state === 'NOT_OBSERVED') {
        const expired = await within(async client => {
          const r = await resolve(client, context); checkPrepared(r, prepared);
          await requireMetaPlanImportOrigin(client, r, prepared.command, prepared.state, environment, {reservationReadOnly: true});
          if (r.now.getTime() < Date.parse(prepared.command.sourceOrigin.expiresAt)) return null;
          const found = await saved(client, r); if (found) return found;
          return record(client, r, result(r, 'PLAN_IMPORT_REFERENCE_EXPIRED',
            text('La referencia del archivo venció antes de iniciar la carga. No se creó un borrador ni se analizó el archivo. Escribí MENU y elegí Importar cronograma para preparar otro intento.'),
            {code: 'META_PLAN_IMPORT_REFERENCE_EXPIRED'}), null, {onlyIfCurrent: true});
        });
        if (expired) return expired;
        phase = 'ATTACH';
        const scopedProvider = own ? await provider.forConnection({
          capability: prepared.ownCompanyCapability, connection: prepared.connection,
          token: prepared.token, beforeExternal
        }) : provider;
        let source;
        try {
          await beforeExternal();
          const ref = prepared.command.sourceOrigin;
          const downloaded = await scopedProvider.downloadPlanSource({
            token: prepared.token, phoneNumberId: prepared.connection.phoneNumberId,
            mediaId: ref.mediaId, limit: ref.kind === 'image' ? 2*1024*1024 : 3*1024*1024,
            beforeExternal
          });
          if (downloaded.contentType !== ref.contentType) throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_INTEGRITY', 409);
          source = decodePlanSource(downloaded.bytes, downloaded.contentType);
          if (downloaded.sha256 !== source.sha256) throw new WorkspaceError('META_PLAN_IMPORT_SOURCE_INTEGRITY', 409);
        } catch (error) {
          if (!sourceErrors.has(error.code)) throw error;
          return within(async client => {
            const r = await resolve(client, context); checkPrepared(r, prepared);
            const found = await saved(client, r); if (found) return found;
            return record(client, r, result(r, 'PLAN_IMPORT_SOURCE_REVIEW',
              text('El formato o tamaño del archivo no pudo validarse. No se creó un borrador. Escribí MENU, elegí Importar cronograma y enviá un archivo legible dentro del límite indicado.'),
              {code: error.code}), null, {onlyIfCurrent: true});
          });
        }
        attached = await imports.attach(session, {...base, operationId: prepared.operationId,
          consent: prepared.command.consent, source});
      }
      return within(async client => {
        const r = await resolve(client, context); checkPrepared(r, prepared);
        await requireMetaPlanImportOrigin(client, r, prepared.command, prepared.state, environment, {reservationReadOnly: true});
        const found = await saved(client, r); if (found) return found;
        const draft = attached.draft;
        const link = 'https://obrasaas.com/cuenta?obra=' + encodeURIComponent(r.project.id)
          + (draft ? '&plan=' + encodeURIComponent(draft.id) + '#plan-import-title' : '');
        const body = draft?.status === 'READY'
          ? 'El borrador del cronograma está preparado con ' + draft.rows.length + (draft.rows.length === 1 ? ' partida. ' : ' partidas. ') + 'Abrilo para revisar la fuente, completar las fechas y resolver las dudas antes de aplicar tareas. '
          : draft?.status === 'FAILED'
          ? 'La extracción no quedó confirmada. Consultá el borrador y su fuente en la obra antes de decidir otra carga. '
          : draft ? 'El intento está registrado y su procesamiento sigue pendiente' + (draft.processingExpired ? ' o vencido' : '') + '. Consultá su estado en la obra; no repetimos la descarga ni la extracción. '
          : 'La carga fue rechazada antes de crear un borrador. Consultá el resultado en la obra antes de otra carga. ';
        return record(client, r, result(r, 'PLAN_IMPORT_DRAFT',
          text(body + link + '\nLas tareas y su avance conservan su estado. Escribí MENU para continuar.'),
          {businessApplied: Boolean(draft), receiptId: draft?.id || attached.receiptId || null,
            reviewState: 'RECORDED'}), null, {onlyIfCurrent: true});
      });
    }
  };
}
