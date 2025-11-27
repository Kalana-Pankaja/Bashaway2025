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
    test('the script should be less than 50 characters in length', () => {
        expect(script.length).toBeLessThan(50);
    });
});

test('should decode Base64 strings correctly', async () => {
    const testCases = [
        { encoded: 'SGVsbG8gV29ybGQh', decoded: 'Hello World!' },
        { encoded: 'QmFzaGF3YXk=', decoded: 'Bashaway' },
        { encoded: 'VGVzdCAxMjM=', decoded: 'Test 123' },
        { encoded: 'Zm9vYmFy', decoded: 'foobar' },
    ];

    for (const testCase of testCases) {
        const output = await exec(`bash execute.sh ${testCase.encoded}`);
        expect(output?.trim()).toBe(testCase.decoded);
    }
});

test('should handle random encoded strings', async () => {
    for (let i = 0; i < 20; i++) {
        const text = faker.lorem.words({ min: 1, max: 5 });
        const encoded = Buffer.from(text).toString('base64');
        
        const output = await exec(`bash execute.sh ${encoded}`);
        expect(output?.trim()).toBe(text);
    }
});

test('should handle special characters', async () => {
    const testCases = [
        'Hello, World!',
        'Test@2024#',
        'Special chars: !@#$%',
        'Numbers: 1234567890'
    ];

    for (const text of testCases) {
        const encoded = Buffer.from(text).toString('base64');
        const output = await exec(`bash execute.sh ${encoded}`);
        expect(output?.trim()).toBe(text);
    }
});

