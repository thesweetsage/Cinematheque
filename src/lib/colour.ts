/** Lift an accent colour so it reads as neon on the dark store wall. */
export function brighten(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const H = (h * 60 + 360) % 360, L = Math.max(l, 0.62), S = Math.max(d ? d / (1 - Math.abs(2 * l - 1)) : 0, 0.6);
  const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((H / 60) % 2) - 1)), m = L - c / 2;
  const [rr, gg, bb] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [rr, gg, bb].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("");
}
