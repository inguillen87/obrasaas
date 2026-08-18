// POST /api/v1/vision — Computer Vision Construction Photo Analysis Endpoint
import { analyzeConstructionPhoto } from '@/lib/computerVision';
import { getAppState, saveAppState } from '@/lib/db';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { photoUrl, imageBase64, rubro, caption, uploaderName = 'Director' } = body;

    const targetImage = photoUrl || imageBase64;
    if (!targetImage) {
      return Response.json({ error: 'Falta photoUrl o imageBase64' }, { status: 400 });
    }

    const analysis = await analyzeConstructionPhoto(targetImage, { rubro, caption });

    // Persist to sitePhotos in state
    const state = await getAppState();
    state.sitePhotos = state.sitePhotos || [];

    const photoEntry = {
      id: `photo-${Date.now()}`,
      url: photoUrl || 'data:image/jpeg;base64,...',
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toISOString().split('T')[0],
      phase: analysis.phase,
      estimatedProgress: analysis.estimatedProgress,
      isIncident: analysis.isIncident,
      aiAnalysis: analysis.aiAnalysis,
      actionRecommendation: analysis.actionRecommendation,
      safetyCompliance: analysis.safetyCompliance,
      uploader: uploaderName
    };

    state.sitePhotos.unshift(photoEntry);

    // If an incident was detected, append to state.incidents
    if (analysis.isIncident) {
      state.incidents = state.incidents || [];
      state.alertsCount = (state.alertsCount || 0) + 1;
      state.incidents.unshift({
        id: `inc-vision-${Date.now()}`,
        title: `Alerta detectada por Visión Artificial en ${analysis.phase}`,
        description: analysis.aiAnalysis,
        type: 'critical',
        badge: 'Computer Vision',
        timestamp: `Hoy, ${photoEntry.timestamp}`,
        reporter: `IA ObraSaaS (${analysis.source})`,
        icon: 'fa-solid fa-camera'
      });
    }

    state.auditLedger = appendAuditTransaction(state.auditLedger, {
      action: "ANALISIS_FOTOGRAFICO_VISION_IA",
      actor: uploaderName,
      details: { phase: analysis.phase, progress: analysis.estimatedProgress, isIncident: analysis.isIncident }
    });

    await saveAppState(state);

    return Response.json({
      success: true,
      analysis,
      photoEntry
    });
  } catch (err) {
    console.error('Vision API error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
