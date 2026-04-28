const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');

const PORT = Number(process.env.ORCHESTRATOR_PORT || 5050);
const AUTO_REFRESH_SECONDS = Number(process.env.AUTO_REFRESH_SECONDS || 5);
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_LOG_LENGTH = Number(process.env.MAX_AGENT_LOG_LENGTH || 50000);
const COMMAND_TIMEOUT_MS = Number(process.env.AGENT_COMMAND_TIMEOUT_MS || 120000);

const FRONTEND_TEST_COMMAND = process.env.FRONTEND_TEST_COMMAND || 'npm test -- --watch=false';
const BACKEND_TEST_COMMAND = process.env.BACKEND_TEST_COMMAND || 'mvn test';
const FRONTEND_AGENT_COMMAND = process.env.FRONTEND_AGENT_COMMAND || '';
const BACKEND_AGENT_COMMAND = process.env.BACKEND_AGENT_COMMAND || '';

let sequence = 1;
const runs = [];

function nowIso() {
  return new Date().toISOString();
}

function makeAgent(id, name) {
  return {
    id,
    name,
    status: 'PENDING',
    summary: '',
    command: '',
    logs: '',
    startedAt: null,
    endedAt: null
  };
}

function touchRun(run) {
  run.updatedAt = nowIso();
}

function setAgent(agent, status, summary = '') {
  agent.status = status;
  agent.summary = summary;
  if (status === 'RUNNING') {
    agent.startedAt = nowIso();
  }
  if (['SUCCESS', 'FAILED', 'SKIPPED'].includes(status)) {
    agent.endedAt = nowIso();
  }
}

function truncateLog(log) {
  if (log.length <= MAX_LOG_LENGTH) {
    return log;
  }

  return `${log.slice(0, MAX_LOG_LENGTH)}\n\n[log truncated at ${MAX_LOG_LENGTH} characters]`;
}

function classifyFiles(files) {
  const uniqueFiles = [...new Set(files)].sort();
  return {
    all: uniqueFiles,
    frontend: uniqueFiles.filter((file) => file.startsWith('frontend/')),
    backend: uniqueFiles.filter((file) => file.startsWith('backend/')),
    ignored: uniqueFiles.filter((file) => !file.startsWith('frontend/') && !file.startsWith('backend/'))
  };
}

function createRun(context) {
  const classified = classifyFiles(context.changedFiles);
  const run = {
    id: `run-${Date.now()}-${sequence++}`,
    status: 'PENDING',
    source: context.source,
    repository: context.repository,
    branch: context.branch,
    commit: context.commit,
    event: context.event,
    changedFiles: classified.all,
    classified,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    agents: [
      makeAgent('agent1', 'Change Detector'),
      makeAgent('agent2', 'Frontend Test Writer'),
      makeAgent('agent3', 'Backend Test Writer'),
      makeAgent('agent4', 'Unit Test Runner')
    ]
  };

  runs.unshift(run);
  startRun(run).catch((error) => {
    run.status = 'FAILED';
    run.error = error.message;
    touchRun(run);
  });

  return run;
}

async function startRun(run) {
  run.status = 'RUNNING';
  touchRun(run);

  const agent1 = findAgent(run, 'agent1');
  const agent2 = findAgent(run, 'agent2');
  const agent3 = findAgent(run, 'agent3');
  const agent4 = findAgent(run, 'agent4');

  setAgent(agent1, 'RUNNING', 'Inspecting changed files.');
  touchRun(run);
  await delay(300);

  const frontendChanged = run.classified.frontend.length > 0;
  const backendChanged = run.classified.backend.length > 0;
  setAgent(
    agent1,
    'SUCCESS',
    `Detected ${run.classified.frontend.length} frontend file(s), ${run.classified.backend.length} backend file(s), and ${run.classified.ignored.length} ignored file(s).`
  );
  agent1.logs = run.changedFiles.length ? run.changedFiles.join('\n') : 'No changed files were present in the webhook payload.';
  touchRun(run);

  if (!frontendChanged) {
    setAgent(agent2, 'SKIPPED', 'No frontend/** files changed.');
  }
  if (!backendChanged) {
    setAgent(agent3, 'SKIPPED', 'No backend/** files changed.');
  }

  const writerTasks = [];
  if (frontendChanged) {
    writerTasks.push(runTestWriterAgent(run, agent2, 'frontend', run.classified.frontend, FRONTEND_AGENT_COMMAND));
  }
  if (backendChanged) {
    writerTasks.push(runTestWriterAgent(run, agent3, 'backend', run.classified.backend, BACKEND_AGENT_COMMAND));
  }
  await Promise.all(writerTasks);

  if ([agent2, agent3].some((agent) => agent.status === 'FAILED')) {
    setAgent(agent4, 'SKIPPED', 'Skipped because a test-writer agent failed.');
    run.status = 'FAILED';
    touchRun(run);
    return;
  }

  if (!frontendChanged && !backendChanged) {
    setAgent(agent4, 'SKIPPED', 'No frontend or backend test suite was required.');
    run.status = 'SUCCESS';
    touchRun(run);
    return;
  }

  await runUnitTests(run, agent4, { frontendChanged, backendChanged });
  run.status = agent4.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
  touchRun(run);
}

