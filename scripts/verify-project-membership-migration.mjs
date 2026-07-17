import assert from 'node:assert/strict';

import { PrismaNeon } from '@prisma/adapter-neon';
import { config } from 'dotenv';

import { PrismaClient } from '../src/generated/prisma/client.ts';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for project-access migration verification.');
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  const [integrity] = await prisma.$queryRawUnsafe(`
    SELECT
      to_regclass('public."ProjectMembership"') IS NOT NULL AS "tableExists",
      (
        SELECT COUNT(*)::integer
        FROM "ProjectMembership" AS assignment
        JOIN "Project" AS project ON project."id" = assignment."projectId"
        JOIN "TenantMembership" AS membership
          ON membership."id" = assignment."tenantMembershipId"
        WHERE project."organizationId" <> membership."organizationId"
      ) AS "crossTenantAssignments",
      (
        SELECT COUNT(*)::integer
        FROM "ProjectMembership" AS assignment
        JOIN "Project" AS project ON project."id" = assignment."projectId"
        WHERE assignment."status" = 'ACTIVE'::"MembershipStatus"
          AND project."status" = 'ARCHIVED'::"ProjectStatus"
      ) AS "activeArchivedAssignments",
      (
        SELECT COUNT(*)::integer
        FROM (
          SELECT "projectId", "tenantMembershipId", COUNT(*)
          FROM "ProjectMembership"
          GROUP BY "projectId", "tenantMembershipId"
          HAVING COUNT(*) > 1
        ) AS duplicate_assignment
      ) AS "duplicateAssignments"
  `);

  assert.equal(integrity.tableExists, true);
  assert.equal(integrity.crossTenantAssignments, 0);
  assert.equal(integrity.activeArchivedAssignments, 0);
  assert.equal(integrity.duplicateAssignments, 0);

  console.log(JSON.stringify({
    tableExists: integrity.tableExists,
    crossTenantAssignments: integrity.crossTenantAssignments,
    activeArchivedAssignments: integrity.activeArchivedAssignments,
    duplicateAssignments: integrity.duplicateAssignments,
  }));
} finally {
  await prisma.$disconnect();
}
