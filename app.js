// Habit Pet: finish your habits to grow your pet. Skip them and it gets sick.

const SAVE_KEY = "habitpet-v1";
const MAX_DAMAGE_PER_DAY = 34;   // missing everything 3 days in a row is fatal
const PERFECT_DAY_BONUS = 5;
const RESCUE_BELOW = 25;
const RESCUE_HEALTH = 60;
const START_COINS = 20;
const KEEP_DAYS = 120;

const DIFFICULTY = {
  easy:   { label: "Easy",   xp: 5,  heal: 3, coins: 1 },
  medium: { label: "Medium", xp: 10, heal: 5, coins: 2 },
  hard:   { label: "Hard",   xp: 20, heal: 8, coins: 4 },
};
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];   // Sunday first, like Date.getDay()
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------- Dates (local time, as "YYYY-MM-DD") ----------
function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function toDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(key, n) {
  const d = toDate(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}
function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}
function weekOf(key) {           // the Monday that starts this day's week
  const wd = (toDate(key).getDay() + 6) % 7;
  return addDays(key, -wd);
}
function plural(n, word) { return `${n} ${word}${n === 1 ? "" : "s"}`; }

// ---------- Saving ----------
function freshState() {
  return {
    version: 2,
    pet: null,
    habits: [],
    done: {},          // day -> { habitId: count }
    rewarded: {},      // day -> { habitId: true }  (coins are only paid once a day)
    log: {},           // day -> { result: "perfect" | "partial" | "fail" | "pass" | "none", score }
    passes: {},        // week -> day the sick-day pass was used
    coins: START_COINS,
    owned: [],
    placed: [],
    hat: null,
    wallpaper: "lavender",
    badges: {},
    stats: { habitsDone: 0, perfectDays: 0, bestStreak: 0, bestStage: 0, rescues: 0, petsHatched: 0 },
    graveyard: [],
    settings: { remindOn: false, remindTime: "19:00", lastReminded: null },
  };
}

