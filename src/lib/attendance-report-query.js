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
