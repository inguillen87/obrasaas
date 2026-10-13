import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {createPilotMediaAnalyzer} from '../src/lib/pilot-media.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const PNG=Buffer.from('89504e470d0a1a0a0000000a','hex').toString('base64');
const env={OPENAI_API_KEY:'synthetic-test-credential'};
const hash=value=>createHash('sha256').update(value).digest('hex');
const dni={isDni:true,nombreCompleto:'Persona sintética',dni:'12345678'};
const photo={isWorksitePhoto:true,phase:'General',aiAnalysis:'Cuadro sintético de obra.',isIncident:false,incidentSeverity:null,actionRecommendation:null};
const chatUsage={prompt_tokens:24,completion_tokens:6,total_tokens:30,prompt_tokens_details:{cached_tokens:8},completion_tokens_details:{reasoning_tokens:2}};
const tokenUsage={inputTokens:'24',outputTokens:'6',totalTokens:'30',cachedInputTokens:'8',reasoningOutputTokens:'2'};
function sampledVideo({spoken=false}={}){
 const frames=Array.from({length:4},(_,index)=>{const buffer=Buffer.from([255,216,255,224,index]);return {base64:buffer.toString('base64'),mimeType:'image/jpeg',bytes:buffer.length,sha256:hash(buffer),capturedAtSeconds:index/2};});
 return {frames,sampling:{version:'server-video-frames-v1',sourceSha256:'b'.repeat(64),sourceContentType:'video/mp4',sourceBytes:1000,durationSeconds:2,frameCount:4,audioAnalyzed:false},context:'Contexto sintético.',...(spoken?{transcriptContext:{authority:'PROVIDER_TRANSCRIPTION_UNREVIEWED',sourceSha256:'b'.repeat(64),text:'Una nota sintética.',transcriptSha256:hash('Una nota sintética.')}}:{})};
}
const inputFor=method=>method==='analyzeVideo'?sampledVideo():method==='transcribeAudio'?{buffer:Buffer.from('synthetic audio fixture'),mimeType:'audio/wav'}:{base64:PNG,mimeType:'image/png'};
function chatData({raw=dni,finish='stop',refusal=null,model='gpt-4o',usage=chatUsage}={}){
 return {id:'chatcmpl-synthetic',model,usage,choices:[{finish_reason:finish,message:{content:typeof raw==='string'?raw:JSON.stringify(raw),refusal}}]};
}
function fixture({response=()=>Response.json(chatData(),{headers:{'x-request-id':'req_synthetic'}}),environment=env}={}){
 const events=[],facts=[],calls=[];
 const hooks={beforeDispatch:async preflight=>{events.push(['before',preflight]);},observeUsage:async fact=>{events.push(['observe']);facts.push(fact);},dispatchUnknown:async()=>{events.push(['unknown']);}};
 const analyzer=createPilotMediaAnalyzer({environment:()=>environment,fetchImpl:async(url,options)=>{events.push(['fetch']);calls.push({url,options});return response(url,options);}});
 return {analyzer,events,facts,calls,hooks};
}

for(const method of ['analyzeDni','analyzePhoto','analyzeVideo','transcribeAudio'])test(method+' observes provider usage before returning the business result',async()=>{
 const audio=method==='transcribeAudio',f=fixture({response:()=>Response.json(audio?{text:'Una nota sintética.',usage:{type:'tokens',input_tokens:24,output_tokens:6,total_tokens:30}}:chatData({raw:method==='analyzeDni'?dni:photo}),{headers:{'x-request-id':'req_synthetic'}})});
 const result=await f.analyzer[method]({...inputFor(method),...f.hooks});
 assert.equal(result.success,true);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe']);assert.equal(f.calls.length,1);
 assert.deepEqual(f.events[0][1],{requestedModel:audio?'gpt-transcribe':'gpt-4o',endpoint:audio?'audio.transcriptions':'chat.completions'});
 assert.equal(f.facts[0].state,'OBSERVED');assert.deepEqual(f.facts[0].measurement,{unit:'TOKENS',audioSeconds:null});
 assert.deepEqual(f.facts[0].usage,audio?{...tokenUsage,cachedInputTokens:null,reasoningOutputTokens:null}:tokenUsage);
 assert.match(f.facts[0].providerRequestHash,/^[a-f0-9]{64}$/);if(!audio)assert.match(f.facts[0].providerResponseHash,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(f.facts),/Persona|Cuadro|nota sintética|chatcmpl-synthetic|req_synthetic|base64|credential/);
 assert.equal(result.usage,undefined);
});

