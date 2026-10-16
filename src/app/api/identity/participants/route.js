import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionParticipants} from '../../../../lib/participant-runtime.mjs';
import {createParticipantHandlers} from '../../../../lib/participant-http.mjs';
import {after} from 'next/server';
import {productionParticipantOnboardingDelivery} from '../../../../lib/meta-customer-processing-runtime.mjs';
import {reportMetaRecoveryDiagnostics} from '../../../../lib/meta-recovery-diagnostics.mjs';
import {productionParticipantKycPreanalysis} from '../../../../lib/participant-kyc-preanalysis-runtime.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
const handlers=createParticipantHandlers({verify:verifyWorkspaceSession,store:productionParticipants,scheduleAnalysis:reference=>after(async()=>{try{await productionParticipantKycPreanalysis.process(reference);}catch{console.error('PARTICIPANT_ANALYSIS_UNCONFIRMED');}}),scheduleOnboarding:reference=>after(async()=>{
 try{const result=await productionParticipantOnboardingDelivery.process(reference);reportMetaRecoveryDiagnostics({durable:true,results:[],onboarding:{results:[result]}},{purpose:'CUSTOMER',trigger:'WEBHOOK'});}
 catch{reportMetaRecoveryDiagnostics(null,{purpose:'CUSTOMER',trigger:'WEBHOOK',rejected:true});}
})});
export const GET=handlers.GET;
export const POST=handlers.POST;
