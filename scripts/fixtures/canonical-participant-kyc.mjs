import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {posix} from 'node:path';
import {createParticipantStore} from '../../src/lib/participant-store.mjs';
import {createPrivateImageUploader} from '../../src/lib/private-image-upload.mjs';
import {PARTICIPANT_NOTICE_VERSION} from '../../src/lib/participant-policy.mjs';
import {assertApprovedParticipantKyc} from '../../src/lib/participant-approved-identity.mjs';

// Closed test adapters: generated pixels only, no identity, OCR, biometrics or
// network provider. This seeds the existing store; it never fabricates approval.
export function createCanonicalParticipantKycFixture({workspace,connect,query}) {
  const objects=new Map(),records=[],calls={privatePuts:0,privateReads:0};
  const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64');
  const bytes=kind=>Buffer.concat([pixel,Buffer.from('synthetic-fixture-'+kind)]);
  const images={front:bytes('front'),selfie:bytes('selfie')};
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const get=async(pathname,options)=>{
    assert.equal(options.access,'private');assert.equal(options.useCache,false);calls.privateReads++;
    const object=objects.get(pathname);if(!object)return null;
    return {statusCode:200,blob:{url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname,size:object.bytes.length,contentType:object.contentType},stream:new ReadableStream({start(controller){controller.enqueue(object.bytes);controller.close();}})};
  };
  const put=async(pathname,value,options)=>{
    assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);assert.equal(options.addRandomSuffix,false);
    assert.match(pathname,/^obrasaas\/legacy-images\/v1\/[a-f0-9]{64}\/image\.png$/);
    assert.equal(objects.has(pathname),false);calls.privatePuts++;objects.set(pathname,{bytes:Buffer.from(value),contentType:options.contentType});
    return {url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname};
  };
  const uploader=createPrivateImageUploader({put,get,environment:()=>({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-canonical-kyc-fixture'})});
  const store=createParticipantStore({workspace,connect,upload:uploader.uploadImageToBlob,get});
  const row=async(projectId,workerId)=>(await query(`SELECT id,"projectId",active,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2`,[workerId,projectId])).rows[0];
  async function approve({projectId,workerId,actor,reviewer}) {
    assert.notEqual(actor.userId,reviewer.userId,'The human reviewer is another synthetic account');
    const before=await row(projectId,workerId);assert.ok(before);assert.equal(before.metadata.participant.kyc.status,'NOT_SUBMITTED');
    assert.equal(before.metadata.participant.clerkUserId,actor.userId);
    const membershipBefore=(await query(`SELECT u.id AS "actorId",m.id,m."tenantRole"::text AS role,m.status,pm.status AS "projectStatus" FROM public."PlatformUser" u JOIN public."TenantMembership" m ON m."userId"=u.id JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=m.id WHERE u."clerkUserId"=$1 AND m."organizationId"=(SELECT "organizationId" FROM public."Project" WHERE id=$2) AND pm."projectId"=$2`,[actor.userId,projectId])).rows;
    assert.equal(membershipBefore.length,1);assert.equal(membershipBefore[0].status,'ACTIVE');assert.equal(membershipBefore[0].projectStatus,'ACTIVE');
    const scope=(await workspace.list(actor)).scope,reviewerScope=(await workspace.list(reviewer)).scope;
    const submitted=await store.submitKyc(actor,{projectId,scope,workerId,revision:before.revision,operationId:randomUUID(),noticeVersion:PARTICIPANT_NOTICE_VERSION,consent:true,front:images.front.toString('base64'),selfie:images.selfie.toString('base64')});
    assert.equal(submitted.participant.kyc.status,'PENDING_REVIEW');assert.equal(submitted.participant.identityCertified,false);assert.equal(submitted.participant.whatsAppAccessGranted,false);
    const submittedRow=await row(projectId,workerId);
    await assert.rejects(assertApprovedParticipantKyc({query},submittedRow,{actorId:membershipBefore[0].actorId,clerkUserId:actor.userId,organizationId:(await query('SELECT "organizationId" FROM public."Project" WHERE id=$1',[projectId])).rows[0].organizationId}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
    const putsBeforeReview=calls.privatePuts;
    for(const [imageId,value] of [['document-front',images.front],['selfie',images.selfie]]){
      const actual=await store.downloadKyc(reviewer,{projectId,scope:reviewerScope,workerId,imageId});assert.deepEqual(actual.bytes,value);assert.equal(actual.contentType,'image/png');
    }
    const reviewed=await store.save(reviewer,{projectId,scope:reviewerScope,operationId:randomUUID(),action:'REVIEW_KYC',payload:{workerId,revision:submittedRow.revision,submissionId:submitted.participant.kyc.submissionId,decision:'APPROVED',reason:'Independent synthetic human review of both private fixture images.'}});
    assert.equal(reviewed.participant.kyc.status,'APPROVED');assert.equal(reviewed.participant.identityCertified,false);assert.equal(reviewed.participant.whatsAppAccessGranted,false);assert.equal(calls.privatePuts,putsBeforeReview);
    const approved=await row(projectId,workerId),kyc=approved.metadata.participant.kyc;
    assert.deepEqual(approved.metadata.participant.permissions,before.metadata.participant.permissions);
    assert.deepEqual(kyc.images.map(image=>[image.id,image.sha256]),[['document-front',hash(images.front)],['selfie',hash(images.selfie)]]);
    const receipts=(await query('SELECT id,"actorId","entityId",metadata FROM public."AuditLog" WHERE id=ANY($1::text[])',[[submitted.receiptId,reviewed.receiptId]])).rows;
    assert.equal(receipts.length,2);const submission=receipts.find(item=>item.id===submitted.receiptId),review=receipts.find(item=>item.id===reviewed.receiptId);
    assert.equal(submission.metadata.kind,'KYC_SUBMITTED');assert.equal(review.metadata.kind,'REVIEW_KYC');assert.notEqual(submission.actorId,review.actorId);
    for(const receipt of receipts){assert.equal(receipt.entityId,workerId);assert.equal(receipt.metadata.projectId,projectId);assert.equal(receipt.metadata.submissionId,kyc.submissionId);assert.equal(receipt.metadata.identityCertified,false);}
    assert.equal(submission.metadata.contentHash,kyc.contentHash);assert.equal(review.metadata.decision,'APPROVED');assert.equal(review.actorId,kyc.review.actorId);
    await workspace.projectOperation(actor,{projectId,scope},false,(client,member)=>assertApprovedParticipantKyc(client,approved,member));
    const membershipAfter=(await query('SELECT "tenantRole"::text AS role,status FROM public."TenantMembership" WHERE id=$1',[membershipBefore[0].id])).rows[0];assert.deepEqual(membershipAfter,{role:membershipBefore[0].role,status:'ACTIVE'});
    const record={projectId,workerId,submissionId:kyc.submissionId,submissionReceiptId:submitted.receiptId,reviewReceiptId:reviewed.receiptId,actorId:submission.actorId,reviewerActorId:review.actorId,contentHash:kyc.contentHash,canonicalAdmissionConfirmed:true,identityCertified:false,providerCalls:0};records.push(record);return record;
  }
  return {approve,records,calls};
}

// Bind the synthetic fixture and its actual local runtime import closure.
export function canonicalParticipantKycSourceFiles() {
  const files=new Set();
  function visit(file) {
    if(files.has(file))return;files.add(file);
    const source=readFileSync(file,'utf8');
    for(const match of source.matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g)) {
      const dependency=posix.normalize(posix.join(posix.dirname(file),match[1]));
      assert.ok(dependency.startsWith('src/')||dependency.startsWith('scripts/fixtures/'));
      visit(dependency);
    }
  }
  visit('scripts/fixtures/canonical-participant-kyc.mjs');return [...files].sort();
}
