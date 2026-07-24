import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import logger from "./utils/logger.js";
import { initIO } from "./utils/socketEvents.js";
import { startWeeklyDigestScheduler } from "./scheduler.js";
import type { ServerToClientEvents, ClientToServerEvents } from "./types/SocketEvents.js";

dotenv.config();

// Validate required environment variables at startup
const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS || "*",
    methods: ["GET", "POST"],
  },
});

initIO(io);

io.on("connection", (socket) => {
  logger.info(`🔌 Connection handshake opened: ${socket.id}`);

  socket.on("subscribeAlerts", (userId: string) => {
    socket.join(userId);
    logger.info(`👥 Client ${socket.id} joined alerts pipeline channel: [User: ${userId}]`);
  });

  socket.on("unsubscribeAlerts", (userId: string) => {
    socket.leave(userId);
    logger.info(`👥 Client ${socket.id} disconnected from channel: [User: ${userId}]`);
  });

  socket.on("disconnect", () => {
    logger.info(`❌ Connection handshake severed: ${socket.id}`);
  });
});

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      logger.info(`🚀 HEMS Engine orchestrating safely on port ${PORT}`);
    });
    startWeeklyDigestScheduler();
  } catch (error) {
    logger.error("Fatal startup error:", error);
    process.exit(1);
  }
};

startServer();
