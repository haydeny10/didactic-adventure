// Draws the pet as an SVG picture. Each stage adds new features.

const STAGES = [
  { name: "Egg",    xp: 0 },
  { name: "Baby",   xp: 30 },
  { name: "Kid",    xp: 100 },
  { name: "Teen",   xp: 250 },
  { name: "Adult",  xp: 500 },
  { name: "Legend", xp: 1000 },
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

function face(cx, cy, size, mood) {
  const eyeX = size * 0.35, eyeY = size * 0.1, eyeR = size * 0.12;
  let eyes = `
    <circle cx="${cx - eyeX}" cy="${cy - eyeY}" r="${eyeR}" fill="#241f3a"/>
    <circle cx="${cx + eyeX}" cy="${cy - eyeY}" r="${eyeR}" fill="#241f3a"/>
    <circle cx="${cx - eyeX + eyeR * 0.35}" cy="${cy - eyeY - eyeR * 0.35}" r="${eyeR * 0.35}" fill="#fff"/>
    <circle cx="${cx + eyeX + eyeR * 0.35}" cy="${cy - eyeY - eyeR * 0.35}" r="${eyeR * 0.35}" fill="#fff"/>`;
  const my = cy + size * 0.22, mw = size * 0.22;
  let mouth;
  if (mood === "happy") {
    mouth = `<path d="M ${cx - mw} ${my} Q ${cx} ${my + mw * 1.1} ${cx + mw} ${my}" stroke="#241f3a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  } else if (mood === "ok") {
    mouth = `<path d="M ${cx - mw * 0.7} ${my + 4} L ${cx + mw * 0.7} ${my + 4}" stroke="#241f3a" stroke-width="3" stroke-linecap="round"/>`;
  } else {
    mouth = `<path d="M ${cx - mw} ${my + mw * 0.7} Q ${cx} ${my - mw * 0.2} ${cx + mw} ${my + mw * 0.7}" stroke="#241f3a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M ${cx + eyeX} ${cy - eyeY + eyeR + 2} q 4 8 0 12 q -4 -4 0 -12" fill="#5bc0ff"/>`;
  }
  const blush = mood === "sad" ? "" : `
    <ellipse cx="${cx - size * 0.55}" cy="${cy + size * 0.12}" rx="${size * 0.12}" ry="${size * 0.07}" fill="#ff7aa2" opacity="0.5"/>
    <ellipse cx="${cx + size * 0.55}" cy="${cy + size * 0.12}" rx="${size * 0.12}" ry="${size * 0.07}" fill="#ff7aa2" opacity="0.5"/>`;
  return eyes + blush + mouth;
}

function drawPet(stage, mood, hue) {
  const main = mood === "sad" ? `hsl(${hue} 25% 65%)` : `hsl(${hue} 75% 66%)`;
  const dark = mood === "sad" ? `hsl(${hue} 20% 45%)` : `hsl(${hue} 60% 46%)`;
  const light = `hsl(${hue} 80% 85%)`;
  const shadow = `<ellipse cx="100" cy="188" rx="${40 + stage * 6}" ry="7" fill="#000" opacity="0.12"/>`;

  // Stage 0: an egg with a little face peeking out
  if (stage === 0) {
    return `<svg viewBox="0 0 200 200">${shadow}
      <g class="pet-body">
        <ellipse cx="100" cy="115" rx="52" ry="68" fill="#fff6e6" stroke="#e9d7b8" stroke-width="3"/>
        <circle cx="78" cy="80" r="9" fill="${main}"/>
        <circle cx="124" cy="100" r="12" fill="${main}"/>
        <circle cx="86" cy="150" r="10" fill="${main}"/>
        <circle cx="128" cy="150" r="6" fill="${main}"/>
        ${face(100, 118, 40, mood)}
      </g></svg>`;
  }

  const r = [0, 46, 56, 60, 66, 68][stage];
  const cy = 185 - r;
  let back = "", front = "";

  // Wings for Adult and Legend
  if (stage >= 4) {
    back += `
      <path d="M ${100 - r * 0.6} ${cy - 5} q -55 -45 -70 0 q 20 -5 25 20 q 20 -15 45 -5 z" fill="${light}" stroke="${dark}" stroke-width="3"/>
      <path d="M ${100 + r * 0.6} ${cy - 5} q 55 -45 70 0 q -20 -5 -25 20 q -20 -15 -45 -5 z" fill="${light}" stroke="${dark}" stroke-width="3"/>`;
  }
  // Ears from Kid onward
  if (stage >= 2) {
    back += `
      <ellipse cx="${100 - r * 0.6}" cy="${cy - r * 0.8}" rx="${r * 0.25}" ry="${r * 0.35}" fill="${main}" stroke="${dark}" stroke-width="3"/>
      <ellipse cx="${100 + r * 0.6}" cy="${cy - r * 0.8}" rx="${r * 0.25}" ry="${r * 0.35}" fill="${main}" stroke="${dark}" stroke-width="3"/>`;
  }
  // Horns from Teen onward
  if (stage >= 3) {
    back += `
      <path d="M ${100 - 14} ${cy - r * 0.9} l 6 -22 l 8 20 z" fill="#ffd36e" stroke="#c99a2e" stroke-width="2"/>
      <path d="M ${100 + 2} ${cy - r * 0.92} l 8 -22 l 6 22 z" fill="#ffd36e" stroke="#c99a2e" stroke-width="2"/>`;
    front += `
      <ellipse cx="${100 - r * 0.45}" cy="183" rx="16" ry="8" fill="${dark}"/>
      <ellipse cx="${100 + r * 0.45}" cy="183" rx="16" ry="8" fill="${dark}"/>`;
  }
  // Crown and sparkles for Legend
  if (stage >= 5) {
    front += `
      <path d="M 78 ${cy - r - 4} l 6 -26 l 10 14 l 6 -18 l 6 18 l 10 -14 l 6 26 z" fill="#ffd36e" stroke="#c99a2e" stroke-width="2"/>
      <text x="30" y="60" font-size="18">✨</text><text x="155" y="45" font-size="14">✨</text><text x="160" y="140" font-size="16">✨</text>`;
  }

  const belly = `<ellipse cx="100" cy="${cy + r * 0.35}" rx="${r * 0.55}" ry="${r * 0.45}" fill="${light}" opacity="0.8"/>`;
  const glow = stage >= 5 && mood !== "sad"
    ? `<circle cx="100" cy="${cy}" r="${r + 22}" fill="hsl(${hue} 90% 70%)" opacity="0.18"/>` : "";

  return `<svg viewBox="0 0 200 200">${shadow}
    <g class="pet-body">
      ${glow}${back}
      <ellipse cx="100" cy="${cy}" rx="${r}" ry="${r * 0.95}" fill="${main}" stroke="${dark}" stroke-width="3"/>
      ${belly}
      ${face(100, cy - r * 0.15, r * 0.8, mood)}
      ${front}
    </g></svg>`;
}

function drawGrave() {
  return `<svg viewBox="0 0 200 200">
    <ellipse cx="100" cy="188" rx="70" ry="8" fill="#000" opacity="0.12"/>
    <path d="M 55 185 L 55 85 Q 55 40 100 40 Q 145 40 145 85 L 145 185 Z" fill="#b8b3c9" stroke="#7d7795" stroke-width="3"/>
    <text x="100" y="105" text-anchor="middle" font-size="26" font-weight="800" fill="#5d5875" font-family="system-ui">RIP</text>
    <path d="M 85 130 L 115 130 M 100 118 L 100 160" stroke="#7d7795" stroke-width="5" stroke-linecap="round"/>
    <path d="M 40 186 q 10 -14 20 0 q 10 -12 20 0" fill="#6fbf73"/>
    <path d="M 125 186 q 10 -14 20 0 q 10 -12 20 0" fill="#6fbf73"/>
  </svg>`;
}
