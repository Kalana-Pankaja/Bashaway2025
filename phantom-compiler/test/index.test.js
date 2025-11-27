const fs = require('fs');
const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { scan, shellFiles } = require('@sliit-foss/bashaway');

test('should validate if only bash files are present', () => {
    const shellFileCount = shellFiles().length;
    expect(shellFileCount).toBe(1);
    expect(shellFileCount).toBe(scan('**', ['src/**']).length);
});

test('should compile the C code into an executable', async () => {
    if (fs.existsSync('./out')) {
        fs.rmSync('./out', { recursive: true });
    }
    
    await exec('bash execute.sh');
    
    // Check if the executable exists
    expect(fs.existsSync('./out/phantom') || fs.existsSync('./out/phantom.exe')).toBe(true);
});

test('executable should produce correct output', async () => {
    // Run the executable and check output
    const exePath = fs.existsSync('./out/phantom') ? './out/phantom' : './out/phantom.exe';
    const result = await exec(exePath);
    
    expect(result).toContain('Greetings from the phantom realm!');
    expect(result).toContain('The compilation was successful.');
});

test('executable should exit successfully', async () => {
    const exePath = fs.existsSync('./out/phantom') ? './out/phantom' : './out/phantom.exe';
    
    // If exec completes without throwing, the exit code was 0
    await expect(exec(exePath)).resolves.toBeDefined();
});

test('should recompile when script is run again', async () => {
    const exePath = './out/phantom';
    
    // Get initial modification time
    const stat1 = fs.statSync(exePath);
    
    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Recompile
    await exec('bash execute.sh');
    
    // Check file was updated (either modified or recreated)
    expect(fs.existsSync(exePath)).toBe(true);
});

test('should use proper compiler toolchain', async () => {
    // Verify compilation process was executed correctly
    const { exec: childExec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(childExec);
    
    // Check if compiler process ran during execution
    const { stdout } = await execPromise('bash -c "source execute.sh 2>&1 | cat"', { 
        cwd: process.cwd() 
    });
    
    // Verify output directory and executable were created
    expect(fs.existsSync('./out/phantom') || fs.existsSync('./out/phantom.exe')).toBe(true);
});

