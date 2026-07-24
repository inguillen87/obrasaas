const DEFAULT_SHIFT_PAGE_SIZE = 500;

export async function loadWeeklyAttendanceShifts(prisma, {
  projectId,
  workDateRange,
  generatedAt,
  pageSize = DEFAULT_SHIFT_PAGE_SIZE,
} = {}) {
  if (typeof prisma?.attendanceShift?.findMany !== 'function') {
    throw new Error('Attendance shift storage is unavailable.');
  }
  if (!projectId || !workDateRange?.start || !workDateRange?.end) {
    throw new Error('A project and work-date range are required.');
  }

  const boundedPageSize = Math.min(
    1_000,
    Math.max(1, Number.isSafeInteger(pageSize) ? pageSize : DEFAULT_SHIFT_PAGE_SIZE),
  );
  const reportCutoff = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (Number.isNaN(reportCutoff.getTime())) {
    throw new Error('A valid report cutoff is required.');
  }

  const shifts = [];
  let cursor = null;
  while (true) {
    const page = await prisma.attendanceShift.findMany({
      where: {
        projectId,
        workDate: { gte: workDateRange.start, lte: workDateRange.end },
        createdAt: { lte: reportCutoff },
        status: { not: 'VOIDED' },
      },
      select: {
        id: true,
        workerId: true,
        workDate: true,
        timezone: true,
        worker: { select: { name: true, role: true } },
        events: {
          where: { occurredAt: { lte: reportCutoff } },
          select: {
            id: true,
            workerId: true,
            shiftId: true,
            eventType: true,
            verificationStatus: true,
            occurredAt: true,
            sequence: true,
          },
          orderBy: [{ sequence: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
        },
        correctionRequests: {
          where: {
            decision: { is: { decision: 'APPROVED', createdAt: { lte: reportCutoff } } },
            adjustment: { is: { createdAt: { lte: reportCutoff } } },
          },
          select: {
            decision: { select: { decision: true } },
            adjustment: {
              select: {
                id: true,
                appliedShiftRevision: true,
                baseLedgerSequence: true,
                effectiveHash: true,
                effectiveEvents: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: boundedPageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    shifts.push(...page);
    if (page.length < boundedPageSize) break;
    const nextCursor = page.at(-1)?.id;
    if (!nextCursor || nextCursor === cursor) {
      throw new Error('Attendance report pagination did not advance.');
    }
    cursor = nextCursor;
  }

  return shifts;
}

export async function loadWeeklyAttendanceExpectations(prisma, {
  projectId,
  workDateRange,
  generatedAt,
  pageSize = DEFAULT_SHIFT_PAGE_SIZE,
} = {}) {
  if (typeof prisma?.attendanceExpectation?.findMany !== 'function') return [];
  if (!projectId || !workDateRange?.start || !workDateRange?.end) {
    throw new Error('A project and work-date range are required.');
  }
  const reportCutoff = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  if (Number.isNaN(reportCutoff.getTime())) throw new Error('A valid report cutoff is required.');
  const boundedPageSize = Math.min(
    1_000,
    Math.max(1, Number.isSafeInteger(pageSize) ? pageSize : DEFAULT_SHIFT_PAGE_SIZE),
  );
  const expectations = [];
  let cursor = null;
  while (true) {
    const page = await prisma.attendanceExpectation.findMany({
      where: {
        projectId,
        workDate: { gte: workDateRange.start, lte: workDateRange.end },
        createdAt: { lte: reportCutoff },
      },
      orderBy: { id: 'asc' },
      take: boundedPageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        projectId: true,
        workerId: true,
        workDate: true,
        worker: { select: { name: true, role: true } },
        revisions: {
          where: { createdAt: { lte: reportCutoff } },
          orderBy: { revision: 'desc' },
          take: 1,
        },
        shift: {
          select: {
            id: true,
            projectId: true,
            workerId: true,
            status: true,
            phase: true,
            revision: true,
            events: {
              where: { occurredAt: { lte: reportCutoff } },
              orderBy: [{ sequence: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
            },
            correctionRequests: {
              where: {
                decision: { is: { decision: 'APPROVED', createdAt: { lte: reportCutoff } } },
                adjustment: { is: { createdAt: { lte: reportCutoff } } },
              },
              select: {
                decision: { select: { decision: true } },
                adjustment: true,
              },
            },
          },
        },
      },
    });
    expectations.push(...page);
    if (page.length < boundedPageSize) break;
    const nextCursor = page.at(-1)?.id;
    if (!nextCursor || nextCursor === cursor) {
      throw new Error('Attendance expectation pagination did not advance.');
    }
    cursor = nextCursor;
  }
  return expectations;
}
