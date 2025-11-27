const fs = require('fs');
const yaml = require('js-yaml');
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
        await expect(dependencyCount()).resolves.toStrictEqual(5)
    });
});

function sortKeysRecursively(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => sortKeysRecursively(item));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj)
            .sort()
            .reduce((result, key) => {
                result[key] = sortKeysRecursively(obj[key]);
                return result;
            }, {});
    }
    return obj;
}

test('should convert JSON to YAML with sorted keys', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    const testData = {
        zebra: 'animal',
        apple: 'fruit',
        nested: {
            zebra: 1,
            alpha: 2,
            beta: {
                gamma: 3,
                alpha: 4
            }
        },
        array: [1, 2, 3],
        boolean: true,
        number: 42
    };
    
    fs.writeFileSync('./src/data.json', JSON.stringify(testData));
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/transformed.yaml')).toBe(true);
    
    const yamlContent = fs.readFileSync('./out/transformed.yaml', 'utf-8');
    const parsed = yaml.load(yamlContent);
    
    const sortedOriginal = sortKeysRecursively(testData);
    expect(parsed).toStrictEqual(sortedOriginal);
    
    // Verify key ordering in YAML
    const lines = yamlContent.split('\n');
    const rootKeys = [];
    for (const line of lines) {
        if (line.match(/^[a-z]/)) {
            rootKeys.push(line.split(':')[0]);
        }
    }
    const sortedRootKeys = [...rootKeys].sort();
    expect(rootKeys).toStrictEqual(sortedRootKeys);
});

test('should handle complex nested structures', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    const complexData = {
        zulu: {
            yankee: {
                xray: 1
            }
        },
        alpha: {
            bravo: {
                charlie: 2
            }
        },
        array: [
            { zebra: 1, alpha: 2 },
            { yankee: 3, bravo: 4 }
        ]
    };
    
    fs.writeFileSync('./src/data.json', JSON.stringify(complexData));
    
    await exec('bash execute.sh');
    
    const yamlContent = fs.readFileSync('./out/transformed.yaml', 'utf-8');
    const parsed = yaml.load(yamlContent);
    
    const sortedOriginal = sortKeysRecursively(complexData);
    expect(parsed).toStrictEqual(sortedOriginal);
});

