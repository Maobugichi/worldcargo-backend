import { Router } from "express";
import { findStaffUserByEmail } from "./staff.repository";
import { verifyPassword } from "./password.util";
import { signAuthToken } from "./jwt.util";
import { AUTH_COOKIE_NAME } from "./auth-cookie";
import { env } from "../../config/env";

export const authRouter = Router();

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
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 1000,
  });

  res.json({ email: staffUser.email });
});

authRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME);
  res.json({ success: true });
});