// Referenz-Renderer für die Banner (Vanilla-JS, in React/Vue/Svelte 1:1 übertragbar).
// banners.json: { [key]: { name, bg, shapes: [{l,t,w,h,c,r,rot,op,clip}] } }
// Alle Maße beziehen sich auf eine feste Bühne von 350 × 110 px.

const STAGE_W = 350, STAGE_H = 110;

/** @param {HTMLElement} host  Container, bekommt width/height/overflow
 *  @param {object} banners   geladenes banners.json
 *  @param {string} key       Motiv-Schlüssel, z. B. 'yoga'
 *  @param {number} w         Breite der Zielfläche in px
 *  @param {number} h         Höhe der Zielfläche in px */
export function renderBanner(host, banners, key, w, h) {
  const m = banners[key] ?? banners.herz;               // Fallback
  const sc = Math.max(h / STAGE_H, w / STAGE_W);        // füllt die Fläche, nie Leerraum
  host.style.cssText = `position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${m.bg}`;
  const stage = document.createElement('div');
  // unten mittig verankert, seitlich beschnitten
  stage.style.cssText = `position:absolute;left:50%;bottom:0;width:${STAGE_W}px;height:${STAGE_H}px;` +
    `margin-left:${-STAGE_W / 2}px;transform:scale(${sc});transform-origin:50% 100%`;
  for (const s of m.shapes) {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${s.l}px;top:${s.t}px;width:${s.w}px;height:${s.h}px;` +
      `border-radius:${s.r};background:${s.c};transform:rotate(${s.rot}deg);opacity:${s.op};clip-path:${s.clip}`;
    stage.appendChild(d);
  }
  host.replaceChildren(stage);
}
