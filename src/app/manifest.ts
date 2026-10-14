import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Date-O-Mat",
    short_name: "Date-O-Mat",
    description: "Damit aus „wir sollten mal wieder …“ ein echtes Date wird.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff6ec",
    theme_color: "#fff6ec",
    lang: "de",
    categories: ["lifestyle", "productivity"],
    shortcuts: [
      { name: "Date planen", url: "/plan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Wunschliste", url: "/ideas", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
