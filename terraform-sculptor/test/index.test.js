const fs = require('fs');
const Docker = require('dockerode');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles } = require('@sliit-foss/bashaway');

const docker = new Docker();

jest.setTimeout(60000);

test('should validate if only bash files are present', () => {
    const shellFileCount = shellFiles().length;
    expect(shellFileCount).toBe(1);
    expect(shellFileCount).toBe(scan('**', ['src/**']).length);
});

let testContainers = [];

beforeAll(async () => {
    // Start test containers
    const container1 = await docker.createContainer({
        Image: 'nginx:alpine',
        name: 'test-nginx-sculptor',
        ExposedPorts: { '80/tcp': {} },
        HostConfig: {
            PortBindings: { '80/tcp': [{ HostPort: '8080' }] }
        }
    });
    await container1.start();
    testContainers.push(container1);
    
    const container2 = await docker.createContainer({
        Image: 'redis:alpine',
        name: 'test-redis-sculptor',
        ExposedPorts: { '6379/tcp': {} },
        HostConfig: {
            PortBindings: { '6379/tcp': [{ HostPort: '6379' }] }
        }
    });
    await container2.start();
    testContainers.push(container2);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
});

test('should generate valid Terraform configuration', async () => {
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/main.tf')).toBe(true);
    
    const tfContent = fs.readFileSync('./out/main.tf', 'utf-8');
    
    // Validate Terraform structure
    expect(tfContent).toContain('resource "docker_container"');
    expect(tfContent).toContain('test-nginx-sculptor');
    expect(tfContent).toContain('test-redis-sculptor');
    expect(tfContent).toContain('nginx:alpine');
    expect(tfContent).toContain('redis:alpine');
});

test('terraform configuration should be valid', async () => {
    process.chdir('./out');
    
    const initResult = await exec('terraform init');
    expect(initResult).toContain('Terraform has been successfully initialized');
    
    const validateResult = await exec('terraform validate');
    expect(validateResult).toContain('Success');
    
    process.chdir('..');
});

afterAll(async () => {
    for (const container of testContainers) {
        try {
            await container.stop();
            await container.remove();
        } catch (e) {
            // Ignore
        }
    }
});

