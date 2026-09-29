import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectIdentityProvider} from './lib/production-identity-check.mjs';
import {createPilotMediaAnalyzer,unavailableBiometricAssessment} from '../src/lib/pilot-media.mjs';
const enabled=process.env.OBRASAAS_RUN_PILOT_MEDIA_CHECK;
if(enabled){
 const proof={status:'UNCONFIRMED',syntheticOnly:true,realPeopleTested:false,whatsappTransportTested:false,businessDataWritten:false,
  biometricAutoApprovalEnabled:false,audioLanguage:'en',audioModel:'whisper-1',visionModel:'gpt-4o'};
 try{
  if(enabled!=='synthetic-media-v1'||process.env.VERCEL_ENV!=='production'||process.env.VERCEL_PROJECT_ID!=='prj_68NErbCqCFsDVaMak81gcwsGI9pF'||process.env.NEXT_PUBLIC_APP_URL!=='https://obrasaas.com')throw new Error('PILOT_CHECK_CONTEXT_INVALID');
  console.log(JSON.stringify({productionIdentityCheck:await inspectIdentityProvider()}));
  const metadata=JSON.parse(readFileSync(new URL('./fixtures/pilot-audio-synthetic.json',import.meta.url),'utf8'));
  const buffer=readFileSync(new URL('./fixtures/pilot-audio-synthetic.wav',import.meta.url));
  if(createHash('sha256').update(buffer).digest('hex')!==metadata.sha256||metadata.recordingOfPerson!==false)throw new Error('PILOT_FIXTURE_CHANGED');
  const analyzer=createPilotMediaAnalyzer();
  const audio=await analyzer.transcribeAudio({buffer,mimeType:'audio/wav',language:'en'});
  const words=audio.text?.toLowerCase()||'';
  if(!audio.success||!/(two|2) bags/.test(words)||!words.includes('cement')||audio.speakerVerified!==false)throw new Error('PILOT_AUDIO_UNCONFIRMED');
  proof.syntheticAudioTranscribed=true;proof.transcriptSha256=createHash('sha256').update(audio.text).digest('hex');
  const pixel=readFileSync(new URL('./fixtures/pilot-negative-image.png',import.meta.url)).toString('base64');
  const dni=await analyzer.analyzeDni({base64:pixel,mimeType:'image/png'});
  proof.documentOutcome={success:dni.success,code:dni.code||null,providerStatus:dni.providerStatus||null};
  if(dni.success!==false||dni.identityVerified!==false||dni.code!=='DNI_DOCUMENT_NOT_CONFIRMED')throw new Error('PILOT_INVALID_DOCUMENT_NOT_REJECTED');
  proof.invalidDocumentRejected=true;
  const photo=await analyzer.analyzePhoto({base64:pixel,mimeType:'image/png'});
  proof.photoOutcome={success:photo.success,code:photo.code||null,providerStatus:photo.providerStatus||null};
  if(photo.success!==false||photo.code!=='PHOTO_ANALYSIS_INCOMPLETE')throw new Error('PILOT_INVALID_SITE_PHOTO_NOT_REJECTED');
  proof.invalidSitePhotoRejected=true;
  if(unavailableBiometricAssessment().isMatch!==null)throw new Error('PILOT_BIOMETRIC_GUARD_INVALID');
  proof.status='PASS';console.log(JSON.stringify({pilotMediaLiveCheck:proof}));
 }catch(error){console.error(JSON.stringify({pilotMediaLiveCheck:{...proof,code:/^PILOT_[A-Z_]+$/.test(error.message)?error.message:'PILOT_CHECK_UNCONFIRMED'}}));process.exitCode=1;}
}
