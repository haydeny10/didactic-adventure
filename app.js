// Habit Pet: finish your habits to grow your pet. Skip them and it gets sick.

const SAVE_KEY = "habitpet-v1";
const XP_PER_HABIT = 10;
const HEAL_PER_HABIT = 5;
const PERFECT_DAY_BONUS = 5;
const MAX_DAMAGE_PER_DAY = 34; // missing everything 3 days in a row is fatal

// ---------- Dates (local time, as "YYYY-MM-DD") ----------
function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}

// ---------- Saving ----------
function freshState() {
  return { pet: null, habits: [], done: {}, perfectDays: [], graveyard: [] };
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return Object.assign(freshState(), JSON.parse(raw));
  } catch (e) { /* storage unavailable: start fresh */ }
  return freshState();
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

let state = load();

// ---------- Game rules ----------
function hatch(name) {
  const today = dayKey();
  state.pet = {
    name: name.trim().slice(0, 16) || "Blob",
    hue: Math.floor(Math.random() * 360),
    xp: 0,
    health: 100,
    born: today,
    lastChecked: today,
    bestStage: 0,
    alive: true,
  };
  state.done = {};
  state.perfectDays = [];
  save();
}

// Work out what happened on every day since the app was last opened.
function processMissedDays() {
  const pet = state.pet;
  if (!pet || !pet.alive) return null;
  const today = dayKey();
  let missedTotal = 0, damageTotal = 0;

  for (let d = pet.lastChecked; d < today; d = addDays(d, 1)) {
    const total = state.habits.length;
    if (total === 0) continue;
    const ids = new Set(state.habits.map(h => h.id));
    const doneCount = (state.done[d] || []).filter(id => ids.has(id)).length;
    const missed = total - doneCount;

    if (missed === 0) {
      pet.health = Math.min(100, pet.health + PERFECT_DAY_BONUS);
      if (!state.perfectDays.includes(d)) state.perfectDays.push(d);
    } else {
      const damage = Math.round(MAX_DAMAGE_PER_DAY * missed / total);
      pet.health -= damage;
      missedTotal += missed;
      damageTotal += damage;
    }

    if (pet.health <= 0) {
      pet.health = 0;
      pet.alive = false;
      pet.diedOn = addDays(d, 1);
      state.graveyard.unshift({
        name: pet.name,
        stage: STAGES[stageIndexFor(pet.xp)].name,
        days: Math.max(1, daysBetween(pet.born, pet.diedOn)),
        diedOn: pet.diedOn,
      });
      break;
    }
  }
  pet.lastChecked = today;

  // Tidy old history (keep ~60 days)
  const cutoff = addDays(today, -60);
  for (const k of Object.keys(state.done)) if (k < cutoff) delete state.done[k];
  state.perfectDays = state.perfectDays.filter(k => k >= cutoff);

  save();
  return { missedTotal, damageTotal };
}

function toggleHabit(id) {
  const pet = state.pet;
  const today = dayKey();
  const list = state.done[today] || (state.done[today] = []);
  const i = list.indexOf(id);
  if (i === -1) {
    list.push(id);
    pet.xp += XP_PER_HABIT;
    pet.health = Math.min(100, pet.health + HEAL_PER_HABIT);
    bump();
  } else {
    list.splice(i, 1);
    pet.xp = Math.max(0, pet.xp - XP_PER_HABIT);
    pet.health = Math.max(1, pet.health - HEAL_PER_HABIT);
  }

  const stage = stageIndexFor(pet.xp);
  if (stage > pet.bestStage) {
    pet.bestStage = stage;
    save();
    render();
    showModal(
      `${pet.name} evolved!`,
      `${pet.name} is now a ${STAGES[stage].name}. Keep it up!`,
      drawPet(stage, "happy", pet.hue)
    );
    return;
  }
  save();
  render();
}

function addHabit(name, emoji) {
  state.habits.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim().slice(0, 40),
    emoji: emoji.trim() || "✅",
  });
  save();
  render();
}

function deleteHabit(id) {
  state.habits = state.habits.filter(h => h.id !== id);
  save();
  render();
}

function streak() {
  const today = dayKey();
  const todayDone = (state.done[today] || []).length;
  let count = 0;
  let d = addDays(today, -1);
  if (state.habits.length > 0 && state.habits.every(h => (state.done[today] || []).includes(h.id)) && todayDone > 0) {
    count = 1;
  }
  while (state.perfectDays.includes(d)) { count++; d = addDays(d, -1); }
  return count;
}

// ---------- Screen ----------
const $ = id => document.getElementById(id);

function speechFor(pet, doneToday, total) {
  const mood = moodFor(pet.health);
  if (total === 0) return "Give me some habits to do! 🥺";
  if (doneToday === total) return ["All done! I feel amazing! 🌟", "Best day ever! 💖", "You did it! I'm so proud!"][Math.floor(Math.random() * 3)];
  if (mood === "sad") return "I don't feel well... please do your habits 😢";
  if (mood === "ok") return `I'm a bit hungry... ${total - doneToday} to go!`;
  if (doneToday === 0) return "Good day! Let's do some habits!";
  return `Nice! ${total - doneToday} more to go!`;
}

