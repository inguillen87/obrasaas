import {clerkClient} from '@clerk/nextjs/server';
import {WorkspaceError} from './workspace-policy.mjs';
import {connectWorkspace,productionWorkspace} from './workspace-runtime.mjs';
import {createParticipantIdentityProvider} from './participant-identity-provider.mjs';
import {createCompanySubscription} from './company-subscription-store.mjs';
import {createCompanySubscriptionProvider} from './company-subscription-provider.mjs';
import {companySubscriptionRuntimeConfiguration} from './company-subscription-runtime-config.mjs';
import {defaultCommercialCatalog} from './company-subscription-catalog.mjs';

const configuration=companySubscriptionRuntimeConfiguration(process.env);
const identity=createParticipantIdentityProvider({client:clerkClient});
export const productionCompanySubscriptionProvider=createCompanySubscriptionProvider({config:configuration.providerConfig});
export const productionCompanySubscription=createCompanySubscription({
  workspace:productionWorkspace,connect:connectWorkspace,provider:productionCompanySubscriptionProvider,
  configuration:()=>configuration.catalog,
  commercialCatalog:defaultCommercialCatalog,
  verifiedPayer:async session=>{
    const membership=await identity.verifyMembership({userId:session.userId,organizationId:session.organizationId});
    if(membership.role!=='org:admin')throw new WorkspaceError('WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED',403);
    const email=await identity.verifiedEmail(session.userId);
    return {email,verified:true};
  }
});
