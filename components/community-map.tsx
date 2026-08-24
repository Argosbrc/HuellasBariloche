"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import L, { type LatLngExpression } from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  BellRing,
  Cat,
  Crosshair,
  Dog,
  LocateFixed,
  MapPin,
  PawPrint,
  ShieldCheck,
} from "lucide-react";
import type { PublicPetCase } from "@/lib/types";

type MapPetCase = PublicPetCase & { imageUrl: string | null };

const BARILOCHE_CENTER: LatLngExpression = [-41.1335, -71.3103];
const BARILOCHE_ZOOM = 12;

type MapFilter = "all" | "lost" | "found" | "adoption";
type UserPosition = { lat: number; lng: number } | null;

const filters: Array<{ value: MapFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "lost", label: "Perdidos" },
  { value: "found", label: "Encontrados" },
  { value: "adoption", label: "Adopción" },
];

function hasPublicPosition(item: PublicPetCase) {
  return (
    typeof item.public_latitude === "number" &&
    Number.isFinite(item.public_latitude) &&
    typeof item.public_longitude === "number" &&
    Number.isFinite(item.public_longitude)
  );
}

function statusMeta(postType: string) {
  if (postType === "lost") return { label: "Perdido", className: "lost", color: "#ef7768" };
  if (postType === "found") return { label: "Encontrado", className: "found", color: "#5594a4" };
  return { label: "En adopción", className: "adoption", color: "#e9aa43" };
}

function markerIcon(item: MapPetCase, selected: boolean) {
  const meta = statusMeta(item.post_type);
  const marker = document.createElement("span");
  marker.className = `community-marker community-marker-${meta.className}${selected ? " is-selected" : ""}`;
  // Keep the marker bounded even before the stylesheet finishes loading.
  // Remote pet photos can be very large, so relying only on image CSS can
  // briefly render them at their intrinsic dimensions over the map.
  Object.assign(marker.style, {
    width: "42px",
    height: "42px",
    minWidth: "42px",
    minHeight: "42px",
    maxWidth: "42px",
    maxHeight: "42px",
    boxSizing: "border-box",
  });
  if (item.imageUrl) {
    const image = document.createElement("img");
    image.src = item.imageUrl;
    image.alt = "";
    Object.assign(image.style, {
      width: "100%",
      height: "100%",
      minWidth: "0",
      minHeight: "0",
      maxWidth: "100%",
      maxHeight: "100%",
      display: "block",
      borderRadius: "50%",
      objectFit: "cover",
    });
    marker.appendChild(image);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "community-marker-fallback";
    fallback.textContent = item.species?.toLowerCase().includes("gat") ? "🐱" : "🐶";
    marker.appendChild(fallback);
  }
  return L.divIcon({
    className: "community-marker-wrap",
    html: marker,
    iconSize: [46, 52],
    iconAnchor: [23, 49],
    popupAnchor: [0, -46],
  });
}

function MapViewport({
  visibleCases,
  activeCase,
  userPosition,
  resetKey,
}: {
  visibleCases: MapPetCase[];
  activeCase: MapPetCase | null;
  userPosition: UserPosition;
  resetKey: number;
}) {
  const map = useMap();
  const handledReset = useRef(resetKey);

  useEffect(() => {
    if (userPosition) {
      map.flyTo([userPosition.lat, userPosition.lng], 15, { duration: 0.8 });
      return;
    }
    if (activeCase && hasPublicPosition(activeCase)) {
      map.flyTo(
        [activeCase.public_latitude as number, activeCase.public_longitude as number],
        Math.max(map.getZoom(), 15),
        { duration: 0.7 },
      );
      return;
    }
    if (resetKey !== handledReset.current) {
      handledReset.current = resetKey;
      map.flyTo(BARILOCHE_CENTER, BARILOCHE_ZOOM, { duration: 0.8 });
      return;
    }

    const positions = visibleCases.filter(hasPublicPosition).map(
      (item) => [item.public_latitude as number, item.public_longitude as number] as [number, number],
    );
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [55, 55], maxZoom: 14 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 14);
    } else {
      map.setView(BARILOCHE_CENTER, BARILOCHE_ZOOM);
    }
  }, [activeCase, map, resetKey, userPosition, visibleCases]);

  return null;
}

