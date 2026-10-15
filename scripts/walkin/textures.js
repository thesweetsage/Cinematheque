// Procedural textures: VHS covers and spines, posters, carpet, tiles, ceiling, concrete, signs.
import * as THREE from 'three';

let seed = 1337;
export const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
export const rr = (a, b) => a + rand() * (b - a);
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const FONTS = [
  ['Bungee', 'Bungee-Regular.ttf'], ['Mr Dafoe', 'MrDafoe-Regular.ttf'], ['Big Shoulders', 'BigShoulders.ttf'],
  ['VT323', 'VT323-Regular.ttf'], ['Anton', 'Anton-Regular.ttf'], ['Monoton', 'Monoton-Regular.ttf'],
  ['Abril', 'AbrilFatface-Regular.ttf'], ['Righteous', 'Righteous-Regular.ttf'], ['Russo', 'RussoOne-Regular.ttf'],
  ['BlackOps', 'BlackOpsOne-Regular.ttf'], ['Creepster', 'Creepster-Regular.ttf'], ['RubikMono', 'RubikMonoOne-Regular.ttf'],
  ['Playfair', 'Playfair.ttf'], ['Marker', 'PermanentMarker-Regular.ttf'], ['Audiowide', 'Audiowide-Regular.ttf'],
  ['Bebas', 'BebasNeue-Regular.ttf'], ['Oswald', 'Oswald.ttf'],
];
export async function loadFonts() {
  await Promise.all(FONTS.map(async ([name, file]) => {
    const f = new FontFace(name, `url(/fonts/${file})`, name === 'Big Shoulders' ? { weight: '100 900' } : {});
    await f.load(); document.fonts.add(f);
  }));
}

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
export const tex = (c, srgb = true, rep) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};

function grain(ctx, w, h, amt = 18) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rand() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}

// ---------- VHS covers ----------
const TITLES = [
  'NEON HARBOR', 'MIDNIGHT ARCADE', 'STATIC DREAMS', 'CHROME HEART', 'THE VELVET HOUR', 'MOTEL CRIMSON', 'PARALLAX',
  'LASER RANCH', 'HOLLOW PINES', 'DEAD AIR', 'STARFALL', 'KISS THE WIRE', 'OVERDRIVE', 'THE QUIET COAST', 'NIGHT SWIMMERS',
  'GHOST FREQUENCY', 'ROLLER QUEEN', 'BLUE ORCHID', 'TURBO SAINTS', 'THE LONG RERUN', 'CITY OF GLASS', 'SUNSET VIPERS',
  'POLAROID', 'THE BASEMENT', 'ORBITAL', 'HEATWAVE', 'MOONLIGHT MILE', 'SILVER CIRCUIT', 'WILD STATIC', 'PALM DISTRICT',
  'THE DROWNED', 'HIGH VOLTAGE', 'LAST CALL', 'VAPOR TRAIL', 'NOCTURNE', 'RED ALERT', 'THE GLASS EYE', 'SKATEBOARD SUMMER',
  'COLD FUSION', 'SATELLITE', 'THE HUSH', 'CANDY STRIPE', 'IRON TIDE', 'FAST LANE', 'MIRRORBALL', 'THE CELLAR DOOR',
  'ELECTRIC DESERT', 'LUNA PARK', 'DOUBLE FEATURE', 'NIGHTCRAWL', 'ZERO HOUR', 'THE TALL GRASS', 'PINK HORIZON',
  'GRAVEYARD SHIFT', 'TOKYO RAIN', 'CYBERDAWN', 'SUMMER STATIC', 'THE OUTLANDS', 'KILLER QUEEN', 'BLACKTOP',
  'SPECTRUM', 'THE WAITING ROOM', 'AFTERGLOW', 'RADIO SILENCE',
];
const PAL = [
  ['#0d0b2a', '#ff4fb8', '#7ee6ff'], ['#1a0510', '#ff3b3b', '#ffe38a'], ['#04121f', '#18c8ff', '#ffffff'], ['#2a0d3d', '#ff9a5c', '#ffe38a'],
  ['#f2ead8', '#d0261e', '#151515'], ['#000000', '#e8e8e8', '#d0261e'], ['#0a2a1c', '#7cff9e', '#ffe38a'], ['#ffe38a', '#e0185f', '#151239'],
  ['#3a0a2e', '#ffd166', '#ff4fb8'], ['#0b0920', '#b9b2ff', '#ff4fb8'], ['#102a52', '#ffcf5c', '#ff6a3d'], ['#ececec', '#1d4ed8', '#e11d48'],
  ['#1c1c1c', '#ff8a00', '#ffffff'], ['#00303b', '#ff6f91', '#f9f871'],
];

