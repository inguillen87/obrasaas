import {get,put,del} from '@vercel/blob';
import {inspectIdentityProvider} from './lib/production-identity-check.mjs';
import {storageCheckEnabled,verifyProductionStorage,StorageCheckError} from './lib/production-storage-check.mjs';
try{
  if(storageCheckEnabled()){
    console.log(JSON.stringify({productionIdentityCheck:await inspectIdentityProvider()}));
    console.log(JSON.stringify({privateStorageLiveCheck:await verifyProductionStorage({get,put,del})}));
  }
}catch(error){
  console.error(JSON.stringify({privateStorageLiveCheck:{status:'FAILED',code:error instanceof StorageCheckError?error.code:'STORAGE_CHECK_UNAVAILABLE',proof:error instanceof StorageCheckError?error.proof:null}}));
  process.exitCode=1;
}
