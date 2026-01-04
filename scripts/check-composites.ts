import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function check() {
    try {
        console.log('--- COMPOSITE WORKFLOWS ---');
        const composites = await db.execute(sql`SELECT id, name FROM composite_workflows`);
        console.log(JSON.stringify(composites.rows, null, 2));

        console.log('--- COMPOSITE WORKFLOW ITEMS ---');
        const items = await db.execute(sql`SELECT * FROM composite_workflow_items`);
        console.log(JSON.stringify(items.rows, null, 2));

        console.log('--- COMPOSITE SESSIONS ---');
        const sessions = await db.execute(sql`SELECT id, composite_id, name FROM composite_workflow_sessions`);
        console.log(JSON.stringify(sessions.rows, null, 2));

        console.log('--- SESSION STEPS ---');
        const sessionSteps = await db.execute(sql`SELECT id, session_id, step_id FROM composite_workflow_session_steps`);
        console.log(JSON.stringify(sessionSteps.rows, null, 2));

    } catch (e: any) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

check();
