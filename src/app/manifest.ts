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
    background_color: "#111a14",
    theme_color: "#111a14",
    lang: "de",
    categories: ["lifestyle", "productivity"],
    // Android: "Teilen → Date-O-Mat" in TikTok, Instagram, YouTube … turns the link into an idea.
    share_target: { action: "/share", method: "GET", params: { title: "title", text: "text", url: "url" } },
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
