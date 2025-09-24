import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    walletAddress: string;
    farcasterHandle?: string | null;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || "default_secret";
    
    const decoded = jwt.verify(token, jwtSecret) as { walletAddress: string };
    const user = await storage.getUserByWallet(decoded.walletAddress);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || "default_secret";
    
    const decoded = jwt.verify(token, jwtSecret) as { walletAddress: string };
    const user = await storage.getUserByWallet(decoded.walletAddress);
    
    if (user) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
