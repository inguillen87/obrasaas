import {get} from '@vercel/blob';
import {connectWorkspace} from './workspace-runtime.mjs';
import {createPilotMediaAnalyzer} from './pilot-media.mjs';
import {createPrivateBiometricAnalyzer} from './private-biometric-analyzer.mjs';
import {productionOrganizationUsage} from './organization-usage-runtime.mjs';
import {createParticipantKycPreanalysis} from './participant-kyc-preanalysis.mjs';
const biometric=createPrivateBiometricAnalyzer();
function readiness(){
 const e=process.env;
 let origin=false;try{const u=new URL(e.APPLICATION_PUBLIC_ORIGIN||'https://obrasaas.com');origin=u.href==='https://obrasaas.com/';}catch{}
 return {ocr:typeof e.OPENAI_API_KEY==='string'&&Boolean(e.OPENAI_API_KEY.trim())&&e.OPENAI_API_KEY!=='[SENSITIVE]',biometric:origin&&typeof e.OBRASAAS_BIOMETRIC_SERVICE_KEY==='string'&&/^[a-f0-9]{64}$/.test(e.OBRASAAS_BIOMETRIC_SERVICE_KEY)};
}
export const productionParticipantKycPreanalysis=createParticipantKycPreanalysis({connect:connectWorkspace,get,analyzer:createPilotMediaAnalyzer(),assessBiometrics:input=>biometric.analyzeBiometricPair(input),usage:productionOrganizationUsage,readiness});
