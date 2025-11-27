const fs = require('fs');
const yaml = require('js-yaml');
const axios = require('axios');
const Docker = require('dockerode');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles } = require('@sliit-foss/bashaway');

const docker = new Docker();

jest.setTimeout(120000);

test('should validate if only bash files are present', () => {
    const shellFileCount = shellFiles().length;
    expect(shellFileCount).toBe(1);
    expect(shellFileCount).toBe(scan('**', ['src/**']).length);
});

let prometheusContainer = null;
let grafanaContainer = null;

beforeAll(async () => {
    // Pull Docker image via execute.sh
    await exec('bash execute.sh');
    
    // Start Prometheus
    prometheusContainer = await docker.createContainer({
        Image: 'prom/prometheus:latest',
        name: 'prometheus-guardian-test',
        ExposedPorts: { '9090/tcp': {} },
        HostConfig: {
            PortBindings: { '9090/tcp': [{ HostPort: '9090' }] }
        }
    });
    await prometheusContainer.start();
    
    await new Promise(resolve => setTimeout(resolve, 5000));
});

test('should generate prometheus configuration', async () => {
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/prometheus.yml')).toBe(true);
    
    const config = yaml.load(fs.readFileSync('./out/prometheus.yml', 'utf-8'));
    
    expect(config).toHaveProperty('global');
    expect(config).toHaveProperty('scrape_configs');
    expect(Array.isArray(config.scrape_configs)).toBe(true);
    expect(config.scrape_configs.length).toBeGreaterThan(0);
});

test('should generate grafana datasource configuration', async () => {
    expect(fs.existsSync('./out/datasource.yml')).toBe(true);
    
    const datasource = yaml.load(fs.readFileSync('./out/datasource.yml', 'utf-8'));
    
    expect(datasource).toHaveProperty('datasources');
    expect(Array.isArray(datasource.datasources)).toBe(true);
    
    const promDs = datasource.datasources.find(ds => ds.type === 'prometheus');
    expect(promDs).toBeDefined();
    expect(promDs).toHaveProperty('url');
});

test('should generate grafana dashboard', async () => {
    expect(fs.existsSync('./out/dashboard.json')).toBe(true);
    
    const dashboard = JSON.parse(fs.readFileSync('./out/dashboard.json', 'utf-8'));
    
    expect(dashboard).toHaveProperty('dashboard');
    expect(dashboard.dashboard).toHaveProperty('panels');
    expect(Array.isArray(dashboard.dashboard.panels)).toBe(true);
    expect(dashboard.dashboard.panels.length).toBeGreaterThan(0);
});

test('should generate alert rules', async () => {
    expect(fs.existsSync('./out/alerts.yml')).toBe(true);
    
    const alerts = yaml.load(fs.readFileSync('./out/alerts.yml', 'utf-8'));
    
    expect(alerts).toHaveProperty('groups');
    expect(Array.isArray(alerts.groups)).toBe(true);
    expect(alerts.groups.length).toBeGreaterThan(0);
    
    const firstGroup = alerts.groups[0];
    expect(firstGroup).toHaveProperty('name');
    expect(firstGroup).toHaveProperty('rules');
    expect(Array.isArray(firstGroup.rules)).toBe(true);
});

test('prometheus config should include multiple scrape targets', async () => {
    const config = yaml.load(fs.readFileSync('./out/prometheus.yml', 'utf-8'));
    
    expect(config.scrape_configs.length).toBeGreaterThanOrEqual(2);
    
    for (const scrapeConfig of config.scrape_configs) {
        expect(scrapeConfig).toHaveProperty('job_name');
        expect(scrapeConfig).toHaveProperty('static_configs');
    }
});

afterAll(async () => {
    if (prometheusContainer) {
        try {
            await prometheusContainer.stop();
            await prometheusContainer.remove();
        } catch (e) {
            // Ignore
        }
    }
    
    if (grafanaContainer) {
        try {
            await grafanaContainer.stop();
            await grafanaContainer.remove();
        } catch (e) {
            // Ignore
        }
    }
});

