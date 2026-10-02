const stages=new Set(['CONFIGURATION','BODY','SIGNATURE','PAYLOAD','VALIDATING_EVENTS','RECORDING']);
const kinds=new Map([
 ['META_CUSTOMER_CALLBACK_NOT_CONFIGURED','CONFIGURATION'],
 ['META_CUSTOMER_CALLBACK_TOO_LARGE','SIZE_LIMIT'],
 ['META_CUSTOMER_SIGNATURE_REJECTED','SIGNATURE'],
 ['META_CUSTOMER_CALLBACK_INVALID','FORMAT'],
 ['META_CUSTOMER_CALLBACK_SCOPE_REJECTED','CHANNEL_SCOPE'],
 ['META_CUSTOMER_DEMO_ASSET_REJECTED','CHANNEL_SCOPE'],
 ['META_DEMO_ASSET_REJECTED','CHANNEL_SCOPE'],
 ['META_DEMO_PILOT_PROOF_REQUIRED','AUTHORIZATION'],
 ['META_CUSTOMER_CALLBACK_REPLAY_CONFLICT','CONFLICT'],
]);
// Fixed categories and scalar fields only. Never pass the request, raw error,
// event, IDs, signature, headers or payload to the operational logger.
export function reportMetaCallbackRejection(input,{log=(...entry)=>console.warn(...entry)}={}){
 try{
  const stage=stages.has(input?.stage)?input.stage:'UNCONFIRMED';
  const failureKind=input?.code==='META_CUSTOMER_CALLBACK_UNCONFIRMED'&&stage==='RECORDING'?'DURABILITY':kinds.get(input?.code)||'UNCONFIRMED';
  const shape={stage,failureKind,status:Number.isInteger(input?.status)&&input.status>=400&&input.status<=599?input.status:503,signatureVerified:input?.signatureVerified===true};
  Promise.resolve(log('META_CALLBACK_REJECTED',shape)).catch(()=>{});
 }catch{/* Logging cannot change callback acceptance or retries. */}
}
