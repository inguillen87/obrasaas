import { createHash } from 'node:crypto';
export const CUTOVER_POLICY = 'legacy-scope-audit-v1';
export class CutoverAuditError extends Error {
  constructor(code) { super('No se pudo verificar la conciliación histórica.'); this.code = code; }
}
const fail = code => { throw new CutoverAuditError(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.length > 0 && value.length <= 512;
const digest = text => createHash('sha256').update(text, 'utf8').digest('hex');
const order = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const digestRows = rows => digest(JSON.stringify(rows.map(row=>JSON.stringify(row)).sort(order)));
const FIELDS = Object.freeze({
  projects:'array',tenants:'array',workerRegistry:'array',tasks:'object',
  activeProjectId:'string',alertsCount:'number',avancePercentage:'number',currentQuincena:'string',
  diasEstimados:'string',operariosCount:'number',projectConfig:'object',
  actasHyS:'array',artPolicies:'object',attendance:'object',auditLedger:'array',budget:'object',
  cajaChica:'object',calendarAppointments:'array',certifications:'array',changeOrders:'array',
  crmLeads:'array',crmTickets:'array',curvaS:'array',ganttExternalFiles:'array',geofenceSettings:'object',
  hrAttendance:'object',hrBonuses:'array',incidents:'array',inspecciones:'array',kycVerifications:'object',
  libroObra:'array',materialRequests:'array',operationalProposals:'array',overtimeRecords:'array',
  pendingRegistrations:'object',projectPolicies:'array',remitos:'array',rfis:'array',sitePhotos:'array',
  stockpiles:'object',subscription:'object',suppliers:'array',tenantWhatsAppAccounts:'object',
  visualTaskAlerts:'array',webhooks:'array',woodModularMetrics:'object',workerReceipts:'object',
});
function index(rows) {
  const result=new Map();
  for(const row of rows) { if(!object(row)||!id(row.id)||result.has(row.id)) fail('CATALOG_IDENTITY_INVALID'); result.set(row.id,row); }
  return result;
}
function candidateIndex(rows) {
  const indexed=new Map();
  for(const row of rows)for(const key of new Set([row.id,row.externalId])){
    if(!id(key))continue;
    const matches=indexed.get(key)||[];matches.push(row);indexed.set(key,matches);
  }return indexed;
}
function summarize(name,entries,catalogs) {
  const stats={records:entries.length,missingIdentifier:0,duplicateIdentifier:0,missingProjectBinding:0,
    missingOrganizationBinding:0,conflictingBinding:0,matchedIdentity:0,unmatchedIdentity:0,
    explicitScopeMatched:0,uniqueExternalCandidate:0,multipleExternalCandidates:0,malformedRecords:0};
  const seen=new Set();
  for(const [key,row] of entries) {
    if(!object(row)){stats.malformedRecords++;continue;}
    const identity=row.id??key;
    if(!id(identity))stats.missingIdentifier++;
    else{if(seen.has(identity))stats.duplicateIdentifier++;seen.add(identity);}
    if(name==='tenants'){
      if(catalogs.organizations.has(identity))stats.matchedIdentity++;else stats.unmatchedIdentity++;
      continue;
    }
    const project=catalogs.projects.get(name==='projects'?identity:row.projectId);
    if(name==='projects'){if(project)stats.matchedIdentity++;else stats.unmatchedIdentity++;}
    else{
      if(!id(row.projectId))stats.missingProjectBinding++;
      const candidates=id(identity)?catalogs[name].get(identity)||[]:[];
      const scopes=new Set(candidates.map(c=>c.projectId));
      if(scopes.size===1)stats.uniqueExternalCandidate++;if(scopes.size>1)stats.multipleExternalCandidates++;
      if(candidates.some(c=>c.id===identity&&c.projectId===row.projectId))stats.matchedIdentity++;else stats.unmatchedIdentity++;
    }
    const organization=row.organizationId??row.tenantId;
    if(!id(organization))stats.missingOrganizationBinding++;
    const conflict=row.organizationId!==undefined&&row.tenantId!==undefined&&row.organizationId!==row.tenantId;
    if(conflict||(project&&id(organization)&&project.organizationId!==organization))stats.conflictingBinding++;
    if(!conflict&&project&&project.organizationId===organization&&catalogs.organizations.has(organization))stats.explicitScopeMatched++;
  }return stats;
}
// Summary-only report. No names, phone numbers, document values or provider tokens.
export function analyzeLegacyCutover(snapshot,{sourceSha}={}) {
  if(!object(snapshot)||snapshot.readOnlyVerified!==true||!/^[a-f0-9]{40}$/.test(sourceSha||''))fail('AUDIT_CONTEXT_INVALID');
  for(const key of ['sources','organizations','projects','workers','tasks','projectSnapshots','migrations'])
    if(!Array.isArray(snapshot[key])||snapshot[key].length>25000)fail('AUDIT_INPUT_INVALID');
  const catalogs={organizations:index(snapshot.organizations),projects:index(snapshot.projects),workerRegistry:candidateIndex(snapshot.workers),tasks:candidateIndex(snapshot.tasks)};
  if(snapshot.sources.length>10)fail('AUDIT_SOURCE_LIMIT');
  index(snapshot.workers);index(snapshot.tasks);index(snapshot.projectSnapshots);
  for(const project of snapshot.projects)if(!catalogs.organizations.has(project.organizationId))fail('CATALOG_SCOPE_INVALID');
  for(const row of [...snapshot.workers,...snapshot.tasks,...snapshot.projectSnapshots])if(!catalogs.projects.has(row.projectId))fail('CATALOG_SCOPE_INVALID');
  const issues=new Map(),inventory={},domains=[],parts=[],sourceIds=new Set();
  const add=(code,count=1)=>{if(count)issues.set(code,(issues.get(code)||0)+count);};
  let unknownFields=0,messageCount=0;
  for(const source of snapshot.sources){
    if(!id(source.id)||sourceIds.has(source.id)||typeof source.stateText!=='string'||typeof source.messagesText!=='string')fail('SOURCE_INVALID');
    sourceIds.add(source.id);
    if(Buffer.byteLength(source.stateText)+Buffer.byteLength(source.messagesText)>8*1024*1024)fail('SOURCE_TOO_LARGE');
    let state,messages;
    try{state=JSON.parse(source.stateText);messages=JSON.parse(source.messagesText);}catch{fail('SOURCE_JSON_INVALID');}
    if(!object(state)||!Array.isArray(messages))fail('SOURCE_SHAPE_INVALID');
    parts.push([source.id,source.stateText,source.messagesText]);messageCount+=messages.length;
    for(const [field,expected]of Object.entries(FIELDS)){
      if(!Object.hasOwn(state,field))continue;
      const actual=state[field]===null?'null':Array.isArray(state[field])?'array':typeof state[field];
      const entry=inventory[field]||={field,expectedType:expected,sources:0,entries:0,typeMismatches:0};entry.sources++;
      if(actual!==expected){entry.typeMismatches++;add('FIELD_TYPE_MISMATCH');continue;}
      if(actual==='array')entry.entries+=state[field].length;
      if(actual==='object')entry.entries+=Object.keys(state[field]).length;
    }
    unknownFields+=Object.keys(state).filter(key=>!Object.hasOwn(FIELDS,key)).length;
    for(const name of ['projects','tenants','workerRegistry','tasks']){
      if(!Object.hasOwn(state,name)){add('CORE_COLLECTION_MISSING');continue;}
      const entries=name==='tasks'&&object(state[name])?Object.entries(state[name]):Array.isArray(state[name])?state[name].map(row=>[null,row]):[];
      const item=summarize(name,entries,catalogs);domains.push({domain:name,...item});
      add('RECORD_IDENTIFIER_MISSING',item.missingIdentifier);add('RECORD_IDENTIFIER_DUPLICATED',item.duplicateIdentifier);
      add('CROSS_TENANT_BINDING_CONFLICT',item.conflictingBinding);add('RECORD_SHAPE_INVALID',item.malformedRecords);
      if(name==='tenants')add('TENANT_IDENTITY_UNRECONCILED',item.unmatchedIdentity);
      else {add('RECORD_SCOPE_UNRECONCILED',item.records-item.explicitScopeMatched);add('RECORD_IDENTITY_UNRECONCILED',item.unmatchedIdentity);}
    }
    // A selected project is NOT the authority of every historical record.
    if(Object.hasOwn(state,'activeProjectId'))add('GLOBAL_SELECTION_NOT_RECORD_AUTHORITY');
    add('LEGACY_MESSAGES_REQUIRE_SCOPED_PROVENANCE',messages.length);
    for(const name of ['certifications','workerReceipts','auditLedger','kycVerifications']){
      const value=state[name];if((Array.isArray(value)&&value.length)||(object(value)&&Object.keys(value).length))add('HISTORICAL_ASSERTIONS_REQUIRE_REVIEW');
    }
  }
  add('UNKNOWN_FIELDS_REQUIRE_REVIEW',unknownFields);
  const incomplete=snapshot.migrations.filter(row=>row.completed!==true&&row.rolledBack!==true).length;
  add('INCOMPLETE_MIGRATIONS',incomplete);if(!snapshot.sources.length)add('LEGACY_SOURCE_MISSING');
  const report={formatVersion:1,policyVersion:CUTOVER_POLICY,sourceSha,status:issues.size?'BLOCKED':'REVIEW_REQUIRED',
    readOnlyVerified:true,executionAllowed:false,importAuthorized:false,monetaryValuesConverted:false,
    sourceFingerprint:digestRows(parts),catalogFingerprint:digestRows([
      snapshot.organizations.map(x=>[x.id]).sort(),snapshot.projects.map(x=>[x.id,x.organizationId]).sort(),
      snapshot.workers.map(x=>[x.id,x.projectId,x.externalId??null]).sort(),snapshot.tasks.map(x=>[x.id,x.projectId,x.externalId??null]).sort(),
      snapshot.projectSnapshots.map(x=>[x.id,x.projectId,x.version]).sort()]),
    totals:{legacyStateRows:snapshot.sources.length,legacyMessages:messageCount,organizations:snapshot.organizations.length,
      projects:snapshot.projects.length,workers:snapshot.workers.length,tasks:snapshot.tasks.length,projectSnapshots:snapshot.projectSnapshots.length,
      completedMigrations:snapshot.migrations.filter(x=>x.completed===true&&x.rolledBack!==true).length,incompleteMigrations:incomplete,unknownFields},
    inventory:Object.values(inventory).sort((a,b)=>order(a.field,b.field)),domains,
    blockers:[...issues].sort(([a],[b])=>order(a,b)).map(([code,count])=>({code,count}))};
  report.reportDigest=digest(JSON.stringify(report));return report;
}
export function compareCutoverAudits(before,after){
  for(const report of [before,after]){
    if(!object(report)||report.policyVersion!==CUTOVER_POLICY||!/^[a-f0-9]{64}$/.test(report.reportDigest||''))fail('AUDIT_REPORT_INVALID');
    const {reportDigest,...body}=report;if(digest(JSON.stringify(body))!==reportDigest)fail('AUDIT_REPORT_CHANGED');
  }
  return {policyVersion:CUTOVER_POLICY,sourceUnchanged:before.sourceFingerprint===after.sourceFingerprint,
    catalogUnchanged:before.catalogFingerprint===after.catalogFingerprint,importAuthorized:false,
    schemaHistoryChanged:before.totals.completedMigrations!==after.totals.completedMigrations};
}
