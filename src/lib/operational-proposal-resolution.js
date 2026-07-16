import {
  appendOperationalIncident,
  ensureOperationalStateCollections,
  recalculateOverallProgress,
  selectOperationalTask,
} from './operational-state-effects.js';
import {
  isSensitiveMedicalText,
  restrictedOperationalDescription,
  sensitiveMedicalOperationalDescription,
} from './medical-privacy.js';
import {
  OPERATIONAL_PROPOSAL_DECISIONS,
  OPERATIONAL_PROPOSAL_STATUSES,
  OPERATIONAL_PROPOSAL_TYPES,
  canResolveOperationalProposal,
  finalizeOperationalProposal,
  findOperationalProposal,
  invalidateOperationalProposal,
  markOperationalProposalExpired,
} from './whatsapp/operational-proposals.js';

const RESTRICTED_CRITICAL_INCIDENT_DESCRIPTION = [
  'Se confirmó una incidencia crítica reportada desde el campo.',
  'El detalle sensible permanece en la propuesta y la evidencia con acceso restringido.',
  'Aplicá el protocolo de seguridad vigente y verificá la situación con el responsable autorizado.',
].join(' ');

function normalizedTaskIdentity(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-AR');
}

function terminalProposalReply(proposal) {
  if (proposal.status === OPERATIONAL_PROPOSAL_STATUSES.APPLIED) {
    return `La propuesta ${proposal.confirmationCode} ya fue aplicada. No repetí ningún cambio.`;
  }
  if (proposal.status === OPERATIONAL_PROPOSAL_STATUSES.REJECTED) {
    return `La propuesta ${proposal.confirmationCode} ya fue rechazada. No modifiqué la obra.`;
  }
  if (proposal.status === OPERATIONAL_PROPOSAL_STATUSES.EXPIRED) {
    return `La propuesta ${proposal.confirmationCode} venció. Enviá un nuevo audio o comando para generar una decisión actualizada.`;
  }
  if (proposal.status === OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED) {
    return `La propuesta ${proposal.confirmationCode} quedó invalidada porque el contexto de la obra cambió. Generá una nueva propuesta.`;
  }
  return `La propuesta ${proposal.confirmationCode} ya no está pendiente. No repetí ningún cambio.`;
}

