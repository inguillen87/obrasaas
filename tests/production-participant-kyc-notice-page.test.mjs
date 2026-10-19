import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';
import {PARTICIPANT_IDENTITY_NOTICE_VERSIONS,participantIdentityNotice,participantIdentityNoticeUrl} from '../src/lib/participant-kyc-notice-links.mjs';

let Page,metadata;
before(async()=>{
 await loadBindings();const require=createRequire(import.meta.url),reactUrl=pathToFileURL(require.resolve('react')).href,linkUrl=pathToFileURL(require.resolve('next/link')).href,geometryUrl=new URL('../src/app/brand/brand-geometry.js',import.meta.url).href,helperUrl=new URL('../src/lib/participant-kyc-notice-links.mjs',import.meta.url).href;
 const common=`import React from ${JSON.stringify(reactUrl)};\nimport Link from ${JSON.stringify(linkUrl)};\nconst styles=new Proxy({}, {get:(_target,key)=>String(key)});\n`;
 const compile=async(relative,imports)=>{const source=readFileSync(new URL(relative,import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,'');const output=await transform(common+imports+source,{filename:relative,jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});return 'data:text/javascript;base64,'+Buffer.from(output.code).toString('base64');};
 // Real page, shared legal components, brand markup and Next Link render here.
 // Only CSS class-name mapping is replaced; notices and query selection are real.
 const brand=await compile('../src/app/brand/brand-logo.js',`import {OBRA_SAAS_STRUCTURE_PATH,OBRA_SAAS_TRACE_PATH} from ${JSON.stringify(geometryUrl)};\n`),legal=await compile('../src/app/legal/legal-page.js',`import {ObraSaasLogo} from ${JSON.stringify(brand)};\n`),page=await compile('../src/app/privacidad/identidad/page.js',`import {LegalEmail,LegalNotice,LegalSection} from ${JSON.stringify(legal)};\nimport {ObraSaasLogo} from ${JSON.stringify(brand)};\nimport {PARTICIPANT_IDENTITY_NOTICES_PATH,PARTICIPANT_IDENTITY_NOTICE_VERSIONS,participantIdentityNotice,participantIdentityNoticeSelection,participantIdentityNoticeUrl} from ${JSON.stringify(helperUrl)};\n`);
 ({default:Page,metadata}=await import(page));
});
const render=async params=>renderToStaticMarkup(await Page({searchParams:Promise.resolve(params)}));
for(const version of PARTICIPANT_IDENTITY_NOTICE_VERSIONS)test('public SSR notice renders the exact full version selected by its chat link: '+version,async()=>{
 const url=new URL(participantIdentityNoticeUrl(version)),notice=participantIdentityNotice(version),html=await render(Object.fromEntries(url.searchParams));assert.ok(html.includes(renderToStaticMarkup(React.createElement('p',{'data-identity-notice-text':version},notice.text))));assert.match(html,/Versión del aviso/);assert.ok(html.includes(version));assert.match(html,/Consultar esta página no autoriza el uso de imágenes ni inicia análisis/);if(notice.automatic){assert.match(html,/revisión manual sin autorizar este análisis/);}else{assert.match(html,/cancelar en WhatsApp y usar la presentación web sin dorso/);assert.match(notice.text,/OpenAI/);}assert.match(html,/href="\/privacidad"/);assert.match(html,/href="mailto:info@obrasaas.com/);assert.doesNotMatch(html,/<form|<input|<button|script|Última actualización/i);assert.equal(metadata.alternates.canonical,'https://obrasaas.com/privacidad/identidad');assert.deepEqual(metadata.robots,{index:false,follow:true,noarchive:true});assert.equal(new URL(metadata.openGraph.url).search,'');
});
for(const params of [{},{aviso:PARTICIPANT_IDENTITY_NOTICE_VERSIONS},{aviso:'<script>private-invalid</script>'},{aviso:'participant-external-ocr-v1'},{aviso:PARTICIPANT_IDENTITY_NOTICE_VERSIONS[0],redirect:'https://evil.invalid/private'}])test('SSR invalid or duplicate query renders a safe index without echo, notice substitution or redirect: '+JSON.stringify(params),async()=>{
 const html=await render(params);assert.match(html,/Elegí el aviso que querés consultar/);assert.doesNotMatch(html,/data-identity-notice-text|private-invalid|evil\.invalid|OpenAI|Hugging Face|<script|<form|<input/);for(const version of PARTICIPANT_IDENTITY_NOTICE_VERSIONS)assert.ok(html.includes(participantIdentityNoticeUrl(version)));assert.equal(metadata.alternates.canonical,'https://obrasaas.com/privacidad/identidad');
});