test('an asynchronous fence completes before fetch can start',async()=>{
 const f=fixture();let release;const gate=new Promise(resolve=>{release=resolve;});let entered;const started=new Promise(resolve=>{entered=resolve;});
 const pending=f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks,beforeDispatch:async()=>{entered();await gate;f.events.push(['before']);}});
 await started;assert.equal(f.calls.length,0);release();assert.equal((await pending).success,true);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe']);
});

for(const method of ['analyzeDni','transcribeAudio'])test(method+' checks cancellation again after a completed server fence and does not fetch',async()=>{
 const f=fixture(),controller=new AbortController();
 const result=await f.analyzer[method]({...inputFor(method),...f.hooks,signal:controller.signal,beforeDispatch:async()=>{f.events.push(['before']);await Promise.resolve();controller.abort();}});
 assert.equal(result.success,false);assert.equal(f.calls.length,0);assert.equal(f.facts.length,0);assert.deepEqual(f.events.map(event=>event[0]),['before','unknown']);
});

test('a completed provider response awaits durable usage observation before returning',async()=>{
 const f=fixture();let release;const gate=new Promise(resolve=>{release=resolve;});let enter;const observationStarted=new Promise(resolve=>{enter=resolve;});let returned=false;
 const pending=f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks,observeUsage:async fact=>{enter();await gate;f.facts.push(fact);f.events.push(['observe']);}}).then(result=>{returned=true;return result;});
 await observationStarted;assert.equal(returned,false);assert.equal(f.calls.length,1);assert.equal(f.facts.length,0);release();assert.equal((await pending).success,true);assert.equal(f.facts[0].state,'OBSERVED');assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe']);
});

for(const method of ['analyzeDni','transcribeAudio'])test(method+' rejects a failed server fence without a dispatch or unknown record',async()=>{
 const f=fixture(),fenceError=new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
 await assert.rejects(f.analyzer[method]({...inputFor(method),...f.hooks,beforeDispatch:async()=>{throw fenceError;}}),error=>error===fenceError);
 assert.equal(f.calls.length,0);assert.equal(f.facts.length,0);assert.deepEqual(f.events,[]);
});

test('caller-provided provider routing cannot override the prepared endpoint or model',async()=>{
 const f=fixture(),result=await f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks,endpoint:'https://foreign.invalid',requestedModel:'foreign-model',providerModel:'foreign-model'});
 assert.equal(result.success,true);assert.equal(f.calls[0].url,'https://api.openai.com/v1/chat/completions');assert.equal(JSON.parse(f.calls[0].options.body).model,'gpt-4o');assert.deepEqual(f.events[0][1],{requestedModel:'gpt-4o',endpoint:'chat.completions'});
});

test('local input, missing configuration and pre-cancelled requests never invoke usage hooks',async()=>{
 const cases=[['analyzeDni',{base64:'bad'},env],['analyzePhoto',{base64:PNG},{}],['analyzeVideo',{frames:[],sampling:{}},env],['transcribeAudio',{buffer:Buffer.alloc(0)},env],['transcribeAudio',inputFor('transcribeAudio'),{...env,OPENAI_TRANSCRIPTION_MODEL:'invalid/model'}],['analyzeDni',{...inputFor('analyzeDni'),signal:AbortSignal.abort()},env],['transcribeAudio',{...inputFor('transcribeAudio'),signal:AbortSignal.abort()},env]];
 for(const [method,input,environment] of cases){const f=fixture({environment});assert.equal((await f.analyzer[method]({...input,...f.hooks})).success,false);assert.deepEqual(f.events,[]);}
});

test('nonfunction hooks are rejected before fetch',async()=>{
 const f=fixture();await assert.rejects(f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks,observeUsage:'invalid'}),TypeError);assert.equal(f.calls.length,0);assert.deepEqual(f.events,[]);
});

