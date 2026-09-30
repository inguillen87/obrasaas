import {inspectMetaTestNumber,metaTestCheckEnabled} from './lib/meta-test-number-check.mjs';
try{if(metaTestCheckEnabled())console.log(JSON.stringify({metaTestNumberCheck:await inspectMetaTestNumber()}));}
catch{console.error(JSON.stringify({metaTestNumberCheck:{status:'CHECK_FAILED',code:'META_TEST_CHECK_CONTEXT_REJECTED',sentMessages:0}}));process.exitCode=1;}
