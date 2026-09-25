import assert from 'node:assert/strict';
import pg from 'pg';
import { authorizeS92DisposableDatabase, assertS92ClientSocketIdentity, assertS92RuntimeDatabaseIdentity, S92_DB_FIXTURE } from '../seed-s92-e2e-db.mjs';
export const REPORT_ACCEPTANCE = Object.freeze({messageId:'s11e2e_report_message',conversationId:'s11e2e_report_conversation',workerId:'s11e2e_report_worker',displayName:'Parte vinculado de ensayo'});
export async function openAuthenticatedMessageReportFixture(fixture, environment=process.env){
 const target=authorizeS92DisposableDatabase(environment),projectId=fixture.primary.project.id,organizationId=fixture.primary.databaseOrganizationId;
 assert.equal(organizationId,S92_DB_FIXTURE.organizations.tenantA.id);assert.equal(projectId,S92_DB_FIXTURE.projects.primary.id);
 const db=new pg.Client({connectionString:target.databaseUrl,statement_timeout:10000,connectionTimeoutMillis:5000});
 try{
  await db.connect();assertS92ClientSocketIdentity(db.connection.stream,target.port);const identity=await db.query('SELECT current_database() AS database_name, inet_server_port() AS server_port');assertS92RuntimeDatabaseIdentity(identity.rows[0]);
  const project=await db.query('SELECT id,"organizationId",metadata FROM "Project" WHERE id=$1',[projectId]);assert.equal(project.rowCount,1);assert.equal(project.rows[0].organizationId,organizationId);assert.equal(project.rows[0].metadata?.synthetic,true);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "WhatsAppConnection" WHERE "projectId"=$1',[projectId])).rows[0].n,0);
  const now=new Date();await db.query('BEGIN');
  await db.query(`INSERT INTO "Worker" (id,"organizationId","projectId",name,active,"updatedAt") VALUES ($1,$2,$3,$4,true,$5)`,[REPORT_ACCEPTANCE.workerId,organizationId,projectId,'Persona de ensayo de partes',now]);
  await db.query(`INSERT INTO "Conversation" (id,"projectId",channel,"externalId","displayName","updatedAt") VALUES ($1,$2,'whatsapp',$3,$4,$5)`,[REPORT_ACCEPTANCE.conversationId,projectId,'meta:5493333333333',REPORT_ACCEPTANCE.displayName,now]);
  await db.query(`INSERT INTO "Message" (id,"conversationId",direction,kind,"externalId",body,metadata,"createdAt","sentAt") VALUES ($1,$2,'INBOUND','TEXT',$3,$4,$5::jsonb,$6,$6)`,[REPORT_ACCEPTANCE.messageId,REPORT_ACCEPTANCE.conversationId,'wamid.synthetic.report.acceptance','Faltan materiales para finalizar el muro del frente norte.',JSON.stringify({provider:'meta',authorized:true,workerId:REPORT_ACCEPTANCE.workerId}),now]);
  await db.query('COMMIT');
  async function snapshot(){return{messages:(await db.query('SELECT * FROM "Message" WHERE "conversationId"=$1 ORDER BY id',[REPORT_ACCEPTANCE.conversationId])).rows,logs:(await db.query('SELECT id,"taskId",status,revision FROM "DailyLog" WHERE "authorWorkerId"=$1 ORDER BY id',[REPORT_ACCEPTANCE.workerId])).rows,audits:(await db.query('SELECT id,metadata FROM "AuditLog" WHERE "organizationId"=$1 AND metadata->>\'messageId\'=$2 ORDER BY id',[organizationId,REPORT_ACCEPTANCE.messageId])).rows,task:(await db.query('SELECT id,revision FROM "Task" WHERE id=$1 AND "projectId"=$2',[fixture.primary.tasks.measured.id,projectId])).rows};}
  return{snapshot,close:()=>db.end()};
 }catch(error){await db.query('ROLLBACK').catch(()=>{});await db.end().catch(()=>{});throw error;}
}
