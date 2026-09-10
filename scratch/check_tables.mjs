import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const { rows } = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        console.log('Tables currently in Neon PostgreSQL:');
        for (const r of rows) {
            try {
                const { rows: count } = await pool.query(`SELECT count(*) FROM "${r.table_name}"`);
                console.log(`  - ${r.table_name}: ${count[0].count} rows`);
            } catch (e) {
                console.log(`  - ${r.table_name}: error ${e.message}`);
            }
        }
    } finally {
        await pool.end();
    }
}

main();
