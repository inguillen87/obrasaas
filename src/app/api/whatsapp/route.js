import { verifyTwilioSignature } from "@/lib/auth";
import { getMessages } from "@/lib/db";
import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from "@/lib/access";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, "org:projects:read");
    return Response.json(await getMessages(access));
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("Failed to load WhatsApp messages:", error);
    return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const isTwilio = contentType.includes("x-www-form-urlencoded") || contentType.includes("form-data");
    let event;
    let scope = null;

    if (isTwilio) {
      if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        return Response.json(
          { error: "The legacy Twilio endpoint is disabled. Use the signed Meta Cloud API webhook." },
          { status: 410 },
        );
      }
      const authentic = await verifyTwilioSignature(request.clone(), process.env.TWILIO_AUTH_TOKEN);
      if (!authentic) return Response.json({ error: "Unauthorized signature" }, { status: 401 });
      const formData = await request.formData();
      event = {
        provider: "twilio",
        from: String(formData.get("From") || ""),
        text: String(formData.get("Body") || ""),
        kind: String(formData.get("MediaContentType0") || "").startsWith("audio/") ? "audio" : "text",
        media: formData.get("MediaUrl0")
          ? { url: String(formData.get("MediaUrl0")), mimeType: String(formData.get("MediaContentType0") || "") }
          : null,
        location:
          formData.get("Latitude") && formData.get("Longitude")
            ? {
                latitude: Number(formData.get("Latitude")),
                longitude: Number(formData.get("Longitude")),
              }
            : null,
      };
    } else {
      scope = await getPlatformAccess();
      requireTenantPermission(scope, "org:field:manage");
      const body = await request.json();
      const mediaType = String(body.mediaType || "");
      const inferredKind = mediaType.startsWith("audio/")
        ? "audio"
        : mediaType.startsWith("image/")
          ? "image"
          : mediaType.startsWith("video/")
            ? "video"
            : body.mediaUrl
              ? "document"
              : "text";
      const kind = String(body.kind || inferredKind);
      const text = String(body.text ?? body.bodyText ?? "");
      event = {
        provider: "internal",
        from: body.from || "",
        displayName: body.displayName || null,
        text,
        kind,
        media: body.mediaUrl
          ? {
              url: String(body.mediaUrl),
              mimeType: mediaType || null,
              filename: String(body.fileName || body.mediaUrl),
              storage: { provider: "dashboard-simulator", status: "simulated" },
            }
          : null,
        transcription: kind === "audio" && text
          ? { status: "completed", provider: "dashboard-simulator", text }
          : null,
        location:
          Number.isFinite(Number(body.latitude)) && Number.isFinite(Number(body.longitude))
            ? { latitude: Number(body.latitude), longitude: Number(body.longitude) }
            : null,
        timestamp: new Date(),
      };
    }

    const result = await processIncomingObraMessage(event, scope);
    if (isTwilio) {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(result.reply)}</Message></Response>`,
        { headers: { "Content-Type": "text/xml; charset=utf-8" } },
      );
    }
    return Response.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("Failed to process compatibility WhatsApp request:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
