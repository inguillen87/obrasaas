import test from 'node:test';
import assert from 'node:assert/strict';
import {selftestErrorDiagnostics} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
const enabled=['selftest','--diagnostic-errors','code-stack-v1'];
const frame='    at extensionSelftest (file:///repo/.github/scripts/verify-workspace-ci-parallelization.mjs:1599:12)';

test('CLI diagnostics stay absent without the exact selftest flag and do not read error data',()=>{
 let reads=0;const error={};for(const key of ['operator','stack','message','actual','expected'])Object.defineProperty(error,key,{get(){reads++;throw new Error('private getter');}});
 for(const argv of [[],['selftest'],['equivalence','--diagnostic-errors','code-stack-v1'],['gate','--diagnostic-errors','code-stack-v1'],['selftest','--diagnostic-errors','other-version']])assert.deepEqual(selftestErrorDiagnostics(error,argv),{});
 assert.equal(reads,0);
});

test('CLI diagnostic details preserve FAIL and code while excluding message actual expected and stack header',()=>{
 let privateReads=0;const error={code:'ERR_ASSERTION',operator:'strictEqual',stack:'AssertionError [ERR_ASSERTION]: MESSAGE_SECRET\n'+frame};
 for(const key of ['message','actual','expected'])Object.defineProperty(error,key,{get(){privateReads++;throw new Error('private error data');}});
 const diagnostic=selftestErrorDiagnostics(error,enabled),report={state:'FAIL',code:error.code||'VERIFIER_FAILED',...diagnostic};
 assert.deepEqual(Object.keys(diagnostic),['diagnosticErrors','operator','frames']);assert.equal(report.state,'FAIL');assert.equal(report.code,'ERR_ASSERTION');
 assert.equal(report.diagnosticErrors,'code-stack-v1');assert.equal(report.operator,'strictEqual');assert.deepEqual(report.frames,[frame.trimStart()]);assert.equal(privateReads,0);
 for(const key of ['message','actual','expected','stack'])assert.equal(Object.hasOwn(report,key),false);
 assert.equal(JSON.stringify(report).includes('MESSAGE_SECRET'),false);
});

test('CLI diagnostic frames are bounded to eight entries and 512 characters each',()=>{
 const frames=Array.from({length:12},(_,i)=>'    at frame'+i+' ('+'x'.repeat(900)+':10:20)');
 const result=selftestErrorDiagnostics({operator:'==',stack:'AssertionError: private header\n'+frames.join('\n')},enabled);
 assert.equal(result.frames.length,8);assert.ok(result.frames.every(value=>value.length===512&&/^at /.test(value)));assert.ok(result.frames[7].startsWith('at frame7 '));assert.equal(JSON.stringify(result).includes('private header'),false);
});

test('CLI diagnostics exclude entire data URL frames before truncating or selecting eight frames',()=>{
 const encoded='    at '+('longFunction'.repeat(7000))+' (data:text/javascript;base64,PRIVATE_ENCODED_BODY:1:1)';
 const frames=[encoded,'    at data:application/javascript,PRIVATE_INLINE_BODY:1:1',...Array.from({length:8},(_,i)=>'    at allowed'+i+' (file:///repo/test.mjs:1:1)')];
 const result=selftestErrorDiagnostics({operator:'throws',stack:'Error: private header\n'+frames.join('\n')},enabled);
 assert.equal(result.frames.length,8);assert.ok(result.frames[0].startsWith('at allowed0'));assert.ok(result.frames[7].startsWith('at allowed7'));assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);assert.ok(result.frames.every(value=>!value.toLowerCase().includes('data:')));
});

test('CLI diagnostic stack getter failure cannot escape or replace the known operator',()=>{
 const error={operator:'strictEqual'};Object.defineProperty(error,'stack',{get(){throw new Error('stack getter failure');}});
 let result;assert.doesNotThrow(()=>{result=selftestErrorDiagnostics(error,enabled);});assert.deepEqual(result,{diagnosticErrors:'code-stack-v1',operator:'strictEqual',frames:[]});
});

test('CLI diagnostic operator getter failure cannot escape or discard safe stack frames',()=>{
 const error={stack:'Error: private header\n'+frame};Object.defineProperty(error,'operator',{get(){throw new Error('operator getter failure');}});
 let result;assert.doesNotThrow(()=>{result=selftestErrorDiagnostics(error,enabled);});assert.deepEqual(result,{diagnosticErrors:'code-stack-v1',operator:null,frames:[frame.trimStart()]});
});

test('CLI diagnostics reject unknown operators non-string stacks and malformed option pairs without mutation',()=>{
 const error={operator:'PRIVATE_OPERATOR_VALUE',stack:{private:'PRIVATE_STACK_VALUE'}};const argv=[...enabled];
 assert.deepEqual(selftestErrorDiagnostics(error,argv),{diagnosticErrors:'code-stack-v1',operator:null,frames:[]});assert.deepEqual(argv,enabled);assert.deepEqual(error,{operator:'PRIVATE_OPERATOR_VALUE',stack:{private:'PRIVATE_STACK_VALUE'}});
 for(const malformed of [null,{},['selftest','--diagnostic-errors'],['selftest','diagnostic-errors','code-stack-v1']])assert.deepEqual(selftestErrorDiagnostics(error,malformed),{});
});

test('CLI diagnostic frames omit non-frame lines and terminal control characters',()=>{
 const result=selftestErrorDiagnostics({stack:'AssertionError: HEADER_SECRET\nactual: PRIVATE_ACTUAL\nexpected: PRIVATE_EXPECTED\n    at clean\u001b[31m (file:///repo/code.mjs:1:2)\nnot a frame'},enabled);
 assert.equal(result.frames.length,1);assert.ok(result.frames[0].startsWith('at clean'));assert.equal(/[\u0000-\u001f\u007f]/.test(result.frames[0]),false);assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);assert.equal(JSON.stringify(result).includes('HEADER_SECRET'),false);
});
