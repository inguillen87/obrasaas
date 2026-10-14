import {createHash} from 'node:crypto';

export const PLAN_MEASUREMENT_CONSUMER_CI_VERSION='plan-measurement-consumer-lineage-v1';
export const PLAN_MEASUREMENT_CONSUMER_CI_HELPER='scripts/lib/plan-measurement-consumer-ci-lineage.mjs';
export const PLAN_MEASUREMENT_CONSUMER_SOURCES=Object.freeze(['src/lib/plan-measurement-policy.mjs','src/lib/plan-measurement-source.mjs']);
// The published producer bodies, scenarios and previous path sets are retained.
// Source import adds exactly these two dependencies to each current AST graph.
export const PLAN_MEASUREMENT_CONSUMER_LINEAGE=Object.freeze({
 ORGANIZATION_USAGE:Object.freeze({previousSourceCount:113,previousSourcePathsSha256:'e09335573fc3fe06574f23907088ae2f0a16340fd0a5a4a8b61ae31016be9736',sourceCount:115,sourcePathsSha256:'15b39f104ac2f363dcce7952130f7fbd149490122718d8a93eaf0e3b030e3a37',producer:'scripts/verify-organization-usage-postgres.mjs',producerLfSha256:'c75c023c6e8de0104b56e259545401e891d88de362bca9f444717b58c149c52b',nativeCheckCount:16}),
 CONSUMPTION_FEEDBACK:Object.freeze({previousSourceCount:108,previousSourcePathsSha256:'aba2e13b273f24b8f2d9ec5378dc3c3b6f3846341ce576735d9fc7da587d6caa',sourceCount:110,sourcePathsSha256:'f10ea8939e36ac1011b73338ffa0fee3ebf1871a6cc04b4700034689e53061be',producer:'scripts/verify-material-consumption-feedback-postgres.mjs',producerLfSha256:'263f778819bcd8edb078b22002781bf257e0febb670ad06a3006528d6df005b4',nativeCheckCount:23}),
 KYC_REPLY_FEEDBACK:Object.freeze({previousSourceCount:109,previousSourcePathsSha256:'7840351acc884606627ae6b2edefcbab5abe4bd6a1befc7c3c03adff12814714',sourceCount:111,sourcePathsSha256:'6fd8563baf288562b093d7ae982669449cb98c4bfa93955939802f32a747a9c1',producer:'scripts/verify-company-kyc-rejection-feedback-postgres.mjs',producerLfSha256:'a64cd0fa267dda98f9c9430327ab39f2cfec304fadc7fddb6c804ba41091ba32',nativeCheckCount:8}),
});
const sha=value=>createHash('sha256').update(value).digest('hex');
function requireLineage(condition,message){if(!condition)throw Object.assign(new Error(message),{code:'PLAN_MEASUREMENT_CONSUMER_LINEAGE_REJECTED'});}
function bytes(readSource,file){requireLineage(typeof readSource==='function','Committed source resolver required');const value=readSource(file);requireLineage(Buffer.isBuffer(value),'Missing committed source: '+file);return value;}
export function validatePlanMeasurementConsumerSourceLineage({family,files,readSource}){
 requireLineage(Object.hasOwn(PLAN_MEASUREMENT_CONSUMER_LINEAGE,family),'Known source import consumer required');const expected=PLAN_MEASUREMENT_CONSUMER_LINEAGE[family];
 requireLineage(Array.isArray(files)&&files.every(file=>typeof file==='string')&&new Set(files).size===files.length,'Unique source paths required');
 requireLineage(JSON.stringify(files)===JSON.stringify([...files].sort())&&files.length===expected.sourceCount&&sha(JSON.stringify(files))===expected.sourcePathsSha256,'Exact current consumer path set required');
 for(const file of PLAN_MEASUREMENT_CONSUMER_SOURCES)requireLineage(files.filter(value=>value===file).length===1,'Source import dependency omitted: '+file);
 const previous=files.filter(file=>!PLAN_MEASUREMENT_CONSUMER_SOURCES.includes(file));
 requireLineage(previous.length===expected.previousSourceCount&&sha(JSON.stringify(previous))===expected.previousSourcePathsSha256,'Published previous consumer path set changed');
 const producer=bytes(readSource,expected.producer),text=producer.toString('utf8');requireLineage(producer.equals(Buffer.from(text))&&sha(text.replaceAll('\r\n','\n'))===expected.producerLfSha256,'Published producer body changed');
 const helper=bytes(readSource,PLAN_MEASUREMENT_CONSUMER_CI_HELPER);
 return {version:PLAN_MEASUREMENT_CONSUMER_CI_VERSION,family,...expected,sourceAdditions:[...PLAN_MEASUREMENT_CONSUMER_SOURCES],sourceReferences:PLAN_MEASUREMENT_CONSUMER_SOURCES.map(file=>({path:file,sha256:sha(bytes(readSource,file))})),validationSource:{path:PLAN_MEASUREMENT_CONSUMER_CI_HELPER,sha256:sha(helper)}};
}
