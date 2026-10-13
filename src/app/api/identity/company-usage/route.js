import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionOrganizationUsage} from '../../../../lib/organization-usage-runtime.mjs';
import {createOrganizationUsageHandlers} from '../../../../lib/organization-usage-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createOrganizationUsageHandlers({verifySession:verifyWorkspaceSession,store:productionOrganizationUsage});
export const GET=handlers.GET;
