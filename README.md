# SEMP — Smart Energy Monitoring and Prediction System

SEMP is a three-tier home energy monitoring platform: a Python analytics
service disaggregates and forecasts household power consumption from the
UK-DALE dataset, a Node.js/Express API persists and serves that data, and
a React client visualizes it — live power draw, per-category breakdowns,
consumption forecasts, and anomaly detection — with real-time alerts over
Socket.io.

```
┌─────────────────────┐      HTTP (ML webhook)      ┌──────────────────────┐      HTTP + Socket.io      ┌──────────────────────┐
│   analytics-python   │ ──────────────────────────▶ │        server        │ ◀─────────────────────────▶ │        client         │
│  (Flask + APScheduler)│                             │  (Express + MongoDB)  │                             │  (React + TypeScript)  │
│                      │                             │                       │                             │                        │
│ • UK-DALE ingestion   │                             │ • Auth (JWT)          │                             │ • Dashboard            │
│ • Disaggregation      │                             │ • Devices/Telemetry   │                             │ • Devices              │
│ • Forecasting (GBR)   │                             │ • Predictions/Alerts  │                             │ • Telemetry            │
│ • Anomaly detection   │                             │ • Export (CSV/XLSX)   │                             │ • Predictions          │
│   (IsolationForest)   │                             │ • Real-time alerts    │                             │ • Anomalies            │
└─────────────────────┘                             └──────────────────────┘                             └──────────────────────┘
```

---

## Tech stack

| Layer                | Stack                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **analytics-python** | Python, Flask, APScheduler, NILMTK, pandas, scikit-learn (GradientBoostingRegressor, IsolationForest), `requests`  |
| **server**           | Node.js, Express, TypeScript, MongoDB/Mongoose, Socket.io, JWT (`jsonwebtoken`), `bcryptjs`, Zod, Winston, ExcelJS |
| **client**           | React 19, TypeScript, Vite, React Router, Bootstrap + Bootstrap Icons, Axios, Socket.io-client                     |

Charts (line, bar, stacked bar, donut) are hand-rolled SVG components with
no charting library dependency — see `client/components/charts/`.

---

## Repository structure

```
SEMP/
├── analytics-python/
│   ├── app.py                 # Flask app: /health, /status, /run, /retrain, /appliances
│   ├── scheduler.py           # APScheduler orchestration — the full pipeline entry point
│   ├── config.py              # Env-driven configuration
│   ├── data/                  # UK-DALE .h5 dataset lives here (not checked in)
│   ├── models/                # Persisted trained models (co_model.pkl, forecaster_models.pkl, ...)
│   └── src/
│       ├── ingestion/loader.py       # UK-DALE access via NILMTK
│       ├── pipeline/
│       │   ├── disaggregator.py      # Ground-truth per-appliance extraction
│       │   ├── forecaster.py         # GradientBoostingRegressor hourly forecasts
│       │   └── anomaly.py            # IsolationForest anomaly detection
│       └── bridge/poster.py          # Posts prediction payloads to the Node server
│
├── server/
│   ├── app.ts / server.ts     # Express app + Socket.io server
│   ├── controllers/           # auth, device, telemetry, prediction, alert, export, ml
│   ├── models/                # Mongoose schemas: User, Device, Telemetry, Prediction, Alert
│   ├── routes/apiRoutes.ts    # All /api/* routes
│   ├── middleware/            # JWT auth, ML API key auth, Zod request validation
│   ├── validation/schemas.ts  # Zod schemas for every request body/query/param
│   └── scripts/seed.ts        # Populates a real account with test data
│
└── client/
    ├── pages/                 # Dashboard, Devices, Telemetry, Predictions, Anomalies,
    │                          # Notifications, Profile, Export, auth/Login, auth/Register
    ├── components/
    │   ├── charts/            # PowerLineChart, ConsumptionBar, CategoryPie, StackedBarChart
    │   ├── layout/             # Sidebar, Navbar, AppLayout, ProtectedRoute
    │   └── alerts/AlertToast.tsx
    ├── context/                # AuthContext, SocketContext, ThemeContext
    ├── services/api.ts         # Centralised Axios instance + typed service functions
    └── types/index.ts          # Shared TypeScript interfaces mirroring the API contract
```

---

## Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB (local or Atlas)
- The UK-DALE dataset (`ukdale.h5`) — download from https://jack-kelly.com/data/ and place it under `analytics-python/data/`

> **Note:** `client/package.json` and `server/package.json` (plus Vite/TS
> config) aren't included yet — this repo currently ships source files
> only. Scaffold each with `npm create vite@latest` (React + TypeScript
> template) / `npm init` respectively, matching the dependencies listed
> above, before `npm install` will work.

---

## Getting started

### 1. `server/`

Create `server/.env`:

```
MONGO_URI=mongodb://localhost:27017/semp
JWT_SECRET=<any long random string>
ML_API_KEY=<any long random string — must match analytics-python's ML_API_KEY exactly>
PORT=5000
ALLOWED_ORIGINS=http://localhost:5173
NODE_ENV=development
```

```bash
npm install
npm run dev        # or: npx tsx server.ts
```

The server validates `MONGO_URI` and `JWT_SECRET` at startup and exits
immediately if either is missing.

### 2. `analytics-python/`

Create `analytics-python/.env` (note: **`.env`**, not `env.txt` —
`python-dotenv` only loads a file with that exact name):

