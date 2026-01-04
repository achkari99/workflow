import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function check() {
    try {
        console.log('--- WORKFLOWS ---');
        const wf = await db.execute(sql`SELECT id, name FROM workflows`);
        console.log(JSON.stringify(wf.rows, null, 2));

        console.log('--- COMPOSITE WORKFLOWS ---');
        const cwf = await db.execute(sql`SELECT id, name FROM composite_workflows`);
        console.log(JSON.stringify(cwf.rows, null, 2));

        console.log('--- SESSIONS ---');
        const sess = await db.execute(sql`SELECT id, name FROM composite_workflow_sessions`);
        console.log(JSON.stringify(sess.rows, null, 2));

    } catch (e: any) {
        console.error('Error checking DB:', e.message);
    }
    process.exit(0);
}

check();
