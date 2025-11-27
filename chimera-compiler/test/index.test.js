const exec = require('@sliit-foss/actions-exec-wrapper').default;
const { shellFiles } = require('@sliit-foss/bashaway');
const path = require('path');
const fs = require('fs');

describe('Chimera Compiler', () => {
  const root = path.join(__dirname, '..');
  const manifest = path.join(root, 'src', 'chimera', 'manifest.json');

  const runScript = async () => (await exec('bash execute.sh', { cwd: root }))?.trim();

  test('should keep Bash as the command center', () => {
    expect(shellFiles(root).length).toBe(1);
  });

  test('should report the handshake phrase and focus target status', async () => {
    await expect(runScript()).resolves.toBe('HANDSHAKE:OK|WASM:READY');
  });

  test('should not change the manifest file when reading', async () => {
    const before = fs.readFileSync(manifest, 'utf8');
    await runScript();
    expect(fs.readFileSync(manifest, 'utf8')).toBe(before);
  });

  test('should uppercase the focus label and status in output', async () => {
    const output = await runScript();
    expect(output).toMatch(/^HANDSHAKE:[A-Z]+\|[A-Z]+:[A-Z]+$/);
  });
});