```
UKDALE_PATH=data/ukdale.h5
BUILDING_ID=1
SAMPLE_PERIOD=6
NODE_API_URL=http://localhost:5000/api/ml/predictions
ML_API_KEY=<must match server's ML_API_KEY exactly>
SCHEDULE_INTERVAL_MINUTES=15
DEFAULT_USER_ID=<a real MongoDB ObjectId — see seeding below>
```

```bash
pip install -r requirements.txt   # nilmtk, flask, apscheduler, pandas, scikit-learn, requests
export PYTHONPATH=$PWD/src        # Windows: set PYTHONPATH=%cd%\src
python app.py
```

This starts both the Flask app (port 8000 by default) and the
APScheduler background pipeline in the same process.

### 3. `client/`

Create `client/.env`:

```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

```bash
npm install
npm run dev
```

---

## Seeding test data

`server/scripts/seed.ts` populates a **real, already-registered** account
(looked up by email — it never creates a new account or touches your
password) with realistic devices, 45 days of telemetry, predictions, and
alerts, so the client has something to show before the ML pipeline has
run:

```bash
npx tsx scripts/seed.ts
```

It prints the account's real MongoDB `_id` — copy that into
`analytics-python/.env` as `DEFAULT_USER_ID` so ML-generated predictions
land on the same account you're viewing in the browser. Safe to re-run;
it only ever clears and recreates that one account's own data.

---

## API reference

All routes are prefixed with `/api` and (except auth register/login and
the ML webhook) require `Authorization: Bearer <JWT>`.

**Auth**
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Returns `{ token, userId }` |
| GET | `/auth/profile` | Current user + populated devices |
| PATCH | `/auth/change-password` | Requires current password |

**Devices**
| Method | Path | Description |
|---|---|---|
| GET | `/devices` | List the user's devices |
| POST | `/devices` | Create a device (name, category, location, ratedWattage) |
| PATCH | `/devices/:id/status` | Toggle active/inactive |
| DELETE | `/devices/:id` | Delete a device |

**Telemetry**
| Method | Path | Description |
|---|---|---|
| GET | `/telemetry?interval=` | Raw/daily/weekly/monthly readings |
| POST | `/telemetry` | Record a reading |
| GET | `/telemetry/breakdown?date=` | Per-category totals for one day (defaults to today) |
| GET | `/telemetry/summary?from=&to=` | Total kWh/watts across a date range |
| GET | `/telemetry/breakdown-range?from=&to=&groupBy=` | Per-category totals per period (`hour` or `day`) — powers the Telemetry page's stacked bar chart |

**Predictions**
| Method | Path | Description |
|---|---|---|
| GET | `/predictions?type=` | bill / consumption / anomaly |
| POST | `/predictions` | Manual prediction entry |
| PATCH | `/predictions/:id/resolve` | Mark one anomaly resolved |
| PATCH | `/predictions/resolve-all` | Mark all anomalies resolved |
| POST | `/ml/predictions` | Webhook the Python pipeline posts to (requires `x-ml-api-key` header) |

**Alerts**
| Method | Path | Description |
|---|---|---|
| GET | `/alerts` | List alerts |
| PATCH | `/alerts/:id/read` | Mark one read |
| PATCH | `/alerts/read-all` | Mark all read |

**Export**
| Method | Path | Description |
|---|---|---|
| GET | `/export/telemetry?format=&interval=&from=&to=` | csv / json / xlsx |
| GET | `/export/predictions?format=&type=&from=&to=` | csv / json / xlsx |

**Real-time (Socket.io)**
| Event | Direction | Payload |
|---|---|---|
| `subscribeAlerts` | client → server | `userId` — joins that user's alert room |
| `unsubscribeAlerts` | client → server | `userId` |
| `alert` | server → client | `{ type, message, device?, anomalyDetails?, timestamp }` |

---

## The ML pipeline, briefly

Since UK-DALE is a historical (2013) dataset rather than live sensor
data, `scheduler.py` shifts each run's ingestion window forward so it
lands on "today" (preserving time-of-day), then:

1. **Disaggregation** — reads real per-appliance ground-truth power
   directly from UK-DALE for the target window (not an estimated CO
   disaggregation — see `disaggregator.py`'s module docstring for why).
2. **Forecasting** — a `GradientBoostingRegressor` per appliance,
   trained on calendar features (hour/day-of-week/month) plus
   rolling/lag context frozen at the last known real values.
3. **Anomaly detection** — `IsolationForest` on the mains signal.
4. **POST** — all three modules' payloads are batched and posted to
   `/api/ml/predictions`, which persists them and pushes real-time
   `alert` events for anomalies.

This full cycle runs every `SCHEDULE_INTERVAL_MINUTES` (default 15).
Telemetry and predictions only change once per cycle — if you want
livelier, more frequent updates on the dashboard, decoupling telemetry
ingestion onto its own faster interval (UK-DALE has native 6-second
resolution available) is the way to do that honestly, rather than
faking movement client-side.

---

## Known limitations / things worth knowing

- `client/package.json`, `server/package.json`, and Vite/TS config
  aren't in this repo yet (see Prerequisites above).
- `DEFAULT_USER_ID` in `analytics-python/.env` must be a real MongoDB
  ObjectId — the placeholder value will cause every ML POST to fail
  schema validation with a 400.
- The Python `.env` file must be named exactly `.env`, not `env.txt`,
  or `python-dotenv` silently won't load it.
- If you see `TypeError: Cannot set property query of #<IncomingMessage>
which has only a getter`, that's an Express 5 / `router` package
  compatibility issue — already fixed in `middleware/validateRequest.ts`
  by mutating `req.query`/`req.params` in place instead of reassigning
  them.
