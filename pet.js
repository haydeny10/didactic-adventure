// Everything that draws pictures: the pet, its outfits and its room.

const STAGES = [
  { name: "Egg",    xp: 0 },
  { name: "Baby",   xp: 30 },
  { name: "Kid",    xp: 100 },
  { name: "Teen",   xp: 250 },
  { name: "Adult",  xp: 500 },
  { name: "Legend", xp: 1000 },
];

const PET_TYPES = [
  { id: "blob",   name: "Blob" },
  { id: "cat",    name: "Cat" },
  { id: "dragon", name: "Dragon" },
  { id: "slime",  name: "Slime" },
  { id: "robot",  name: "Robot" },
];

const PET_COLOURS = [280, 330, 0, 25, 45, 120, 170, 200];

// stage = the lowest stage any of your pets must reach to unlock it
const HATS = [
  { id: "bow",        name: "Bow",          price: 15,  stage: 0 },
  { id: "cap",        name: "Cap",          price: 25,  stage: 1 },
  { id: "flowers",    name: "Flower crown", price: 30,  stage: 1 },
  { id: "sunglasses", name: "Sunglasses",   price: 40,  stage: 2 },
  { id: "party",      name: "Party hat",    price: 50,  stage: 2 },
  { id: "tophat",     name: "Top hat",      price: 80,  stage: 3 },
  { id: "wizard",     name: "Wizard hat",   price: 120, stage: 4 },
  { id: "halo",       name: "Halo",         price: 150, stage: 5 },
];

const FURNITURE = [
  { id: "rug",     name: "Rug",          icon: "🟠", price: 10 },
  { id: "plant",   name: "Plant",        icon: "🪴", price: 15 },
  { id: "picture", name: "Picture",      icon: "🖼️", price: 20 },
  { id: "ball",    name: "Ball",         icon: "⚽", price: 20 },
  { id: "window",  name: "Window",       icon: "🪟", price: 30 },
  { id: "lamp",    name: "Lamp",         icon: "💡", price: 35 },
  { id: "lights",  name: "Fairy lights", icon: "✨", price: 40 },
  { id: "bed",     name: "Bed",          icon: "🛏️", price: 60 },
];

const WALLPAPERS = [
  { id: "lavender", name: "Lavender", price: 0,  wall: "#ebe5ff", floor: "#cbbef0" },
  { id: "mint",     name: "Mint",     price: 20, wall: "#dcf6ea", floor: "#a6d9c1" },
  { id: "peach",    name: "Peach",    price: 20, wall: "#ffe7d8", floor: "#eebc9c" },
  { id: "sky",      name: "Sky",      price: 20, wall: "#dbeeff", floor: "#a5caec" },
  { id: "midnight", name: "Midnight", price: 40, wall: "#3b3463", floor: "#26203f" },
];

function stageIndexFor(xp) {
  let i = 0;
  for (let s = 0; s < STAGES.length; s++) if (xp >= STAGES[s].xp) i = s;
  return i;
}

function moodFor(health) {
  if (health >= 60) return "happy";
  if (health >= 30) return "ok";
  return "sad";
}

// ---------- Shapes and colours ----------
function geometry(stage) {
  if (stage === 0) return { egg: true, r: 40, cy: 115, top: 47, fcy: 118, size: 40 };
  const r = [0, 46, 56, 60, 66, 68][stage];
  const cy = 185 - r;
  return { r, cy, top: cy - r * 0.95, fcy: cy - r * 0.15, size: r * 0.8 };
}

function palette(hue, mood, type) {
  const dull = mood === "sad" ? 0.35 : 1;
  if (type === "robot") {
    return {
      main: `hsl(${hue} ${20 * dull}% 78%)`, dark: `hsl(${hue} ${15 * dull}% 48%)`,
      light: `hsl(${hue} ${25 * dull}% 90%)`, accent: `hsl(${hue} ${85 * dull}% 60%)`,
    };
  }
  return {
    main: `hsl(${hue} ${75 * dull}% 66%)`, dark: `hsl(${hue} ${60 * dull}% 46%)`,
    light: `hsl(${hue} ${80 * dull}% 86%)`, accent: `hsl(${(hue + 180) % 360} ${80 * dull}% 65%)`,
  };
}

