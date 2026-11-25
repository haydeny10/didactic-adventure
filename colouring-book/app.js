'use strict';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- screens & toast ---------------- */
const SCREENS = ['home', 'make', 'colour'];
function show(id) {
  for (const s of SCREENS) $('#' + s).classList.toggle('active', s === id);
  if (id === 'colour') requestAnimationFrame(fitBoard);
  if (id === 'home') renderGallery();
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ---------------- storage (IndexedDB) ---------------- */
const DB = (() => {
  let dbp = null;
  function open() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('colour-my-photo', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('pages', { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  async function run(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction('pages', mode);
      const req = fn(tx.objectStore('pages'));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  return {
    put: (p) => run('readwrite', (s) => s.put(p)),
    all: () => run('readonly', (s) => s.getAll()),
    del: (id) => run('readwrite', (s) => s.delete(id)),
  };
})();

/* ---------------- photo -> line art ---------------- */
function boxBlur(a, w, h, r) {
  const t = new Float32Array(a.length);
  const d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let s = 0;
    for (let x = -r; x <= r; x++) s += a[o + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      t[o + x] = s / d;
      s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += t[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      a[y * w + x] = s / d;
      s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x];
    }
  }
}

function majority(lab, w, h, k) {
  const out = new Uint8Array(lab.length);
  const cnt = new Uint8Array(k);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      cnt.fill(0);
      for (let dy = -1; dy <= 1; dy++) {
        const yy = clamp(y + dy, 0, h - 1) * w;
        for (let dx = -1; dx <= 1; dx++) cnt[lab[yy + clamp(x + dx, 0, w - 1)]]++;
      }
      let best = lab[y * w + x], bc = cnt[best];
      for (let c = 0; c < k; c++) if (cnt[c] > bc) { bc = cnt[c]; best = c; }
      out[y * w + x] = best;
    }
  }
  return out;
}

function removeSmall(m, w, h, min) {
  const seen = new Uint8Array(m.length);
  const stack = new Int32Array(m.length);
  const comp = new Int32Array(m.length);
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || seen[i]) continue;
    let sp = 0, cn = 0;
    stack[sp++] = i; seen[i] = 1;
    while (sp) {
      const j = stack[--sp];
      comp[cn++] = j;
      const y = (j / w) | 0, x = j - y * w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const n = yy * w + xx;
          if (m[n] && !seen[n]) { seen[n] = 1; stack[sp++] = n; }
        }
      }
    }
    if (cn < min) for (let c = 0; c < cn; c++) m[comp[c]] = 0;
  }
}

function dilate(m, w, h, r) {
  const t = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let c = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) c += m[o + x];
    for (let x = 0; x < w; x++) {
      t[o + x] = c > 0 ? 1 : 0;
      if (x + r + 1 < w) c += m[o + x + r + 1];
      if (x - r >= 0) c -= m[o + x - r];
    }
  }
  for (let x = 0; x < w; x++) {
    let c = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) c += t[y * w + x];
    for (let y = 0; y < h; y++) {
      m[y * w + x] = c > 0 ? 1 : 0;
      if (y + r + 1 < h) c += t[(y + r + 1) * w + x];
      if (y - r >= 0) c -= t[(y - r) * w + x];
    }
  }
}

