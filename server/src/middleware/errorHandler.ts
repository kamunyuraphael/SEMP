// errorHandler.ts - This file defines middleware for handling errors in the HEMS application. It captures any errors that occur during request processing, logs the error stack trace to the console for debugging purposes, and sends a standardized JSON response to the client with a 500 status code and an error message. This middleware should be used after all other route handlers and middleware to ensure that it can catch any unhandled errors that may occur.
import type { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err.stack);

  res.status(500).json({
    error: "Something went wrong",
    message: err.message,
  });
};
