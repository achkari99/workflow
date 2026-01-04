import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';
import { steps } from './shared/schema.ts';

async function check() {
    try {
        const workflows = (await db.execute(sql`SELECT * FROM workflows`)).rows;

        for (const wf of workflows) {
            const res = await db.execute(sql`SELECT COUNT(*) FROM steps WHERE workflow_id = ${wf.id}`);
            const count = parseInt(res.rows[0].count);
            console.log(`Workflow ${wf.id} (${wf.name}): ${count} steps`);

            if (count === 0) {
                console.log(`Creating steps for WF ${wf.id}...`);
                const totalSteps = wf.total_steps || 3;
                for (let i = 1; i <= totalSteps; i++) {
                    await db.insert(steps).values({
                        workflowId: wf.id,
                        stepNumber: i,
                        name: `Phase ${i}`,
                        description: `Complete stage ${i} of ${wf.name}`,
                        status: i === 1 ? 'active' : 'locked',
                        isCompleted: false,
                    });
                }
                console.log(`Steps created for WF ${wf.id}.`);
            }
        }

        // Also check composite sessions
        const sessions = (await db.execute(sql`SELECT id, name FROM composite_workflow_sessions`)).rows;
        for (const sess of sessions) {
            console.log(`Session ${sess.id} found.`);
        }

    } catch (e: any) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

check();
