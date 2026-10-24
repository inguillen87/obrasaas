import {WorkspaceError,workspaceId} from './workspace-policy.mjs';
import {readConsumptionEvidenceCatalog} from './consumption-evidence-catalog.mjs';

const unavailable=()=>{throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);};
function selectedChoice(state,message){
 const raw=message?.type==='interactive'?(message.interactive?.list_reply?.id||message.interactive?.button_reply?.id):null,match=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(raw||'');
 return match&&match[1]===state?.nonce?state.choices?.[Number(match[2])]?.value:null;
}

// The verified bridge still owns current principal/lease/task/sector authority.
// Its internal retained-audio read and share locks keep their prior defaults.
export async function readMetaConsumptionEvidenceCatalog(client,{organizationId,projectId,workerId,actorId,state,message,tasks,sectors}){
 if([organizationId,projectId,workerId,actorId,state?.sectorId].some(value=>!workspaceId(value))||state.taskId!==null&&(!workspaceId(state.taskId)||!tasks?.some(task=>task.id===state.taskId))||!sectors?.some(sector=>sector.id===state.sectorId))unavailable();
 const ids=state.evidenceIds||[];if(!Array.isArray(ids)||ids.length>10||new Set(ids).size!==ids.length||ids.some(value=>!workspaceId(value)))unavailable();
 const choice=selectedChoice(state,message),page=state.step==='CONSUMPTION_EVIDENCE'?state.consumptionEvidencePage:null;
 const selected=state.step==='CONSUMPTION_EVIDENCE'&&choice&&!['NEXT_CONSUMPTION_EVIDENCE','PREVIOUS_CONSUMPTION_EVIDENCE','CONTINUE_CONSUMPTION','CLEAR_CONSUMPTION_EVIDENCE'].includes(choice)?[choice]:[];
 const retainedIds=[...ids,...selected,state.consumptionVoiceCandidate?.source?.evidenceId,state.consumptionVoice?.source?.evidenceId].filter(value=>value!==undefined&&value!==null);
 return readConsumptionEvidenceCatalog(client,{organizationId,projectId,workerId,actorId,taskId:state.taskId,sectorId:state.sectorId,page:page||null,direction:page?choice==='NEXT_CONSUMPTION_EVIDENCE'?'NEXT':choice==='PREVIOUS_CONSUMPTION_EVIDENCE'?'PREVIOUS':'REFRESH':'FIRST',retainedIds});
}
