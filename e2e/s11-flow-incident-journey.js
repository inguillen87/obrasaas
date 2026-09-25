import { expect,test } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { sameOriginJson,requireS92DisposableTarget } from './s92-fixture.js';
import { openAuthenticatedFlowIncidentFixture } from '../scripts/lib/s11-flow-incident-fixture.mjs';
import { flowIncidentMatches } from '../src/lib/whatsapp/flow-incident-policy.js';
export async function verifyAuthenticatedFlowIncident({fixture,sessions,baseURL}){
 requireS92DisposableTarget(baseURL);const db=await openAuthenticatedFlowIncidentFixture(fixture),scope={...db.scope,conversationId:db.conversationId};
 const headers={'X-ObraSaaS-Organization':scope.organizationId,'X-ObraSaaS-Project':scope.projectId};
 const path=(row,projectId=scope.projectId)=>'/api/whatsapp/inbox/'+scope.conversationId+'/proactive-flows?'+new URLSearchParams({projectId,mode:'incident',messageId:row.sourceId});
 const admin=sessions.admin.page,before=await db.snapshot(),methods=[],cases=[];
 const observe=r=>{if(new URL(r.url()).pathname.includes(scope.conversationId+'/proactive-flows'))methods.push(r.method());};admin.on('request',observe);
 try{
  await test.step('S11-INCIDENT: real engine receipt resolves original record, legacy stays unlinked',async()=>{
   const r=await sameOriginJson(admin,path(db.rows[0]),{headers});expect(r.status).toBe(200);expect(flowIncidentMatches(r.payload,scope,db.rows[0].sourceId)).toBe(true);
   expect(r.payload).toMatchObject({state:'available',incident:{id:db.rows[0].incidentId,severity:'critical',status:'unclassified'}});
   expect(r.headers['cache-control']).toContain('private, no-store');
   for(const secret of ['PRIVATE_INCIDENT_CANARY','wamid.','workerId','recipient','tokenSha256','description'])expect(JSON.stringify(r.payload)).not.toContain(secret);
   const legacy=await sameOriginJson(admin,path(db.rows[1]),{headers});expect(legacy.status).toBe(200);expect(legacy.payload).toMatchObject({state:'unlinked',incident:null});expect(await db.snapshot()).toEqual(before);cases.push('engine-created-record-and-legacy-without-backfill');
  });
  await test.step('S11-INCIDENT: real tenant roles and client selector boundaries',async()=>{
   expect((await sameOriginJson(sessions.auditor.page,path(db.rows[0]),{headers})).status).toBe(403);
   expect((await sameOriginJson(sessions.outsider.page,path(db.rows[0]),{headers})).status).toBe(409);
   const foreignHeaders={'X-ObraSaaS-Organization':fixture.otherTenant.databaseOrganizationId,'X-ObraSaaS-Project':fixture.otherTenant.anchorProjectId};
   expect((await sameOriginJson(sessions.outsider.page,path(db.rows[0],fixture.otherTenant.anchorProjectId),{headers:foreignHeaders})).status).toBe(404);
   const anon=await sameOriginJson(sessions.anonymous.page,path(db.rows[0]),{headers});expect(anon.status).toBe(404);expect(anon.payload).toBeNull();
   expect((await sameOriginJson(admin,path(db.rows[0]))).status).toBe(409);
   expect((await sameOriginJson(admin,path(db.rows[0])+'&incidentId='+db.rows[0].incidentId,{headers})).status).toBe(400);expect(await db.snapshot()).toEqual(before);cases.push('actual-permissions-other-tenant-anonymous-and-no-record-selector');
  });
  await test.step('S11-INCIDENT: mobile inbox recovers the incident after reload without writes',async()=>{
   await admin.setViewportSize({width:390,height:844});await admin.goto('/dashboard/inbox');await clerk.loaded({page:admin});
   const open=async()=>{
    await admin.getByRole('button',{name:/Incidencia vinculada de ensayo/}).click();
    const history=admin.getByRole('region',{name:'Seguimiento de formularios'});await admin.getByRole('button',{name:'Abrir seguimiento de formularios',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(2);
    const row=history.getByRole('listitem').filter({hasText:db.rows[0].sourceId});await row.getByRole('button',{name:'Consultar respuesta vinculada',exact:true}).click();await row.getByRole('button',{name:'Consultar incidencia vinculada',exact:true}).click();
    await expect(row.getByText(db.rows[0].incidentId,{exact:true})).toBeVisible();await expect(row.getByText('Sin estado de resolución registrado',{exact:true})).toBeVisible();
    await expect(row.getByRole('link',{name:'Abrir tablero de obra',exact:true})).toHaveAttribute('href','/dashboard');expect(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   };
   await open();await admin.reload();await clerk.loaded({page:admin});await open();expect(methods.every(m=>m==='GET')).toBe(true);expect(await db.snapshot()).toEqual(before);cases.push('mobile-reply-incident-and-reload-without-mutation');
  });
  console.log('S11_INCIDENT_AUTHENTICATED '+JSON.stringify({status:'PASS',cases,clerk:'development-real-sessions',database:'loopback-disposable',engineGeneratedReceipt:true,fullWebhookIngress:false,realMetaMessages:0}));
 }finally{admin.off('request',observe);await db.close();}
}