// Upgrade saves from the first version of the app.
function migrate(s) {
  const base = freshState();
  if (!s.version) {
    s.habits = (s.habits || []).map(h => ({ difficulty: "medium", days: [0, 1, 2, 3, 4, 5, 6], target: 1, ...h }));
    const done = {};
    for (const [day, ids] of Object.entries(s.done || {})) {
      done[day] = {};
      for (const id of ids) done[day][id] = 1;
    }
    s.done = done;
    s.log = {};
    for (const d of s.perfectDays || []) s.log[d] = { result: "perfect", score: 1 };
    delete s.perfectDays;
    if (s.pet) {
      s.pet.type = s.pet.type || "blob";
      base.stats.bestStage = s.pet.bestStage || 0;
      base.stats.petsHatched = 1;
    }
    s.version = 2;
  }
  const out = Object.assign(base, s);
  out.stats = Object.assign(freshState().stats, base.stats, s.stats || {});
  out.settings = Object.assign(freshState().settings, s.settings || {});
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { /* storage unavailable or broken: start fresh */ }
  return freshState();
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

let state = load();

// Things that only matter while the app is open
const session = { tab: "home", sulk: false, awakeUntil: 0, hatchType: "blob", hatchHue: PET_COLOURS[0], editing: null, formDifficulty: "medium", formDays: [] };

// ---------- Habits ----------
function scheduledOn(day) {
  const wd = toDate(day).getDay();
  return state.habits.filter(h => h.days.includes(wd));
}
function countOf(day, id) { return (state.done[day] && state.done[day][id]) || 0; }
function isComplete(day, h) { return countOf(day, h.id) >= h.target; }
function setCount(day, id, n) {
  if (!state.done[day]) state.done[day] = {};
  if (n <= 0) delete state.done[day][id]; else state.done[day][id] = n;
}
// 0 = nothing done, 1 = everything done (partial counts help)
function dayScore(day) {
  const list = scheduledOn(day);
  if (list.length === 0) return null;
  const sum = list.reduce((a, h) => a + Math.min(1, countOf(day, h.id) / h.target), 0);
  return sum / list.length;
}
function todayAllDone() {
  const t = dayKey();
  const list = scheduledOn(t);
  return list.length > 0 && list.every(h => isComplete(t, h));
}

// ---------- Pet rules ----------
function hatch(name) {
  const today = dayKey();
  state.pet = {
    name: name.trim().slice(0, 16) || "Blob",
    type: session.hatchType,
    hue: session.hatchHue,
    xp: 0,
    health: 100,
    born: today,
    lastChecked: today,
    lastOpened: today,
    bestStage: 0,
    alive: true,
  };
  state.stats.petsHatched++;
  save();
  checkBadges();
}

function stageNow() { return stageIndexFor(state.pet.xp); }

function isNight() {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

function currentMood() {
  const pet = state.pet;
  if (isNight() && Date.now() > session.awakeUntil) return "sleep";
  const base = moodFor(pet.health);
  if (base === "sad") return "sad";
  if (session.sulk) return "sulk";
  return base;
}

// Work out what happened on every day since the app was last opened.
function processMissedDays() {
  const pet = state.pet;
  if (!pet || !pet.alive) return null;
  const today = dayKey();
  const result = { damage: 0, badDays: 0, passDay: null, died: false };

  for (let d = pet.lastChecked; d < today; d = addDays(d, 1)) {
    const score = dayScore(d);
    if (score === null) {
      state.log[d] = { result: "none", score: null };
    } else if (score >= 1) {
      state.log[d] = { result: "perfect", score: 1 };
      pet.health = Math.min(100, pet.health + PERFECT_DAY_BONUS);
      state.stats.perfectDays++;
    } else if (!state.passes[weekOf(d)]) {
      state.passes[weekOf(d)] = d;
      state.log[d] = { result: "pass", score };
      result.passDay = d;
    } else {
      const damage = Math.max(1, Math.round(MAX_DAMAGE_PER_DAY * (1 - score)));
      pet.health -= damage;
      result.damage += damage;
      result.badDays++;
      state.log[d] = { result: score > 0 ? "partial" : "fail", score };
    }

    if (pet.health <= 0) {
      pet.health = 0;
      pet.alive = false;
      pet.diedOn = addDays(d, 1);
      state.graveyard.unshift({
        name: pet.name,
        type: pet.type,
        stage: STAGES[stageNow()].name,
        days: Math.max(1, daysBetween(pet.born, pet.diedOn)),
        diedOn: pet.diedOn,
      });
      result.died = true;
      break;
    }
  }
  pet.lastChecked = today;

  // Tidy old history
  const cutoff = addDays(today, -KEEP_DAYS);
  for (const store of [state.done, state.rewarded, state.log]) {
    for (const k of Object.keys(store)) if (k < cutoff) delete store[k];
  }
  for (const k of Object.keys(state.passes)) if (k < cutoff) delete state.passes[k];

  save();
  return result;
}

function streak() {
  const pet = state.pet;
  if (!pet) return 0;
  let count = todayAllDone() ? 1 : 0;
  let d = addDays(dayKey(), -1);
  for (let i = 0; i < 400 && d >= pet.born; i++, d = addDays(d, -1)) {
    const entry = state.log[d];
    if (!entry) break;
    if (entry.result === "perfect") count++;
    else if (entry.result === "partial" || entry.result === "fail") break;
    // "pass" and "none" days don't break the streak
  }
  if (count > state.stats.bestStreak) state.stats.bestStreak = count;
  return count;
}

function completeHabit(h) {
  const pet = state.pet, today = dayKey();
  const r = DIFFICULTY[h.difficulty];
  pet.xp += r.xp;
  pet.health = Math.min(100, pet.health + r.heal);
  if (!state.rewarded[today]) state.rewarded[today] = {};
  if (!state.rewarded[today][h.id]) {
    state.rewarded[today][h.id] = true;
    state.coins += r.coins;
    state.stats.habitsDone++;
  }
  session.sulk = false;
}

function uncompleteHabit(h) {
  const pet = state.pet;
  const r = DIFFICULTY[h.difficulty];
  pet.xp = Math.max(0, pet.xp - r.xp);
  pet.health = Math.max(1, pet.health - r.heal);
}

function tapHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (!h) return;
  const today = dayKey();
  const c = countOf(today, id);
  if (c >= h.target) {
    setCount(today, id, 0);      // tapping a finished habit un-ticks it
    uncompleteHabit(h);
  } else {
    setCount(today, id, c + 1);
    if (c + 1 >= h.target) completeHabit(h);
    bump();
  }
  afterChange();
}

function minusHabit(id) {
  const h = state.habits.find(x => x.id === id);
  const today = dayKey();
  const c = countOf(today, id);
  if (!h || c === 0) return;
  if (c >= h.target) uncompleteHabit(h);
  setCount(today, id, c - 1);
  afterChange();
}

// Checks that run after anything changes: evolving, rescues, badges.
function afterChange() {
  const pet = state.pet, today = dayKey();
  const stage = stageNow();
  if (stage > pet.bestStage) {
    pet.bestStage = stage;
    state.stats.bestStage = Math.max(state.stats.bestStage, stage);
    queueModal(`${pet.name} evolved!`, `${pet.name} is now a ${STAGES[stage].name}! New outfits might be waiting in the shop.`,
      drawPet({ stage, mood: "happy", hue: pet.hue, type: pet.type, hat: state.hat }));
  }
  if (pet.rescue === today && pet.rescued !== today && todayAllDone()) {
    pet.rescued = today;
    pet.health = Math.max(pet.health, RESCUE_HEALTH);
    state.stats.rescues++;
    queueModal("Rescue complete! 🦸", `You saved ${pet.name}! Their health is back up to ${pet.health}.`,
      drawPet({ stage, mood: "happy", hue: pet.hue, type: pet.type, hat: state.hat }), "Hooray!");
  }
  save();
  checkBadges();
  render();
}

// ---------- Badges ----------
const BADGES = [
  { id: "first",     icon: "🌱", name: "First step",    desc: "Finish your first habit",        coins: 5,  test: s => s.stats.habitsDone >= 1 },
  { id: "hatched",   icon: "🐣", name: "Hatched!",      desc: "Grow a pet into a Baby",         coins: 5,  test: s => s.stats.bestStage >= 1 },
  { id: "perfect",   icon: "⭐", name: "Perfect day",   desc: "Finish every habit in a day",    coins: 5,  test: s => s.stats.perfectDays >= 1 || todayAllDone() },
  { id: "streak3",   icon: "🔥", name: "On fire",       desc: "Get a 3-day streak",             coins: 10, test: s => s.stats.bestStreak >= 3 },
  { id: "kid",       icon: "🧒", name: "Growing up",    desc: "Grow a pet into a Kid",          coins: 10, test: s => s.stats.bestStage >= 2 },
  { id: "habits50",  icon: "💪", name: "Habit hero",    desc: "Finish 50 habits",               coins: 15, test: s => s.stats.habitsDone >= 50 },
  { id: "streak7",   icon: "📅", name: "Full week",     desc: "Get a 7-day streak",             coins: 20, test: s => s.stats.bestStreak >= 7 },
  { id: "shopper",   icon: "🛍️", name: "Shopper",       desc: "Buy something from the shop",    coins: 5,  test: s => s.owned.length >= 1 },
  { id: "fashion",   icon: "👒", name: "Fashionista",   desc: "Own 3 outfits",                  coins: 15, test: s => s.owned.filter(id => HATS.some(h => h.id === id)).length >= 3 },
  { id: "decorator", icon: "🛋️", name: "Decorator",     desc: "Own 5 room items",               coins: 15, test: s => s.owned.filter(id => FURNITURE.some(f => f.id === id)).length >= 5 },
  { id: "rescue",    icon: "🦸", name: "Lifesaver",     desc: "Finish a rescue mission",        coins: 15, test: s => s.stats.rescues >= 1 },
  { id: "adult",     icon: "🦋", name: "All grown up",  desc: "Grow a pet into an Adult",       coins: 25, test: s => s.stats.bestStage >= 4 },
  { id: "month",     icon: "🎂", name: "Survivor",      desc: "Keep a pet alive for 30 days",   coins: 30, test: s => s.pet && s.pet.alive && daysBetween(s.pet.born, dayKey()) >= 29 },
  { id: "comeback",  icon: "🌈", name: "Never give up", desc: "Hatch a new pet after losing one", coins: 10, test: s => s.graveyard.length >= 1 && s.pet && s.pet.alive },
  { id: "habits250", icon: "🏅", name: "Unstoppable",   desc: "Finish 250 habits",              coins: 40, test: s => s.stats.habitsDone >= 250 },
  { id: "streak30",  icon: "🌟", name: "Month of magic", desc: "Get a 30-day streak",           coins: 50, test: s => s.stats.bestStreak >= 30 },
  { id: "legend",    icon: "👑", name: "Legendary",     desc: "Grow a pet into a Legend",       coins: 50, test: s => s.stats.bestStage >= 5 },
];

function checkBadges() {
  streak();   // keeps bestStreak up to date
  for (const b of BADGES) {
    if (state.badges[b.id]) continue;
    let ok = false;
    try { ok = b.test(state); } catch (e) { ok = false; }
    if (ok) {
      state.badges[b.id] = dayKey();
      state.coins += b.coins;
      toast(`${b.icon} Badge unlocked: ${b.name}! +${b.coins} 🪙`);
    }
  }
  save();
}

// ---------- Shop ----------
function buy(id, price) {
  if (state.coins < price) { toast("Not enough coins yet. Finish some habits! 🪙"); return; }
  state.coins -= price;
  state.owned.push(id);
  toast("Bought! 🎉");
  save();
  checkBadges();
}

function shopClick(kind, item) {
  const owned = state.owned.includes(item.id) || item.price === 0;
  if (kind === "hat") {
    if (state.stats.bestStage < item.stage) return;
    if (!owned) { buy(item.id, item.price); if (!state.owned.includes(item.id)) return; }
    state.hat = state.hat === item.id ? null : item.id;
  } else if (kind === "furniture") {
    if (!owned) { buy(item.id, item.price); if (!state.owned.includes(item.id)) return; state.placed.push(item.id); }
    else if (state.placed.includes(item.id)) state.placed = state.placed.filter(x => x !== item.id);
    else state.placed.push(item.id);
  } else if (kind === "wall") {
    if (!owned) { buy(item.id, item.price); if (!state.owned.includes(item.id)) return; }
    state.wallpaper = item.id;
  }
  save();
  render();
}

// ---------- Screen ----------
const $ = id => document.getElementById(id);

function speechFor(mood, doneToday, total) {
  const pet = state.pet;
  if (mood === "sleep") return "Zzz... 💤 (tap to wake me)";
  if (mood === "sulk") return "Hmph! Where have you been?! 😤";
  if (pet.rescue === dayKey() && pet.rescued !== dayKey()) return "Please help me... I feel really sick 🤒";
  if (total === 0) return state.habits.length ? "No habits today. Let's chill! 😌" : "Give me some habits to do! 🥺";
  if (doneToday === total) return ["All done! I feel amazing! 🌟", "Best day ever! 💖", "You did it! I'm so proud!"][new Date().getMinutes() % 3];
  if (mood === "sad") return "I don't feel well... please do your habits 😢";
  if (mood === "ok") return `I'm a bit hungry... ${total - doneToday} to go!`;
  if (doneToday === 0) return "Good day! Let's do some habits!";
  return `Nice! ${total - doneToday} more to go!`;
}

function render() {
  const pet = state.pet;
  const alive = pet && pet.alive;
  $("hatch-screen").classList.toggle("hidden", !!pet);
  $("game").classList.toggle("hidden", !alive);
  $("tabbar").classList.toggle("hidden", !alive);
  $("dead-screen").classList.toggle("hidden", !pet || alive);

  if (!pet) return renderHatch();
  if (!alive) return renderDead();

  $("pet-name").textContent = pet.name;
  $("pet-sub").textContent = `${STAGES[stageNow()].name} ${PET_TYPES.find(t => t.id === pet.type).name} · Day ${daysBetween(pet.born, dayKey()) + 1}`;
  $("coins").textContent = state.coins;
  $("streak").textContent = streak();

  for (const t of ["home", "shop", "badges", "stats"]) $("tab-" + t).classList.toggle("hidden", session.tab !== t);
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.tab === session.tab));

  if (session.tab === "home") renderHome();
  if (session.tab === "shop") renderShop();
  if (session.tab === "badges") renderBadges();
  if (session.tab === "stats") renderStats();
}