function motif(ctx, w, h, kind, p) {
  const [bg, a, b] = p;
  ctx.save();
  if (kind === 'sun') { // synthwave sun over grid
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg); g.addColorStop(0.55, a); g.addColorStop(1, bg); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const sg = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.6); sg.addColorStop(0, b); sg.addColorStop(1, a);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(w / 2, h * 0.52, w * 0.32, Math.PI, 0); ctx.fill();
    ctx.fillStyle = bg; for (let i = 0; i < 6; i++) ctx.fillRect(0, h * (0.44 + i * 0.016), w, 2 + i * 1.6);
    ctx.fillStyle = bg; ctx.fillRect(0, h * 0.52, w, h);
    ctx.strokeStyle = a; ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 8, h * 0.52); ctx.lineTo(w / 2 + i * 70, h); ctx.stroke(); }
    for (let i = 0; i < 9; i++) { const y = h * 0.52 + Math.pow(i / 9, 2) * h * 0.48; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  } else if (kind === 'moon') { // horror: moon + silhouette trees
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.6, h * 0.3, 5, w * 0.6, h * 0.3, w * 0.9); g.addColorStop(0, a); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(w * 0.6, h * 0.3, w * 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#000';
    for (let i = 0; i < 9; i++) { const x = rr(-20, w); const tw = rr(30, 70); ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + tw / 2, h * rr(0.35, 0.6)); ctx.lineTo(x + tw, h); ctx.fill(); }
    ctx.fillRect(0, h * 0.82, w, h);
  } else if (kind === 'burst') { // action explosion
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(10px)';
    for (let i = 0; i < 14; i++) { ctx.fillStyle = pick([a, b, '#fff3b0']); ctx.globalAlpha = rr(0.4, 0.9); ctx.beginPath(); ctx.arc(w / 2 + rr(-90, 90), h * 0.5 + rr(-90, 90), rr(30, 110), 0, 7); ctx.fill(); }
    ctx.filter = 'none'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.72, 38, 95, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(w * 0.5, h * 0.55, 22, 0, 7); ctx.fill();
  } else if (kind === 'portrait') { // drama: soft painted face shapes
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, bg); g.addColorStop(1, a); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(6px)';
    ctx.fillStyle = b; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(w * 0.42, h * 0.42, 70, 92, -0.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#000'; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(w * 0.64, h * 0.5, 64, 88, 0.15, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.fillStyle = bg; ctx.fillRect(0, h * 0.72, w, h);
    ctx.filter = 'none'; ctx.globalAlpha = 1;
  } else if (kind === 'stripes') { // comedy / teen: bold diagonal stripes
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-0.5);
    [a, b, a, b].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-w, -60 + i * 46, w * 2, 26); });
    ctx.restore();
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(w * 0.75, h * 0.25, 40, 0, 7); ctx.fill();
  } else if (kind === 'space') { // sci-fi: planet + stars
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,255,255,${rr(0.2, 1)})`; ctx.fillRect(rr(0, w), rr(0, h), rr(1, 2.5), rr(1, 2.5)); }
    const g = ctx.createRadialGradient(w * 0.35, h * 0.55, 10, w * 0.5, h * 0.62, w * 0.55); g.addColorStop(0, b); g.addColorStop(0.6, a); g.addColorStop(1, bg);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.66, w * 0.48, 0, 7); ctx.fill();
    ctx.strokeStyle = b; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.66, w * 0.7, 26, -0.2, 0, 7); ctx.stroke();
  } else if (kind === 'city') { // noir skyline with lit windows
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg); g.addColorStop(1, a); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let x = -10; x < w; x += rr(28, 60)) {
      const bh = rr(h * 0.25, h * 0.7), bw = rr(26, 55); ctx.fillStyle = '#05040f'; ctx.fillRect(x, h - bh, bw, bh);
      ctx.fillStyle = b; for (let wy = h - bh + 8; wy < h - 10; wy += 12) for (let wx = x + 4; wx < x + bw - 6; wx += 9) if (rand() < 0.35) ctx.fillRect(wx, wy, 4, 6);
    }
  } else { // 'type': typographic cover, big shape
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(0, h * 0.2); ctx.lineTo(w, h * 0.45); ctx.lineTo(w, h * 0.75); ctx.lineTo(0, h * 0.5); ctx.fill();
    ctx.strokeStyle = b; ctx.lineWidth = 6; ctx.strokeRect(24, 24, w - 48, h - 48);
  }
  ctx.restore();
}

function fitText(ctx, text, font, maxW, size) {
  let s = size; ctx.font = `${s}px "${font}"`;
  while (ctx.measureText(text).width > maxW && s > 10) { s -= 2; ctx.font = `${s}px "${font}"`; }
  return s;
}

export function makeCover(i) {
  const W = 320, H = 580;
  const [c, ctx] = canvas(W, H);
  const p = PAL[i % PAL.length];
  const kinds = ['sun', 'moon', 'burst', 'portrait', 'stripes', 'space', 'city', 'type'];
  const kind = kinds[(i * 5 + 3) % kinds.length];
  const framed = rand() < 0.35;
  const inset = framed ? 18 : 0;
  ctx.fillStyle = framed ? (rand() < 0.5 ? '#f4f1ea' : '#111') : p[0]; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.rect(inset, inset + 34, W - inset * 2, H - inset * 2 - 120); ctx.clip();
  ctx.translate(inset, inset + 34);
  motif(ctx, W - inset * 2, H - inset * 2 - 120, kind, p);
  ctx.restore();
  // top band (studio stripe)
  ctx.fillStyle = framed ? p[1] : '#000'; ctx.fillRect(inset, inset, W - inset * 2, 34);
  ctx.fillStyle = framed ? '#fff' : p[2]; ctx.font = '20px "VT323"'; ctx.textAlign = 'left'; ctx.fillText(pick(['HOME VIDEO', 'VIDEO CLASSICS', 'NIGHT SCREEN', 'STARLIGHT HOME VIDEO', 'PRISM VIDEO']), inset + 10, inset + 24);
  ctx.textAlign = 'right'; ctx.fillText('VHS', W - inset - 10, inset + 24);
  // title
  const fonts = ['Bungee', 'Anton', 'Monoton', 'Abril', 'Righteous', 'Russo', 'BlackOps', 'Creepster', 'RubikMono', 'Playfair', 'Audiowide', 'Bebas', 'Big Shoulders', 'Mr Dafoe', 'Marker'];
  const font = fonts[(i * 7) % fonts.length];
  const title = TITLES[i % TITLES.length];
  const words = title.split(' ');
  const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : (rand() < 0.5 && words.length === 2 ? words : [title]);
  ctx.textAlign = 'center';
  const ty = H - inset - 118 + (lines.length === 1 ? 52 : 34);
  lines.forEach((ln, k) => {
    const s = fitText(ctx, ln, font, W - inset * 2 - 26, lines.length === 1 ? 60 : 48);
    const y = ty + k * s * 0.98;
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(ln, W / 2, y);
    const g = ctx.createLinearGradient(0, y - s, 0, y);
    if (rand() < 0.4) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, p[2]); g.addColorStop(0.52, '#3b2a5c'); g.addColorStop(1, '#e8e8ff'); } else { g.addColorStop(0, p[2]); g.addColorStop(1, p[1]); }
    ctx.fillStyle = g; ctx.fillText(ln, W / 2, y);
  });
  // credit block
  ctx.fillStyle = framed ? '#777' : 'rgba(255,255,255,.45)';
  for (let k = 0; k < 3; k++) ctx.fillRect(W / 2 - 110 + k * 4, H - inset - 30 + k * 7, 220 - k * 8, 3);
  // sticker
  if (rand() < 0.3) {
    ctx.save(); ctx.translate(W - 62, 108); ctx.rotate(0.25);
    ctx.fillStyle = pick(['#ffe38a', '#ff4fb8', '#ff9a5c']); ctx.beginPath(); ctx.arc(0, 0, 36, 0, 7); ctx.fill();
    ctx.fillStyle = '#151239'; ctx.font = '16px "Bungee"'; ctx.textAlign = 'center'; ctx.fillText(pick(['NEW', 'HIT!', 'STAFF', '$2.99']), 0, 6);
    ctx.restore();
  }
  grain(ctx, W, H, 14);
  // spine
  const [sc, sctx] = canvas(64, 580);
  sctx.fillStyle = framed ? (rand() < 0.5 ? '#f4f1ea' : '#111') : p[0]; sctx.fillRect(0, 0, 64, 580);
  sctx.fillStyle = p[1]; sctx.fillRect(0, 0, 64, 60); sctx.fillRect(0, 540, 64, 40);
  sctx.save(); sctx.translate(40, 300); sctx.rotate(-Math.PI / 2); sctx.textAlign = 'center';
  const ss = fitText(sctx, title, 'Bungee', 420, 30); sctx.fillStyle = p[2]; sctx.fillText(title, 0, ss * 0.35); sctx.restore();
  grain(sctx, 64, 580, 10);
  return { cover: tex(c), spine: tex(sc), color: p[0] };
}

// ---------- posters for the walls ----------
export function makePoster(i) {
  const W = 512, H = 760;
  const [c, ctx] = canvas(W, H);
  const p = PAL[(i * 3 + 5) % PAL.length];
  motif(ctx, W, H, ['sun', 'space', 'city', 'moon', 'burst'][i % 5], p);
  ctx.textAlign = 'center';
  const t = TITLES[(i * 11 + 7) % TITLES.length];
  const s = fitText(ctx, t, ['Monoton', 'Bungee', 'Audiowide', 'Abril', 'Anton'][i % 5], W - 60, 80);
  ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText(t, W / 2, 120);
  ctx.fillStyle = p[2]; ctx.fillText(t, W / 2, 120);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 4; k++) ctx.fillRect(80, H - 70 + k * 10, W - 160, 4);
  grain(ctx, W, H, 16);
  return tex(c);
}

// ---------- carpet: dark purple, magenta dots, yellow squiggles, purple triangles ----------
export function makeCarpet() {
  const S = 1024; const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#140c33'; ctx.fillRect(0, 0, S, S);
  const wrapDraw = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); } };
  const items = [];
  for (let i = 0; i < 26; i++) items.push(['tri', rr(0, S), rr(0, S), rr(0, 6.28)]);
  for (let i = 0; i < 22; i++) items.push(['sq', rr(0, S), rr(0, S), rr(0, 6.28)]);
  for (let i = 0; i < 90; i++) items.push(['dot', rr(0, S), rr(0, S), rr(5, 11)]);
  for (let i = 0; i < 20; i++) items.push(['ring', rr(0, S), rr(0, S), rr(0, 6.28)]);
  for (const [k, x, y, r] of items) wrapDraw(() => {
    ctx.save(); ctx.translate(x, y);
    if (k === 'tri') { ctx.rotate(r); ctx.fillStyle = pick(['#6d3cff', '#4b2bb8', '#2bd4e8']); ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(26, 18); ctx.lineTo(-26, 18); ctx.fill(); }
    else if (k === 'sq') { ctx.rotate(r); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); for (let t = 0; t <= 1; t += 0.05) { const px = -50 + t * 100, py = Math.sin(t * 12) * 12; t ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
    else if (k === 'dot') { ctx.fillStyle = '#ff3fae'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
    else { ctx.strokeStyle = '#2bd4e8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 16, r, r + 4); ctx.stroke(); }
    ctx.restore();
  });
  // fibre noise
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rand() - 0.5) * 40; d[i] = Math.max(0, d[i] * 0.85 + n); d[i + 1] = Math.max(0, d[i + 1] * 0.85 + n); d[i + 2] = Math.max(0, d[i + 2] * 0.85 + n); }
  ctx.putImageData(img, 0, 0);
  return tex(c, true, [1, 1]);
}

// ---------- navy tile wall: colour + roughness/bump ----------
export function makeTiles() {
  const S = 512, n = 8, t = S / n, g = 4;
  const [c, ctx] = canvas(S, S); const [b, bctx] = canvas(S, S);
  ctx.fillStyle = '#231d52'; ctx.fillRect(0, 0, S, S); bctx.fillStyle = '#000'; bctx.fillRect(0, 0, S, S);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = rr(-6, 6);
    ctx.fillStyle = `rgb(${22 + l},${18 + l},${66 + l * 1.5})`; ctx.fillRect(x * t + g / 2, y * t + g / 2, t - g, t - g);
    const gr = ctx.createLinearGradient(x * t, y * t, x * t + t, y * t + t); gr.addColorStop(0, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.08)');
    ctx.fillStyle = gr; ctx.fillRect(x * t + g / 2, y * t + g / 2, t - g, t - g);
    bctx.fillStyle = '#fff'; bctx.fillRect(x * t + g / 2, y * t + g / 2, t - g, t - g);
  }
  return { map: tex(c, true, [1, 1]), bump: tex(b, false, [1, 1]) };
}

export function makeCeiling() {
  const S = 512; const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#4a4670'; ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rand() - 0.5) * 30; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#d8d4ee'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, S, S);
  return tex(c, true, [1, 1]);
}

export function makeConcrete() {
  const S = 1024; const [c, ctx] = canvas(S, S); const [r, rctx] = canvas(S, S);
  ctx.fillStyle = '#2a2838'; ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rand() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#151320'; ctx.lineWidth = 4; for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(0, k * S / 4); ctx.lineTo(S, k * S / 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(k * S / 4, 0); ctx.lineTo(k * S / 4, S); ctx.stroke(); }
  // roughness: puddles are smooth (dark), dry is rough (light)
  rctx.fillStyle = '#c8c8c8'; rctx.fillRect(0, 0, S, S); rctx.filter = 'blur(24px)';
  for (let i = 0; i < 30; i++) { rctx.fillStyle = `rgba(10,10,10,${rr(0.6, 1)})`; rctx.beginPath(); rctx.ellipse(rr(0, S), rr(0, S), rr(40, 180), rr(25, 90), rr(0, 3), 0, 7); rctx.fill(); }
  rctx.filter = 'none';
  return { map: tex(c, true, [1, 1]), rough: tex(r, false, [1, 1]) };
}

export function makeBrick() {
  const S = 512; const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#0f0d24'; ctx.fillRect(0, 0, S, S);
  const bh = 32, bw = 96;
  for (let y = 0; y < S / bh; y++) for (let x = -1; x < S / bw + 1; x++) {
    const ox = (y % 2) * bw / 2, l = rr(-5, 5);
    ctx.fillStyle = `rgb(${34 + l},${28 + l},${62 + l})`; ctx.fillRect(x * bw + ox + 3, y * bh + 3, bw - 6, bh - 6);
  }
  grain(ctx, S, S, 16);
  return tex(c, true, [1, 1]);
}

// Neon sign: text drawn as glowing tubes on transparent canvas (used as emissive map).
export function makeNeonText(text, font, size, color, w, h, opts = {}) {
  const [c, ctx] = canvas(w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${opts.weight || ''} ${size}px "${font}"`;
  const x = w / 2, y = h / 2 + (opts.dy || 0);
  ctx.shadowColor = color; ctx.shadowBlur = size * 0.1; ctx.fillStyle = color;
  if (opts.outline) { ctx.lineWidth = opts.outline; ctx.strokeStyle = color; ctx.strokeText(text, x, y); ctx.shadowBlur = 0; ctx.lineWidth = opts.outline * 0.35; ctx.strokeStyle = '#ffffff'; ctx.strokeText(text, x, y); }
  else { ctx.fillText(text, x, y); ctx.shadowBlur = 0; ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffffff'; ctx.font = `${opts.weight || ''} ${size}px "${font}"`; ctx.lineWidth = Math.max(2, size * 0.05); ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.3; ctx.fillText(text, x, y); }
  return tex(c);
}

export function makeRadial(color) {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); return tex(c);
}

// Vertical glow card: strongest at the top, fading down (pink spill from a neon strip onto the tapes below).
export function makeSpill() {
  const [c, ctx] = canvas(8, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 128); return tex(c, false);
}

export function makeSky() {
  const [c, ctx] = canvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#02020a'); g.addColorStop(0.45, '#0b0a2a'); g.addColorStop(0.5, '#2a1850'); g.addColorStop(0.55, '#0b0a20'); g.addColorStop(1, '#030308');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 512); return tex(c);
}

export function makePegboard() {
  const S = 256; const [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#1d1848'; ctx.fillRect(0, 0, S, S);
  for (let y = 16; y < S; y += 32) for (let x = 16; x < S; x += 32) { ctx.fillStyle = '#07061a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
  grain(ctx, S, S, 10);
  return tex(c, true, [1, 1]);
}
