import test from 'node:test';
import assert from 'node:assert/strict';
import {officeReviewSnapshot,officeAdminSnapshot,officeEventLabels} from '../src/app/(identity)/cuenta/office-review-view.mjs';

const reference={scope:'a'.repeat(64),projectId:'review-project'};
const configuration=()=>({version:1,connectionRef:'office_connection_'+'b'.repeat(64),wabaRef:'office_waba_'+'c'.repeat(64),phoneNumberRef:'office_phone_'+'d'.repeat(64),connectionStatus:'CONNECTED',enabled:true,mode:'COMPANY',channelRevision:5,assignmentRevision:2,observedAt:'2026-10-09T00:00:00.000Z',evidenceOrigin:'STORED_AUTHORIZED_CONNECTION'});
const snapshot=(connection=null)=>({...reference,projectName:'Obra de revisión',readOnly:true,expiresAt:'2027-10-08T00:00:00.000Z',items:[],canSend:false,canManage:false,connection,canObserveConfiguration:connection!==null});

test('review accepts a missing voluntary selection and a closed saved configuration projection',()=>{
 for(const value of [snapshot(),snapshot(configuration())]){assert.equal(officeReviewSnapshot(value,reference),value);assert.equal(value.canSend,false);assert.equal(value.canManage,false);assert.equal(value.readOnly,true);}
});

test('configuration observation flag must match the nullable selection exactly',()=>{
 for(const value of [snapshot(),snapshot(configuration())]){value.canObserveConfiguration=!value.canObserveConfiguration;assert.throws(()=>officeReviewSnapshot(value,reference));}
 for(const value of [undefined,null,'true',1]){const data=snapshot(configuration());data.canObserveConfiguration=value;assert.throws(()=>officeReviewSnapshot(data,reference));}
 for(const omitted of ['connection','canObserveConfiguration']){const value=snapshot();delete value[omitted];assert.throws(()=>officeReviewSnapshot(value,reference));}
});

test('review rejects broader management, sending, context and unbounded health claims',()=>{
 for(const patch of [{canSend:true},{canManage:true},{readOnly:false},{projectId:'other-project'},{scope:'f'.repeat(64)},{metaHealth:'HEALTHY'},{canSendConfiguration:true},{canManageConnection:true}])assert.throws(()=>officeReviewSnapshot({...snapshot(configuration()),...patch},reference));
});

for(const [name,patch] of [
 ['schema version',{version:2}],['raw connection reference',{connectionRef:'channel-a'}],['raw WABA asset',{wabaRef:'70000001'}],['raw phone asset',{phoneNumberRef:'70000002'}],['invalid connection hash',{connectionRef:'office_connection_'+'x'.repeat(64)}],['mixed reference kind',{phoneNumberRef:'office_waba_'+'d'.repeat(64)}],['disconnected status',{connectionStatus:'DISCONNECTED'}],['disabled status',{enabled:false}],['project mode',{mode:'PROJECT'}],['zero channel revision',{channelRevision:0}],['fractional assignment revision',{assignmentRevision:2.5}],['unsafe revision',{channelRevision:Number.MAX_SAFE_INTEGER+1}],['invalid observation time',{observedAt:'never'}],['noncanonical observation time',{observedAt:'2026-10-09'}],['provider-live origin',{evidenceOrigin:'META_HEALTH_VERIFIED'}],['token',{accessToken:'private'}],['credentials',{encryptedAccessToken:'private'}],['stored metadata',{metadata:{employeeIntakePolicy:{private:true}}}],['phone number',{phoneNumber:'+5491100001111'}],['complete WABA ID',{whatsappBusinessId:'70000001'}],['complete phone ID',{phoneNumberId:'70000002'}],['live health',{healthy:true}],
])test('closed configuration validation rejects '+name,()=>{assert.throws(()=>officeReviewSnapshot(snapshot({...configuration(),...patch}),reference));});

test('closed configuration validation rejects absent fields and non-object selections',()=>{
 for(const key of Object.keys(configuration())){const connection=configuration();delete connection[key];assert.throws(()=>officeReviewSnapshot(snapshot(connection),reference));}
 for(const value of [[],true,'CONNECTED',42])assert.throws(()=>officeReviewSnapshot(snapshot(value),reference));
});

test('stored configuration does not change event uncertainty or claim physical delivery',()=>{
 const value=snapshot(configuration());value.items=[{id:'customer_webhook_'+'e'.repeat(64),receivedAt:'2026-10-09T00:00:00.000Z',kind:'GREETING',signatureVerified:true,processingState:'PROCESSED',replyState:'SEND_UNKNOWN',deliveryStatus:null}];officeReviewSnapshot(value,reference);
 const labels=officeEventLabels(value.items[0]);assert.match(labels.reply,/no confirmado/);assert.equal(labels.delivery,null);
 for(const patch of [{replyState:'SENT',deliveryStatus:'read',physicalRead:true},{phoneNumber:'+5491100001111'},{text:'HOLA'}])assert.throws(()=>officeReviewSnapshot({...value,items:[{...value.items[0],...patch}]},reference));
});

test('administrator snapshots require explicit boolean sharing flags per exact invitation',()=>{
 const invitation={id:'office_invite_'+'f'.repeat(32),email:'reviewer@example.invalid',state:'SENT',expiresAt:'2027-10-08T00:00:00.000Z',connectionId:'channel-a',operationId:'12345678-1234-4234-8234-123456789012',canShareConnection:true,connectionShared:false},value={...reference,canManage:true,channels:[{id:'channel-a'}],candidates:[],candidatesLimited:false,invitations:[invitation],truncated:false};assert.equal(officeAdminSnapshot(value,reference),value);
 for(const patch of [{canShareConnection:'true'},{connectionShared:1},{configuration:configuration()},{canSend:true},{metadata:{private:true}}])assert.throws(()=>officeAdminSnapshot({...value,invitations:[{...invitation,...patch}]},reference));
 for(const key of ['canShareConnection','connectionShared']){const row={...invitation};delete row[key];assert.throws(()=>officeAdminSnapshot({...value,invitations:[row]},reference));}
});
