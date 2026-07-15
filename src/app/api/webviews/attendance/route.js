import { readWebviewToken } from "@/lib/auth";
import { processIncomingObraMessage } from "@/lib/whatsapp/obra-engine";

export const runtime = "nodejs";

function validCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const worker = String(body.worker || "");
    const token = String(body.token || "");
    const tokenPayload = readWebviewToken(worker, token, { purpose: "attendance" });
    if (!tokenPayload?.ctx) {
      return Response.json({ error: "El enlace venció o no es válido." }, { status: 401 });
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!validCoordinate(latitude, longitude)) {
      return Response.json({ error: "La ubicación recibida no es válida." }, { status: 400 });
    }

    const result = await processIncomingObraMessage({
      provider: "webview",
      from: worker,
      kind: "location",
      location: { latitude, longitude, accuracy: Number(body.accuracy) || null },
      timestamp: new Date(),
    }, { projectId: tokenPayload.ctx });
    return Response.json({ success: true, message: result.reply });
  } catch (error) {
    console.error("Attendance webview failed:", error);
    return Response.json({ error: "No pudimos registrar el fichaje." }, { status: 500 });
  }
}