function renderHatch() {
  $("hatch-preview").innerHTML = drawPet({ stage: 1, mood: "happy", hue: session.hatchHue, type: session.hatchType });
  $("hatch-preview").className = "pet-stage small mood-happy";
  const tp = $("type-picker");
  tp.innerHTML = "";
  for (const t of PET_TYPES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (session.hatchType === t.id ? " active" : "");
    b.innerHTML = `<span class="chip-pic">${drawPet({ stage: 1, mood: "happy", hue: session.hatchHue, type: t.id })}</span>${t.name}`;
    b.onclick = () => { session.hatchType = t.id; renderHatch(); };
    tp.appendChild(b);
  }
  const cp = $("colour-picker");
  cp.innerHTML = "";
  for (const hue of PET_COLOURS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (session.hatchHue === hue ? " active" : "");
    b.style.background = `hsl(${hue} 75% 66%)`;
    b.setAttribute("aria-label", "Colour");
    b.onclick = () => { session.hatchHue = hue; renderHatch(); };
    cp.appendChild(b);
  }
}

function renderDead() {
  const pet = state.pet;
  $("dead-stage").innerHTML = drawGrave();
  $("dead-title").textContent = `${pet.name} has died 💔`;
  const days = Math.max(1, daysBetween(pet.born, pet.diedOn));
  $("dead-text").textContent =
    `${pet.name} lived for ${plural(days, "day")} and reached the ${STAGES[stageNow()].name} stage. ` +
    `Too many habits were skipped. Your coins, outfits and badges are safe. Want to try again with a new egg?`;
}

