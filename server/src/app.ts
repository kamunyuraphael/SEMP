import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const allowedOrigins = [
  "https://vercel.app",
  "http://localhost:5174"
]

const app = express();
app.use(cors({
  origin: (origin, callback) => { 
    // Allow requests with no origin 
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else { 
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
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
