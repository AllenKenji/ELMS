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

function startServerForIntegration(port) {
  const backendDir = path.resolve(__dirname, '..', '..');
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

  return {
    child,
    getLogs() {
      return { stdout, stderr };
    },
  };
}

test('committee workflow endpoints reject unauthenticated requests', async (t) => {
  const port = 5900 + Math.floor(Math.random() * 200);
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServerForIntegration(port);

  t.after(async () => {
    if (!server.child.killed) {
      server.child.kill('SIGTERM');
      await delay(250);
    }
    if (!server.child.killed) {
      server.child.kill('SIGKILL');
    }
  });

  await waitForServer(`${baseUrl}/health`);

  const reportResponse = await fetch(`${baseUrl}/ordinances/1/committee-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recommendation: 'Approve',
      report_content: 'Test report content from integration test.',
    }),
  });

  const assignResponse = await fetch(`${baseUrl}/ordinances/1/record-second-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: 1,
    }),
  });

  assert.equal(reportResponse.status, 401);
  assert.equal(assignResponse.status, 401);

  assert.equal(server.child.exitCode, null, JSON.stringify(server.getLogs()));
});

test('committee workflow transition path (env-driven)', async (t) => {
  const token = process.env.TEST_AUTH_TOKEN;
  const ordinanceId = process.env.TEST_ORDINANCE_ID;
  const secondSessionId = process.env.TEST_SECOND_SESSION_ID;

  if (!token || !ordinanceId || !secondSessionId) {
    t.skip('Set TEST_AUTH_TOKEN, TEST_ORDINANCE_ID, and TEST_SECOND_SESSION_ID to run transition integration test.');
    return;
  }

  const port = 6100 + Math.floor(Math.random() * 200);
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServerForIntegration(port);

  t.after(async () => {
    if (!server.child.killed) {
      server.child.kill('SIGTERM');
      await delay(250);
    }
    if (!server.child.killed) {
      server.child.kill('SIGKILL');
    }
  });

  await waitForServer(`${baseUrl}/health`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const beforeResponse = await fetch(`${baseUrl}/ordinances/${ordinanceId}/workflow-status`, {
    method: 'GET',
    headers: authHeaders,
  });
  assert.equal(beforeResponse.status, 200, 'workflow-status should be accessible with token');
  const beforeStatus = await beforeResponse.json();

  const stageBefore = String(beforeStatus?.ordinance?.reading_stage || '').toUpperCase();

  if (stageBefore === 'COMMITTEE_REPORT_SUBMITTED' && !beforeStatus?.committeeReport) {
    const submitReportResponse = await fetch(`${baseUrl}/ordinances/${ordinanceId}/committee-report`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        recommendation: 'Approve',
        report_content: 'Integration test committee report content.',
      }),
    });

    assert.equal(
      submitReportResponse.status,
      200,
      `committee-report submit failed. status=${submitReportResponse.status}`
    );
  }

  const assignSecondSessionResponse = await fetch(`${baseUrl}/ordinances/${ordinanceId}/record-second-session`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      session_id: Number(secondSessionId),
    }),
  });

  assert.equal(
    assignSecondSessionResponse.status,
    200,
    `record-second-session failed. status=${assignSecondSessionResponse.status}`
  );

  const afterResponse = await fetch(`${baseUrl}/ordinances/${ordinanceId}/workflow-status`, {
    method: 'GET',
    headers: authHeaders,
  });
  assert.equal(afterResponse.status, 200);
  const afterStatus = await afterResponse.json();

  const stageAfter = String(afterStatus?.ordinance?.reading_stage || '').toUpperCase();
  assert.equal(stageAfter, 'RECORD_SECOND_SESSION');

  assert.equal(server.child.exitCode, null, JSON.stringify(server.getLogs()));
});

test('resolution committee workflow transition path (env-driven)', async (t) => {
  const token = process.env.TEST_AUTH_TOKEN;
  const resolutionId = process.env.TEST_RESOLUTION_ID;
  const secondSessionId = process.env.TEST_SECOND_SESSION_ID;

  if (!token || !resolutionId || !secondSessionId) {
    t.skip('Set TEST_AUTH_TOKEN, TEST_RESOLUTION_ID, and TEST_SECOND_SESSION_ID to run resolution transition integration test.');
    return;
  }

  const port = 6300 + Math.floor(Math.random() * 200);
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = startServerForIntegration(port);

  t.after(async () => {
    if (!server.child.killed) {
      server.child.kill('SIGTERM');
      await delay(250);
    }
    if (!server.child.killed) {
      server.child.kill('SIGKILL');
    }
  });

  await waitForServer(`${baseUrl}/health`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const beforeResponse = await fetch(`${baseUrl}/resolutions/${resolutionId}/workflow-status`, {
    method: 'GET',
    headers: authHeaders,
  });
  assert.equal(beforeResponse.status, 200, 'workflow-status should be accessible with token');
  const beforeStatus = await beforeResponse.json();

  const stageBefore = String(beforeStatus?.resolution?.reading_stage || '').toUpperCase();

  if (stageBefore === 'COMMITTEE_REPORT_SUBMITTED' && !beforeStatus?.committeeReport) {
    const submitReportResponse = await fetch(`${baseUrl}/resolutions/${resolutionId}/committee-report`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        recommendation: 'Approve',
        report_content: 'Integration test committee report content for resolution.',
      }),
    });

    assert.equal(
      submitReportResponse.status,
      200,
      `committee-report submit failed. status=${submitReportResponse.status}`
    );
  }

  const assignSecondSessionResponse = await fetch(`${baseUrl}/resolutions/${resolutionId}/record-second-session`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      session_id: Number(secondSessionId),
    }),
  });

  assert.equal(
    assignSecondSessionResponse.status,
    200,
    `record-second-session failed. status=${assignSecondSessionResponse.status}`
  );

  const afterResponse = await fetch(`${baseUrl}/resolutions/${resolutionId}/workflow-status`, {
    method: 'GET',
    headers: authHeaders,
  });
  assert.equal(afterResponse.status, 200);
  const afterStatus = await afterResponse.json();

  const stageAfter = String(afterStatus?.resolution?.reading_stage || '').toUpperCase();
  assert.equal(stageAfter, 'RECORD_SECOND_SESSION');

  assert.equal(server.child.exitCode, null, JSON.stringify(server.getLogs()));
});
