import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

interface UnsubscribeTokenPayload {
  shipmentId: string;
  email: string;
}

function sign(payloadBase64: string): string {
  return createHmac("sha256", env.unsubscribeTokenSecret).update(payloadBase64).digest("base64url");
}

export function signUnsubscribeToken(payload: UnsubscribeTokenPayload): string {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload | null {
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) {
    return null;
  }

  const expectedSignature = sign(payloadBase64);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payloadBase64, "base64url").toString()) as UnsubscribeTokenPayload;
  } catch {
    return null;
  }
}