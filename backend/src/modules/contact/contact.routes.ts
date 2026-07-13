import { Router } from "express";
import { z } from "zod";
import { resend } from "../../lib/resend";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/error-handler";

export const contactRouter = Router();

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
});

contactRouter.post("/contact", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  if (!env.resendApiKey || !env.contactRecipientEmail) {
    // Fails loudly rather than silently pretending to succeed -- unlike
    // shipment status emails (a nice-to-have on top of a core feature that
    // already worked), a contact form with no working send path has no
    // fallback behavior worth quietly no-oping.
    throw new HttpError(500, "Contact form is not configured yet");
  }

  const { name, email, message } = parsed.data;

  const { error: sendError } = await resend.emails.send({
    from: env.resendFromEmail,
    to: env.contactRecipientEmail,
    replyTo: email,
    subject: `New contact form message from ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
  });

  if (sendError) {
    // The Resend SDK doesn't throw on API-level failures -- it returns
    // { data, error } even when the send fails. Ignoring that return value
    // means a failed send still looks like success to the caller.
    console.error("Resend failed to send contact form email", sendError);
    throw new HttpError(502, "Failed to send your message. Please try again.");
  }

  res.json({ success: true });
});