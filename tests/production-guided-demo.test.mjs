import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legacyBoundaryKind} from '../src/lib/legacy-access-boundary.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
for(const method of ['GET','HEAD'])test('demo read is public: '+method,()=>assert.equal(legacyBoundaryKind('/demo',method),'public'));
for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])test('demo cannot become a public write: '+method,()=>assert.equal(legacyBoundaryKind('/demo',method),'private-api'));
for(const path of ['/demo/private','/demo-data','/demo.json','/api/demo'])test('no broad public prefix: '+path,()=>assert.ok(['private-page','private-api'].includes(legacyBoundaryKind(path))));
test('demonstration has no business I/O, credential collection, persistence or actor claims',()=>{
 const source=read('src/app/demo/demo-client.js');
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|indexedDB|setCookie|useUser|useAuth|<input|<form|type=["']file|navigator.mediaDevices|verified:\s*true/);
 assert.ok(source.includes('data-demo-only="true"'));assert.ok(source.includes('Sólo ejemplos ficticios.'));assert.ok(source.includes('No solicita DNI, fotos, audios ni datos de empleados.'));assert.ok(source.includes('0 operaciones reales'));
});
test('home demo destinations do not point to protected dashboard and lead receipts are not fabricated',()=>{
 const source=read('src/app/page.js');assert.ok((source.match(/href="\/demo"/g)||[]).length>=2);
 assert.doesNotMatch(source,/href="\/dashboard"|setLeadSubmitted|handleLeadSubmit|fetch\(['"]\/api\/state|Plataforma activa — 5 obras|Compliance normativo|Setup en 3 minutos/);
 assert.ok(source.includes('Piloto de campo en preparación'));
});
test('demonstration retains the approved brand and independent account path',()=>{
 const source=read('src/app/demo/demo-client.js');assert.ok(source.includes('ObraSaasLogo'));assert.ok(source.includes('href="/sign-in"'));
 assert.ok(source.includes('Reiniciar demo'));assert.ok(source.includes('se reinicia al recargar'));
});
