import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AgroGestión 360",
    short_name: "AgroGestión",
    description: "Administración de proyectos agrícolas: bitácoras de campo, inventarios, producción, ventas y rentabilidad.",
    lang: "es-MX",
    dir: "ltr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6fbf3",
    theme_color: "#1d5b3a",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Captura en campo", short_name: "Campo", url: "/campo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Bitácoras", url: "/bitacoras", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Producción", url: "/produccion", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
