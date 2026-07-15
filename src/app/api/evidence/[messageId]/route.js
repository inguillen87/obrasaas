import { get } from "@vercel/blob";
import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from "@/lib/access";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeFileName(value, fallback) {
  const name = String(value || fallback)
    .replace(/[\r\n"\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .trim()
    .slice(0, 140);
  return name || fallback;
}

function isPrivateVercelBlobUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "private.blob.vercel-storage.com"
        || url.hostname.endsWith(".private.blob.vercel-storage.com"));
  } catch {
    return false;
  }
}

export async function GET(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, "org:projects:read");
    const { messageId } = await params;
    const message = await getPrisma().message.findFirst({
      where: {
        id: String(messageId || ""),
        conversation: { projectId: access.project.id },
      },
      select: {
        id: true,
        kind: true,
        mediaUrl: true,
        metadata: true,
      },
    });

    if (!message?.mediaUrl || !isPrivateVercelBlobUrl(message.mediaUrl)) {
      return Response.json({ error: "Evidence not found" }, { status: 404 });
    }

    const result = await get(message.mediaUrl, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return Response.json({ error: "Evidence not found" }, { status: 404 });
    }

    const metadata = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
      ? message.metadata
      : {};
    const media = metadata.media && typeof metadata.media === "object" ? metadata.media : {};
    const fileName = safeFileName(media.filename, `evidence-${message.id}`);
    const asDownload = new URL(request.url).searchParams.get("download") === "1";

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60, must-revalidate",
        "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="${fileName}"`,
        "Content-Length": String(result.blob.size),
        "Content-Type": result.blob.contentType || media.mimeType || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    console.error("Failed to deliver protected evidence:", error);
    return Response.json({ error: "Unable to load evidence" }, { status: 500 });
  }
}
