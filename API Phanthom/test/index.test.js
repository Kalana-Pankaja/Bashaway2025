const fs = require('fs');
const axios = require('axios');
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

test('should fetch Bitcoin price from CoinGecko API', async () => {
    // First, get the actual price from the API
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const expectedPrice = response.data.bitcoin.usd;
    
    // Execute the script
    const output = await exec('bash execute.sh');
    const scriptPrice = parseFloat(output?.trim());
    
    // Verify it's a valid number
    expect(scriptPrice).not.toBeNaN();
    
    // Verify it's close to the actual price (within 5% to account for timing differences)
    const difference = Math.abs(scriptPrice - expectedPrice);
    const percentDiff = (difference / expectedPrice) * 100;
    
    expect(percentDiff).toBeLessThan(5);
    
    // Verify it's a reasonable Bitcoin price (between $1000 and $1000000)
    expect(scriptPrice).toBeGreaterThan(1000);
    expect(scriptPrice).toBeLessThan(1000000);
}, 15000); // Increased timeout for API call

test('should output only the numeric price', async () => {
    const output = await exec('bash execute.sh');
    const trimmed = output?.trim();
    
    // Should be a valid number
    expect(parseFloat(trimmed)).not.toBeNaN();
    
    // Should not contain JSON formatting
    expect(trimmed).not.toContain('{');
    expect(trimmed).not.toContain('}');
    expect(trimmed).not.toContain('[');
    expect(trimmed).not.toContain(']');
    expect(trimmed).not.toContain('"');
    
    // Should not contain currency symbols
    expect(trimmed).not.toContain('$');
    expect(trimmed).not.toContain('USD');
}, 15000);

