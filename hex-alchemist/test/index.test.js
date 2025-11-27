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

test('should convert decimal to hex with alternating case', async () => {
    const convertToAlternatingHex = (num) => {
        const hex = num.toString(16);
        let result = '';
        for (let i = 0; i < hex.length; i++) {
            const char = hex[i];
            if (/[a-f]/.test(char)) {
                result += (i % 2 === 0) ? char.toUpperCase() : char.toLowerCase();
            } else {
                result += char;
            }
        }
        return result;
    };

    for (let i = 0; i < 30; i++) {
        const num = faker.number.int({ min: 0, max: 1000000 });
        const output = await exec(`bash execute.sh ${num}`);
        const expected = convertToAlternatingHex(num);
        expect(output?.trim()).toBe(expected);
    }
});

test('should handle edge cases', async () => {
    // Test 0
    let output = await exec('bash execute.sh 0');
    expect(output?.trim()).toBe('0');
    
    // Test large numbers
    output = await exec('bash execute.sh 16777215');
    expect(output?.trim()).toBe('FfFfFf');
});