function renderHome() {
  const pet = state.pet;
  const today = dayKey();
  const list = scheduledOn(today);
  const doneToday = list.filter(h => isComplete(today, h)).length;
  const stage = stageNow();
  const mood = currentMood();

  const scene = $("scene");
  scene.innerHTML = drawScene({ stage, mood, hue: pet.hue, type: pet.type, hat: state.hat, placed: state.placed, wallpaper: state.wallpaper, night: isNight() });
  scene.className = "scene " + (mood === "sleep" ? "mood-sleep" : stage === 0 && mood !== "sad" ? "mood-egg" : "mood-" + mood);
  if (!session.speechLocked) $("speech").textContent = speechFor(mood, doneToday, list.length);

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

  const rescuing = pet.rescue === today && pet.rescued !== today;
  $("rescue-banner").classList.toggle("hidden", !rescuing);
  if (rescuing) $("rescue-text").textContent = `${pet.name} is very sick. Finish every habit today (${doneToday} / ${list.length} done) to bring them back up to ${RESCUE_HEALTH} health!`;

  $("today-title").textContent = DAY_NAMES[new Date().getDay()];
  $("today-count").textContent = `${doneToday} / ${list.length}`;
  $("no-habits").classList.toggle("hidden", list.length > 0);
  const others = state.habits.filter(h => !list.includes(h));
  $("not-today").classList.toggle("hidden", others.length === 0);
  $("not-today").textContent = `Not today: ${others.map(h => h.emoji + " " + h.name).join(", ")}`;
  const passDay = state.passes[weekOf(today)];
  $("pass-status").textContent = passDay
    ? `🛡️ Sick-day pass used on ${DAY_NAMES[toDate(passDay).getDay()]}. You get a new one on Monday.`
    : "🛡️ Sick-day pass ready: the first bad day this week won't hurt your pet.";

  const ul = $("habit-list");
  ul.innerHTML = "";
  for (const h of list) {
    const c = countOf(today, h.id);
    const done = c >= h.target;
    const li = document.createElement("li");
    li.className = "habit" + (done ? " done" : "");
    li.innerHTML = `
      <span class="check">${h.target > 1 && !done ? c : "✓"}</span>
      <span class="emoji"></span>
      <span class="info"><span class="name"></span><span class="meta"></span></span>
      ${h.target > 1 && c > 0 ? '<button class="icon-btn minus" aria-label="Take one away">−</button>' : ""}
      <button class="icon-btn edit" aria-label="Edit habit">✏️</button>`;
    li.querySelector(".emoji").textContent = h.emoji;
    li.querySelector(".name").textContent = h.name;
    li.querySelector(".meta").textContent = DIFFICULTY[h.difficulty].label + (h.target > 1 ? ` · ${Math.min(c, h.target)} / ${h.target}` : "");
    if (h.target > 1 && !done) li.style.setProperty("--progress", (c / h.target * 100) + "%");
    li.addEventListener("click", () => tapHabit(h.id));
    li.querySelector(".edit").addEventListener("click", e => { e.stopPropagation(); openHabitForm(h); });
    const minus = li.querySelector(".minus");
    if (minus) minus.addEventListener("click", e => { e.stopPropagation(); minusHabit(h.id); });
    ul.appendChild(li);
  }

  $("grave-count").textContent = state.graveyard.length;
  $("graveyard-box").classList.toggle("hidden", state.graveyard.length === 0);
  $("graveyard").innerHTML = "";
  for (const g of state.graveyard) {
    const li = document.createElement("li");
    li.textContent = `🪦 ${g.name}: ${g.stage}, lived ${plural(g.days, "day")}`;
    $("graveyard").appendChild(li);
  }
}

