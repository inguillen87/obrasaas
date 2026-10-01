import {createHash} from 'node:crypto';
import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {recordKeys,siteRevision,cleanMetadata} from './site-register-policy.mjs';
import {decodePrivateImage,PrivateImageError} from './private-image-upload.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const action='site.report.photo.attached';
function photos(metadata){const value=metadata?.siteRegister?.photos;if(value===undefined)return [];if(!Array.isArray(value)||value.length>10)throw new WorkspaceError('SITE_PHOTO_INTEGRITY',409);return value;}
function publicPhoto(value){return {id:value.id,contentType:value.contentType,bytes:value.bytes,sha256:value.sha256};}
export function photoInput(input){
 recordKeys(input,['operationId','projectId','scope','reportId','revision','image']);
 if(!workspaceId(input.projectId)||!workspaceId(input.reportId)||!operationId(input.operationId)||!/^[a-f0-9]{64}$/.test(input.scope||''))throw new WorkspaceError('SITE_PHOTO_INPUT_INVALID');
 siteRevision(input.revision);let image;
 try{image=decodePrivateImage(input.image);}catch(error){throw new WorkspaceError(error instanceof PrivateImageError?error.code:'SITE_PHOTO_INPUT_INVALID',error.code==='PRIVATE_IMAGE_TOO_LARGE'?413:400);}
 return {...input,operationId:input.operationId.toLowerCase(),image};
}
export function createSitePhotos({workspace,upload,get}){
 const run=(session,input,writable,callback)=>workspace.integrationProject(session,input,writable,callback);
 async function report(client,input,lock=false){
  const row=(await client.query(`SELECT id,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Incident" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[input.reportId,input.projectId])).rows[0];
  if(!row||row.metadata?.siteRegister?.version!==1)throw new WorkspaceError('SITE_REPORT_UNAVAILABLE',404);return row;
 }
 async function prior(client,member,input,id){return (await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action=$4`,[id,member.organizationId,member.actorId,action])).rows[0];}
 function validReceipt(value,input){if(!value||value.metadata.projectId!==input.projectId||value.metadata.reportId!==input.reportId)throw new WorkspaceError('SITE_PHOTO_RECEIPT_INVALID',409);return {saved:true,receiptId:value.id,photo:publicPhoto(value.metadata.photo)};}
 return {
  async attach(session,body){
   const input=photoInput(body),fingerprint=digest([input.projectId,input.scope,input.reportId,input.revision,input.image.digest]);
   const preflight=await run(session,input,false,async(client,member,scope)=>{
    const id='sitephoto_'+digest([member.actorId,input.projectId,input.operationId]),existing=await prior(client,member,input,id);
    if(existing){if(existing.metadata.requestDigest!==fingerprint)throw new WorkspaceError('SITE_OPERATION_CONFLICT',409);return {done:{scope,replayed:true,...validReceipt(existing,input)}};}
    const row=await report(client,input);if(row.revision!==input.revision)throw new WorkspaceError('SITE_REVISION_CHANGED',409);
    if(!['OPEN','ACKNOWLEDGED'].includes(row.metadata.siteRegister.state))throw new WorkspaceError('SITE_REPORT_ALREADY_CLOSED',409);
    if(photos(row.metadata).length>=10)throw new WorkspaceError('SITE_PHOTO_LIMIT',409);
    return {id,actorId:member.actorId,scope};
   });
   if(preflight.done)return preflight.done;
   // No database locks are held during provider I/O. Exact retries use the same private path.
   const filename='site-photo-'+digest([preflight.actorId,input.projectId,input.reportId,input.operationId]);
   const path='obrasaas/legacy-images/v1/'+sha(JSON.stringify(['legacy-private-image-v1',filename,input.image.digest]))+'/image.'+input.image.extension;
   let url;try{url=new URL(await upload(input.image.bytes.toString('base64'),filename,input.image.contentType));}
   catch{throw new WorkspaceError('SITE_PHOTO_STORAGE_UNCONFIRMED',503);}
   if(url.protocol!=='https:'||!/^[-a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)||url.pathname!=='/'+path||url.search||url.hash||url.username||url.password||url.port)throw new WorkspaceError('SITE_PHOTO_STORAGE_UNCONFIRMED',503);
   const photo={id:preflight.id,pathname:path,url:url.toString(),bytes:input.image.bytes.length,contentType:input.image.contentType,sha256:input.image.digest};
   return run(session,input,true,async(client,member,scope)=>{
    if(member.actorId!==preflight.actorId)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
    const existing=await prior(client,member,input,preflight.id);
    if(existing){if(existing.metadata.requestDigest!==fingerprint)throw new WorkspaceError('SITE_OPERATION_CONFLICT',409);return {scope,replayed:true,...validReceipt(existing,input)};}
    const row=await report(client,input,true),metadata=cleanMetadata(row.metadata);
    if(row.revision!==input.revision)throw new WorkspaceError('SITE_REVISION_CHANGED',409);
    if(!['OPEN','ACKNOWLEDGED'].includes(metadata.siteRegister.state))throw new WorkspaceError('SITE_REPORT_ALREADY_CLOSED',409);
    if(photos(metadata).length>=10)throw new WorkspaceError('SITE_PHOTO_LIMIT',409);
    const next={...metadata,siteRegister:{...metadata.siteRegister,photos:[...photos(metadata),photo]}};
    await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[input.reportId,input.projectId,JSON.stringify(next)]);
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Incident',$5,$6::jsonb)`,[preflight.id,member.organizationId,member.actorId,action,input.reportId,JSON.stringify({projectId:input.projectId,reportId:input.reportId,requestDigest:fingerprint,photo,identityVerified:false})]);
    const saved=await prior(client,member,input,preflight.id);return {scope,replayed:false,...validReceipt(saved,input)};
   });
  },
  status(session,input){
   if(!operationId(input.operationId)||!workspaceId(input.reportId))throw new WorkspaceError('SITE_PHOTO_INPUT_INVALID');
   return run(session,input,false,async(client,member,scope)=>{
    await report(client,input);const id='sitephoto_'+digest([member.actorId,input.projectId,input.operationId.toLowerCase()]);
    const value=await prior(client,member,input,id);return value?{scope,state:'RECORDED',...validReceipt(value,input)}:{scope,state:'NOT_OBSERVED',definitive:false};
   });
  },
  async download(session,input){
   if(!workspaceId(input.reportId)||!/^sitephoto_[a-f0-9]{64}$/.test(input.photoId||''))throw new WorkspaceError('SITE_PHOTO_INPUT_INVALID');
   const photo=await run(session,input,false,async(client)=>{
    const row=await report(client,input),found=photos(row.metadata).find(value=>value.id===input.photoId);
    if(!found)throw new WorkspaceError('SITE_PHOTO_NOT_FOUND',404);return found;
   });
   if(!/^obrasaas\/legacy-images\/v1\/[a-f0-9]{64}\/image\.(jpg|png|webp)$/.test(photo.pathname)||!['image/jpeg','image/png','image/webp'].includes(photo.contentType)||!Number.isSafeInteger(photo.bytes)||photo.bytes<1||photo.bytes>2*1024*1024||!/^[a-f0-9]{64}$/.test(photo.sha256))throw new WorkspaceError('SITE_PHOTO_INTEGRITY',409);
   const stored=await get(photo.pathname,{access:'private',useCache:false,abortSignal:AbortSignal.timeout(15000)});
   if(!stored||stored.statusCode!==200||stored.blob?.url!==photo.url||stored.blob?.pathname!==photo.pathname||stored.blob?.size!==photo.bytes||stored.blob?.contentType?.split(';')[0]!==photo.contentType){await stored?.stream?.cancel?.().catch(()=>{});throw new WorkspaceError('SITE_PHOTO_STORAGE_UNCONFIRMED',503);}
   const reader=stored.stream.getReader(),parts=[];let count=0;
   try{while(true){const item=await reader.read();if(item.done)break;count+=item.value.byteLength;if(count>photo.bytes)throw new Error('Too large');parts.push(Buffer.from(item.value));}
    const bytes=Buffer.concat(parts);if(count!==photo.bytes||sha(bytes)!==photo.sha256)throw new Error('Integrity mismatch');
    return {bytes,contentType:photo.contentType,extension:photo.pathname.split('.').at(-1)};
   }catch{throw new WorkspaceError('SITE_PHOTO_INTEGRITY',503);}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  },
 };
}
