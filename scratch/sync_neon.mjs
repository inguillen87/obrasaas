import 'dotenv/config';
import fs from 'fs';
import { Pool } from 'pg';

async function sync() {
    console.log('Connecting to Neon PostgreSQL...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    await pool.query(
        CREATE TABLE IF NOT EXISTS obrasaas_app_state (
            id VARCHAR(50) PRIMARY KEY,
            state JSONB NOT NULL,
            messages JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    );
    
    const localData = JSON.parse(fs.readFileSync('data/db.json', 'utf8'));
    
    const res = await pool.query(
        'INSERT INTO obrasaas_app_state (id, state, messages, updated_at) VALUES (, , , NOW()) ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, messages = EXCLUDED.messages, updated_at = NOW() RETURNING updated_at',
        ['default', JSON.stringify(localData.appState), JSON.stringify(localData.messages || [])]
    );
    
    console.log('✅ Neon PostgreSQL successfully synchronized at:', res.rows[0].updated_at);
    
    const check = await pool.query('SELECT LENGTH(state::text) as state_len, updated_at FROM obrasaas_app_state WHERE id = ', ['default']);
    console.log('✅ Verification query:', check.rows[0]);
    
    await pool.end();
}

sync().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
});
