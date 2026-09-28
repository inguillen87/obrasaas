// Synthetic test-only rows. Not imported by production commands.
export const SHA='a'.repeat(40);
export function mappingSnapshot() {
  const state={tenants:[{id:'old-org',name:'PRIVATE_ORG'}],projects:[{id:'old-project',tenantId:'old-org',name:'PRIVATE_PROJECT'}],
    workerRegistry:[{id:'old-worker',projectId:'old-project',tenantId:'old-org',phone:'PRIVATE_PHONE',dni:'PRIVATE_DOCUMENT'}],
    tasks:{'old-task':{projectId:'old-project',tenantId:'old-org',name:'PRIVATE_TASK',amount:'9007199254740993.25'}},
    certifications:[{approved:true,amount:'9007199254740993.25'}],activeProjectId:'project-b'};
  return {readOnlyVerified:true,sources:[{id:'source-private-id',stateText:JSON.stringify(state),messagesText:'[{"text":"PRIVATE_MESSAGE"}]'}],
    organizations:[{id:'org-a'},{id:'org-b'}],projects:[{id:'project-a',organizationId:'org-a'},{id:'project-b',organizationId:'org-b'}],
    workers:[{id:'worker-a',projectId:'project-a',externalId:'old-worker'},{id:'worker-b',projectId:'project-b',externalId:'old-worker'}],
    tasks:[{id:'task-a',projectId:'project-a',externalId:'old-task'}],projectSnapshots:[],migrations:[{name:'baseline',completed:true,rolledBack:false}]};
}
export function editSource(snapshot,mutate) {
  const state=JSON.parse(snapshot.sources[0].stateText);mutate(state);snapshot.sources[0].stateText=JSON.stringify(state);return snapshot;
}
export function fillMappingSelections(plan) {
  const copy=structuredClone(plan);
  for(const row of copy.records) {
    const parentKind=row.kind==='project'?'organization':'project';
    Object.assign(row,{action:'LINK_EXISTING',reason:'DOCUMENTED_MATCH',targetRef:copy.targets.find(target=>target.kind===row.kind&&target.ordinal===1).targetRef,
      parentSourceRef:row.kind==='organization'?null:copy.records.find(parent=>parent.groupRef===row.groupRef&&parent.kind===parentKind).sourceRef});
  }
  return copy;
}
