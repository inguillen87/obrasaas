import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import {inspectIdentityProvider} from './lib/production-identity-check.mjs';
import {createPilotMediaAnalyzer,unavailableBiometricAssessment} from '../src/lib/pilot-media.mjs';
import {createVideoFrameExtractor} from '../src/lib/video-frame-extractor.mjs';
import {decodePrivateImage} from '../src/lib/private-image-upload.mjs';
const enabled=process.env.OBRASAAS_RUN_PILOT_MEDIA_CHECK;
if(enabled){
 const proof={status:'UNCONFIRMED',syntheticOnly:true,realPeopleTested:false,whatsappTransportTested:false,businessDataWritten:false,
  biometricAutoApprovalEnabled:false,audioLanguage:'en',audioModel:null,visionModel:'gpt-4o'};
 try{
  if(!['synthetic-media-v1','synthetic-media-v2'].includes(enabled)||process.env.VERCEL_ENV!=='production'||process.env.VERCEL_PROJECT_ID!=='prj_68NErbCqCFsDVaMak81gcwsGI9pF'||process.env.NEXT_PUBLIC_APP_URL!=='https://obrasaas.com')throw new Error('PILOT_CHECK_CONTEXT_INVALID');
  console.log(JSON.stringify({productionIdentityCheck:await inspectIdentityProvider()}));
  const metadata=JSON.parse(readFileSync(new URL('./fixtures/pilot-audio-synthetic.json',import.meta.url),'utf8'));
  const buffer=readFileSync(new URL('./fixtures/pilot-audio-synthetic.wav',import.meta.url));
  if(createHash('sha256').update(buffer).digest('hex')!==metadata.sha256||metadata.recordingOfPerson!==false)throw new Error('PILOT_FIXTURE_CHANGED');
  const analyzer=createPilotMediaAnalyzer();
  const audio=await analyzer.transcribeAudio({buffer,mimeType:'audio/wav',language:'en'});
  proof.audioModel=audio.providerModel||null;
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
  if(enabled==='synthetic-media-v2'){
   const source=new URL('../public/cctv_render.png',import.meta.url),illustration=readFileSync(source);
   const sourceSha256=createHash('sha256').update(illustration).digest('hex');
   if(sourceSha256!=='30d474f43b9684fb4dc5ab0134e6eb0ae7c94a68c14cfb5a5cc502a47dc0eb7d')throw new Error('PILOT_ILLUSTRATION_CHANGED');
   const context='Es una ilustración de demostración del repositorio, no una inspección real. Las etiquetas de EPP son datos gráficos sin certificación. Describe lo visible con incertidumbre, sin afirmar cumplimiento ni inventar cantidades o avances.';
   const observation=result=>{
    if(result.provider!=='openai'||result.providerModel!=='gpt-4o'||result.requiresHumanReview!==true||result.verified!==false||!['ANALYZED_UNREVIEWED','UNCONFIRMED'].includes(result.status)||result.success===false&&result.code!=='PHOTO_ANALYSIS_INCOMPLETE'||result.success===true&&(result.estimatedProgressPercentage!==null||result.archived!==false))throw new Error('PILOT_ILLUSTRATION_PROVIDER_UNCONFIRMED');
    return {status:result.status,code:result.code||null,analyzed:result.success,requiresHumanReview:true,verified:false,estimatedProgressPercentage:result.success?result.estimatedProgressPercentage:null,descriptionSha256:result.success?createHash('sha256').update(result.aiAnalysis).digest('hex'):null};
   };
   const decoded=decodePrivateImage(illustration.toString('base64'));
   proof.illustrativePhoto={sourceSha256,contentType:decoded.contentType,...observation(await analyzer.analyzePhoto({base64:illustration.toString('base64'),mimeType:decoded.contentType,context})),realWorksiteValidated:false};
   const encoded=spawnSync(ffmpegPath,['-nostdin','-hide_banner','-loglevel','error','-threads','1','-filter_threads','1','-loop','1','-i',fileURLToPath(source),'-t','2','-vf','scale=640:640','-r','5','-c:v','libvpx-vp9','-threads','1','-an','-f','webm','pipe:1'],{windowsHide:true,timeout:20000,maxBuffer:3*1024*1024});
   if(encoded.status!==0||encoded.error)throw new Error('PILOT_SYNTHETIC_VIDEO_UNCONFIRMED');
   const extracted=await createVideoFrameExtractor()({buffer:encoded.stdout,mimeType:'video/webm'});
   const analyzedVideo=await analyzer.analyzeVideo({...extracted,context});
   if(extracted.frames.length!==4||analyzedVideo.analysisScope!=='SAMPLED_VIDEO_FRAMES'||analyzedVideo.sampling?.sourceSha256!==createHash('sha256').update(encoded.stdout).digest('hex')||analyzedVideo.sampling.audioAnalyzed!==false)throw new Error('PILOT_SAMPLED_VIDEO_UNCONFIRMED');
   proof.illustrativeVideo={...observation(analyzedVideo),sampling:analyzedVideo.sampling,realWorksiteValidated:false};
  }
  if(unavailableBiometricAssessment().isMatch!==null)throw new Error('PILOT_BIOMETRIC_GUARD_INVALID');
  proof.status='PASS';console.log(JSON.stringify({pilotMediaLiveCheck:proof}));
 }catch(error){console.error(JSON.stringify({pilotMediaLiveCheck:{...proof,code:/^PILOT_[A-Z_]+$/.test(error.message)?error.message:'PILOT_CHECK_UNCONFIRMED'}}));process.exitCode=1;}
}
