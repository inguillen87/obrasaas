import {productionPlatformOperatorAuthority} from '../../../../lib/platform-operator-authority.mjs';
import {connectWorkspace} from '../../../../lib/workspace-runtime.mjs';
import {createPilotKycCoverage} from '../../../../lib/organization-pilot-coverage.mjs';
import {createPlatformPilotCoverageHandlers} from '../../../../lib/platform-pilot-coverage-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createPlatformPilotCoverageHandlers({authority:productionPlatformOperatorAuthority,store:createPilotKycCoverage({connect:connectWorkspace})});
export const GET=handlers.GET;
export const POST=handlers.POST;
