import { Router } from "express";
import { findStaffUserByEmail } from "./staff.repository";
import { verifyPassword } from "./password.util";
import { signAuthToken } from "./jwt.util";
import { AUTH_COOKIE_NAME } from "./auth-cookie";
import { env } from "../../config/env";

export const authRouter = Router();

const isProd = env.nodeEnv === "production";

const authCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
};

authRouter.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const staffUser = await findStaffUserByEmail(email);

  if (!staffUser) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const passwordMatches = await verifyPassword(password, staffUser.passwordHash);
  if (!passwordMatches) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signAuthToken({ staffUserId: staffUser.id });

  res.cookie(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions,
    maxAge: 60 * 60 * 1000,
  });

  console.log("[login] cookie set for", staffUser.email, "origin:", req.headers.origin);

  res.json({ email: staffUser.email });
});

authRouter.post("/auth/logout", (_req, res) => {
 
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions);
  res.json({ success: true });
});