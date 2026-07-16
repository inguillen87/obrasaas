export const ATTENDANCE_GEO_WINDOW_MS = 2 * 60 * 60 * 1_000;

export async function ensurePendingGeoAttendance(prisma, {
  projectId,
  workerId,
  now,
  metadata = {},
}) {
  const expiresBefore = new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS);
  const current = await prisma.attendanceEntry.findFirst({
    where: {
      projectId,
      workerId,
      status: 'PENDING_GEO',
      checkedInAt: { gte: expiresBefore },
    },
    orderBy: { checkedInAt: 'desc' },
  });
  if (current) return current;

  await prisma.attendanceEntry.updateMany({
    where: {
      projectId,
      workerId,
      status: 'PENDING_GEO',
      checkedInAt: { lt: expiresBefore },
    },
    data: { status: 'ABSENT' },
  });
  try {
    return await prisma.attendanceEntry.create({
      data: {
        projectId,
        workerId,
        status: 'PENDING_GEO',
        source: 'whatsapp',
        checkedInAt: now,
        metadata,
      },
    });
  } catch (error) {
    if (error?.code !== 'P2002') throw error;
    const winner = await prisma.attendanceEntry.findFirst({
      where: { projectId, workerId, status: 'PENDING_GEO' },
      orderBy: { checkedInAt: 'desc' },
    });
    if (winner) return winner;
    throw error;
  }
}

export async function completePendingGeoAttendance(prisma, {
  projectId,
  workerId,
  now,
  latitude,
  longitude,
  distanceMeters,
  inside,
  accuracy,
}) {
  const pending = await prisma.attendanceEntry.findFirst({
    where: {
      projectId,
      workerId,
      status: 'PENDING_GEO',
      checkedInAt: { gte: new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS) },
    },
    orderBy: { checkedInAt: 'desc' },
  });
  if (!pending) return null;

  const status = inside ? 'PRESENT' : 'OUTSIDE_GEOFENCE';
  const updated = await prisma.attendanceEntry.updateMany({
    where: {
      id: pending.id,
      projectId,
      workerId,
      status: 'PENDING_GEO',
    },
    data: {
      status,
      latitude,
      longitude,
      distanceMeters,
      metadata: {
        ...(pending.metadata && typeof pending.metadata === 'object' ? pending.metadata : {}),
        geofenceValidatedAt: now.toISOString(),
        accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
      },
    },
  });
  if (updated.count !== 1) return null;

  return { id: pending.id, status };
}
