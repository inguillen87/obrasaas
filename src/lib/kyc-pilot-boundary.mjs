import {preparePrivateKycImages,readPrivateKycBody,assertPrivateImageConfigured,privateImageErrorResponse} from './private-image-upload.mjs';
import {privateLegacyHeaders,unauthorizedLegacyResponse} from './legacy-access-boundary.js';
export function kycReviewRequiredResponse(){
 return Response.json({success:false,verified:false,evidenceStored:false,attendanceRegistered:false,autoRetry:false,
  code:'KYC_REVIEW_WORKFLOW_REQUIRED',error:'No se confirmó la identidad ni se guardó un legajo. Falta habilitar la revisión de identidad vinculada a la empresa y obra.'},
  {status:503,headers:privateLegacyHeaders()});
}
export function mediaUnconfirmedResponse(){
 return Response.json({success:false,processed:false,code:'MEDIA_PROCESSING_UNCONFIRMED',error:'No se pudo confirmar el procesamiento del archivo.'},
  {status:503,headers:privateLegacyHeaders()});
}
export function createKycPilotBoundary({authorize,verifyToken,environment=()=>process.env}){
 return async request=>{
  if(!authorize(request).authorized)return unauthorizedLegacyResponse();
  try{
   assertPrivateImageConfigured(environment());
   const body=await readPrivateKycBody(request);
   preparePrivateKycImages(body.workerId,body.dniFrontBase64,body.selfieBase64);
   if(body.token!==undefined&&(!body.token||typeof body.token!=='string'||!verifyToken(body.workerId,body.token)))
    return Response.json({success:false,verified:false,code:'KYC_LINK_INVALID',error:'El enlace de captura no está verificado.'},{status:403,headers:privateLegacyHeaders()});
   // An image pair, OCR, voice flag or client geolocation cannot authenticate a
   // worker. The legacy path has no scoped review/approval contract; do not
   // write private uploads, identity, employment, insurance or attendance here.
   return kycReviewRequiredResponse();
  }catch(error){return privateImageErrorResponse(error)||Response.json({success:false,verified:false,code:'KYC_REQUEST_UNCONFIRMED',error:'No se confirmó la solicitud.'},{status:503,headers:privateLegacyHeaders()});}
 };
}
