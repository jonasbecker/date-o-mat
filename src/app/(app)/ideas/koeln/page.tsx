import { permanentRedirect } from "next/navigation";

// The Köln ideas now come as cards in the swipe deck (and under "Was anderes …" when planning).
export default function KoelnPage() {
  permanentRedirect("/ideas/entdecken");
}
