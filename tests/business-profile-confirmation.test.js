import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmsBusinessProfileUpdate } from '../src/lib/organization-business-profile.js';
const command={kind:'ARCHITECTURE',market:'MIXED',expectedRevision:1};const scope={organizationId:'org-a',projectId:'project-a'};
const result={...scope,profile:{configured:true,kind:'ARCHITECTURE',market:'MIXED',revision:2},unchanged:false};
test('only a matching authoritative profile is confirmed',()=>assert.equal(confirmsBusinessProfileUpdate(result,command,scope),true));
for(const change of [{organizationId:'other'},{projectId:'other'},{unchanged:undefined},{profile:{...result.profile,revision:1}},{profile:{...result.profile,revision:3}},{profile:{...result.profile,market:'PUBLIC'}},{profile:{...result.profile,kind:'CONSTRUCTOR'}},{profile:{...result.profile,configured:false}}])test('incorrect confirmation fails closed '+JSON.stringify(change),()=>assert.equal(confirmsBusinessProfileUpdate({...result,...change},command,scope),false));
test('verified no-change response can retain the current revision',()=>assert.equal(confirmsBusinessProfileUpdate({...result,unchanged:true,profile:{...result.profile,revision:1}},command,scope),true));
