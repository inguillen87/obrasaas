import { createFlowReplyFixture } from './flow-reply-fixture.js';
import { historyScope, HISTORY_NOW } from './flow-history-fixture.js';
import { operationalIncidentIdForEvent } from '../../src/lib/whatsapp/obra-policy.js';
import { buildFlowIncidentReceipt } from '../../src/lib/whatsapp/flow-incident-receipt.js';
export function createFlowIncidentFixture() {
  const f=createFlowReplyFixture();
  const incident={id:operationalIncidentIdForEvent(f.session.consumedExternalId),title:'PRIVATE_TITLE',description:'PRIVATE_CLINICAL_DESCRIPTION',reporter:'PRIVATE_PERSON',type:'critical',sensitivity:'restricted',metadata:{kind:'whatsapp-flow-incident',sourceContentRestricted:true,detailRestricted:true,workArea:'PRIVATE_AREA'},evidence:{url:'https://private.test/file'}};
  f.reply.metadata.flowIncidentReceipt=buildFlowIncidentReceipt(incident,f.session.consumedExternalId,f.session);
  const snapshot={projectId:historyScope.projectId,version:3,updatedAt:new Date(HISTORY_NOW.getTime()-500),state:{incidents:[incident],private:'PRIVATE_STATE'}};
  f.prisma.projectSnapshot={findFirst:async args=>{f.calls.push({model:'snapshot',args:structuredClone(args)});return args.where.projectId===historyScope.projectId&&args.where.project.organizationId===historyScope.organizationId?structuredClone(snapshot):null;}};
  return {...f,incident,snapshot};
}
