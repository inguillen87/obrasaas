// SOURCE PROPOSAL ONLY. No Node, app, provider, browser or Production run yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import {identityAccountReturnPath,identitySignInPath,identitySignUpPath,identityWorkspaceProjectHint} from '../src/lib/identity-return-path.mjs';
import {safeRecoverySignInPath} from '../src/lib/session-recovery.mjs';
import {workspaceLocationView,workspaceViewAllowed} from '../src/app/(identity)/cuenta/workspace-view-routing.mjs';
const routes=[identityAccountReturnPath,identitySignInPath,identitySignUpPath],paths=['/cuenta','/sign-in','/sign-up'],work='project-synthetic_419';
test('schedule destinations reject ambiguous sections projects invitation shadows and encoded fragments',()=>{
 const participant='invite_'+'a'.repeat(32),plan='plan_draft_'+'c'.repeat(64);
 const queries=[
  {seccion:'cronograma'},{seccion:'cronograma',obra:''},{seccion:['cronograma','cronograma'],obra:work},{seccion:'cronograma',obra:[work,work]},
  new URLSearchParams('seccion=cronograma&seccion=cronograma&obra='+work),new URLSearchParams('seccion=cronograma&obra='+work+'&obra='+work),
  {seccion:'cronograma\n',obra:work},{seccion:'https://foreign.invalid',obra:work},{seccion:'',obra:work},Object.create({seccion:'cronograma',obra:work}),
  {seccion:'cronograma',obra:work,participar:''},{seccion:'cronograma',obra:work,oficina:'bad'},{seccion:'cronograma',obra:work,plan:'bad'},
  {seccion:'cronograma',obra:work,participar:[participant,participant]},{seccion:'cronograma',obra:work,plan:[plan,plan]},
  ...['//foreign.invalid','https://foreign.invalid',work+'#schedule-gantt-title',work+'&scope=ADMIN',work+'\n','project%23schedule-gantt-title','project%255F419'].map(obra=>({seccion:'cronograma',obra})),
  new URLSearchParams('seccion=cronograma&obra='+work+'%23schedule-gantt-title'),
 ];
 for(const query of queries)routes.forEach((route,index)=>assert.equal(route(query),paths[index]));
});
test('invitation and exact paired-plan priority remains unchanged and carries no schedule or authority extras',()=>{
 const participant='invite_'+'a'.repeat(32),office='office_invite_'+'b'.repeat(32),plan='plan_draft_'+'c'.repeat(64);
 for(const [extra,tail] of [[{participar:participant},'?participar='+participant],[{oficina:office},'?oficina='+office],[{plan},'?obra='+work+'&plan='+plan]]){
  routes.forEach((route,index)=>assert.equal(route({seccion:'cronograma',obra:work,scope:'private',role:'ADMIN',token:'synthetic',operationId:'00000000-0000-4000-8000-000000000419',redirect_url:'https://foreign.invalid',...extra}),paths[index]+tail));
 }
 routes.forEach((route,index)=>assert.equal(route({seccion:'cronograma',obra:work,participar:participant,oficina:office}),paths[index]));
});
test('recovery accepts only exact canonical local strings and rejects open redirects extra keys duplicates and encoding aliases',()=>{
 const unsafe=[
  'https://foreign.invalid/sign-in','//foreign.invalid/sign-in','https://obrasaas.com/sign-in?obra='+work,'javascript:alert(1)','/foo/../sign-in?obra='+work,
  '/sign-in?redirect_url=https://foreign.invalid','/sign-in?seccion=cronograma&obra='+work+'&scope=ADMIN','/sign-in?seccion=cronograma&obra='+work+'&operationId=00000000-0000-4000-8000-000000000419',
  '/sign-in?seccion=cronograma&obra='+work+'&obra='+work,'/sign-in?seccion=cronograma&seccion=cronograma&obra='+work,
  '/sign-in?obra='+work+'&seccion=cronograma','/sign-in?seccion=%63ronograma&obra='+work,'/sign-in?seccion=cronograma&obra=project%5F419',
  '/sign-in?seccion=cronograma&obra='+work+'#schedule-gantt-title','/sign-in?seccion=cronograma&obra='+work+'#%73chedule-gantt-title','/sign-in?obra='+work+'%23schedule-gantt-title',
  '/SIGN-IN?obra='+work,'/sign-in\\foreign','/sign-in?obra='+work+'\r\n',null,{},['/sign-in'],
 ];
 for(const value of unsafe)assert.equal(safeRecoverySignInPath(value),'/sign-in');
});
test('normal single decoding is allowed by the builder but never promotes a project hint into capability or a caller-selected fragment',()=>{
 const decoded=new URLSearchParams('seccion=cronograma&obra=project%5F419');assert.equal(identityWorkspaceProjectHint(decoded),'project_419');assert.equal(identityAccountReturnPath(decoded),'/cuenta?seccion=cronograma&obra=project_419');
 assert.equal(identityWorkspaceProjectHint(new URLSearchParams('obra=project%255F419')),'');
 assert.deepEqual(workspaceLocationView('/cuenta#%73chedule-gantt-title'),{section:'inicio',target:'workspace-home-title'});
 assert.equal(workspaceViewAllowed('cronograma',{role:'ADMIN',projectAvailable:false}),false);assert.equal(workspaceViewAllowed('cronograma',{role:'WORKER',projectAvailable:false}),false);
 for(const section of ['numero','accesos','clientes','nueva-obra'])assert.equal(workspaceViewAllowed(section,{role:'WORKER',projectAvailable:true,canManageIntegrations:false}),false);
});
