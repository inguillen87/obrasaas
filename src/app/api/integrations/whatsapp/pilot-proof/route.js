import { clerkClient } from '@clerk/nextjs/server';
import { AccessError, accessErrorResponse, requireSuperadmin } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';
import { readJsonRequest, RequestBodyError, requestBodyErrorResponse } from '@/lib/request-body';
import { WhatsAppInboxError, sendManualWhatsAppMessage } from '@/lib/whatsapp/inbox';
import { PilotChannelProofError, resolvePilotProofContext, readPilotChannelProof, sendPilotChannelProof } from '@/lib/whatsapp/pilot-channel-proof';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
async function handle(request, write) {
  try {
    if (process.env.VERCEL_ENV !== 'preview' || process.env.WHATSAPP_PILOT_IMPORT_ENABLED !== 'true') return Response.json({error:'Recurso no disponible.'},{status:404,headers});
    const url = new URL(request.url), origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || (write && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({error:'Origen no autorizado.'},{status:403,headers});
    const principal = await requireSuperadmin();
    if (!request.headers.get('x-obrasaas-project') || !request.headers.get('x-obrasaas-organization')) throw new PilotChannelProofError('PILOT_PROOF_CONTEXT','Verificá el contexto de la pantalla.',409);
    assertEvidenceRequestContext(request, principal);
    if (write ? Boolean(url.search) : [...url.searchParams.keys()].some(k=>k!=='projectId') || url.searchParams.getAll('projectId').length!==1) throw new PilotChannelProofError('PILOT_PROOF_QUERY','Consulta inválida.',400);
    const input = write ? await readJsonRequest(request,{maxBytes:2048}) : null;
    const projectId = write ? input?.projectId : url.searchParams.get('projectId');
    const prisma = getPrisma();
    const context = await resolvePilotProofContext({prisma,clerk:await clerkClient(),principal,projectId});
    const result = write ? await sendPilotChannelProof({prisma,context,input,sendMessage:sendManualWhatsAppMessage}) : await readPilotChannelProof({prisma,context});
    return Response.json(result,{headers});
  } catch(error) {
    const known = error instanceof AccessError ? accessErrorResponse(error) : error instanceof RequestBodyError ? requestBodyErrorResponse(error) : evidenceContextErrorResponse(error);
    if(known){Object.entries(headers).forEach(([k,v])=>known.headers.set(k,v));return known;}
    const expected = error instanceof PilotChannelProofError || error instanceof WhatsAppInboxError;
    return Response.json({error:expected?error.message:'No se confirmó la comprobación. Conservá el intento y consultá su estado.',code:expected?error.code:'PILOT_PROOF_UNCONFIRMED'},{status:expected?error.status:503,headers});
  }
}
export async function GET(request) { return handle(request,false); }
export async function POST(request) { return handle(request,true); }
