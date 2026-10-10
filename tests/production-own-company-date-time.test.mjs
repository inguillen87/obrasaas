import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

const cases=[
 {value:'2026-10-10T20:02:51.000Z',label:/10\/10\/2026.*17:02:51 \(hora de Argentina\)/},
 {value:'2026-10-10T03:00:00.000Z',label:/10\/10\/2026.*00:00:00 \(hora de Argentina\)/},
 {value:'2026-10-10T02:59:59.000Z',label:/09\/10\/2026.*23:59:59 \(hora de Argentina\)/},
 {value:'2028-03-01T02:59:59.999Z',label:/29\/02\/2028.*23:59:59 \(hora de Argentina\)/},
];
let fixtureDirectory,probePath,OwnCompanyDateTime;
before(async()=>{
 await loadBindings();
 const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href,serverUrl=pathToFileURL(require.resolve('react-dom/server')).href;
 const source=readFileSync(new URL('../src/app/(identity)/cuenta/own-company-number-panel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
 // Preserve the local formatter and real JSX. Only the component's unused imports are removed.
 const imports=`import React,{useEffect,useRef,useState} from ${JSON.stringify(reactUrl)};\n`;
 const compiled=await transform(imports+source,{filename:'own-company-number-panel.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
 fixtureDirectory=mkdtempSync(path.join(tmpdir(),'obrasaas-own-company-date-time-'));
 const compiledPath=path.join(fixtureDirectory,'own-company-number-panel.mjs');writeFileSync(compiledPath,compiled.code);
 ({OwnCompanyDateTime}=await import(pathToFileURL(compiledPath).href));
 probePath=path.join(fixtureDirectory,'probe.mjs');
 writeFileSync(probePath,`import React from ${JSON.stringify(reactUrl)};\nimport {renderToStaticMarkup} from ${JSON.stringify(serverUrl)};\nimport {OwnCompanyDateTime} from './own-company-number-panel.mjs';\nconst values=${JSON.stringify(cases.map(({value})=>value))};\nprocess.stdout.write(JSON.stringify({hostTimeZone:new Intl.DateTimeFormat().resolvedOptions().timeZone,html:values.map(value=>renderToStaticMarkup(React.createElement(OwnCompanyDateTime,{value})))}));\n`);
});
after(()=>{
 if(!fixtureDirectory)return;
 const parent=path.resolve(tmpdir()),resolved=path.resolve(fixtureDirectory);
 assert.equal(path.dirname(resolved),parent);
 assert.ok(path.basename(resolved).startsWith('obrasaas-own-company-date-time-'));
 rmSync(resolved,{recursive:true,force:true});
});
const render=value=>renderToStaticMarkup(React.createElement(OwnCompanyDateTime,{value}));

test('the actual date component shows Argentine 24-hour instants and retains the original UTC metadata',()=>{
 for(const {value,label} of cases){
  const html=render(value);
  assert.match(html,/^<time datetime="/i);
  assert.ok(html.includes(value));
  assert.match(html,label);
  assert.match(html,/<\/time>$/);
 }
});

test('rendered Argentine dates stay identical while the actual host time zone changes',()=>{
 const expected=cases.map(({value})=>render(value));
 for(const timeZone of ['UTC','America/New_York','Pacific/Auckland']){
  const result=spawnSync(process.execPath,[probePath],{env:{TZ:timeZone},encoding:'utf8',timeout:10000,maxBuffer:16384,windowsHide:true});
  assert.equal(result.error,undefined);
  assert.equal(result.status,0,result.stderr);
  const observed=JSON.parse(result.stdout);
  assert.equal(observed.hostTimeZone,timeZone,'The probe must actually use the requested host time zone');
  assert.deepEqual(observed.html,expected);
 }
});

test('missing invalid or noncanonical values cannot be presented as a confirmed timestamp',()=>{
 const invalid=[undefined,null,'',1234,{},[],new Date('2026-10-10T20:02:51.000Z'),'2026-10-10','2026-10-10T20:02:51','2026-10-10T17:02:51.000-03:00','2026-10-10T20:02:51Z','2026-10-10T20:02:51.0Z','2026-10-10T20:02:51.0000Z','2026-02-29T00:00:00.000Z','2026-04-31T00:00:00.000Z','2026-10-10T24:00:00.000Z','2026-10-10T20:02:60.000Z'];
 for(const value of invalid)assert.equal(render(value),'<span>Fecha no disponible</span>');
});
