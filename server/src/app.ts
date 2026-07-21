import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(cors());
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
