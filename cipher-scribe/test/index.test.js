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

test('should apply ROT13 cipher correctly', async () => {
    const rot13 = (str) => {
        return str.replace(/[a-zA-Z]/g, (char) => {
            const code = char.charCodeAt(0);
            if (code >= 65 && code <= 90) {
                // Uppercase A-Z
                return String.fromCharCode(((code - 65 + 13) % 26) + 65);
            } else if (code >= 97 && code <= 122) {
                // Lowercase a-z
                return String.fromCharCode(((code - 97 + 13) % 26) + 97);
            }
            return char;
        });
    };

    const testCases = [
        'Hello World',
        'ABC xyz',
        'The Quick Brown Fox',
        'ROT13 Example',
        'abcdefghijklmnopqrstuvwxyz',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        'Hello World 123!',
        'Test@2024#',
    ];

    for (const testCase of testCases) {
        const output = await exec(`bash execute.sh "${testCase}"`);
        const expected = rot13(testCase);
        expect(output?.trim()).toBe(expected);
    }
});

test('should preserve non-letter characters', async () => {
    const rot13 = (str) => {
        return str.replace(/[a-zA-Z]/g, (char) => {
            const code = char.charCodeAt(0);
            if (code >= 65 && code <= 90) {
                return String.fromCharCode(((code - 65 + 13) % 26) + 65);
            } else if (code >= 97 && code <= 122) {
                return String.fromCharCode(((code - 97 + 13) % 26) + 97);
            }
            return char;
        });
    };

    const testCases = [
        '123456789',
        '!@#$%^&*()',
        'Test 123 !@#',
        'a1b2c3',
    ];

    for (const testCase of testCases) {
        const output = await exec(`bash execute.sh "${testCase}"`);
        const expected = rot13(testCase);
        expect(output?.trim()).toBe(expected);
    }
});

test('should handle random text', async () => {
    const rot13 = (str) => {
        return str.replace(/[a-zA-Z]/g, (char) => {
            const code = char.charCodeAt(0);
            if (code >= 65 && code <= 90) {
                return String.fromCharCode(((code - 65 + 13) % 26) + 65);
            } else if (code >= 97 && code <= 122) {
                return String.fromCharCode(((code - 97 + 13) % 26) + 97);
            }
            return char;
        });
    };

    for (let i = 0; i < 15; i++) {
        const text = faker.lorem.sentence();
        const output = await exec(`bash execute.sh "${text}"`);
        const expected = rot13(text);
        expect(output?.trim()).toBe(expected);
    }
});

