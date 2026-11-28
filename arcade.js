// Pet Patrol: a little space shooter. Your pet flies at the bottom of the screen
// and shoots down waves of bad habits. Healthier pets get more lives, and clearing
// waves earns a few coins (capped each day so habits stay the main way to earn).

const ARCADE_COINS_PER_WAVE = 1;
const ARCADE_DAILY_COIN_CAP = 10;
const BAD_HABITS = ["📱", "🍩", "🍟", "🛋️", "🎮", "🍬", "📺", "🥤"];

const Arcade = (() => {
  const W = 300, H = 400;              // game units; the canvas scales to fit
  let canvas, ctx, raf = 0, last = 0, running = false, paused = false;
  let g = null;                        // the current game
  let petImg = null, petKey = "";
  const sprites = {};                  // emoji -> pre-drawn canvas
  const input = { left: false, right: false, pointerX: null };

  function sprite(ch, size) {
    const k = ch + size;
    if (sprites[k]) return sprites[k];
    const c = document.createElement("canvas");
    const s = Math.ceil(size * 1.3 * 2);
    c.width = c.height = s;
    const x = c.getContext("2d");
    x.font = `${size * 2}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(ch, s / 2, s / 2 + size * 0.1);
    return (sprites[k] = c);
  }

  function loadPet() {
    const pet = state.pet;
    const key = [pet.type, pet.hue, state.hat, stageNow()].join("|");
    if (key === petKey) return;
    petKey = key;
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      drawPet({ stage: Math.max(1, stageNow()), mood: "happy", hue: pet.hue, type: pet.type, hat: state.hat }));
    img.onload = () => { petImg = img; };
  }

  function livesForHealth(h) { return h >= 60 ? 3 : h >= RESCUE_BELOW ? 2 : 1; }

  function todayInfo() {
    const a = state.arcade;
    if (a.day !== dayKey()) { a.day = dayKey(); a.coins = 0; }
    return a;
  }

  // ---------- Game setup ----------
  function newGame() {
    g = {
      wave: 0, score: 0, lives: livesForHealth(state.pet.health), over: false,
      player: { x: W / 2, y: H - 34, r: 16, cool: 0, hurt: 0, power: 0 },
      shots: [], enemies: [], bombs: [], drops: [], bits: [],
      stars: Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.3 + Math.random() * 1.2 })),
      banner: 0, coinsEarned: 0, t: 0,
    };
    nextWave();
  }

  function nextWave() {
    g.wave++;
    g.banner = 1.6;
    const rows = Math.min(2 + Math.floor(g.wave / 2), 5);
    const cols = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hx = 45 + c * 42, hy = 50 + r * 34;
        g.enemies.push({
          hx, hy,                       // home spot in the formation
          x: hx + (c < cols / 2 ? -W : W), y: hy - 60,   // fly in from the sides
          ch: BAD_HABITS[(r * 3 + c + g.wave) % BAD_HABITS.length],
          hp: r === 0 && g.wave >= 3 ? 2 : 1,
          state: "enter", t: 0, delay: (r * cols + c) * 0.06,
          dive: null,
        });
      }
    }
  }

  function speed() { return 1 + Math.min(g.wave - 1, 10) * 0.12; }

  // ---------- Update ----------
  function update(dt) {
    g.t += dt;
    if (g.banner > 0) g.banner -= dt;
    for (const s of g.stars) { s.y += s.s * 40 * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }

    const p = g.player;
    if (!g.over) {
      // Movement: drag/touch follows the finger, keys move steadily
      if (input.pointerX !== null) p.x += (input.pointerX - p.x) * Math.min(1, dt * 14);
      if (input.left) p.x -= 220 * dt;
      if (input.right) p.x += 220 * dt;
      p.x = Math.max(p.r, Math.min(W - p.r, p.x));

      // Auto-fire
      p.cool -= dt;
      if (p.power > 0) p.power -= dt;
      if (p.hurt > 0) p.hurt -= dt;
      if (p.cool <= 0) {
        p.cool = 0.28;
        g.shots.push({ x: p.x, y: p.y - 14, vx: 0 });
        if (p.power > 0) {
          g.shots.push({ x: p.x - 6, y: p.y - 10, vx: -70 });
          g.shots.push({ x: p.x + 6, y: p.y - 10, vx: 70 });
        }
      }
    }

    for (const s of g.shots) { s.y -= 320 * dt; s.x += s.vx * dt; }
    g.shots = g.shots.filter(s => s.y > -10 && s.x > -10 && s.x < W + 10);

    // Enemies: fly in, sway in formation, sometimes dive at the pet
    const sway = Math.sin(g.t * 1.2) * 18;
    const sp = speed();
    const formed = g.enemies.filter(e => e.state === "form");
    if (!g.over && formed.length && Math.random() < dt * (0.35 + g.wave * 0.08)) {
      const e = formed[Math.floor(Math.random() * formed.length)];
      e.state = "dive";
      e.dive = { t: 0, sx: e.x, sy: e.y, dir: e.x < W / 2 ? 1 : -1, tx: p.x };
    }
    for (const e of g.enemies) {
      if (e.state === "enter") {
        e.delay -= dt;
        if (e.delay > 0) continue;
        e.t += dt * 1.4 * sp;
        const k = Math.min(1, e.t);
        const ease = 1 - Math.pow(1 - k, 3);
        e.x += (e.hx + sway - e.x) * ease * 0.25;
        e.y += (e.hy - e.y) * ease * 0.25;
        if (k >= 1 && Math.abs(e.x - (e.hx + sway)) < 3) e.state = "form";
      } else if (e.state === "form") {
        e.x = e.hx + sway;
        e.y = e.hy + Math.sin(g.t * 3 + e.hx) * 2;
        if (!g.over && Math.random() < dt * 0.04 * g.wave) bomb(e);
      } else if (e.state === "dive") {
        const d = e.dive;
        d.t += dt * 0.55 * sp;
        // a loop out to the side, then a swoop down toward where the pet was
        const loop = Math.min(d.t / 0.3, 1);
        const a = loop * Math.PI;
        const lx = d.sx + d.dir * Math.sin(a) * 30;
        const ly = d.sy - Math.sin(a) * 25;
        const k = Math.max(0, (d.t - 0.3) / 0.7);
        e.x = lx + (d.tx - lx) * k + Math.sin(k * 6) * 25 * d.dir;
        e.y = ly + (H + 40 - ly) * k;
        if (!d.shot && k > 0.25) { d.shot = true; bomb(e); }
        if (e.y > H + 30) {   // wrap back to the top of its spot
          e.state = "enter"; e.t = 0; e.delay = 0.3; e.x = e.hx; e.y = -30;
        }
      }
    }

    for (const b of g.bombs) { b.x += b.vx * dt; b.y += b.vy * dt; }
    g.bombs = g.bombs.filter(b => b.y < H + 10);
    for (const d of g.drops) { d.y += 70 * dt; }
    g.drops = g.drops.filter(d => d.y < H + 10);
    for (const b of g.bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
    g.bits = g.bits.filter(b => b.life > 0);

    // Hits on enemies
    for (const s of g.shots) {
      for (const e of g.enemies) {
        if (e.hp <= 0 || (e.state === "enter" && e.delay > 0)) continue;
        if (Math.abs(s.x - e.x) < 14 && Math.abs(s.y - e.y) < 14) {
          s.y = -100;
          e.hp--;
          if (e.hp <= 0) {
            g.score += e.state === "dive" ? 30 : 10;
            burst(e.x, e.y, "#ffd36e");
            if (Math.random() < 0.07) g.drops.push({ x: e.x, y: e.y });
          } else burst(e.x, e.y, "#ffffff", 4);
          break;
        }
      }
    }
    g.enemies = g.enemies.filter(e => e.hp > 0);

    if (!g.over) {
      // Hits on the pet
      if (p.hurt <= 0) {
        const hitBomb = g.bombs.find(b => Math.abs(b.x - p.x) < p.r * 0.75 && Math.abs(b.y - p.y) < p.r * 0.75);
        const hitEnemy = g.enemies.find(e => Math.abs(e.x - p.x) < p.r + 8 && Math.abs(e.y - p.y) < p.r + 8);
        if (hitBomb || hitEnemy) {
          if (hitBomb) hitBomb.y = H + 100;
          if (hitEnemy) { hitEnemy.hp = 0; burst(hitEnemy.x, hitEnemy.y, "#ffd36e"); }
          g.enemies = g.enemies.filter(e => e.hp > 0);
          g.lives--;
          p.hurt = 1.6;
          p.power = 0;
          burst(p.x, p.y, "#ff5c7a", 14);
          if (g.lives <= 0) gameOver();
        }
      }
      const star = g.drops.find(d => Math.abs(d.x - p.x) < p.r + 8 && Math.abs(d.y - p.y) < p.r + 8);
      if (star) { star.y = H + 100; p.power = 7; }

      if (g.enemies.length === 0) waveCleared();
    }
  }

  function bomb(e) {
    const p = g.player;
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    const v = 110 + g.wave * 6;
    g.bombs.push({ x: e.x, y: e.y + 8, vx: Math.cos(ang) * v * 0.35, vy: Math.max(60, Math.sin(ang) * v) });
  }

  function burst(x, y, colour, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
      g.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.3, colour });
    }
  }

  function waveCleared() {
    const a = todayInfo();
    a.bestWave = Math.max(a.bestWave || 0, g.wave);
    const pay = Math.min(ARCADE_COINS_PER_WAVE, ARCADE_DAILY_COIN_CAP - a.coins);
    if (pay > 0) {
      a.coins += pay;
      state.coins += pay;
      g.coinsEarned += pay;
      $("coins").textContent = state.coins;
    }
    g.score += 50 * g.wave;
    save();
    checkBadges();
    nextWave();
  }

  function gameOver() {
    g.over = true;
    const a = todayInfo();
    const isBest = g.score > (a.best || 0);
    if (isBest) a.best = g.score;
    save();
    showOverlay(
      isBest && g.score > 0 ? "New high score! 🏆" : "Game over",
      `Score ${g.score} · reached wave ${g.wave}` +
      (g.coinsEarned ? ` · +${g.coinsEarned} 🪙` : "") ,
      "Play again");
  }

  // ---------- Drawing ----------
  function draw() {
    ctx.fillStyle = "#120d24";
    ctx.fillRect(0, 0, W, H);
    for (const s of g.stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + s.s * 0.4})`;
      ctx.fillRect(s.x, s.y, s.s * 1.4, s.s * 1.4);
    }

    ctx.fillStyle = "#ffd36e";
    for (const s of g.shots) ctx.fillRect(s.x - 1.5, s.y - 6, 3, 10);
    ctx.fillStyle = "#b388ff";
    for (const b of g.bombs) { ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill(); }

    for (const e of g.enemies) {
      if (e.state === "enter" && e.delay > 0) continue;
      const img = sprite(e.ch, 22);
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.state === "dive") ctx.rotate(Math.sin(g.t * 10) * 0.25);
      ctx.drawImage(img, -img.width / 4, -img.height / 4, img.width / 2, img.height / 2);
      ctx.restore();
      if (e.hp > 1) { ctx.strokeStyle = "#ff5c7a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, 15, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (const d of g.drops) {
      const img = sprite("⭐", 16);
      ctx.drawImage(img, d.x - img.width / 4, d.y - img.height / 4, img.width / 2, img.height / 2);
    }
    for (const b of g.bits) { ctx.globalAlpha = Math.max(0, b.life * 2); ctx.fillStyle = b.colour; ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); }
    ctx.globalAlpha = 1;

    const p = g.player;
    if (!g.over && !(p.hurt > 0 && Math.floor(p.hurt * 10) % 2)) {
      if (p.power > 0) {
        ctx.fillStyle = "rgba(255,211,110,0.25)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2); ctx.fill();
      }
      if (petImg) ctx.drawImage(petImg, p.x - 24, p.y - 26, 48, 48);
      else { ctx.fillStyle = "#9b82ff"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    }

    // HUD
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Score ${g.score}`, 8, 18);
    ctx.textAlign = "right";
    ctx.fillText("❤️".repeat(Math.max(0, g.lives)), W - 8, 18);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Wave ${g.wave}`, W / 2, 18);
    if (g.banner > 0 && !g.over) {
      ctx.globalAlpha = Math.min(1, g.banner);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px system-ui, sans-serif";
      ctx.fillText(`Wave ${g.wave}`, W / 2, H / 2);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- Loop & controls ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!paused) update(dt);
    draw();
  }

  function start() {
    loadPet();
    newGame();
    paused = false;
    hideOverlay();
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function pause() {
    if (!running) return;
    cancelAnimationFrame(raf);
    running = false;
    if (g && !g.over) { paused = true; showOverlay("Paused", "Take a breather.", "Keep playing"); }
  }

  function resume() {
    paused = false;
    hideOverlay();
    if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function showOverlay(title, text, btn) {
    $("arcade-title").textContent = title;
    $("arcade-text").textContent = text;
    $("arcade-go").textContent = btn;
    $("arcade-overlay").classList.remove("hidden");
  }
  function hideOverlay() { $("arcade-overlay").classList.add("hidden"); }

  function toGame(clientX) {
    const r = canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  }

  function init() {
    canvas = $("arcade-canvas");
    ctx = canvas.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    canvas.addEventListener("pointerdown", e => { input.pointerX = toGame(e.clientX); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (e.pointerType === "mouse" || input.pointerX !== null) input.pointerX = toGame(e.clientX); });
    canvas.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") input.pointerX = null; });
    canvas.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") input.pointerX = null; });

    const keys = (e, down) => {
      if (session.tab !== "play") return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) { input.left = down; input.pointerX = null; e.preventDefault(); }
      if (["ArrowRight", "d", "D"].includes(e.key)) { input.right = down; input.pointerX = null; e.preventDefault(); }
      if (down && (e.key === "p" || e.key === "Escape") && g && !g.over) paused ? resume() : pause();
    };
    window.addEventListener("keydown", e => keys(e, true));
    window.addEventListener("keyup", e => keys(e, false));
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });

    $("arcade-go").addEventListener("click", () => { if (paused && g && !g.over) resume(); else start(); });
  }

  // Called when the Play tab is shown
  function show() {
    if (!canvas) init();
    loadPet();
    const a = todayInfo();
    const lives = livesForHealth(state.pet.health);
    $("arcade-info").textContent =
      `Your pet has ${lives} ${lives === 1 ? "life" : "lives"} (healthier pets get more). ` +
      `Clear a wave for +${ARCADE_COINS_PER_WAVE} 🪙, up to ${ARCADE_DAILY_COIN_CAP} a day ` +
      `(${a.coins}/${ARCADE_DAILY_COIN_CAP} today). Best score: ${a.best || 0}.`;
    if (!g) {
      showOverlay("Pet Patrol", "Bad habits are invading! Drag (or use ← →) to move. Your pet fires on its own. Grab ⭐ for triple shot.", "Start");
      // draw an empty starfield behind the start screen
      newGame(); g.enemies = []; g.banner = 0; draw(); g = null;
    } else {
      draw();
    }
  }

  return { show, pause };
})();
