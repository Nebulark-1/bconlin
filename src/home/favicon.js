// The browser tab's icon is a live, 32-pixel copy of the home page: the
// same 400 points, redrawn a few times a second. Switch views and the tab
// changes with it, even while you're looking at another tab.

const SIZE = 32;

/**
 * Draw the points into a 32 × 32 canvas, fitted to their bounding box, as
 * strings (joined) or dots, whichever the page is showing more of.
 */
export function drawFavicon(ctx, pts, colors, strings) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (!strings && p.a < 0.05) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const k = (SIZE - 6) / span;
  const ox = SIZE / 2 - ((minX + maxX) / 2) * k;
  const oy = SIZE / 2 - ((minY + maxY) / 2) * k;

  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = "#05051a";
  ctx.beginPath();
  ctx.roundRect(0, 0, SIZE, SIZE, 7);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let n = 0; n < pts.length; n++) {
    const p = pts[n];
    if (strings && n % 100 !== 0) {
      ctx.globalAlpha = 0.9;
      const q = pts[n - 1];
      ctx.strokeStyle = colors[p.string];
      ctx.beginPath();
      ctx.moveTo(q.x * k + ox, q.y * k + oy);
      ctx.lineTo(p.x * k + ox, p.y * k + oy);
      ctx.stroke();
    } else if (!strings && p.a >= 0.05) {
      ctx.globalAlpha = Math.min(1, p.a + 0.2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x * k + ox - 0.7, p.y * k + oy - 0.7, 1.4, 1.4);
    }
  }
  ctx.globalAlpha = 1;
}

export function createFavicon() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  let last = 0;
  return {
    canvas,
    /** Redraw at most every `every` ms. */
    update(now, pts, colors, strings, every = 220) {
      if (now - last < every) return;
      last = now;
      drawFavicon(ctx, pts, colors, strings);
      link.href = canvas.toDataURL("image/png");
    },
  };
}