async function runTestWriterAgent(run, agent, targetArea, changedFiles, command) {
  setAgent(agent, 'RUNNING', `Preparing ${targetArea} unit-test changes.`);
  agent.logs = changedFiles.join('\n');
  touchRun(run);

  if (!command) {
    await delay(600);
    setAgent(
      agent,
      'SUCCESS',
      `Dry run complete for ${targetArea}. Configure ${targetArea === 'frontend' ? 'FRONTEND_AGENT_COMMAND' : 'BACKEND_AGENT_COMMAND'} to call a real test-writing agent.`
    );
    agent.logs = [
      `Changed ${targetArea} files:`,
      ...changedFiles,
      '',
      'No source files were modified by the orchestrator default mode.'
    ].join('\n');
    touchRun(run);
    return;
  }

  agent.command = command;
  const result = await runShellCommand(command, ROOT_DIR, {
    RUN_ID: run.id,
    TARGET_AREA: targetArea,
    CHANGED_FILES: JSON.stringify(changedFiles),
    REPO_ROOT: ROOT_DIR
  });
  agent.logs = truncateLog(result.output);
  setAgent(
    agent,
    result.code === 0 ? 'SUCCESS' : 'FAILED',
    result.code === 0 ? `${targetArea} test writer completed.` : `${targetArea} test writer failed with exit code ${result.code}.`
  );
  touchRun(run);
}

async function runUnitTests(run, agent, targets) {
  setAgent(agent, 'RUNNING', 'Running selected unit test suites.');
  touchRun(run);

  const logs = [];
  let failed = false;

  if (targets.frontendChanged) {
    agent.command = appendCommand(agent.command, `cd frontend && ${FRONTEND_TEST_COMMAND}`);
    const result = await runShellCommand(FRONTEND_TEST_COMMAND, FRONTEND_DIR);
    logs.push(formatCommandResult('Frontend unit tests', FRONTEND_TEST_COMMAND, FRONTEND_DIR, result));
    failed = failed || result.code !== 0;
  }

  if (targets.backendChanged) {
    agent.command = appendCommand(agent.command, `cd backend && ${BACKEND_TEST_COMMAND}`);
    const result = await runShellCommand(BACKEND_TEST_COMMAND, BACKEND_DIR);
    logs.push(formatCommandResult('Backend unit tests', BACKEND_TEST_COMMAND, BACKEND_DIR, result));
    failed = failed || result.code !== 0;
  }

  agent.logs = truncateLog(logs.join('\n\n'));
  setAgent(agent, failed ? 'FAILED' : 'SUCCESS', failed ? 'One or more unit test suites failed.' : 'Selected unit test suites passed.');
  touchRun(run);
}

function appendCommand(existing, command) {
  return existing ? `${existing}\n${command}` : command;
}

function formatCommandResult(title, command, cwd, result) {
  return [
    `## ${title}`,
    `cwd: ${cwd}`,
    `command: ${command}`,
    `exitCode: ${result.code}`,
    '',
    result.output
  ].join('\n');
}

function runShellCommand(command, cwd, extraEnv = {}) {
  return new Promise((resolve) => {
    const childEnv = { ...process.env, ...extraEnv };
    if (!Object.prototype.hasOwnProperty.call(extraEnv, 'DEBUG')) {
      delete childEnv.DEBUG;
    }

    const child = spawn(command, {
      cwd,
      shell: true,
      env: childEnv
    });

    let output = '';
    const timer = setTimeout(() => {
      output += `\nCommand timed out after ${COMMAND_TIMEOUT_MS}ms.`;
      child.kill('SIGTERM');
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: 1, output: `${output}\n${error.message}` });
    });
  });
}

