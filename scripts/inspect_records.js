const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        const orgs = await pool.query('SELECT id, name, slug FROM "Organization" LIMIT 5');
        console.log('Organizations:', orgs.rows);

        const projects = await pool.query('SELECT id, name, slug, "organizationId" FROM "Project" LIMIT 5');
        console.log('Projects:', projects.rows);

        const workers = await pool.query('SELECT id, name, phone, role, "projectId" FROM "Worker" LIMIT 5');
        console.log('Workers:', workers.rows);

        const tasks = await pool.query('SELECT id, name, progress, "projectId" FROM "Task" LIMIT 5');
        console.log('Tasks:', tasks.rows);

        const proposals = await pool.query('SELECT id, intent, summary, status FROM "OperationalProposal" LIMIT 5');
        console.log('Operational Proposals:', proposals.rows);

        const incidents = await pool.query('SELECT id, title, severity FROM "Incident" LIMIT 5');
        console.log('Incidents:', incidents.rows);
    } catch(e) {
        console.error('Inspection error:', e);
    } finally {
        await pool.end();
    }
}
main();
