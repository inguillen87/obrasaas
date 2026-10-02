import { createHash } from 'node:crypto';
import { WorkspaceError } from './workspace-policy.mjs';
import { CONSTRUCTOR_CRM_STAGES } from './constructor-crm-policy.mjs';

export const CONSTRUCTOR_CRM_SCHEMA_VERSION = 'constructor-crm-v1';
const legacyColumns = Object.freeze({
  id: ['text', true, -1], organizationId: ['text', false, -1], name: ['text', true, -1],
  contactName: ['text', false, -1], email: ['text', false, -1], phone: ['text', false, -1],
  segment: ['text', false, -1], source: ['text', false, -1], stage: ['CrmStage', true, -1],
  estimatedSeats: ['int4', false, -1], estimatedMonthlyValue: ['numeric', false, 786438],
  nextFollowUpAt: ['timestamp', false, 3], notes: ['text', false, -1],
  createdAt: ['timestamp', true, 3], updatedAt: ['timestamp', true, 3],
});
const adoptedColumns = Object.freeze({ ...legacyColumns, ownerOrganizationId: ['text', false, -1], revision: ['int4', true, -1] });
const indexColumns = Object.freeze({
  CrmAccount_pkey: ['id'], CrmAccount_organizationId_key: ['organizationId'],
  CrmAccount_stage_nextFollowUpAt_idx: ['stage', 'nextFollowUpAt'], CrmAccount_email_idx: ['email'],
  CrmAccount_ownerOrganizationId_id_idx: ['ownerOrganizationId', 'id'],
});
const simpleExpression = expression => typeof expression === 'string' ? expression.replace(/[\s"()]/g, '') : null;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const legacyDefault = (name, expression) => {
  if (name === 'stage') return ["'NEW'::\"CrmStage\"", "'NEW'::public.\"CrmStage\""].includes(expression);
  if (name === 'createdAt') return ['CURRENT_TIMESTAMP', 'now()'].includes(expression);
  return expression === null;
};

// This reader only inspects PostgreSQL catalogs. It does not select CRM contacts,
// organization data, migration business records, connection strings or role names.
export async function readConstructorCrmCatalog(client) {
  const relation = (await client.query(`SELECT c.relkind AS kind,c.relrowsecurity AS "rowSecurity",c.relforcerowsecurity AS "forcedRowSecurity",
    EXISTS(SELECT 1 FROM pg_catalog.pg_inherits h WHERE h.inhrelid=c.oid OR h.inhparent=c.oid) AS inheritance,
    pg_has_role(current_user,c.relowner,'USAGE') AS "canAlter",has_schema_privilege(current_user,n.oid,'CREATE') AS "canCreateIndex",
    has_table_privilege(current_user,c.oid,'SELECT') AS "canSelect",has_table_privilege(current_user,c.oid,'INSERT') AS "canInsert",
    has_table_privilege(current_user,c.oid,'UPDATE') AS "canUpdate"
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='CrmAccount'`)).rows[0] || null;
  const columns = (await client.query(`SELECT a.attname::text AS name,t.typname::text AS type,tn.nspname::text AS "typeSchema",a.attnotnull AS "notNull",a.atttypmod AS modifier,pg_get_expr(d.adbin,d.adrelid) AS "defaultExpression"
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_type t ON t.oid=a.atttypid JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relname='CrmAccount' AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attname`)).rows;
  const constraints = (await client.query(`SELECT k.conname::text AS name,k.contype::text AS type,k.convalidated AS validated,COALESCE((to_jsonb(k)->>'conenforced')::boolean,true) AS enforced,k.condeferrable AS deferrable,k.condeferred AS deferred,k.connoinherit AS "noInherit",
    ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY u(num,ordinal) JOIN pg_catalog.pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=u.num ORDER BY u.ordinal) AS columns,
    rn.nspname::text AS "referenceSchema",r.relname::text AS "referenceTable",
    ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY u(num,ordinal) JOIN pg_catalog.pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=u.num ORDER BY u.ordinal) AS "referenceColumns",
    k.confdeltype::text AS "deleteAction",k.confupdtype::text AS "updateAction",k.confmatchtype::text AS "matchType",pg_get_expr(k.conbin,k.conrelid) AS expression
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_class r ON r.oid=k.confrelid LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid=r.relnamespace
    WHERE n.nspname='public' AND c.relname='CrmAccount' AND k.contype<>'n' ORDER BY k.conname`)).rows;
  const indexes = (await client.query(`SELECT ic.relname::text AS name,i.indisunique AS unique,i.indisprimary AS primary,i.indisvalid AS valid,i.indisready AS ready,am.amname::text AS method,
    i.indnkeyatts AS "keyCount",i.indnatts AS "totalCount",i.indpred IS NOT NULL AS partial,i.indexprs IS NOT NULL AS expression,
    ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY u(num,ordinal) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=u.num WHERE u.ordinal<=i.indnkeyatts ORDER BY u.ordinal) AS columns,
    i.indoption::smallint[] AS options
    FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid JOIN pg_catalog.pg_am am ON am.oid=ic.relam
    WHERE n.nspname='public' AND c.relname='CrmAccount' ORDER BY ic.relname`)).rows;
  const stages = (await client.query(`SELECT e.enumlabel::text AS value FROM pg_catalog.pg_enum e JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='CrmStage' ORDER BY e.enumsortorder`)).rows.map(row => row.value);
  const organization = (await client.query(`SELECT a.atttypid='pg_catalog.text'::regtype AS "idIsText",a.attnotnull AS "idNotNull",
    EXISTS(SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid AND k.contype='p' AND k.conkey=ARRAY[a.attnum]::smallint[] AND k.convalidated) AS "idPrimary",
    has_table_privilege(current_user,c.oid,'REFERENCES') AS "canReference",has_table_privilege(current_user,c.oid,'UPDATE,DELETE,TRUNCATE') AS "canLock"
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname='id' AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relname='Organization' AND c.relkind='r'`)).rows[0] || null;
  return { relation, columns, constraints, indexes, stages, organization };
}

export function checkConstructorCrmCatalog(catalog, { allowLegacy = false } = {}) {
  const issues = [];
  if (!catalog || !catalog.relation) return { version: CONSTRUCTOR_CRM_SCHEMA_VERSION, state: 'MISSING', compatible: false, issues: ['CRM_TABLE_MISSING'] };
  const hasOwner = catalog.columns?.some(row => row.name === 'ownerOrganizationId');
  const hasRevision = catalog.columns?.some(row => row.name === 'revision');
  const adopted = hasOwner && hasRevision;
  if (hasOwner !== hasRevision) issues.push('PARTIAL_ADOPTION');
  const expected = adopted ? adoptedColumns : legacyColumns;
  if (catalog.relation.kind !== 'r' || catalog.relation.rowSecurity !== false || catalog.relation.forcedRowSecurity !== false || catalog.relation.inheritance !== false) issues.push('CRM_RELATION_CONTRACT_CHANGED');
  if (!Array.isArray(catalog.columns) || catalog.columns.length !== Object.keys(expected).length) issues.push('CRM_COLUMN_SET_CHANGED');
  for (const [name, [type, notNull, modifier]] of Object.entries(expected)) {
    const column = catalog.columns?.find(row => row.name === name);
    const typeSchema = type === 'CrmStage' ? 'public' : 'pg_catalog';
    const correctDefault = name === 'revision' ? ['1', '1::integer'].includes(column?.defaultExpression) : legacyDefault(name, column?.defaultExpression);
    if (!column || column.type !== type || column.typeSchema !== typeSchema || column.notNull !== notNull || column.modifier !== modifier || !correctDefault) issues.push('CRM_COLUMN_CONTRACT_' + name);
  }
  if (!same(catalog.stages, CONSTRUCTOR_CRM_STAGES)) issues.push('CRM_ENUM_CHANGED');
  if (!catalog.organization?.idIsText || !catalog.organization?.idNotNull || !catalog.organization?.idPrimary) issues.push('ORGANIZATION_ID_CONTRACT_CHANGED');
  const expectedConstraints = adopted ? 5 : 2;
  if (catalog.constraints?.length !== expectedConstraints) issues.push('CRM_CONSTRAINT_SET_CHANGED');
  const primary = catalog.constraints?.find(row => row.name === 'CrmAccount_pkey');
  if (!primary || primary.type !== 'p' || !primary.validated || !primary.enforced || primary.deferrable || primary.deferred || !same(primary.columns, ['id'])) issues.push('CRM_PRIMARY_KEY_CHANGED');
  for (const [name, columns, deleteAction] of [['CrmAccount_organizationId_fkey', ['organizationId'], 'n'], ...(adopted ? [['CrmAccount_ownerOrganizationId_fkey', ['ownerOrganizationId'], 'r']] : [])]) {
    const key = catalog.constraints?.find(row => row.name === name);
    if (!key || key.type !== 'f' || !key.validated || !key.enforced || key.deferrable || key.deferred || !same(key.columns, columns) || key.referenceSchema !== 'public' || key.referenceTable !== 'Organization' || !same(key.referenceColumns, ['id']) || key.deleteAction !== deleteAction || key.updateAction !== 'c' || key.matchType !== 's') issues.push('CRM_FOREIGN_KEY_CHANGED_' + name);
  }
  if (adopted) for (const [name, expression] of [['CrmAccount_revision_check', 'revision>=1'], ['CrmAccount_owner_exclusive_check', 'ownerOrganizationIdISNULLORorganizationIdISNULL']]) {
    const check = catalog.constraints?.find(row => row.name === name);
    if (!check || check.type !== 'c' || !check.validated || !check.enforced || check.noInherit || simpleExpression(check.expression) !== expression) issues.push('CRM_CHECK_CHANGED_' + name);
  }
  const expectedIndexes = Object.entries(indexColumns).filter(([name]) => adopted || name !== 'CrmAccount_ownerOrganizationId_id_idx');
  if (catalog.indexes?.length !== expectedIndexes.length) issues.push('CRM_INDEX_SET_CHANGED');
  for (const [name, columns] of expectedIndexes) {
    const index = catalog.indexes?.find(row => row.name === name);
    const unique = ['CrmAccount_pkey', 'CrmAccount_organizationId_key'].includes(name);
    if (!index || index.unique !== unique || index.primary !== (name === 'CrmAccount_pkey') || !index.valid || !index.ready || index.method !== 'btree' || index.partial || index.expression || index.keyCount !== columns.length || index.totalCount !== columns.length || !same(index.columns, columns) || !same(index.options, columns.map(() => 0))) issues.push('CRM_INDEX_CHANGED_' + name);
  }
  const structuralState = issues.length ? 'INCOMPATIBLE' : adopted ? 'ADOPTED' : 'LEGACY';
  const fingerprint = createHash('sha256').update(JSON.stringify({ columns: catalog.columns, constraints: catalog.constraints, indexes: catalog.indexes, stages: catalog.stages, relation: { kind: catalog.relation.kind, rowSecurity: catalog.relation.rowSecurity, forcedRowSecurity: catalog.relation.forcedRowSecurity, inheritance: catalog.relation.inheritance }, organization: { idIsText: catalog.organization?.idIsText, idNotNull: catalog.organization?.idNotNull, idPrimary: catalog.organization?.idPrimary } })).digest('hex');
  return { version: CONSTRUCTOR_CRM_SCHEMA_VERSION, state: structuralState, compatible: issues.length === 0 && (adopted || allowLegacy), fingerprint, columns: catalog.columns?.length || 0, constraints: catalog.constraints?.length || 0, indexes: catalog.indexes?.length || 0, issues };
}

export async function assertConstructorCrmSchema(client) {
  const catalog = await readConstructorCrmCatalog(client);
  const checked = checkConstructorCrmCatalog(catalog);
  if (!checked.compatible) throw new WorkspaceError(['LEGACY', 'MISSING'].includes(checked.state) ? 'CONSTRUCTOR_CRM_SCHEMA_PENDING' : 'CONSTRUCTOR_CRM_SCHEMA_INCOMPATIBLE', 503);
  if (catalog.relation.canSelect !== true || catalog.relation.canInsert !== true || catalog.relation.canUpdate !== true) throw new WorkspaceError('CONSTRUCTOR_CRM_SCHEMA_PERMISSION_REQUIRED', 503);
  return checked;
}
