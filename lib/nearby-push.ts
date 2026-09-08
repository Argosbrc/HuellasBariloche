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

export async function deliverNearbyLostCasePush(petPostId: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  const admin = createAdminClient();

  if (!publicKey || !privateKey || !subject || !admin) {
    console.error("NEARBY PUSH CONFIG ERROR", {
      publicKey: !!publicKey,
      privateKey: !!privateKey,
      subject: !!subject,
      admin: !!admin,
    });

    return 0;
  }

  const { data, error } = await admin.rpc(
    "claim_nearby_lost_case_push_delivery_v1",
    {
      p_pet_post_id: petPostId,
    }
  );

  if (error) {
    console.error("NEARBY CLAIM ERROR", error);
    return 0;
  }

  if (!Array.isArray(data) || data.length === 0) {
    console.log("NO NEARBY PUSH DELIVERIES", {
      petPostId,
    });

    return 0;
  }

  console.log("NEARBY PUSH DELIVERIES FOUND", {
    petPostId,
    total: data.length,
    users: data.map((item) => item.endpoint),
  });


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
          tag: `nearby-lost-pet-${petPostId}`,
        }),
        {
          TTL: 86400,
          urgency: "high",
        }
      )
    )
  );


  console.log(
    "NEARBY PUSH RESULTS",
    deliveries.map((delivery) =>
      delivery.status === "fulfilled"
        ? {
            status: "fulfilled",
          }
        : {
            status: "rejected",
            reason:
              delivery.reason instanceof Error
                ? delivery.reason.message
                : delivery.reason,
          }
    )
  );


  return deliveries.filter(
    (delivery) => delivery.status === "fulfilled"
  ).length;
}