function shopButton(label, cls) { return `<span class="shop-btn ${cls || ""}">${label}</span>`; }

function renderShop() {
  const pet = state.pet, stage = stageNow();
  const hats = $("shop-hats");
  hats.innerHTML = "";
  for (const h of HATS) {
    const owned = state.owned.includes(h.id);
    const locked = state.stats.bestStage < h.stage;
    const el = document.createElement("button");
    el.className = "shop-item" + (locked ? " locked" : "") + (state.hat === h.id ? " active" : "");
    el.innerHTML = `<span class="shop-pic">${drawPet({ stage: Math.max(1, stage), mood: "happy", hue: pet.hue, type: pet.type, hat: h.id })}</span>
      <span class="shop-name">${h.name}</span>
      ${locked ? shopButton("🔒 Reach " + STAGES[h.stage].name, "lock")
        : !owned ? shopButton("🪙 " + h.price, state.coins >= h.price ? "buy" : "cant")
        : state.hat === h.id ? shopButton("Wearing ✓", "on") : shopButton("Wear")}`;
    el.onclick = () => shopClick("hat", h);
    hats.appendChild(el);
  }

  const furn = $("shop-furniture");
  furn.innerHTML = "";
  for (const f of FURNITURE) {
    const owned = state.owned.includes(f.id);
    const placed = state.placed.includes(f.id);
    const el = document.createElement("button");
    el.className = "shop-item" + (placed ? " active" : "");
    el.innerHTML = `<span class="shop-icon">${f.icon}</span><span class="shop-name">${f.name}</span>
      ${!owned ? shopButton("🪙 " + f.price, state.coins >= f.price ? "buy" : "cant")
        : placed ? shopButton("In room ✓", "on") : shopButton("Put out")}`;
    el.onclick = () => shopClick("furniture", f);
    furn.appendChild(el);
  }

  const walls = $("shop-walls");
  walls.innerHTML = "";
  for (const w of WALLPAPERS) {
    const owned = w.price === 0 || state.owned.includes(w.id);
    const el = document.createElement("button");
    el.className = "shop-item" + (state.wallpaper === w.id ? " active" : "");
    el.innerHTML = `<span class="shop-swatch" style="background:linear-gradient(${w.wall} 70%, ${w.floor} 70%)"></span>
      <span class="shop-name">${w.name}</span>
      ${!owned ? shopButton("🪙 " + w.price, state.coins >= w.price ? "buy" : "cant")
        : state.wallpaper === w.id ? shopButton("Using ✓", "on") : shopButton("Use")}`;
    el.onclick = () => shopClick("wall", w);
    walls.appendChild(el);
  }
}

