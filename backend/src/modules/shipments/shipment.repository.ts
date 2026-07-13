import { pool } from "../../db/pool";
import { generateTrackingNumber } from "./tracking-number.util";
import { Shipment, ShipmentStatus, TrackingEvent } from "./shipments.types";

interface ShipmentRow {
  id: string;
  tracking_number: string;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  eta: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  email_opt_in: boolean;
  created_at: string;
  updated_at: string;
}

interface TrackingEventRow {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  location: string;
  latitude: string | null;
  longitude: string | null;
  note: string;
  occurred_at: string;
  created_at: string;
}

function mapShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    status: row.status,
    origin: row.origin,
    destination: row.destination,
    eta: row.eta,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    emailOptIn: row.email_opt_in,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrackingEvent(row: TrackingEventRow): TrackingEvent {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    status: row.status,
    location: row.location,
    latitude: row.latitude !== null ? parseFloat(row.latitude) : null,
    longitude: row.longitude !== null ? parseFloat(row.longitude) : null,
    note: row.note,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export interface CreateShipmentInput {
  origin: string;
  destination: string;
  eta?: string;
  recipientName?: string;
  recipientEmail?: string;
  emailOptIn?: boolean;
}

export async function createShipment(input: CreateShipmentInput): Promise<Shipment> {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const trackingNumber = generateTrackingNumber();

    try {
      const result = await pool.query<ShipmentRow>(
        `INSERT INTO shipments
           (tracking_number, origin, destination, eta, recipient_name, recipient_email, email_opt_in)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          trackingNumber,
          input.origin,
          input.destination,
          input.eta ?? null,
          input.recipientName ?? null,
          input.recipientEmail ?? null,
          input.emailOptIn ?? false,
        ]
      );
      return mapShipment(result.rows[0]);
    } catch (err) {
      const isUniqueViolation = (err as { code?: string }).code === "23505";
      if (!isUniqueViolation || attempt === MAX_ATTEMPTS - 1) {
        throw err;
      }
    }
  }

  throw new Error("Failed to generate a unique tracking number");
}

export async function listShipments(): Promise<Shipment[]> {
  const result = await pool.query<ShipmentRow>(
    "SELECT * FROM shipments ORDER BY updated_at DESC"
  );
  return result.rows.map(mapShipment);
}

export async function findShipmentById(id: string): Promise<Shipment | null> {
  const result = await pool.query<ShipmentRow>("SELECT * FROM shipments WHERE id = $1", [id]);
  return result.rows.length > 0 ? mapShipment(result.rows[0]) : null;
}

export async function findShipmentByTrackingNumber(
  trackingNumber: string
): Promise<Shipment | null> {
  const result = await pool.query<ShipmentRow>(
    "SELECT * FROM shipments WHERE tracking_number = $1",
    [trackingNumber]
  );
  return result.rows.length > 0 ? mapShipment(result.rows[0]) : null;
}

export async function listEventsForShipment(shipmentId: string): Promise<TrackingEvent[]> {
  const result = await pool.query<TrackingEventRow>(
    "SELECT * FROM tracking_events WHERE shipment_id = $1 ORDER BY occurred_at DESC",
    [shipmentId]
  );
  return result.rows.map(mapTrackingEvent);
}

export interface SetStatusInput {
  status: ShipmentStatus;
  location: string;
  note: string;
  occurredAt?: string;
  latitude?: number;
  longitude?: number;
}

export async function setShipmentStatus(
  shipmentId: string,
  input: SetStatusInput
): Promise<{ shipment: Shipment; event: TrackingEvent }> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const eventResult = await client.query<TrackingEventRow>(
      `INSERT INTO tracking_events
         (shipment_id, status, location, latitude, longitude, note, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
       RETURNING *`,
      [
        shipmentId,
        input.status,
        input.location,
        input.latitude ?? null,
        input.longitude ?? null,
        input.note,
        input.occurredAt ?? null,
      ]
    );

    const shipmentResult = await client.query<ShipmentRow>(
      `UPDATE shipments SET status = $1, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [input.status, shipmentId]
    );

    if (shipmentResult.rows.length === 0) {
      throw new Error("Shipment not found");
    }

    await client.query("COMMIT");

    return {
      shipment: mapShipment(shipmentResult.rows[0]),
      event: mapTrackingEvent(eventResult.rows[0]),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface AddEventInput {
  location: string;
  note: string;
  occurredAt?: string;
  latitude?: number;
  longitude?: number;
}

export async function addTrackingEvent(
  shipmentId: string,
  input: AddEventInput
): Promise<TrackingEvent> {
  const shipment = await findShipmentById(shipmentId);
  if (!shipment) {
    throw new Error("Shipment not found");
  }

  const result = await pool.query<TrackingEventRow>(
    `INSERT INTO tracking_events
       (shipment_id, status, location, latitude, longitude, note, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()))
     RETURNING *`,
    [
      shipmentId,
      shipment.status,
      input.location,
      input.latitude ?? null,
      input.longitude ?? null,
      input.note,
      input.occurredAt ?? null,
    ]
  );

  return mapTrackingEvent(result.rows[0]);
}

export async function setEmailOptIn(
  trackingNumber: string,
  email: string
): Promise<Shipment | null> {
  const result = await pool.query<ShipmentRow>(
    `UPDATE shipments SET email_opt_in = TRUE, recipient_email = $1, updated_at = now()
     WHERE tracking_number = $2
     RETURNING *`,
    [email, trackingNumber]
  );
  return result.rows.length > 0 ? mapShipment(result.rows[0]) : null;
}

export async function disableEmailOptIn(shipmentId: string): Promise<void> {
  await pool.query(
    `UPDATE shipments SET email_opt_in = FALSE, updated_at = now() WHERE id = $1`,
    [shipmentId]
  );
}