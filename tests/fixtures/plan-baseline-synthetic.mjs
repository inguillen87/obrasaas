import {randomUUID} from 'node:crypto';
import {createWorkspaceStore} from '../../src/lib/workspace-store.mjs';
import {createPlanBaseline} from '../../src/lib/plan-baseline-store.mjs';
import {scopeStamp,digest} from '../../src/lib/workspace-policy.mjs';
import {decodePlanSource,PLAN_IMPORT_CYP_CURVE_CONSENT,PLAN_IMPORT_MONTHLY_CURVE_CONSENT} from '../../src/lib/plan-import-policy.mjs';
import {extractCypCurveOoxml,extractMonthlyCurveOoxml} from '../../src/lib/plan-import-ooxml.mjs';
import {cypCurveFixture} from './plan-import-cyp-curve-synthetic.mjs';
import {monthlyCurveFixture} from './plan-import-monthly-curve-synthetic.mjs';
import {storeHarness,projectId,organizationId,context as importContext,session as importSession} from './plan-import-store-synthetic.mjs';

export {projectId,organizationId};
export const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Synthetic',organizationId:'org_Synthetic',organizationRole:'org:admin'};
const clone=value=>structuredClone(value);
// Receipts come from the actual import EDIT/APPLY store. SQL/Clerk identities are
// synthetic; this adapter makes no native locking or customer-acceptance claim.
export async function appliedBaselineSource(index=1,profile='CYP_PARTIDAS_CURVE'){
 const monthly=profile==='MONTHLY_RUBROS_CURVE',mime=monthly?'application/vnd.ms-excel.sheet.macroenabled.12':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bytes=monthly?monthlyCurveFixture():cypCurveFixture({partidas:4}),source=decodePlanSource(bytes,mime),extraction=await (monthly?extractMonthlyCurveOoxml(bytes,mime):extractCypCurveOoxml(bytes,mime)),h=storeHarness({tasks:[]});
 const draftId='plan_draft_'+digest(['baseline-fixture',index]),rows=extraction.rows.map(row=>({...row,startsOn:'2026-10-13',endsOn:'2026-10-21',title:row.title.slice(0,160),uncertainty:'',...(row.code?{sourceIssueReviewed:true}:{})}));
 h.addDraft(extraction,source,{id:draftId,consent:monthly?PLAN_IMPORT_MONTHLY_CURVE_CONSENT:PLAN_IMPORT_CYP_CURVE_CONSENT});
 const body={...importContext,operationId:randomUUID(),draftId,expectedRevision:3,action:'EDIT',rows,reason:'Synthetic independent source review'},edit=await h.imports.decide(importSession,body),applied=await h.imports.decide(importSession,{...body,operationId:randomUUID(),expectedRevision:edit.draft.revision,action:'APPLY'});
 return {draft:applied.draft,logs:h.logs().map(row=>({...row,entityId:row.projectId})),tasks:h.tasks(),curve:clone(extraction.spreadsheet.curve)};
}
export async function planBaselineHarness({sources=1,profile='CYP_PARTIDAS_CURVE'}={}){
 const seeded=await Promise.all(Array.from({length:sources},(_,i)=>appliedBaselineSource(i+1,profile))),logs=new Map(seeded.flatMap(v=>v.logs).map(row=>[row.id,clone(row)]));
 const member={actorId:'actor-synthetic',membershipId:'membership-baseline',organizationId,organizationName:'Synthetic company',role:'ADMIN',officeReviewOnly:false};
 let membershipActive=true,projectActive=true,projectOrganization=organizationId,commitMode=null,failActiveWrite=false,afterQuery=null;
 const calls={sql:[],released:0,mutations:0},data=rows=>({rows:clone(rows)});
 const connect=async()=>{
  let tx=null;
  return {release(){calls.released++;},async query(raw,args=[]){
   const sql=raw.replace(/\s+/g,' ').trim();calls.sql.push(sql);
   if(sql.startsWith('BEGIN')){tx=clone(logs);return data([]);}
   if(sql.startsWith('SET LOCAL'))return data([]);
   if(sql==='COMMIT'){
    const mode=commitMode;commitMode=null;if(mode==='ROLLBACK')throw Error('Synthetic commit before durability');
    logs.clear();for(const [key,value] of tx)logs.set(key,value);tx=null;if(mode==='ACK_LOST')throw Error('Synthetic commit acknowledgement lost');return data([]);
   }
   if(sql==='ROLLBACK'){tx=null;return data([]);}
   let result;
   if(sql.includes('FROM public."PlatformUser"'))result=data(membershipActive&&args[0]===session.userId&&args[1]===session.organizationId&&args[2]===session.organizationRole?[member]:[]);
   else if(sql.includes('public."Worker"')||sql.includes("action='participant.operation.recorded'"))result=data([]);
   else if(sql.includes('FROM public."ProjectMembership"'))result=data([{id:'assignment-synthetic'}]);
   else if(sql.includes('FROM public."Project"'))result=data(projectActive&&args[0]===projectId&&args[1]===projectOrganization?[{id:projectId,name:'Synthetic project',status:'ACTIVE',metadata:{}}]:[]);
   else if(sql.includes('FROM public."AuditLog" d')){
    let rows=[...tx.values()].filter(row=>row.action==='plan.import.draft'&&row.organizationId===args[0]&&row.entityId===args[1]);
    if(sql.includes('d.id=$3'))rows=rows.filter(row=>row.id===args[2]);
    else rows=rows.filter(row=>row.metadata.status==='APPLIED'&&([3,4].includes(row.metadata.analysis?.spreadsheet?.version)||['plan-spreadsheet-monthly-curve-v3','plan-spreadsheet-cyp-curve-v4'].includes(row.metadata.consent?.version))&&row.id>args[2]).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,11);
    result=data(rows.map(row=>{const found=tx.get(row.metadata.decision?.receiptId),receipt=found?.action==='plan.import.decision'?found:null;return {...row,decisionId:receipt?.id,decisionMetadata:receipt?.metadata,decisionOrganizationId:receipt?.organizationId,decisionEntityId:receipt?.entityId,decisionActorId:receipt?.actorId};}));
   }else if(sql.startsWith('SELECT')&&sql.includes('public."AuditLog"')){
    const action=sql.match(/action='([^']+)'/)?.[1],row=tx.get(args[0]);result=data(row&&(!action||row.action===action)?[row]:[]);
   }else if(sql.startsWith('INSERT INTO public."AuditLog"')){
    const action=sql.match(/'plan\.baseline\.[a-z]+'/)?.[0].slice(1,-1),[id,org,actor,entity,metadata,expectedRevision]=args,prior=tx.get(id);
    if(action==='plan.baseline.active'&&failActiveWrite)throw Error('Synthetic active write failure');
    if(prior&&(action!=='plan.baseline.active'||prior.action!==action||prior.organizationId!==org||prior.entityId!==entity||prior.metadata.revision!==expectedRevision))return data([]);
    calls.mutations++;tx.set(id,{id,organizationId:org,actorId:actor,entityId:entity,action,metadata:JSON.parse(metadata)});result=data([{id}]);
   }else throw Error('Unexpected synthetic SQL: '+sql);
   if(afterQuery)await afterQuery(sql,args,tx);return result;
  }};
 };
 const workspace=createWorkspaceStore({connect}),baselines=createPlanBaseline({workspace}),context=()=>({projectId,scope:scopeStamp(session,member)});
 const input=(index=0,previous=null)=>{const d=seeded[index].draft;return {action:'SELECT',...context(),operationId:randomUUID(),draftId:d.id,draftRevision:d.revision,decisionReceiptId:d.decision.receiptId,sourceSha256:d.source.sha256,expectedBaselineId:previous?.id||null,expectedBaselineRevision:previous?.revision||0,reason:'Explicit approved source selection',confirmed:true};};
 return {baselines,workspace,connect,context,input,seeded,calls,logs:()=>clone([...logs.values()]),changeLog:(id,change)=>change(logs.get(id)),setRole:value=>{member.role=value;},setMembershipActive:value=>{membershipActive=value;},setProjectActive:value=>{projectActive=value;},setProjectOrganization:value=>{projectOrganization=value;},setActor:value=>{member.actorId=value;},setCommitMode:value=>{commitMode=value;},setFailActiveWrite:value=>{failActiveWrite=value;},setAfterQuery:value=>{afterQuery=value;}};
}
