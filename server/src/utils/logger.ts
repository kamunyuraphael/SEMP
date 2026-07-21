import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format layout for readable console logs
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }), // Captures and displays full error stack traces
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }), // Colors logs based on level (info = green, error = red)
        logFormat
      ),
    }),
  ],
});

// Export as the DEFAULT export to resolve your compiler error
export default logger;