import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyBoundaryKind} from '../src/lib/legacy-access-boundary.js';
test('only the exact POST worker entry delegates to its independent body HMAC verifier',()=>{
 assert.equal(legacyBoundaryKind('/api/internal/biometric-analysis','POST'),'signed-protocol');
 for(const method of ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS'])assert.equal(legacyBoundaryKind('/api/internal/biometric-analysis',method),'private-api');
 for(const path of ['/api/internal/biometric-analysis/fake','/api/internal/biometric-analysis-extra','/api/internal','/api/internal/another-worker'])assert.equal(legacyBoundaryKind(path,'POST'),'private-api');
});
