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
    test('the script should be less than 75 characters in length', () => {
        expect(script.length).toBeLessThan(75);
    });
});

test('should reverse the string correctly', async () => {
    for (let i = 0; i < 30; i++) {
        const str = faker.lorem.words({ min: 3, max: 10 });
        const output = await exec(`bash execute.sh "${str}"`);
        const expected = str.split('').reverse().join('');
        expect(output?.trim()).toBe(expected);
    }
});

test('should handle special characters', async () => {
    const testCases = [
        'Hello, World!',
        '12345',
        'a b c d e',
        'Test@123#',
        '!@#$%^&*()'
    ];

    for (const testCase of testCases) {
        const output = await exec(`bash execute.sh "${testCase}"`);
        const expected = testCase.split('').reverse().join('');
        expect(output?.trim()).toBe(expected);
    }
});

test('should handle edge cases', async () => {
    // Single character
    let output = await exec('bash execute.sh "a"');
    expect(output?.trim()).toBe('a');

    // Empty string
    output = await exec('bash execute.sh ""');
    expect(output?.trim()).toBe('');
});

