// The Cinematheque walk-in: a stylised real-time 3D video store at night, rendered offline frame by frame.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as T from './textures.js';
const { rr, rand, pick } = T;

const P = new URLSearchParams(location.search);
const W = +P.get('w') || 1920, H = +P.get('h') || 1080;
export const DURATION = 6, MOVE = 5;

await T.loadFonts();
RectAreaLightUniformsLib.init();

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05040f');
scene.fog = new THREE.FogExp2('#0d0a26', 0.016);
const camera = new THREE.PerspectiveCamera(46, W / H, 0.05, 120);

// ---------- environment (for glossy reflections) ----------
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 6, 30), new THREE.MeshBasicMaterial({ color: '#0d0b2a', side: THREE.BackSide })));
  const em = (c, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i) });
  for (let z = -12; z <= 12; z += 4) for (const x of [-4, 0, 4]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), em('#d9d4ff', 4)); m.position.set(x, 2.9, z); m.rotation.x = Math.PI / 2; env.add(m); }
  for (const x of [-9.8, 9.8]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 30), em('#ff4fb8', 3)); m.position.set(x, 0.5, 0); env.add(m); }
  const c = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 0.1), em('#7ee6ff', 3)); c.position.set(0, 2, -14.8); env.add(c);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.03).texture;
  scene.environmentIntensity = 0.55;
}

// ---------- materials ----------
const M = {
  white: new THREE.MeshPhysicalMaterial({ color: '#f1efff', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.18 }),
  whiteMatte: new THREE.MeshStandardMaterial({ color: '#e6e3f7', roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: '#0a0918', roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: '#c9c6e0', roughness: 0.25, metalness: 1 }),
  neonPink: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4fb8').multiplyScalar(2.6) }),
  neonCyan: new THREE.MeshBasicMaterial({ color: new THREE.Color('#7ee6ff').multiplyScalar(4) }),
  panel: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ddd8ff').multiplyScalar(2.0) }),
};
const peg = (w, h) => { const t = T.makePegboard(); t.repeat.set(w / 0.25, h / 0.25); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }); };
const box = (w, h, d, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
const plane = (w, h, mat, x, y, z, rx = 0, ry = 0, parent = scene) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m; };

// ---------- VHS tapes ----------
// Real covers when covers/ has been fetched (fetch-covers.mjs), otherwise invented ones.
const real = await fetch('/covers/covers.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
const loader = new THREE.TextureLoader();
const covers = real?.length
  ? await Promise.all(real.map(async (c) => {
    const t = await loader.loadAsync(`/covers/${c.file}`);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return { cover: t, ...T.makeSpine(t.image, c.title, c.year) };
  }))
  : Array.from({ length: 64 }, (_, i) => T.makeCover(i));
const NCOV = covers.length;
const posterTex = (i) => (real?.length ? covers[(i * 7 + 3) % NCOV].cover : T.makePoster(i));
// Poster-shaped boxes (2:3), so the real covers aren't squashed.
const tapeGeo = new THREE.BoxGeometry(0.127, 0.19, 0.03);
tapeGeo.translate(0, 0.095, 0);
const tapeMats = covers.map((c) => {
  const front = new THREE.MeshPhysicalMaterial({ map: c.cover, roughness: 0.55, clearcoat: 0.9, clearcoatRoughness: 0.22 });
  const spine = new THREE.MeshPhysicalMaterial({ map: c.spine, roughness: 0.55, clearcoat: 0.9, clearcoatRoughness: 0.22 });
  const edge = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.6 });
  return [spine, spine, edge, edge, front, edge];
});
const tapeLists = covers.map(() => []);
// Covers are dealt in a shuffled order, so the same one never sits twice in a row.
const order = covers.map((_, i) => i).sort(() => rand() - 0.5);
let dealt = 0;
const nextCover = () => order[dealt++ % NCOV];
// The new releases wall shows the store's own titles first (covers.json lists them first).
let wall = 0;
const wallCover = () => wall++ % NCOV;
const dummy = new THREE.Object3D();
// A row of face-out tapes. (x0,z0) start, dir along the shelf, rotY = facing, y = board top.
function tapeRow(x0, z0, dx, dz, len, y, rotY, opts = {}) {
  const step = opts.step || 0.148;
  const n = Math.floor(len / step);
  for (let k = 0; k < n; k++) {
    if (rand() < (opts.gap ?? 0.07)) continue;
    const s = (k + 0.5) * step + rr(-0.006, 0.006);
    dummy.position.set(x0 + dx * s, y, z0 + dz * s);
    dummy.rotation.set(0, 0, 0); dummy.rotateY(rotY + rr(-0.03, 0.03)); dummy.rotateX(-rr(0.05, 0.13));
    dummy.updateMatrix();
    tapeLists[opts.deck ? opts.deck() : nextCover()].push(dummy.matrix.clone());
  }
}
function flushTapes() {
  tapeLists.forEach((list, i) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(tapeGeo, tapeMats[i], list.length);
    list.forEach((m, k) => im.setMatrixAt(k, m));
    scene.add(im);
  });
}

