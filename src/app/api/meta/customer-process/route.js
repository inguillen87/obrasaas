import {productionMetaCustomerProcessor} from '../../../../lib/meta-customer-processing-runtime.mjs';
import {createMetaCustomerJobHandlers} from '../../../../lib/meta-customer-processing.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
const handlers=createMetaCustomerJobHandlers({processor:productionMetaCustomerProcessor});
export const GET=handlers.GET;
export const POST=handlers.POST;
