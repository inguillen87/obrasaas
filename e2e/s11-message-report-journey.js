import { expect, test } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { sameOriginJson, requireS92DisposableTarget } from './s92-fixture.js';
import { openAuthenticatedMessageReportFixture, REPORT_ACCEPTANCE } from '../scripts/lib/s11-message-report-fixture.mjs';
import { messageReportSourceId, messageReportFingerprint, messageReportPreparationMatches, confirmedMessageReport } from '../src/lib/whatsapp/progress-report-policy.js';
export async function verifyAuthenticatedMessageReport({fixture,sessions,baseURL}){
 requireS92DisposableTarget(baseURL);
 const scope={organizationId:fixture.primary.databaseOrganizationId,projectId:fixture.primary.project.id,conversationId:REPORT_ACCEPTANCE.conversationId,messageId:REPORT_ACCEPTANCE.messageId};
 const headers={'X-ObraSaaS-Organization':scope.organizationId,'X-ObraSaaS-Project':scope.projectId};
 const path='/api/whatsapp/inbox/'+scope.conversationId+'/messages/'+scope.messageId+'/progress-report';
 const admin=sessions.admin.page,db=await openAuthenticatedMessageReportFixture(fixture),before=await db.snapshot(),reportId=await messageReportSourceId(scope);let preparation;
 try{
  await test.step('S11-REPORT: authenticated preparation binds source and denies foreign/anonymous access',async()=>{
   const first=await sameOriginJson(admin,path,{headers});expect(first.status).toBe(200);preparation=first.payload;expect(messageReportPreparationMatches(preparation,{...scope,reportId})).toBe(true);expect(preparation.existing).toBeNull();expect(await db.snapshot()).toEqual(before);
   expect((await sameOriginJson(sessions.outsider.page,path,{headers})).status).toBe(409);
   const foreignHeaders={'X-ObraSaaS-Organization':fixture.otherTenant.databaseOrganizationId,'X-ObraSaaS-Project':fixture.otherTenant.anchorProjectId};
   expect((await sameOriginJson(sessions.outsider.page,path,{headers:foreignHeaders})).status).toBe(404);
   const anonymous=await sameOriginJson(sessions.anonymous.page,path,{headers});expect(anonymous.status).toBe(404);expect(anonymous.payload).toBeNull();
  });
  await test.step('S11-REPORT: real mobile dialog creates only the reviewed draft with exact link',async()=>{
   await admin.setViewportSize({width:390,height:844});await admin.goto('/dashboard/inbox');await clerk.loaded({page:admin});
   await admin.getByRole('button',{name:new RegExp(REPORT_ACCEPTANCE.displayName)}).click();
   await admin.getByRole('button',{name:'Preparar parte desde este mensaje',exact:true}).click();const dialog=admin.getByRole('dialog',{name:'Preparar parte de obra'});
   await dialog.getByRole('button',{name:'Usar este texto como borrador'}).click();await dialog.getByRole('combobox',{name:'Tarea de destino',exact:true}).selectOption(fixture.primary.tasks.measured.id);await dialog.getByRole('textbox',{name:'Título del parte',exact:true}).fill('Parte autenticado de ensayo');await dialog.getByRole('checkbox').check();
   await dialog.getByRole('button',{name:'Crear borrador vinculado a la tarea'}).click();await expect(dialog).toHaveCount(0);await expect(admin.getByRole('link',{name:'Parte registrado · abrir en la bitácora'})).toHaveAttribute('href','/dashboard/progress?taskId='+encodeURIComponent(fixture.primary.tasks.measured.id)+'#daily-log-'+reportId);
   const state=await db.snapshot();expect(state.logs).toHaveLength(1);expect(state.logs[0]).toMatchObject({id:reportId,status:'DRAFT',revision:0});expect(state.audits).toHaveLength(1);expect(state.messages).toEqual(before.messages);expect(state.task).toEqual(before.task);
  });
  await test.step('S11-REPORT: persisted receipt and page reload recover without another creation',async()=>{
   const input={taskId:fixture.primary.tasks.measured.id,title:'Parte autenticado de ensayo',summary:preparation.source.text,sourceVersion:preparation.source.version};
   const expected={...scope,reportId,taskId:input.taskId,sourceVersion:input.sourceVersion,requestFingerprint:await messageReportFingerprint(input)};
   const beforeRead=await db.snapshot(),fresh=await sameOriginJson(admin,path,{headers});expect(fresh.status).toBe(200);
   expect(confirmedMessageReport({context:fresh.payload.context,...fresh.payload.existingReceipt,report:fresh.payload.existing,replayed:true},expected).id).toBe(reportId);
   await admin.reload();await clerk.loaded({page:admin});await admin.getByRole('button',{name:new RegExp(REPORT_ACCEPTANCE.displayName)}).click();await admin.getByRole('button',{name:'Preparar parte desde este mensaje',exact:true}).click();
   const dialog=admin.getByRole('dialog',{name:'Preparar parte de obra'});await expect(dialog.getByRole('link',{name:'Consultar parte registrado'})).toHaveAttribute('href','/dashboard/progress?taskId='+encodeURIComponent(input.taskId)+'#daily-log-'+reportId);
   await dialog.getByRole('button',{name:'Volver a mensajes'}).click();expect(await db.snapshot()).toEqual(beforeRead);
  });
  console.log('S11_REPORT_AUTHENTICATED '+JSON.stringify({status:'PASS',cases:3,clerk:'development-real-session',database:'loopback-disposable',reportsCreated:1,sourceAudits:1,realMessagesSent:0}));
 }finally{await db.close();}
}
