import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SubmittedAlert = {
  pet_post_id?: unknown;
  alert_kind?: unknown;
  location_text?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  message?: unknown;
  contact_phone?: unknown;
  contact_social?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coordinate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

async function deliverPush(
  alertId: string,
  dispatchToken: string,
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return 0;
  const admin = createAdminClient();
  if (!admin) return 0;

  const { data, error } = await admin.rpc("claim_pet_sighting_push_delivery_v1", {
    p_alert_id: alertId,
    p_dispatch_token: dispatchToken,
  });
  if (error || !Array.isArray(data) || data.length === 0) return 0;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const deliveries = await Promise.allSettled(data.map((item: Record<string, string>) => webpush.sendNotification(
    { endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } },
    JSON.stringify({ title: item.push_title, body: item.push_body, url: item.push_link, tag: `pet-sighting-${alertId}` }),
    { TTL: 3600, urgency: "high" },
  )));
  return deliveries.filter((delivery) => delivery.status === "fulfilled").length;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Solicitud no permitida." }, { status: 403 });

  let body: SubmittedAlert;
  try {
    body = await request.json() as SubmittedAlert;
  } catch {
    return NextResponse.json({ message: "Los datos enviados no son válidos." }, { status: 400 });
  }

  const petPostId = text(body.pet_post_id);
  const alertKind = text(body.alert_kind);
  const locationText = text(body.location_text);
  const latitude = coordinate(body.latitude);
  const longitude = coordinate(body.longitude);
  const message = text(body.message);
  const contactPhone = text(body.contact_phone);
  const contactSocial = text(body.contact_social);

  if (!/^[0-9a-f-]{36}$/i.test(petPostId) || !["sighting", "sheltered"].includes(alertKind)) {
    return NextResponse.json({ message: "El caso o el tipo de aviso no es válido." }, { status: 400 });
  }
  if (locationText.length < 3 || locationText.length > 180 || message.length < 8 || message.length > 1200) {
    return NextResponse.json({ message: "Completá el lugar y una descripción útil del aviso." }, { status: 400 });
  }
  if (alertKind === "sheltered" && !contactPhone && !contactSocial) {
    return NextResponse.json({ message: "Si lo tenés a resguardo, dejá un teléfono o una red social para poder coordinar." }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const reporterKey = createHash("sha256").update(`${forwarded}|${userAgent}`).digest("hex");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_pet_sighting_alert_v1", {
    p_pet_post_id: petPostId,
    p_alert_kind: alertKind,
    p_location_text: locationText,
    p_latitude: latitude,
    p_longitude: longitude,
    p_message: message,
    p_contact_phone: contactPhone || null,
    p_contact_social: contactSocial || null,
    p_reporter_key: reporterKey,
  });

  if (error) return NextResponse.json({ message: error.message || "No se pudo enviar el aviso." }, { status: 400 });
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.alert_id || !result?.dispatch_token) {
    return NextResponse.json({ message: "No se pudo confirmar el aviso." }, { status: 500 });
  }

  await deliverPush(result.alert_id, result.dispatch_token).catch(() => 0);
  return NextResponse.json({ message: "El aviso fue enviado. La persona que publicó el caso ya puede verlo en su panel." });
}
