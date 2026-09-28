import { createHash } from 'node:crypto';
import { analyzeLegacyCutover, CutoverAuditError } from './legacy-cutover-audit.mjs';
export const MAPPING_POLICY = 'legacy-existing-identity-plan-v1';
export const PLAN_LIMIT = 5000;
export const REASONS = Object.freeze(['DOCUMENTED_MATCH','NEEDS_EVIDENCE','NO_CANONICAL_TARGET','CONFLICTING_SCOPE']);
const fail = code => { throw new CutoverAuditError(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 512;
const ordered = (a,b) => a < b ? -1 : a > b ? 1 : 0;
export const mappingDigest = value => createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const ref = (prefix,...parts) => prefix+'_'+mappingDigest([MAPPING_POLICY,...parts]);
const EDITABLE = ['action','targetRef','parentSourceRef','reason'];
const immutable = row => Object.fromEntries(Object.entries(row).filter(([key])=>!EDITABLE.includes(key)));
function exactKeys(value,keys,code='PLAN_STRUCTURE_INVALID') {
  if(!object(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail(code);
}
// Raw IDs stay in private process memory. Hashes are locators, not signatures.
function context(snapshot,sourceSha) {
  const audit=analyzeLegacyCutover(snapshot,{sourceSha});
  const catalog=new Map(),rows=[],internalRows=new Map(),targets=[];
  const projects=new Map(snapshot.projects.map(row=>[row.id,row]));
  const byKind=new Map();
  for(const [kind,table] of [['organization',snapshot.organizations],['project',snapshot.projects],['worker',snapshot.workers],['task',snapshot.tasks]]) {
    for(const [ordinal,raw] of [...table].sort((a,b)=>ordered(a.id,b.id)).entries()) {
      const org=kind==='organization'?raw.id:kind==='project'?raw.organizationId:projects.get(raw.projectId).organizationId;
      const item={targetRef:ref('target',kind,raw.id),kind,ordinal:ordinal+1,organizationRef:ref('target','organization',org),projectRef:['worker','task'].includes(kind)?ref('target','project',raw.projectId):kind==='project'?ref('target','project',raw.id):null};
      catalog.set(item.targetRef,{...item,raw});targets.push(item);
      for(const identity of new Set([raw.id,raw.externalId].filter(id))) {const key=JSON.stringify([kind,identity]),matches=byKind.get(key)||[];matches.push(item.targetRef);byKind.set(key,matches);}
    }
  }

  if(targets.length>PLAN_LIMIT*4)fail('PLAN_SIZE_LIMIT');
  for(const [groupIndex,source] of [...snapshot.sources].sort((a,b)=>ordered(a.id,b.id)).entries()) {
    const state=JSON.parse(source.stateText),groupRef=ref('group',source.id);
    for(const [kind,name] of [['organization','tenants'],['project','projects'],['worker','workerRegistry'],['task','tasks']]) {
      const data=state[name];
      const entries=kind==='task'&&object(data)?Object.entries(data).sort(([a],[b])=>ordered(a,b)):Array.isArray(data)?data.map(row=>[null,row]):[];
      const counts=new Map();
      for(const [key,row] of entries){const identity=object(row)?row.id??key:null;if(id(identity))counts.set(identity,(counts.get(identity)||0)+1);}
      for(const [ordinal,[key,raw]] of entries.entries()) {
        if(rows.length>=PLAN_LIMIT)fail('PLAN_SIZE_LIMIT');
        const identity=object(raw)?raw.id??key:null,warnings=[];
        if(!object(raw))warnings.push('SOURCE_RECORD_INVALID');
        if(!id(identity))warnings.push('SOURCE_IDENTIFIER_INVALID');
        if(counts.get(identity)>1)warnings.push('SOURCE_IDENTIFIER_DUPLICATED');
        if(kind==='task'&&object(raw)&&raw.id!==undefined&&raw.id!==key)warnings.push('SOURCE_KEY_ID_MISMATCH');
        if(object(raw)&&raw.organizationId!==undefined&&raw.tenantId!==undefined&&raw.organizationId!==raw.tenantId)warnings.push('SOURCE_SCOPE_CONFLICT');
        const sourceRef=ref('source',source.id,kind,ordinal);
        const candidates=(byKind.get(JSON.stringify([kind,identity]))||[]).sort(ordered);
        const item={sourceRef,groupRef,sourceGroup:groupIndex+1,kind,ordinal:ordinal+1,
          identityEvidence:candidates.length===0?'NO_ID_CANDIDATE':candidates.length===1?'ONE_ID_CANDIDATE':'MULTIPLE_ID_CANDIDATES',
          candidates:candidates.slice(0,50),candidatesTruncated:candidates.length>50,warnings,
          action:'UNREVIEWED',targetRef:null,parentSourceRef:null,reason:null};
        rows.push(item);internalRows.set(sourceRef,{...item,raw,identity});
      }
    }
  }

  const basis={policyVersion:MAPPING_POLICY,sourceSha,sourceFingerprint:audit.sourceFingerprint,catalogFingerprint:audit.catalogFingerprint,
    schemaFingerprint:mappingDigest([...snapshot.migrations].sort((a,b)=>ordered(a.name,b.name)))};
  const observation={...basis,records:rows.map(immutable),targets,auditBlockers:audit.blockers,excludedMessageCount:audit.totals.legacyMessages};
  const draft={formatVersion:1,...basis,observationDigest:mappingDigest(observation),intent:'LINK_EXISTING_IDENTITIES_ONLY',
    executionAllowed:false,importAuthorized:false,auditBlockers:audit.blockers,excludedMessageCount:audit.totals.legacyMessages,targets,records:rows};
  return {draft,catalog,internalRows,audit};
}
export function draftLegacyMappingPlan(snapshot,{sourceSha}={}) {return context(snapshot,sourceSha).draft;}
export function checkLegacyMappingPlan(snapshot,manifest,{sourceSha}={}) {
  const ctx=context(snapshot,sourceSha),baseline=ctx.draft;
  exactKeys(manifest,Object.keys(baseline));
  for(const key of Object.keys(baseline).filter(key=>key!=='records'))
    if(JSON.stringify(manifest[key])!==JSON.stringify(baseline[key]))fail('PLAN_OBSERVATION_CHANGED');
  if(!Array.isArray(manifest.records)||manifest.records.length!==baseline.records.length)fail('PLAN_COVERAGE_INVALID');
  const seen=new Set(),selections=new Map(),findings=[],byIdentity=new Map();
  const baselineRows=new Map(baseline.records.map(row=>[row.sourceRef,row]));
  const issue=(code,sourceRef=null)=>findings.push({code,sourceRef});
  for(const row of ctx.internalRows.values()) {
    const key=JSON.stringify([row.groupRef,row.kind,row.identity]),values=byIdentity.get(key)||[];
    values.push(row);byIdentity.set(key,values);
  }
  for(const row of manifest.records) {
    exactKeys(row,Object.keys(baseline.records[0]||{}));
    const original=ctx.internalRows.get(row.sourceRef);
    if(!original||seen.has(row.sourceRef))fail('PLAN_COVERAGE_INVALID');seen.add(row.sourceRef);
    if(JSON.stringify(immutable(row))!==JSON.stringify(immutable(baselineRows.get(row.sourceRef))))fail('PLAN_RECORD_CHANGED');
    if(!['UNREVIEWED','LINK_EXISTING','DEFER'].includes(row.action))fail('PLAN_ACTION_INVALID');

    if(row.action==='UNREVIEWED') {
      if(row.targetRef!==null||row.parentSourceRef!==null||row.reason!==null)fail('PLAN_DECISION_INVALID');issue('REVIEW_REQUIRED',row.sourceRef);
    } else if(row.action==='DEFER') {
      if(row.targetRef!==null||row.parentSourceRef!==null||!REASONS.slice(1).includes(row.reason))fail('PLAN_DECISION_INVALID');issue('RECORD_DEFERRED',row.sourceRef);
    } else {
      if(row.reason!=='DOCUMENTED_MATCH'||!ctx.catalog.has(row.targetRef))fail('PLAN_TARGET_INVALID');
      const target=ctx.catalog.get(row.targetRef);if(target.kind!==row.kind)fail('PLAN_TARGET_KIND_INVALID');
      for(const warning of row.warnings)issue(warning,row.sourceRef);
      const direct=ctx.catalog.get(ref('target',row.kind,original.identity));
      if(direct&&direct.targetRef!==row.targetRef)issue('EXACT_IDENTITY_RETARGETED',row.sourceRef);
    }
    selections.set(row.sourceRef,row);
  }
  const usedTargets=new Map();
  for(const row of manifest.records.filter(item=>item.action==='LINK_EXISTING')) {
    if(usedTargets.has(row.targetRef))issue('MANY_TO_ONE_MERGE_FORBIDDEN',row.sourceRef);usedTargets.set(row.targetRef,row.sourceRef);
    const source=ctx.internalRows.get(row.sourceRef),target=ctx.catalog.get(row.targetRef);
    if(row.kind==='organization') {if(row.parentSourceRef!==null)fail('PLAN_PARENT_INVALID');continue;}
    const parentKind=row.kind==='project'?'organization':'project',parent=selections.get(row.parentSourceRef);
    if(!parent||parent.action!=='LINK_EXISTING'||parent.kind!==parentKind||parent.groupRef!==row.groupRef) {issue('REVIEWED_PARENT_REQUIRED',row.sourceRef);continue;}
    if(parentKind==='organization'?target.organizationRef!==parent.targetRef:target.projectRef!==parent.targetRef)issue('CROSS_SCOPE_TARGET',row.sourceRef);
    if(object(source.raw))for(const [field,kind,expected] of [['projectId','project',target.projectRef],['organizationId','organization',target.organizationRef],['tenantId','organization',target.organizationRef]]) {
      if(row.kind==='project'&&field==='projectId')continue;
      const claim=source.raw[field];if(claim===undefined||claim===null)continue;
      if(!id(claim)){issue('SOURCE_SCOPE_INVALID',row.sourceRef);continue;}
      const catalogClaim=ctx.catalog.get(ref('target',kind,claim));
      if(catalogClaim&&catalogClaim.targetRef!==expected)issue('DECLARED_SCOPE_CHANGED',row.sourceRef);

      const claims=byIdentity.get(JSON.stringify([row.groupRef,kind,claim]))||[];
      if(claims.length>1)issue('DECLARED_SCOPE_AMBIGUOUS',row.sourceRef);
      else if(claims.length===1) {
        const choice=selections.get(claims[0].sourceRef);
        if(choice?.action!=='LINK_EXISTING'||choice.targetRef!==expected)issue('DECLARED_SCOPE_NOT_RECONCILED',row.sourceRef);
      } else if(!catalogClaim)issue('DECLARED_SCOPE_UNKNOWN',row.sourceRef);
    }
  }
  const structural=new Set(['CORE_COLLECTION_MISSING','FIELD_TYPE_MISMATCH','INCOMPLETE_MIGRATIONS','LEGACY_SOURCE_MISSING']);
  for(const blocker of ctx.audit.blockers)if(structural.has(blocker.code))issue(blocker.code);
  if(!manifest.records.length)issue('NO_LINKS_TO_REVIEW');
  const canonical=[...manifest.records].sort((a,b)=>ordered(a.sourceRef,b.sourceRef)).map(row=>({sourceRef:row.sourceRef,kind:row.kind,action:row.action,targetRef:row.targetRef,parentSourceRef:row.parentSourceRef,reason:row.reason}));
  const fingerprint=mappingDigest([MAPPING_POLICY,baseline.observationDigest,canonical]),valid=findings.length===0;

  return {formatVersion:1,policyVersion:MAPPING_POLICY,status:valid?'SELECTIONS_COMPLETE_NOT_AUTHORIZED':'BLOCKED',sourceSha,
    sourceFingerprint:baseline.sourceFingerprint,catalogFingerprint:baseline.catalogFingerprint,observationDigest:baseline.observationDigest,
    planFingerprint:fingerprint,executionAllowed:false,importAuthorized:false,reviewIdentityVerified:false,
    counts:{records:manifest.records.length,linked:canonical.filter(row=>row.action==='LINK_EXISTING').length,
      deferred:canonical.filter(row=>row.action==='DEFER').length,pending:canonical.filter(row=>row.action==='UNREVIEWED').length},
    excludedMessageCount:baseline.excludedMessageCount,auditBlockers:baseline.auditBlockers,
    findings:findings.sort((a,b)=>ordered(JSON.stringify(a),JSON.stringify(b))),
    rehearsalSteps:valid?canonical.filter(row=>row.action==='LINK_EXISTING').sort((a,b)=>['organization','project','worker','task'].indexOf(a.kind)-['organization','project','worker','task'].indexOf(b.kind)).map(row=>({operation:'LINK_REFERENCE_ONLY',sourceRef:row.sourceRef,
      targetRef:row.targetRef,parentSourceRef:row.parentSourceRef,operationKey:ref('op',fingerprint,row.sourceRef)})):[]};
}
