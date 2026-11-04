import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonicalParticipantKycReviewedSourceHash} from '../scripts/fixtures/canonical-participant-kyc.mjs';

const pins=[
 {path:'scripts/lib/synthetic-capture-quality.mjs',bytes:658,sha256:'ca3114f1c6ffd88d321b1251ef1c502765b4ccb2c0be54915f0ee83e0668e420',gitOid:'f99ed76a76f732512270d1781ee8a16241064f95'},
 {path:'src/lib/capture-quality-policy.mjs',bytes:3054,sha256:'94cfd5f24158983a93430158a33716119cb17783f6067053610a788638dd5057',gitOid:'9248e5b9f95e4d9dd6d83606c3f00788348632a5'}
];
const digest=value=>createHash('sha256').update(value).digest('hex');
const lfSource=pin=>{
 const raw=readFileSync(new URL('../'+pin.path,import.meta.url)),text=raw.toString('utf8');
 assert.ok(Buffer.from(text,'utf8').equals(raw));
 const lf=Buffer.from(text.replace(/\r\n/g,'\n'),'utf8');
 assert.equal(lf.length,pin.bytes);assert.equal(digest(lf),pin.sha256);
 assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+lf.length+'\0'),lf])).digest('hex'),pin.gitOid,'The independent682 actual Git blob authority remains exact');
 return lf;
};
for(const pin of pins){
 test(pin.path+': actual Git-pinned LF and Windows CRLF source are equivalent',()=>{
  const lf=lfSource(pin),crlf=Buffer.from(lf.toString('utf8').replace(/\n/g,'\r\n'),'utf8'),before=Buffer.from(crlf);
  assert.notEqual(digest(lf),digest(crlf));
  assert.equal(canonicalParticipantKycReviewedSourceHash(pin.path,lf),pin.sha256);
  assert.equal(canonicalParticipantKycReviewedSourceHash(pin.path,crlf),pin.sha256);
  assert.deepEqual(crlf,before,'Checking text never mutates caller bytes');
 });
 test(pin.path+': changed source content fails the existing fixed pin',()=>{
  const changed=Buffer.from(lfSource(pin));changed[0]^=1;
  assert.throws(()=>canonicalParticipantKycReviewedSourceHash(pin.path,changed),{code:'ERR_ASSERTION'});
 });
 test(pin.path+': lone CR and CRCRLF are retained and rejected',()=>{
  const text=lfSource(pin).toString('utf8');
  assert.throws(()=>canonicalParticipantKycReviewedSourceHash(pin.path,Buffer.from(text.replace('\n','\r'))),{code:'ERR_ASSERTION'});
  assert.throws(()=>canonicalParticipantKycReviewedSourceHash(pin.path,Buffer.from(text.replace('\n','\r\r\n'))),{code:'ERR_ASSERTION'});
 });
 test(pin.path+': invalid UTF-8 is rejected before source hashing',()=>{
  const lf=lfSource(pin),invalid=Buffer.concat([Buffer.from([0xff]),lf.subarray(1)]);
  assert.throws(()=>canonicalParticipantKycReviewedSourceHash(pin.path,invalid),/strict UTF-8/);
  assert.throws(()=>canonicalParticipantKycReviewedSourceHash(pin.path,Buffer.concat([Buffer.from([0xc0,0xaf]),lf.subarray(2)])),/strict UTF-8/);
 });
}
test('only the two exact declared text callers can use source portability',()=>{
 const lf=lfSource(pins[0]);
 for(const sourcePath of ['public/bim_render.png','src/lib/private-capture-quality.mjs','src/lib/capture-quality-policy.mjs/../capture-quality-policy.mjs','./scripts/lib/synthetic-capture-quality.mjs','SCRIPTS/lib/synthetic-capture-quality.mjs','__proto__','constructor',null,42]){
  assert.throws(()=>canonicalParticipantKycReviewedSourceHash(sourcePath,lf),/Only the two reviewed KYC text sources/);
 }
 assert.throws(()=>canonicalParticipantKycReviewedSourceHash(pins[0].path,lf.toString('utf8')),/must be a Buffer/);
 assert.throws(()=>canonicalParticipantKycReviewedSourceHash(pins[0].path,new Uint8Array(lf)),/must be a Buffer/);
});
test('binary and model data cannot be admitted as either reviewed source',()=>{
 const png=Buffer.from('89504e470d0a1a0a','hex'),model=Buffer.from([0x00,0xff,0x0d,0x0a,0x01]);
 for(const pin of pins)for(const value of [png,model])assert.throws(()=>canonicalParticipantKycReviewedSourceHash(pin.path,value),{code:'ERR_ASSERTION'});
 assert.equal(png.toString('hex'),'89504e470d0a1a0a','Binary signature stays byte-exact');
});
test('shared fixture calls source portability only at its two text hash guards',()=>{
 const source=readFileSync(new URL('../scripts/fixtures/canonical-participant-kyc.mjs',import.meta.url),'utf8');
 assert.equal([...source.matchAll(/canonicalParticipantKycReviewedSourceHash\(/g)].length,3,'One pure declaration and exactly two fixed callers');
 assert.ok(source.includes("canonicalParticipantKycReviewedSourceHash('scripts/lib/synthetic-capture-quality.mjs',qualityHelperBytes)"));
 assert.ok(source.includes("canonicalParticipantKycReviewedSourceHash('src/lib/capture-quality-policy.mjs',readFileSync(new URL('../../src/lib/capture-quality-policy.mjs',import.meta.url)))"));
 for(const byteHash of ['hash(Buffer.from(input.image.buffer))','hash(images.front)','hash(images.selfie)'])assert.ok(source.includes(byteHash));
});