function render() {
  const pet = state.pet;
  $("hatch-screen").classList.toggle("hidden", !!pet);
  $("pet-screen").classList.toggle("hidden", !pet || !pet.alive);
  $("dead-screen").classList.toggle("hidden", !pet || pet.alive);

  if (!pet) {
    $("hatch-egg").innerHTML = drawPet(0, "happy", 280);
    $("hatch-egg").className = "pet-stage small mood-egg";
    return;
  }

  if (!pet.alive) {
    $("dead-stage").innerHTML = drawGrave();
    $("dead-title").textContent = `${pet.name} has died 💔`;
    const days = Math.max(1, daysBetween(pet.born, pet.diedOn));
    $("dead-text").textContent =
      `${pet.name} lived for ${days} day${days === 1 ? "" : "s"} and reached the ${STAGES[stageIndexFor(pet.xp)].name} stage. ` +
      `Too many habits were skipped. Want to try again with a new egg?`;
    return;
  }

  const today = dayKey();
  const doneList = state.done[today] || [];
  const total = state.habits.length;
  const doneToday = state.habits.filter(h => doneList.includes(h.id)).length;
  const stage = stageIndexFor(pet.xp);
  const mood = moodFor(pet.health);
  const age = daysBetween(pet.born, today) + 1;

  $("pet-name").textContent = pet.name;
  $("pet-sub").textContent = `${STAGES[stage].name} · Day ${age}`;
  $("streak").textContent = streak();

  const stageEl = $("pet-stage");
  stageEl.innerHTML = drawPet(stage, mood, pet.hue);
  stageEl.className = "pet-stage " + (stage === 0 && mood !== "sad" ? "mood-egg" : "mood-" + mood);

  $("speech").textContent = speechFor(pet, doneToday, total);

  $("health-text").textContent = `${pet.health} / 100`;
  $("health-bar").style.width = pet.health + "%";

  const next = STAGES[stage + 1];
  if (next) {
    const from = STAGES[stage].xp;
    $("xp-text").textContent = `${pet.xp - from} / ${next.xp - from} to ${next.name}`;
    $("xp-bar").style.width = ((pet.xp - from) / (next.xp - from) * 100) + "%";
  } else {
    $("xp-text").textContent = `${pet.xp} · Max level!`;
    $("xp-bar").style.width = "100%";
  }

  $("today-count").textContent = `${doneToday} / ${total}`;
  $("no-habits").classList.toggle("hidden", total > 0);

  const list = $("habit-list");
  list.innerHTML = "";
  for (const h of state.habits) {
    const li = document.createElement("li");
    li.className = "habit" + (doneList.includes(h.id) ? " done" : "");
    li.innerHTML = `<span class="check">✓</span><span class="emoji"></span><span class="name"></span>
      <button class="delete" aria-label="Delete habit">✕</button>`;
    li.querySelector(".emoji").textContent = h.emoji;
    li.querySelector(".name").textContent = h.name;
    li.addEventListener("click", () => toggleHabit(h.id));
    li.querySelector(".delete").addEventListener("click", e => {
      e.stopPropagation();
      if (confirm(`Delete "${h.name}"?`)) deleteHabit(h.id);
    });
    list.appendChild(li);
  }

  $("grave-count").textContent = state.graveyard.length;
  $("graveyard-box").classList.toggle("hidden", state.graveyard.length === 0);
  $("graveyard").innerHTML = "";
  for (const g of state.graveyard) {
    const li = document.createElement("li");
    li.textContent = `🪦 ${g.name}: ${g.stage}, lived ${g.days} day${g.days === 1 ? "" : "s"}`;
    $("graveyard").appendChild(li);
  }
}

function bump() {
  const el = $("pet-stage");
  el.classList.remove("jump");
  void el.offsetWidth; // restart animation
  el.classList.add("jump");
  setTimeout(() => el.classList.remove("jump"), 500);
  const heart = document.createElement("span");
  heart.className = "heart";
  heart.textContent = "💖";
  el.appendChild(heart);
  setTimeout(() => heart.remove(), 1000);
}

function showModal(title, text, svg, button = "Yay!") {
  $("modal-title").textContent = title;
  $("modal-text").textContent = text;
  $("modal-pet").innerHTML = svg || "";
  $("modal-ok").textContent = button;
  $("modal").classList.remove("hidden");
}

// Check for a new day, and tell the player if the pet got hurt.
function checkDay() {
  const result = processMissedDays();
  render();
  const pet = state.pet;
  if (result && pet && pet.alive && result.damageTotal > 0) {
    showModal(
      `${pet.name} got sick 🤒`,
      `You missed ${result.missedTotal} habit${result.missedTotal === 1 ? "" : "s"}, so ${pet.name} lost ${result.damageTotal} health. Do your habits today to help them get better!`,
      drawPet(stageIndexFor(pet.xp), "sad", pet.hue),
      "I'll do better"
    );
  }
}

// ---------- Buttons ----------
$("hatch-form").addEventListener("submit", e => {
  e.preventDefault();
  hatch($("hatch-name").value);
  $("hatch-name").value = "";
  render();
});

$("habit-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("habit-name").value;
  if (!name.trim()) return;
  addHabit(name, $("habit-emoji").value);
  $("habit-name").value = "";
  $("habit-emoji").value = "";
  $("habit-name").focus();
});

$("restart-btn").addEventListener("click", () => {
  state.pet = null;
  save();
  render();
});

$("modal-ok").addEventListener("click", () => $("modal").classList.add("hidden"));

$("pet-stage").addEventListener("click", () => {
  bump();
  const lines = ["Hehe! 😊", "That tickles!", "I love you! 💖", "Let's do our habits!", "*happy noises*"];
  if (moodFor(state.pet.health) === "sad") $("speech").textContent = "I'm not feeling great... 😢";
  else $("speech").textContent = lines[Math.floor(Math.random() * lines.length)];
});

// Re-check when the app comes back into view (e.g. the next morning).
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(); });
setInterval(() => { if (state.pet && state.pet.lastChecked !== dayKey()) checkDay(); }, 60000);

checkDay();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
