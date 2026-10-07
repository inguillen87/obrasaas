const purposes=new Set(['CUSTOMER','DEMO_PILOT']);
const triggers=new Set(['CRON','WEBHOOK']);
const onboardingStates=new Set(['NOT_REQUESTED','WAITING_CONFIGURATION','PENDING','BLOCKED','SEND_STARTED','SEND_UNKNOWN','SENT','REJECTED','STATUS_OBSERVED','CANCELED']);

// Only fixed counters cross the logging boundary. Event data, identifiers,
// provider errors and even the processor's supplied counts remain private.
export function metaRecoveryDiagnostics(result,{purpose,trigger,rejected=false}={}){
 if(!purposes.has(purpose)||!triggers.has(trigger))return null;
 const rows=Array.isArray(result?.results)?result.results.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)):[];
 const summary={purpose,trigger,checked:rows.length,processed:0,done:0,busy:0,failed:0,recoveryFailed:rejected===true||result?.durable===false?1:0,replyUncertain:0,replyRejected:0,onboardingChecked:0,onboardingBlocked:0,onboardingUncertain:0,onboardingRejected:0};
 for(const row of rows){
  if(row.processed===false)summary.failed++;
  else if(row.processed===true)summary.processed++;
  else if(row.done===true)summary.done++;
  else if(row.busy===true)summary.busy++;
  if(row.replyState==='SEND_UNKNOWN'||row.replyState==='SEND_STARTED')summary.replyUncertain++;
  else if(row.replyState==='REJECTED')summary.replyRejected++;
 }
 // Onboarding is a separate composition of the same customer processor. Count
 // its fixed states without mixing participants into inbound event counters.
 // Neither declared counts nor private identifiers cross this log boundary.
 const onboarding=purpose==='CUSTOMER'&&Array.isArray(result?.onboarding?.results)?result.onboarding.results.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)&&onboardingStates.has(row.state)):[];
 for(const row of onboarding){
  summary.onboardingChecked++;
  if(row.state==='BLOCKED')summary.onboardingBlocked++;
  else if(row.state==='SEND_STARTED'||row.state==='SEND_UNKNOWN')summary.onboardingUncertain++;
  else if(row.state==='REJECTED'||row.state==='STATUS_OBSERVED'&&['failed','deleted'].includes(row.providerStatus))summary.onboardingRejected++;
 }
 return Object.freeze(summary);
}

export function reportMetaRecoveryDiagnostics(result,options={}){
 try{
  const summary=metaRecoveryDiagnostics(result,options);
  if(!summary||!(summary.failed||summary.recoveryFailed||summary.replyUncertain||summary.replyRejected||summary.onboardingBlocked||summary.onboardingUncertain||summary.onboardingRejected))return summary;
  const log=options.log||((...entry)=>console.warn(...entry));
  // A logger is not part of canonical recovery. Never await it, and absorb
  // synchronous failures and rejected promises without creating a retry.
  try{Promise.resolve(log('META_RECOVERY_UNCONFIRMED',summary)).catch(()=>{});}catch{}
  return summary;
 }catch{return null;}
}

export async function recoverWithMetaDiagnostics(processor,input,options){
 try{
  const result=await processor.recover(input);
  reportMetaRecoveryDiagnostics(result,options);
  return result;
 }catch(error){
  try{reportMetaRecoveryDiagnostics(null,{...options,rejected:true});}catch{}
  throw error;
 }
}
