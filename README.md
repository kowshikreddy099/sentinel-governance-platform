# Sentinel — Agentic AI Governance & Behavioral Monitoring

Sentinel is a runnable governance control room for AI agents. It watches complete trajectories rather than isolated actions: agent decisions, tool calls, A2A delegation, policy outcomes, cumulative risk, and behavioral anomalies.

The included demo tells the requested story end-to-end: **Research Lead** delegates source collection to **Data Scout**, the worker uses approved tools, changes its retrieval plan, then attempts to access **Customer Warehouse**. `POL-004` blocks the restricted action, raises cumulative risk to 74, opens an alert, and preserves the full trajectory timeline.

## What is included

- Polished responsive React dashboard with overview, traces, policies, and incident inbox.
- Interactive demo execution, trace search, evidence JSON export, alert acknowledgement, and policy controls.
- Clear allowed/flagged/blocked states, delegation topology, cumulative risk, and behavioral anomaly context.
- FastAPI + SQLAlchemy service that works with SQLite locally and PostgreSQL in deployment.
- Event ingestion endpoint designed for LangGraph, MCP, A2A, and OpenTelemetry adapters.
- Seeded policies and the realistic research-delegation scenario.

## Start the dashboard

Requires Node.js 20+.

## Dashboard preview

Open the live [Sentinel governance dashboard](https://kowshikreddy099.github.io/sentinel-governance-platform/) for the working interactive control room. It includes the full research-delegation incident, policy block, risk score, alert, and trace timeline. A self-contained offline copy is also available at [outputs/sentinel-dashboard-preview.html](outputs/sentinel-dashboard-preview.html).

```powershell
npm install
npm run dev
```

Open the URL shown by Vite (normally `http://localhost:5173`). It works immediately using the embedded demo dataset.

## Start the API service

Requires Python 3.11+.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The service creates a local SQLite database and seeds the demo data on first start. Interactive API documentation is available at `http://localhost:8000/docs`.

To connect the dashboard, copy `.env.example` to `.env` in the repository root and set:

```env
VITE_GOV_API_URL=http://localhost:8000/v1
```

Restart Vite after changing the environment file.

## PostgreSQL deployment

For local PostgreSQL plus the API container:

```powershell
docker compose up --build
```

The frontend remains a separately hosted static Vite app. Set its `VITE_GOV_API_URL` to the deployed FastAPI URL. This separation is deliberate: Lovable-style React frontends should call a hosted Python service; they do not execute FastAPI or LangGraph themselves.

## Authentication and production notes

The UI is prepared to operate behind an authenticated backend; wire your organization’s OIDC/Supabase JWT verifier into FastAPI before enabling public access. Keep the API on a trusted network, restrict CORS to your frontend origin, use PostgreSQL, and forward identity/scopes with each agent event. Do not treat the seeded deterministic policy logic as a replacement for your legal/compliance policies.

See [API_CONTRACT.md](API_CONTRACT.md) for the integration contract and event format.
