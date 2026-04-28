const runsList = document.querySelector('#runsList');
const runCount = document.querySelector('#runCount');
const runDetail = document.querySelector('#runDetail');
const emptyState = document.querySelector('#emptyState');
const refreshLabel = document.querySelector('#refreshLabel');
const refreshNow = document.querySelector('#refreshNow');
const mockFrontend = document.querySelector('#mockFrontend');
const mockBackend = document.querySelector('#mockBackend');
const mockBoth = document.querySelector('#mockBoth');

let selectedRunId = null;
let refreshTimer = null;

function statusClass(status) {
  return `status-${status.toLowerCase()}`;
}

function statusBadge(status) {
  return `<span class="badge ${statusClass(status)}">${status}</span>`;
}

function formatDate(value) {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString();
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function loadConfig() {
  const config = await getJson('/api/config');
  refreshLabel.textContent = `Auto refresh: ${config.autoRefreshSeconds}s`;
  refreshTimer = setInterval(refresh, config.autoRefreshSeconds * 1000);
}

async function refresh() {
  const runs = await getJson('/api/runs');
  renderRuns(runs);

  if (!selectedRunId && runs.length > 0) {
    selectedRunId = runs[0].id;
  }

  if (selectedRunId) {
    await renderRunDetail(selectedRunId);
  }
}

function renderRuns(runs) {
  runCount.textContent = runs.length.toString();
  runsList.innerHTML = runs.map((run) => `
    <button class="run-button ${run.id === selectedRunId ? 'selected' : ''}" type="button" data-run-id="${run.id}">
      <strong>${run.id}</strong>
      ${statusBadge(run.status)}
      <span class="meta">${run.event} | ${run.branch} | ${run.commit}</span>
      <span class="meta">${formatDate(run.createdAt)}</span>
    </button>
  `).join('');

  runsList.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', async () => {
      selectedRunId = button.dataset.runId;
      await renderRunDetail(selectedRunId);
    });
  });
}

async function renderRunDetail(runId) {
  const run = await getJson(`/api/runs/${runId}`);
  emptyState.classList.add('hidden');
  runDetail.classList.remove('hidden');

  runDetail.innerHTML = `
    <div class="run-heading">
      <div>
        <h2>${run.id}</h2>
        <p class="meta">${run.repository} | ${run.branch} | ${run.commit}</p>
        <p class="meta">Created ${formatDate(run.createdAt)} | Updated ${formatDate(run.updatedAt)}</p>
      </div>
      <div>${statusBadge(run.status)}</div>
    </div>

    <section class="agent-grid" aria-label="Agent statuses">
      ${run.agents.map((agent) => `
        <article class="agent-card agent-${agent.status.toLowerCase()}">
          <div>${statusBadge(agent.status)}</div>
          <h3>${agent.name}</h3>
          <p>${agent.summary || 'Waiting.'}</p>
          <p class="meta">${agent.startedAt ? `Started ${formatDate(agent.startedAt)}` : 'Not started'}</p>
        </article>
      `).join('')}
    </section>

    <section class="detail-grid">
      <article class="panel">
        <h3>Changed files</h3>
        <pre>${escapeHtml((run.changedFiles || []).join('\n') || 'No files detected')}</pre>
      </article>
      <article class="panel">
        <h3>Classification</h3>
        <pre>${escapeHtml(JSON.stringify(run.classified, null, 2))}</pre>
      </article>
    </section>

    ${run.agents.map((agent) => `
      <details>
        <summary>${agent.name} logs</summary>
        ${agent.command ? `<p class="meta">${escapeHtml(agent.command)}</p>` : ''}
        <pre>${escapeHtml(agent.logs || 'No logs yet.')}</pre>
      </details>
    `).join('')}
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function triggerMock(target) {
  const run = await getJson(`/api/runs/mock?target=${target}`, { method: 'POST' });
  selectedRunId = run.runId;
  await refresh();
}

refreshNow.addEventListener('click', refresh);
mockFrontend.addEventListener('click', () => triggerMock('frontend'));
mockBackend.addEventListener('click', () => triggerMock('backend'));
mockBoth.addEventListener('click', () => triggerMock('both'));

loadConfig()
  .then(refresh)
  .catch((error) => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    emptyState.textContent = error.message;
  });
