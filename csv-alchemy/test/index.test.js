const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { faker } = require('@faker-js/faker');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles, dependencyCount, restrictJavascript, restrictPython } = require('@sliit-foss/bashaway');

jest.setTimeout(30000);

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
    test("javacript should not be used", () => {
        restrictJavascript(script);
    });
    test("python should not be used", () => {
        restrictPython(script);
    });
    test("no additional npm dependencies should be installed", async () => {
        await expect(dependencyCount()).resolves.toStrictEqual(5);
    });
    test('the script should be less than 150 characters in length', () => {
        expect(script.length).toBeLessThan(150);
    });
});

test('should transform CSV with aggregations', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    const csvData = [
        'category,amount,quantity',
        'A,100,5',
        'B,200,3',
        'A,150,2',
        'B,300,4',
        'A,50,1'
    ].join('\n');
    
    fs.writeFileSync('./src/data.csv', csvData);
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/result.csv')).toBe(true);
    
    const result = fs.readFileSync('./out/result.csv', 'utf-8');
    const records = parse(result, { columns: true, skip_empty_lines: true });
    
    expect(records.length).toBeGreaterThan(0);
    
    // Check for aggregated data
    const categoryA = records.find(r => r.category === 'A');
    const categoryB = records.find(r => r.category === 'B');
    
    expect(categoryA).toBeDefined();
    expect(categoryB).toBeDefined();
    
    // Sum of amounts: A=300, B=500
    expect(parseInt(categoryA.total_amount)).toBe(300);
    expect(parseInt(categoryB.total_amount)).toBe(500);
});

test('should handle different aggregation types', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    const csvData = [
        'category,amount,quantity',
        'X,100,10',
        'Y,200,20',
        'X,300,30',
        'Y,400,40'
    ].join('\n');
    
    fs.writeFileSync('./src/data.csv', csvData);
    
    await exec('bash execute.sh');
    
    const result = fs.readFileSync('./out/result.csv', 'utf-8');
    const records = parse(result, { columns: true, skip_empty_lines: true });
    
    expect(records.length).toBe(2);
});

