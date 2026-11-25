# Habit Pet 🐣

A habit tracker where your habits keep a little pet alive.

- **Do your habits** and your pet grows: Egg → Baby → Kid → Teen → Adult → Legend.
- **Skip them** and it gets sick. Miss everything for about 3 days and it dies 🪦.
- Each finished habit gives **+10 growth** and **+5 health**. A perfect day gives a bonus **+5 health**.
- Missed habits cost up to **34 health per day**, depending on how many you skipped.
- 🔥 tracks your streak of perfect days. Tap your pet to say hi.

## Run it

It is a plain web app with no build step. From this folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Put it on your phone

1. Host it for free with GitHub Pages: repo **Settings → Pages**, pick the branch and the `/ (root)` folder.
2. Open the link on your phone.
3. **iPhone:** Share → *Add to Home Screen*. **Android:** menu → *Install app*.

Your pet and habits are saved on your device and the app works offline.

## Files

- `index.html`: the screens
- `style.css`: the look
- `pet.js`: draws the pet for each stage and mood
- `app.js`: the game rules (growth, health, missed days, death)
- `sw.js` + `manifest.json`: let it install like an app and work offline
