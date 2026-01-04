import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function check() {
    try {
        console.log('--- WORKFLOWS ---');
        const wf = await db.execute(sql`SELECT id, name FROM workflows`);
        console.log(JSON.stringify(wf.rows, null, 2));

        console.log('--- STEPS COUNT BY WORKFLOW ---');
        const stepsCount = await db.execute(sql`SELECT workflow_id, COUNT(*) FROM steps GROUP BY workflow_id`);
        console.log(JSON.stringify(stepsCount.rows, null, 2));

        console.log('--- STEPS DATA SAMPLE ---');
        const stepsSample = await db.execute(sql`SELECT id, workflow_id, composite_id, name FROM steps LIMIT 10`);
        console.log(JSON.stringify(stepsSample.rows, null, 2));

    } catch (e: any) {
        console.error('Error checking DB:', e.message);
    }
    process.exit(0);
}

check();
