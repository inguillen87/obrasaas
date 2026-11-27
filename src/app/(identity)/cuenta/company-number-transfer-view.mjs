const invalid=()=>new Error('La respuesta no corresponde a esta empresa. Conservamos el intento para comprobarlo.');
export function companyTransferSnapshot(value,{scope,projectId,transferId=null}){
 if(!value||value.scope!==scope||value.projectId!==projectId||value.available!==true)throw invalid();
 if(value.historical===true){if(value.operational!==false||!Array.isArray(value.items))throw invalid();return value;}
 if(value.transferId){if(!/^asset_transfer_[a-f0-9]{64}$/.test(value.transferId)||transferId&&value.transferId!==transferId||!['PREPARED','EXCHANGING','EXCHANGE_UNKNOWN','GRANT_READY','COMMITTED','CLOSED'].includes(value.state)||!Number.isSafeInteger(value.revision)||value.revision<1||value.dataMoved!==false||value.identitiesCopied!==false||value.providerMigrated!==false||value.connected!==(value.state==='COMMITTED')||value.roundTrip!=='NOT_VERIFIED'||value.state==='PREPARED'&&!/^[a-f0-9]{64}$/.test(value.stateToken||''))throw invalid();return value;}
 if(!Array.isArray(value.sources)||value.sources.length>10||value.singlePhoneWabaOnly!==true||value.providerMigrated!==false||value.sources.some(item=>typeof item.id!=='string'||!Number.isSafeInteger(item.revision)||typeof item.companyName!=='string'||typeof item.projectName!=='string'))throw invalid();return value;
}
export const companyTransferPending=value=>Boolean(value?.transferId&&!['COMMITTED','CLOSED'].includes(value.state));
export function companyTransferCanLaunchMeta(value,sdk,now=Date.now()){
 const readiness=value?.readiness,expiresAt=Date.parse(value?.expiresAt);
 return value?.state==='PREPARED'&&readiness?.canLaunchMeta===true
  &&typeof readiness.appId==='string'&&readiness.appId.length>0
  &&typeof readiness.version==='string'&&readiness.version.length>0
  &&typeof readiness.configId==='string'&&readiness.configId.length>0
  &&sdk===readiness.appId+':'+readiness.version
  &&Number.isFinite(now)&&Number.isFinite(expiresAt)&&expiresAt>now;
}
