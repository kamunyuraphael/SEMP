# SEMP — server

Express + Mongoose + TypeScript API for SEMP. Handles auth, devices, telemetry,
alerts/anomalies, budget & tariff calculations, weekly email digests, and
receives predictions posted by the `ml` pipeline.

Hosted on Render: `semp-server.onrender.com`

## Setup

```bash
npm install
cp .env.example .env   # fill in the variables below
npm run dev
```

## Environment variables

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs/verifies auth tokens |
| `ML_API_KEY` | Shared secret the `ml` service must send to post predictions |
| `PORT` | Port the server listens on |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Weekly digest email — leave blank to skip sending |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start with `tsx watch` (auto-restarts on change) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled `dist/server.js` |
| `npm run seed` | Seed the database with sample users/devices/telemetry |

## Data flow

- Real telemetry is written by the Node-side simulator (`src/telemetrySimulator.ts`, every 15 min) — not by `consumptionLogs` on the Device model, which is legacy/unused.
- The `ml` pipeline posts predictions to `/api/ml/predictions`, authenticated with `ML_API_KEY`.
- Device lifetime usage is computed via a Mongo aggregation over the `Telemetry` collection (see `getDevices` in `deviceController.ts`) — this is the source of truth, not any per-device cached field.

## Running the full system locally

1. Start this server first
2. Run the `ml` pipeline against it so telemetry/predictions exist
3. Start `app` — the dashboard has real data to render
