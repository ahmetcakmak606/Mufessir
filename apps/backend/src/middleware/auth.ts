import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; dailyQuota?: number };
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const secret = process.env.JWT_SECRET as string;
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = { id: payload.sub as string, email: payload.email as string };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function enforceQuota(prisma: PrismaClient) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthenticated" });

    const now = new Date();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: "Unauthenticated" });

    // Reset quota if window elapsed
    if (user.quotaResetAt < now) {
      await prisma.user.update({ 
        where: { id: userId }, 
        data: { 
          dailyQuota: Number(process.env.FREE_DAILY_QUOTA) || 100, 
          quotaResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) 
        } 
      });
    }

    if (user.dailyQuota <= 0) return res.status(429).json({ error: "Quota exhausted" });

    // Store user info for quota decrement middleware
    req.user = { ...req.user, dailyQuota: user.dailyQuota } as any;
    next();
  };
}

export function decrementQuota(prisma: PrismaClient) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let decremented = false;

    const decrement = () => {
      if (decremented) return;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user?.id;
        if (userId) {
          prisma.user.update({
            where: { id: userId },
            data: { dailyQuota: { decrement: 1 } }
          }).catch(console.error);
        }
      }
      decremented = true;
    };

    const originalSend = res.send;
    res.send = function (this: Response, data: any) {
      decrement();
      return originalSend.call(this, data);
    } as any;

    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      decrement();
      return (originalEnd as any).call(this, ...args);
    } as any;

    next();
  };
} 