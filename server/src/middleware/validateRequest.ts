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

  // Express 5 (and the standalone `router` package) made req.query a
  // getter-only property computed from the URL, so `req.query = ...`
  // throws "Cannot set property query of #<IncomingMessage> which has
  // only a getter". Mutate the existing object in place instead of
  // reassigning it.
  for (const key of Object.keys(req.query)) {
    delete (req.query as Record<string, unknown>)[key];
  }
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

  // Same getter-only issue can affect req.params on some router
  // versions — mutate in place rather than reassign, for the same
  // reason as validateQuery above.
  for (const key of Object.keys(req.params)) {
    delete (req.params as Record<string, unknown>)[key];
  }
  Object.assign(req.params, result.data);
  return next();
};
