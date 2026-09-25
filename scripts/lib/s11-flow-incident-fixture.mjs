import assert from 'node:assert/strict';
import pg from 'pg';
import { authorizeS92DisposableDatabase,assertS92ClientSocketIdentity,assertS92RuntimeDatabaseIdentity,S92_DB_FIXTURE } from '../seed-s92-e2e-db.mjs';
import { seedFlowIncidentFixture,flowIncidentFixtureSnapshot } from './flow-incident-fixture.mjs';
export async function openAuthenticatedFlowIncidentFixture(fixture,environment=process.env){
 const target=authorizeS92DisposableDatabase(environment),scope={organizationId:fixture.primary.databaseOrganizationId,projectId:fixture.primary.project.id};
 assert.equal(scope.organizationId,S92_DB_FIXTURE.organizations.tenantA.id);assert.equal(scope.projectId,S92_DB_FIXTURE.projects.primary.id);
 const identity=new pg.Client({connectionString:target.databaseUrl,statement_timeout:10000,connectionTimeoutMillis:5000});let db;
 try{
  await identity.connect();assertS92ClientSocketIdentity(identity.connection.stream,target.port);assertS92RuntimeDatabaseIdentity((await identity.query('SELECT current_database() AS database_name, inet_server_port() AS server_port')).rows[0]);
  const {PrismaClient}=await import('../../src/generated/prisma/client.ts'),{PrismaPg}=await import('@prisma/adapter-pg');
  db=new PrismaClient({adapter:new PrismaPg({connectionString:target.databaseUrl})});
  const project=await db.project.findFirst({where:{id:scope.projectId,organizationId:scope.organizationId},select:{metadata:true}});
  assert.equal(project?.metadata?.synthetic,true);assert.equal(await db.whatsAppConnection.count({where:{projectId:scope.projectId}}),0);
  const data=await db.$transaction(tx=>seedFlowIncidentFixture(tx,{scope,prefix:'s11e2e_incident',now:new Date()}),{timeout:15000});
  await identity.end();return {...data,snapshot:()=>flowIncidentFixtureSnapshot(db,data),close:()=>db.$disconnect()};
 }catch(error){await identity.end().catch(()=>{});await db?.$disconnect().catch(()=>{});throw error;}
}
