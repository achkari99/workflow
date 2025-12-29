import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function fix() {
    try {
        const count = await db.execute(sql`SELECT COUNT(*) FROM composite_workflow_items`);
        console.log('Row count:', count.rows[0]);

        if (parseInt(count.rows[0].count) > 0) {
            console.log('Truncating table to allow NOT NULL column add...');
            await db.execute(sql`TRUNCATE TABLE composite_workflow_items CASCADE`);
        }

        console.log('Adding step_id column...');
        await db.execute(sql`
      ALTER TABLE composite_workflow_items 
      ADD COLUMN IF NOT EXISTS step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE;
    `);
        console.log('Column added successfully.');
    } catch (e: any) {
        console.error('Error fixing DB:', e.message);
    }
    process.exit(0);
}

fix();
