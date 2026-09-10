import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const tables = ['Project', 'Worker', 'Task', 'Incident', 'obrasaas_app_state'];
        for (const table of tables) {
            const { rows } = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position
            `, [table]);
            console.log(`\nColumns for ${table}:`);
            console.log(rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));
        }
    } finally {
        await pool.end();
    }
}

main();