// Returns a Uint8Array mask (1 = black line). detail: 1 (simple) .. 10 (detailed)
function lineArt(src, detail) {
  const w = src.width, h = src.height, N = w * h;
  const px = src.getContext('2d').getImageData(0, 0, w, h).data;
  const t = (detail - 1) / 9;
  const sf = Math.max(w, h) / 1000;

  // 1. smooth the photo so we get shapes, not texture
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0; i < N; i++) { R[i] = px[i * 4]; G[i] = px[i * 4 + 1]; B[i] = px[i * 4 + 2]; }
  const br = Math.max(1, Math.round((6 - 5 * t) * sf));
  for (let p = 0; p < 2; p++) { boxBlur(R, w, h, br); boxBlur(G, w, h, br); boxBlur(B, w, h, br); }

  // 2. group colours into a few regions (k-means) -> closed shapes that fill nicely
  const k = Math.round(3 + 6 * t);
  const step = Math.max(1, Math.floor(N / 20000));
  const samples = [];
  for (let i = 0; i < N; i += step) samples.push(i);
  samples.sort((a, b) => (R[a] + G[a] + B[a]) - (R[b] + G[b] + B[b]));
  const C = [];
  for (let j = 0; j < k; j++) {
    const s = samples[Math.floor(((j + 0.5) / k) * samples.length)];
    C.push([R[s], G[s], B[s]]);
  }
  const nearest = (i) => {
    let best = 0, bd = Infinity;
    for (let c = 0; c < k; c++) {
      const dr = R[i] - C[c][0], dg = G[i] - C[c][1], db = B[i] - C[c][2];
      const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };
  for (let it = 0; it < 10; it++) {
    const sum = Array.from({ length: k }, () => [0, 0, 0, 0]);
    for (const i of samples) {
      const c = nearest(i);
      sum[c][0] += R[i]; sum[c][1] += G[i]; sum[c][2] += B[i]; sum[c][3]++;
    }
    for (let c = 0; c < k; c++) if (sum[c][3]) C[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
  }
  let lab = new Uint8Array(N);
  for (let i = 0; i < N; i++) lab[i] = nearest(i);
  lab = majority(lab, w, h, k);
  lab = majority(lab, w, h, k);

  // 3. strong edges for extra detail (eyes, outlines)
  const gray = new Float32Array(N);
  for (let i = 0; i < N; i++) gray[i] = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
  const mag = new Float32Array(N);
  let max = 1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1];
      const gy = gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1];
      const m = Math.abs(gx) + Math.abs(gy);
      mag[i] = m;
      if (m > max) max = m;
    }
  }
  const BINS = 1024, hist = new Uint32Array(BINS);
  for (let i = 0; i < N; i++) hist[Math.min(BINS - 1, ((mag[i] / max) * BINS) | 0)]++;
  const keep = N * (0.004 + 0.03 * t);
  let acc = 0, bin = BINS - 1;
  for (; bin > 0; bin--) { acc += hist[bin]; if (acc >= keep) break; }
  const thr = Math.max(60, (bin / BINS) * max);

  // 4. combine: region borders + strong edges
  const line = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((x < w - 1 && lab[i] !== lab[i + 1]) || (y < h - 1 && lab[i] !== lab[i + w]) || mag[i] > thr) line[i] = 1;
    }
  }

  // 5. tidy up: drop specks, then thicken lines
  removeSmall(line, w, h, Math.round((140 - 110 * t) * sf * sf) + 8);
  dilate(line, w, h, 1);
  return line;
}

function maskToImageData(mask, w, h, ctx) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) { d[i * 4] = 29; d[i * 4 + 1] = 29; d[i * 4 + 2] = 31; d[i * 4 + 3] = 255; }
  }
  return img;
}

function drawLinesOnWhite(canvas, mask, w, h) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  tmp.getContext('2d').putImageData(maskToImageData(mask, w, h, tmp.getContext('2d')), 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0);
}

/* ---------------- loading photos ---------------- */
const MAX_SIDE = 1200;
function toCanvas(source, w, h) {
  const sc = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * sc));
  c.height = Math.max(1, Math.round(h * sc));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

function loadFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    startMake(toCanvas(img, img.naturalWidth, img.naturalHeight));
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Sorry, that photo couldn't be opened"); };
  img.src = url;
}