for(const options of [{finish:'length'},{finish:'content_filter'},{refusal:'Synthetic refusal'},{raw:'invalid-json'},{raw:{isDni:false}},{raw:{...dni,dni:null}}])test('DNI business rejection keeps the measured usage: '+JSON.stringify(options),async()=>{
 const f=fixture({response:()=>Response.json(chatData(options))});const result=await f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks});
 assert.equal(result.success,false);assert.equal(f.facts[0].state,'OBSERVED');assert.deepEqual(f.facts[0].usage,tokenUsage);assert.equal(f.calls.length,1);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe']);
});

test('contextual video model rejection retains usage before model acceptance',async()=>{
 const f=fixture({response:()=>Response.json(chatData({raw:{visual:photo,reportedSummary:'Nota sintética.',uncertainties:[]},model:'gpt-4o-2099-01-01'}))});
 const result=await f.analyzer.analyzeVideo({...sampledVideo({spoken:true}),...f.hooks});assert.equal(result.code,'AI_RESPONSE_MODEL_UNCONFIRMED');assert.equal(f.facts[0].state,'OBSERVED');assert.deepEqual(f.facts[0].usage,tokenUsage);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe']);
});

for(const method of ['analyzeDni','transcribeAudio'])for(const measured of [true,false])test(method+' HTTP rejection retains '+(measured?'reported consumption':'explicit unmeasured consumption'),async()=>{
 const audio=method==='transcribeAudio',data={error:{message:'PRIVATE_PROVIDER_ERROR'},...(measured?(audio?{usage:{type:'duration',seconds:4}}:{usage:chatUsage}):{})};
 const f=fixture({environment:{...env,OPENAI_TRANSCRIPTION_MODEL:'whisper-1'},response:()=>Response.json(data,{status:401,headers:{'x-request-id':'req_rejected'}})}),result=await f.analyzer[method]({...inputFor(method),...f.hooks});
 assert.equal(result.code,audio?'AUDIO_PROVIDER_REQUEST_REJECTED':'AI_PROVIDER_REQUEST_REJECTED');assert.equal(result.providerStatus,401);assert.equal(result.success,false);assert.equal(f.facts[0].state,measured?'OBSERVED':'UNMEASURED');
 assert.deepEqual(f.facts[0].measurement,{unit:measured?(audio?'AUDIO_SECONDS':'TOKENS'):'UNMEASURED',audioSeconds:measured&&audio?'4':null});assert.doesNotMatch(JSON.stringify([result,f.facts]),/PRIVATE_PROVIDER_ERROR/);assert.equal(f.calls.length,1);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe']);
});

for(const method of ['analyzeDni','transcribeAudio'])for(const [kind,response] of [
 ['network failure',()=>{throw new Error('PRIVATE_NETWORK_ERROR');}],
 ['malformed JSON',()=>new Response('{incomplete')],
 ['oversized response',()=>new Response('x'.repeat(70000))],
 ['missing body',()=>new Response(null)],
 ['failed body stream',()=>new Response(new ReadableStream({start(controller){controller.error(new Error('PRIVATE_STREAM_ERROR'));}}))]
])test(method+' records an uncertain '+kind+' once without replay',async()=>{
 const f=fixture({response}),result=await f.analyzer[method]({...inputFor(method),...f.hooks});assert.equal(result.success,false);assert.equal(f.calls.length,1);assert.equal(f.facts.length,0);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','unknown']);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
});

test('an unreadable HTTP error is unknown and retains the existing rejection status',async()=>{
 const f=fixture({response:()=>new Response('{',{status:403})}),result=await f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks});assert.equal(result.code,'AI_PROVIDER_REQUEST_REJECTED');assert.equal(result.providerStatus,403);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','unknown']);
});

for(const method of ['analyzeDni','transcribeAudio'])test(method+' retains a bodyless known HTTP rejection as unmeasured with a private request hash',async()=>{
 const f=fixture({response:()=>new Response(null,{status:429,headers:{'x-request-id':'req_bodyless'}})}),result=await f.analyzer[method]({...inputFor(method),...f.hooks});
 assert.equal(result.success,false);assert.equal(result.providerStatus,429);assert.equal(f.facts[0].state,'UNMEASURED');assert.equal(f.facts[0].model,null);assert.equal(f.facts[0].usage,null);assert.deepEqual(f.facts[0].measurement,{unit:'UNMEASURED',audioSeconds:null});assert.match(f.facts[0].providerRequestHash,/^[a-f0-9]{64}$/);assert.equal(f.facts[0].providerResponseHash,null);assert.doesNotMatch(JSON.stringify(f.facts),/req_bodyless/);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe']);
});

