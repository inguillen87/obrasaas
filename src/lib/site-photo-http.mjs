import {WorkspaceError,workspaceId,requireWorkspaceIdentity} from './workspace-policy.mjs';
import {readPrivateKycBody,PrivateImageError} from './private-image-upload.mjs';
const privateHeaders={'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200)=>Response.json(body,{status,headers:privateHeaders});
export function createSitePhotoHandlers({verify,service}){
 async function handle(request){
  try{
   const session=await verify(request.headers);
   if(!session.authenticated&&['IDENTITY_PROVIDER_UNAVAILABLE','IDENTITY_CONFIGURATION_PENDING'].includes(session.code))throw new WorkspaceError('IDENTITY_PROVIDER_UNAVAILABLE',503);
   requireWorkspaceIdentity(session);
   if(request.headers.get('sec-fetch-site')==='cross-site')throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
   const params=new URL(request.url).searchParams;
   if(request.method==='POST'){
    if(params.size||request.headers.get('origin')!=='https://obrasaas.com'||request.headers.has('content-encoding'))throw new WorkspaceError('WORKSPACE_ORIGIN_REJECTED',403);
    return reply(await service.attach(session,await readPrivateKycBody(request)));
   }
   if(request.method!=='GET')return reply({code:'METHOD_NOT_ALLOWED'},405);
   for(const key of params.keys())if(!['projectId','scope','reportId','operationId','photoId'].includes(key)||params.getAll(key).length!==1)throw new WorkspaceError('SITE_PHOTO_INPUT_INVALID');
   const input=Object.fromEntries(params);
   if(!workspaceId(input.projectId)||!workspaceId(input.reportId)||!/^[a-f0-9]{64}$/.test(input.scope||'')||params.has('photoId')===params.has('operationId'))throw new WorkspaceError('SITE_PHOTO_INPUT_INVALID');
   if(params.has('operationId'))return reply(await service.status(session,input));
   const file=await service.download(session,input);
   return new Response(file.bytes,{status:200,headers:{...privateHeaders,'Content-Type':file.contentType,'Content-Length':String(file.bytes.length),'Content-Disposition':`attachment; filename="evidencia.${file.extension}"`,'Content-Security-Policy':"default-src 'none'; sandbox"}});
  }catch(error){const known=error instanceof WorkspaceError||error instanceof PrivateImageError;return reply({saved:false,code:known?error.code:'SITE_PHOTO_UNCONFIRMED'},error instanceof WorkspaceError?error.status:error instanceof PrivateImageError?(error.code==='PRIVATE_IMAGE_TOO_LARGE'?413:400):503);}
 }
 return {GET:handle,POST:handle};
}
