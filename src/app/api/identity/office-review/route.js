import {verifyWorkspaceSession} from '../../../../lib/verified-session.mjs';
import {productionOfficeReview} from '../../../../lib/office-review-runtime.mjs';
import {createOfficeReviewHandlers} from '../../../../lib/office-review-http.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const handlers=createOfficeReviewHandlers({verify:verifyWorkspaceSession,store:productionOfficeReview});
export const GET=handlers.GET;
export const POST=handlers.POST;
