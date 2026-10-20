// Step 6 of the Garten redesign: on a given screen, nothing overlaps (flower, bubble, tab bar,
// buttons) and no text is cut off. Returns a list of problems (empty = fine).
export async function layoutAudit(page) {
  return page.evaluate(() => {
    const issues = [];
    const W = innerWidth;
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) return false;
      // Inside a closed <details> (but not its summary): not on screen.
      const closed = el.closest("details:not([open])");
      if (closed && !el.closest("summary")) return false;
      for (let e = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0 || e.hidden || e.inert) return false;
      }
      return true;
    };
    const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    const meet = (a, b, pad = 1) => a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad;
    // The active page only – Next keeps the last ones mounted but hidden.
    const root = [...document.querySelectorAll("main[data-screen]")].find(shown) ?? document.body;
    const nav = document.querySelector('nav[aria-label="Hauptmenü"]');
    const navTop = nav && shown(nav) ? nav.getBoundingClientRect().top : innerHeight;

    // 1) Text cut off: its own box is too small (without an ellipsis), it leaves the screen
    //    sideways, or an ancestor that does not scroll clips it.
    for (const el of root.querySelectorAll("*")) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!shown(el) || el.closest("svg,[aria-hidden=true]")) continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const ellipsis = s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none";
      if (!ellipsis && s.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1) issues.push(`text too wide: "${name(el)}"`);
      if (r.left < -1 || r.right > W + 1) issues.push(`text off screen: "${name(el)}"`);
      for (let a = el.parentElement; a && a !== root; a = a.parentElement) {
        const as = getComputedStyle(a);
        if (as.overflow === "visible") continue;
        if (/auto|scroll/.test(as.overflowY + as.overflowX)) break;
        const ar = a.getBoundingClientRect();
        if (!(a.contains(el) && (r.bottom > ar.bottom + 2 || r.top < ar.top - 2 || r.right > ar.right + 2 || r.left < ar.left - 2))) continue;
        if (!ellipsis) issues.push(`text clipped: "${name(el)}"`);
        break;
      }
    }
    // 2) Buttons and links on top of each other, or under the tab bar while the page does not scroll.
    // What is actually visible of a box: cut by every ancestor that clips (a list scrolled past it).
    const seen = (el) => {
      const r = el.getBoundingClientRect();
      let { left, top, right, bottom } = r;
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (getComputedStyle(a).overflow === "visible") continue;
        const ar = a.getBoundingClientRect();
        left = Math.max(left, ar.left); top = Math.max(top, ar.top); right = Math.min(right, ar.right); bottom = Math.min(bottom, ar.bottom);
      }
      return { left, top, right, bottom };
    };
    const all = [...root.querySelectorAll("button, a, input, [role=radio]")].filter((el) => shown(el));
    const cut = all.map(seen);
    const hits = all.filter((_, i) => cut[i].right - cut[i].left > 2 && cut[i].bottom - cut[i].top > 2);
    const rects = cut.filter((c) => c.right - c.left > 2 && c.bottom - c.top > 2);
    for (let i = 0; i < hits.length; i++) {
      for (let j = i + 1; j < hits.length; j++) {
        if (hits[i].contains(hits[j]) || hits[j].contains(hits[i])) continue;
        // A control laid over a card (the ⋯ on a wishlist row) sits wholly inside it – by design.
        const inside = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
        if (inside(rects[i], rects[j]) || inside(rects[j], rects[i])) continue;
        if (meet(rects[i], rects[j], 2)) issues.push(`overlap: "${name(hits[i])}" × "${name(hits[j])}"`);
      }
    }
    // The big circle of the tab bar (Beet) reaches up into the page: nothing may sit under it.
    const circle = nav && [...nav.querySelectorAll("a")].map((a) => a.getBoundingClientRect()).find((r) => r.top < navTop - 4);
    // …unless it scrolls: then it passes under the circle and the page's bottom padding lets it out.
    const scrollsAway = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(a).overflowY) && a.scrollHeight > a.clientHeight + 1) return true;
      }
      return false;
    };
    if (circle) {
      for (const el of root.querySelectorAll("*")) {
        if (!shown(el) || el.children.length || !el.textContent.trim() || scrollsAway(el)) continue;
        if (meet(seen(el), circle, 2)) issues.push(`under the big circle: "${name(el)}"`);
      }
      for (let i = 0; i < hits.length; i++) if (!scrollsAway(hits[i]) && meet(rects[i], circle, 2)) issues.push(`under the big circle: "${name(hits[i])}"`);
    }
    const scrolls = root.scrollHeight > root.clientHeight + 1;
    for (let i = 0; i < hits.length; i++) if (rects[i].bottom > navTop + 1) issues.push(`under the tab bar: "${name(hits[i])}"`);
    // 3) The Beet: the bubble stays on screen and clear of the header, headline, week bar and the
    //    action; the flower stays above the action.
    const speech = root.querySelector("[data-speech]");
    if (speech && shown(speech)) {
      const b = speech.getBoundingClientRect();
      if (b.left < -1 || b.right > W + 1) issues.push("bubble off screen");
      for (const sel of ["h2", "[data-week-bar]", "header", "[data-next-step] > :last-child"]) {
        const o = root.querySelector(sel);
        if (o && shown(o) && meet(b, o.getBoundingClientRect())) issues.push(`bubble × ${sel}`);
      }
    }
    const bloom = root.querySelector("[data-next-step] [data-bloom]");
    const cta = root.querySelector("[data-next-step] > :last-child");
    if (bloom && cta && shown(bloom) && cta.getBoundingClientRect().height > 0 && bloom.getBoundingClientRect().bottom > cta.getBoundingClientRect().top + 2) issues.push("flower × action");
    return { issues: [...new Set(issues)], scrolls };
  });
}
