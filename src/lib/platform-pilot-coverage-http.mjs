import {WorkspaceError} from './workspace-policy.mjs';
import {usageExact} from './organization-usage-policy.mjs';
import {boundedBody} from './workspace-http.mjs';
const headers={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
export function createPlatformPilotCoverageHandlers({authority,store}){
  if(typeof authority?.authenticate!=='function'||['read','create','revoke'].some(key=>typeof store?.[key]!=='function'))throw new TypeError('Canonical pilot coverage composition required');
  async function handle(request){
    try{
      if(!['GET','POST'].includes(request.method))return reply({code:'METHOD_NOT_ALLOWED'},405);
      const url=new URL(request.url);
      if(url.origin!=='https://obrasaas.com'||request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
      const cap=await authority.authenticate(request.headers);
      if(request.method==='GET'){
        if(url.searchParams.size!==1||url.searchParams.getAll('organizationId').length!==1)throw new WorkspaceError('PILOT_COVERAGE_INPUT_INVALID',400);
        return reply({coverage:await store.read(cap,{organizationId:url.searchParams.get('organizationId')})});
      }
      if(url.search||request.headers.get('origin')!==url.origin)throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
      const body=await boundedBody(request);
      if(!usageExact(body,['action','input'])||!['CREATE','REVOKE'].includes(body.action))throw new WorkspaceError('PILOT_COVERAGE_INPUT_INVALID',400);
      return reply({coverage:await store[body.action==='CREATE'?'create':'revoke'](cap,body.input)});
    }catch(error){return reply({code:error instanceof WorkspaceError?error.code:'PILOT_COVERAGE_UNCONFIRMED'},error instanceof WorkspaceError?error.status:503);}
  }
  return {GET:handle,POST:handle};
}