// Neon strip under a shelf front edge + a soft pink spill card over the tapes below.
const spillTex = T.makeSpill();
const spillMat = new THREE.MeshBasicMaterial({ map: spillTex, color: new THREE.Color('#ff4fb8').multiplyScalar(0.14), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
function neonUnder(x, y, z, len, rotY, drop = 0.3) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
  box(len, 0.012, 0.012, M.neonPink, 0, -0.022, 0, g);
  const s = plane(len, drop, spillMat, 0, -0.03 - drop / 2, 0.012, 0, 0, g);
  s.renderOrder = 2;
}

// Shelf unit facing +z in local space (group rotated into place). Boards with tapes and neon.
function shelfUnit(x, z, rotY, len, tiers, height, depth = 0.3, opts = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scene.add(g);
  box(len, height, 0.03, opts.back || M.whiteMatte, 0, height / 2, -depth / 2, g);
  box(len, 0.12, depth, M.white, 0, 0.06, 0, g);
  for (const sx of [-len / 2, len / 2]) box(0.04, height, depth, M.white, sx, height / 2, 0, g);
  box(len + 0.04, 0.05, depth + 0.02, M.white, 0, height + 0.02, 0, g);
  const wp = new THREE.Vector3(), dir = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY));
  for (const ty of tiers) {
    box(len, 0.025, depth, M.white, 0, ty, 0, g);
    box(len, 0.045, 0.012, M.white, 0, ty + 0.01, depth / 2, g); // lip
    g.localToWorld(wp.set(0, ty, depth / 2 + 0.006));
    neonUnder(wp.x, wp.y, wp.z, len - 0.04, rotY, opts.drop || 0.28);
    const start = g.localToWorld(new THREE.Vector3(-len / 2 + 0.03, ty + 0.0125, 0.02));
    tapeRow(start.x, start.z, dir.x, dir.z, len - 0.06, start.y, rotY, opts);
  }
  return g;
}

