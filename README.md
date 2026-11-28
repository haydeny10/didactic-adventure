# Habit Pet 🐣

A habit tracker where your habits keep a little pet alive.

## How it works

- **Hatch a pet**: pick a Blob, Cat, Dragon, Slime or Robot, and a colour.
- **Do your habits** and your pet grows: Egg → Baby → Kid → Teen → Adult → Legend.
- **Skip them** and it gets sick. Miss everything for about 3 days and it dies 🪦.

### Habits
- **Choose the days**: a gym habit can be Mon/Wed/Fri only. Days off never hurt your pet.
- **Several times a day**: e.g. "Drink water ×8". Tap to count up, and use − to take one off.
- **Easy / Medium / Hard**: harder habits give more growth, health and coins.

| | Growth | Health | Coins |
|---|---|---|---|
| Easy | +5 | +3 | +1 |
| Medium | +10 | +5 | +2 |
| Hard | +20 | +8 | +4 |

### Keeping your pet alive
- A day with everything done gives **+5 health**. Missed habits cost up to **34 health** per day.
- 🛡️ **Sick-day pass**: the first bad day each week (Mon–Sun) is forgiven automatically.
- 🚨 **Rescue mission**: if health drops below 25, finish every habit that day to jump back to 60.

### Fun stuff
- 🚀 **Pet Patrol**: a mini space shooter on the Play tab. Your pet shoots down waves of bad habits (📱🍩🛋️). Healthier pets get more lives (3 / 2 / 1). Clearing a wave pays 1 🪙, up to 10 a day.
- 👒 **Outfits**: 8 hats and accessories. Better ones unlock as your pets grow up.
- 🛋️ **Room**: buy furniture and wallpaper to decorate your pet's room.
- 🏆 **17 badges**, each with a coin reward.
- 📅 **Calendar** of the last 5 weeks plus your stats.
- 😴 Your pet **sleeps at night** (10pm–6am), gets **excited** when you come back, and **sulks** if you stay away for 2+ days.
- 📸 **Share a picture** of your pet and its room.
- 🔔 **Reminders** at a time you choose. Phones only show these while the app is still open in the background.

Coins, outfits, furniture and badges stay with you even if a pet dies.

## Run it

It is a plain web app with no build step. From this folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Put it on your phone

1. Host it for free with GitHub Pages: repo **Settings → Pages**, pick the branch and the `/ (root)` folder.
2. Open the link on your phone.
3. **iPhone:** in Safari, tap Share → *Add to Home Screen*. **Android:** in Chrome, tap ⋮ → *Install app*.

Your pet and habits are saved on your device, and the app works offline.

## Files

- `index.html`: the screens
- `style.css`: the look
- `pet.js`: draws the pets, outfits and room
- `app.js`: the game rules, shop, badges, stats and reminders
- `sw.js` + `manifest.json`: let it install like an app and work offline