function sampleCanvas() {
  const c = document.createElement('canvas');
  c.width = 1000; c.height = 750;
  const g = c.getContext('2d');
  g.fillStyle = '#8ecae6'; g.fillRect(0, 0, 1000, 750);
  g.fillStyle = '#ffb703'; g.beginPath(); g.arc(830, 130, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  for (const [x, y, s] of [[180, 110, 1], [520, 80, 0.8]]) {
    g.beginPath();
    g.ellipse(x, y, 70 * s, 32 * s, 0, 0, Math.PI * 2);
    g.ellipse(x + 55 * s, y - 18 * s, 48 * s, 36 * s, 0, 0, Math.PI * 2);
    g.ellipse(x - 50 * s, y + 6 * s, 40 * s, 26 * s, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#6a994e'; g.beginPath(); g.ellipse(500, 820, 760, 300, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e76f51'; g.fillRect(300, 340, 300, 230);
  g.fillStyle = '#7f4f24'; g.beginPath(); g.moveTo(270, 350); g.lineTo(450, 210); g.lineTo(630, 350); g.closePath(); g.fill();
  g.fillStyle = '#5e3a1a'; g.fillRect(415, 450, 70, 120);
  g.fillStyle = '#fefae0'; g.fillRect(330, 380, 70, 60); g.fillRect(500, 380, 70, 60);
  g.fillStyle = '#7f5539'; g.fillRect(760, 380, 40, 200);
  g.fillStyle = '#2a9d8f';
  for (const [x, y, r] of [[780, 330, 85], [720, 380, 60], [845, 385, 60]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const flowers = [[120, 620, '#e63946'], [200, 660, '#c77dff'], [660, 640, '#ffe066'], [900, 650, '#ff8fab']];
  for (const [x, y, col] of flowers) {
    g.fillStyle = col;
    for (let a = 0; a < 5; a++) { g.beginPath(); g.arc(x + Math.cos(a * 1.256) * 18, y + Math.sin(a * 1.256) * 18, 13, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffb703'; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/* ---------------- make screen ---------------- */
let srcCanvas = null;
let madeMask = null;
let processTimer = null;

function startMake(c) {
  srcCanvas = c;
  madeMask = null;
  show('make');
  processPhoto();
}

function processPhoto() {
  const busy = $('#busy');
  busy.classList.add('show');
  clearTimeout(processTimer);
  processTimer = setTimeout(() => {
    madeMask = lineArt(srcCanvas, +$('#detail').value);
    drawLinesOnWhite($('#preview'), madeMask, srcCanvas.width, srcCanvas.height);
    busy.classList.remove('show');
  }, 60);
}

/* ---------------- colouring ---------------- */
const colourCv = $('#colourCv');
const lineCv = $('#lineCv');
const cctx = colourCv.getContext('2d', { willReadFrequently: true });
let W = 0, H = 0;
let lineMask = null;
let page = null;
let undoStack = [];
let tool = 'fill';
let colour = '#ff7a59';

function setupCanvases(w, h, mask) {
  W = w; H = h; lineMask = mask;
  colourCv.width = lineCv.width = w;
  colourCv.height = lineCv.height = h;
  const lctx = lineCv.getContext('2d');
  lctx.putImageData(maskToImageData(mask, w, h, lctx), 0, 0);
  cctx.fillStyle = '#fff';
  cctx.fillRect(0, 0, w, h);
  undoStack = [];
}

async function newPage() {
  if (!madeMask) return;
  setupCanvases(srcCanvas.width, srcCanvas.height, madeMask);
  page = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), created: Date.now(), linesBlob: null };
  show('colour');
  await savePage();
}

async function openSaved(rec) {
  try {
    const lines = await createImageBitmap(rec.lines);
    const tmp = document.createElement('canvas');
    tmp.width = rec.w; tmp.height = rec.h;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(lines, 0, 0);
    const d = tctx.getImageData(0, 0, rec.w, rec.h).data;
    const mask = new Uint8Array(rec.w * rec.h);
    for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    setupCanvases(rec.w, rec.h, mask);
    cctx.drawImage(await createImageBitmap(rec.colour), 0, 0);
    page = { id: rec.id, created: rec.created, linesBlob: rec.lines };
    show('colour');
  } catch (e) {
    toast("Sorry, that page couldn't be opened");
  }
}

function pushUndo() {
  undoStack.push(cctx.getImageData(0, 0, W, H));
  if (undoStack.length > 12) undoStack.shift();
}
function undo() {
  const img = undoStack.pop();
  if (!img) { toast('Nothing to undo'); return; }
  cctx.putImageData(img, 0, 0);
  scheduleSave();
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function floodFill(fx, fy, hex) {
  let px = Math.floor(fx), py = Math.floor(fy);
  if (px < 0 || py < 0 || px >= W || py >= H) return false;
  let start = py * W + px;
  if (lineMask[start]) {
    // tapped right on a line: use the nearest gap instead
    let found = -1;
    search: for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = px + dx, y = py + dy;
        if (x >= 0 && y >= 0 && x < W && y < H && !lineMask[y * W + x]) { found = y * W + x; break search; }
      }
    }
    if (found < 0) return false;
    start = found;
  }
  const filled = new Uint8Array(W * H);
  const stack = [start];
  let minX = W, maxX = 0, minY = H, maxY = 0;
  while (stack.length) {
    let i = stack.pop();
    if (filled[i] || lineMask[i]) continue;
    const y = (i / W) | 0;
    let x = i - y * W;
    while (x > 0 && !lineMask[i - 1] && !filled[i - 1]) { x--; i--; }
    let up = false, down = false;
    while (x < W && !lineMask[i] && !filled[i]) {
      filled[i] = 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y > 0) {
        const u = i - W;
        if (!lineMask[u] && !filled[u]) { if (!up) { stack.push(u); up = true; } } else up = false;
      }
      if (y < H - 1) {
        const d = i + W;
        if (!lineMask[d] && !filled[d]) { if (!down) { stack.push(d); down = true; } } else down = false;
      }
      x++; i++;
    }
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // paint, letting the colour run a little under the lines so no white edges show
  const BLEED = 2;
  const [r, g, b] = hexRgb(hex);
  const x0 = Math.max(0, minX - BLEED), y0 = Math.max(0, minY - BLEED);
  const x1 = Math.min(W - 1, maxX + BLEED), y1 = Math.min(H - 1, maxY + BLEED);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const img = cctx.getImageData(x0, y0, bw, bh);
  const d = img.data;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      let paint = filled[i];
      if (!paint && lineMask[i]) {
        near: for (let dy = -BLEED; dy <= BLEED; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -BLEED; dx <= BLEED; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < W && filled[yy * W + xx]) { paint = 1; break near; }
          }
        }
      }
      if (paint) {
        const o = ((y - y0) * bw + (x - x0)) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
  }
  cctx.putImageData(img, x0, y0);
  return true;
}

/* ---------------- zoom / pan / drawing ---------------- */
const stage = $('#stage');
const board = $('#board');
const view = { s: 1, tx: 0, ty: 0, bw: 1, bh: 1 };

function fitBoard() {
  if (!W) return;
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const pad = 12;
  const sc = Math.min((sw - pad * 2) / W, (sh - pad * 2) / H);
  view.bw = W * sc; view.bh = H * sc;
  board.style.width = view.bw + 'px';
  board.style.height = view.bh + 'px';
  view.s = 1;
  view.tx = (sw - view.bw) / 2;
  view.ty = (sh - view.bh) / 2;
  applyView();
}
function applyView() {
  board.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
}
window.addEventListener('resize', () => { if ($('#colour').classList.contains('active')) fitBoard(); });

function canvasPoint(e) {
  const r = colourCv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
function brushPx() {
  // the slider is in screen pixels, so the brush gets finer as you zoom in
  return (+$('#size').value * (W / view.bw)) / view.s;
}

const pts = new Map();
let gesture = null;
let stroke = null;
let tap = null;
let penSeen = false;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const midOf = (p) => p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
const gpts = () => [...pts.values()].slice(0, 2);

function startGesture() {
  const p = gpts();
  gesture = { d0: p.length > 1 ? dist(p[0], p[1]) : 0, m0: midOf(p), s0: view.s, tx0: view.tx, ty0: view.ty };
}
function updateGesture() {
  const p = gpts();
  const m = midOf(p);
  let ns = gesture.s0;
  if (p.length > 1 && gesture.d0 > 0) ns = clamp((gesture.s0 * dist(p[0], p[1])) / gesture.d0, 1, 8);
  const r = stage.getBoundingClientRect();
  const cx = (gesture.m0.x - r.left - gesture.tx0) / gesture.s0;
  const cy = (gesture.m0.y - r.top - gesture.ty0) / gesture.s0;
  view.s = ns;
  view.tx = m.x - r.left - cx * ns;
  view.ty = m.y - r.top - cy * ns;
  applyView();
}

function beginStroke(e) {
  pushUndo();
  const p = canvasPoint(e);
  stroke = { id: e.pointerId, last: p };
  paintSegment(p, p);
}
function paintSegment(a, b) {
  cctx.strokeStyle = tool === 'eraser' ? '#ffffff' : colour;
  cctx.lineWidth = brushPx();
  cctx.lineCap = 'round';
  cctx.lineJoin = 'round';
  cctx.beginPath();
  cctx.moveTo(a.x, a.y);
  cctx.lineTo(b.x + 0.01, b.y);
  cctx.stroke();
}
function cancelStroke() {
  if (!stroke) return;
  const img = undoStack.pop();
  if (img) cctx.putImageData(img, 0, 0);
  stroke = null;
}

stage.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.pointerType === 'pen') penSeen = true;
  // with an Apple Pencil, fingers only zoom and move (palm rejection)
  const canDraw = e.pointerType !== 'touch' || !penSeen;
  if (penSeen && e.pointerType === 'touch' && stroke) return;
  stage.setPointerCapture(e.pointerId);
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (canDraw && pts.size === 1 && !gesture) {
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
    if (tool !== 'fill') beginStroke(e);
  } else {
    cancelStroke();
    tap = null;
    startGesture();
  }
});

stage.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture) { updateGesture(); return; }
  if (stroke && e.pointerId === stroke.id) {
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) {
      const p = canvasPoint(ev);
      paintSegment(stroke.last, p);
      stroke.last = p;
    }
  }
});

