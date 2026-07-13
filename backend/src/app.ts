import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { allowedOrigins } from "./config/cors.config";
import { authRouter } from "./modules/auth/auth.routes";
import { shipmentsRouter } from "./modules/shipments/shipments.routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

export const app = express();

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(authRouter);
app.use(shipmentsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
