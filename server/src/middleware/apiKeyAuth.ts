// apiKeyAuth.ts - This file defines middleware for authenticating API requests to machine learning endpoints in the HEMS application. It checks for the presence of a specific API key in the request headers and compares it against a configured value in the environment variables. If the key is missing or does not match, it responds with an appropriate error message and status code. If the key is valid, it allows the request to proceed to the next middleware or route handler.
import type { Request, Response, NextFunction } from "express";

export const requireMlApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.header("x-ml-api-key");
  const systemMLKey = process.env.ML_API_KEY;

  if (!systemMLKey) {
    return res.status(500).json({
        success:false,
        error: "Server configuration misfire: Machine Learning API authentication key is missing from environment properties.",
    });
  }

  if (!apiKey || apiKey !== systemMLKey) {
    return res.status(401).json({ 
        success: false,
        error: "Unauthorized ML webhook request",
    });
  }

  return next();
};
