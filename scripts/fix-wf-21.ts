import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';
import { steps } from './shared/schema.ts';

async function check() {
    try {
        const [wf] = (await db.execute(sql`SELECT * FROM workflows WHERE id = 21`)).rows;
        console.log('Workflow 21:', JSON.stringify(wf, null, 2));

        const res = await db.execute(sql`SELECT COUNT(*) FROM steps WHERE workflow_id = 21`);
        console.log('Steps count for WF 21:', res.rows[0]);

        if (wf && parseInt(res.rows[0].count) === 0) {
            console.log('Creating steps for WF 21...');
            const totalSteps = wf.total_steps || 5;
            for (let i = 1; i <= totalSteps; i++) {
                await db.insert(steps).values({
                    workflowId: 21,
                    stepNumber: i,
                    name: `Step ${i}`,
                    description: `Complete phase ${i}`,
                    status: i === 1 ? 'active' : 'locked',
                    isCompleted: false,
                });
            }
            console.log('Steps created.');
        }
    } catch (e: any) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

check();
