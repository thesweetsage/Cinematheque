"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import s from "./StoreRadio.module.css";

/* Store radio: three original synthwave instrumentals played live with Web Audio. Never autoplays. */
type Track = { name: string; bpm: number; key: number; prog: number[][]; bass: "oct" | "drive" | "slow"; arp: number[]; arp16: boolean; hat: number; open: number[]; kick: number[]; snare: number[] };
const TRACKS: Track[] = [
  { name: "Night Shift at Video World", bpm: 98, key: 57, prog: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]], bass: "oct", arp: [0, 1, 2, 4, 2, 1, 3, 1], arp16: false, hat: 2, open: [14], kick: [0, 8, 11], snare: [4, 12] },
  { name: "Rewind Drive", bpm: 116, key: 50, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], bass: "drive", arp: [0, 2, 4, 2, 1, 3, 5, 3], arp16: true, hat: 2, open: [6, 14], kick: [0, 4, 8, 12], snare: [4, 12] },
  { name: "Static Hearts", bpm: 78, key: 52, prog: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-5, -2, 2]], bass: "slow", arp: [3, 2, 1, 2], arp16: false, hat: 4, open: [], kick: [0, 10], snare: [8] },
];
const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Engine {
  ctx: AudioContext; out: GainNode; an: AnalyserNode; revIn: GainNode; dl: DelayNode; dlIn: GainNode; noise: AudioBuffer;
  timer = 0; next = 0; step = 0; track = 0;
  constructor(vol: number) {
    const ctx = (this.ctx = new AudioContext());
    this.out = ctx.createGain(); this.out.gain.value = vol * 0.55;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    this.an = ctx.createAnalyser(); this.an.fftSize = 64;
    this.out.connect(comp); comp.connect(this.an); this.an.connect(ctx.destination);
    const rev = ctx.createConvolver(), len = (ctx.sampleRate * 2.4) | 0, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir; this.revIn = ctx.createGain(); this.revIn.gain.value = 0.3; this.revIn.connect(rev); rev.connect(this.out);
    this.dl = ctx.createDelay(1); this.dlIn = ctx.createGain(); this.dlIn.gain.value = 0.4;
    const fb = ctx.createGain(); fb.gain.value = 0.36; const lp = ctx.createBiquadFilter(); lp.frequency.value = 2400;
    this.dlIn.connect(this.dl); this.dl.connect(lp); lp.connect(fb); fb.connect(this.dl); lp.connect(this.out); lp.connect(this.revIn); this.dlIn.connect(this.out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }
  vca(t: number, peak: number, a: number, d: number, dest: AudioNode = this.out) { const g = this.ctx.createGain(); g.gain.setValueAtTime(1e-4, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(1e-4, t + a + d); g.connect(dest); return g; }
  osc(type: OscillatorType, f: number) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  kick(t: number) { const o = this.osc("sine", 140); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13); o.connect(this.vca(t, 0.85, 0.003, 0.38)); o.start(t); o.stop(t + 0.45); }
  snare(t: number) {
    const n = this.ctx.createBufferSource(); n.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.7;
    const g = this.vca(t, 0.34, 0.002, 0.2); n.connect(f); f.connect(g); const send = this.ctx.createGain(); send.gain.value = 1.3; g.connect(send); send.connect(this.revIn); n.start(t); n.stop(t + 0.3);
    const o = this.osc("triangle", 190); o.connect(this.vca(t, 0.14, 0.002, 0.08)); o.start(t); o.stop(t + 0.15);
  }
  hat(t: number, open: boolean) { const n = this.ctx.createBufferSource(); n.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7600; n.connect(f); f.connect(this.vca(t, open ? 0.05 : 0.06, 0.001, open ? 0.28 : 0.035)); n.start(t); n.stop(t + 0.35); }
  bass(t: number, m: number, len: number) { const o = this.osc("sawtooth", mf(m)); const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 6; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + len); o.connect(f); f.connect(this.vca(t, 0.2, 0.005, len)); o.start(t); o.stop(t + len + 0.05); }
  pad(t: number, notes: number[], len: number) {
    for (const m of notes) for (const dt of [-7, 7]) {
      const o = this.osc("sawtooth", mf(m)); o.detune.value = dt; const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1300; const g = this.ctx.createGain();
      g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(0.02, t + 0.5); g.gain.setValueAtTime(0.02, t + len - 0.3); g.gain.linearRampToValueAtTime(1e-4, t + len + 0.4);
      o.connect(f); f.connect(g); g.connect(this.out); g.connect(this.revIn); o.start(t); o.stop(t + len + 0.5);
    }
  }
  arp(t: number, m: number) { const o = this.osc("square", mf(m)); const f = this.ctx.createBiquadFilter(); f.frequency.value = 2200; o.connect(f); f.connect(this.vca(t, 0.04, 0.003, 0.16, this.dlIn)); o.start(t); o.stop(t + 0.25); }
  tick = () => {
    const tr = TRACKS[this.track], sd = 60 / tr.bpm / 4;
    this.dl.delayTime.setValueAtTime(sd * 3, this.ctx.currentTime);
    while (this.next < this.ctx.currentTime + 0.15) {
      const pos = this.step % 16, bar = Math.floor(this.step / 16) % 4, loop = Math.floor(this.step / 64), ch = tr.prog[bar], t = this.next;
      const tones = [...ch, ...ch.map((x) => x + 12)];
      if (tr.kick.includes(pos)) this.kick(t);
      if (tr.snare.includes(pos) && (loop > 0 || bar > 0)) this.snare(t);
      if (pos % tr.hat === 0) this.hat(t, tr.open.includes(pos));
      let root = tr.key - 24 + ch[0]; if (root < 30) root += 12;
      if (tr.bass === "oct" && pos % 2 === 0) this.bass(t, root + (pos % 4 === 2 ? 12 : 0), sd * 1.8);
      if (tr.bass === "drive") this.bass(t, root + (pos % 8 === 6 ? 12 : 0), sd * 0.9);
      if (tr.bass === "slow" && (pos === 0 || pos === 8)) this.bass(t, root, sd * 7);
      if ((loop > 0 || bar > 1) && (tr.arp16 || pos % 2 === 0)) { const i = tr.arp16 ? pos : pos / 2; this.arp(t, tr.key + 12 + tones[tr.arp[i % tr.arp.length] % tones.length]); }
      if (pos === 0) this.pad(t, ch.map((x) => tr.key + x), sd * 16);
      this.next += sd; this.step++;
    }
  };
  start() { this.ctx.resume(); this.next = this.ctx.currentTime + 0.08; this.step = 0; clearInterval(this.timer); this.timer = window.setInterval(this.tick, 25); }
  stop() { clearInterval(this.timer); this.ctx.suspend(); }
}

