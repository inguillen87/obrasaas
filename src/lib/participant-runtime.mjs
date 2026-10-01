import {clerkClient} from '@clerk/nextjs/server';
import {get,put} from '@vercel/blob';
import {connectWorkspace,productionWorkspace} from './workspace-runtime.mjs';
import {createPrivateImageUploader} from './private-image-upload.mjs';
import {createParticipantIdentityProvider} from './participant-identity-provider.mjs';
import {createParticipantStore} from './participant-store.mjs';
const uploader=createPrivateImageUploader({get,put});
export const productionParticipants=createParticipantStore({workspace:productionWorkspace,connect:connectWorkspace,identity:createParticipantIdentityProvider({client:clerkClient}),upload:uploader.uploadImageToBlob,get});
