import {resolveMetaTransport,readMetaJson,metaErrorCode} from '../../src/lib/meta-whatsapp-transport.mjs';
import {OBRASAAS_META_CHANNEL} from '../../src/lib/meta-channel-binding.mjs';
export function catalogCheckEnabled(env=process.env){
 if(!env.OBRASAAS_VERIFY_META_CATALOG)return false;
 if(env.OBRASAAS_VERIFY_META_CATALOG!=='read-only-v1'||env.VERCEL_ENV!=='production'||env.VERCEL_PROJECT_ID!=='prj_68NErbCqCFsDVaMak81gcwsGI9pF'||env.NEXT_PUBLIC_APP_URL!=='https://obrasaas.com')throw new Error('META_CATALOG_CONTEXT_REJECTED');
 return true;
}
export async function inspectDemoTemplateCatalog({environment=process.env,fetchImpl=fetch}={}){
 const proof={source:'META_TEST_WABA_ONLY',requests:0,templates:[],truncated:false,sentMessages:0,customerOnboardingVerified:false};
 const config=resolveMetaTransport(environment);
 if(config.error||environment.META_WABA_ID!==OBRASAAS_META_CHANNEL.wabaId)return {...proof,status:'NOT_VERIFIED',code:config.error||'META_WABA_MISMATCH'};
 let after=null;const seen=new Set();
 try{
  for(let page=0;page<5;page++){
   const url=new URL(`https://graph.facebook.com/${config.version}/${environment.META_WABA_ID}/message_templates`);
   url.searchParams.set('fields','name,language,status');url.searchParams.set('limit','100');if(after)url.searchParams.set('after',after);
   proof.requests++;
   const response=await fetchImpl(url,{method:'GET',headers:{Authorization:'Bearer '+config.token},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
   const result=await readMetaJson(response,524288);
   if(!response.ok||result.error)return {...proof,status:'NOT_VERIFIED',code:metaErrorCode(result.error).code};
   if(!Array.isArray(result.data)||result.data.length>100)throw new Error();
   for(const value of result.data){
    if(!/^[a-z0-9_]{1,512}$/.test(value.name||'')||!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(value.language||'')||!/^[A-Z_]{1,60}$/.test(value.status||''))throw new Error();
    const key=value.name+'|'+value.language;if(seen.has(key))throw new Error();seen.add(key);
    proof.templates.push({name:value.name,language:value.language,status:value.status});
   }
   if(!result.paging?.next)return {...proof,status:'OBSERVED',complete:true};
   after=result.paging?.cursors?.after;if(typeof after!=='string'||after.length<1||after.length>2048||/[\u0000-\u001f]/.test(after))throw new Error();
  }
  return {...proof,status:'OBSERVED',complete:false,truncated:true};
 }catch{return {...proof,status:'NOT_VERIFIED',code:'META_CATALOG_UNCONFIRMED'};}
}