function findAgent(run, id) {
  return run.agents.find((agent) => agent.id === id);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function extractWebhookContext(payload, event) {
  if (event === 'push') {
    const files = [];
    for (const commit of payload.commits || []) {
      files.push(...(commit.added || []), ...(commit.modified || []), ...(commit.removed || []));
    }

    return {
      source: 'github',
      event,
      repository: payload.repository?.full_name || 'unknown',
      branch: (payload.ref || '').replace('refs/heads/', '') || 'unknown',
      commit: payload.after || payload.head_commit?.id || 'unknown',
      changedFiles: files
    };
  }

  if (event === 'pull_request') {
    const pullRequest = payload.pull_request || {};
    const files = await fetchPullRequestFiles(payload);
    return {
      source: 'github',
      event,
      repository: payload.repository?.full_name || 'unknown',
      branch: pullRequest.head?.ref || 'unknown',
      commit: pullRequest.head?.sha || 'unknown',
      changedFiles: files
    };
  }

  return {
    source: 'github',
    event,
    repository: payload.repository?.full_name || 'unknown',
    branch: 'unknown',
    commit: 'unknown',
    changedFiles: []
  };
}

async function fetchPullRequestFiles(payload) {
  if (Array.isArray(payload.files)) {
    return payload.files.map((file) => file.filename).filter(Boolean);
  }

  const fullName = payload.repository?.full_name;
  const number = payload.pull_request?.number;
  const token = process.env.GITHUB_TOKEN;
  if (!fullName || !number || !token) {
    return [];
  }

  const response = await fetch(`https://api.github.com/repos/${fullName}/pulls/${number}/files`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'todo-a2a-orchestrator'
    }
  });

  if (!response.ok) {
    return [];
  }

  const files = await response.json();
  return files.map((file) => file.filename).filter(Boolean);
}

function verifyGithubSignature(body, signatureHeader) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk.toString();
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { 'Content-Type': 'text/plain' });
  response.end(text);
}

function serveStatic(request, response, pathname) {
  const filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(response, 404, 'Not found');
      return;
    }

    response.writeHead(200, { 'Content-Type': contentType(filePath) });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    response.end(content);
  });
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js')) return 'text/javascript';
  if (filePath.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (request.method === 'GET' && pathname === '/api/config') {
    sendJson(response, 200, {
      autoRefreshSeconds: AUTO_REFRESH_SECONDS,
      repository: 'https://github.com/rudrathkr/A2A_Approach_Run_Unit_Tests_OnCode_Change.git'
    });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/runs') {
    sendJson(response, 200, runs.map((run) => ({
      id: run.id,
      status: run.status,
      repository: run.repository,
      branch: run.branch,
      commit: run.commit,
      event: run.event,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      agents: run.agents.map(({ id, name, status, summary }) => ({ id, name, status, summary }))
    })));
    return;
  }

  if (request.method === 'GET' && pathname.startsWith('/api/runs/')) {
    const id = pathname.split('/').pop();
    const run = runs.find((item) => item.id === id);
    if (!run) {
      sendJson(response, 404, { message: 'Run not found' });
      return;
    }

    sendJson(response, 200, run);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/github/webhook') {
    const body = await readRequestBody(request);
    if (!verifyGithubSignature(body, request.headers['x-hub-signature-256'])) {
      sendJson(response, 401, { message: 'Invalid GitHub signature' });
      return;
    }

    const payload = body ? JSON.parse(body) : {};
    const event = request.headers['x-github-event'] || 'push';
    const context = await extractWebhookContext(payload, event);
    const run = createRun(context);
    sendJson(response, 202, { runId: run.id, status: run.status });
    return;
  }

  if (request.method === 'POST' && pathname === '/api/runs/mock') {
    const target = url.searchParams.get('target') || 'both';
    const files = [];
    if (target === 'frontend' || target === 'both') {
      files.push('frontend/src/app/app.ts', 'frontend/src/app/todo.service.ts');
    }
    if (target === 'backend' || target === 'both') {
      files.push('backend/src/main/java/com/example/todo/TodoController.java');
    }

    const run = createRun({
      source: 'local',
      event: 'mock',
      repository: 'rudrathkr/A2A_Approach_Run_Unit_Tests_OnCode_Change',
      branch: 'main',
      commit: 'local-demo',
      changedFiles: files
    });
    sendJson(response, 202, { runId: run.id, status: run.status });
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    serveStatic(request, response, pathname);
    return;
  }

  sendJson(response, 405, { message: 'Method not allowed' });
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    sendJson(response, 500, { message: error.message });
  });
});

server.listen(PORT, () => {
  console.log(`A2A orchestrator listening at http://localhost:${PORT}`);
});
