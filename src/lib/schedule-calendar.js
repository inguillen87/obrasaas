import {
  addCivilDays,
  civilDateKey,
  fortnightBucket,
  listSupplierCommitments,
  todayInTimezone,
} from './supplier-commitments.js';

const DAY_MILLISECONDS = 86_400_000;
const MAX_RANGE_DAYS = 366;

export class ScheduleCalendarError extends Error {
  constructor(message, code = 'SCHEDULE_CALENDAR_INVALID', status = 400) {
    super(message);
    this.name = 'ScheduleCalendarError';
    this.code = code;
    this.status = status;
  }
}

function rangeDays(from, to) {
  return Math.round((new Date(`${to}T00:00:00.000Z`) - new Date(`${from}T00:00:00.000Z`)) / DAY_MILLISECONDS) + 1;
}

function normalizeRange({ from, to, timezone, now }) {
  const start = from ? civilDateKey(from, 'from') : todayInTimezone(timezone, now);
  const end = to ? civilDateKey(to, 'to') : addCivilDays(start, 89);
  const days = rangeDays(start, end);
  if (days < 1 || days > MAX_RANGE_DAYS) {
    throw new ScheduleCalendarError(`El calendario admite rangos de 1 a ${MAX_RANGE_DAYS} dias.`);
  }
  return { from: start, to: end, days };
}

function taskCivilDate(value) {
  // Canonical WBS dates are persisted as UTC-midnight civil dates. Applying
  // the tenant offset here would shift Argentina dates to the previous day.
  return value ? civilDateKey(value) : null;
}

function serializeTask(task) {
  const startsOn = taskCivilDate(task.startsAt);
  const endsOn = taskCivilDate(task.endsAt || task.startsAt);
  return {
    id: task.id,
    code: task.code || null,
    title: task.title,
    type: task.type,
    status: task.status,
    progress: task.progress,
    assignee: task.assignee || null,
    startsOn,
    endsOn,
    revision: task.revision,
    dependencies: (task.predecessors || []).map((dependency) => ({
      predecessorId: dependency.predecessorId,
      type: dependency.type,
      lagDays: dependency.lagDays,
    })),
    openBlockers: (task.blockers || []).map((blocker) => ({
      id: blocker.id,
      title: blocker.title,
      severity: blocker.severity,
      status: blocker.status,
    })),
  };
}

function buildBuckets(from, to, tasks, commitments) {
  const buckets = [];
  let cursor = from;
  while (cursor <= to) {
    const bucket = fortnightBucket(cursor);
    const boundedStart = bucket.start < from ? from : bucket.start;
    const boundedEnd = bucket.end > to ? to : bucket.end;
    buckets.push({
      ...bucket,
      start: boundedStart,
      end: boundedEnd,
      tasks: tasks.filter((task) => task.startsOn <= boundedEnd && task.endsOn >= boundedStart),
      commitments: commitments.filter((commitment) => commitment.startsOn <= boundedEnd && commitment.endsOn >= boundedStart),
    });
    cursor = addCivilDays(bucket.end, 1);
  }
  return buckets;
}

