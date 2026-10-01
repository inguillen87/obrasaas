import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {connectWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {verifyBootstrapProfile} from '../../../../lib/company-onboarding-identity.mjs';
import {createCompanyOnboardingStore} from '../../../../lib/company-onboarding-store.mjs';
import {createCompanyOnboardingHandlers} from '../../../../lib/company-onboarding-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createCompanyOnboardingHandlers({verifySession:verifyWorkspaceSession,verifyProfile:verifyBootstrapProfile,store:createCompanyOnboardingStore({connect:connectWorkspace})});
export const GET=handlers.GET;export const POST=handlers.POST;
