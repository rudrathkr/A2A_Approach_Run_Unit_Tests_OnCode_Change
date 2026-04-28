# A2A Unit Test Orchestrator

This folder contains a standalone orchestrator dashboard for the GitHub code-change flow. It does not require changes inside `frontend` or `backend`.

## Agents

1. `agent1` receives the GitHub webhook and classifies changed files.
2. `agent2` runs for `frontend/**` changes and is the frontend unit-test writer.
3. `agent3` runs for `backend/**` changes and is the backend unit-test writer.
4. `agent4` runs the required unit test suite and publishes results to the dashboard.

By default, agent2 and agent3 run in dry-run mode so this orchestrator does not modify repository files. To connect real test-writing agents later, set:

```bash
export FRONTEND_AGENT_COMMAND="your frontend test writer command"
export BACKEND_AGENT_COMMAND="your backend test writer command"
```

Those commands receive:

```text
RUN_ID
TARGET_AREA
CHANGED_FILES
REPO_ROOT
```

## Start Orchestrator

```bash
cd Orchestrator
npm start
```

Open:

```text
http://localhost:5050
```

Optional configuration:

```bash
export ORCHESTRATOR_PORT=5050
export AUTO_REFRESH_SECONDS=5
export GITHUB_WEBHOOK_SECRET="your webhook secret"
export GITHUB_TOKEN="token used only for pull_request file lookup"
```

## GitHub Webhook

Create a GitHub webhook for:

```text
POST http://<your-public-host>:5050/api/github/webhook
```

Use:

```text
Content type: application/json
Events: push, pull_request
Secret: same value as GITHUB_WEBHOOK_SECRET
```

For local testing, use a tunnel such as ngrok:

```bash
ngrok http 5050
```

## Unit Test Commands Used By Agent4

Frontend:

```bash
cd frontend
npm test -- --watch=false
```

Backend:

```bash
cd backend
mvn test
```

Override them if needed:

```bash
export FRONTEND_TEST_COMMAND="npm test -- --watch=false"
export BACKEND_TEST_COMMAND="mvn test"
```

## Local Webhook Test

With the orchestrator running:

```bash
curl -X POST http://localhost:5050/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  --data @examples/github-push.sample.json
```

The UI also has mock buttons for frontend, backend, and combined runs.

## API

```text
GET  /api/config
GET  /api/runs
GET  /api/runs/{runId}
POST /api/github/webhook
POST /api/runs/mock?target=frontend|backend|both
```
