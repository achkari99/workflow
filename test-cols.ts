import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function check() {
    const table = 'steps';
    const cols = [
        'id', 'workflow_id', 'composite_id', 'step_number', 'name',
        'description', 'objective', 'instructions', 'status',
        'is_completed', 'requires_approval', 'proof_required',
        'proof_title', 'proof_description', 'proof_content',
        'proof_file_path', 'proof_file_name', 'proof_mime_type',
        'proof_file_size', 'proof_submitted_at', 'proof_submitted_by_user_id',
        'created_at', 'completed_at'
    ];

    const results = [];
    for (const col of cols) {
        try {
            await db.execute(sql.raw(`SELECT ${col} FROM ${table} LIMIT 1`));
            results.push(`OK: ${col}`);
        } catch (e: any) {
            results.push(`FAIL: ${col} - ${e.message}`);
        }
    }
    console.log(results.join('\n'));
    process.exit(0);
}

check();
