import { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../modules/auth/jwt.util";
import { AUTH_COOKIE_NAME } from "../modules/auth/auth-cookie";

declare global {
  namespace Express {
    interface Request {
      staffUserId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

    console.log("[requireAuth]", {
    hasCookie: !!token,
    cookieHeader: req.headers.cookie,
    origin: req.headers.origin,
    userAgent: req.headers["user-agent"],
  });

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    req.staffUserId = payload.staffUserId;
    next();
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
}