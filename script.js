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
   ============================================================ */

(() => {
  "use strict";

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

  const FILTERS = [
    { id: "none",   label: "Normal",   css: "none" },
    { id: "bw",     label: "Hitam Putih", css: "grayscale(1) contrast(1.05)" },
    { id: "sepia",  label: "Sepia",    css: "sepia(.65) contrast(1.05)" },
    { id: "warm",   label: "Hangat",   css: "saturate(1.25) brightness(1.06) hue-rotate(-4deg)" },
    { id: "cool",   label: "Dingin",   css: "saturate(1.1) hue-rotate(10deg) brightness(1.02)" }
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
    stage: document.getElementById("stage")
  };

  /* ============================================================
     Setup: frame gallery + filter chips
     ============================================================ */

  function buildFrameGallery() {
    FRAMES.forEach((frame, i) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "frame-card";
      card.setAttribute("aria-pressed", "false");
      card.dataset.frameId = frame.id;
      card.innerHTML = `
        <img src="${frame.file}" alt="Pratinjau bingkai ${frame.name}" loading="lazy">
        <span class="frame-slots">${frame.slots.length} foto</span>
        <span class="frame-name">${frame.name}</span>
      `;
      card.addEventListener("click", () => selectFrame(frame));
      el.frameGallery.appendChild(card);
    });
  }

  function buildFilterRow() {
    FILTERS.forEach((f) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (f.id === state.selectedFilter.id ? " is-active" : "");
      chip.textContent = f.label;
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

  let cameraReady = false;

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      el.cameraMsg.innerHTML = "<p>Browser ini tidak mendukung akses kamera. Coba buka dengan Chrome/Edge/Firefox terbaru.</p>";
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
      el.cameraMsg.innerHTML =
        "<p>Tidak bisa mengakses kamera. Pastikan kamu mengizinkan akses kamera di browser, lalu muat ulang halaman.</p>";
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
      el.hint.textContent = "Pilih bingkai dulu di sebelah kiri, lalu izinkan akses kamera untuk mulai.";
    } else if (!cameraReady) {
      el.hint.textContent = "Menunggu izin kamera dari browser…";
    } else if (state.shots.length < state.selectedFrame.slots.length) {
      const n = state.selectedFrame.slots.length;
      el.hint.textContent = `Bingkai "${state.selectedFrame.name}" butuh ${n} foto. Tekan "Start Snap" — ada hitung mundur ${COUNTDOWN_SECONDS} detik di tiap jepretan.`;
    } else {
      el.hint.textContent = "Semua foto sudah diambil. Tambahkan teks kalau mau, lalu unduh hasilnya.";
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

  function captureFrameToCanvas() {
    const video = el.video;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d");
    ctx.filter = state.selectedFilter.css;
    // mirror horizontally so the saved photo matches the on-screen preview
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, vw, vh);
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
    img.alt = `Jepretan ${state.shots.length}`;
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
      el.shotCounter.textContent = `Foto ${i + 1} / ${total}`;
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
    const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
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
    buildFrameGallery();
    buildFilterRow();

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
