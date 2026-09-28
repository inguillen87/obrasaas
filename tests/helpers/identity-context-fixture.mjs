import {mappingSnapshot} from './legacy-mapping-fixture.mjs';
export function identityContextSnapshot(){
  const snapshot=mappingSnapshot();
  snapshot.displayLabels={
    Organization:snapshot.organizations.map((row,index)=>({id:row.id,label:index?'Otra empresa':'PRIVATE_ORG'})),
    Project:snapshot.projects.map((row,index)=>({id:row.id,label:index?'Otra obra':'PRIVATE_PROJECT'})),
    Worker:snapshot.workers.map((row,index)=>({id:row.id,label:index?'Otra persona':'Operario sintético'})),
    Task:snapshot.tasks.map(row=>({id:row.id,label:'PRIVATE_TASK'})),
  };
  const state=JSON.parse(snapshot.sources[0].stateText);state.workerRegistry[0].name='Operario sintético';
  snapshot.sources[0].stateText=JSON.stringify(state);return snapshot;
}
