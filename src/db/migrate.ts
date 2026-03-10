import pool from './index';

const migrate = async () => {
    const client = await pool.connect();

    try {
        console.log('Starting database migration...');

        await client.query('BEGIN');

        // Roles Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
      );
    `);

        // Insert Default Roles if they don't exist
        await client.query(`
      INSERT INTO roles (name) VALUES ('Guest'), ('Team Member'), ('Master Admin')
      ON CONFLICT (name) DO NOTHING;
    `);

        // Users Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Documents Table
        // Encrypted DEK and file sizes should be quite small, varchar works or bytea
        await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_filename VARCHAR(255) NOT NULL,
        disk_path VARCHAR(512) NOT NULL,
        encrypted_dek TEXT NOT NULL,
        file_hash VARCHAR(64) NOT NULL,
        digital_signature TEXT NOT NULL,
        uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Audit Logs Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
    } finally {
        client.release();
        pool.end();
    }
};

migrate();
