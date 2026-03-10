import { query } from './index';
import fs from 'fs';
import path from 'path';

async function cleanup() {
    console.log('--- RESETTING DEMO STATE ---');
    try {
        // 1. Clear Audit Logs
        await query('TRUNCATE TABLE audit_logs RESTART IDENTITY CASCADE');
        console.log('[x] Audit logs cleared.');

        // 2. Clear Documents metadata
        await query('TRUNCATE TABLE documents RESTART IDENTITY CASCADE');
        console.log('[x] Document metadata cleared.');

        // 3. Clear Physical Files
        const uploadDir = path.join(__dirname, '../../uploads');
        if (fs.existsSync(uploadDir)) {
            const files = fs.readdirSync(uploadDir);
            for (const file of files) {
                if (file !== '.gitkeep') {
                    fs.unlinkSync(path.join(uploadDir, file));
                }
            }
            console.log(`[x] Physical vault cleared (${files.length} files removed).`);
        }

        console.log('--- DEMO READY: FRESH START ---');
        process.exit(0);
    } catch (error) {
        console.error('Cleanup Error:', error);
        process.exit(1);
    }
}

cleanup();
