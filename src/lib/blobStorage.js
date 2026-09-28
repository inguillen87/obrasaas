import {get,put} from '@vercel/blob';
import {createPrivateImageUploader} from './private-image-upload.mjs';

// No public fallback, placeholder URL or provider-message logging. The same
// inputs address the same private objects and require authenticated read-back.
const uploader=createPrivateImageUploader({get,put});
export const uploadImageToBlob=uploader.uploadImageToBlob;
export const uploadKycImages=uploader.uploadKycImages;
