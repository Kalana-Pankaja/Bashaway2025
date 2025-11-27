const fs = require('fs');
const { faker } = require('@faker-js/faker');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles, dependencyCount, restrictJavascript, restrictPython } = require('@sliit-foss/bashaway');

test('should validate if only bash files are present', () => {
    const shellFileCount = shellFiles().length;
    expect(shellFileCount).toBe(1);
    expect(shellFileCount).toBe(scan('**', ['src/**']).length);
});

describe('should check installed dependencies', () => {
    let script
    beforeAll(() => {
        script = fs.readFileSync('./execute.sh', 'utf-8')
    });
    test("javacript should not be used", () => {
        restrictJavascript(script)
    });
    test("python should not be used", () => {
        restrictPython(script)
    });
    test("no additional npm dependencies should be installed", async () => {
        await expect(dependencyCount()).resolves.toStrictEqual(4)
    });
});

test('should merge JSON files with correct priority', async () => {
    // Clean up
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    // Create test data with overlapping and unique keys
    const tertiary = {
        name: 'tertiary_name',
        age: 10,
        city: 'tertiary_city',
        unique_tertiary: 'value3'
    };
    
    const secondary = {
        name: 'secondary_name',
        country: 'secondary_country',
        unique_secondary: 'value2'
    };
    
    const primary = {
        name: 'primary_name',
        unique_primary: 'value1'
    };
    
    fs.writeFileSync('./src/tertiary.json', JSON.stringify(tertiary));
    fs.writeFileSync('./src/secondary.json', JSON.stringify(secondary));
    fs.writeFileSync('./src/primary.json', JSON.stringify(primary));
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/merged.json')).toBe(true);
    
    const merged = JSON.parse(fs.readFileSync('./out/merged.json', 'utf-8'));
    
    // Check priority: primary > secondary > tertiary
    expect(merged.name).toBe('primary_name'); // primary wins
    expect(merged.country).toBe('secondary_country'); // only in secondary
    expect(merged.age).toBe(10); // only in tertiary
    expect(merged.city).toBe('tertiary_city'); // only in tertiary
    expect(merged.unique_primary).toBe('value1');
    expect(merged.unique_secondary).toBe('value2');
    expect(merged.unique_tertiary).toBe('value3');
});

test('should handle complex merges', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    const tertiary = {};
    const secondary = {};
    const primary = {};
    
    // Create random data
    for (let i = 0; i < 20; i++) {
        const key = faker.word.noun();
        tertiary[key] = faker.number.int({ min: 0, max: 1000 });
    }
    
    for (let i = 0; i < 15; i++) {
        const key = i < 5 ? Object.keys(tertiary)[i] : faker.word.noun();
        secondary[key] = faker.number.int({ min: 0, max: 1000 });
    }
    
    for (let i = 0; i < 10; i++) {
        const key = i < 3 ? Object.keys(secondary)[i] : faker.word.noun();
        primary[key] = faker.number.int({ min: 0, max: 1000 });
    }
    
    fs.writeFileSync('./src/tertiary.json', JSON.stringify(tertiary));
    fs.writeFileSync('./src/secondary.json', JSON.stringify(secondary));
    fs.writeFileSync('./src/primary.json', JSON.stringify(primary));
    
    await exec('bash execute.sh');
    
    const merged = JSON.parse(fs.readFileSync('./out/merged.json', 'utf-8'));
    
    // Verify priority for overlapping keys
    for (const key in primary) {
        expect(merged[key]).toBe(primary[key]);
    }
    
    for (const key in secondary) {
        if (!(key in primary)) {
            expect(merged[key]).toBe(secondary[key]);
        }
    }
    
    for (const key in tertiary) {
        if (!(key in primary) && !(key in secondary)) {
            expect(merged[key]).toBe(tertiary[key]);
        }
    }
});

