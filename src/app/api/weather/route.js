import { getConstructionWeatherTelemetry, ARGENTINA_CITIES } from '../../../lib/weatherTelemetry.js';
import { getAppState } from '../../../lib/db.js';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const qLat = searchParams.get('lat');
        const qLon = searchParams.get('lon');
        const qCity = searchParams.get('city');
        const qName = searchParams.get('name') || searchParams.get('siteName');
        const qProjectId = searchParams.get('projectId');

        const state = await getAppState();

        let targetProject = state.projectConfig || {};
        if (qProjectId && Array.isArray(state.projects)) {
            const found = state.projects.find(p => p.id === qProjectId);
            if (found) targetProject = found;
        }

        // If specific city requested, resolve its coordinates
        let resolvedLat = qLat ? parseFloat(qLat) : undefined;
        let resolvedLon = qLon ? parseFloat(qLon) : undefined;
        let resolvedCity = qCity || targetProject.city || "Buenos Aires";
        let resolvedProvince = targetProject.province || "Argentina";

        if (qCity && (!qLat || !qLon)) {
            const cityKey = qCity.toLowerCase().trim();
            if (ARGENTINA_CITIES[cityKey]) {
                resolvedLat = ARGENTINA_CITIES[cityKey].lat;
                resolvedLon = ARGENTINA_CITIES[cityKey].lon;
                resolvedProvince = ARGENTINA_CITIES[cityKey].province;
            }
        }

        if (resolvedLat === undefined || resolvedLon === undefined) {
            resolvedLat = targetProject.latitude || -34.5886;
            resolvedLon = targetProject.longitude || -58.4302;
        }

        const projectParams = {
            lat: resolvedLat,
            lon: resolvedLon,
            name: qName || targetProject.name || "Obra Activa",
            city: resolvedCity,
            province: resolvedProvince
        };

        const telemetry = await getConstructionWeatherTelemetry(projectParams);
        return Response.json(telemetry);
    } catch (error) {
        console.error("Weather API dynamic error:", error);
        return Response.json({ error: "Failed to fetch weather telemetry" }, { status: 500 });
    }
}
