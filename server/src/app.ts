import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

// Fixed known origins (local dev + the actual production frontend).
// 'https://vercel.app' previously here was the marketing site's own
// domain, not a real deployment — it could never match any actual
// Vercel-hosted app, so every cross-origin request was rejected before
// it reached the API.
const FIXED_ALLOWED_ORIGINS = [
  "https://semp-nu.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

// Additional origins can be added without a redeploy via the
// ALLOWED_ORIGINS env var (comma-separated), e.g. a custom domain.
const envOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [...FIXED_ALLOWED_ORIGINS, ...envOrigins];

// Vercel gives every preview deployment its own random subdomain
// (e.g. semp-nu-git-feature-x.vercel.app), so match any *.vercel.app
// origin in addition to the fixed list above rather than only the
// one production URL.
export function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

const app = express();
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin) return callback(null, true);

    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ml-api-key'],
}));
app.use(express.json());

// Health endpoint — used by Python analytics service check_node_health() and Docker/deployment health probes
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    service: "hems-server",
    timestamp: new Date().toISOString() 
  });
});


app.use('/api', apiRoutes);
app.use(errorHandler);

export default app;