function renderBadges() {
  const grid = $("badge-grid");
  grid.innerHTML = "";
  let got = 0;
  for (const b of BADGES) {
    const has = !!state.badges[b.id];
    if (has) got++;
    const el = document.createElement("div");
    el.className = "badge" + (has ? " got" : "");
    el.innerHTML = `<span class="badge-icon">${has ? b.icon : "🔒"}</span><strong></strong><span class="muted small"></span>`;
    el.querySelector("strong").textContent = b.name;
    el.querySelector(".small").textContent = has ? b.desc : `${b.desc} (+${b.coins} 🪙)`;
    grid.appendChild(el);
  }
  $("badge-count").textContent = `${got} / ${BADGES.length}`;
}

function renderStats() {
  const today = dayKey();
  const cal = $("calendar");
  cal.innerHTML = "";
  for (const l of ["M", "T", "W", "T", "F", "S", "S"]) {
    const h = document.createElement("div");
    h.className = "cal-head";
    h.textContent = l;
    cal.appendChild(h);
  }
  const start = addDays(weekOf(today), -28);
  for (let i = 0; i < 35; i++) {
    const d = addDays(start, i);
    const cell = document.createElement("div");
    let cls = "empty";
    if (d === today) {
      const s = dayScore(d);
      cls = s === null ? "none" : s >= 1 ? "perfect" : s > 0 ? "partial" : "none";
      cls += " today";
    } else if (d < today && state.log[d]) {
      cls = state.log[d].result;
    } else if (d > today) {
      cls = "future";
    }
    cell.className = "cal-day c-" + cls.split(" ")[0] + (cls.includes("today") ? " today" : "");
    cell.textContent = toDate(d).getDate();
    cal.appendChild(cell);
  }

  const s = state.stats;
  const numbers = [
    ["✅", s.habitsDone, "habits done"],
    ["⭐", s.perfectDays, "perfect days"],
    ["🔥", s.bestStreak, "best streak"],
    ["🐣", s.petsHatched, "pets hatched"],
    ["🦸", s.rescues, "rescues"],
    ["🏆", Object.keys(state.badges).length, "badges"],
  ];
  $("stat-grid").innerHTML = numbers.map(([i, n, l]) => `<div class="stat"><span>${i}</span><strong>${n}</strong><span class="muted small">${l}</span></div>`).join("");

  $("remind-time").value = state.settings.remindTime;
  $("remind-btn").textContent = state.settings.remindOn ? "Turn off" : "Turn on";
  $("remind-status").textContent = state.settings.remindOn
    ? `On: you'll get a nudge after ${state.settings.remindTime} if your habits aren't done.`
    : "Off";
}

// ---------- Little effects ----------
function bump() {
  const el = $("scene");
  el.classList.remove("jump");
  void el.offsetWidth; // restart the animation
  el.classList.add("jump");
  setTimeout(() => el.classList.remove("jump"), 500);
  const heart = document.createElement("span");
  heart.className = "heart";
  heart.textContent = "💖";
  el.appendChild(heart);
  setTimeout(() => heart.remove(), 1000);
}

function say(text, ms = 3000) {
  $("speech").textContent = text;
  session.speechLocked = true;
  clearTimeout(session.speechTimer);
  session.speechTimer = setTimeout(() => { session.speechLocked = false; render(); }, ms);
}

const modalQueue = [];
function queueModal(title, text, svg, button = "Yay!") {
  modalQueue.push({ title, text, svg, button });
  if ($("modal").classList.contains("hidden")) nextModal();
}
function nextModal() {
  const m = modalQueue.shift();
  if (!m) { $("modal").classList.add("hidden"); return; }
  $("modal-title").textContent = m.title;
  $("modal-text").textContent = m.text;
  $("modal-pet").innerHTML = m.svg || "";
  $("modal-ok").textContent = m.button;
  $("modal").classList.remove("hidden");
}

const toastQueue = [];
function toast(text) {
  toastQueue.push(text);
  if (toastQueue.length === 1) showToast();
}
function showToast() {
  if (!toastQueue.length) return;
  const el = $("toast");
  el.textContent = toastQueue[0];
  el.classList.remove("hidden");
  setTimeout(() => {
    el.classList.add("hidden");
    toastQueue.shift();
    setTimeout(showToast, 250);
  }, 2600);
}