function readVol() { try { const v = localStorage.getItem("cine_vol"); return v === null ? 0.6 : +v; } catch { return 0.6; } }
function watchVol(cb: () => void) { addEventListener("cine-vol", cb); return () => removeEventListener("cine-vol", cb); }

export function StoreRadio() {
  const eng = useRef<Engine | null>(null);
  const viz = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const [track, setTrack] = useState(0);
  const vol = useSyncExternalStore(watchVol, readVol, () => 0.6);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const draw = () => {
      const c = viz.current, e = eng.current;
      if (c && e) {
        const g = c.getContext("2d")!, d = new Uint8Array(e.an.frequencyBinCount); e.an.getByteFrequencyData(d);
        g.clearRect(0, 0, c.width, c.height); const n = 16, w = c.width / n;
        for (let i = 0; i < n; i++) { const v = d[i + 1] / 255; g.fillStyle = i < 10 ? "#ff4fb8" : "#7ee6ff"; g.fillRect(i * w + 1, c.height * (1 - v), w - 2, Math.max(1, c.height * v)); }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  const toggle = () => {
    if (on) { eng.current?.stop(); setOn(false); return; }
    eng.current ??= new Engine(vol);
    eng.current.track = track; eng.current.start(); setOn(true);
  };
  const next = () => { const t = (track + 1) % TRACKS.length; setTrack(t); if (eng.current) { eng.current.track = t; if (on) eng.current.start(); } };
  const changeVol = (v: number) => {
    if (eng.current) eng.current.out.gain.value = v * 0.55;
    try { localStorage.setItem("cine_vol", String(v)); } catch {}
    dispatchEvent(new Event("cine-vol"));
  };

  return (
    <div className={`${s.radio} ${on ? s.playing : ""}`} role="region" aria-label="Store radio" data-remote-last>
      <button className={s.cass} onClick={toggle} aria-label={on ? "Pause the store radio" : "Play the store radio"}>
        <span className={`${s.reel} ${s.l}`} /><span className={`${s.reel} ${s.r}`} /><span className={s.pl}>{on ? "❚❚" : "▶ PLAY"}</span>
      </button>
      <div className={s.info}>
        <div className={s.label}>STORE RADIO · {on ? "ON AIR" : "OFF"}</div>
        <div className={s.title}>{TRACKS[track].name}</div>
        <canvas ref={viz} className={s.viz} width={120} height={16} />
      </div>
      <div className={s.btns}>
        <button onClick={next} aria-label="Next track">⏭</button>
        <input className={s.vol} type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => changeVol(+e.target.value)} aria-label="Volume" />
      </div>
    </div>
  );
}
