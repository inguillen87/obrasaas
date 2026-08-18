import { getConstructionWeatherTelemetry } from '../../../lib/weatherTelemetry.js';
import { getAppState } from '../../../lib/db.js';

export async function GET(request) {
    try {
        const state = await getAppState();
        const coords = {
            lat: state.projectConfig?.latitude || -34.5886,
            lon: state.projectConfig?.longitude || -58.4302,
            name: state.projectConfig?.name || "Torre Palermo Soho"
        };

        const telemetry = await getConstructionWeatherTelemetry(coords);
        return Response.json(telemetry);
    } catch (error) {
        console.error("Weather API error:", error);
        return Response.json({ error: "Failed to fetch weather telemetry" }, { status: 500 });
    }
}
