import { clamp } from "./math.js";
import { reducedMotion } from "./scroll.js";

const ZOOM_OUT = [
  { transform: "scale(1)", opacity: 1 },
  { transform: "scale(0.86)", opacity: 0 },
];
const ZOOM_IN = [
  { transform: "scale(0.94)", opacity: 0 },
  { transform: "scale(1)", opacity: 1 },
];

/**
 * A deck of résumé cards shown one at a time in a single box. Changing the
 * card zooms the box out, swaps the text (and optionally hops the box to a
 * new spot) while it's invisible, then zooms back in. Requests that arrive
 * mid-swap collapse to the latest one, so fast scrolling reads as clean cuts.
 *
 * spots: optional (i, narrow) => [nx, ny] - where the box sits for card i,
 *        as fractions of the panel's free space.
 */
export function createDeck({ panel, card, cards, render, pips, spots }) {
  const box = document.createElement("div");
  box.className = "card__box";
  card.appendChild(box);
  const slides = cards.map((c, i) => {
    const el = document.createElement("article");
    el.className = "slide";
    el.innerHTML = render(c, i);
    box.appendChild(el);
    return el;
  });
  if (pips) pips.innerHTML = slides.map(() => "<i></i>").join("");

  let target = -1; // the card the scroll position calls for
  let shown = -1; // the card actually in the box
  let swapping = false;

  function place(i) {
    if (!spots || i < 0) return;
    const narrow = panel.clientWidth < 700;
    const m = narrow ? 12 : 28;
    const [nx, ny] = spots(i, narrow);
    const freeX = Math.max(0, panel.clientWidth - card.offsetWidth - m * 2);
    const freeY = Math.max(0, panel.clientHeight - card.offsetHeight - m * 2);
    card.style.transform = `translate(${(m + clamp(nx) * freeX).toFixed(1)}px, ${(m + Math.min(ny * panel.clientHeight, freeY)).toFixed(1)}px)`;
  }

  function show(i) {
    slides.forEach((el, k) => el.classList.toggle("is-active", k === i));
    if (pips) [...pips.children].forEach((pip, k) => pip.classList.toggle("is-on", k <= i));
    shown = i;
    place(i);
  }

  async function run() {
    if (swapping) return; // the running loop picks up the latest target
    swapping = true;
    while (target !== -1 && shown !== target) {
      if (shown !== -1 && !reducedMotion) {
        await box.animate(ZOOM_OUT, { duration: 140, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }).finished;
      }
      show(target);
      if (!reducedMotion) {
        await box.animate(ZOOM_IN, { duration: 220, easing: "cubic-bezier(0,0,.2,1)", fill: "forwards" }).finished;
      }
    }
    swapping = false;
  }

  return {
    set(i) {
      if (i === target) return;
      target = i;
      run();
    },
    /** Re-place the box for the current card (after a resize). */
    place: () => place(shown),
    get current() {
      return target;
    },
    get count() {
      return slides.length;
    },
  };
}
