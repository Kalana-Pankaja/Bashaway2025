const fs = require('fs');
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
    test('the script should be less than 150 characters in length', () => {
        expect(script.length).toBeLessThan(150);
    });
});

test('should rename files matching the pattern', async () => {
    // Clean up
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    fs.mkdirSync('./src', { recursive: true });
    
    // Create test files
    const matchingFiles = ['test1.txt', 'test2.log', 'testing.md'];
    const nonMatchingFiles = ['data.txt', 'info.log', 'readme.md'];
    
    matchingFiles.forEach(file => {
        fs.writeFileSync(`./src/${file}`, faker.lorem.paragraph());
    });
    
    nonMatchingFiles.forEach(file => {
        fs.writeFileSync(`./src/${file}`, faker.lorem.paragraph());
    });
    
    // Execute with pattern
    await exec('bash execute.sh "^test.*"');
    
    const files = fs.readdirSync('./src');
    
    // Check matching files were renamed
    matchingFiles.forEach(file => {
        const ext = path.extname(file);
        const basename = path.basename(file, ext);
        const expectedName = `${basename}_renamed${ext}`;
        
        expect(files).toContain(expectedName);
        expect(files).not.toContain(file);
    });
    
    // Check non-matching files remain unchanged
    nonMatchingFiles.forEach(file => {
        expect(files).toContain(file);
    });
});

test('should handle different patterns', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    fs.mkdirSync('./src', { recursive: true });
    
    // Create test files
    fs.writeFileSync('./src/data123.txt', 'content');
    fs.writeFileSync('./src/info456.txt', 'content');
    fs.writeFileSync('./src/test.txt', 'content');
    
    // Execute with pattern matching files with numbers
    await exec('bash execute.sh ".*[0-9].*"');
    
    const files = fs.readdirSync('./src');
    
    // Files with numbers should be renamed
    expect(files).toContain('data123_renamed.txt');
    expect(files).toContain('info456_renamed.txt');
    expect(files).not.toContain('data123.txt');
    expect(files).not.toContain('info456.txt');
    
    // File without numbers should remain
    expect(files).toContain('test.txt');
});

test('should handle files with multiple dots', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    fs.mkdirSync('./src', { recursive: true });
    
    fs.writeFileSync('./src/test.backup.txt', 'content');
    
    await exec('bash execute.sh "^test.*"');
    
    const files = fs.readdirSync('./src');
    
    // Should rename to test.backup_renamed.txt
    expect(files).toContain('test.backup_renamed.txt');
    expect(files).not.toContain('test.backup.txt');
});

