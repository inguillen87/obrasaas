import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),React=require('react'),{parse}=require('@babel/parser'),babel=require('next/dist/compiled/babel/bundle');
const source=readFileSync(new URL('../src/app/(identity)/cuenta/participant-kyc-capture.js',import.meta.url),'utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
// Compile the actual component, preserving its callbacks. Only imports for the
// camera child, styles and fixed notice are supplied as controlled test ports.
const body=ast.program.body.filter(node=>node.type!=='ImportDeclaration').map(node=>source.slice((node.type==='ExportNamedDeclaration'?node.declaration:node).start,node.end)).join('\n');
const compiled=babel.core().transformSync(body,{configFile:false,babelrc:false,presets:[[babel.presetReact(),{runtime:'classic'}]]}).code;
const Photo=()=>null;
const {ParticipantKycCapture,participantCaptureRetakeView}=Function('React','KycPhotoPreparation','CAPTURE_QUALITY_NOTICE','styles',compiled+'\nreturn {ParticipantKycCapture,participantCaptureRetakeView};')(React,Photo,'Aviso sintético de calidad',new Proxy({},{get:(_target,key)=>String(key)}));
const fields=['front','back','selfie'],all={front:'synthetic-front',back:'synthetic-back',selfie:'synthetic-selfie',backConsent:true,consent:true,biometricNoticeVersion:'participant-private-biometric-v3',biometricMode:'ASSISTED',biometricConsent:true,ocrConsent:true};
function nodes(tree,predicate,visible=true,result=[]){
 for(const node of React.Children.toArray(tree)){
  if(!React.isValidElement(node))continue;
  const shown=visible&&node.props.hidden!==true;
  if(predicate(node,shown))result.push(node);
  nodes(node.props.children,predicate,shown,result);
 }
 return result;
}
const text=tree=>React.Children.toArray(tree).map(node=>React.isValidElement(node)?text(node.props.children):String(node)).join('');
function fixture({step=0,value=all,retakes={},locked=false}={}){
 const calls=[],props={step,value,locked,captureRetakes:retakes,notices:{privacyNotice:{text:'Aviso sintético'},documentBackNotice:{text:'Dorso sintético'},privateBiometricNotice:{version:'participant-private-biometric-v3',text:'Comparación sintética'}},backAvailable:true,onStep:n=>calls.push(['step',n]),onFile:(...args)=>calls.push(['file',...args]),onBackConsent:n=>calls.push(['back-consent',n]),onBiometricMode:n=>calls.push(['biometric-mode',n]),onEdit:(...args)=>calls.push(['edit',...args])};
 return {tree:ParticipantKycCapture(props),calls,props};
}
function button(f,label){const found=nodes(f.tree,(node,shown)=>shown&&node.type==='button'&&text(node.props.children)===label);assert.equal(found.length,1,label);return found[0];}

test('normal capture retains all three steps and never offers a correction shortcut',()=>{
 const f=fixture();assert.deepEqual(f.calls,[]);assert.equal(nodes(f.tree,n=>n.props['data-kyc-capture-recovery']).length,0);assert.equal(nodes(f.tree,n=>n.type==='button'&&text(n.props.children)==='Revisar presentación').length,0);
 const next=button(f,'Continuar al dorso');assert.equal(next.props.type,'button');next.props.onClick();assert.deepEqual(f.calls,[['step',1]]);
});

for(const [step,field]of fields.entries())test('a confirmed retake identifies only '+field+' and reports the retained images without editing any authorization',()=>{
 const value={...all,[field]:''},before=structuredClone(value),f=fixture({step,value,retakes:{[field]:1}}),messages=nodes(f.tree,n=>n.props['data-kyc-capture-recovery']===field);
 assert.equal(messages.length,1);assert.match(text(messages[0]),/Repetí sólo esta fotografía/);const retained=nodes(messages[0],n=>n.props.role==='listitem');assert.equal(retained.length,2);assert.ok(retained.every(n=>/conservad[oa]$/.test(text(n))));assert.deepEqual(value,before);assert.deepEqual(f.calls,[]);
 const completion=nodes(f.tree,n=>n.type==='li').map(n=>n.props['data-complete']);for(const [index,name]of fields.entries())assert.equal(completion[index],name!==field,name);
 const photos=nodes(f.tree,n=>n.type===Photo),priorPhotos=nodes(fixture().tree,n=>n.type===Photo);assert.equal(photos.length,3);for(const name of fields.filter(name=>name!==field))assert.equal(photos.find(n=>n.props.kind===name).key,priorPhotos.find(n=>n.props.kind===name).key);
});

test('replacing only the front returns directly to the existing review step without submitting or choosing consent',()=>{
 const f=fixture({step:0,retakes:{front:1}}),before=structuredClone(f.props.value),next=button(f,'Revisar presentación');assert.equal(next.props.type,'button');assert.equal(next.props.disabled,false);next.props.onClick();assert.deepEqual(f.calls,[['step',2]]);assert.deepEqual(f.props.value,before);assert.equal(f.props.value.consent,true);assert.equal(f.props.value.biometricMode,'ASSISTED');
});

test('an incomplete set cannot take the front correction shortcut',()=>{
 for(const value of [{...all,front:''},{...all,selfie:''},{...all,back:''}]){const f=fixture({step:0,value,retakes:{front:1}});assert.equal(nodes(f.tree,n=>n.type==='button'&&text(n.props.children)==='Revisar presentación').length,0);const next=button(f,'Continuar al dorso');assert.equal(next.props.disabled,!value.front);}
});

test('optional omitted back stays omitted and is never claimed as retained or consented',()=>{
 const value={...all,back:'',backConsent:false},before=structuredClone(value),view=participantCaptureRetakeView(value,{front:1},0);assert.deepEqual(view.retained,[{field:'selfie',label:'Selfie'}]);assert.equal(view.readyForReview,true);const f=fixture({value,retakes:{front:1}});button(f,'Revisar presentación').props.onClick();assert.deepEqual(f.calls,[['step',2]]);assert.deepEqual(value,before);
});

test('correcting the back skips repeating an already prepared selfie',()=>{
 const f=fixture({step:1,retakes:{back:1}}),next=button(f,'Revisar presentación');assert.equal(next.props.type,'button');next.props.onClick();assert.deepEqual(f.calls,[['step',2]]);
});

test('an uncertain or currently dispatched attempt stays locked without an unsaved correction claim or enabled shortcut',()=>{
 const f=fixture({step:0,retakes:{front:1},locked:true});assert.equal(nodes(f.tree,n=>n.props['data-kyc-capture-recovery']).length,0);const next=button(f,'Continuar al dorso');assert.equal(next.props.disabled,true);assert.deepEqual(f.calls,[]);assert.equal(nodes(f.tree,n=>n.type==='button'&&text(n.props.children)==='Revisar presentación').length,0);assert.deepEqual(f.props.value,all);
});

test('no retake view is inferred from empty, malformed, unknown or other-step counters',()=>{
 for(const retakes of [{},{front:0},{front:-1},{front:1.5},{front:Infinity},{front:'1'},{back:1},{unknown:2}])assert.equal(participantCaptureRetakeView(all,retakes,0),null);
 for(const step of [-1,3,undefined,null,'front'])assert.equal(participantCaptureRetakeView(all,{front:1},step),null);
});
