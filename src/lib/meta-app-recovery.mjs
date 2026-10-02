import {WorkspaceError} from './workspace-policy.mjs';
import {recoverWithMetaDiagnostics} from './meta-recovery-diagnostics.mjs';

// One existing cron and the existing customer signed-job boundary. Recover one
// event per namespace in parallel so either queue cannot consume the other's
// execution budget. Leases, receipts and retries remain in canonical processors.
export function createMetaAppRecovery({customer,demo,log}) {
 return {async recover(input={}) {
  if(input.eventIds!==undefined&&input.eventIds!==null)return customer.recover(input);
  const protocols=[['CUSTOMER',customer],['DEMO_PILOT',demo]];
  const settled=await Promise.allSettled(protocols.map(([purpose,processor])=>recoverWithMetaDiagnostics(processor,{limit:1},{purpose,trigger:'CRON',log})));
  const recovery=settled.map((value,index)=>value.status==='fulfilled'?{purpose:protocols[index][0],...value.value}:{purpose:protocols[index][0],durable:false,checked:0,results:[],code:value.reason instanceof WorkspaceError?value.reason.code:'META_APP_RECOVERY_UNCONFIRMED'});
  return {durable:recovery.every(row=>row.durable===true),checked:recovery.reduce((sum,row)=>sum+row.checked,0),results:recovery.flatMap(row=>row.results),recovery};
 }};
}
