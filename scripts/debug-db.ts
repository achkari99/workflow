import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function check() {
    try {
        const res = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'composite_workflow_items';
    `);
        console.log('COLUMNS_START');
        console.log(JSON.stringify(res.rows));
        console.log('COLUMNS_END');
    } catch (e: any) {
        console.error('Error checking DB:', e.message);
    }
    process.exit(0);
}

check();
