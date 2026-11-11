// Public diagnostics only: fixed guard labels, never arbitrary exception text.
const contextGuards=new Map([
 ["Linux checkout cwd required", "CHECKOUT_PLATFORM"],
 ["Exact current HEAD/tree required", "CHECKOUT_HEAD_TREE"],
 ["Clean tracked Git source required", "CHECKOUT_CLEAN"],
 ["Regular tracked source required", "TRACKED_FILE_KIND"],
 ["Safe tracked path required", "TRACKED_PATH"],
 ["No source symlink", "TRACKED_SYMLINK"],
 ["Source remains inside checkout", "TRACKED_CONFINEMENT"],
 ["Complete distinct source census required", "SOURCE_CENSUS"],
 ["GitHub Linux execution context required", "GITHUB_EXECUTION_CONTEXT"],
 ["Repository context required", "REPOSITORY_CONTEXT"],
 ["Workflow/job/event context required", "WORKFLOW_JOB_EVENT"],
 ["Run/attempt context required", "RUN_ATTEMPT"],
 ["Actual workspace required", "WORKSPACE_CONTEXT"],
 ["Local Docker daemon only", "LOCAL_DOCKER_ONLY"],
 ["Explicit job.services.postgres context required", "POSTGRES_SERVICE_CONTEXT"],
 ["Reviewed Node version with no preload required", "NODE_RUNTIME"],
 ["UTC process required", "UTC_PROCESS"],
 ["Ambient DB/provider configuration forbidden", "AMBIENT_DB_PROVIDER"],
 ["Ambient dotenv file forbidden", "AMBIENT_DOTENV"],
 ["Ambient Meta credentials forbidden", "AMBIENT_META"],
 ["Only the existing synthetic CI service target is accepted", "SYNTHETIC_SERVICE_TARGET"],
 ["Pinned running owned service required", "OWNED_SERVICE_RUNNING"],
 ["Synthetic UTC service without host bind required", "OWNED_SERVICE_CONFIGURATION"],
 ["Actual image digest required", "IMAGE_DIGEST"],
 ["One exact job network required", "JOB_NETWORK"],
 ["Actual container network endpoint required", "NETWORK_ENDPOINT"],
 ["Independent job network join required", "NETWORK_JOIN"],
 ["Only the PostgreSQL port is published", "PUBLISHED_PORTS"],
 ["Unambiguous published port required", "PUBLISHED_PORT_MAPPING"],
 ["Loopback published PostgreSQL5432 required", "PUBLISHED_PORT_LOOPBACK"],
 ["Container changed during inspection", "SERVICE_INSPECTION_CHANGED"],
 ["Actual owned SQL PostgreSQL17 identity required", "SQL_IDENTITY"],
 ["SQL postmaster belongs to this service start", "SQL_SERVICE_START"],
 ['One inspected container required','INSPECT_CONTAINER_COUNT'],
 ['One inspected image required','INSPECT_IMAGE_COUNT'],
 ['One inspected network required','INSPECT_NETWORK_COUNT'],
]);
const envelopeGuards=new Map([
 ['Use --expected-head <actual commit>','EXPECTED_HEAD_ARGUMENT'],
 ['Create-only evidence directory required','FRESH_EVIDENCE_DIRECTORY'],
]);
function ownData(error,key){
 try{return Object.getOwnPropertyDescriptor(error,key)?.value;}catch{return undefined;}
}
export function formatOfficeNativeCiPreflightError(error){
 const observedCode=ownData(error,'code');
 const code=observedCode==='OFFICE_NATIVE_CI_CONTEXT_REJECTED'||observedCode==='OFFICE_NATIVE_CI_ENVELOPE_REJECTED'?observedCode:'OFFICE_NATIVE_CI_PREFLIGHT_FAILED';
 const labels=code==='OFFICE_NATIVE_CI_CONTEXT_REJECTED'?contextGuards:code==='OFFICE_NATIVE_CI_ENVELOPE_REJECTED'?envelopeGuards:null;
 const message=ownData(error,'message');
 const dynamicGuard=code==='OFFICE_NATIVE_CI_CONTEXT_REJECTED'&&typeof message==='string'?(message.startsWith('Checkout RAW differs from committed Git blob: ')?'CHECKOUT_RAW_BLOB_MISMATCH':message.startsWith('Missing committed CI source: ')?'COMMITTED_CI_SOURCE_MISSING':'UNCLASSIFIED'):'UNCLASSIFIED';
 const guard=typeof message==='string'?(labels?.get(message)??dynamicGuard):'UNCLASSIFIED';
 return code+' guard='+guard;
}
