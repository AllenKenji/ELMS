const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status: ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    await delay(250);
  }

  throw lastError || new Error('Server did not become ready in time');
}

test('server exposes health endpoints after startup', async (t) => {
  const backendDir = path.resolve(__dirname, '..', '..');
  const port = 5600 + Math.floor(Math.random() * 300);
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ['server.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk || '');
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk || '');
  });

  t.after(async () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      await delay(250);
    }
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  });

  await waitForServer(`${baseUrl}/health`);

  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.equal(healthResponse.status, 200);
  const healthJson = await healthResponse.json();
  assert.equal(healthJson.status, 'ok');

  const socketHealthResponse = await fetch(`${baseUrl}/socket-health`);
  assert.equal(socketHealthResponse.status, 200);
  const socketHealthJson = await socketHealthResponse.json();
  assert.equal(socketHealthJson.status, 'ok');
  assert.ok(Array.isArray(socketHealthJson.socket?.transports));

  const rootResponse = await fetch(`${baseUrl}/`);
  assert.equal(rootResponse.status, 200);
  const rootJson = await rootResponse.json();
  assert.equal(rootJson.health, '/health');

  assert.equal(child.exitCode, null, `Server exited early. stdout: ${stdout}\nstderr: ${stderr}`);
});
