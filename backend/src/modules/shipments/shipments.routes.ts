import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/require-auth";
import { HttpError } from "../../middleware/error-handler";
import { SHIPMENT_STATUSES } from "./shipments.types";
import {
  addTrackingEvent,
  createShipment,
  findShipmentById,
  findShipmentByTrackingNumber,
  listEventsForShipment,
  listShipments,
  setEmailOptIn,
  setShipmentStatus,
  disableEmailOptIn
} from "./shipment.repository";
import { sendStatusChangeEmail } from "./send-status-email";
import { verifyUnsubscribeToken } from "./unsubscribe-token.util";

export const shipmentsRouter = Router();

shipmentsRouter.get("/track/:trackingNumber", async (req, res) => {
  const shipment = await findShipmentByTrackingNumber(req.params.trackingNumber);

  if (!shipment) {
    res.status(404).json({ error: "Tracking number not found" });
    return;
  }

  const events = await listEventsForShipment(shipment.id);

  res.json({
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    origin: shipment.origin,
    destination: shipment.destination,
    eta: shipment.eta,
    events: events.map((event) => ({
      status: event.status,
      location: event.location,
      note: event.note,
      occurredAt: event.occurredAt,
      ...(event.latitude !== null && event.longitude !== null
        ? { lat: event.latitude, lng: event.longitude }
        : {}),
    })),
  });
});

const subscribeSchema = z.object({
  email: z.string().email(),
});

shipmentsRouter.post("/track/:trackingNumber/subscribe", async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  const shipment = await setEmailOptIn(req.params.trackingNumber, parsed.data.email);
  if (!shipment) {
    res.status(404).json({ error: "Tracking number not found" });
    return;
  }

  res.json({ success: true });
});

const createShipmentSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  eta: z.string().optional(),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  emailOptIn: z.boolean().optional(),
});

shipmentsRouter.post("/shipments", requireAuth, async (req, res) => {
  const parsed = createShipmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  if (parsed.data.emailOptIn && !parsed.data.recipientEmail) {
    res.status(400).json({ error: "recipientEmail is required when emailOptIn is true" });
    return;
  }

  const shipment = await createShipment(parsed.data);
  res.status(201).json(shipment);
});

shipmentsRouter.get("/shipments", requireAuth, async (_req, res) => {
  const shipments = await listShipments();
  res.json(shipments);
});

shipmentsRouter.get("/shipments/:id", requireAuth, async (req, res) => {
  const shipment = await findShipmentById(req.params.id as string);
  if (!shipment) {
    throw new HttpError(404, "Shipment not found");
  }

  const events = await listEventsForShipment(shipment.id);
  res.json({ ...shipment, events });
});

const setStatusSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  location: z.string().min(1),
  note: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

shipmentsRouter.patch("/shipments/:id/status", requireAuth, async (req, res) => {
  const parsed = setStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const shipment = await findShipmentById(req.params.id as string);
  if (!shipment) {
    throw new HttpError(404, "Shipment not found");
  }

  const result = await setShipmentStatus(req.params.id as string, parsed.data);

  void sendStatusChangeEmail(result.shipment, result.event);

  res.json(result);
});

const addEventSchema = z.object({
  location: z.string().min(1),
  note: z.string().min(1),
  occurredAt: z.string().datetime().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

shipmentsRouter.post("/shipments/:id/events", requireAuth, async (req, res) => {
  const parsed = addEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const shipment = await findShipmentById(req.params.id as string);
  if (!shipment) {
    throw new HttpError(404, "Shipment not found");
  }

  const event = await addTrackingEvent(req.params.id as string, parsed.data);
  res.status(201).json(event);
});


shipmentsRouter.get("/unsubscribe/:token", async (req, res) => {
  const payload = verifyUnsubscribeToken(req.params.token);

  if (!payload) {
    res.status(400).send("This unsubscribe link is invalid or has expired.");
    return;
  }

  await disableEmailOptIn(payload.shipmentId);
  res.send("You've been unsubscribed from email updates for this shipment.");
});