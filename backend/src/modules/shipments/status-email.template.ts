import { Shipment, TrackingEvent } from "./shipments.types";

const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  in_warehouse: "In Warehouse",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  arrived: "Arrived",
  delivered: "Delivered",
  exception: "There's an issue with your shipment",
};

export interface StatusEmailContent {
  subject: string;
  html: string;
}

export function buildStatusEmail(
  shipment: Shipment,
  event: TrackingEvent,
  trackingUrl: string,
  unsubscribeUrl: string
): StatusEmailContent {
  const statusLabel = STATUS_LABELS[event.status] ?? event.status;

  const subject = `${shipment.trackingNumber}: ${statusLabel}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7280;">
        Tracking number
      </p>
      <p style="font-family: monospace; font-size: 16px; margin: 4px 0 20px;">
        ${shipment.trackingNumber}
      </p>

      <p style="font-size: 18px; font-weight: 600; margin: 0 0 4px;">${statusLabel}</p>
      <p style="color: #374151; margin: 0 0 4px;">${event.note}</p>
      <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px;">${event.location}</p>

      <a href="${trackingUrl}"
         style="display: inline-block; background: #1fa98a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px;">
        Track your shipment
      </a>

      <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">
        Don't want these emails? <a href="${unsubscribeUrl}" style="color: #9ca3af;">Unsubscribe</a>.
      </p>
    </div>
  `.trim();

  return { subject, html };
}