import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {FIELD_MEDIA_PRIVACY_NOTICE,FIELD_MEDIA_PRIVACY_NOTICE_VERSION,FIELD_MEDIA_PRIVACY_NOTICE_SHA256,fieldMediaAnalysisConsent,FIELD_VIDEO_PRIVACY_NOTICE,FIELD_VIDEO_PRIVACY_NOTICE_VERSION,FIELD_VIDEO_PRIVACY_NOTICE_SHA256,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE_VERSION,FIELD_VIDEO_AUDIO_PRIVACY_NOTICE_SHA256,fieldVideoAnalysisConsent,validFieldMediaAnalysisConsent,fieldVideoAudioAnalysisAllowed} from '../src/lib/field-media-privacy.mjs';
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
test('v1 consent remains the exact three-field notice and expressly excludes video audio',()=>{
 assert.equal(FIELD_MEDIA_PRIVACY_NOTICE_VERSION,'field-media-analysis-v1');assert.equal(FIELD_MEDIA_PRIVACY_NOTICE_SHA256,'2beefc81cd084f9c840ac517ee464999bb49aa2d5d9c229e2bb9cb161fb9c7f4');assert.equal(sha(FIELD_MEDIA_PRIVACY_NOTICE),FIELD_MEDIA_PRIVACY_NOTICE_SHA256);assert.match(FIELD_MEDIA_PRIVACY_NOTICE,/sin audio/);
 assert.deepEqual(fieldMediaAnalysisConsent(true),{allowed:true,noticeVersion:FIELD_MEDIA_PRIVACY_NOTICE_VERSION,noticeSha256:FIELD_MEDIA_PRIVACY_NOTICE_SHA256});assert.equal(validFieldMediaAnalysisConsent(fieldMediaAnalysisConsent(false)),true);assert.equal(fieldVideoAudioAnalysisAllowed(fieldMediaAnalysisConsent(true)),false);
});
test('video v2 notices are separately hashed and require two explicit booleans',()=>{
 assert.equal(sha(FIELD_VIDEO_PRIVACY_NOTICE),FIELD_VIDEO_PRIVACY_NOTICE_SHA256);assert.equal(sha(FIELD_VIDEO_AUDIO_PRIVACY_NOTICE),FIELD_VIDEO_AUDIO_PRIVACY_NOTICE_SHA256);assert.equal(FIELD_VIDEO_PRIVACY_NOTICE_VERSION,'field-media-analysis-v2');assert.equal(FIELD_VIDEO_AUDIO_PRIVACY_NOTICE_VERSION,'field-video-audio-transcription-v1');
 assert.equal(fieldVideoAnalysisConsent().allowed,false);assert.equal(fieldVideoAnalysisConsent(true).videoAudio.allowed,false);assert.equal(fieldVideoAudioAnalysisAllowed(fieldVideoAnalysisConsent(true)),false);assert.equal(fieldVideoAudioAnalysisAllowed(fieldVideoAnalysisConsent(true,true)),true);assert.equal(validFieldMediaAnalysisConsent(fieldVideoAnalysisConsent(false,false)),true);assert.equal(validFieldMediaAnalysisConsent(fieldVideoAnalysisConsent(false,true)),false);
 assert.match(FIELD_VIDEO_AUDIO_PRIVACY_NOTICE,/primera pista/);assert.match(FIELD_VIDEO_AUDIO_PRIVACY_NOTICE,/después del envío no retira/);
});
test('missing, mixed, stale, string-valued and expanded consent records cannot authorize audio',()=>{
 const v=fieldVideoAnalysisConsent(true,true),copy=()=>structuredClone(v);
 const cases=[null,[],{}, {...v,allowed:'true'},{...v,noticeVersion:FIELD_MEDIA_PRIVACY_NOTICE_VERSION},{...v,noticeSha256:'f'.repeat(64)},{...v,videoAudio:undefined},{...v,videoAudio:fieldMediaAnalysisConsent(true)},{...v,videoAudio:{...v.videoAudio,allowed:1}},{...v,videoAudio:{...v.videoAudio,noticeSha256:'a'.repeat(64)}},{...v,videoAudio:{...v.videoAudio,extra:true}},{...v,extra:true},{...fieldMediaAnalysisConsent(true),videoAudio:v.videoAudio}];
 for(const value of cases){assert.equal(validFieldMediaAnalysisConsent(value),false);assert.equal(Boolean(fieldVideoAudioAnalysisAllowed(value)),false);}
 const original=copy();fieldVideoAudioAnalysisAllowed(original);assert.deepEqual(original,v);
});
