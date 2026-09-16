/* ============================================================
   Snapiku — Web Photobooth
   Vanilla JS. No build step, no dependencies.

   How it works, in short:
   1. Each frame is a transparent PNG — the "holes" where photos
      show through are real alpha-transparent regions, already
      measured out below in FRAMES[].slots (in the PNG's own
      pixel coordinates, 1650x1275 for every frame here).
   2. To compose a result we draw the captured photos first
      (cropped to "cover" each slot), then draw the frame PNG
      on top. Wherever the frame is transparent, the photo shows
      through; everywhere else the artwork sits on top. No manual
      clipping paths needed even for the heart/oval/cloud slots.
   3. A caption strip (custom text / date) is drawn as an extra
      band under the frame, so it never collides with the art.
   4. Photo filters come in two flavors: simple CSS filters
      (grayscale, sepia, etc.) applied straight to the canvas
      context, and "processed" filters (duotone, dreamy haze)
      that run an extra pixel/composite pass after the photo is
      drawn — see applyDuotone() and applyDreamyHaze() below.
   5. All UI copy lives in the I18N dictionary so the whole app
      can switch between Bahasa Indonesia and English instantly.
   ============================================================ */

(() => {
  "use strict";

  /* ---------------- language / i18n ---------------- */

  let lang = "id";

  const I18N = {
    id: {
      step1: "Pilih Bingkai",
      step2: "Jepret Foto",
      step3: "Simpan",
      frameLabel: "Bingkai",
      filterLabel: "Filter foto",
      textDateLabel: "Teks & tanggal",
      customTextLabel: "Teks custom (opsional)",
      customTextPlaceholder: "cth. Kelas Fisika · 2026",
      showDateLabel: "Tampilkan tanggal hari ini",
      cameraActivating: "Mengaktifkan kamera…",
      cameraUnsupported: "Browser ini tidak mendukung akses kamera. Coba buka dengan Chrome/Edge/Firefox terbaru.",
      cameraDenied: "Tidak bisa mengakses kamera. Pastikan kamu mengizinkan akses kamera di browser, lalu muat ulang halaman.",
      startSnap: "Start Snap",
      retake: "Ambil Ulang",
      download: "Unduh PNG",
      newFrame: "Ganti Bingkai",
      hintNoFrame: "Pilih bingkai dulu di sebelah kiri, lalu izinkan akses kamera untuk mulai.",
      hintWaitingCamera: "Menunggu izin kamera dari browser…",
      hintNeedShots: (n, name, sec) => `Bingkai "${name}" butuh ${n} foto. Tekan "Start Snap" — ada hitung mundur ${sec} detik di tiap jepretan.`,
      hintDone: "Semua foto sudah diambil. Tambahkan teks kalau mau, lalu unduh hasilnya.",
      framePreviewAlt: (name) => `Pratinjau bingkai ${name}`,
      frameSlots: (n) => `${n} foto`,
      filmstripLabel: "Foto yang sudah diambil",
      filterNone: "Normal",
      filterBw: "Hitam Putih",
      filterSepia: "Sepia",
      filterDuotone: "Duotone Mint",
      filterDreamy: "Dreamy Haze",
      shotCounter: (i, total) => `Foto ${i} / ${total}`,
      shotAlt: (n) => `Jepretan ${n}`,
      months: ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
    },
    en: {
      step1: "Choose Frame",
      step2: "Take Photos",
      step3: "Save",
      frameLabel: "Frames",
      filterLabel: "Photo Filter",
      textDateLabel: "Text & date",
      customTextLabel: "Custom text (optional)",
      customTextPlaceholder: "e.g. Physics Class · 2026",
      showDateLabel: "Show today's date",
      cameraActivating: "Activating camera…",
      cameraUnsupported: "This browser doesn't support camera access. Try opening with the latest Chrome, Edge, or Firefox.",
      cameraDenied: "Can't access the camera. Make sure you allow camera access in your browser, then reload the page.",
      startSnap: "Start Snap",
      retake: "Retake",
      download: "Download PNG",
      newFrame: "Change Frame",
      hintNoFrame: "Pick a frame on the left first, then allow camera access to get started.",
      hintWaitingCamera: "Waiting for camera permission from the browser…",
      hintNeedShots: (n, name, sec) => `The "${name}" frame needs ${n} photo${n > 1 ? "s" : ""}. Press "Start Snap" — a ${sec}-second countdown runs before each shot.`,
      hintDone: "All photos captured. Add some text if you like, then download the result.",
      framePreviewAlt: (name) => `Preview of the ${name} frame`,
      frameSlots: (n) => `${n} photo${n > 1 ? "s" : ""}`,
      filmstripLabel: "Photos taken so far",
      filterNone: "Normal",
      filterBw: "Black & White",
      filterSepia: "Sepia",
      filterDuotone: "Mint Duotone",
      filterDreamy: "Dreamy Haze",
      shotCounter: (i, total) => `Photo ${i} / ${total}`,
      shotAlt: (n) => `Shot ${n}`,
      months: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    }
  };

  function t() {
    return I18N[lang];
  }

  /* ---------------- frame configuration ---------------- */

  const FRAMES = [
    {
      id: "delulu",
      name: "Delulu Cross Stitch",
      file: "assets/frames/Frame_Delulu_Cross_Stitch.png",
      width: 1650, height: 1275,
      slots: [
        { x: 289, y: 606, w: 534, h: 423 },
        { x: 841, y: 606, w: 534, h: 423 }
      ],
      strip: { bg: "#FBEFC0", ink: "#5B3D33" }
    },
    {
      id: "lace",
      name: "Lace Pink & Green",
      file: "assets/frames/Frame_Lace_Pink___Green.png",
      width: 1650, height: 1275,
      slots: [
        { x: 272, y: 188, w: 403, h: 263 },
        { x: 273, y: 905, w: 402, h: 263 },
        { x: 1035, y: 265, w: 454, h: 742 }
      ],
      strip: { bg: "#FFE3EC", ink: "#B23A63" }
    },
    {
      id: "ipod",
      name: "iPod MP3",
      file: "assets/frames/Frame_Ipod_MP3.png",
      width: 1650, height: 1275,
      slots: [
        { x: 528, y: 106, w: 594, h: 695 }
      ],
      strip: { bg: "#D8ECFB", ink: "#33404E" }
    },
    {
      id: "house",
      name: "House & Love",
      file: "assets/frames/Frame_House___Love.png",
      width: 1650, height: 1275,
      slots: [
        { x: 485, y: 638, w: 680, h: 569 }
      ],
      strip: { bg: "#DFF3EA", ink: "#4B6E5F" }
    },
    {
      id: "cherry",
      name: "Cherry Files",
      file: "assets/frames/Frame_Cherry_Files.png",
      width: 1650, height: 1275,
      slots: [
        { x: 235, y: 301, w: 454, h: 285 },
        { x: 951, y: 301, w: 454, h: 295 },
        { x: 230, y: 824, w: 466, h: 300 },
        { x: 953, y: 829, w: 453, h: 298 }
      ],
      strip: { bg: "#FDE2E4", ink: "#C2455A" }
    }
  ];

  /* ---------------- filters ----------------
     "css" filters are applied directly via ctx.filter.
     "duotone" remaps every pixel's luminance onto a two-color
     gradient (dark → light) for a true two-tone print look —
     here a muted teal shadow to a soft pink-cream highlight,
     like a mint-and-pink photobooth strip.
     "dreamy" desaturates and softens the image, then layers a
     moody dark wash, a soft fog bloom, a diagonal light-ray
     streak, floating dust specks and a faint pink wash on top —
     a hazy, backlit, slightly melancholic look.
  */

  const FILTERS = [
    { id: "none",     labelKey: "filterNone",    type: "css", css: "none" },
    { id: "bw",        labelKey: "filterBw",      type: "css", css: "grayscale(1) contrast(1.05)" },
    { id: "sepia",     labelKey: "filterSepia",   type: "css", css: "sepia(.65) contrast(1.05)" },
    { id: "duotone",   labelKey: "filterDuotone", type: "duotone", dark: [52, 76, 70], light: [251, 221, 224] },
    { id: "dreamy",    labelKey: "filterDreamy",  type: "dreamy", css: "brightness(.92) contrast(.88) saturate(.7) blur(.6px)" }
  ];

  const COUNTDOWN_SECONDS = 3;
  const GAP_BETWEEN_SHOTS_MS = 900;
  const STRIP_HEIGHT_RATIO = 0.09; // caption strip height, relative to frame width

  /* ---------------- state ---------------- */

  const state = {
    selectedFrame: null,
    selectedFilter: FILTERS[0],
    shots: [],          // array of offscreen canvases, one per captured photo
    frameImages: {},    // cache of loaded <img> per frame id
    busy: false
  };

  let cameraReady = false;
  let cameraMessageKey = "cameraActivating";

  /* ---------------- DOM references ---------------- */

  const el = {
    stepRail: document.getElementById("stepRail"),
    frameGallery: document.getElementById("frameGallery"),
    filterRow: document.getElementById("filterRow"),
    captionInput: document.getElementById("captionInput"),
    dateToggle: document.getElementById("dateToggle"),
    video: document.getElementById("video"),
    resultCanvas: document.getElementById("resultCanvas"),
    cameraMsg: document.getElementById("cameraMsg"),
    countdown: document.getElementById("countdown"),
    flash: document.getElementById("flash"),
    shotCounter: document.getElementById("shotCounter"),
    filmstrip: document.getElementById("filmstrip"),
    snapBtn: document.getElementById("snapBtn"),
    retakeBtn: document.getElementById("retakeBtn"),
    downloadBtn: document.getElementById("downloadBtn"),
    newFrameBtn: document.getElementById("newFrameBtn"),
    hint: document.getElementById("hint"),
    stage: document.getElementById("stage"),
    langToggle: document.getElementById("langToggle")
  };

  /* ============================================================
     i18n application
     ============================================================ */

  function applyStaticTranslations() {
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.dataset.i18n;
      if (t()[key] !== undefined) node.textContent = t()[key];
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.dataset.i18nPlaceholder;
      if (t()[key] !== undefined) node.placeholder = t()[key];
    });

    el.filmstrip.setAttribute("aria-label", t().filmstripLabel);

    // re-stamp alt text on any thumbnails already captured
    [...el.filmstrip.children].forEach((img, i) => {
      img.alt = t().shotAlt(i + 1);
    });
  }

  function setLanguage(newLang) {
    if (newLang === lang) return;
    lang = newLang;

    [...el.langToggle.children].forEach((btn) => {
      const isActive = btn.dataset.lang === lang;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    applyStaticTranslations();
    buildFrameGallery();
    buildFilterRow();
    setCameraMessage(cameraMessageKey);
    updateHint();

    if (state.busy) {
      const total = state.selectedFrame.slots.length;
      el.shotCounter.textContent = t().shotCounter(state.shots.length + 1, total);
    }
  }

  /* ============================================================
     Setup: frame gallery + filter chips
     ============================================================ */

  function buildFrameGallery() {
    el.frameGallery.innerHTML = "";
    FRAMES.forEach((frame) => {
      const isSelected = state.selectedFrame && state.selectedFrame.id === frame.id;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "frame-card" + (isSelected ? " is-selected" : "");
      card.setAttribute("aria-pressed", String(isSelected));
      card.dataset.frameId = frame.id;
      card.innerHTML = `
        <img src="${frame.file}" alt="${t().framePreviewAlt(frame.name)}" loading="lazy">
        <span class="frame-slots">${t().frameSlots(frame.slots.length)}</span>
        <span class="frame-name">${frame.name}</span>
      `;
      card.addEventListener("click", () => selectFrame(frame));
      el.frameGallery.appendChild(card);
    });
  }

  function buildFilterRow() {
    el.filterRow.innerHTML = "";
    FILTERS.forEach((f) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (f.id === state.selectedFilter.id ? " is-active" : "");
      chip.textContent = t()[f.labelKey];
      chip.addEventListener("click", () => {
        state.selectedFilter = f;
        [...el.filterRow.children].forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
      });
      el.filterRow.appendChild(chip);
    });
  }

  function selectFrame(frame) {
    if (state.busy) return;
    state.selectedFrame = frame;

    [...el.frameGallery.children].forEach((card) => {
      const isSel = card.dataset.frameId === frame.id;
      card.classList.toggle("is-selected", isSel);
      card.setAttribute("aria-pressed", String(isSel));
    });

    resetShots();
    updateSteps(cameraReady ? 2 : 1);
    updateHint();
    updateSnapEnabled();
    showResult(false);
  }

  /* ============================================================
     Camera
     ============================================================ */

  function setCameraMessage(key) {
    cameraMessageKey = key;
    el.cameraMsg.innerHTML = `<p>${t()[key]}</p>`;
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraMessage("cameraUnsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      el.video.srcObject = stream;
      await el.video.play();
      cameraReady = true;
      el.cameraMsg.classList.add("hidden");
      updateSteps(state.selectedFrame ? 2 : 1);
      updateHint();
      updateSnapEnabled();
    } catch (err) {
      console.error(err);
      setCameraMessage("cameraDenied");
    }
  }

  /* ============================================================
     Step rail + hint text
     ============================================================ */

  function updateSteps(activeStep) {
    [...el.stepRail.children].forEach((li) => {
      const step = Number(li.dataset.step);
      li.classList.toggle("is-active", step === activeStep);
      li.classList.toggle("is-done", step < activeStep);
    });
  }

  function updateHint() {
    if (!state.selectedFrame) {
      el.hint.textContent = t().hintNoFrame;
    } else if (!cameraReady) {
      el.hint.textContent = t().hintWaitingCamera;
    } else if (state.shots.length < state.selectedFrame.slots.length) {
      const n = state.selectedFrame.slots.length;
      el.hint.textContent = t().hintNeedShots(n, state.selectedFrame.name, COUNTDOWN_SECONDS);
    } else {
      el.hint.textContent = t().hintDone;
    }
  }

  function updateSnapEnabled() {
    el.snapBtn.disabled = !(cameraReady && state.selectedFrame && !state.busy);
  }

  /* ============================================================
     Capture loop: countdown -> flash -> store frame, repeat
     ============================================================ */

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function runCountdown(seconds) {
    el.countdown.classList.add("is-visible");
    for (let n = seconds; n >= 1; n--) {
      el.countdown.textContent = String(n);
      await sleep(1000);
    }
    el.countdown.classList.remove("is-visible");
    el.countdown.textContent = "";
  }

  // Remaps every pixel's luminance onto a dark→light color ramp,
  // producing a genuine two-color duotone (not just a tint).
  function applyDuotone(ctx, w, h, dark, light) {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      d[i]     = dark[0] + (light[0] - dark[0]) * lum;
      d[i + 1] = dark[1] + (light[1] - dark[1]) * lum;
      d[i + 2] = dark[2] + (light[2] - dark[2]) * lum;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // Builds a dark, hazy, backlit finish on top of an already-softened
  // (blurred/desaturated) base image: a moody dark wash, a soft misty
  // bloom, a diagonal streak of light cutting through the haze, fine
  // floating dust/pollen specks catching that light, a faint pink
  // wash for warmth, and a vignette — the layered look of light
  // filtering through fog onto something growing in it.
  function applyDreamyHaze(ctx, w, h) {
    ctx.save();

    // 1) moody dark wash, deepening the overall tone like dusk fog
    ctx.globalCompositeOperation = "multiply";
    const mood = ctx.createLinearGradient(0, 0, 0, h);
    mood.addColorStop(0, "rgba(70,74,86,.32)");
    mood.addColorStop(1, "rgba(28,30,38,.5)");
    ctx.fillStyle = mood;
    ctx.fillRect(0, 0, w, h);

    // 2) soft misty bloom, as if light is diffusing through the haze
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(w * 0.55, h * 0.12, 0, w * 0.55, h * 0.12, Math.max(w, h) * 0.85);
    glow.addColorStop(0, "rgba(255,255,255,.4)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // 3) a diagonal streak of light cutting across the frame
    ctx.save();
    ctx.translate(w * 0.7, 0);
    ctx.rotate((-16 * Math.PI) / 180);
    const ray = ctx.createLinearGradient(-w * 0.22, 0, w * 0.22, 0);
    ray.addColorStop(0, "rgba(255,255,255,0)");
    ray.addColorStop(0.5, "rgba(255,255,255,.26)");
    ray.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = ray;
    ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.6, h * 1.6);
    ctx.restore();

    // 4) fine floating dust / pollen specks catching the light
    ctx.globalCompositeOperation = "screen";
    const speckCount = Math.round((w * h) / 8500);
    for (let i = 0; i < speckCount; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 0.8 + Math.random() * 2.4;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${(0.15 + Math.random() * 0.35).toFixed(2)})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5) faint pink wash for a touch of floral warmth amid the haze
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = "rgba(255,205,218,.12)";
    ctx.fillRect(0, 0, w, h);

    // 6) gentle vignette so the edges recede into the mist
    ctx.globalCompositeOperation = "multiply";
    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, "rgba(255,255,255,1)");
    vignette.addColorStop(1, "rgba(90,92,108,.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  function captureFrameToCanvas() {
    const video = el.video;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    const filter = state.selectedFilter;

    ctx.filter = filter.type === "duotone" ? "none" : (filter.css || "none");
    // mirror horizontally so the saved photo matches the on-screen preview
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";

    if (filter.type === "duotone") {
      applyDuotone(ctx, vw, vh, filter.dark, filter.light);
    } else if (filter.type === "dreamy") {
      applyDreamyHaze(ctx, vw, vh);
    }

    return canvas;
  }

  function flashOnce() {
    el.flash.classList.remove("is-flashing");
    // force reflow so the animation can restart
    void el.flash.offsetWidth;
    el.flash.classList.add("is-flashing");
  }

  function addThumb(canvas) {
    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/jpeg", 0.85);
    img.alt = t().shotAlt(state.shots.length);
    el.filmstrip.appendChild(img);
  }

  async function startSnapSequence() {
    if (!state.selectedFrame || state.busy) return;
    state.busy = true;
    updateSnapEnabled();
    resetShots();
    updateSteps(2);

    const total = state.selectedFrame.slots.length;
    el.shotCounter.classList.remove("hidden");

    for (let i = 0; i < total; i++) {
      el.shotCounter.textContent = t().shotCounter(i + 1, total);
      await runCountdown(COUNTDOWN_SECONDS);
      flashOnce();
      const shot = captureFrameToCanvas();
      state.shots.push(shot);
      addThumb(shot);
      await sleep(GAP_BETWEEN_SHOTS_MS);
    }

    el.shotCounter.classList.add("hidden");
    state.busy = false;
    updateSnapEnabled();
    updateHint();
    composeAndShowResult();
    updateSteps(3);
  }

  function resetShots() {
    state.shots = [];
    el.filmstrip.innerHTML = "";
    showResult(false);
  }

  /* ============================================================
     Compositing: photos + frame PNG + caption strip
     ============================================================ */

  function loadFrameImage(frame) {
    if (state.frameImages[frame.id]) return state.frameImages[frame.id];
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = frame.file;
    });
    state.frameImages[frame.id] = p;
    return p;
  }

  // Draws `source` into the rect (dx,dy,dw,dh) cropping it like CSS "object-fit: cover".
  function drawCover(ctx, source, dx, dy, dw, dh) {
    const sw = source.videoWidth || source.width;
    const sh = source.videoHeight || source.height;
    const srcRatio = sw / sh;
    const dstRatio = dw / dh;
    let sx, sy, sWidth, sHeight;
    if (srcRatio > dstRatio) {
      sHeight = sh;
      sWidth = sh * dstRatio;
      sx = (sw - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = sw;
      sHeight = sw / dstRatio;
      sx = 0;
      sy = (sh - sHeight) / 2;
    }
    ctx.drawImage(source, sx, sy, sWidth, sHeight, dx, dy, dw, dh);
  }

  function formatDate(d) {
    const months = t().months;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  async function composeAndShowResult() {
    const frame = state.selectedFrame;
    if (!frame || state.shots.length < frame.slots.length) return;

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) { /* non-critical */ }
    }

    const frameImg = await loadFrameImage(frame);
    const caption = el.captionInput.value.trim();
    const showDate = el.dateToggle.checked;
    const hasStrip = Boolean(caption) || showDate;
    const stripH = hasStrip ? Math.round(frame.width * STRIP_HEIGHT_RATIO) : 0;

    const canvas = el.resultCanvas;
    canvas.width = frame.width;
    canvas.height = frame.height + stripH;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1) photos, cropped into each slot
    frame.slots.forEach((slot, i) => {
      drawCover(ctx, state.shots[i], slot.x, slot.y, slot.w, slot.h);
    });

    // 2) frame artwork on top — its transparent holes reveal the photos
    ctx.drawImage(frameImg, 0, 0, frame.width, frame.height);

    // 3) caption strip
    if (hasStrip) {
      ctx.fillStyle = frame.strip.bg;
      ctx.fillRect(0, frame.height, frame.width, stripH);

      ctx.fillStyle = frame.strip.ink;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      const fontSize = Math.round(stripH * 0.36);
      ctx.font = `700 ${fontSize}px "Baloo 2", "Nunito", sans-serif`;

      const parts = [];
      if (caption) parts.push(caption);
      if (showDate) parts.push(formatDate(new Date()));
      ctx.fillText(parts.join("   ·   "), frame.width / 2, frame.height + stripH / 2);
    }

    showResult(true);
  }

  function showResult(visible) {
    el.resultCanvas.classList.toggle("hidden", !visible);
    el.video.classList.toggle("hidden", visible);
    el.downloadBtn.classList.toggle("hidden", !visible);
    el.retakeBtn.classList.toggle("hidden", !visible);
    el.newFrameBtn.classList.toggle("hidden", !visible);
  }

  /* ============================================================
     Download
     ============================================================ */

  function downloadResult() {
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.download = `snapiku-${state.selectedFrame.id}-${stamp}.png`;
    link.href = el.resultCanvas.toDataURL("image/png");
    link.click();
  }

  /* ============================================================
     Wiring
     ============================================================ */

  function init() {
    applyStaticTranslations();
    buildFrameGallery();
    buildFilterRow();
    setCameraMessage("cameraActivating");

    [...el.langToggle.children].forEach((btn) => {
      btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
    });

    el.snapBtn.addEventListener("click", startSnapSequence);
    el.downloadBtn.addEventListener("click", downloadResult);

    el.retakeBtn.addEventListener("click", () => {
      resetShots();
      updateSteps(2);
      updateHint();
    });

    el.newFrameBtn.addEventListener("click", () => {
      state.selectedFrame = null;
      resetShots();
      [...el.frameGallery.children].forEach((c) => {
        c.classList.remove("is-selected");
        c.setAttribute("aria-pressed", "false");
      });
      updateSteps(1);
      updateHint();
      updateSnapEnabled();
    });

    // live re-render of the caption if the user edits it after composing
    el.captionInput.addEventListener("input", () => {
      if (!el.resultCanvas.classList.contains("hidden")) composeAndShowResult();
    });
    el.dateToggle.addEventListener("change", () => {
      if (!el.resultCanvas.classList.contains("hidden")) composeAndShowResult();
    });

    startCamera();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
