const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
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

test('should generate MD5 checksums for all files', async () => {
    // Clean up
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    // Create test file structure
    const files = [];
    
    // Root level files
    for (let i = 0; i < 3; i++) {
        const filename = `${faker.word.noun()}_${i}.txt`;
        const content = faker.lorem.paragraph();
        fs.writeFileSync(`./src/${filename}`, content);
        files.push({ path: filename, content });
    }
    
    // Nested directory with files
    const subdir1 = 'subdir1';
    fs.mkdirSync(`./src/${subdir1}`, { recursive: true });
    for (let i = 0; i < 2; i++) {
        const filename = `${faker.word.noun()}_${i}.txt`;
        const content = faker.lorem.paragraph();
        fs.writeFileSync(`./src/${subdir1}/${filename}`, content);
        files.push({ path: `${subdir1}/${filename}`, content });
    }
    
    // Deeply nested directory with files
    const subdir2 = 'subdir1/deep';
    fs.mkdirSync(`./src/${subdir2}`, { recursive: true });
    const filename = `${faker.word.noun()}.txt`;
    const content = faker.lorem.paragraph();
    fs.writeFileSync(`./src/${subdir2}/${filename}`, content);
    files.push({ path: `${subdir2}/${filename}`, content });
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/checksums.txt')).toBe(true);
    
    const output = fs.readFileSync('./out/checksums.txt', 'utf-8');
    const lines = output.trim().split('\n').filter(l => l);
    
    expect(lines.length).toBe(files.length);
    
    // Calculate expected checksums
    const expected = files.map(file => {
        const md5 = crypto.createHash('md5').update(file.content).digest('hex');
        return { md5, path: file.path };
    });
    
    // Sort by filename (basename)
    expected.sort((a, b) => {
        const nameA = path.basename(a.path);
        const nameB = path.basename(b.path);
        return nameA.localeCompare(nameB);
    });
    
    // Verify each line
    for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        const checksum = parts[0];
        const filePath = parts.slice(1).join(' ');
        
        // Find matching expected entry
        const match = expected.find(e => e.md5 === checksum);
        expect(match).toBeDefined();
        expect(filePath).toBe(match.path);
    }
});