test('an interrupted provider response marks the attempted dispatch unknown',async()=>{
 const controller=new AbortController();let cancelled=0;
 const f=fixture({response:()=>new Response(new ReadableStream({start(){queueMicrotask(()=>controller.abort());},cancel(){cancelled++;}}))}),result=await f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks,signal:controller.signal});
 assert.equal(result.success,false);assert.equal(f.calls.length,1);assert.equal(cancelled,1);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','unknown']);
});

test('oversized provider streams are cancelled and their reader lock is released',async()=>{
 let cancelled=0;const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(70000));},cancel(){cancelled++;}}));
 const f=fixture({response:()=>response}),result=await f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks});assert.equal(result.success,false);assert.equal(cancelled,1);assert.equal(response.body.locked,false);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','unknown']);
});

test('failed usage persistence attempts unknown once and exposes the trusted hook error',async()=>{
 const f=fixture(),observerError=new Error('Synthetic usage write failed');
 await assert.rejects(f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks,observeUsage:async fact=>{f.events.push(['observe']);assert.equal(fact.state,'OBSERVED');throw observerError;}}),error=>error===observerError);
 assert.equal(f.calls.length,1);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe','unknown']);
});

test('failed unknown persistence is distinguishable and never triggers replay',async()=>{
 const f=fixture({response:()=>{throw new Error('Synthetic network failure');}}),unknownError=new Error('Synthetic unknown write failed');
 await assert.rejects(f.analyzer.analyzeDni({...inputFor('analyzeDni'),...f.hooks,dispatchUnknown:async()=>{f.events.push(['unknown']);throw unknownError;}}),error=>error===unknownError);assert.equal(f.calls.length,1);assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','unknown']);
});

test('whisper JSON without billable usage cannot infer seconds from duration, bytes or transcript',async()=>{
 const f=fixture({environment:{...env,OPENAI_TRANSCRIPTION_MODEL:'whisper-1'},response:()=>Response.json({text:'Una nota sintética con muchas palabras.',duration:12.5,words:[{word:'nota',start:0,end:12.5}]})});
 const result=await f.analyzer.transcribeAudio({...inputFor('transcribeAudio'),...f.hooks});assert.equal(result.success,true);assert.equal(result.providerModel,'whisper-1');assert.equal(f.facts[0].state,'UNMEASURED');assert.equal(f.facts[0].usage,null);assert.deepEqual(f.facts[0].measurement,{unit:'UNMEASURED',audioSeconds:null});assert.equal(f.calls[0].options.body.get('response_format'),'json');
});

test('transcription keeps billable provider seconds separately from top-level source duration',async()=>{
 const f=fixture({environment:{...env,OPENAI_TRANSCRIPTION_MODEL:'whisper-1'},response:()=>Response.json({text:'Una nota sintética.',duration:3.32,usage:{type:'duration',seconds:4}})}),result=await f.analyzer.transcribeAudio({...inputFor('transcribeAudio'),...f.hooks});
 assert.equal(result.success,true);assert.equal(f.facts[0].state,'OBSERVED');assert.equal(f.facts[0].usage,null);assert.deepEqual(f.facts[0].measurement,{unit:'AUDIO_SECONDS',audioSeconds:'4'});
});

test('rejected speech retains measured usage before language/text validation',async()=>{
 const f=fixture({response:()=>Response.json({text:'',languages:[],usage:{type:'tokens',input_tokens:24,output_tokens:6,total_tokens:30}})}),result=await f.analyzer.transcribeAudio({...inputFor('transcribeAudio'),...f.hooks});
 assert.equal(result.code,'AUDIO_TRANSCRIPTION_UNCONFIRMED');assert.equal(f.facts[0].state,'OBSERVED');assert.equal(f.facts[0].usage.totalTokens,'30');assert.deepEqual(f.events.map(event=>event[0]),['before','fetch','observe']);
});