// ---------- Opening the app ----------
function checkDay(opening) {
  const pet = state.pet;
  if (!pet) { render(); return; }
  const today = dayKey();
  const result = processMissedDays();

  if (pet.alive) {
    if (opening && pet.lastOpened && daysBetween(pet.lastOpened, today) >= 2) session.sulk = true;
    pet.lastOpened = today;

    if (result && result.passDay) {
      queueModal("Sick-day pass used 🛡️",
        `You missed some habits on ${DAY_NAMES[toDate(result.passDay).getDay()]}, but your sick-day pass protected ${pet.name}. You get a new pass every Monday.`,
        drawPet({ stage: stageNow(), mood: "ok", hue: pet.hue, type: pet.type, hat: state.hat }), "Phew!");
    }
    if (result && result.damage > 0) {
      queueModal(`${pet.name} got sick 🤒`,
        `You missed habits on ${plural(result.badDays, "day")}, so ${pet.name} lost ${result.damage} health. Do your habits today to help them get better!`,
        drawPet({ stage: stageNow(), mood: "sad", hue: pet.hue, type: pet.type, hat: state.hat }), "I'll do better");
    }
    if (pet.health < RESCUE_BELOW && pet.rescue !== today && scheduledOn(today).length > 0) {
      pet.rescue = today;
      queueModal("🚨 Rescue mission!",
        `${pet.name} is very sick. Finish every one of today's habits to bring them back up to ${RESCUE_HEALTH} health.`,
        drawPet({ stage: stageNow(), mood: "sad", hue: pet.hue, type: pet.type, hat: state.hat }), "I'm on it!");
    }
    save();
    checkBadges();
  }
  render();

  if (opening && pet.alive && currentMood() !== "sleep") {
    bump();
    if (!session.sulk) say(["You're back! 🎉", "Yay, you're here! 💖", "I missed you!"][Math.floor(Math.random() * 3)]);
  }
}

// ---------- Habit form ----------
function openHabitForm(h) {
  session.editing = h ? h.id : null;
  $("habit-form-title").textContent = h ? "Edit habit" : "New habit";
  $("hf-name").value = h ? h.name : "";
  $("hf-emoji").value = h ? h.emoji : "";
  $("hf-target").value = h ? h.target : 1;
  session.formDifficulty = h ? h.difficulty : "medium";
  session.formDays = h ? [...h.days] : [0, 1, 2, 3, 4, 5, 6];
  $("hf-delete").classList.toggle("hidden", !h);
  renderHabitForm();
  $("habit-modal").classList.remove("hidden");
  if (!h) setTimeout(() => $("hf-name").focus(), 50);
}

function renderHabitForm() {
  document.querySelectorAll("#hf-difficulty button").forEach(b => b.classList.toggle("active", b.dataset.v === session.formDifficulty));
  const r = DIFFICULTY[session.formDifficulty];
  $("hf-reward").textContent = `Each time: +${r.xp} growth, +${r.heal} health, +${r.coins} 🪙`;
  const days = $("hf-days");
  days.innerHTML = "";
  for (const wd of [1, 2, 3, 4, 5, 6, 0]) {   // Monday first
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = DAY_LETTERS[wd];
    b.setAttribute("aria-label", DAY_NAMES[wd]);
    b.className = session.formDays.includes(wd) ? "active" : "";
    b.onclick = () => {
      session.formDays = session.formDays.includes(wd) ? session.formDays.filter(x => x !== wd) : [...session.formDays, wd];
      renderHabitForm();
    };
    days.appendChild(b);
  }
}

// Keep just the first symbol someone typed (some emojis are made of several characters)
function firstEmoji(text) {
  const t = text.trim();
  if (!t) return "";
  if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter().segment(t)][0].segment;
  return [...t].slice(0, 2).join("");
}

function closeHabitForm() { $("habit-modal").classList.add("hidden"); }

$("hf-difficulty").addEventListener("click", e => {
  const v = e.target.dataset && e.target.dataset.v;
  if (v) { session.formDifficulty = v; renderHabitForm(); }
});
$("hf-minus").onclick = () => { $("hf-target").value = Math.max(1, (+$("hf-target").value || 1) - 1); };
$("hf-plus").onclick = () => { $("hf-target").value = Math.min(20, (+$("hf-target").value || 1) + 1); };
$("hf-cancel").onclick = closeHabitForm;

$("hf-delete").onclick = () => {
  const h = state.habits.find(x => x.id === session.editing);
  if (h && confirm(`Delete "${h.name}"?`)) {
    if (isComplete(dayKey(), h)) uncompleteHabit(h);
    state.habits = state.habits.filter(x => x.id !== h.id);
    closeHabitForm();
    afterChange();
  }
};

$("habit-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("hf-name").value.trim().slice(0, 40);
  if (!name) return;
  if (session.formDays.length === 0) { toast("Pick at least one day 📅"); return; }
  const target = Math.min(20, Math.max(1, Math.round(+$("hf-target").value || 1)));
  const fields = { name, emoji: firstEmoji($("hf-emoji").value) || "✅", difficulty: session.formDifficulty, days: session.formDays.sort(), target };

  if (session.editing) {
    const h = state.habits.find(x => x.id === session.editing);
    const today = dayKey();
    const wasDone = isComplete(today, h);
    const oldReward = h.difficulty;
    Object.assign(h, fields);
    // Keep today's rewards fair if the difficulty or target changed
    const nowDone = isComplete(today, h);
    if (wasDone) uncompleteHabit({ ...h, difficulty: oldReward });
    if (nowDone) { const r = DIFFICULTY[h.difficulty]; state.pet.xp += r.xp; state.pet.health = Math.min(100, state.pet.health + r.heal); }
    if (countOf(today, h.id) > h.target) setCount(today, h.id, h.target);
  } else {
    state.habits.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...fields });
  }
  closeHabitForm();
  afterChange();
});