export async function loadScheduleCalendar(prisma, {
  organizationId,
  projectId,
  from = null,
  to = null,
  now = new Date(),
} = {}) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    select: { id: true, name: true, slug: true, organization: { select: { timezone: true } } },
  });
  if (!project) throw new ScheduleCalendarError('La obra no esta disponible.', 'SCHEDULE_CALENDAR_SCOPE', 404);
  const timezone = project.organization.timezone;
  const range = normalizeRange({ from, to, timezone, now });
  const fromInstant = new Date(`${range.from}T00:00:00.000Z`);
  const toInstant = new Date(`${range.to}T23:59:59.999Z`);
  const [taskRows, commitmentData] = await Promise.all([
    prisma.task.findMany({
      where: {
        projectId,
        metadata: { path: ['source'], equals: 'canonical-task-v1' },
        startsAt: { lte: toInstant },
        OR: [
          { endsAt: { gte: fromInstant } },
          { endsAt: null, startsAt: { gte: fromInstant } },
        ],
      },
      include: {
        predecessors: true,
        blockers: {
          where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
          select: { id: true, title: true, severity: true, status: true },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 5_001,
    }),
    listSupplierCommitments(prisma, {
      organizationId,
      projectId,
      from: range.from,
      to: range.to,
      limit: 5_000,
      now,
    }),
  ]);
  const tasksTruncated = taskRows.length > 5_000;
  const tasks = taskRows.slice(0, 5_000).map((task) => serializeTask(task));
  const commitments = commitmentData.commitments;
  return {
    authority: 'LIVE_CANONICAL_WBS',
    timezone,
    generatedAt: now.toISOString(),
    range,
    project: { id: project.id, name: project.name, slug: project.slug },
    tasks,
    commitments,
    truncated: {
      tasks: tasksTruncated,
      commitments: commitmentData.hasMore === true,
      any: tasksTruncated || commitmentData.hasMore === true,
    },
    fortnights: buildBuckets(range.from, range.to, tasks, commitments),
  };
}

function escapeIcs(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function icsDate(value) {
  return civilDateKey(value).replaceAll('-', '');
}

function icsTimestamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function foldIcsLine(line) {
  const chunks = [];
  let current = '';
  let currentBytes = 0;
  for (const character of line) {
    const bytes = new TextEncoder().encode(character).length;
    const limit = chunks.length === 0 ? 75 : 74;
    if (current && currentBytes + bytes > limit) {
      chunks.push(current);
      current = character;
      currentBytes = bytes;
    } else {
      current += character;
      currentBytes += bytes;
    }
  }
  chunks.push(current);
  return chunks.map((chunk, index) => index === 0 ? chunk : ` ${chunk}`).join('\r\n');
}

function taskEvent(task, generatedAt) {
  return [
    'BEGIN:VEVENT',
    `UID:task-${task.id}@calendar.obrasaas`,
    `SEQUENCE:${task.revision}`,
    `DTSTAMP:${icsTimestamp(generatedAt)}`,
    `DTSTART;VALUE=DATE:${icsDate(task.startsOn)}`,
    `DTEND;VALUE=DATE:${icsDate(addCivilDays(task.endsOn, 1))}`,
    `SUMMARY:${escapeIcs(task.title)}`,
    `DESCRIPTION:${escapeIcs(`Tarea ${task.code || ''} - ${task.progress}% - ${task.status}`)}`,
    task.status === 'DONE' ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED',
    'END:VEVENT',
  ];
}

function commitmentEvent(commitment, generatedAt) {
  const supplier = commitment.supplier?.legalName || 'Proveedor';
  const kind = commitment.kind === 'MATERIAL_DELIVERY' ? 'Entrega' : 'Servicio';
  return [
    'BEGIN:VEVENT',
    `UID:commitment-${commitment.id}@calendar.obrasaas`,
    `SEQUENCE:${commitment.revision}`,
    `DTSTAMP:${icsTimestamp(generatedAt)}`,
    `DTSTART;VALUE=DATE:${icsDate(commitment.startsOn)}`,
    `DTEND;VALUE=DATE:${icsDate(addCivilDays(commitment.endsOn, 1))}`,
    `SUMMARY:${escapeIcs(`${kind}: ${commitment.title}`)}`,
    `DESCRIPTION:${escapeIcs(`${supplier} - ${commitment.status}`)}`,
    commitment.status === 'CANCELLED' ? 'STATUS:CANCELLED' : commitment.status === 'TENTATIVE' ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED',
    'END:VEVENT',
  ];
}

export function buildScheduleCalendarIcs(calendar) {
  if (calendar?.truncated?.any) {
    throw new ScheduleCalendarError(
      'El calendario supera el limite seguro de exportacion y no se generara incompleto.',
      'SCHEDULE_CALENDAR_TRUNCATED',
      409,
    );
  }
  const generatedAt = calendar.generatedAt || new Date(0).toISOString();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ObraSaaS//Plan quincenal//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(`${calendar.project.name} - ObraSaaS`)}`,
    `X-WR-TIMEZONE:${escapeIcs(calendar.timezone)}`,
    ...calendar.tasks.flatMap((task) => taskEvent(task, generatedAt)),
    ...calendar.commitments.flatMap((commitment) => commitmentEvent(commitment, generatedAt)),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

export function scheduleCalendarErrorResponse(error) {
  if (!(error instanceof ScheduleCalendarError)) return null;
  return Response.json({ error: error.message, code: error.code }, { status: error.status });
}
