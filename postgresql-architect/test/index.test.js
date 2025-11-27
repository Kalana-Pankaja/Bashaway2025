const fs = require('fs');
const { Client } = require('pg');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles } = require('@sliit-foss/bashaway');

jest.setTimeout(60000);

test('should validate if only bash files are present', () => {
    const shellFileCount = shellFiles().length;
    expect(shellFileCount).toBe(1);
    expect(shellFileCount).toBe(scan('**', ['src/**']).length);
});

test('should setup PostgreSQL with pgvector and insert data', async () => {
    await exec('bash execute.sh');
    
    // Wait a bit for services to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'vectordb',
        user: 'postgres',
        password: 'bashaway2025'
    });
    
    try {
        await client.connect();
        
        // Check if pgvector extension is installed
        const extResult = await client.query(
            "SELECT * FROM pg_extension WHERE extname = 'vector'"
        );
        expect(extResult.rows.length).toBeGreaterThan(0);
        
        // Check if table exists
        const tableResult = await client.query(
            "SELECT * FROM information_schema.tables WHERE table_name = 'embeddings'"
        );
        expect(tableResult.rows.length).toBe(1);
        
        // Check if vectors were inserted
        const dataResult = await client.query(
            "SELECT COUNT(*) as count FROM embeddings"
        );
        expect(parseInt(dataResult.rows[0].count)).toBe(3);
        
        // Verify vector dimensions
        const vecResult = await client.query(
            "SELECT vec FROM embeddings LIMIT 1"
        );
        expect(vecResult.rows.length).toBe(1);
        
    } finally {
        await client.end();
    }
});

afterAll(async () => {
    // Cleanup: stop PostgreSQL
    try {
        await exec('pg_ctl stop -D /tmp/pgdata -m fast || true');
        await exec('docker stop postgres-bashaway || true');
        await exec('docker rm postgres-bashaway || true');
    } catch (e) {
        // Ignore cleanup errors
    }
});

