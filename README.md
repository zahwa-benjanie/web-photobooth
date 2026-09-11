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
- **Photo filters** (normal, black & white, sepia, warm, cool) applied live at
  capture time.
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

## Project structure

```
photobooth-app/
├── index.html          entry point
├── style.css           all styling
├── script.js           all app logic (camera, capture, compositing, download)
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
