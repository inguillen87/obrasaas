import {verifyApiAuth} from '../../../../../lib/auth.js';
import {sendWhatsAppMessage} from '../../../../../lib/whatsappNotifications.js';
import {createMetaTestDispatch} from '../../../../../lib/meta-test-dispatch.mjs';
export const dynamic='force-dynamic';
const handlers=createMetaTestDispatch({authorize:verifyApiAuth,send:sendWhatsAppMessage});
export const GET=handlers.GET;
export const POST=handlers.POST;
