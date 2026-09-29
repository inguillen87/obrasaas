import { randomUUID } from 'node:crypto';
import { createPrivateImageUploader, preparePrivateKycImages } from '../../src/lib/private-image-upload.mjs';
export const STORAGE_PROJECT='prj_68NErbCqCFsDVaMak81gcwsGI9pF';
export const STORAGE_CHECK_FLAG='verify-private-storage-v1';
// A 1px PNG, not a document or photograph. No user input is accepted.
const PIXEL='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
export class StorageCheckError extends Error {
  constructor(code,proof){super('No se pudo cerrar la comprobación privada de almacenamiento.');this.code=code;this.proof=proof;}
}
export function storageCheckEnabled(env=process.env){
  if(!env.OBRASAAS_RUN_STORAGE_CHECK)return false;
  if(env.OBRASAAS_RUN_STORAGE_CHECK!==STORAGE_CHECK_FLAG||env.VERCEL_ENV!=='production'||
     env.VERCEL_PROJECT_ID!==STORAGE_PROJECT||env.NEXT_PUBLIC_APP_URL!=='https://obrasaas.com'||env.PRIVATE_MEDIA_PROVIDER!=='vercel-blob')
    throw new StorageCheckError('STORAGE_CHECK_CONTEXT_REJECTED',null);
  return true;
}
export async function verifyProductionStorage({get,put,del,fetchImpl=fetch,environment=process.env,nonce=randomUUID(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
  if(!storageCheckEnabled(environment))return {status:'NOT_REQUESTED',providerRequests:0};
  if(!/^[a-f0-9-]{36}$/.test(nonce)||![get,put,del,fetchImpl,sleep].every(x=>typeof x==='function'))throw new StorageCheckError('STORAGE_CHECK_ADAPTER_INVALID',null);
  const worker='storage_check_'+nonce,images=preparePrivateKycImages(worker,PIXEL,PIXEL);
  const known=new Set(images.map(image=>image.pathname)),owned=new Set();
  const proof={version:1,runId:nonce,status:'STARTED',environment:'production-build',syntheticOnly:true,businessDataWritten:false,
    initialAbsenceVerified:false,pairReadBackVerified:false,exactRetryVerified:false,anonymousReadDenied:false,cleanupVerified:false,putCalls:0,anonymousStatuses:[]};
  let failure=null;
  const readOptions=()=>({access:'private',useCache:false,abortSignal:AbortSignal.timeout(15000)});
  try{
    for(const image of images){const prior=await get(image.pathname,readOptions());if(prior!==null){await prior?.stream?.cancel?.().catch(()=>{});throw new StorageCheckError('STORAGE_CHECK_PATH_PREEXISTS');}}
    proof.initialAbsenceVerified=true;
    const uploader=createPrivateImageUploader({environment:()=>environment,get,put:async(path,bytes,settings)=>{
      if(!known.has(path)||settings.access!=='private'||settings.allowOverwrite!==false)throw new StorageCheckError('STORAGE_CHECK_PATH_REJECTED');
      owned.add(path);proof.putCalls++;return put(path,bytes,settings);
    }});
    const first=await uploader.uploadKycImages(worker,PIXEL,PIXEL);proof.pairReadBackVerified=true;
    const second=await uploader.uploadKycImages(worker,PIXEL,PIXEL);
    if(first.dniFrontUrl!==second.dniFrontUrl||first.selfieUrl!==second.selfieUrl||proof.putCalls!==2)throw new StorageCheckError('STORAGE_CHECK_RETRY_CHANGED');
    proof.exactRetryVerified=true;
    for(const value of [first.dniFrontUrl,first.selfieUrl]){
      const url=new URL(value);
      if(!url.hostname.endsWith('.private.blob.vercel-storage.com')||!known.has(url.pathname.slice(1)))throw new StorageCheckError('STORAGE_CHECK_RECEIPT_INVALID');
      const response=await fetchImpl(value,{redirect:'manual',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});
      proof.anonymousStatuses.push(response.status);await response.body?.cancel?.().catch(()=>{});
      if(![401,403,404].includes(response.status))throw new StorageCheckError('STORAGE_CHECK_ANONYMOUS_ACCESS');
    }
    proof.anonymousReadDenied=true;
  }catch(error){failure=error instanceof StorageCheckError?error.code:'STORAGE_CHECK_PROVIDER_UNCONFIRMED';}
  finally{
    // Only paths created for this randomized invocation; never list or delete
    // historical uploads, directories, stores, or a pre-existing object.
    try{
      if(owned.size){await del([...owned],{abortSignal:AbortSignal.timeout(15000)});
        let remaining=true;
        for(let attempt=0;attempt<4&&remaining;attempt++){
          remaining=false;
          for(const path of owned){const value=await get(path,readOptions());if(value!==null){remaining=true;await value?.stream?.cancel?.().catch(()=>{});}}
          if(remaining&&attempt<3)await sleep(2000);
        }
        if(remaining)throw new StorageCheckError('STORAGE_CHECK_CLEANUP_PENDING');
      }
      proof.cleanupVerified=true;
    }catch{failure='STORAGE_CHECK_CLEANUP_UNCONFIRMED';}
  }
  proof.status=failure?'FAILED':'PASS';
  if(failure)throw new StorageCheckError(failure,proof);
  return proof;
}
