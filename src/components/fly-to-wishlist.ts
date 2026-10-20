"use client";

/**
 * A liked card sends a pink ♥ to the Ideen tab, which gives a little jump when it lands:
 * the wishlist visibly grows. Nothing happens with reduced motion; the vibration (Android only)
 * is a short double tap.
 */
export function flyToWishlist(from: DOMRect): void {
  try {
    navigator.vibrate?.([12, 40, 12]);
  } catch {
    // vibration is a bonus
  }
  if (typeof document === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const icons = [...document.querySelectorAll<HTMLElement>('[data-header-icon="wishlist"]')].filter((el) => el.offsetParent !== null);
  const target = icons[0]?.getBoundingClientRect();
  if (!target) return;
  const x0 = from.left + from.width / 2;
  const y0 = from.top + from.height / 2;
  const x1 = target.left + target.width / 2;
  const y1 = target.top + target.height / 2;
  const heart = document.createElement("div");
  heart.textContent = "♥";
  heart.setAttribute("aria-hidden", "true");
  Object.assign(heart.style, { position: "fixed", left: `${x0}px`, top: `${y0}px`, fontSize: "48px", lineHeight: "1", color: "#E58FA6", pointerEvents: "none", zIndex: "60", willChange: "transform, opacity" });
  document.body.appendChild(heart);
  const flight = heart.animate(
    [
      { transform: "translate(-50%, -50%) scale(0.5)", opacity: 0 },
      { transform: "translate(-50%, -50%) scale(1.5)", opacity: 1, offset: 0.25 },
      { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(0.45)`, opacity: 0.9 },
    ],
    { duration: 620, easing: "cubic-bezier(0.25, 0.8, 0.3, 1)" },
  );
  flight.onfinish = () => {
    heart.remove();
    icons[0].animate([{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 260, easing: "ease-out" });
  };
  flight.oncancel = () => heart.remove();
}
