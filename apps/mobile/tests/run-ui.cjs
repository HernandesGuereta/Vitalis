const { spawnSync } = require('node:child_process');
const { resolve, join } = require('node:path');
const { createServer } = require('node:net');
const root = resolve(__dirname, '../../..');
try {
  process.loadEnvFile(join(root, '.env'));
} catch {}
async function main() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const env = {
    ...process.env,
    VITALIS_UI_API_PORT: String(port),
    VITE_API_URL: `http://127.0.0.1:${port}`,
    EXPO_PUBLIC_API_URL: `http://127.0.0.1:${port}`,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  for (const args of [
    ['run', 'build'],
    ['run', 'export:web', '--workspace', '@vitalis/mobile'],
  ]) {
    const result = spawnSync(npm, args, { env, cwd: root, stdio: 'inherit' });
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
  const result = spawnSync(require('electron'), [join(__dirname, 'ui-smoke.cjs')], {
    env,
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error);
  process.exitCode = result.status ?? 1;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
