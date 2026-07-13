// valdateRequest.ts - Middleware for validating incoming request data using Zod schemas. Provides functions to validate request body, query parameters, and URL parameters, ensuring that the data conforms to expected formats before reaching route handlers.
import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

export const validateBody = (schema: ZodTypeAny) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Request body validation failed",
      details: result.error.issues,
    });
  }

  req.body = result.data;
  return next();
};

export const validateQuery = (schema: ZodTypeAny) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({
      error: "Query validation failed",
      details: result.error.issues,
    });
  }

  Object.keys(req.query).forEach(key => delete req.query[key]);
  Object.assign(req.query, result.data);
  return next();
};

export const validateParams = (schema: ZodTypeAny) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({
      error: "Parameter validation failed",
      details: result.error.issues,
    });
  }

  req.params = result.data as any;
  return next();
};
