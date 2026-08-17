const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        const tables = ['Project', 'Worker', 'Task', 'Incident', 'AttendanceEntry', 'OperationalProposal', 'WhatsAppConnection', 'CrmAccount'];
        for (const table of tables) {
            const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]);
            console.log(`\nTable ${table}:`);
            console.log(cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
        }
    } catch(e) {
        console.error('Column error:', e);
    } finally {
        await pool.end();
    }
}
main();