export async function resolveOperationalProposalDecision({
  state,
  resolver,
  event,
  now,
  projectSettings,
  prisma,
  decision,
  auditActorId = null,
  auditSource = null,
}) {
  ensureOperationalStateCollections(state);
  if (!Object.values(OPERATIONAL_PROPOSAL_DECISIONS).includes(decision?.decision)) {
    return {
      reply: 'La decisión recibida no es válida. No modifiqué la obra.',
      stateChanged: false,
      authorized: false,
      proposal: null,
      outcome: 'DECISION_INVALID',
    };
  }
  const proposal = await findOperationalProposal(prisma, {
    projectId: projectSettings.id,
    confirmationCode: decision.confirmationCode,
  });
  if (!proposal) {
    return {
      reply: `No encontré una propuesta pendiente con el código ${decision.confirmationCode} en esta obra.`,
      stateChanged: false,
      authorized: false,
      proposal: null,
      outcome: 'NOT_FOUND',
    };
  }
  if (proposal.status !== OPERATIONAL_PROPOSAL_STATUSES.PENDING) {
    return {
      reply: terminalProposalReply(proposal),
      stateChanged: false,
      authorized: true,
      proposal,
      outcome: 'ALREADY_TERMINAL',
    };
  }

  const organizationId = projectSettings.organizationId;
  const resolverProvider = String(event.provider || decision.channel || 'whatsapp')
    .trim()
    .toLowerCase()
    .slice(0, 32);
  const resolverExternalId = String(event.externalId || '').trim().slice(0, 512);
  if (!organizationId || !resolverProvider || !resolverExternalId) {
    return {
      reply: 'No pude vincular esta confirmación a un evento confiable. No modifiqué la obra.',
      stateChanged: false,
      authorized: false,
      proposal,
      outcome: 'RESOLVER_IDENTITY_INVALID',
    };
  }

  const transitionContext = {
    proposal,
    projectId: projectSettings.id,
    organizationId,
    resolverWorkerId: resolver?.id || null,
    resolverProvider,
    resolverExternalId,
    auditActorId,
    auditSource,
    now,
  };
  if (new Date(proposal.expiresAt).getTime() <= now.getTime()) {
    const expired = await markOperationalProposalExpired(prisma, {
      ...transitionContext,
      result: { reason: 'confirmation_after_expiry' },
    });
    return {
      reply: `La propuesta ${proposal.confirmationCode} venció. Enviá un nuevo audio para trabajar con información actualizada.`,
      stateChanged: false,
      authorized: true,
      proposal: expired
        ? { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.EXPIRED }
        : proposal,
      outcome: expired ? 'EXPIRED' : 'RACE_LOST',
    };
  }

  if (!canResolveOperationalProposal(resolver, proposal, decision.decision)) {
    return {
      reply: proposal.type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT
        ? 'Tu identidad no puede resolver esta propuesta crítica. Debe hacerlo quien la reportó, Seguridad, el capataz o el jefe de obra.'
        : 'Tu identidad puede reportar, pero sólo un capataz o jefe de obra puede aprobar o rechazar este cambio operativo.',
      stateChanged: false,
      authorized: false,
      proposal,
      outcome: 'FORBIDDEN',
    };
  }

  if (decision.decision === OPERATIONAL_PROPOSAL_DECISIONS.REJECT) {
    const rejected = await finalizeOperationalProposal(prisma, {
      ...transitionContext,
      decision: decision.decision,
      result: { reason: 'rejected_by_authorized_resolver' },
    });
    return {
      reply: rejected
        ? `Rechacé la propuesta ${proposal.confirmationCode}. La evidencia permanece en la bitácora y no modifiqué la obra.`
        : `La propuesta ${proposal.confirmationCode} cambió de estado antes de poder rechazarla. No repetí ninguna acción.`,
      stateChanged: false,
      authorized: true,
      proposal: rejected
        ? { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.REJECTED }
        : proposal,
      outcome: rejected ? 'REJECTED' : 'RACE_LOST',
    };
  }

  if (proposal.type === OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS) {
    const action = proposal.action && typeof proposal.action === 'object'
      ? proposal.action
      : {};
    const precondition = proposal.precondition && typeof proposal.precondition === 'object'
      ? proposal.precondition
      : null;
    const percentage = Number(action.percentage);
    let taskKey = action.taskKey ? String(action.taskKey) : null;
    let task = taskKey ? state.tasks[taskKey] : null;

    if (taskKey) {
      const stale = !task
        || !precondition
        || (
            Number(task.progress) !== Number(precondition.taskProgress)
            || (
              precondition.taskName
              && String(task.name || '') !== String(precondition.taskName)
            )
        );
      if (stale) {
        const invalidated = await invalidateOperationalProposal(prisma, {
          ...transitionContext,
          result: {
            reason: !task
              ? 'task_missing_after_proposal'
              : !precondition
                ? 'task_precondition_missing'
                : 'task_changed_after_proposal',
            taskKey,
          },
        });
        return {
          reply: invalidated
            ? `La tarea vinculada a ${proposal.confirmationCode} cambió después del audio. Invalidé la propuesta para no pisar un avance más nuevo.`
            : `La propuesta ${proposal.confirmationCode} cambió de estado. No modifiqué el Gantt.`,
          stateChanged: false,
          authorized: true,
          proposal: invalidated
            ? { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED }
            : proposal,
          outcome: invalidated ? 'INVALIDATED' : 'RACE_LOST',
        };
      }
    } else {
      const explicitTaskReference = String(decision.taskReference || '').trim();
      const explicitTaskIdentity = explicitTaskReference
        .trim()
        .replace(/^(?:tarea|task|actividad|item|hito|frente)\s*#?\s*/i, '')
        .trim();
      const matchingTaskEntries = explicitTaskIdentity
        ? Object.entries(state.tasks).filter(([candidate, candidateTask]) => (
            normalizedTaskIdentity(candidate) === normalizedTaskIdentity(explicitTaskIdentity)
            || normalizedTaskIdentity(candidateTask?.name)
              === normalizedTaskIdentity(explicitTaskIdentity)
          ))
        : [];
      if (matchingTaskEntries.length === 1) {
        [taskKey, task] = matchingTaskEntries[0];
      } else if (explicitTaskReference) {
        taskKey = null;
        task = null;
      } else {
        [taskKey, task] = selectOperationalTask(
          state,
          action.taskReference || '',
        );
      }
    }

    if (!taskKey || !task) {
      return {
        reply: `La propuesta ${proposal.confirmationCode} sigue pendiente: indicá la tarea exacta antes de aprobarla.`,
        stateChanged: false,
        authorized: true,
        proposal,
        outcome: 'TASK_REQUIRED',
      };
    }
    if (!action.taskKey) {
      const currentProgress = Number(task.progress) || 0;
      const expectedProgress = Number(decision.taskExpectedProgress);
      const confirmationCommand = `CONFIRMAR ${proposal.confirmationCode} TAREA ${taskKey} DESDE ${currentProgress}%`;
      if (
        decision.taskExpectedProgress === null
        || decision.taskExpectedProgress === undefined
        || !Number.isFinite(expectedProgress)
      ) {
        return {
          reply: `La tarea “${task.name}” está actualmente en ${currentProgress}%. Para evitar pisar un avance más nuevo, confirmá exactamente: ${confirmationCommand}`,
          stateChanged: false,
          authorized: true,
          proposal,
          outcome: 'TASK_CONFIRMATION_REQUIRED',
        };
      }
      if (expectedProgress !== currentProgress) {
        return {
          reply: `La tarea “${task.name}” cambió y ahora está en ${currentProgress}%. Revisá el dato y, si corresponde, confirmá: ${confirmationCommand}`,
          stateChanged: false,
          authorized: true,
          proposal,
          outcome: 'TASK_PRECONDITION_STALE',
        };
      }
    }
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      const invalidated = await invalidateOperationalProposal(prisma, {
        ...transitionContext,
        result: { reason: 'invalid_stored_percentage', taskKey },
      });
      return {
        reply: invalidated
          ? `La propuesta ${proposal.confirmationCode} contenía un porcentaje inválido y fue anulada sin modificar la obra.`
          : `La propuesta ${proposal.confirmationCode} cambió de estado. No modifiqué el Gantt.`,
        stateChanged: false,
        authorized: true,
        proposal: invalidated
          ? { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED }
          : proposal,
        outcome: invalidated ? 'INVALIDATED' : 'RACE_LOST',
      };
    }

    const previousProgress = Number(task.progress) || 0;
    const result = {
      taskKey,
      taskName: String(task.name || ''),
      previousProgress,
      nextProgress: percentage,
    };
    const applied = await finalizeOperationalProposal(prisma, {
      ...transitionContext,
      decision: decision.decision,
      result,
    });
    if (!applied) {
      return {
        reply: `La propuesta ${proposal.confirmationCode} cambió de estado antes de aplicarse. No repetí ningún cambio.`,
        stateChanged: false,
        authorized: true,
        proposal,
        outcome: 'RACE_LOST',
      };
    }
    task.progress = percentage;
    const aggregateChanged = recalculateOverallProgress(state);
    return {
      reply: `Apliqué la propuesta ${proposal.confirmationCode}: “${task.name}” pasó de ${previousProgress}% a ${percentage}%.`,
      stateChanged: previousProgress !== percentage || aggregateChanged,
      authorized: true,
      proposal: { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.APPLIED, result },
      outcome: 'APPLIED',
    };
  }

  if (
    proposal.type === OPERATIONAL_PROPOSAL_TYPES.DELAY_REPORT
    || proposal.type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT
  ) {
    const critical = proposal.type === OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT;
    const medical = isSensitiveMedicalText(proposal.summary);
    // Proposal summaries originate in free-form voice transcripts. They are
    // never copied into the shared project state, even when no medical term
    // was recognized, because keyword detection is not an authorization
    // boundary.
    const detailRestricted = true;
    const result = {
      effect: 'incident_created',
      severity: critical ? 'critical' : 'warning',
    };
    const applied = await finalizeOperationalProposal(prisma, {
      ...transitionContext,
      decision: decision.decision,
      result,
    });
    if (!applied) {
      return {
        reply: `La propuesta ${proposal.confirmationCode} cambió de estado antes de aplicarse. No repetí ningún cambio.`,
        stateChanged: false,
        authorized: true,
        proposal,
        outcome: 'RACE_LOST',
      };
    }
    const incidentAdded = appendOperationalIncident(
      state,
      { externalId: `operational-proposal:${proposal.id}` },
      {
        title: critical ? 'Incidencia crítica confirmada' : 'Demora confirmada',
        description: critical
          ? RESTRICTED_CRITICAL_INCIDENT_DESCRIPTION
          : medical
            ? sensitiveMedicalOperationalDescription()
            : restrictedOperationalDescription(),
        type: critical ? 'critical' : 'warning',
        badge: critical ? 'Urgente' : 'Planificación',
        reporter: proposal.proposedByWorker?.name || resolver?.name || 'Equipo de obra',
        icon: critical ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-clock',
        now,
        sensitivity: critical ? 'restricted' : medical ? 'medical' : 'restricted',
        metadata: detailRestricted
          ? {
              kind: 'operational-proposal',
              proposalId: proposal.id,
              detailRestricted: true,
            }
          : null,
        timeZone: projectSettings.timezone,
      },
    );
    if (incidentAdded) state.alertsCount += 1;
    return {
      reply: critical
        ? `Apliqué la propuesta ${proposal.confirmationCode}: la incidencia crítica quedó visible en alertas. Si hay riesgo para personas, detené la tarea y seguí el protocolo de seguridad.`
        : `Apliqué la propuesta ${proposal.confirmationCode}: la demora quedó registrada para revisión de planificación, sin reprogramar automáticamente el cronograma.`,
      stateChanged: incidentAdded,
      authorized: true,
      proposal: { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.APPLIED, result },
      outcome: 'APPLIED',
    };
  }

  const invalidated = await invalidateOperationalProposal(prisma, {
    ...transitionContext,
    result: { reason: 'unsupported_proposal_type' },
  });
  return {
    reply: invalidated
      ? `La propuesta ${proposal.confirmationCode} no tiene una acción compatible y fue anulada sin modificar la obra.`
      : `La propuesta ${proposal.confirmationCode} cambió de estado. No modifiqué la obra.`,
    stateChanged: false,
    authorized: true,
    proposal: invalidated
      ? { ...proposal, status: OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED }
      : proposal,
    outcome: invalidated ? 'INVALIDATED' : 'RACE_LOST',
  };
}
