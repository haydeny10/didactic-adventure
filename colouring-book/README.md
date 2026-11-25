# Colour My Photo 🖍️

Turn any photo into a colouring page, then colour it in on your phone or iPad.

## How it works

1. **Choose a photo** (or tap *Try a sample*). The app turns it into black outlines.
2. Move the **Simple ↔ Detailed** slider until you like the lines.
3. Tap **Start colouring**.

### Colouring
- 🪣 **Fill**: tap a shape to fill it with colour.
- 🖌️ **Brush**: colour freely. The brush size stays the same on screen, so zoom in for small bits.
- 🧽 **Eraser**: rub out back to white. The black lines can't be erased.
- **Pinch** with two fingers to zoom and move around. ⤢ fits the page back on screen.
- ✏️ **Apple Pencil**: once you use a Pencil, the Pencil draws and your fingers only zoom and move, so your hand resting on the screen won't leave marks.
- ↶ **Undo** goes back up to 12 steps.
- 💾 **Save** shares the finished picture (save it to Photos or send it to a friend).
- 🖨️ on the *Make your page* screen saves the blank outline so you can print it.

Your pages save automatically on your device and show up under **My pages**. Photos never leave the device.

## Run it

From this folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

To put it on an iPad or phone, host the repo with GitHub Pages and open `/colouring-book/`, then use Share → *Add to Home Screen* in Safari.