// ---------- the interior ----------
const IN = { x: 4.5, z0: -0.3, z1: -14.3, h: 3.2 };
const LEN = IN.z0 - IN.z1;
{
  const carpet = T.makeCarpet(); carpet.repeat.set(9 / 1.4, LEN / 1.4);
  const floor = plane(9, LEN, new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }), 0, 0, (IN.z0 + IN.z1) / 2, -Math.PI / 2);
  const ceil = T.makeCeiling(); ceil.repeat.set(9 / 0.6, LEN / 0.6);
  plane(9, LEN, new THREE.MeshStandardMaterial({ map: ceil, roughness: 0.9 }), 0, IN.h, (IN.z0 + IN.z1) / 2, Math.PI / 2);
  const tl = T.makeTiles();
  const tileMat = (w, h) => { const m = tl.map.clone(), b = tl.bump.clone(); m.repeat.set(w / 1.2, h / 1.2); b.repeat.set(w / 1.2, h / 1.2); m.needsUpdate = b.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: m, bumpMap: b, bumpScale: 1.5, roughness: 0.28 }); };
  plane(LEN, IN.h, tileMat(LEN, IN.h), -IN.x, IN.h / 2, (IN.z0 + IN.z1) / 2, 0, Math.PI / 2);
  plane(LEN, IN.h, tileMat(LEN, IN.h), IN.x, IN.h / 2, (IN.z0 + IN.z1) / 2, 0, -Math.PI / 2);
  plane(9, IN.h, tileMat(9, IN.h), 0, IN.h / 2, IN.z1, 0, 0);
  // pink crown neon along the walls
  for (const sx of [-1, 1]) box(0.03, 0.03, LEN, M.neonPink, sx * (IN.x - 0.05), IN.h - 0.12, (IN.z0 + IN.z1) / 2);
  box(9, 0.03, 0.03, M.neonPink, 0, IN.h - 0.12, IN.z1 + 0.05);

  // fluorescent panels + area lights
  for (const x of [-2.9, 0, 2.9]) for (let z = -1.6; z > IN.z1 + 0.6; z -= 2.4) {
    box(0.62, 0.03, 1.22, new THREE.MeshStandardMaterial({ color: '#cfcbe8', roughness: 0.4 }), x, IN.h - 0.012, z);
    plane(0.56, 1.16, M.panel, x, IN.h - 0.03, z, Math.PI / 2);
  }
  const area = (x, z, intensity, color = '#d6d0ff', w = 0.6, h = 1.2) => { const l = new THREE.RectAreaLight(color, intensity, w, h); l.position.set(x, IN.h - 0.04, z); l.lookAt(x, 0, z); scene.add(l); };
  for (const z of [-1.6, -6.4, -11.2]) area(0, z, 9);
  for (const z of [-4.0, -8.8, -13.6]) area(0, z, 7);
  for (const x of [-2.9, 2.9]) for (const z of [-4.0, -11.2]) area(x, z, 8);
  scene.add(new THREE.HemisphereLight('#7a6cff', '#2a1040', 0.35));

  // gondolas (double-sided island shelves)
  for (const gx of [-1.75, 1.75]) {
    const gz0 = -2.7, gz1 = -10.3, gl = gz0 - gz1, cz = (gz0 + gz1) / 2;
    shelfUnit(gx + 0.16, cz, Math.PI / 2, gl, [0.14, 0.46, 0.8, 1.14, 1.48], 1.72, 0.3);
    shelfUnit(gx - 0.16, cz, -Math.PI / 2, gl, [0.14, 0.46, 0.8, 1.14, 1.48], 1.72, 0.3);
    // end cap facing the door
    shelfUnit(gx, gz0 + 0.17, 0, 0.62, [0.14, 0.5, 0.86, 1.22], 1.5, 0.3, { step: 0.15 });
  }
  // wall shelving
  shelfUnit(-IN.x + 0.17, -7.7, Math.PI / 2, 11.6, [0.14, 0.5, 0.86, 1.22, 1.58, 1.94], 2.2, 0.32, { back: peg(11.6, 2.2) });
  shelfUnit(IN.x - 0.17, -9.0, -Math.PI / 2, 9.0, [0.14, 0.5, 0.86, 1.22, 1.58, 1.94], 2.2, 0.32, { back: peg(9, 2.2) });
  // the new releases wall (back): two long shelves + base cabinet
  {
    const g = shelfUnit(0, IN.z1 + 0.17, 0, 8.4, [0.1, 0.44, 0.78, 1.12, 1.46], 1.75, 0.32, { gap: 0.02, step: 0.142, drop: 0.26, deck: wallCover, back: peg(8.4, 1.75) });
  }
  // back wall signs
  const video = T.makeNeonText('VIDEO', 'Big Shoulders', 300, '#7ee6ff', 1400, 380, { weight: 900 });
  const vm = new THREE.MeshBasicMaterial({ map: video, color: new THREE.Color(1, 1, 1).multiplyScalar(1.05), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  plane(2.2, 0.6, vm, 0, 2.82, IN.z1 + 0.04);
  const scr = T.makeNeonText('Cinematheque', 'Mr Dafoe', 220, '#ff4fb8', 1500, 360, { dy: 10 });
  plane(2.3, 0.55, new THREE.MeshBasicMaterial({ map: scr, color: new THREE.Color(1, 1, 1).multiplyScalar(1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 2.38, IN.z1 + 0.05);
  for (const [x, i] of [[-2.7, 21], [2.7, 22], [-3.85, 23], [3.85, 24]]) { const g = new THREE.Group(); g.position.set(x, 2.45, IN.z1 + 0.03); scene.add(g); box(0.62, 0.86, 0.03, M.dark, 0, 0, 0, g); plane(0.56, 0.8, new THREE.MeshPhysicalMaterial({ map: posterTex(i), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }), 0, 0, 0.017, 0, 0, g); }
  const nr = T.makeNeonText('NEW RELEASES', 'Big Shoulders', 150, '#7ee6ff', 1600, 240, { weight: 800 });
  plane(1.8, 0.27, new THREE.MeshBasicMaterial({ map: nr, color: new THREE.Color(1, 1, 1).multiplyScalar(1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 1.98, IN.z1 + 0.04);
  const backGlow = new THREE.RectAreaLight('#7ee6ff', 6, 2.6, 0.5); backGlow.position.set(0, 2.7, IN.z1 + 0.2); backGlow.lookAt(0, 1.4, 0); scene.add(backGlow);
  // hanging category signs over the side aisles
  const cats = [['HORROR', '#ff4fb8', -3.1, -5], ['SCI-FI', '#7ee6ff', 3.1, -6.2], ['ACTION', '#ff9a5c', -3.1, -9.2], ['COMEDY', '#ffe38a', 3.1, -10.4], ['DRAMA', '#b9b2ff', 0, -6.0]];
  for (const [txt, col, x, z] of cats) {
    const t = T.makeNeonText(txt, 'Bungee', 110, col, 720, 200);
    const g = new THREE.Group(); g.position.set(x, 2.5, z); scene.add(g);
    box(1.0, 0.3, 0.04, M.dark, 0, 0, 0, g);
    const mm = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1, 1, 1).multiplyScalar(1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    plane(0.96, 0.27, mm, 0, 0, 0.022, 0, 0, g); plane(0.96, 0.27, mm, 0, 0, -0.022, 0, Math.PI, g);
    for (const sx of [-0.4, 0.4]) box(0.006, IN.h - 2.5, 0.006, M.metal, sx, (IN.h - 2.5) / 2 + 0.15, 0, g);
  }
  // framed posters above the wall shelves
  let pi = 0;
  for (const side of [-1, 1]) for (let z = -2.6; z > IN.z1 + 1; z -= 1.75) {
    if (side === 1 && z > -4.4) continue;
    const g = new THREE.Group(); g.position.set(side * (IN.x - 0.03), 2.68, z); g.rotation.y = -side * Math.PI / 2; scene.add(g);
    box(0.62, 0.86, 0.03, M.dark, 0, 0, 0, g);
    plane(0.56, 0.8, new THREE.MeshPhysicalMaterial({ map: posterTex(pi++), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }), 0, 0, 0.017, 0, 0, g);
  }
  // counter (front right) with a CRT and a register
  {
    const g = new THREE.Group(); g.position.set(3.25, 0, -2.6); scene.add(g);
    box(1.0, 1.0, 2.6, new THREE.MeshPhysicalMaterial({ color: '#2a2370', roughness: 0.4, clearcoat: 0.5 }), 0, 0.5, 0, g);
    box(1.12, 0.05, 2.72, new THREE.MeshPhysicalMaterial({ color: '#141026', roughness: 0.2, clearcoat: 1 }), 0, 1.025, 0, g);
    box(0.012, 0.012, 2.6, M.neonCyan, -0.505, 0.94, 0, g);
    box(0.012, 0.012, 2.6, M.neonPink, -0.505, 0.1, 0, g);
    const crt = new THREE.Group(); crt.position.set(0.05, 1.05, 0.7); crt.rotation.y = -0.9; g.add(crt);
    box(0.5, 0.42, 0.45, new THREE.MeshStandardMaterial({ color: '#222031', roughness: 0.5 }), 0, 0.21, 0, crt);
    const scr = document.createElement('canvas'); scr.width = 256; scr.height = 192; const sc = scr.getContext('2d');
    ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'].forEach((c, i) => { sc.fillStyle = c; sc.fillRect(i * 256 / 7, 0, 256 / 7 + 1, 140); });
    sc.fillStyle = '#101030'; sc.fillRect(0, 140, 256, 52);
    plane(0.4, 0.3, new THREE.MeshBasicMaterial({ map: T.tex(scr), color: new THREE.Color(1, 1, 1).multiplyScalar(1.6) }), 0, 0.22, 0.226, 0, 0, crt);
    box(0.34, 0.2, 0.3, new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.5 }), 0, 1.15, -0.5, g);
    const cl = new THREE.PointLight('#9ad8ff', 1.2, 2.5, 2); cl.position.set(-0.4, 1.35, 0.9); g.add(cl);
  }
  // arcade cabinet (front left)
  {
    const g = new THREE.Group(); g.position.set(-3.85, 0, -1.25); g.rotation.y = 0.55; scene.add(g);
    const body = new THREE.MeshPhysicalMaterial({ color: '#170f3a', roughness: 0.35, clearcoat: 0.7 });
    box(0.7, 1.85, 0.75, body, 0, 0.925, 0, g);
    const scr = document.createElement('canvas'); scr.width = 256; scr.height = 200; const sc = scr.getContext('2d');
    sc.fillStyle = '#050418'; sc.fillRect(0, 0, 256, 200);
    for (let i = 0; i < 60; i++) { sc.fillStyle = pick(['#ff4fb8', '#7ee6ff', '#ffe38a', '#7cff9e']); sc.fillRect(rr(10, 246), rr(10, 190), 6, 6); }
    sc.fillStyle = '#ffe38a'; sc.font = '28px "VT323"'; sc.fillText('HI 099990', 70, 30);
    const s = plane(0.5, 0.4, new THREE.MeshBasicMaterial({ map: T.tex(scr), color: new THREE.Color(1, 1, 1).multiplyScalar(1.8) }), 0, 1.35, 0.33, -0.25, 0, g);
    const mq = T.makeNeonText('STARFALL', 'Audiowide', 90, '#ff4fb8', 600, 150);
    plane(0.62, 0.16, new THREE.MeshBasicMaterial({ map: mq, color: new THREE.Color(1, 1, 1).multiplyScalar(2.2), transparent: true }), 0, 1.75, 0.38, 0, 0, g);
    box(0.7, 0.06, 0.3, body, 0, 1.02, 0.45, g);
    const al = new THREE.PointLight('#ff4fb8', 0.8, 2.2, 2); al.position.set(0, 1.4, 0.7); g.add(al);
  }
}
flushTapes();

// ---------- storefront and street ----------
const doors = [];
{
  const brick = T.makeBrick();
  const bm = (w, h) => { const t = brick.clone(); t.repeat.set(w / 1.5, h / 1.5); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }); };
  const fz = -0.15, th = 0.3;
  const wall = (x0, x1, y0, y1) => box(x1 - x0, y1 - y0, th, bm(x1 - x0, y1 - y0), (x0 + x1) / 2, (y0 + y1) / 2, fz);
  wall(-6.5, -5.2, 0, 5.2); wall(5.2, 6.5, 0, 5.2);
  wall(-1.3, -0.95, 0, 2.7); wall(0.95, 1.3, 0, 2.7);
  wall(-5.2, -1.3, 0, 0.5); wall(1.3, 5.2, 0, 0.5);
  wall(-5.2, 5.2, 2.7, 5.2);
  // white trim
  box(13, 0.08, 0.36, M.white, 0, 2.72, fz + 0.02); box(13, 0.06, 0.36, M.white, 0, 5.2, fz);
  for (const x of [-5.2, -1.3, 1.3, 5.2]) box(0.05, 2.2, 0.32, M.white, x, 1.6, fz);
  // glass windows
  const glass = new THREE.MeshPhysicalMaterial({ color: '#b8c4ff', transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, envMapIntensity: 2.2, depthWrite: false });
  plane(3.9, 2.2, glass, -3.25, 1.6, fz + 0.05); plane(3.9, 2.2, glass, 3.25, 1.6, fz + 0.05);
  // OPEN neon in the right window, posters in the left one
  const open = T.makeNeonText('OPEN', 'Bungee', 140, '#ff4fb8', 600, 220, { outline: 10 });
  plane(0.9, 0.33, new THREE.MeshBasicMaterial({ map: open, color: new THREE.Color(1, 1, 1).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 3.6, 2.15, fz - 0.06);
  const pl = new THREE.PointLight('#ff4fb8', 1.5, 3, 2); pl.position.set(3.6, 2.1, 0.4); scene.add(pl);
  for (const [x, i] of [[-4.2, 3], [-2.4, 7]]) plane(0.7, 1.0, new THREE.MeshStandardMaterial({ map: posterTex(i), roughness: 0.5 }), x, 1.55, fz - 0.07);
  // doors: glass in white frames, hinged at the outer edges
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.93, 0, fz); scene.add(pivot);
    const d = new THREE.Group(); d.position.x = -side * 0.46; pivot.add(d);
    box(0.9, 0.06, 0.05, M.white, 0, 0.03, 0, d); box(0.9, 0.06, 0.05, M.white, 0, 2.37, 0, d);
    box(0.06, 2.4, 0.05, M.white, -0.42, 1.2, 0, d); box(0.06, 2.4, 0.05, M.white, 0.42, 1.2, 0, d);
    box(0.8, 0.14, 0.05, M.white, 0, 0.13, 0, d);
    plane(0.8, 2.12, glass, 0, 1.25, 0.0, 0, 0, d);
    box(0.62, 0.035, 0.035, M.metal, 0, 1.05, 0.07, d);
    const hours = T.makeNeonText('OPEN LATE', 'VT323', 60, '#ffffff', 400, 100);
    if (side === 1) plane(0.34, 0.085, new THREE.MeshBasicMaterial({ map: hours, transparent: true, opacity: 0.8 }), 0, 1.6, 0.03, 0, 0, d);
    doors.push({ pivot, side });
  }
  // the sign: cyan VIDEO block letters over the pink script name
  box(6.2, 1.9, 0.12, new THREE.MeshStandardMaterial({ color: '#07061a', roughness: 0.95 }), 0, 3.9, 0.08);
  box(6.3, 0.03, 0.03, M.neonPink, 0, 4.87, 0.15); box(6.3, 0.03, 0.03, M.neonPink, 0, 2.93, 0.15);
  const vid = T.makeNeonText('VIDEO', 'Big Shoulders', 300, '#7ee6ff', 1500, 360, { weight: 900 });
  plane(3.6, 0.86, new THREE.MeshBasicMaterial({ map: vid, color: new THREE.Color(1, 1, 1).multiplyScalar(1.15), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 4.33, 0.16);
  const name = T.makeNeonText('Cinematheque', 'Mr Dafoe', 220, '#ff4fb8', 1500, 360, { dy: 10 });
  plane(4.2, 1.0, new THREE.MeshBasicMaterial({ map: name, color: new THREE.Color(1, 1, 1).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 3.5, 0.17);
  const s1 = new THREE.RectAreaLight('#7ee6ff', 10, 3.6, 0.6); s1.position.set(0, 4.3, 0.4); s1.lookAt(0, 0, 4); scene.add(s1);
  const s2 = new THREE.RectAreaLight('#ff4fb8', 10, 4, 0.6); s2.position.set(0, 3.4, 0.4); s2.lookAt(0, 0, 4); scene.add(s2);

  // sidewalk (wet, reflective) and street
  const con = T.makeConcrete(); con.map.repeat.set(14 / 2.4, 6 / 2.4); con.rough.repeat.set(14 / 2.4, 6 / 2.4);
  const refl = new Reflector(new THREE.PlaneGeometry(14, 6), { textureWidth: W / 2, textureHeight: H / 2, color: '#8a86a8', clipBias: 0.003 });
  refl.rotation.x = -Math.PI / 2; refl.position.set(0, 0.0, 3); scene.add(refl);
  const walk = plane(14, 6, new THREE.MeshStandardMaterial({ map: con.map, roughness: 0.85, alphaMap: con.rough, transparent: true, opacity: 1 }), 0, 0.004, 3, -Math.PI / 2);
  walk.material.alphaMap.repeat.copy(con.map.repeat);
  box(14, 0.15, 0.25, new THREE.MeshStandardMaterial({ color: '#3a3850', roughness: 0.8 }), 0, 0.0, 6.1);
  plane(40, 30, new THREE.MeshStandardMaterial({ color: '#0b0a14', roughness: 0.35 }), 0, -0.06, 21, -Math.PI / 2);
  // neighbours, dark
  box(8, 7, 0.3, bm(8, 7), -10.5, 3.5, -0.4); box(8, 7, 0.3, bm(8, 7), 10.5, 3.5, -0.4);
  plane(1.4, 1.6, new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a2260').multiplyScalar(1.2) }), -9.5, 3.8, -0.24);
  plane(1.4, 1.6, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36b').multiplyScalar(0.5) }), 9.2, 4.6, -0.24);
  // street lamp
  const lamp = new THREE.Group(); lamp.position.set(-5.4, 0, 5.4); scene.add(lamp);
  box(0.1, 4.6, 0.1, M.dark, 0, 2.3, 0, lamp); box(0.9, 0.08, 0.08, M.dark, 0.4, 4.55, 0, lamp);
  box(0.4, 0.06, 0.22, new THREE.MeshBasicMaterial({ color: new THREE.Color('#c9c2ff').multiplyScalar(4) }), 0.8, 4.49, 0, lamp);
  const ll = new THREE.SpotLight('#a99cff', 40, 14, 0.9, 0.6, 2); ll.position.set(-4.6, 4.45, 5.4); ll.target.position.set(-3.5, 0, 3.5); scene.add(ll, ll.target);
  // sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.MeshBasicMaterial({ map: T.makeSky(), side: THREE.BackSide, fog: false }));
  scene.add(sky);
}

// ---------- dust in the light ----------
const dust = (() => {
  const N = 900, pos = new Float32Array(N * 3), base = [];
  for (let i = 0; i < N; i++) base.push([rr(-3.5, 3.5), rr(0.3, 3), rr(-13.5, -0.8), rr(0, 6.28), rr(0.02, 0.06)]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ size: 0.012, map: T.makeRadial('rgba(255,255,255,1)'), color: new THREE.Color('#e8e2ff').multiplyScalar(1.2), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m); scene.add(pts);
  return (t) => { base.forEach(([x, y, z, ph, sp], i) => { pos[i * 3] = x + Math.sin(t * 0.3 + ph) * 0.08; pos[i * 3 + 1] = y + Math.sin(t * sp * 6 + ph) * 0.05 - t * sp * 0.2; pos[i * 3 + 2] = z + Math.cos(t * 0.25 + ph) * 0.08; }); g.attributes.position.needsUpdate = true; };
})();

// ---------- post ----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, W, H);
gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.2 });
gtao.blendIntensity = 0.9;
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.45, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(W, H));
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, seed: { value: 0 }, res: { value: new THREE.Vector2(W, H) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float seed; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + seed) * 43758.5453); }
    void main(){
      vec2 c = vUv - .5; float r2 = dot(c,c);
      vec2 off = c * r2 * 0.006;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= mix(1.0, 0.55, smoothstep(0.08, 0.55, r2 * 1.6));
      col = mix(col, col * vec3(1.02, 0.98, 1.06), 0.6);
      col += (h(vUv * res) - .5) * 0.035;
      gl_FragColor = vec4(col, 1.);
    }`,
});
composer.addPass(grade);

// ---------- camera path ----------
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.5, 1.62, 7.6), new THREE.Vector3(0.22, 1.62, 3.4), new THREE.Vector3(0.0, 1.6, 0.4),
  new THREE.Vector3(0, 1.56, -2.6), new THREE.Vector3(0, 1.5, -6.6), new THREE.Vector3(0, 1.42, -10.2), new THREE.Vector3(0, 1.2, -12.75),
], false, 'centripetal');
const F = (x) => -Math.cos(Math.PI * (0.12 + 0.88 * x)) / (0.88 * Math.PI);
const ease = (x) => (F(x) - F(0)) / (F(1) - F(0));
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

window.renderAt = (t) => {
  const x = Math.min(1, t / MOVE), u = ease(x);
  const p = path.getPointAt(u);
  const still = sm(0.85, 1, x);
  const sway = 1 - still;
  camera.position.set(p.x + Math.sin(t * 1.3) * 0.012 * sway, p.y + Math.sin(t * 2.1) * 0.006 * sway, p.z);
  const ty = THREE.MathUtils.lerp(2.35, 1.2, sm(0, 0.75, u));
  camera.lookAt(p.x * 0.25, ty, IN.z1);
  camera.rotateZ(Math.sin(t * 0.9) * 0.004 * sway);
  const open = sm(3.4, 1.2, p.z);
  for (const d of doors) d.pivot.rotation.y = d.side * -open * 1.5;
  dust(t);
  grade.uniforms.seed.value = (t * 37.13) % 100;
  composer.render();
};
window.DURATION = DURATION;
window.ready = true;
