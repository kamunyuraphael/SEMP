import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/SocketEvents.js";
import logger from "./logger.js";

// Keep a private reference to the instance within the module scope
let ioInstance: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

/**
 * Attaches the running Socket.io instance to the manager utility.
 * This should only be called once inside your main server.ts file.
 * * @param io The initialized Socket.io Server instance
 */
export const initIO = (io: Server<ClientToServerEvents, ServerToClientEvents>): void => {
  ioInstance = io;
  logger.info("🔌 Socket.io instance safely cached inside utility manager.");
};

/**
 * Safely fetches the established global Socket.io instance anywhere across your backend layers.
 * Throws an explicit error if a service attempts to emit an event before initialization.
 * * @returns The initialized Socket.io Server instance
 */
export const getIO = (): Server<ClientToServerEvents, ServerToClientEvents> => {
  if (!ioInstance) {
    logger.error("❌ Attempted to access getIO() before server initialization completed.");
    throw new Error("Socket.io instance has not been initialized yet. Call initIO(io) first inside server.ts.");
  }
  return ioInstance;
};