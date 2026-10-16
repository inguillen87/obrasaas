import {WorkspaceError,digest} from './workspace-policy.mjs';
import {metaKycContextAuthorityDigest,metaKycDispatchReceiptId} from './meta-kyc-identity.mjs';
import {customerOutboundId,assertCustomerReplyWindow,customerChannelActive} from './meta-customer-outbound.mjs';
const snapshots=new WeakMap(),fail=()=>{throw new WorkspaceError('META_KYC_CONTEXT_FEEDBACK_DENIED',409);};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
// A full signed feedback resolver has locked canonical principals, projects,
// Worker, channel, source and receipts. These reads retain that exact authority
// and transaction; this capability cannot authorize capture or a session.
function read(r,context){
 const corporate=Boolean(r.companyKyc),sources=[r.feedbackSourceEventId,customerOutboundId(r.feedbackSourceEventId),r.challenge.claimedEventId],members=[...new Set([r.issuer.membershipId,r.member.membershipId])];
 return {values:[r.event.id,r.connection.id,r.project.organizationId,r.worker.id,r.issuer.membershipId,r.issuer.actorId,r.member.membershipId,r.member.actorId,r.project.id,sources,members,context.leaseToken],sql:`SELECT clock_timestamp() AS "contextNow",pg_current_xact_id()::text AS "contextTransactionId",e."leaseExpiresAt",jsonb_build_object(
 'event',to_jsonb(e),'worker',to_jsonb(w),'channel',to_jsonb(c),'organization',to_jsonb(o),'anchor',to_jsonb(ap),'project',to_jsonb(tp),'issuer',to_jsonb(im),'issuerUser',to_jsonb(iu),'member',to_jsonb(mm),'memberUser',to_jsonb(mu),
 'assignments',COALESCE((SELECT jsonb_agg(to_jsonb(pm) ORDER BY pm.id) FROM public."ProjectMembership" pm WHERE pm."projectId"=tp.id AND pm."tenantMembershipId"=mm.id AND pm.status='ACTIVE'),'[]'::jsonb),
 'sources',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'projectId',s."projectId",'provider',s.provider,'eventType',s."eventType",'externalId',s."externalId",'payload',s.payload,'messageId',s.outcome->>'messageId','accepted',CASE WHEN s.provider='meta-customer-outbound-v1' THEN s.outcome->>'state' IN ('SENT','STATUS_OBSERVED') AND COALESCE(s.outcome->>'providerStatus','') NOT IN ('failed','deleted') ELSE true END) ORDER BY s.id) FROM public."WebhookEvent" s WHERE s.id=ANY($10::text[])),'[]'::jsonb),
 'receipts',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM (SELECT a.* FROM public."AuditLog" a WHERE a."organizationId"=o.id AND ((a."entityType"='Worker' AND a."entityId"=w.id AND (a.action LIKE 'participant.kyc_chat.%' OR a.action='participant.operation.recorded')) OR (a."entityType"='TenantMembership' AND a."entityId"=ANY($11::text[]) AND a.action='participant.operation.recorded')) ORDER BY a.id LIMIT 1001) a),'[]'::jsonb)
 ${corporate?",'company',to_jsonb(cc),'companyAssignment',to_jsonb(ca)":''}) AS snapshot
 FROM public."WebhookEvent" e JOIN public."Organization" o ON o.id=$3 AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb
 JOIN public."Project" ap ON ap.id=e."projectId" AND ap."organizationId"=o.id AND ap.status='ACTIVE' JOIN public."Project" tp ON tp.id=$9 AND tp."organizationId"=o.id AND tp.status='ACTIVE'
 JOIN public."WhatsAppConnection" c ON c.id=$2 AND c."projectId"=ap.id JOIN public."Worker" w ON w.id=$4 AND w."projectId"=tp.id AND w.active=true
 JOIN public."TenantMembership" im ON im.id=$5 AND im."userId"=$6 AND im."organizationId"=o.id AND im.status='ACTIVE' JOIN public."PlatformUser" iu ON iu.id=im."userId"
 JOIN public."TenantMembership" mm ON mm.id=$7 AND mm."userId"=$8 AND mm."organizationId"=o.id AND mm.status='ACTIVE' JOIN public."PlatformUser" mu ON mu.id=mm."userId"
 ${corporate?'JOIN public."WhatsAppCompanyChannel" cc ON cc."connectionId"=c.id AND cc."organizationId"=o.id AND cc."anchorProjectId"=ap.id AND cc.mode=\'COMPANY\' JOIN public."WhatsAppChannelProjectAssignment" ca ON ca."connectionId"=c.id AND ca."organizationId"=o.id AND ca."projectId"=tp.id AND ca.status=\'ACTIVE\'':''}
 WHERE e.id=$1 AND e.provider='meta-customer-v1' AND e."eventType"='message' AND e.status='PENDING' AND e."leaseToken"=$12 AND e."leaseExpiresAt">clock_timestamp()
 AND (w.metadata->'participant'->>'status'<>'ACTIVE' OR EXISTS(SELECT 1 FROM public."ProjectMembership" pm WHERE pm."projectId"=tp.id AND pm."tenantMembershipId"=mm.id AND pm.status='ACTIVE'))
 FOR UPDATE OF e,w FOR SHARE OF o,ap,tp,c,im,iu,mm,mu${corporate?',cc,ca':''}`};
}
export async function prepareKycContextOutboundSnapshot(client,r,context,{environment=process.env}={}){
 const authorityDigest=metaKycContextAuthorityDigest(client,r,context),query=read(r,context),rows=(await client.query(query.sql,query.values)).rows,row=rows[0];
 if(rows.length!==1||!/^\d{1,20}$/.test(row.contextTransactionId||'')||row.snapshot?.event?.payload?.payloadDigest!==context.payloadDigest||row.snapshot.worker?.metadata?.participant?.kycChatChallenge?.id!==r.challenge.id||row.snapshot.channel?.encryptedAccessToken!==r.connection.encryptedAccessToken||row.snapshot.sources?.length!==new Set(query.values[9]).size||row.snapshot.sources.some(s=>s.accepted!==true)||!Array.isArray(row.snapshot.receipts)||row.snapshot.receipts.length>1000)fail();
 const s=row.snapshot,out=s.sources.find(source=>source.id===customerOutboundId(r.feedbackSourceEventId)),source=s.sources.find(source=>source.id===r.feedbackSourceEventId),dispatch=s.receipts.filter(a=>a.id===metaKycDispatchReceiptId(r.feedbackSourceEventId)&&a.action==='participant.kyc_chat.dispatched');
 if(digest(stable(s.worker.metadata))!==digest(stable(r.worker.metadata))||digest(stable(s.channel.metadata))!==digest(stable(r.connection.metadata))||s.issuer.id!==r.issuer.membershipId||s.issuer.userId!==r.issuer.actorId||s.issuer.tenantRole!==r.issuer.role||s.member.id!==r.member.membershipId||s.member.userId!==r.member.actorId||s.member.tenantRole!==r.member.role||dispatch.length!==1||!out||!source||digest(stable([out.id,out.payload,out.messageId,source.payload,dispatch[0].metadata]))!==r.feedbackPromptDigest)fail();
 const notAfter=Math.min(Date.parse(row.leaseExpiresAt),Number(r.payload.value.timestamp)*1000+24*3600000,r.worker.metadata.participant.status==='INVITED'?Date.parse(r.worker.metadata.participant.invitation.expiresAt):Infinity,r.connection.metadata?.ownCompanyRuntime?Date.parse(r.connection.metadata.ownCompanyRuntime.validUntil):Infinity,...(r.feedbackUnquotedReminder===true?[Date.parse(r.challenge.expiresAt),Date.parse(r.state.expiresAt)]:[]));
 if(!Number.isSafeInteger(notAfter)||!(row.contextNow instanceof Date)||notAfter<=row.contextNow.getTime()||!customerChannelActive(r.connection,row.contextNow.getTime(),{environment}))fail();assertCustomerReplyWindow(r.payload,row.contextNow.getTime());
 snapshots.set(r,{client,contextDigest:digest(context),authorityDigest,environment,query,transactionId:row.contextTransactionId,fingerprint:digest(row.snapshot),notAfter});return notAfter;
}
export async function fenceKycContextOutboundSnapshot(client,r,context,{environment=process.env}={}){
 const proof=snapshots.get(r);if(!proof||proof.client!==client||proof.environment!==environment||proof.contextDigest!==digest(context)||metaKycContextAuthorityDigest(client,r,context)!==proof.authorityDigest)fail();
 const rows=(await client.query(proof.query.sql,proof.query.values)).rows,row=rows[0];if(rows.length!==1||row.contextTransactionId!==proof.transactionId||digest(row.snapshot)!==proof.fingerprint||!(row.contextNow instanceof Date)||row.contextNow.getTime()>=proof.notAfter||!customerChannelActive(r.connection,row.contextNow.getTime(),{environment}))fail();assertCustomerReplyWindow(r.payload,row.contextNow.getTime());return row.contextNow;
}
export function releaseKycContextOutboundSnapshot(r){snapshots.delete(r);}
