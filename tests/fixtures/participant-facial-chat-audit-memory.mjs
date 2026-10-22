import assert from 'node:assert/strict';
import {createFakeAuditSql} from './participant-facial-audit-memory.mjs';

// SQL adapter only: actual coordinator transitions and all signed-channel
// authority checks stay in their canonical modules. No model result is forged.
export function createFacialChatAuditPort(f){
 const db=createFakeAuditSql();db.rows=f.audits;
 return async function wrap(client){
  const facial=await db.connect();
  return {release(){facial.release();client.release();},async query(sql,args=[]){
   db.at=f.now.getTime();
   if(sql.startsWith('BEGIN')){const result=await client.query(sql,args);await facial.query(sql,args);return result;}
   if(sql==='COMMIT'||sql==='ROLLBACK'){await facial.query(sql,args);return client.query(sql,args);}
   if(sql.startsWith('SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog"')&&(sql.includes("action='participant.kyc.facial.attempt'")||sql.includes("action='participant.operation.recorded'")))return facial.query(sql,args);
   if(sql.startsWith('INSERT INTO public."AuditLog"')&&args[3]==='participant.kyc.facial.attempt'){assert.equal(args.length,6);return facial.query(sql,args);}
   if(sql.startsWith('UPDATE public."AuditLog" SET metadata=')&&sql.includes("action='participant.kyc.facial.attempt'"))return facial.query(sql,args);
   return client.query(sql,args);
  }};
 };
}
