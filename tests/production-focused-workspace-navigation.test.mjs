import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceLocationView,workspaceViewAllowed,workspacePendingProjectSection} from '../src/app/(identity)/cuenta/workspace-view-routing.mjs';
import {identityAccountReturnPath,identitySignInPath,identitySignUpPath} from '../src/lib/identity-return-path.mjs';

test('a WhatsApp identity link selects the presentation instead of the general dashboard',()=>{
 assert.deepEqual(workspaceLocationView('/cuenta?seccion=identidad&obra=project-a#participant-title'),{section:'identidad',target:'participant-title'});
 assert.deepEqual(workspaceLocationView('/cuenta?seccion=identidad'),{section:'identidad',target:'participant-title'});
});
test('normal fragments take precedence when a person leaves the identity deep link',()=>{
 assert.deepEqual(workspaceLocationView('/cuenta?seccion=identidad#inventory-title'),{section:'materiales',target:'inventory-title'});
 assert.deepEqual(workspaceLocationView('/cuenta#plan-import-title'),{section:'cronograma',target:'plan-import-title'});
 assert.deepEqual(workspaceLocationView('/cuenta#schedule-edit-title'),{section:'cronograma',target:'schedule-edit-title'});
});
test('unknown sections or fragments return to the summary without interpreting external instructions',()=>{
 for(const value of ['/cuenta?seccion=administrador','/cuenta?seccion=https://evil.invalid','/cuenta#consentir','/cuenta?redirect_url=https://evil.invalid']){
  assert.deepEqual(workspaceLocationView(value),{section:'inicio',target:'workspace-home-title'});
 }
});
test('display routes do not expand the role capability set',()=>{
 for(const section of ['plan','numero','plantillas','clientes','piloto','accesos','nueva-obra']){
  assert.equal(workspaceViewAllowed(section,{role:'WORKER',canManageIntegrations:false}),false);
  assert.equal(workspaceViewAllowed(section,{role:'DIRECTOR',canManageIntegrations:true}),false);
  assert.equal(workspaceViewAllowed(section,{role:'ADMIN'}),true);
 }
 assert.equal(workspaceViewAllowed('compras',{role:'WORKER'}),false);
 assert.equal(workspaceViewAllowed('compras',{role:'DIRECTOR',canManageIntegrations:true}),true);
 assert.equal(workspaceViewAllowed('identidad',{role:'WORKER'}),true);
 assert.equal(workspaceViewAllowed('preparacion',{role:'DIRECTOR'}),true);
 assert.equal(workspaceViewAllowed('unknown',{role:'ADMIN',canManageIntegrations:true}),false);
});
test('the identity destination and project hint survive each normal authentication entry',()=>{
 const params=new URLSearchParams({seccion:'identidad',obra:'project-a'});
 assert.equal(identityAccountReturnPath(params),'/cuenta?seccion=identidad&obra=project-a');
 assert.equal(identitySignInPath(params),'/sign-in?seccion=identidad&obra=project-a');
 assert.equal(identitySignUpPath(params),'/sign-up?seccion=identidad&obra=project-a');
});
test('untrusted duplicate hints and invitation priority retain the established return-path boundary',()=>{
 assert.equal(identityAccountReturnPath(new URLSearchParams('seccion=identidad&seccion=identidad&obra=project-a')),'/cuenta');
 assert.equal(identityAccountReturnPath(new URLSearchParams('seccion=identidad&obra=https://evil.invalid')),'/cuenta?seccion=identidad');
 const invite='invite_'+'a'.repeat(32);
 assert.equal(identityAccountReturnPath(new URLSearchParams({participar:invite,seccion:'identidad',obra:'project-a'})),'/cuenta?participar='+invite);
 assert.equal(identitySignInPath(new URLSearchParams({seccion:'plan',obra:'project-a'})),'/sign-in');
});

test('company plan and recovery stay available before a project is selected',()=>{
 for(const section of ['inicio','recuperacion','plan'])assert.equal(workspaceViewAllowed(section,{role:'ADMIN',projectAvailable:false}),true);
 for(const section of ['identidad','cronograma','actividad','numero','accesos','compras'])assert.equal(workspaceViewAllowed(section,{role:'ADMIN',canManageIntegrations:true,projectAvailable:false}),false);
 assert.equal(workspaceViewAllowed('plan',{role:'WORKER',projectAvailable:false}),false);
});

test('a current private presentation admits only the two self-service destinations without operation',()=>{
 const capability={role:'WORKER',projectAvailable:false,privatePresentationAvailable:true};
 for(const section of ['identidad','mi-whatsapp'])assert.equal(workspaceViewAllowed(section,capability),true);
 for(const section of ['cronograma','actividad','materiales','compras','numero','bandeja','preparacion','nueva-obra','clientes','accesos'])assert.equal(workspaceViewAllowed(section,{...capability,canManageIntegrations:true}),false);
 for(const privatePresentationAvailable of [false,undefined,null,'true',1])for(const section of ['identidad','mi-whatsapp'])assert.equal(workspaceViewAllowed(section,{role:'WORKER',projectAvailable:false,privatePresentationAvailable}),false);
});
test('an identity entry without an open obra names only the pending choice for one or more authorized obras',()=>{
 const requested=location=>workspaceLocationView(location).section,base={projectAvailable:false,privatePresentationAvailable:false,officeReviewOnly:false,loading:false};
 for(const location of ['/cuenta?seccion=identidad#participant-title','/cuenta?seccion=identidad','/cuenta#participant-title','/cuenta?seccion=identidad&obra=foreign-project#participant-title'])for(const projectCount of [1,2,100])assert.equal(workspacePendingProjectSection(requested(location),{...base,projectCount}),'identidad');
 assert.equal(workspacePendingProjectSection(requested('/cuenta?seccion=identidad#participant-title'),{...base,projectCount:0}),null);
 for(const location of ['/cuenta','/cuenta?seccion=identidad#inventory-title','/cuenta?seccion=mi-whatsapp','/cuenta#worker-channel-title','/cuenta?seccion=plan','/cuenta?seccion=desconocida'])assert.equal(workspacePendingProjectSection(requested(location),{...base,projectCount:2}),null);
});
test('the pending identity choice never applies over an open obra, a private presentation, office review or a read in progress',()=>{
 const base={projectAvailable:false,privatePresentationAvailable:false,officeReviewOnly:false,loading:false,projectCount:2};
 for(const change of [{projectAvailable:true},{privatePresentationAvailable:true},{officeReviewOnly:true},{loading:true},{projectCount:-1},{projectCount:1.5},{projectCount:'2'},{projectCount:undefined}])assert.equal(workspacePendingProjectSection('identidad',{...base,...change}),null);
 assert.equal(workspacePendingProjectSection('identidad'),null);assert.equal(workspacePendingProjectSection(undefined,base),null);
 // Presentation only: the result is a section name, never an obra ID to open or remember.
 assert.equal(workspacePendingProjectSection('identidad',base),'identidad');
});
