import { getUnreadNotificationCount } from "@/lib/account";
import { SiteHeader } from "@/components/site-header";

export async function SiteHeaderWrapper({
  inner = false,
}: {
  inner?: boolean;
}) {
  let unreadNotifications = 0;

  try {
    unreadNotifications = await getUnreadNotificationCount();
  } catch {
    unreadNotifications = 0;
  }

  return (
    <SiteHeader
      inner={inner}
      unreadNotifications={unreadNotifications}
    />
  );
}