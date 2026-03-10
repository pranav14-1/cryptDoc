import { query } from './index';

async function seed() {
    console.log('Seeding mock users...');
    try {
        // 1. Ensure roles exist and get IDs
        const roles = await query('SELECT id, name FROM roles');
        const teamMemberRole = roles.rows.find(r => r.name === 'Team Member');
        const adminRole = roles.rows.find(r => r.name === 'Master Admin');

        if (!teamMemberRole || !adminRole) {
            throw new Error('Roles not found. Run migrations first.');
        }

        const mockUsers = [
            { id: '11111111-1111-4111-8111-111111111111', username: 'Pranav', role_id: teamMemberRole.id },
            { id: '22222222-2222-4222-8222-222222222222', username: 'Akshit', role_id: teamMemberRole.id },
            { id: '33333333-3333-4333-8333-333333333333', username: 'Saad', role_id: adminRole.id }
        ];

        for (const user of mockUsers) {
            await query(`
                INSERT INTO users (id, username, password_hash, role_id)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, role_id = EXCLUDED.role_id
            `, [user.id, user.username, 'MOCK_USER_NO_PASSWORD', user.role_id]);
            console.log(`[+] Seeded user: ${user.username} (${user.id})`);
        }

        console.log('Seeding completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Seed Error:', error);
        process.exit(1);
    }
}

seed();
