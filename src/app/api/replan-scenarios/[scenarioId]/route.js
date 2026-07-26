import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { getPrisma } from '@/lib/prisma';
import { createReplanComparisonResponse } from '@/lib/replan-comparison-contract';
import { replanScenarioErrorResponse } from '@/lib/replan-scenarios';

function known(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  return replanScenarioErrorResponse(error);
}

export async function GET(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const { scenarioId } = await params;
    const prisma = getPrisma();
    const scenario = await prisma.replanScenario.findFirst({
      where: { id: scenarioId, projectId: access.project.id },
      select: {
        id: true,
        projectId: true,
        extraWorkId: true,
        name: true,
        assumptions: true,
        impact: true,
        status: true,
        revision: true,
        createdAt: true,
        decidedAt: true,
        decisionNote: true,
      },
    });
    if (!scenario) {
      return Response.json(
        { error: 'Escenario no encontrado.', code: 'REPLAN_SCENARIO_NOT_FOUND' },
        { status: 404 },
      );
    }

    const tasks = await listCanonicalTasks(prisma, { projectId: access.project.id, limit: 500 });
    const payload = createReplanComparisonResponse({
      scenario: {
        ...scenario,
        createdAt: scenario.createdAt.toISOString(),
        decidedAt: scenario.decidedAt?.toISOString() || null,
      },
      baselineTasks: tasks.tasks,
    });
    return Response.json(payload, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return known(error) || Response.json(
      { error: 'No se pudo comparar el escenario.', code: 'REPLAN_COMPARE_FAILED' },
      { status: 500 },
    );
  }
}
