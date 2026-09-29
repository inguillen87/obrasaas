import {verifyApiAuth,verifyWebviewToken} from '../../../../lib/auth.js';
import {createKycPilotBoundary} from '../../../../lib/kyc-pilot-boundary.mjs';
// Capture is not identity approval. A scoped, auditable review workflow must
// replace the legacy auto-approval before real worker enrollment is enabled.
export const POST=createKycPilotBoundary({authorize:verifyApiAuth,verifyToken:verifyWebviewToken});