function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (gesture) {
    if (pts.size) startGesture(); else gesture = null;
    return;
  }
  if (stroke && e.pointerId === stroke.id) {
    stroke = null;
    scheduleSave();
  }
  if (tool === 'fill' && tap && tap.id === e.pointerId && e.type === 'pointerup') {
    if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 12) {
      pushUndo();
      const p = canvasPoint(e);
      if (floodFill(p.x, p.y, colour)) scheduleSave(); else undoStack.pop();
    }
  }
  tap = null;
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', (e) => { if (stroke && stroke.id === e.pointerId) cancelStroke(); endPointer(e); });

stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  const ns = clamp(view.s * Math.exp(-e.deltaY * 0.0015), 1, 8);
  const cx = (e.clientX - r.left - view.tx) / view.s;
  const cy = (e.clientY - r.top - view.ty) / view.s;
  view.s = ns;
  view.tx = e.clientX - r.left - cx * ns;
  view.ty = e.clientY - r.top - cy * ns;
  applyView();
}, { passive: false });

// stop Safari from zooming the whole page
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

/* ---------------- saving & sharing ---------------- */
const toBlob = (c, type = 'image/png', q) => new Promise((res) => c.toBlob(res, type, q));

function composite(width) {
  const sc = width / W;
  const c = document.createElement('canvas');
  c.width = Math.round(W * sc);
  c.height = Math.round(H * sc);
  const g = c.getContext('2d');
  g.drawImage(colourCv, 0, 0, c.width, c.height);
  g.drawImage(lineCv, 0, 0, c.width, c.height);
  return c;
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePage, 800);
}
async function savePage() {
  clearTimeout(saveTimer);
  if (!page || !W) return;
  try {
    if (!page.linesBlob) page.linesBlob = await toBlob(lineCv);
    const colourBlob = await toBlob(colourCv);
    const thumb = composite(320).toDataURL('image/jpeg', 0.75);
    await DB.put({ id: page.id, created: page.created, updated: Date.now(), w: W, h: H, lines: page.linesBlob, colour: colourBlob, thumb });
  } catch (e) {
    toast("Couldn't save on this device");
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) savePage(); });

