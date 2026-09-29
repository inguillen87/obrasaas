import {identityConfig} from '../../src/lib/production-identity-config.mjs';
export async function inspectIdentityProvider({environment=process.env,fetchImpl=fetch}={}){
  const setup=identityConfig(environment);
  const base={version:1,domain:setup.origin,businessAccessEnabled:false,customerLoginVerified:false};
  if(!setup.configured)return {...base,status:'CONFIGURATION_PENDING',errors:setup.errors,providerRequests:0};
  try{
    const response=await fetchImpl('https://api.clerk.com/v1/instance',{
      headers:{Authorization:'Bearer '+environment.CLERK_SECRET_KEY},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok){await response.body?.cancel?.().catch(()=>{});return {...base,status:[401,403].includes(response.status)?'PROVIDER_CREDENTIAL_REJECTED':'PROVIDER_UNCONFIRMED',httpStatus:response.status};}
    const data=await response.json();
    if(data?.id!==setup.instanceId)return {...base,status:'PROVIDER_INSTANCE_MISMATCH'};
    return {...base,status:'INSTANCE_VERIFIED',instanceIdMatched:true};
  }catch{return {...base,status:'PROVIDER_UNCONFIRMED'};}
}
