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
    fs.mkdirSync('./src/applications', { recursive: true });
});

test('should reconstruct Application manifests from fragments', async () => {
    const appFragment1 = {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Application',
        metadata: {
            name: 'frontend',
            namespace: 'argocd'
        },
        spec: {
            project: 'default',
            source: {
                repoURL: 'https://github.com/example/app',
                targetRevision: 'main',
                path: 'frontend'
            }
        }
    };
    
    fs.writeFileSync('./src/applications/frontend-fragment.yaml', yaml.dump(appFragment1));
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/applications')).toBe(true);
    
    const files = fs.readdirSync('./out/applications');
    expect(files.length).toBeGreaterThan(0);
    
    const appFile = files.find(f => f.includes('frontend') || f.endsWith('.yaml') || f.endsWith('.yml'));
    if (appFile) {
        const content = fs.readFileSync(`./out/applications/${appFile}`, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
    }
});

test('should establish sync wave ordering', async () => {
    const apps = [
        {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: { name: 'database', namespace: 'argocd' },
            spec: { 
                project: 'default',
                syncPolicy: { syncOptions: ['CreateNamespace=true'] }
            }
        },
        {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: { name: 'backend', namespace: 'argocd' },
            spec: { project: 'default' }
        },
        {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: { name: 'frontend', namespace: 'argocd' },
            spec: { project: 'default' }
        }
    ];
    
    apps.forEach((app, idx) => {
        fs.writeFileSync(`./src/applications/app-${idx}.yaml`, yaml.dump(app));
    });
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/sync-waves.json')).toBe(true);
    
    const waves = JSON.parse(fs.readFileSync('./out/sync-waves.json', 'utf-8'));
    expect(waves).toHaveProperty('waves');
    expect(Array.isArray(waves.waves) || typeof waves.waves === 'object').toBe(true);
});

test('should generate custom health check definitions', async () => {
    const app = {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Application',
        metadata: {
            name: 'custom-app',
            namespace: 'argocd',
            annotations: {
                'health.check': 'custom'
            }
        },
        spec: {
            project: 'default',
            destination: {
                server: 'https://kubernetes.default.svc',
                namespace: 'production'
            }
        }
    };
    
    fs.writeFileSync('./src/applications/custom-app.yaml', yaml.dump(app));
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/health-checks.json')).toBe(true);
    
    const healthChecks = JSON.parse(fs.readFileSync('./out/health-checks.json', 'utf-8'));
    expect(healthChecks).toHaveProperty('checks');
    expect(Array.isArray(healthChecks.checks)).toBe(true);
});

test('should generate sync status report', async () => {
    const app = {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Application',
        metadata: { name: 'test-app', namespace: 'argocd' },
        spec: { 
            project: 'default',
            source: {
                repoURL: 'https://github.com/test/repo',
                path: 'manifests'
            }
        }
    };
    
    fs.writeFileSync('./src/applications/test-app.yaml', yaml.dump(app));
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/sync-status.json')).toBe(true);
    
    const status = JSON.parse(fs.readFileSync('./out/sync-status.json', 'utf-8'));
    expect(status).toHaveProperty('applications');
    expect(Array.isArray(status.applications) || typeof status.applications === 'object').toBe(true);
});

test('should handle multiple corrupted application fragments', async () => {
    for (let i = 0; i < 5; i++) {
        const fragment = {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: {
                name: `app-${i}`,
                namespace: 'argocd'
            },
            spec: {
                project: faker.helpers.arrayElement(['default', 'production', 'staging']),
                source: {
                    repoURL: `https://github.com/example/app-${i}`,
                    targetRevision: 'main'
                }
            }
        };
        
        fs.writeFileSync(`./src/applications/fragment-${i}.yaml`, yaml.dump(fragment));
    }
    
    await exec('bash execute.sh');
    
    const files = fs.readdirSync('./out/applications');
    expect(files.length).toBeGreaterThan(0);
});

test('should reconstruct dependency relationships between apps', async () => {
    const apps = [
        {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: {
                name: 'infra',
                namespace: 'argocd',
                annotations: { 'argocd.argoproj.io/sync-wave': '0' }
            },
            spec: { project: 'default' }
        },
        {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: {
                name: 'middleware',
                namespace: 'argocd',
                annotations: { 'argocd.argoproj.io/sync-wave': '1' }
            },
            spec: { project: 'default' }
        }
    ];
    
    apps.forEach((app, idx) => {
        fs.writeFileSync(`./src/applications/${app.metadata.name}.yaml`, yaml.dump(app));
    });
    
    await exec('bash execute.sh');
    
    const waves = JSON.parse(fs.readFileSync('./out/sync-waves.json', 'utf-8'));
    expect(waves).toHaveProperty('waves');
});

test('should handle apps with missing metadata', async () => {
    const incompleteApp = {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Application',
        metadata: {
            name: 'incomplete'
        },
        spec: {
            source: {
                repoURL: 'https://github.com/example/app'
            }
        }
    };
    
    fs.writeFileSync('./src/applications/incomplete.yaml', yaml.dump(incompleteApp));
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/applications')).toBe(true);
    expect(fs.existsSync('./out/sync-status.json')).toBe(true);
});

test('should merge multiple fragments of same application', async () => {
    const fragment1 = {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Application',
        metadata: {
            name: 'merged-app',
            namespace: 'argocd'
        },
        spec: {
            project: 'default'
        }
    };
    
    const fragment2 = {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Application',
        metadata: {
            name: 'merged-app',
            namespace: 'argocd',
            labels: { app: 'merged' }
        },
        spec: {
            source: {
                repoURL: 'https://github.com/example/merged',
                targetRevision: 'main'
            }
        }
    };
    
    fs.writeFileSync('./src/applications/merged-1.yaml', yaml.dump(fragment1));
    fs.writeFileSync('./src/applications/merged-2.yaml', yaml.dump(fragment2));
    
    await exec('bash execute.sh');
    
    const files = fs.readdirSync('./out/applications');
    expect(files.length).toBeGreaterThan(0);
});

test('should validate all required outputs exist', async () => {
    const app = {
        apiVersion: 'argoproj.io/v1alpha1',
        kind: 'Application',
        metadata: { name: 'test', namespace: 'argocd' },
        spec: { project: 'default' }
    };
    
    fs.writeFileSync('./src/applications/test.yaml', yaml.dump(app));
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/applications')).toBe(true);
    expect(fs.existsSync('./out/sync-waves.json')).toBe(true);
    expect(fs.existsSync('./out/health-checks.json')).toBe(true);
    expect(fs.existsSync('./out/sync-status.json')).toBe(true);
});

