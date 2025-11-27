const fs = require('fs');
const axios = require('axios');
const Docker = require('dockerode');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles } = require('@sliit-foss/bashaway');

const docker = new Docker();

jest.setTimeout(90000);

test('should validate if only bash files are present', () => {
    const shellFileCount = shellFiles().length;
    expect(shellFileCount).toBe(1);
    expect(shellFileCount).toBe(scan('**', ['src/**']).length);
});

let backendContainers = [];
let nginxContainer = null;

beforeAll(async () => {
    // Start 3 backend servers
    for (let i = 1; i <= 3; i++) {
        const container = await docker.createContainer({
            Image: 'nginx:alpine',
            name: `backend-${i}-orchestrator`,
            ExposedPorts: { '80/tcp': {} },
            HostConfig: {
                PortBindings: { '80/tcp': [{ HostPort: `808${i}` }] }
            }
        });
        await container.start();
        backendContainers.push(container);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
});

test('should generate valid nginx configuration', async () => {
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/nginx.conf')).toBe(true);
    
    const config = fs.readFileSync('./out/nginx.conf', 'utf-8');
    
    // Validate configuration structure
    expect(config).toContain('upstream');
    expect(config).toContain('server');
    expect(config).toContain('proxy_pass');
    expect(config).toContain('location');
});

test('nginx configuration should include load balancing', async () => {
    const config = fs.readFileSync('./out/nginx.conf', 'utf-8');
    
    // Should have upstream block with multiple servers
    expect(config).toMatch(/upstream\s+\w+\s*\{/);
    
    // Should have multiple server entries in upstream
    const serverMatches = config.match(/server\s+[\w.:]+/g);
    expect(serverMatches).toBeTruthy();
    expect(serverMatches.length).toBeGreaterThanOrEqual(2);
});

test('nginx configuration should include health checks', async () => {
    const config = fs.readFileSync('./out/nginx.conf', 'utf-8');
    
    // Should have health check directives
    expect(config).toMatch(/max_fails|fail_timeout|health_check/);
});

test('configuration should be syntactically valid', async () => {
    // Create nginx container to test config
    nginxContainer = await docker.createContainer({
        Image: 'nginx:alpine',
        name: 'nginx-orchestrator-test',
        Cmd: ['nginx', '-t', '-c', '/etc/nginx/nginx.conf'],
        HostConfig: {
            Binds: [`${process.cwd()}/out/nginx.conf:/etc/nginx/nginx.conf:ro`]
        }
    });
    
    await nginxContainer.start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const inspect = await nginxContainer.inspect();
    expect(inspect.State.ExitCode).toBe(0);
});

afterAll(async () => {
    for (const container of backendContainers) {
        try {
            await container.stop();
            await container.remove();
        } catch (e) {
            // Ignore
        }
    }
    
    if (nginxContainer) {
        try {
            await nginxContainer.stop();
            await nginxContainer.remove();
        } catch (e) {
            // Ignore
        }
    }
});

