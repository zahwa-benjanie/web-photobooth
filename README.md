[README.md](https://github.com/user-attachments/files/32270161/README.md)
# Snapiku — Web Photobooth

A browser-based photobooth built with **plain HTML, CSS, and JavaScript** — no
frameworks, no build step, no dependencies. Open `index.html` (served over
`http://` or `https://`, not `file://`) and it runs.

**Live idea:** pick a frame → the app tells you how many shots that frame
needs → hit **Start Snap** → a 3-second countdown fires before each photo →
your shots are automatically composited into the frame → download the result
as a PNG.

## Features

- **Camera access** via `navigator.mediaDevices.getUserMedia`, with a mirrored
  live preview for a natural selfie feel.
- **Countdown burst capture** — a 3-second countdown before every shot, taking
  as many photos in a row as the selected frame needs (1 to 4).
- **Five custom frame templates**, each a hand-designed transparent PNG.
- **Photo filters** — Normal, Black & White, Sepia, Mint Duotone, and
  Dreamy Haze — applied live at capture time.
- **EN / ID language toggle** in the top-right corner, switching every piece
  of UI copy (labels, hints, buttons, camera messages, the date stamp)
  between Bahasa Indonesia and English instantly.
- **Custom text stamp** plus an optional auto date stamp, rendered as a strip
  under the framed photo.
- **Download as PNG** at full resolution, client-side, no server involved.
- Responsive layout, keyboard-focus styles, and `prefers-reduced-motion`
  support.

## How the frame compositing works

Each frame PNG (`assets/frames/*.png`) has **real alpha transparency** in the
spots where a photo should show — an oval, a heart, a cloud, a rectangle,
whatever the design calls for. The coordinates of those transparent regions
(in the PNG's own pixel space) are hard-coded once in `FRAMES` inside
`script.js`.

Compositing a result is then just two steps, per photo slot:

1. Draw the captured photo into the slot's bounding box, cropped like CSS
   `object-fit: cover` so it fills the box without distortion.
2. Draw the frame PNG on top, at full size.

Because the frame's "holes" are truly transparent, the photo shows through
exactly where it should — including non-rectangular shapes like the heart or
cloud — with **no manual clipping paths required**. Any part of the photo
that lands outside the hole is simply painted over by the frame's opaque
artwork on top.

```
photo(s) drawn first  →  frame PNG drawn on top  →  caption strip appended
```

If you swap in your own frame PNGs, just re-measure the transparent regions
(any image editor's rectangular-selection / alpha channel tools work) and
update the `slots` array for that frame.

## How the filters work

`FILTERS` in `script.js` has two kinds of entries:

- **`type: "css"`** — Normal, Black & White, Sepia. These set `ctx.filter`
  to a plain CSS filter string before the photo is drawn.
- **`type: "duotone"`** (Mint Duotone) — after the photo is drawn, every
  pixel's luminance is remapped onto a dark→light color ramp, from a muted
  teal shadow to a soft pink-cream highlight (`applyDuotone()`), producing
  a genuine two-color print look — like a mint-and-pink photobooth strip —
  rather than just a tint.
- **`type: "dreamy"`** (Dreamy Haze) — the photo is drawn desaturated and
  softened (`brightness`/`contrast`/`saturate`/`blur` via `ctx.filter`),
  then `applyDreamyHaze()` layers a moody dark wash, a soft misty bloom, a
  diagonal streak of light, floating dust/pollen specks, a faint pink wash,
  and a vignette on top using canvas composite operations — a dark, hazy,
  backlit finish.

## How the language toggle works

All UI copy lives in the `I18N` object in `script.js`, keyed by `id` and
`en`. Static text is marked in `index.html` with `data-i18n` (for text
content) or `data-i18n-placeholder` (for the caption input's placeholder).
Dynamic strings — hints, camera messages, the shot counter, frame names'
slot counts, and the date stamp's month names — are generated through small
helper functions in the same object. Clicking **ID** or **EN** in the
top-right toggle calls `setLanguage()`, which re-applies every static label
and rebuilds the frame gallery and filter chips in the new language, without
losing the current selection.

## Development process

This project was designed and directed by me: the concept (a photobooth
with custom sticker-style frames), the frame artwork, the feature set
(filters, bilingual UI, countdown capture), and the visual/UX decisions are
mine. I used **Claude (Anthropic's AI assistant)** as a coding assistant
during implementation — similar to how many developers now use tools like
GitHub Copilot or ChatGPT — to help write and debug parts of the
JavaScript, particularly the Canvas API compositing logic and the pixel-level
duotone/haze filter effects.

Working with an AI assistant on this project meant I was still responsible
for:
- Specifying what each feature should do and how it should look
- Testing the result on real hardware (camera permissions, mobile layout)
- Understanding every part of the code well enough to modify, debug, and
  explain it — see "How the frame compositing works" and "How the filters
  work" above for the details I can walk through

I'm noting this here in the interest of transparency, since AI-assisted
development is increasingly part of how software actually gets built.

## Project structure

```
photobooth-app/
├── index.html          entry point
├── style.css           all styling
├── script.js           all app logic (camera, capture, compositing, i18n, download)
└── assets/
    └── frames/          the 5 frame PNGs
```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo settings, open **Pages**, and set the source to the branch
   containing these files (root folder).
3. GitHub Pages serves over HTTPS, which is required for camera access in
   the browser — so the deployed site will work; opening `index.html`
   directly from disk will not (browsers block camera access on `file://`).

## Browser notes

- Camera access requires a secure context: `https://` or `http://localhost`.
- Tested against the current versions of Chrome, Edge, and Firefox. Safari on
  iOS needs the `playsinline` attribute on `<video>` to avoid fullscreen
  takeover — already set here.
- If the browser denies camera permission, the app shows an inline message
  instead of failing silently.