// ---------- Reminders ----------
async function toggleReminders() {
  const st = state.settings;
  if (st.remindOn) { st.remindOn = false; save(); render(); return; }
  if (!("Notification" in window)) {
    toast("This browser can't show reminders. On iPhone, add the app to your Home Screen first.");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("Reminders are blocked. You can allow them in your phone's settings."); return; }
  st.remindOn = true;
  st.remindTime = $("remind-time").value || "19:00";
  save();
  render();
  toast("Reminders on! 🔔");
}

function checkReminder() {
  const st = state.settings, pet = state.pet;
  if (!st.remindOn || !pet || !pet.alive) return;
  const now = new Date(), today = dayKey();
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  if (hhmm < st.remindTime || st.lastReminded === today) return;
  const list = scheduledOn(today);
  const left = list.filter(h => !isComplete(today, h)).length;
  if (left === 0) return;
  st.lastReminded = today;
  save();
  const title = `${pet.name} is hungry! 🥺`;
  const body = `You still have ${plural(left, "habit")} to do today.`;
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: "icons/icon-192.png", tag: "habit-reminder" }));
    } else {
      new Notification(title, { body, icon: "icons/icon-192.png" });
    }
  } catch (e) { /* notifications unavailable */ }
}

$("remind-btn").onclick = toggleReminders;
$("remind-time").onchange = () => {
  state.settings.remindTime = $("remind-time").value || "19:00";
  state.settings.lastReminded = null;
  save();
  render();
};

// ---------- Sharing a picture ----------
async function sharePet() {
  const pet = state.pet;
  const W = 1000, H = 650, PAD = 130;
  const svg = drawScene({ stage: stageNow(), mood: currentMood() === "sleep" ? "sleep" : moodFor(pet.health), hue: pet.hue, type: pet.type, hat: state.hat, placed: state.placed, wallpaper: state.wallpaper, night: isNight(), width: W });
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H + PAD;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H + PAD);
    ctx.drawImage(img, 0, 0, W, H);
    ctx.fillStyle = "#241f3a";
    ctx.textAlign = "center";
    ctx.font = "bold 52px system-ui, sans-serif";
    ctx.fillText(pet.name, W / 2, H + 62);
    ctx.fillStyle = "#6e6890";
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillText(`${STAGES[stageNow()].name} · Day ${daysBetween(pet.born, dayKey()) + 1} · 🔥 ${streak()} day streak · Habit Pet`, W / 2, H + 108);
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    const file = new File([blob], `${pet.name}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Meet ${pet.name}!`, text: `Meet ${pet.name}, my Habit Pet! 🐾` });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${pet.name}.png`;
      a.click();
      toast("Picture saved! 📸");
    }
  } catch (e) {
    if (e && e.name !== "AbortError") toast("Couldn't make the picture, sorry!");
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Buttons ----------
$("hatch-form").addEventListener("submit", e => {
  e.preventDefault();
  hatch($("hatch-name").value);
  $("hatch-name").value = "";
  session.tab = "home";
  render();
});

$("restart-btn").addEventListener("click", () => {
  state.pet = null;
  save();
  render();
});

$("modal-ok").addEventListener("click", nextModal);
$("add-habit-btn").addEventListener("click", () => openHabitForm(null));
$("share-btn").addEventListener("click", sharePet);

$("scene").addEventListener("click", () => {
  const mood = currentMood();
  if (mood === "sleep") {
    session.awakeUntil = Date.now() + 60000;
    render();
    bump();
    say("*yawn* Oh, hi! 🥱");
    return;
  }
  bump();
  if (mood === "sad") say("I'm not feeling great... 😢");
  else if (mood === "sulk") say("...okay, maybe I missed you a little 😳");
  else say(["Hehe! 😊", "That tickles!", "I love you! 💖", "Let's do our habits!", "*happy noises*"][Math.floor(Math.random() * 5)]);
});

document.querySelectorAll(".tabbar button").forEach(b => {
  b.addEventListener("click", () => {
    session.tab = b.dataset.tab;
    render();
    window.scrollTo(0, 0);
  });
});

$("reset-btn").addEventListener("click", () => {
  if (confirm("Delete your pet, habits, coins, badges and everything else?") && confirm("Are you really sure? This can't be undone.")) {
    state = freshState();
    save();
    session.tab = "home";
    render();
  }
});

// Re-check when the app comes back into view (e.g. the next morning).
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(true); });
setInterval(() => {
  if (state.pet && state.pet.alive && state.pet.lastChecked !== dayKey()) checkDay(false);
  checkReminder();
  if (state.pet && state.pet.alive && session.tab === "home") render();   // keeps night/day up to date
}, 30000);

checkDay(true);
checkReminder();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
