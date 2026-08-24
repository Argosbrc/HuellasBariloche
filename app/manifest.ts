import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Huellas Bariloche",
    short_name: "Huellas",
    description: "Red solidaria para encontrar mascotas y conectar a la comunidad de Bariloche.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fffef9",
    theme_color: "#176b5b",
    lang: "es-AR",
    categories: ["social", "lifestyle", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Publicar mascota perdida",
        short_name: "Publicar",
        description: "Crear rápidamente un caso de mascota perdida",
        url: "/publicar?tipo=lost",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Ver mis alertas",
        short_name: "Mis alertas",
        description: "Abrir el panel de avisos y solicitudes",
        url: "/panel",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
