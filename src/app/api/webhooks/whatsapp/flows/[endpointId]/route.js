import { getPrisma } from "@/lib/prisma";
import { handleWhatsAppFlowDataEndpointRequest } from "@/lib/whatsapp/flow-endpoint-handler";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request, { params }) {
  const { endpointId } = await params;
  return handleWhatsAppFlowDataEndpointRequest(request, {
    endpointId,
    prisma: getPrisma(),
    appSecret: process.env.META_APP_SECRET,
  });
}
