import { resend } from "../../lib/resend";
import { env } from "../../config/env";
import { Shipment, TrackingEvent } from "./shipments.types";
import { buildStatusEmail } from "./status-email.template";
import { signUnsubscribeToken } from "./unsubscribe-token.util";

export async function sendStatusChangeEmail(
  shipment: Shipment,
  event: TrackingEvent
): Promise<void> {
  if (!shipment.emailOptIn || !shipment.recipientEmail) {
    return;
  }

  if (!env.resendApiKey) {
    console.warn("RESEND_API_KEY not set -- skipping status email");
    return;
  }

  const unsubscribeToken = signUnsubscribeToken({
    shipmentId: shipment.id,
    email: shipment.recipientEmail,
  });

  const trackingUrl = env.frontendOrigin;
  const unsubscribeUrl = `${env.publicApiUrl}/unsubscribe/${unsubscribeToken}`;

  const { subject, html } = buildStatusEmail(shipment, event, trackingUrl, unsubscribeUrl);

  try {
    await resend.emails.send({
      from: env.resendFromEmail,
      to: shipment.recipientEmail,
      subject,
      html,
    });
  } catch (err) {
    console.error("Failed to send status-change email", err);
  }
}