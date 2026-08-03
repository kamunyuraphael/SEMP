# SEMP — ML pipeline

Python analytics pipeline for SEMP. Runs on a schedule (APScheduler) and, per
run: checks the Node server is reachable, ingests UK-DALE household energy
data, disaggregates it per-appliance (CO model), forecasts next-day kWh
(GradientBoosting), flags anomalies (IsolationForest), then posts all results
to the `server` API.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env   # fill in the variables below
python app.py
```

This starts a Flask service (port 8000) with the pipeline scheduler running
in a background thread — one process, no separate command needed to start
the scheduler.

## Environment variables

| Variable | Purpose |
|---|---|
| `UKDALE_PATH` | Path to the UK-DALE dataset file |
| `BUILDING_ID` | Which UK-DALE building to simulate from |
| `SAMPLE_PERIOD` | Sampling interval (seconds) |
| `NODE_API_URL` | Full URL of the server's `/api/ml/predictions` endpoint |
| `ML_API_KEY` | Must match the server's `ML_API_KEY` |
| `SCHEDULE_INTERVAL_MINUTES` | How often the pipeline runs |
| `DEFAULT_USER_ID` | MongoDB ObjectId of the seeded account predictions are attributed to |

> `env.txt` in this folder is a template/reference, not a real secrets file —
> don't commit real key values into it. Only `.env` is gitignored.

## Running the full system locally

1. Start `server` first (this pipeline needs it reachable)
2. Run this pipeline (`python app.py`) so telemetry/predictions exist
3. Start `app` — the dashboard has real data to render
