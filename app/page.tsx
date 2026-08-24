import { HomeClient } from "@/components/home-client";
import { getHomeData, storagePublicUrl } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { summary, cases, heroCases, mapCases } = await getHomeData();
  const publicCases = cases.data.map((item) => ({
    ...item,
    imageUrl: storagePublicUrl(
      "pet-photos",
      item.cover_image_path || item.photo_paths?.[0] || null,
    ),
  }));
  const publicHeroCases = heroCases.data.map((item) => ({
    ...item,
    imageUrl: storagePublicUrl(
      "pet-photos",
      item.cover_image_path || item.photo_paths?.[0] || null,
    ),
  }));
  const publicMapCases = mapCases.data.map((item) => ({
    ...item,
    imageUrl: storagePublicUrl(
      "pet-photos",
      item.cover_image_path || item.photo_paths?.[0] || null,
    ),
  }));
  return (
    <HomeClient
      publicCases={publicCases}
      heroCases={publicHeroCases}
      mapCases={publicMapCases}
      summary={summary.data}
      configured={summary.configured && cases.configured && heroCases.configured && mapCases.configured}
    />
  );
}
