// SOURCE PROPOSAL ONLY. These imports require a genuine composed physical tree.
// No provider, database, browser or authentication session is simulated here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planMetaFieldConversation} from '../src/lib/meta-field-conversation.mjs';
import {identityAccountReturnPath,identitySignInPath,identitySignUpPath,identityWorkspaceProjectHint} from '../src/lib/identity-return-path.mjs';
import {safeRecoverySignInPath} from '../src/lib/session-recovery.mjs';
import {workspaceLocationView,workspaceViewAllowed} from '../src/app/(identity)/cuenta/workspace-view-routing.mjs';

const origin='https://obrasaas.com',projectId='00000000-0000-4000-8000-000000000419';
const facts={projectId,projectName:'Obra sintética',workerId:'worker-synthetic',attendanceOnly:false,permissions:{attendance:false,report:false},tasks:[],sectors:[],evidence:[],proposals:[],latest:null};
function authNavigation(start){
 const signIn=identitySignInPath(start.searchParams),recovered=safeRecoverySignInPath(signIn);
 assert.equal(recovered,signIn,'The real SessionRecovery gate must retain the canonical destination');
 const signUp=new URL(identitySignUpPath(new URL(recovered,origin).searchParams),origin);
 const account=new URL(identityAccountReturnPath(signUp.searchParams),origin);
 assert.equal(identityAccountReturnPath(account.searchParams),account.pathname+account.search);
 return {signIn,recovered,signUp,account};
}
test('the real GANTT builder and pure exported authentication-return chain retain the explicit schedule destination',()=>{
 const plan=planMetaFieldConversation({message:{type:'text',text:{body:'GANTT'}},state:null,eventId:'synthetic-navigation-419',facts,now:new Date(0)});
 const links=plan.reply.body.match(/https:\/\/obrasaas\.com\/cuenta[^\s]+/g)||[];assert.equal(links.length,1);
 const start=new URL(links[0]);assert.equal(start.pathname+start.search,'/cuenta?seccion=cronograma&obra='+projectId);assert.equal(start.hash,'#schedule-gantt-title');
 assert.deepEqual(workspaceLocationView(start.href),{section:'cronograma',target:'schedule-gantt-title'});
 const {account}=authNavigation(start);assert.equal(account.search,'?seccion=cronograma&obra='+projectId);assert.equal(identityWorkspaceProjectHint(account.searchParams),projectId);assert.deepEqual(workspaceLocationView(account.href),{section:'cronograma',target:'schedule-title'});
 for(const key of ['command','media','planImport'])assert.equal(plan[key],undefined);
});
test('old authenticated Gantt fragments keep their exact fixed presentation alias',()=>{
 const old=new URL('/cuenta?obra='+projectId+'#schedule-gantt-title',origin);
 assert.deepEqual(workspaceLocationView(old.href),{section:'cronograma',target:'schedule-gantt-title'});
 assert.equal(workspaceViewAllowed('cronograma',{role:'ADMIN',projectAvailable:false}),false);
});
test('an old anonymous worksite hint returns to summary without inventing the fragment lost by the server',()=>{
 const old=new URL('/cuenta?obra='+projectId+'#schedule-gantt-title',origin),{account}=authNavigation(old);
 assert.equal(account.search,'?obra='+projectId);assert.equal(account.hash,'');assert.equal(identityWorkspaceProjectHint(account.searchParams),projectId);
 assert.deepEqual(workspaceLocationView(account.href),{section:'inicio',target:'workspace-home-title'});
});
test('all existing closed authentication destinations survive the recovery helper without introducing a generic URL field',()=>{
 const participant='invite_'+'a'.repeat(32),office='office_invite_'+'b'.repeat(32),plan='plan_draft_'+'c'.repeat(64);
 for(const query of [{participar:participant},{oficina:office},{obra:projectId,plan},{seccion:'identidad'},{seccion:'identidad',obra:projectId},{seccion:'actividad',obra:projectId},{seccion:'cronograma',obra:projectId},{obra:projectId}]){
  const signIn=identitySignInPath(query);assert.equal(safeRecoverySignInPath(signIn),signIn);assert.equal(new URL(signIn,origin).origin,origin);
 }
});
