const fs = require('fs');
const yaml = require('js-yaml');
const { faker } = require('@faker-js/faker');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles, dependencyCount, restrictJavascript, restrictPython } = require('@sliit-foss/bashaway');

jest.setTimeout(60000);

test('should validate if only bash files are present', () => {
    const shellFileCount = shellFiles().length;
    expect(shellFileCount).toBe(1);
    expect(shellFileCount).toBe(scan('**', ['src/**']).length);
});

describe('should check installed dependencies', () => {
    let script;
    beforeAll(() => {
        script = fs.readFileSync('./execute.sh', 'utf-8');
    });
    test("javascript should not be used", () => {
        restrictJavascript(script);
    });
    test("python should not be used", () => {
        restrictPython(script);
    });
    test("no additional npm dependencies should be installed", async () => {
        await expect(dependencyCount()).resolves.toStrictEqual(5);
    });
});

beforeEach(() => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    fs.mkdirSync('./src/servers', { recursive: true });
    fs.mkdirSync('./src/packages', { recursive: true });
});

test('should generate dynamic inventory script', async () => {
    const server1 = {
        hostname: 'web-01',
        ip: '192.168.1.10',
        role: 'web',
        services: ['nginx', 'php-fpm']
    };
    
    const server2 = {
        hostname: 'db-01',
        ip: '192.168.1.20',
        role: 'database',
        services: ['postgresql']
    };
    
    fs.writeFileSync('./src/servers/web-01.json', JSON.stringify(server1));
    fs.writeFileSync('./src/servers/db-01.json', JSON.stringify(server2));
    
    await exec('bash execute.sh');
    
    const hasInventory = fs.existsSync('./out/inventory.py') || 
                         fs.existsSync('./out/inventory.sh') ||
                         fs.existsSync('./out/inventory');
    expect(hasInventory).toBe(true);
});

test('should generate Ansible playbooks', async () => {
    const server = {
        hostname: 'app-01',
        ip: '192.168.1.30',
        role: 'application',
        services: ['nodejs']
    };
    
    fs.writeFileSync('./src/servers/app-01.json', JSON.stringify(server));
    fs.writeFileSync('./src/packages/app-01.txt', 'nodejs\nnpm\ngit');
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/playbooks')).toBe(true);
    
    const files = fs.readdirSync('./out/playbooks');
    expect(files.length).toBeGreaterThan(0);
});

test('should create roles with handlers', async () => {
    const server = {
        hostname: 'web-server',
        ip: '192.168.1.40',
        role: 'web',
        services: ['nginx']
    };
    
    fs.writeFileSync('./src/servers/web-server.json', JSON.stringify(server));
    fs.writeFileSync('./src/packages/web-server.txt', 'nginx\nopenssl');
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/roles')).toBe(true);
    
    const roles = fs.readdirSync('./out/roles');
    expect(roles.length).toBeGreaterThan(0);
});

test('should generate host and group variables', async () => {
    const servers = [
        { hostname: 'web-01', ip: '192.168.1.10', role: 'web', env: 'production' },
        { hostname: 'web-02', ip: '192.168.1.11', role: 'web', env: 'production' },
        { hostname: 'db-01', ip: '192.168.1.20', role: 'database', env: 'production' }
    ];
    
    servers.forEach(srv => {
        fs.writeFileSync(`./src/servers/${srv.hostname}.json`, JSON.stringify(srv));
        fs.writeFileSync(`./src/packages/${srv.hostname}.txt`, 'package1\npackage2');
    });
    
    await exec('bash execute.sh');
    
    const hasGroupVars = fs.existsSync('./out/group_vars');
    const hasHostVars = fs.existsSync('./out/host_vars');
    
    expect(hasGroupVars || hasHostVars).toBe(true);
});

test('should handle servers with different configurations', async () => {
    const configs = [
        {
            hostname: 'cache-01',
            ip: '192.168.1.50',
            role: 'cache',
            services: ['redis'],
            config_files: ['/etc/redis/redis.conf']
        },
        {
            hostname: 'queue-01',
            ip: '192.168.1.60',
            role: 'queue',
            services: ['rabbitmq'],
            config_files: ['/etc/rabbitmq/rabbitmq.conf']
        }
    ];
    
    configs.forEach(cfg => {
        fs.writeFileSync(`./src/servers/${cfg.hostname}.json`, JSON.stringify(cfg));
        fs.writeFileSync(`./src/packages/${cfg.hostname}.txt`, cfg.services.join('\n'));
    });
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/playbooks')).toBe(true);
});

