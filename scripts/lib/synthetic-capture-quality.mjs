// Explicit synthetic harness port. Generated signature fixtures do not exercise
// computer vision, real identity images, deployed services or model inference.
import {createHash} from 'node:crypto';
import {CAPTURE_QUALITY_MODEL_MANIFEST_SHA256} from '../../src/lib/private-capture-quality.mjs';

export async function syntheticCaptureQuality({kind,image}){
 return {version:1,mode:'capture-quality-v1',kind,state:'QUALITY_PASS',reasonCodes:[],imageSha256:createHash('sha256').update(image.buffer).digest('hex'),modelManifestSha256:CAPTURE_QUALITY_MODEL_MANIFEST_SHA256,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false};
}
