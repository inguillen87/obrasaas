import { CutoverAuditError } from './legacy-cutover-audit.mjs';
import { draftLegacyMappingPlan, checkLegacyMappingPlan, mappingDigest, MAPPING_POLICY } from './legacy-mapping-plan.mjs';
export const IDENTITY_CONTEXT_POLICY = 'private-identity-context-v1';
const fail = code => { throw new CutoverAuditError(code); };
const kinds = { organization: ['tenants','organizations','Organization'], project: ['projects','projects','Project'], worker: ['workerRegistry','workers','Worker'], task: ['tasks','tasks','Task'] };
const ordered = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function fullLabel(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim();
  return cleaned || null;
}
export const reviewLabel=value=>{const text=fullLabel(value);return text?[...text].slice(0,160).join(''):null;};
const rawLabelOf=row=>object(row)?row.name??row.title??row.fullName??row.nombre:null;
const labelOf = row => object(row) ? reviewLabel(row.name ?? row.title ?? row.fullName ?? row.nombre) : null;
const comparison = value => value ? value.normalize('NFKC').toLocaleLowerCase('es').trim() : null;
const planRef = (prefix,...parts) => prefix+'_'+mappingDigest([MAPPING_POLICY,...parts]);
function rawRows(source,kind) {
  const rows=source[kinds[kind][0]];
  if(kind==='task'&&object(rows)) return Object.entries(rows).sort(([a],[b])=>ordered(a,b)).map(([key,value])=>({key,value}));
  return Array.isArray(rows)?rows.map(value=>({key:null,value})):[];
}
function nameGroups(rows,refKey) {
  const grouped=new Map();
  for(const row of rows) { const label=comparison(row.label); if(!label)continue;
    const key=JSON.stringify([row.kind,row.groupRef??null,label]),members=grouped.get(key)||[];
    members.push(row[refKey]);grouped.set(key,members);
  }
  return [...grouped.values()].filter(group=>group.length>1);
}
export function identityReviewContext(snapshot,plan) {
  if(!object(snapshot.displayLabels))fail('IDENTITY_DISPLAY_CONTEXT_REQUIRED');
  const labels=new Map(),catalog=new Map(),fullLabels=new Map();
  for(const [kind,[,table,displayTable]] of Object.entries(kinds)) {
    const values=snapshot.displayLabels[displayTable];
    if(!Array.isArray(values)||values.length!==snapshot[table].length)fail('IDENTITY_DISPLAY_COVERAGE_INVALID');
    const known=new Map(snapshot[table].map(row=>[row.id,row])),seen=new Set();
    for(const row of values) {
      if(!object(row)||!known.has(row.id)||seen.has(row.id))fail('IDENTITY_DISPLAY_COVERAGE_INVALID');
      seen.add(row.id);const reference=planRef('target',kind,row.id);
      labels.set(reference,reviewLabel(row.label));fullLabels.set(reference,fullLabel(row.label));catalog.set(reference,known.get(row.id));
    }
  }
  const targets=plan.targets.map(target=>({targetRef:target.targetRef,kind:target.kind,ordinal:target.ordinal,
    label:labels.get(target.targetRef),labelFingerprint:mappingDigest(fullLabels.get(target.targetRef)),organizationLabel:labels.get(target.organizationRef),projectLabel:labels.get(target.projectRef)??null}));
  const sources=[...snapshot.sources].sort((a,b)=>ordered(a.id,b.id)).map(source=>({id:source.id,state:JSON.parse(source.stateText)}));
  const raw=new Map();
  const records=plan.records.map(row=>{
    const source=sources[row.sourceGroup-1],entry=rawRows(source.state,row.kind)[row.ordinal-1];
    if(!entry||planRef('source',source.id,row.kind,row.ordinal-1)!==row.sourceRef)fail('IDENTITY_SOURCE_LOCATOR_INVALID');
    raw.set(row.sourceRef,entry);return {sourceRef:row.sourceRef,groupRef:row.groupRef,kind:row.kind,ordinal:row.ordinal,
      label:labelOf(entry.value),labelFingerprint:mappingDigest(fullLabel(rawLabelOf(entry.value))),idCandidateRefs:[...row.candidates],nameCandidateRefs:[],declaredScope:[]};
  });
  for(const row of records) {
    const entry=raw.get(row.sourceRef),value=entry.value;
    row.nameCandidateRefs=targets.filter(target=>target.kind===row.kind&&row.label&&comparison(fullLabels.get(target.targetRef))===comparison(fullLabel(rawLabelOf(value)))).map(target=>target.targetRef);
    if(!object(value))continue;
    for(const [field,kind] of [['tenantId','organization'],['organizationId','organization'],['projectId','project']]) {
      if(row.kind==='organization'||(row.kind==='project'&&kind==='project'))continue;
      const claim=value[field];if(claim===undefined||claim===null)continue;
      const sourceMatches=records.filter(other=>other.groupRef===row.groupRef&&other.kind===kind&&
        (raw.get(other.sourceRef).value?.id??raw.get(other.sourceRef).key)===claim).map(other=>other.sourceRef);
      const target=typeof claim==='string'?planRef('target',kind,claim):null;
      const targetMatches=target&&catalog.has(target)?[target]:[];
      row.declaredScope.push({field,kind,state:sourceMatches.length+targetMatches.length?'REFERENCED':'UNRESOLVED',sourceMatches,targetMatches});
    }
  }
  const duplicateSources=nameGroups(records,'sourceRef'),duplicateTargets=nameGroups(targets,'targetRef');
  const context={policyVersion:IDENTITY_CONTEXT_POLICY,observationDigest:plan.observationDigest,records,targets,duplicateSources,duplicateTargets};
  return {...context,contextDigest:mappingDigest(context)};
}
export function buildIdentityReview(snapshot,proposal,{sourceSha}={}) {
  const draft=draftLegacyMappingPlan(snapshot,{sourceSha}),context=identityReviewContext(snapshot,draft);
  const skeleton={formatVersion:1,policyVersion:IDENTITY_CONTEXT_POLICY,contextDigest:context.contextDigest,plan:draft};
  if(proposal!==null&&proposal!==undefined) {
    if(!object(proposal)||Object.keys(proposal).length!==4||Object.keys(skeleton).some(key=>!Object.hasOwn(proposal,key)))fail('IDENTITY_PROPOSAL_INVALID');
    if(proposal.formatVersion!==1||proposal.policyVersion!==IDENTITY_CONTEXT_POLICY||proposal.contextDigest!==context.contextDigest)fail('IDENTITY_DISPLAY_OBSERVATION_CHANGED');
  }
  const selected=proposal??skeleton,checked=checkLegacyMappingPlan(snapshot,selected.plan,{sourceSha});
  const report={...checked,displayContextValidated:true,contextDigest:context.contextDigest,
    counts:{...checked.counts,withLabel:context.records.filter(row=>row.label).length,
      withIdCandidate:context.records.filter(row=>row.idCandidateRefs.length).length,withNameCandidate:context.records.filter(row=>row.nameCandidateRefs.length).length,
      duplicateSourceNameGroups:context.duplicateSources.length,duplicateTargetNameGroups:context.duplicateTargets.length,
      missingDeclaredScope:context.records.filter(row=>row.kind!=='organization'&&!row.declaredScope.length).length}};
  return {proposal:selected,context,report};
}
