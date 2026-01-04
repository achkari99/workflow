import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function check() {
    try {
        const wf = await db.execute(sql`SELECT id FROM workflows`);
        console.log('WF_IDS:' + wf.rows.map(r => r.id).join(','));

        const cwf = await db.execute(sql`SELECT id FROM composite_workflows`);
        console.log('CWF_IDS:' + cwf.rows.map(r => r.id).join(','));

        const sess = await db.execute(sql`SELECT id FROM composite_workflow_sessions`);
        console.log('SESS_IDS:' + sess.rows.map(r => r.id).join(','));

    } catch (e: any) {
        console.error('Error checking DB:', e.message);
    }
    process.exit(0);
}

check();
