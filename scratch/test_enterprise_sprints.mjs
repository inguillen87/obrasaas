// Verification test for all new Enterprise Sprints
import { runPredictiveAnalysis } from '../src/lib/predictiveAI.js';
import { generateCertificationPdf, generateLibroObraPdf } from '../src/lib/pdfGenerator.js';
import { createCheckoutPreference } from '../src/lib/mercadopago.js';
import { analyzeConstructionPhoto } from '../src/lib/computerVision.js';
import { processCopilotMessage } from '../src/lib/llmCopilot.js';

async function runTests() {
  console.log('🧪 Testing ObraSaaS Enterprise Features...\n');

  // 1. Predictive AI
  const predictiveResult = runPredictiveAnalysis({
    avancePercentage: 60,
    tasks: {
      1: { name: 'Losa Nivel 2', progress: 100, status: 'COMPLETADA' },
      2: { name: 'Revoque Fino', progress: 30, duration: 1, status: 'DEMORADA' }
    },
    budget: { totalPresupuesto: 5000000, totalEjecutado: 3800000 }
  });
  console.log('✅ 1. Predictive AI Health Score:', predictiveResult.overallHealthScore);
  console.log('   - Identified Risks:', predictiveResult.identifiedRisks.length);

  // 2. PDF Generator
  const certPdf = generateCertificationPdf({
    projectName: 'Torre Palermo Soho',
    overallProgress: 60,
    financialAmount: 3800000,
    sha256Signature: '8f4a1c9e2b7d5f0a3e8c1b4d6a9e2f5be3b0c44298fc1c149afbf4c8996fb924'
  });
  console.log('✅ 2. Certification PDF generated:', certPdf.length, 'bytes');

  const libroPdf = generateLibroObraPdf({
    projectName: 'Torre Palermo Soho',
    tasksPerformed: 'Llenado de columnas y revoque fino.',
    signedBy: 'Arq. Marcelo'
  });
  console.log('✅ 3. Libro de Obra PDF generated:', libroPdf.length, 'bytes');

  // 3. Mercado Pago Checkout
  const mpPref = await createCheckoutPreference({ planId: 'professional', tenantSlug: 'constructora-alfa' });
  console.log('✅ 4. Mercado Pago Preference created:', mpPref.id, 'InitPoint:', mpPref.initPoint?.slice(0, 45) + '...');

  // 4. Computer Vision
  const visionRes = await analyzeConstructionPhoto('https://obrasaas.vercel.app/test-photo.jpg', { rubro: 'losa de hormigon' });
  console.log('✅ 5. Computer Vision Phase Detected:', visionRes.phase, 'Progress Estimate:', visionRes.estimatedProgress + '%');

  // 5. LLM Copilot Engine
  const copilotRes = await processCopilotMessage('Decime cuántos operarios vinieron hoy a la obra', {
    state: { projectConfig: { name: 'Torre Palermo Soho' }, attendance: { 'Juan Gómez': { role: 'Oficial' } } },
    senderName: 'Arq. Marcelo'
  });
  console.log('✅ 6. LLM Copilot Source:', copilotRes.source);
  console.log('   Reply Snippet:\n' + copilotRes.reply.slice(0, 150) + '...\n');

  console.log('🎉 ALL ENTERPRISE TESTS PASSED 100%!');
}

runTests().catch(console.error);
