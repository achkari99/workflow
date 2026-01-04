import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function check() {
    try {
        const columns = await db.execute(sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'steps'
        `);
        console.log('--- STEPS COLUMNS ---');
        console.log(JSON.stringify(columns.rows, null, 2));

        const sample = await db.execute(sql`SELECT * FROM steps LIMIT 5`);
        console.log('--- STEPS SAMPLE ---');
        console.log(JSON.stringify(sample.rows, null, 2));

    } catch (e: any) {
        console.error('Error checking DB:', e.message);
    }
    process.exit(0);
}

check();
