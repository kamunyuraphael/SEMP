// authMiddleware.ts - This file defines middleware for authenticating requests to protected routes in the HEMS application. It checks for the presence of a JSON Web Token (JWT) in the Authorization header of incoming requests, verifies the token using a secret key, and attaches the decoded user information to the request object for use in subsequent route handlers. If the token is missing, invalid, or expired, it responds with an appropriate error message and status code.
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  id: string;
}

interface AuthRequest extends Request {
  user?: { id: string };
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Expect "Bearer <token>"

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error: JWT_SECRET is not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

    // Attach user ID to request object
    const authReq = req as AuthRequest;
    authReq.user = { id: decoded.id };

    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
