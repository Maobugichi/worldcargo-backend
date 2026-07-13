import { resend } from "../../lib/resend";
import { env } from "../../config/env";
import { Shipment, TrackingEvent } from "./shipments.types";
import { buildStatusEmail } from "./status-email.template";
import { signUnsubscribeToken } from "./unsubscribe-token.util";

// Called after the status-update transaction has already committed (see
// design doc section 6) -- a slow or failed send should never roll back or
// delay the response to the admin who changed the status.
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
    const { error: sendError } = await resend.emails.send({
      from: env.resendFromEmail,
      to: shipment.recipientEmail,
      subject,
      html,
    });

    if (sendError) {
      // Same issue as the contact form route -- Resend returns an error
      // object rather than throwing, so this has to be checked explicitly
      // or a failed send goes unnoticed.
      console.error("Resend failed to send status-change email", sendError);
    }
  } catch (err) {
    // Log and swallow -- the status update already succeeded and shouldn't
    // fail just because the notification email didn't go out.
    console.error("Failed to send status-change email", err);
  }
}