function face(g, mood, type) {
  const cx = 100, size = g.size;
  const ink = type === "robot" ? "#7df9ff" : "#241f3a";
  const ex = size * 0.35, ey = g.fcy - size * 0.1, er = size * 0.12;
  let out = "";

  if (type === "robot") {
    out += `<rect x="${cx - size * 0.75}" y="${g.fcy - size * 0.5}" width="${size * 1.5}" height="${size * 1.05}" rx="${size * 0.22}" fill="#2b2f45"/>`;
  }

  // Eyes
  if (mood === "sleep") {
    for (const x of [cx - ex, cx + ex]) {
      out += `<path d="M ${x - er} ${ey} q ${er} ${er} ${er * 2} 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
  } else if (type === "robot") {
    for (const x of [cx - ex, cx + ex]) {
      out += `<rect x="${x - er}" y="${ey - er * 1.3}" width="${er * 2}" height="${er * 2.6}" rx="${er * 0.6}" fill="${ink}"/>`;
    }
  } else {
    for (const x of [cx - ex, cx + ex]) {
      out += `<circle cx="${x}" cy="${ey}" r="${er}" fill="${ink}"/>
        <circle cx="${x + er * 0.35}" cy="${ey - er * 0.35}" r="${er * 0.35}" fill="#fff"/>`;
    }
  }

  // Grumpy eyebrows
  if (mood === "sulk") {
    out += `<path d="M ${cx - ex - er * 1.4} ${ey - er * 2.2} L ${cx - ex + er * 1.2} ${ey - er * 1.3}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
      <path d="M ${cx + ex + er * 1.4} ${ey - er * 2.2} L ${cx + ex - er * 1.2} ${ey - er * 1.3}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  }

  // Mouth
  const my = g.fcy + size * 0.22, mw = size * 0.22;
  if (mood === "happy") {
    out += `<path d="M ${cx - mw} ${my} Q ${cx} ${my + mw * 1.1} ${cx + mw} ${my}" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  } else if (mood === "sleep") {
    out += `<ellipse cx="${cx}" cy="${my + 3}" rx="${mw * 0.3}" ry="${mw * 0.35}" fill="${ink}"/>`;
  } else if (mood === "ok" || mood === "sulk") {
    out += `<path d="M ${cx - mw * 0.7} ${my + 4} L ${cx + mw * 0.7} ${my + 4}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
  } else {
    out += `<path d="M ${cx - mw} ${my + mw * 0.7} Q ${cx} ${my - mw * 0.2} ${cx + mw} ${my + mw * 0.7}" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M ${cx + ex} ${ey + er + 2} q 4 8 0 12 q -4 -4 0 -12" fill="#5bc0ff"/>`;
  }

  // Rosy cheeks
  if (type !== "robot" && (mood === "happy" || mood === "ok" || mood === "sleep")) {
    out += `<ellipse cx="${cx - size * 0.55}" cy="${g.fcy + size * 0.12}" rx="${size * 0.12}" ry="${size * 0.07}" fill="#ff7aa2" opacity="0.5"/>
      <ellipse cx="${cx + size * 0.55}" cy="${g.fcy + size * 0.12}" rx="${size * 0.12}" ry="${size * 0.07}" fill="#ff7aa2" opacity="0.5"/>`;
  }
  return out;
}

function drawEgg(g, mood, type, p) {
  let pattern = "", fill = "#fff6e6", stroke = "#e9d7b8";
  if (type === "blob") {
    pattern = `<circle cx="78" cy="80" r="9" fill="${p.main}"/><circle cx="124" cy="100" r="12" fill="${p.main}"/>
      <circle cx="86" cy="150" r="10" fill="${p.main}"/><circle cx="128" cy="150" r="6" fill="${p.main}"/>`;
  } else if (type === "cat") {
    pattern = `<path d="M 60 85 q 40 14 80 0" stroke="${p.main}" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M 50 145 q 50 16 100 0" stroke="${p.main}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  } else if (type === "dragon") {
    pattern = `<path d="M 50 92 l 12 -12 l 12 12 l 12 -12 l 12 12 l 12 -12 l 12 12 l 12 -12 l 12 12" stroke="${p.main}" stroke-width="7" fill="none" stroke-linejoin="round"/>
      <path d="M 54 150 l 12 -10 l 12 10 l 12 -10 l 12 10 l 12 -10 l 12 10 l 12 -10 l 12 10" stroke="${p.main}" stroke-width="7" fill="none" stroke-linejoin="round"/>`;
  } else if (type === "slime") {
    fill = p.light; stroke = p.main;
    pattern = `<ellipse cx="80" cy="80" rx="8" ry="14" fill="#fff" opacity="0.7"/>`;
  } else if (type === "robot") {
    fill = "#dfe3ee"; stroke = "#9aa1b8";
    pattern = `<path d="M 48 115 h 104" stroke="#9aa1b8" stroke-width="3"/>
      <circle cx="62" cy="105" r="4" fill="#9aa1b8"/><circle cx="138" cy="105" r="4" fill="#9aa1b8"/>
      <circle cx="100" cy="62" r="6" fill="${p.accent}"/>`;
  }
  return `<ellipse cx="100" cy="115" rx="52" ry="68" fill="${fill}" stroke="${stroke}" stroke-width="3"/>${pattern}${face(g, mood, type)}`;
}

function drawBody(stage, g, mood, type, p) {
  const { r, cy } = g;
  const L = 100 - r, R = 100 + r;
  let back = "", body = "", front = "";
  const line = `stroke="${p.dark}" stroke-width="3"`;

  // ----- Wings (Adult and up) -----
  if (stage >= 4) {
    if (type === "robot") {
      back += `<rect x="${L - 22}" y="${cy - 10}" width="24" height="40" rx="8" fill="${p.dark}"/>
        <rect x="${R - 2}" y="${cy - 10}" width="24" height="40" rx="8" fill="${p.dark}"/>
        <path d="M ${L - 18} ${cy + 30} l 8 18 l 8 -18 z" fill="#ffb020"/><path d="M ${R + 2} ${cy + 30} l 8 18 l 8 -18 z" fill="#ffb020"/>`;
    } else if (type === "dragon") {
      back += `<path d="M ${100 - r * 0.6} ${cy - 5} l -60 -45 l 10 30 l -22 0 l 18 22 l -18 10 z" fill="${p.light}" ${line} stroke-linejoin="round"/>
        <path d="M ${100 + r * 0.6} ${cy - 5} l 60 -45 l -10 30 l 22 0 l -18 22 l 18 10 z" fill="${p.light}" ${line} stroke-linejoin="round"/>`;
    } else {
      back += `<path d="M ${100 - r * 0.6} ${cy - 5} q -55 -45 -70 0 q 20 -5 25 20 q 20 -15 45 -5 z" fill="${p.light}" ${line}/>
        <path d="M ${100 + r * 0.6} ${cy - 5} q 55 -45 70 0 q -20 -5 -25 20 q -20 -15 -45 -5 z" fill="${p.light}" ${line}/>`;
    }
  }

  // ----- Ears, tails, horns -----
  if (type === "blob" && stage >= 2) {
    back += `<ellipse cx="${100 - r * 0.6}" cy="${cy - r * 0.8}" rx="${r * 0.25}" ry="${r * 0.35}" fill="${p.main}" ${line}/>
      <ellipse cx="${100 + r * 0.6}" cy="${cy - r * 0.8}" rx="${r * 0.25}" ry="${r * 0.35}" fill="${p.main}" ${line}/>`;
  }
  if (type === "cat") {
    back += `<path d="M ${100 + r * 0.8} ${cy + r * 0.5} C ${100 + r * 1.5} ${cy + r * 0.4} ${100 + r * 1.3} ${cy - r * 0.6} ${100 + r * 1.05} ${cy - r * 0.5}" stroke="${p.dark}" stroke-width="${r * 0.22 + 6}" fill="none" stroke-linecap="round"/>
      <path d="M ${100 + r * 0.8} ${cy + r * 0.5} C ${100 + r * 1.5} ${cy + r * 0.4} ${100 + r * 1.3} ${cy - r * 0.6} ${100 + r * 1.05} ${cy - r * 0.5}" stroke="${p.main}" stroke-width="${r * 0.22}" fill="none" stroke-linecap="round"/>`;
    for (const s of [-1, 1]) {
      back += `<path d="M ${100 + s * r * 0.8} ${cy - r * 0.4} L ${100 + s * r * 0.62} ${cy - r * 1.3} L ${100 + s * r * 0.15} ${cy - r * 0.88} Z" fill="${p.main}" ${line} stroke-linejoin="round"/>
        <path d="M ${100 + s * r * 0.66} ${cy - r * 0.6} L ${100 + s * r * 0.6} ${cy - r * 1.08} L ${100 + s * r * 0.35} ${cy - r * 0.85} Z" fill="#ffb3c7"/>`;
    }
  }
  if (type === "dragon") {
    back += `<path d="M ${100 + r * 0.7} ${cy + r * 0.6} Q ${100 + r * 1.4} ${cy + r * 0.6} ${100 + r * 1.35} ${cy}" stroke="${p.dark}" stroke-width="${r * 0.25 + 6}" fill="none" stroke-linecap="round"/>
      <path d="M ${100 + r * 0.7} ${cy + r * 0.6} Q ${100 + r * 1.4} ${cy + r * 0.6} ${100 + r * 1.35} ${cy}" stroke="${p.main}" stroke-width="${r * 0.25}" fill="none" stroke-linecap="round"/>
      <path d="M ${100 + r * 1.35 - 10} ${cy + 2} l 10 -20 l 10 20 z" fill="${p.accent}" ${line} stroke-linejoin="round"/>`;
    const sp = r * 0.18;
    for (const x of [-sp * 1.6, 0, sp * 1.6]) {
      back += `<path d="M ${100 + x - sp} ${g.top + sp * 0.9} l ${sp} ${-sp * 1.6} l ${sp} ${sp * 1.6} z" fill="${p.accent}" ${line} stroke-linejoin="round"/>`;
    }
  }
  if ((type === "dragon" && stage >= 2) || (type === "blob" && stage >= 3)) {
    back += `<path d="M ${100 - r * 0.55} ${cy - r * 0.7} l -6 -24 l 18 16 z" fill="#ffd36e" stroke="#c99a2e" stroke-width="2" stroke-linejoin="round"/>
      <path d="M ${100 + r * 0.55} ${cy - r * 0.7} l 6 -24 l -18 16 z" fill="#ffd36e" stroke="#c99a2e" stroke-width="2" stroke-linejoin="round"/>`;
  }
  if (type === "slime" && stage >= 2) {
    back += `<path d="M 100 ${g.top + 4} q -2 -14 2 -22" stroke="#3f9b4a" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="91" cy="${g.top - 16}" rx="10" ry="5" fill="#6fcf6f" transform="rotate(-25 91 ${g.top - 16})"/>
      <ellipse cx="112" cy="${g.top - 20}" rx="10" ry="5" fill="#6fcf6f" transform="rotate(25 112 ${g.top - 20})"/>`;
  }
  if (type === "robot") {
    back += `<path d="M 100 ${g.top} v -20" stroke="${p.dark}" stroke-width="4"/><circle cx="100" cy="${g.top - 22}" r="7" fill="${p.accent}"/>`;
    if (stage >= 2) {
      back += `<circle cx="${L}" cy="${cy}" r="${r * 0.2}" fill="${p.dark}"/><circle cx="${R}" cy="${cy}" r="${r * 0.2}" fill="${p.dark}"/>`;
    }
  }

  // ----- Body -----
  if (type === "slime") {
    body = `<path d="M ${L} 185 C ${L} ${cy - r * 0.2} ${100 - r * 0.75} ${g.top} 100 ${g.top} C ${100 + r * 0.75} ${g.top} ${R} ${cy - r * 0.2} ${R} 185 Z" fill="${p.main}" fill-opacity="0.92" ${line}/>
      <ellipse cx="${L + 6}" cy="186" rx="9" ry="5" fill="${p.main}"/><ellipse cx="${R - 10}" cy="187" rx="12" ry="5" fill="${p.main}"/>
      <ellipse cx="${100 - r * 0.5}" cy="${cy - r * 0.45}" rx="${r * 0.13}" ry="${r * 0.24}" fill="#fff" opacity="0.6"/>`;
  } else if (type === "robot") {
    body = `<rect x="${L}" y="${g.top}" width="${r * 2}" height="${185 - g.top}" rx="${r * 0.3}" fill="${p.main}" ${line}/>
      <circle cx="${L + 9}" cy="${g.top + 9}" r="3" fill="${p.dark}"/><circle cx="${R - 9}" cy="${g.top + 9}" r="3" fill="${p.dark}"/>
      <circle cx="${L + 9}" cy="176" r="3" fill="${p.dark}"/><circle cx="${R - 9}" cy="176" r="3" fill="${p.dark}"/>
      <rect x="${100 - r * 0.35}" y="${cy + r * 0.45}" width="${r * 0.7}" height="${r * 0.22}" rx="4" fill="${p.accent}" opacity="0.8"/>`;
  } else {
    body = `<ellipse cx="100" cy="${cy}" rx="${r}" ry="${r * 0.95}" fill="${p.main}" ${line}/>
      <ellipse cx="100" cy="${cy + r * 0.35}" rx="${r * 0.55}" ry="${r * 0.45}" fill="${p.light}" opacity="0.8"/>`;
    if (type === "dragon") {
      for (let i = 0; i < 3; i++) {
        const y = cy + r * (0.12 + i * 0.22);
        body += `<path d="M ${100 - r * 0.4} ${y} q ${r * 0.4} ${r * 0.08} ${r * 0.8} 0" stroke="${p.main}" stroke-width="2" fill="none"/>`;
      }
    }
  }

  // ----- Feet, arms, whiskers -----
  if (stage >= 3) {
    if (type === "robot") {
      front += `<rect x="${100 - r * 0.7}" y="177" width="${r * 0.55}" height="12" rx="4" fill="${p.dark}"/>
        <rect x="${100 + r * 0.15}" y="177" width="${r * 0.55}" height="12" rx="4" fill="${p.dark}"/>
        <rect x="${L - 12}" y="${cy + 8}" width="14" height="${r * 0.6}" rx="7" fill="${p.dark}"/>
        <rect x="${R - 2}" y="${cy + 8}" width="14" height="${r * 0.6}" rx="7" fill="${p.dark}"/>`;
    } else if (type !== "slime") {
      front += `<ellipse cx="${100 - r * 0.45}" cy="183" rx="16" ry="8" fill="${p.dark}"/>
        <ellipse cx="${100 + r * 0.45}" cy="183" rx="16" ry="8" fill="${p.dark}"/>`;
    }
  }
  if (type === "cat") {
    const wy = g.fcy + g.size * 0.15;
    for (const s of [-1, 1]) {
      const x = 100 + s * g.size * 0.62;
      front += `<path d="M ${x} ${wy} l ${s * 20} -4 M ${x} ${wy + 5} l ${s * 20} 3" stroke="${p.dark}" stroke-width="2" stroke-linecap="round"/>`;
    }
  }
  return { back, body, front };
}

function drawHat(id, g, stage) {
  if (!id) return "";
  const s = g.r / 60, cx = 100, t = g.top + 3 * s;
  const ex = g.size * 0.35, ey = g.fcy - g.size * 0.1, er = g.size * 0.12;
  switch (id) {
    case "bow": {
      const x = cx + g.r * 0.45, y = t + 10 * s;
      return `<path d="M ${x} ${y} l -20 ${-12 * s} v ${24 * s} z M ${x} ${y} l 20 ${-12 * s} v ${24 * s} z" fill="#ff6fa5" stroke="#d63f7a" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="${x}" cy="${y}" r="${6 * s}" fill="#d63f7a"/>`;
    }
    case "cap":
      return `<path d="M ${cx - 34 * s} ${t + 8 * s} Q ${cx} ${t - 34 * s} ${cx + 34 * s} ${t + 8 * s} Z" fill="#ff5a5a" stroke="#c23a3a" stroke-width="2"/>
        <ellipse cx="${cx + 26 * s}" cy="${t + 7 * s}" rx="${26 * s}" ry="${6 * s}" fill="#c23a3a"/>
        <circle cx="${cx}" cy="${t - 18 * s}" r="${4 * s}" fill="#fff"/>`;
    case "flowers": {
      let out = "";
      const cols = ["#ff7ab0", "#ffd84d", "#ffffff", "#9b82ff", "#ff7ab0"];
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (0.15 + i * 0.175);
        const x = cx - Math.cos(a) * 34 * s, y = t + 6 * s - Math.sin(a) * 10 * s;
        out += `<circle cx="${x}" cy="${y}" r="${8 * s}" fill="${cols[i]}" stroke="#e05a95" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="${3 * s}" fill="#ffb020"/>`;
      }
      return out;
    }
    case "sunglasses":
      return `<rect x="${cx - ex - er * 2}" y="${ey - er * 1.5}" width="${er * 4}" height="${er * 3}" rx="${er}" fill="#1c1a29"/>
        <rect x="${cx + ex - er * 2}" y="${ey - er * 1.5}" width="${er * 4}" height="${er * 3}" rx="${er}" fill="#1c1a29"/>
        <path d="M ${cx - ex + er * 2} ${ey - er * 0.5} H ${cx + ex - er * 2}" stroke="#1c1a29" stroke-width="3"/>
        <path d="M ${cx - ex - er * 1.2} ${ey - er * 0.8} l ${er * 1.2} 0" stroke="#fff" stroke-width="2" opacity="0.7"/>`;
    case "party":
      return `<path d="M ${cx - 20 * s} ${t + 6 * s} L ${cx} ${t - 46 * s} L ${cx + 20 * s} ${t + 6 * s} Z" fill="#ffd84d" stroke="#d6a51c" stroke-width="2" stroke-linejoin="round"/>
        <path d="M ${cx - 12 * s} ${t - 14 * s} L ${cx + 12 * s} ${t - 14 * s} M ${cx - 6 * s} ${t - 30 * s} L ${cx + 6 * s} ${t - 30 * s}" stroke="#ff6fa5" stroke-width="${4 * s}"/>
        <circle cx="${cx}" cy="${t - 48 * s}" r="${6 * s}" fill="#ff6fa5"/>`;
    case "tophat":
      return `<rect x="${cx - 22 * s}" y="${t - 40 * s}" width="${44 * s}" height="${44 * s}" rx="${3 * s}" fill="#24212f"/>
        <rect x="${cx - 22 * s}" y="${t - 8 * s}" width="${44 * s}" height="${8 * s}" fill="#e84a5f"/>
        <ellipse cx="${cx}" cy="${t + 4 * s}" rx="${36 * s}" ry="${7 * s}" fill="#24212f"/>`;
    case "wizard":
      return `<path d="M ${cx - 30 * s} ${t + 4 * s} L ${cx + 8 * s} ${t - 64 * s} L ${cx + 30 * s} ${t + 4 * s} Z" fill="#4b4bd6" stroke="#2f2f99" stroke-width="2" stroke-linejoin="round"/>
        <ellipse cx="${cx}" cy="${t + 5 * s}" rx="${40 * s}" ry="${8 * s}" fill="#2f2f99"/>
        <text x="${cx - 8 * s}" y="${t - 18 * s}" font-size="${14 * s}" fill="#ffd84d">★</text>
        <text x="${cx + 4 * s}" y="${t - 36 * s}" font-size="${10 * s}" fill="#ffd84d">★</text>`;
    case "halo":
      return `<ellipse cx="${cx}" cy="${t - 18 * s}" rx="${30 * s}" ry="${8 * s}" fill="none" stroke="#ffe27a" stroke-width="${10 * s}" opacity="0.35"/>
        <ellipse cx="${cx}" cy="${t - 18 * s}" rx="${30 * s}" ry="${8 * s}" fill="none" stroke="#ffd23f" stroke-width="${5 * s}"/>`;
  }
  return "";
}

// opts: { stage, mood, hue, type, hat }
function drawPetInner(opts) {
  const { stage, mood, hue } = opts;
  const type = opts.type || "blob";
  const g = geometry(stage);
  const p = palette(hue, mood, type);
  const shadow = `<ellipse cx="100" cy="188" rx="${40 + stage * 6}" ry="7" fill="#000" opacity="0.12"/>`;
  let inner;

  if (stage === 0) {
    inner = drawEgg(g, mood, type, p);
  } else {
    const parts = drawBody(stage, g, mood, type, p);
    const glow = stage >= 5 && mood !== "sad"
      ? `<circle cx="100" cy="${g.cy}" r="${g.r + 24}" fill="hsl(${hue} 90% 70%)" opacity="0.2"/>` : "";
    let crown = "";
    if (stage >= 5) {
      if (!opts.hat) {
        crown = `<path d="M 78 ${g.top - 2} l 6 -26 l 10 14 l 6 -18 l 6 18 l 10 -14 l 6 26 z" fill="#ffd36e" stroke="#c99a2e" stroke-width="2" stroke-linejoin="round"/>`;
      }
      crown += `<text x="22" y="60" font-size="18">✨</text><text x="160" y="40" font-size="14">✨</text>`;
    }
    inner = glow + parts.back + parts.body + face(g, mood, type) + parts.front + crown;
  }

  inner += drawHat(opts.hat, g, stage);
  if (mood === "sleep") {
    inner += `<g class="zzz" font-weight="800" fill="#7c5cff" font-family="system-ui">
      <text x="150" y="60" font-size="18">z</text><text x="162" y="42" font-size="22">z</text><text x="176" y="20" font-size="26">Z</text></g>`;
  }
  return `${shadow}<g class="pet-body">${inner}</g>`;
}

function drawPet(opts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${drawPetInner(opts)}</svg>`;
}

// ---------- The room ----------
function drawRoom(placed, wallpaperId, night) {
  const wp = WALLPAPERS.find(w => w.id === wallpaperId) || WALLPAPERS[0];
  const has = id => placed.includes(id);
  let back = `<rect width="400" height="200" fill="${wp.wall}"/>
    <rect y="200" width="400" height="60" fill="${wp.floor}"/>
    <rect y="196" width="400" height="6" fill="#000" opacity="0.08"/>`;
  let front = "";

  if (has("window")) {
    back += `<rect x="28" y="38" width="84" height="78" rx="6" fill="#fff"/>
      <rect x="34" y="44" width="72" height="66" fill="${night ? "#1d2350" : "#9fdcff"}"/>`;
    back += night
      ? `<circle cx="84" cy="62" r="10" fill="#fff6c4"/><circle cx="80" cy="59" r="9" fill="#1d2350"/>
         <circle cx="48" cy="56" r="1.5" fill="#fff"/><circle cx="60" cy="90" r="1.5" fill="#fff"/><circle cx="94" cy="96" r="1.5" fill="#fff"/>`
      : `<circle cx="90" cy="58" r="9" fill="#ffe066"/><ellipse cx="56" cy="82" rx="14" ry="7" fill="#fff"/><ellipse cx="66" cy="78" rx="10" ry="7" fill="#fff"/>`;
    back += `<path d="M 70 44 V 110 M 34 77 H 106" stroke="#fff" stroke-width="4"/>`;
  }
  if (has("picture")) {
    back += `<rect x="298" y="46" width="66" height="54" rx="4" fill="#c98b4a"/>
      <rect x="305" y="53" width="52" height="40" fill="#fff3e0"/>
      <path d="M 331 85 l -12 -12 a 6 6 0 0 1 12 -6 a 6 6 0 0 1 12 6 z" fill="#ff6f91"/>`;
  }
  if (has("lights")) {
    back += `<path d="M 0 16 Q 100 46 200 16 Q 300 46 400 16" stroke="#5d5875" stroke-width="2" fill="none"/>`;
    const cols = ["#ff6f91", "#ffd84d", "#6fd3ff", "#9bff8a"];
    for (let i = 0; i < 12; i++) {
      const x = 16 + i * 33, u = (x % 200) / 200;
      const y = 16 + 30 * 2 * u * (1 - u) + 4;
      back += `<circle cx="${x}" cy="${y}" r="5" fill="${cols[i % 4]}"/>`;
    }
  }
  if (has("rug")) {
    back += `<ellipse cx="200" cy="230" rx="118" ry="17" fill="#ffc46b"/>
      <ellipse cx="200" cy="230" rx="100" ry="12" fill="none" stroke="#ff8f5a" stroke-width="3" stroke-dasharray="8 6"/>`;
  }
  if (has("bed")) {
    back += `<rect x="8" y="176" width="104" height="44" rx="10" fill="#8fb4ff"/>
      <rect x="8" y="200" width="104" height="22" rx="6" fill="#6d93e6"/>
      <ellipse cx="34" cy="182" rx="20" ry="9" fill="#fff"/>
      <rect x="4" y="160" width="10" height="66" rx="4" fill="#b98250"/>`;
  }
  if (has("plant")) {
    back += `<ellipse cx="318" cy="168" rx="9" ry="22" fill="#4caf50" transform="rotate(-25 318 168)"/>
      <ellipse cx="338" cy="164" rx="9" ry="24" fill="#66c46a" transform="rotate(20 338 164)"/>
      <ellipse cx="328" cy="160" rx="8" ry="24" fill="#3f9b4a"/>
      <path d="M 312 190 h 32 l -5 34 h -22 z" fill="#d9774a"/>`;
  }
  if (has("lamp")) {
    if (night) back += `<defs><radialGradient id="lampglow"><stop offset="0" stop-color="#ffe9a3" stop-opacity="0.6"/><stop offset="1" stop-color="#ffe9a3" stop-opacity="0"/></radialGradient></defs>
      <circle cx="376" cy="125" r="80" fill="url(#lampglow)"/>`;
    back += `<path d="M 376 128 V 222" stroke="#5d5875" stroke-width="4"/>
      <ellipse cx="376" cy="224" rx="14" ry="5" fill="#5d5875"/>
      <path d="M 360 128 h 32 l -7 -26 h -18 z" fill="${night ? "#fff1b8" : "#ffd36e"}"/>`;
  }
  if (night) back += `<rect width="400" height="260" fill="#0b0830" opacity="${has("lamp") ? 0.18 : 0.32}"/>`;

  if (has("ball")) {
    front += `<circle cx="78" cy="240" r="12" fill="#ff5a5a"/><path d="M 66 240 q 12 -8 24 0" stroke="#fff" stroke-width="3" fill="none"/>`;
  }
  return { back, front };
}

// One picture with the room and the pet in it.
function drawScene(opts) {
  const room = drawRoom(opts.placed || [], opts.wallpaper, opts.night);
  const size = opts.width ? `width="${opts.width}" height="${opts.width * 0.65}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" ${size}>
    ${room.back}
    <svg x="100" y="40" width="200" height="200" viewBox="0 0 200 200" overflow="visible">${drawPetInner(opts)}</svg>
    ${room.front}
  </svg>`;
}

function drawGrave() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <ellipse cx="100" cy="188" rx="70" ry="8" fill="#000" opacity="0.12"/>
    <path d="M 55 185 L 55 85 Q 55 40 100 40 Q 145 40 145 85 L 145 185 Z" fill="#b8b3c9" stroke="#7d7795" stroke-width="3"/>
    <text x="100" y="105" text-anchor="middle" font-size="26" font-weight="800" fill="#5d5875" font-family="system-ui">RIP</text>
    <path d="M 85 130 L 115 130 M 100 118 L 100 160" stroke="#7d7795" stroke-width="5" stroke-linecap="round"/>
    <path d="M 40 186 q 10 -14 20 0 q 10 -12 20 0" fill="#6fbf73"/>
    <path d="M 125 186 q 10 -14 20 0 q 10 -12 20 0" fill="#6fbf73"/>
  </svg>`;
}
