"use client";

import dynamic from "next/dynamic";
import type { PublicPetCase } from "@/lib/types";

export type MapPetCase = PublicPetCase & { imageUrl: string | null };

const CommunityMap = dynamic(
  () => import("@/components/community-map").then((module) => module.CommunityMap),
  {
    ssr: false,
    loading: () => (
      <section className="map-workspace map-loading" aria-live="polite">
        <div className="map-loading-card">
          <span className="map-loading-pulse" />
          <strong>Cargando el mapa de Bariloche…</strong>
        </div>
      </section>
    ),
  },
);

export function CommunityMapShell({ cases, embedded = false }: { cases: MapPetCase[]; embedded?: boolean }) {
  return <CommunityMap cases={cases} embedded={embedded} />;
}