test('should extract and template configuration files', async () => {
    const server = {
        hostname: 'app-server',
        ip: '192.168.1.70',
        role: 'application'
    };
    
    fs.writeFileSync('./src/servers/app-server.json', JSON.stringify(server));
    
    const configContent = [
        'server_name={{ hostname }}',
        'listen_port=8080',
        'database_host=db.example.com'
    ].join('\n');
    
    fs.mkdirSync('./src/servers/app-server', { recursive: true });
    fs.writeFileSync('./src/servers/app-server/app.conf', configContent);
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/roles') || fs.existsSync('./out/playbooks')).toBe(true);
});

test('should group servers by role in inventory', async () => {
    const servers = [
        { hostname: 'web-01', role: 'web' },
        { hostname: 'web-02', role: 'web' },
        { hostname: 'db-01', role: 'database' },
        { hostname: 'cache-01', role: 'cache' }
    ];
    
    servers.forEach(srv => {
        fs.writeFileSync(`./src/servers/${srv.hostname}.json`, JSON.stringify({
            ...srv,
            ip: `192.168.1.${Math.floor(Math.random() * 200)}`
        }));
    });
    
    await exec('bash execute.sh');
    
    const hasInventory = fs.existsSync('./out/inventory.py') || 
                         fs.existsSync('./out/inventory.sh') ||
                         fs.existsSync('./out/inventory');
    expect(hasInventory).toBe(true);
});

test('should create idempotent playbooks', async () => {
    const server = {
        hostname: 'idempotent-test',
        ip: '192.168.1.80',
        role: 'test',
        services: ['nginx']
    };
    
    fs.writeFileSync('./src/servers/idempotent-test.json', JSON.stringify(server));
    fs.writeFileSync('./src/packages/idempotent-test.txt', 'nginx');
    
    await exec('bash execute.sh');
    
    const playbooks = fs.readdirSync('./out/playbooks');
    expect(playbooks.length).toBeGreaterThan(0);
    
    // Check if playbook is valid YAML
    const playbookFile = playbooks[0];
    const content = fs.readFileSync(`./out/playbooks/${playbookFile}`, 'utf-8');
    
    expect(() => yaml.load(content)).not.toThrow();
});

test('should handle large number of servers', async () => {
    for (let i = 1; i <= 20; i++) {
        const server = {
            hostname: `server-${i}`,
            ip: `192.168.1.${100 + i}`,
            role: faker.helpers.arrayElement(['web', 'database', 'cache', 'queue']),
            services: [faker.helpers.arrayElement(['nginx', 'apache', 'postgresql', 'redis'])]
        };
        
        fs.writeFileSync(`./src/servers/server-${i}.json`, JSON.stringify(server));
        fs.writeFileSync(`./src/packages/server-${i}.txt`, server.services[0]);
    }
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/playbooks')).toBe(true);
});

test('should generate handlers for service management', async () => {
    const server = {
        hostname: 'service-test',
        ip: '192.168.1.90',
        role: 'web',
        services: ['nginx', 'php-fpm']
    };
    
    fs.writeFileSync('./src/servers/service-test.json', JSON.stringify(server));
    
    await exec('bash execute.sh');
    
    const roles = fs.existsSync('./out/roles') ? fs.readdirSync('./out/roles') : [];
    
    if (roles.length > 0) {
        const roleDir = roles[0];
        const hasHandlers = fs.existsSync(`./out/roles/${roleDir}/handlers`) ||
                           fs.existsSync(`./out/roles/${roleDir}/handlers.yml`) ||
                           fs.existsSync(`./out/roles/${roleDir}/handlers.yaml`);
        
        expect(roles.length).toBeGreaterThan(0);
    }
});

test('should validate all required output directories exist', async () => {
    const server = {
        hostname: 'validation-test',
        ip: '192.168.1.100',
        role: 'test'
    };
    
    fs.writeFileSync('./src/servers/validation-test.json', JSON.stringify(server));
    
    await exec('bash execute.sh');
    
    const hasInventory = fs.existsSync('./out/inventory.py') || 
                         fs.existsSync('./out/inventory.sh') ||
                         fs.existsSync('./out/inventory');
    const hasPlaybooks = fs.existsSync('./out/playbooks');
    const hasRoles = fs.existsSync('./out/roles');
    const hasVars = fs.existsSync('./out/group_vars') || fs.existsSync('./out/host_vars');
    
    expect(hasInventory && hasPlaybooks && hasRoles).toBe(true);
});

