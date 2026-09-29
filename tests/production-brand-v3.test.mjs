import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BRAND_PUBLIC_ASSETS} from '../src/lib/brand-assets.mjs';
import {legacyBoundaryKind} from '../src/lib/legacy-access-boundary.js';
import {OBRA_SAAS_STRUCTURE_PATH,OBRA_SAAS_TRACE_PATH} from '../src/app/brand/brand-geometry.js';
const file=path=>readFileSync(new URL('../'+path,import.meta.url));
const provenance=JSON.parse(file('docs/production/brand-v3-source.json'));
const manifest=JSON.parse(file('public/manifest.json'));
for(const [name,digest] of Object.entries(provenance.files))test('preserves approved v3 source: '+name,()=>{
 let bytes=file(name);
 if(name==='src/app/brand/brand-logo.js') bytes=Buffer.from(bytes.toString().replace('\n      data-brand-mark="obrasaas-v3"','').replace(' data-brand="obrasaas-v3"',''));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),digest,name);
});
for(const route of BRAND_PUBLIC_ASSETS)test('brand asset is public read-only: '+route,()=>{
 assert.equal(legacyBoundaryKind(route,'GET'),'public');assert.equal(legacyBoundaryKind(route,'HEAD'),'public');
 for(const method of ['POST','DELETE','PATCH','PUT'])assert.equal(legacyBoundaryKind(route,method),'private-api');
 assert.ok(existsSync(new URL('../'+(route.startsWith('/brand/')?'public':'src/app')+route,import.meta.url)));
});
test('brand route allowlist does not expose directories or arbitrary paths',()=>{
 for(const path of ['/brand','/brand/private.json','/brand/private.png','/brand/obrasaas-app-icon-192.png/extra','/brand/../api/state','/api/state','/api/v1/workers'])assert.notEqual(legacyBoundaryKind(path),'public');
});
test('vectors retain the source geometry without scripts, fonts or remote references',()=>{
 for(const name of Object.keys(provenance.files).filter(name=>name.endsWith('.svg'))){const text=file(name).toString();
 assert.ok(text.includes(OBRA_SAAS_STRUCTURE_PATH),name);assert.ok(text.includes(OBRA_SAAS_TRACE_PATH),name);
 assert.doesNotMatch(text,/<script\b|<text\b|(?:href|src)=["']https?:/i);
 }
});

test('PNG launchers and Apple icon retain correct dimensions',()=>{
 for(const [name,size] of [['public/brand/obrasaas-app-icon-192.png',192],['public/brand/obrasaas-app-icon-512.png',512],['public/brand/obrasaas-app-icon-1024.png',1024],['public/brand/obrasaas-maskable-512.png',512],['src/app/icon.png',512],['src/app/apple-icon.png',180]]){
  const bytes=file(name);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
 }
 assert.equal(file('src/app/favicon.ico').readUInt16LE(2),1);
});
test('manifest preserves installed app identity and uses distinct maskable icon',()=>{
 assert.equal(manifest.id,'/dashboard');assert.equal(manifest.start_url,'/dashboard');assert.equal(manifest.scope,'/');
 assert.equal(manifest.theme_color,'#08110F');assert.equal(manifest.background_color,'#08110F');
 assert.equal(manifest.screenshots,undefined);
 assert.equal(manifest.icons.length,4);assert.equal(manifest.icons.filter(icon=>icon.purpose==='maskable').length,1);
 for(const icon of manifest.icons){assert.ok(BRAND_PUBLIC_ASSETS.includes(icon.src));assert.ok(icon.src.startsWith('/brand/'));}
});
test('legacy icon URLs deliver the new canonical app icon',()=>{
 assert.deepEqual(file('public/icon-192.svg'),file('public/brand/obrasaas-app-icon.svg'));
 assert.deepEqual(file('public/icon-512.svg'),file('public/brand/obrasaas-app-icon.svg'));
});
for(const path of ['src/app/page.js','src/app/access-notice.js','src/app/(identity)/cuenta/page.js','src/app/(identity)/sign-in/[[...sign-in]]/page.js','src/app/(identity)/sign-up/[[...sign-up]]/page.js','src/app/dashboard/page.js'])test('surface uses the shared mark instead of the old OS tile: '+path,()=>{
 const text=file(path).toString();assert.ok(text.includes('ObraSaasLogo'));assert.doesNotMatch(text,/>OS<\/|>OS<\/div>|brand-logo">OS/);
});
test('logo has canonical fonts, visible accessible text and reduced-motion behavior',()=>{
 const css=file('src/app/brand/brand-logo.module.css').toString(),component=file('src/app/brand/brand-logo.js').toString();
 assert.ok(css.includes('prefers-reduced-motion: reduce'));assert.ok(css.includes('animation: none'));assert.ok(css.includes('--font-manrope'));
 assert.ok(component.includes('<strong>Obra</strong><span>SaaS</span>'));assert.ok(component.includes('aria-hidden="true"'));
 for(const path of ['src/app/access-notice.module.css','src/app/(identity)/identity.module.css'])assert.doesNotMatch(file(path).toString(),/\.brand\s*>?\s*span\s*\{/);
});
