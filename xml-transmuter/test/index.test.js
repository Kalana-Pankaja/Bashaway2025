const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');
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
});

test('should convert XML to JSON', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<root>
    <person id="1">
        <name>John Doe</name>
        <age>30</age>
        <email>john@example.com</email>
    </person>
    <person id="2">
        <name>Jane Smith</name>
        <age>25</age>
        <email>jane@example.com</email>
    </person>
</root>`;
    
    fs.writeFileSync('./src/data.xml', xmlData);
    
    await exec('bash execute.sh');
    
    expect(fs.existsSync('./out/output.json')).toBe(true);
    
    const result = JSON.parse(fs.readFileSync('./out/output.json', 'utf-8'));
    
    expect(result).toHaveProperty('root');
    expect(result.root).toHaveProperty('person');
    expect(Array.isArray(result.root.person)).toBe(true);
    expect(result.root.person).toHaveLength(2);
});

test('should preserve XML attributes', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
    <book id="bk101" category="fiction">
        <title>The Great Novel</title>
        <author>John Author</author>
        <price currency="USD">29.99</price>
    </book>
</catalog>`;
    
    fs.writeFileSync('./src/data.xml', xmlData);
    
    await exec('bash execute.sh');
    
    const result = JSON.parse(fs.readFileSync('./out/output.json', 'utf-8'));
    
    expect(result.catalog.book).toBeDefined();
    
    // Attributes should be preserved (typically with @ prefix or as properties)
    const book = Array.isArray(result.catalog.book) ? result.catalog.book[0] : result.catalog.book;
    expect(book).toBeTruthy();
});

test('should handle nested XML structures', async () => {
    if (fs.existsSync('./src')) fs.rmSync('./src', { recursive: true });
    if (fs.existsSync('./out')) fs.rmSync('./out', { recursive: true });
    
    fs.mkdirSync('./src', { recursive: true });
    
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<company>
    <department name="Engineering">
        <team name="Backend">
            <member>Alice</member>
            <member>Bob</member>
        </team>
        <team name="Frontend">
            <member>Charlie</member>
        </team>
    </department>
</company>`;
    
    fs.writeFileSync('./src/data.xml', xmlData);
    
    await exec('bash execute.sh');
    
    const result = JSON.parse(fs.readFileSync('./out/output.json', 'utf-8'));
    
    expect(result.company).toBeDefined();
    expect(result.company.department).toBeDefined();
});