async function shareCanvas(c, name) {
  const blob = await toBlob(c);
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'My colouring page' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Picture saved');
}

/* ---------------- gallery ---------------- */
async function renderGallery() {
  let pages = [];
  try { pages = await DB.all(); } catch (e) { /* storage unavailable */ }
  pages.sort((a, b) => b.updated - a.updated);
  const g = $('#gallery');
  g.innerHTML = '';
  $('#empty').style.display = pages.length ? 'none' : 'block';
  for (const p of pages) {
    const card = document.createElement('div');
    card.className = 'card';
    const img = document.createElement('img');
    img.src = p.thumb;
    img.alt = 'Colouring page';
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.setAttribute('aria-label', 'Delete page');
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this page?')) return;
      await DB.del(p.id);
      renderGallery();
    });
    card.append(img, del);
    card.addEventListener('click', () => openSaved(p));
    g.appendChild(card);
  }
}

/* ---------------- palette & wiring ---------------- */
const COLOURS = [
  '#e63946', '#ff7a59', '#f4a261', '#ffb703', '#ffe066', '#a7c957',
  '#6a994e', '#2a9d8f', '#48cae4', '#0077b6', '#3a0ca3', '#7b2cbf',
  '#c77dff', '#ff8fab', '#ffc8dd', '#8d5524', '#c68642', '#f1c27d',
  '#ffdbac', '#6d4c41', '#000000', '#6c757d', '#ced4da', '#ffffff',
];

function setColour(c) {
  colour = c;
  document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.c === c));
  $('#current').style.setProperty('--cur', c);
  if (tool === 'eraser') setTool('fill');
}
function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
}

const pal = $('#palette');
for (const c of COLOURS) {
  const s = document.createElement('button');
  s.className = 'swatch';
  s.dataset.c = c;
  s.style.background = c;
  s.setAttribute('aria-label', 'Colour ' + c);
  s.addEventListener('click', () => setColour(c));
  pal.appendChild(s);
}
setColour(colour);

document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#custom').addEventListener('input', (e) => setColour(e.target.value));
$('#undo').addEventListener('click', undo);
$('#fit').addEventListener('click', fitBoard);
$('#share').addEventListener('click', () => shareCanvas(composite(W), 'my-colouring.png'));
$('#colBack').addEventListener('click', async () => { await savePage(); page = null; show('home'); });

$('#file').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) loadFile(f);
  e.target.value = '';
});
$('#sample').addEventListener('click', () => startMake(sampleCanvas()));
$('#detail').addEventListener('input', () => { if (srcCanvas) processPhoto(); });
$('#makeBack').addEventListener('click', () => show('home'));
$('#start').addEventListener('click', newPage);
$('#printBlank').addEventListener('click', () => { if (madeMask) shareCanvas($('#preview'), 'colouring-page.png'); });

renderGallery();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
