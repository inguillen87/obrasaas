import {clerkClient} from '@clerk/nextjs/server';
import {connectWorkspace,productionWorkspace} from './workspace-runtime.mjs';
import {createParticipantIdentityProvider} from './participant-identity-provider.mjs';
import {createOfficeReviewStore} from './office-review-store.mjs';
export const productionOfficeReview=createOfficeReviewStore({workspace:productionWorkspace,connect:connectWorkspace,identity:createParticipantIdentityProvider({client:clerkClient})});
