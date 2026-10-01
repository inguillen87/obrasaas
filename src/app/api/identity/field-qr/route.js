import QRCode from 'qrcode';
import { verifyWorkspaceSession } from '../../../../lib/verified-session.mjs';
import { productionWorkspace } from '../../../../lib/workspace-runtime.mjs';
import { createFieldQrHandler } from '../../../../lib/field-operations-http.mjs';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const GET=createFieldQrHandler({verify:verifyWorkspaceSession,workspace:productionWorkspace,toSvg:payload=>QRCode.toString(payload,{type:'svg',errorCorrectionLevel:'M',margin:4,width:360})});