export function CommunityMap({ cases, embedded = false }: { cases: MapPetCase[]; embedded?: boolean }) {
  const [filter, setFilter] = useState<MapFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const visibleCases = useMemo(
    () => cases.filter((item) => filter === "all" || item.post_type === filter),
    [cases, filter],
  );
  const mappedCases = useMemo(() => visibleCases.filter(hasPublicPosition), [visibleCases]);
  const activeCase = visibleCases.find((item) => item.id === activeId) ?? null;

  function changeFilter(value: MapFilter) {
    setFilter(value);
    setActiveId(null);
    setUserPosition(null);
  }

  function locateUser() {
    if (!navigator.geolocation) {
      setLocationMessage("Tu navegador no permite obtener la ubicación.");
      return;
    }
    setLocationMessage("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setActiveId(null);
        setUserPosition({ lat: coords.latitude, lng: coords.longitude });
        setLocationMessage("Tu ubicación se usa solo para centrar este mapa.");
      },
      () => setLocationMessage("No se pudo acceder a tu ubicación. Podés navegar el mapa manualmente."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <section className={embedded ? "map-workspace home-map-workspace" : "map-workspace"}>
      {embedded && <div className="embedded-map-toolbar">
        <div>
          <span className="section-kicker">Mapa comunitario</span>
          <strong>{mappedCases.length === 1 ? "1 caso en el mapa" : `${mappedCases.length} casos en el mapa`}</strong>
        </div>
        <div className="map-filter-row" aria-label="Filtrar casos del mapa">
          {filters.map((item) => (
            <button
              className={filter === item.value ? "active" : ""}
              key={item.value}
              onClick={() => changeFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>}

      {!embedded && <aside className="map-sidebar">
        <span className="section-kicker">Mapa comunitario</span>
        <h1>Casos en Bariloche</h1>
        <p>Acercá, alejás o mové el mapa para ubicar calles y barrios. Los puntos de los casos son aproximados.</p>

        <div className="privacy-note">
          <ShieldCheck size={18} />
          <span>
            <strong>Privacidad por diseño</strong>
            <small>Nunca mostramos la coordenada exacta informada por la persona.</small>
          </span>
        </div>

        <div className="map-filter-row" aria-label="Filtrar casos">
          {filters.map((item) => (
            <button
              className={filter === item.value ? "active" : ""}
              key={item.value}
              onClick={() => changeFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="map-results-count">
          <strong>{visibleCases.length}</strong>
          <span>{visibleCases.length === 1 ? "caso visible" : "casos visibles"}</span>
        </div>

        <div className="map-case-list">
          {visibleCases.map((item) => {
            const meta = statusMeta(item.post_type);
            const Icon = item.species?.toLowerCase().includes("gat") ? Cat : Dog;
            return (
              <button
                className={`map-case${activeId === item.id ? " active" : ""}`}
                key={item.id}
                onClick={() => {
                  setUserPosition(null);
                  setActiveId(item.id);
                  setLocationMessage(null);
                }}
                type="button"
              >
                <span className={`map-case-photo ${meta.className}`}>
                  {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Icon size={16} />}
                </span>
                <span>
                  <strong>{item.name || "Sin nombre"}</strong>
                  <small><MapPin size={11} />{item.zone_name || item.city_name}</small>
                  {!hasPublicPosition(item) && <em>Sin punto público</em>}
                </span>
              </button>
            );
          })}
          {visibleCases.length === 0 && (
            <div className="map-list-empty"><PawPrint size={22} /><span>No hay casos en esta categoría.</span></div>
          )}
        </div>
      </aside>}

      <div className={`real-map real-map-interactive${embedded ? " embedded-real-map" : ""}`} aria-label="Mapa interactivo de casos en San Carlos de Bariloche">
        <MapContainer
          center={BARILOCHE_CENTER}
          className="map-canvas"
          maxZoom={19}
          minZoom={9}
          scrollWheelZoom
          zoom={BARILOCHE_ZOOM}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {mappedCases.map((item) => {
            const meta = statusMeta(item.post_type);
            const position: [number, number] = [
              item.public_latitude as number,
              item.public_longitude as number,
            ];
            return (
              <Fragment key={item.id}>
                <Circle
                  center={position}
                  color={meta.color}
                  fillColor={meta.color}
                  fillOpacity={0.08}
                  opacity={0.45}
                  radius={180}
                  weight={1}
                />
                <Marker
                  eventHandlers={{ click: () => setActiveId(item.id) }}
                  icon={markerIcon(item, activeId === item.id)}
                  position={position}
                >
                  <Popup>
                    <div className="map-popup">
                      {item.imageUrl && <img className="map-popup-photo" src={item.imageUrl} alt={item.name || "Mascota publicada"} />}
                      <span className={`map-popup-status ${meta.className}`}>{meta.label}</span>
                      <strong>{item.name || "Sin nombre"}</strong>
                      <small><MapPin size={12} />{item.zone_name || item.city_name}</small>
                      <p>Ubicación pública aproximada.</p>
                      <a className="map-popup-link" href={`/casos/${item.id}`}>Ver ficha y contactar</a>
                    </div>
                  </Popup>
                </Marker>
              </Fragment>
            );
          })}

          {userPosition && (
            <>
              <Circle
                center={[userPosition.lat, userPosition.lng]}
                color="#176f61"
                fillColor="#5fb4a5"
                fillOpacity={0.1}
                radius={90}
                weight={1}
              />
              <CircleMarker
                center={[userPosition.lat, userPosition.lng]}
                color="#ffffff"
                fillColor="#176f61"
                fillOpacity={1}
                radius={9}
                weight={4}
              >
                <Popup>Tu ubicación actual. No se guarda ni se publica.</Popup>
              </CircleMarker>
            </>
          )}

          <MapViewport
            activeCase={activeCase}
            resetKey={resetKey}
            userPosition={userPosition}
            visibleCases={mappedCases}
          />
        </MapContainer>

        <div className="map-brand-control"><MapPin size={15} /><strong>San Carlos de Bariloche</strong></div>
        <button className="locate-control" onClick={locateUser} type="button">
          <Crosshair size={20} /><span>Mi ubicación</span>
        </button>
        <button
          className="bariloche-control"
          onClick={() => {
            setActiveId(null);
            setUserPosition(null);
            setLocationMessage(null);
            setResetKey((value) => value + 1);
          }}
          type="button"
        >
          <LocateFixed size={18} /><span>Ver Bariloche</span>
        </button>

        {locationMessage && <div className="map-location-message" role="status">{locationMessage}</div>}

        <div className="map-legend">
          <span><i className="lost" />Perdidos</span>
          <span><i className="found" />Encontrados</span>
          <span><i className="adoption" />Adopción</span>
        </div>

        <div className={`map-alert-floating${embedded ? " embedded-alert" : ""}`}>
          <BellRing size={18} />
          <div><strong>Alertas de 3 o 5 km</strong><small>Tu ubicación exacta no se publica</small></div>
          <a className="button button-light" href="/panel#alertas-cercanas">Activar</a>
        </div>

        {cases.length === 0 && (
          <div className="map-empty"><PawPrint size={34} /><strong>El mapa espera su primer caso</strong></div>
        )}
      </div>
    </section>
  );
}
