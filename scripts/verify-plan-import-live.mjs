import {verifyPlanImportLive,PlanImportLiveError} from './lib/plan-import-live-check.mjs';
try{console.log(JSON.stringify({planImportLiveCheck:await verifyPlanImportLive()}));}
catch(error){console.error(JSON.stringify({planImportLiveCheck:{...(error instanceof PlanImportLiveError?error.proof:{status:'UNCONFIRMED',syntheticOnly:true,businessWrites:0}),code:error instanceof PlanImportLiveError?error.code:'PLAN_IMPORT_LIVE_CHECK_UNCONFIRMED'}}));process.exitCode=1;}
