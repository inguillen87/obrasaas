import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const { rows } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'Organization'
            ORDER BY ordinal_position
        `);
        console.log('Columns for Organization:');
        console.log(rows.map(r => `  ${r.column_name} (${r.data_type})`).join('\n'));

        const { rows: projs } = await pool.query('SELECT * FROM "Project"');
        console.log('\nExisting Projects in Neon:');
        console.log(projs);
    } finally {
        await pool.end();
    }
}

main();
