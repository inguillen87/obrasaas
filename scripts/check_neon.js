const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        console.log('Total public tables:', res.rows.length);
        console.log('Tables:', res.rows.map(r => r.table_name));
    } catch(e) {
        console.error('Query error:', e);
    } finally {
        await pool.end();
    }
}
main();
