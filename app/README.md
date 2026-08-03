# SEMP — Smart Energy Monitoring and Prediction (client)

React + TypeScript + Vite frontend for SEMP, a full-stack app that tracks home
energy usage device-by-device, flags anomalies, and forecasts upcoming bills.

Live: https://semp-nu.vercel.app/

This is one of three parts of the system:

| Part | What it does | Hosted on |
|---|---|---|
| `app` (this repo) | React dashboard, auth, device management | Vercel |
| `server` | Express/Mongoose API, auth, telemetry, alerts, email digests | Render |
| `ml` | Python pipeline — forecasting, anomaly detection, disaggregation | Run manually / scheduled |

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_API_URL and VITE_SOCKET_URL
npm run dev
```

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the `server` API |
| `VITE_SOCKET_URL` | Base URL for the socket.io connection (live telemetry/alerts) |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) then build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Running the full system locally

The client expects live data. Bring the system up in this order:

1. Start `server` (`npm run dev`)
2. Run the `ml` pipeline against the running server so telemetry/predictions exist
3. Start `app` (`npm run dev`) — the dashboard has real data to render

See the `server` and `ml` READMEs for their own setup.
