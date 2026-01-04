import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function recreateTable() {
    try {
        console.log('Dropping composite_workflow_items table...');
        await db.execute(sql`DROP TABLE IF EXISTS composite_workflow_items CASCADE`);

        console.log('Recreating composite_workflow_items table...');
        await db.execute(sql`
      CREATE TABLE composite_workflow_items (
        id SERIAL PRIMARY KEY,
        composite_id INTEGER NOT NULL REFERENCES composite_workflows(id) ON DELETE CASCADE,
        step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL DEFAULT 0
      );
    `);

        console.log('Table recreated successfully with correct schema.');
    } catch (e: any) {
        console.error('Error recreating table:', e.message);
    }
    process.exit(0);
}

recreateTable();
