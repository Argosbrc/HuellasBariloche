import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

type PushDelivery = {
  endpoint: string;
  p256dh: string;
  auth: string;
  push_title: string;
  push_body: string;
  push_link: string;
};

export async function deliverMessagePush(messageId: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  const admin = createAdminClient();

  if (!publicKey || !privateKey || !subject || !admin) return 0;

  const { data, error } = await admin.rpc(
    "claim_message_push_delivery_v1",
    {
      p_message_id: messageId,
    }
  );

  if (error || !Array.isArray(data) || data.length === 0) {
    return 0;
  }

  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey
  );

  const deliveries = await Promise.allSettled(
    (data as PushDelivery[]).map((item) =>
      webpush.sendNotification(
        {
          endpoint: item.endpoint,
          keys: {
            p256dh: item.p256dh,
            auth: item.auth,
          },
        },
        JSON.stringify({
          title: item.push_title,
          body: item.push_body,
          url: item.push_link,
          tag: `message-${messageId}`,
        }),
        {
          TTL: 86400,
          urgency: "high",
        }
      )
    )
  );

  return deliveries.filter(
    (delivery) => delivery.status === "fulfilled"
  ).length;
}