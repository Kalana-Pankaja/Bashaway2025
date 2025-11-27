const fs = require('fs');
const { faker } = require('@faker-js/faker');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles, dependencyCount } = require('@sliit-foss/bashaway');

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
    test("no additional npm dependencies should be installed", async () => {
        await expect(dependencyCount()).resolves.toStrictEqual(4)
    });
});

test('should execute Python oracle and return factorial', async () => {
    const factorial = (n) => {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    };

    const testCases = [0, 1, 5, 10, 12, 15];

    for (const num of testCases) {
        const output = await exec(`bash execute.sh ${num}`);
        const expected = factorial(num);
        expect(Number(output?.trim())).toBe(expected);
    }
});

test('should handle random numbers', async () => {
    const factorial = (n) => {
        if (n <= 1) return 1;
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    };

    for (let i = 0; i < 10; i++) {
        const num = faker.number.int({ min: 0, max: 20 });
        const output = await exec(`bash execute.sh ${num}`);
        const expected = factorial(num);
        expect(Number(output?.trim())).toBe(expected);
    }
});

test('script character length should be under  45 characters', () => {
    const script = fs.readFileSync('./execute.sh', 'utf-8');
    expect(script.replace(/\s+/g, ' ').trim().length).toBeLessThanOrEqual(45);
});