/* AcousticScope — Created by Sidharth Subrahmanya H · Idea by Mr. Shanmukharaja M */
(() => {
  "use strict";
  console.info("%cAcousticScope%c Created by Sidharth Subrahmanya H · Idea by Mr. Shanmukharaja M","font-weight:700;color:#3568d4","color:inherit");
  const $ = (id) => document.getElementById(id);
  const audio = $("audioPlayer");
  const input = $("audioInput");
  const workspace = $("workspace");
  const emptyState = $("emptyState");
  const dropZone = $("dropZone");
  const playButton = $("playButton");
  const playIcon = $("playIcon");
  const pauseIcon = $("pauseIcon");
  const seekBar = $("seekBar");
  const currentTimeEl = $("currentTime");
  const durationEl = $("duration");
  const specCanvas = $("spectrogramCanvas");
  const waveCanvas = $("waveformCanvas");
  const specCtx = specCanvas.getContext("2d", { alpha: false });
  const waveCtx = waveCanvas.getContext("2d");
  const toast = $("toast");
  let audioContext = null;
  let decodedBuffer = null;
  let objectUrl = null;
  let duration = 0;
  let specImage = null;
  let wavePeaks = null;
  let playhead = 0;
  let toastTimer = null;
  let currentFile = null;
  let rendering = false;
  let loadRequestId = 0;
  let playlist = [];
  let playlistIndex = -1;
  let directoryHandle = null;
  let playlistEntries = [];
  let playlistSource = "files";
  let currentAudioInvalid = false;
  let invalidAudioFiles = [];
  const folderInput = $("folderInput");
  const previousTrackButton = $("previousTrack");
  const nextTrackButton = $("nextTrack");
  const playlistCount = $("playlistCount");
  const trackSelect = $("trackSelect");
  const subfolderSelect = $("subfolderSelect");
  const filteredCount = $("filteredCount");
  const AUDIO_EXTENSIONS = /\.(wav|mp3|m4a|flac|ogg|aac|aiff|opus|weba)$/i;
  function entryPath(index) {
    const entry = playlistEntries[index];
    return (entry && entry.relativePath) || (playlist[index] && (playlist[index].webkitRelativePath || playlist[index].name)) || "";
  }
  function visiblePlaylistIndices() {
    const typedValue = (subfolderSelect?.value || "").trim();
    const knownFolder = folderPaths.has(typedValue);
    const query = typedValue.toLocaleLowerCase();
    const indices = [];
    playlist.forEach((file, index) => {
      const path = entryPath(index);
      const inFolder = !typedValue || (knownFolder && (path.startsWith(typedValue + "/") || path === typedValue));
      const matchesSearch = !typedValue || knownFolder || path.toLocaleLowerCase().includes(query);
      if (inFolder && matchesSearch) indices.push(index);
    });
    return indices;
  }
  const folderPaths = new Set();
  function updateSubfolderOptions() {
    if (!subfolderSelect) return;
    const previous = subfolderSelect.value;
    const folders = new Set();
    playlist.forEach((_, index) => {
      const parts = entryPath(index).split("/");
      parts.pop();
      for (let i = 1; i <= parts.length; i++) folders.add(parts.slice(0, i).join("/"));
    });
    folderPaths.clear();
    folders.forEach(path => folderPaths.add(path));
    subfolderSelect.innerHTML = "";
    subfolderSelect.appendChild(new Option("All folders", ""));
    [...folders].sort((a,b) => a.localeCompare(b, undefined, { numeric:true, sensitivity:"base" }))
      .forEach(path => subfolderSelect.appendChild(new Option(path, path)));
    subfolderSelect.disabled = playlist.length === 0;
    subfolderSelect.value = previous && folders.has(previous) ? previous : "";
  }
  function updatePlaylistUI() {
    const hasPlaylist = playlist.length > 0;
    updateSubfolderOptions();
    const visible = visiblePlaylistIndices();
    const visiblePosition = visible.indexOf(playlistIndex);
    if (previousTrackButton) previousTrackButton.disabled = visiblePosition <= 0;
    if (nextTrackButton) nextTrackButton.disabled = visiblePosition < 0 || visiblePosition >= visible.length - 1;
    if (playlistCount) playlistCount.textContent = !hasPlaylist ? "No files loaded" : (visiblePosition >= 0 ? `${visiblePosition + 1} of ${visible.length} shown` : `${playlist.length} files loaded`);
    if (trackSelect) {
      trackSelect.disabled = !hasPlaylist || visible.length === 0;
      trackSelect.innerHTML = "";
      if (filteredCount) filteredCount.textContent = hasPlaylist ? `${visible.length} shown` : "";
      if (visible.length) {
        visible.forEach(index => {
          const option = document.createElement("option");
          option.value = String(index);
          const path = entryPath(index);
          option.textContent = path;
          trackSelect.appendChild(option);
        });
        trackSelect.value = visible.includes(playlistIndex) ? String(playlistIndex) : "";
        if (!trackSelect.value) trackSelect.insertBefore(new Option("Choose a recording…", ""), trackSelect.firstChild);
      } else {
        const option = document.createElement("option"); option.value = ""; option.textContent = hasPlaylist ? "No recordings in this folder" : "Choose a folder first"; trackSelect.appendChild(option);
      }
    }
    const active = hasPlaylist ? playlist[playlistIndex] : null;
    const managerName = $("managerFileName");
    if (managerName) managerName.textContent = active ? entryPath(playlistIndex) : "Open a folder to browse recordings and subfolders";
    const deleteButton = $("deleteTrack");
    const currentEntry = hasPlaylist ? playlistEntries[playlistIndex] : null;
    const canDeleteInvalidFromDisk = playlistSource === "directory" && !!directoryHandle && !!currentEntry;
    const singleMode = hasPlaylist && playlistSource === "files" && playlist.length === 1;
    if (singleMode) {
      invalidAudioFiles = [];
      [subfolderSelect, trackSelect, previousTrackButton, nextTrackButton, $("deleteInvalidFiles"), $("deleteEmptyFolders")].forEach(el => { if (el) el.disabled = true; });
    }
    if (deleteButton) {
      const showDelete = canDeleteInvalidFromDisk || singleMode;
      deleteButton.classList.toggle("hidden", !showDelete);
      deleteButton.disabled = !showDelete;
      deleteButton.title = showDelete ? "Permanently delete only the currently selected file" : "Shown when a file or folder is open";
    }
  }
  function isAudioFile(file) {
    return !!file && ((file.type || "").startsWith("audio/") || AUDIO_EXTENSIONS.test(file.name || ""));
  }
  async function loadPlaylistTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    playlistIndex = index;
    updatePlaylistUI();
    audio.pause();
    audio.currentTime = 0;
    await loadFile(playlist[index]);
    updatePlaylistUI();
  }
  const COLORS = {
    violet: [[0, 8, 14, 35], [0.25, 36, 48, 111], [0.5, 99, 82, 178], [0.72, 199, 119, 205], [1, 255, 239, 212]],
    thermal: [[0, 8, 12, 24], [0.25, 45, 35, 110], [0.5, 178, 49, 71], [0.75, 246, 143, 48], [1, 255, 244, 171]],
    mono: [[0, 7, 12, 23], [0.3, 65, 75, 95], [0.65, 169, 180, 202], [1, 255, 255, 255]]
  };

  function formatTime(seconds, tenths = true) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${secs.toFixed(tenths ? 1 : 0).padStart(tenths ? 4 : 2, "0")}`;
  }
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }
  function setPlayingState(playing) {
    playIcon.classList.toggle("hidden", playing);
    pauseIcon.classList.toggle("hidden", !playing);
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  function updateSeekUI() {
    const current = audio.currentTime || 0;
    currentTimeEl.textContent = formatTime(current);
    durationEl.textContent = formatTime(duration);
    seekBar.value = duration ? Math.round(current / duration * 1000) : 0;
    seekBar.style.setProperty("--progress", `${seekBar.value / 10}%`);
    playhead = duration ? current / duration : 0;
    drawPlayheads();
  }
  function resizeCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: rect.width, h: rect.height, dpr };
  }
  function drawPlayheads() {
    if (!decodedBuffer || !specImage || !wavePeaks) return;
    drawSpectrogram();
    drawWaveform();
  }
  function interpColor(value, palette) {
    const stops = palette;
    for (let i = 1; i < stops.length; i++) {
      if (value <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i];
        const t = Math.max(0, (value - a[0]) / (b[0] - a[0]));
        return [1,2,3].map(k => Math.round(a[k] + (b[k] - a[k]) * t));
      }
    }
    const last = stops[stops.length - 1];
    return last.slice(1);
  }
  // ==== Spectrogram engine ================================================
  // Configurable STFT (FFT size, hop, window). Magnitudes are cached in dBFS so
  // changing the dB floor/ceiling, palette or frequency scale only re-colours.
  const SPEC_DEFAULTS = { fft: 2048, hop: 512, win: "hann", floor: -70, ceil: 0 };
  const spec = { ...SPEC_DEFAULTS };
  const MAX_COLUMNS = 2400, IMG_H = 512, MIN_LOG_HZ = 20, AMP_K = 0.44;
  let specDb = null, specMeta = null, specRows = null, specCursor = null, specToken = 0, freqAxisKey = "";
  const fftTables = new Map();
  function getFftTables(n) {
    let t = fftTables.get(n);
    if (t) return t;
    const rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    const bits = Math.round(Math.log2(n));
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b); rev[i] = r; }
    for (let k = 0; k < n / 2; k++) { cos[k] = Math.cos(2 * Math.PI * k / n); sin[k] = -Math.sin(2 * Math.PI * k / n); }
    t = { rev, cos, sin }; fftTables.set(n, t); return t;
  }
  function fftInPlace(re, im, n, t) {
    const rev = t.rev;
    for (let i = 0; i < n; i++) { const j = rev[i]; if (i < j) { let x = re[i]; re[i] = re[j]; re[j] = x; x = im[i]; im[i] = im[j]; im[j] = x; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j, b = a + half, wr = t.cos[k], wi = t.sin[k];
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  }
  function makeWindow(type, n) {
    const w = new Float64Array(n), d = Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const x = 2 * Math.PI * i / d;
      switch (type) {
        case "hamming": w[i] = 0.54 - 0.46 * Math.cos(x); break;
        case "blackman": w[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x); break;
        case "blackmanharris": w[i] = 0.35875 - 0.48829 * Math.cos(x) + 0.14128 * Math.cos(2 * x) - 0.01168 * Math.cos(3 * x); break;
        case "bartlett": w[i] = 1 - Math.abs(2 * i / d - 1); break;
        case "rect": w[i] = 1; break;
        default: w[i] = 0.5 - 0.5 * Math.cos(x);
      }
    }
    return w;
  }
  function isLogScale(nyq) { return $("frequencyScale").value === "log" && nyq > MIN_LOG_HZ * 2; }
  function hzFromFrac(frac, nyq, log) { frac = Math.max(0, Math.min(1, frac)); return log ? MIN_LOG_HZ * Math.pow(nyq / MIN_LOG_HZ, frac) : frac * nyq; }
  function fracFromHz(hz, nyq, log) { return Math.max(0, Math.min(1, log ? Math.log(Math.max(hz, MIN_LOG_HZ) / MIN_LOG_HZ) / Math.log(nyq / MIN_LOG_HZ) : hz / nyq)); }
  function formatHz(f, precise = false) {
    if (f >= 1000) return `${precise ? (f / 1000).toFixed(2) : +(f / 1000).toFixed(1)} kHz`;
    return `${precise ? f.toFixed(1) : Math.round(f)} Hz`;
  }
  function formatTimePrecise(s) {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60); return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
  }
  async function computeSpectrogram(buffer, token, label) {
    const channel = buffer.getChannelData(0), N = channel.length, sr = buffer.sampleRate;
    const fft = spec.fft, hop = spec.hop, bins = fft / 2 + 1;
    const framesByHop = N <= fft ? 1 : Math.ceil((N - fft) / hop) + 1;
    const cols = Math.min(MAX_COLUMNS, framesByHop), capped = framesByHop > MAX_COLUMNS;
    const stride = capped ? (N - fft) / (cols - 1) : hop;
    const win = makeWindow(spec.win, fft);
    let winSum = 0; for (let i = 0; i < fft; i++) winSum += win[i];
    const norm = 4 / (winSum * winSum);            // a full-scale sine reads 0 dBFS
    const t = getFftTables(fft), re = new Float64Array(fft), im = new Float64Array(fft);
    const db = new Float32Array(cols * bins), note = $("spectrogramOverlay").querySelector("span");
    let lastYield = performance.now();
    for (let c = 0; c < cols; c++) {
      const start = Math.floor(c * stride), avail = Math.max(0, Math.min(fft, N - start));
      for (let n = 0; n < avail; n++) re[n] = channel[start + n] * win[n];
      for (let n = avail; n < fft; n++) re[n] = 0;
      im.fill(0);
      fftInPlace(re, im, fft, t);
      const o = c * bins;
      for (let k = 0; k < bins; k++) { const p = (re[k] * re[k] + im[k] * im[k]) * norm; db[o + k] = p > 1e-20 ? 10 * Math.log10(p) : -200; }
      if (performance.now() - lastYield > 30) {
        if (note && label) note.textContent = `${label} ${Math.round(c / cols * 100)}%`;
        await new Promise(r => setTimeout(r, 0));
        if (token !== specToken) return false;
        lastYield = performance.now();
      }
    }
    if (token !== specToken) return false;
    specDb = db; specMeta = { cols, bins, fft, hop, stride, sr, N, capped };
    return true;
  }
  function buildRowMap() {
    const { sr, fft, bins } = specMeta, nyq = sr / 2, log = isLogScale(nyq);
    const mode = new Uint8Array(IMG_H), A = new Int32Array(IMG_H), B = new Int32Array(IMG_H), F = new Float32Array(IMG_H);
    for (let y = 0; y < IMG_H; y++) {
      const pHi = hzFromFrac(1 - y / IMG_H, nyq, log) * fft / sr, pLo = hzFromFrac(1 - (y + 1) / IMG_H, nyq, log) * fft / sr;
      if (pHi - pLo >= 1) { mode[y] = 1; A[y] = Math.max(0, Math.ceil(pLo)); B[y] = Math.min(bins - 1, Math.floor(pHi)); }
      else { const c = (pLo + pHi) / 2, b0 = Math.max(0, Math.min(bins - 1, Math.floor(c))); A[y] = b0; B[y] = Math.min(bins - 1, b0 + 1); F[y] = Math.max(0, Math.min(1, c - b0)); }
    }
    return { mode, A, B, F };
  }
  function rowValue(x, y) {
    const base = x * specMeta.bins, r = specRows;
    if (r.mode[y]) { let m = -Infinity; for (let k = r.A[y]; k <= r.B[y]; k++) { const v = specDb[base + k]; if (v > m) m = v; } return m; }
    return specDb[base + r.A[y]] * (1 - r.F[y]) + specDb[base + r.B[y]] * r.F[y];
  }
  function renderSpectrogramImage() {
    if (!specDb || !specMeta) return;
    const { cols } = specMeta;
    specRows = buildRowMap();
    if (!specImage || specImage.width !== cols || specImage.height !== IMG_H) { specImage = document.createElement("canvas"); specImage.width = cols; specImage.height = IMG_H; }
    const ctx = specImage.getContext("2d"), img = ctx.createImageData(cols, IMG_H), data = img.data;
    const palette = COLORS[$("paletteSelect").value] || COLORS.violet, lut = new Uint8Array(768);
    for (let i = 0; i < 256; i++) { const c = interpColor(i / 255, palette); lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2]; }
    const floor = spec.floor, k = 255 / Math.max(1, spec.ceil - spec.floor);
    for (let y = 0; y < IMG_H; y++) for (let x = 0; x < cols; x++) {
      let i = Math.round((rowValue(x, y) - floor) * k); i = i < 0 ? 0 : i > 255 ? 255 : i;
      const p = (y * cols + x) * 4; data[p] = lut[i * 3]; data[p + 1] = lut[i * 3 + 1]; data[p + 2] = lut[i * 3 + 2]; data[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  function updateSpecInfo() {
    const el = $("specInfo"); if (!el) return;
    if (!specMeta) { el.textContent = "—"; return; }
    const { sr, fft, stride, cols, capped } = specMeta;
    const overlap = Math.max(0, Math.round((1 - stride / fft) * 100));
    el.innerHTML = `Δf ${(sr / fft).toFixed(1)} Hz · Δt ${(stride / sr * 1000).toFixed(1)} ms · ${overlap}% overlap` +
      (capped ? `<br>Long file: ${cols} evenly spaced frames (effective hop ${Math.round(stride).toLocaleString()} samples)` : "");
  }
  async function recomputeSpectrogram(label) {
    if (!decodedBuffer) return false;
    const token = ++specToken, overlay = $("spectrogramOverlay");
    overlay.classList.remove("hidden");
    overlay.querySelector("span").textContent = `${label} 0%`;
    await new Promise(r => setTimeout(r, 20));
    const ok = await computeSpectrogram(decodedBuffer, token, label);
    if (!ok) return false;
    renderSpectrogramImage(); updateSpecInfo(); drawSpectrogram();
    overlay.classList.add("hidden");
    return true;
  }
  let recolorQueued = false;
  function queueRecolor() {
    if (recolorQueued) return; recolorQueued = true;
    requestAnimationFrame(() => { recolorQueued = false; if (!specDb) return; renderSpectrogramImage(); drawSpectrogram(); });
  }
  // ---- Axes -------------------------------------------------------------
  function frequencyTickList(plotH) {
    const sr = specMeta ? specMeta.sr : (decodedBuffer ? decodedBuffer.sampleRate : 48000), nyq = sr / 2, log = isLogScale(nyq);
    let freqs = [];
    if (log) freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 40000].filter(f => f <= nyq * 1.001);
    else { const steps = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000]; const step = steps.find(s => s / nyq * plotH >= 24) || 20000; for (let f = 0; f <= nyq * 1.001; f += step) freqs.push(f); }
    const out = []; let lastY = Infinity;
    for (const f of freqs) { const frac = fracFromHz(f, nyq, log), y = (1 - frac) * plotH; if (lastY - y >= 15) { out.push({ f, frac }); lastY = y; } }
    return { ticks: out, nyq, log };
  }
  function renderFrequencyAxis(plotH) {
    const { ticks, nyq, log } = frequencyTickList(plotH), key = `${log}|${nyq}|${Math.round(plotH)}`;
    if (key !== freqAxisKey) {
      freqAxisKey = key;
      const box = $("frequencyTicks"); box.innerHTML = "";
      ticks.forEach(({ f, frac }) => { const s = document.createElement("span"); s.textContent = formatHz(f); s.style.top = `${(1 - frac) * 100}%`; box.appendChild(s); });
      $("frequencyAxisTitle").textContent = log ? "FREQUENCY (Hz · LOG)" : "FREQUENCY (Hz · LINEAR)";
    }
    return ticks;
  }
  const AMP_TICKS = [1, 0.5, 0, -0.5, -1];
  function renderAmplitudeAxis() {
    const box = $("amplitudeTicks"); if (!box) return; box.innerHTML = "";
    AMP_TICKS.forEach(a => { const s = document.createElement("span"); s.textContent = a === 0 ? "0" : `${a > 0 ? "+" : "−"}${Math.abs(a).toFixed(1)}`; if (a === 0) s.className = "zero"; s.style.top = `${(0.5 - a * AMP_K) * 100}%`; box.appendChild(s); });
  }
  // ---- Cursor readout ---------------------------------------------------
  function setReadout(t, f, d) { $("curTime").textContent = t; $("curFreq").textContent = f; $("curDb").textContent = d; $("cursorReadout").classList.toggle("idle", t === "—"); }
  function updateSpecCursor(event) {
    if (!specDb || !specRows || !duration) return;
    const rect = specCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    specCursor = { x, y };
    const nyq = specMeta.sr / 2, log = isLogScale(nyq), ratio = x / rect.width;
    const col = Math.min(specMeta.cols - 1, Math.floor(ratio * specMeta.cols)), row = Math.min(IMG_H - 1, Math.floor(y / rect.height * IMG_H));
    const level = rowValue(col, row);
    setReadout(formatTimePrecise(ratio * duration), formatHz(hzFromFrac(1 - y / rect.height, nyq, log), true), level <= -199 ? "−∞ dB" : `${level.toFixed(1).replace("-", "−")} dB`);
    drawSpectrogram();
  }
  function clearSpecCursor() { specCursor = null; setReadout("—", "—", "—"); drawSpectrogram(); }
  function buildWaveform(buffer) {
    const data = buffer.getChannelData(0);
    const points = Math.min(5000, Math.max(1000, Math.ceil(data.length / 256)));
    const samplesPerPoint = Math.max(1, Math.floor(data.length / points));
    wavePeaks = new Float32Array(points * 2);
    for (let i = 0; i < points; i++) {
      let min = 1, max = -1;
      const start = i * samplesPerPoint;
      for (let j = start; j < Math.min(data.length, start + samplesPerPoint); j++) {
        if (data[j] < min) min = data[j];
        if (data[j] > max) max = data[j];
      }
      wavePeaks[i * 2] = min; wavePeaks[i * 2 + 1] = max;
    }
  }
  function drawSpectrogram() {
    if (!specImage) return;
    const { w, h } = resizeCanvas(specCanvas, specCtx);
    specCtx.fillStyle = "#0a1020"; specCtx.fillRect(0, 0, w, h);
    specCtx.imageSmoothingEnabled = false;
    specCtx.drawImage(specImage, 0, 0, w, h);
    // Frequency grid (matches the axis labels) and a subtle time grid.
    const ticks = renderFrequencyAxis(h);
    specCtx.strokeStyle = "rgba(225,232,255,.13)"; specCtx.lineWidth = 1;
    ticks.forEach(({ frac }) => { const y = Math.min(h - .5, Math.max(.5, Math.round((1 - frac) * h) + .5)); specCtx.beginPath(); specCtx.moveTo(0, y); specCtx.lineTo(w, y); specCtx.stroke(); });
    specCtx.strokeStyle = "rgba(225,232,255,.10)";
    for (let i = 1; i < 8; i++) { const x = Math.round(w * i / 8) + .5; specCtx.beginPath(); specCtx.moveTo(x, 0); specCtx.lineTo(x, h); specCtx.stroke(); }
    if (duration > 0) {
      const x = Math.max(0, Math.min(w, playhead * w));
      specCtx.fillStyle = "rgba(9,13,28,.18)"; specCtx.fillRect(0, 0, x, h);
      specCtx.strokeStyle = "#f7f5ff"; specCtx.lineWidth = 1.5; specCtx.beginPath(); specCtx.moveTo(x + .5, 0); specCtx.lineTo(x + .5, h); specCtx.stroke();
      specCtx.fillStyle = "#fff"; specCtx.beginPath(); specCtx.moveTo(x - 4, 0); specCtx.lineTo(x + 4, 0); specCtx.lineTo(x, 6); specCtx.fill();
    }
    if (specCursor) {
      const cx = Math.min(w - .5, specCursor.x + .5), cy = Math.min(h - .5, specCursor.y + .5);
      specCtx.save(); specCtx.setLineDash([4, 3]); specCtx.strokeStyle = "rgba(255,255,255,.7)"; specCtx.lineWidth = 1;
      specCtx.beginPath(); specCtx.moveTo(cx, 0); specCtx.lineTo(cx, h); specCtx.moveTo(0, cy); specCtx.lineTo(w, cy); specCtx.stroke(); specCtx.restore();
    }
  }
  function drawWaveform() {
    const { w, h } = resizeCanvas(waveCanvas, waveCtx);
    waveCtx.clearRect(0, 0, w, h);
    waveCtx.fillStyle = "#0a1020"; waveCtx.fillRect(0, 0, w, h);
    const mid = h / 2, amp = h * AMP_K;
    // Grid lines sit exactly on the Y-axis ticks (+1, +0.5, 0, −0.5, −1).
    waveCtx.lineWidth = 1;
    AMP_TICKS.forEach(a => {
      const y = Math.round(mid - a * amp) + .5;
      waveCtx.strokeStyle = a === 0 ? "rgba(156,142,255,.4)" : "rgba(143,158,195,.16)";
      waveCtx.beginPath(); waveCtx.moveTo(0, y); waveCtx.lineTo(w, y); waveCtx.stroke();
    });
    if (wavePeaks) {
      const count = wavePeaks.length / 2, step = w / count;
      waveCtx.lineWidth = Math.max(1, step * .8);
      waveCtx.strokeStyle = "#9b8cff";
      waveCtx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = i * step;
        waveCtx.moveTo(x, mid - wavePeaks[i * 2 + 1] * amp);
        waveCtx.lineTo(x, mid - wavePeaks[i * 2] * amp);
      }
      waveCtx.stroke();
      const x = Math.max(0, Math.min(w, playhead * w));
      waveCtx.fillStyle = "rgba(9,13,28,.2)"; waveCtx.fillRect(0, 0, x, h);
      waveCtx.strokeStyle = "#f7f5ff"; waveCtx.lineWidth = 1.5; waveCtx.beginPath(); waveCtx.moveTo(x + .5, 0); waveCtx.lineTo(x + .5, h); waveCtx.stroke();
      waveCtx.fillStyle = "#fff"; waveCtx.beginPath(); waveCtx.moveTo(x - 4, 0); waveCtx.lineTo(x + 4, 0); waveCtx.lineTo(x, 6); waveCtx.fill();
    }
  }
  function updateAxisLabels() {
    document.querySelectorAll(".time-axis").forEach(axis => {
      axis.innerHTML = `<span>00:00</span><span>TIME →</span><span>${formatTime(duration, false)}</span>`;
    });
  }
  function updateAudioProperties(buffer) {
    const channelCount = buffer.numberOfChannels;
    let peak = 0, sumSquares = 0, samples = 0;
    const mono = new Float32Array(buffer.length);
    for (let c = 0; c < channelCount; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        peak = Math.max(peak, Math.abs(v));
        sumSquares += v * v; samples++;
        mono[i] += v / channelCount;
      }
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, samples));
    const db = v => v <= 0 ? "−∞" : (20 * Math.log10(v)).toFixed(1);
    const frameSize = Math.max(1, Math.floor(buffer.sampleRate * 0.1));
    const levels = [];
    for (let start = 0; start < mono.length; start += frameSize) {
      let sum = 0; const n = Math.min(frameSize, mono.length - start);
      for (let i = 0; i < n; i++) sum += mono[start + i] * mono[start + i];
      const level = Math.sqrt(sum / Math.max(1, n));
      if (level > 1e-7) levels.push(level);
    }
    let snr = "Not available";
    if (levels.length > 1) {
      levels.sort((a, b) => a - b);
      const quiet = levels[Math.floor((levels.length - 1) * 0.1)];
      const loud = levels[Math.floor((levels.length - 1) * 0.9)];
      snr = `${(20 * Math.log10(Math.max(loud, 1e-9) / Math.max(quiet, 1e-9))).toFixed(1)} dB`;
    }
    // Find the strongest non-DC FFT bin in a bounded segment using a 2048-point DFT.
    const fftSize = Math.min(2048, 2 ** Math.floor(Math.log2(Math.max(2, mono.length))));
    let peakFrequency = "Not available";
    if (fftSize >= 256) {
      const start = Math.max(0, Math.floor((mono.length - fftSize) / 2));
      let bestPower = 0, bestBin = 0;
      for (let k = 1; k < fftSize / 2; k++) {
        let re = 0, im = 0;
        for (let n = 0; n < fftSize; n++) {
          const win = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / (fftSize - 1));
          const angle = 2 * Math.PI * k * n / fftSize;
          const value = mono[start + n] * win;
          re += value * Math.cos(angle); im -= value * Math.sin(angle);
        }
        const power = re * re + im * im;
        if (power > bestPower) { bestPower = power; bestBin = k; }
      }
      if (bestBin) {
        const hz = bestBin * buffer.sampleRate / fftSize;
        peakFrequency = hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz.toFixed(1)} Hz`;
      }
    }
    $("peakFrequency").textContent = peakFrequency;
    $("snrValue").textContent = snr;
    $("peakAmplitude").textContent = `${peak.toFixed(6)} (${db(peak)} dBFS)`;
    $("rmsLevel").textContent = `${rms.toFixed(6)} (${db(rms)} dBFS)`;
    $("propertySampleRate").textContent = `${(buffer.sampleRate / 1000).toFixed(1)} kHz`;
    $("propertyChannels").textContent = String(channelCount);
    // Treat audio as empty-like only when every core signal indicator is absent/zero.
    // SNR alone may be unavailable for valid short or steady recordings.
    currentAudioInvalid = mono.length === 0 || (peak <= 1e-9 && rms <= 1e-9 && peakFrequency === "Not available" && snr === "Not available");
    updatePlaylistUI();
  }
  async function walkDirectory(dirHandle, relativePath = "") {
    const files = [];
    for await (const [name, child] of dirHandle.entries()) {
      const path = relativePath ? `${relativePath}/${name}` : name;
      if (child.kind === "directory") {
        const result = await walkDirectory(child, path);
        files.push(...result.files);
      } else if (child.kind === "file") {
        try {
          const file = await child.getFile();
          if (isAudioFile(file)) files.push({ name: file.name, relativePath: path, file, handle: child, parentHandle: dirHandle, size: file.size });
        } catch (err) { console.warn("Skipping inaccessible file", path, err); }
      }
    }
    return { files };
  }
  function openFolderReadOnly(reason) {
    showToast(`${reason} Opening folder in read-only mode (deleting from disk is unavailable).`);
    try { folderInput.click(); } catch (e) {}
  }
  async function chooseFolderWithPermission() {
    if (!window.isSecureContext || typeof window.showDirectoryPicker !== "function") {
      openFolderReadOnly("Direct folder access isn't available here.");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      invalidAudioFiles = [];
      const result = await walkDirectory(handle);
      const entries = result.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: "base" }));
      directoryHandle = handle; playlistEntries = entries; playlistSource = "directory";
      playlist = entries.map(item => item.file); playlistIndex = entries.length ? 0 : -1; updatePlaylistUI();
      if (entries.length) await loadPlaylistTrack(0);
      else { workspace.classList.remove("hidden"); dropZone.classList.add("hidden"); showToast("No supported audio files found. You can scan the selected folder for invalid audio."); }
      updateCleanupUI(); refreshCleanupState();
      showToast(`Scanned folder and subfolders: ${entries.length} audio files found.`);
    } catch (err) {
      if (err && err.name !== "AbortError") {
        console.error("Folder access failed:", err);
        openFolderReadOnly("Folder access was blocked or failed.");
      }
    }
  }
  function updateCleanupUI() {
    const summary = $("cleanupSummary");
    if (summary) summary.textContent = `${invalidAudioFiles.length} invalid audio file(s) found in the selected folder and its subfolders.`;
    const invalidSelect = $("invalidAudioSelect");
    if (invalidSelect) {
      invalidSelect.innerHTML = "";
      invalidSelect.disabled = !directoryHandle || invalidAudioFiles.length === 0;
      invalidSelect.appendChild(new Option(invalidAudioFiles.length ? "Choose an invalid recording…" : "No invalid audio files found", ""));
      invalidAudioFiles.forEach((item, index) => invalidSelect.appendChild(new Option(item.relativePath, String(index))));
    }
    const invalidCount = $("invalidAudioCount");
    if (invalidCount) invalidCount.textContent = `${invalidAudioFiles.length} found`;
    $("deleteInvalidFiles").disabled = !invalidAudioFiles.length;
      }
  async function wavSilent(file) {
    const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    const dv = new DataView(head.buffer);
    const tag = o => String.fromCharCode(head[o], head[o + 1], head[o + 2], head[o + 3]);
    if (head.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
    let o = 12, bits = 0, fmt = 0, start = -1, len = 0;
    while (o + 8 <= head.length) {
      const id = tag(o), sz = dv.getUint32(o + 4, true);
      if (id === "fmt " && o + 24 <= head.length) { fmt = dv.getUint16(o + 8, true); bits = dv.getUint16(o + 22, true); }
      else if (id === "data") { start = o + 8; len = sz; break; }
      o += 8 + sz + (sz & 1);
    }
    if (start < 0 || !bits || ![1, 3, 0xFFFE].includes(fmt)) return null;
    const end = Math.min(file.size, len ? start + len : file.size), zero = bits === 8 ? 128 : 0;
    for (let p = start; p < end; p += 1048576) {
      const u = new Uint8Array(await file.slice(p, Math.min(end, p + 1048576)).arrayBuffer());
      for (let i = 0; i < u.length; i++) if (u[i] !== zero) return false;
    }
    return true;
  }
  let cleanupToken = 0;
  async function runInvalidScan(quiet = false) {
    const tk = cleanupToken;
    if (!directoryHandle) { if (!quiet) showToast("Choose a folder using the folder picker to scan and manage disk files."); return; }
    try {
      const found = [];
      const result = await walkDirectory(directoryHandle);
      const scope = (subfolderSelect?.value || "").trim();
      const candidates = result.files.filter(item => isAudioFile(item.file) && (!scope || item.relativePath.startsWith(scope + "/")));
      if (!quiet) showToast(`Checking ${candidates.length} audio files for zero signal…`);
      const delBtn = $("deleteInvalidFiles");
      let done = 0;
      for (const item of candidates) {
        if (quiet && tk !== cleanupToken) return;
        if (delBtn && (++done % 5 === 0 || done === candidates.length)) delBtn.textContent = `Checking ${done}/${candidates.length}…`;
        if (item.size === 0) { found.push(item); continue; }
        if (/\.wav$/i.test(item.name)) {
          let silent = null;
          try { silent = await wavSilent(item.file); } catch (e) {}
          if (silent !== null) { if (silent) found.push(item); continue; }
        }
        try {
          const buffer = await decodeAudio(item.file);
          let peak = 0, sumSquares = 0, samples = 0;
          for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
              const value = Number.isFinite(data[i]) ? data[i] : 0;
              peak = Math.max(peak, Math.abs(value));
              sumSquares += value * value; samples++;
            }
          }
          const rms = Math.sqrt(sumSquares / Math.max(1, samples));
          if (buffer.length > 0 && peak <= 1e-9 && rms <= 1e-9) found.push(item);
        } catch (err) { console.warn("Could not decode during invalid-audio scan:", item.relativePath, err); }
      }
      if ((quiet && tk !== cleanupToken) || !directoryHandle) return;
      if (delBtn) delBtn.textContent = "Delete invalid files";
      invalidAudioFiles = found;
      updateCleanupUI();
      if (!quiet) showToast(`Scan complete: ${found.length} invalid audio file(s) found.`);
    } catch (err) { console.error(err); showToast("Could not scan the selected folder."); const b = $("deleteInvalidFiles"); if (b) b.textContent = "Delete invalid files"; }
  }
  async function refreshCleanupState() {
    const t = ++cleanupToken;
    const di = $("deleteInvalidFiles"), de = $("deleteEmptyFolders");
    if (di) di.disabled = true; if (de) de.disabled = true;
    if (!directoryHandle) return;
    try { const dirs = []; await findEmptyDirs(directoryHandle, "", dirs); if (t === cleanupToken && de) de.disabled = !dirs.length; } catch (e) {}
    await runInvalidScan(true);
  }
  $("scanCleanup")?.addEventListener("click", runInvalidScan);

  $("deleteInvalidFiles")?.addEventListener("click", async () => {
    if (!directoryHandle) return;
    await runInvalidScan(true);
    if (!invalidAudioFiles.length) return;
    const count = invalidAudioFiles.length;
    if (!confirm(`Permanently delete all ${count} invalid audio file(s) found in ${(subfolderSelect?.value || "").trim() ? "“" + subfolderSelect.value.trim() + "” and its subfolders" : "the opened folder and all its subfolders"}? This cannot be undone.`)) return;
    let removed = 0;
    const removedPaths = new Set();
    for (const item of [...invalidAudioFiles]) {
      try { await item.parentHandle.removeEntry(item.name); removed++; removedPaths.add(item.relativePath); }
      catch (err) { console.warn("Could not delete invalid audio", item.relativePath, err); }
    }
    playlistEntries = playlistEntries.filter(item => !removedPaths.has(item.relativePath));
    playlist = playlistEntries.map(item => item.file);
    invalidAudioFiles = [];
    playlistIndex = playlist.length ? Math.min(playlistIndex, playlist.length - 1) : -1;
    updateCleanupUI(); updatePlaylistUI();
    if (playlistIndex >= 0) await loadPlaylistTrack(playlistIndex);
    showToast(`Deleted ${removed} of ${count} invalid audio file(s).`);
    refreshCleanupState();
  });

  async function findEmptyDirs(dirHandle, path = "", out = []) {
    let empty = true;
    for await (const [name, child] of dirHandle.entries()) {
      const p = path ? `${path}/${name}` : name;
      if (child.kind === "directory") {
        const before = out.length;
        const childEmpty = await findEmptyDirs(child, p, out);
        if (childEmpty) out.push({ name, path: p, parentHandle: dirHandle }); else empty = false;
      } else empty = false;
    }
    return empty;
  }
  $("deleteEmptyFolders")?.addEventListener("click", async () => {
    if (!directoryHandle) { showToast("Choose a folder using the folder picker first."); return; }
    try {
      const dirs = []; await findEmptyDirs(directoryHandle, "", dirs);
      if (!dirs.length) { showToast("No empty subfolders found."); return; }
      if (!confirm(`Permanently delete ${dirs.length} empty subfolder(s)?\n\n${dirs.slice(0, 15).map(d => d.path).join("\n")}${dirs.length > 15 ? "\n…" : ""}`)) return;
      let removed = 0;
      for (const d of dirs) { try { await d.parentHandle.removeEntry(d.name); removed++; } catch (err) { console.warn("Could not delete folder", d.path, err); } }
      updateSubfolderOptions();
      showToast(`Deleted ${removed} of ${dirs.length} empty subfolder(s).`);
      refreshCleanupState();
    } catch (err) { console.error(err); showToast("Could not delete empty subfolders."); }
  });

  $("invalidAudioSelect")?.addEventListener("change", async event => {
    const index = Number(event.target.value);
    if (event.target.value === "" || !invalidAudioFiles[index]) return;
    const item = invalidAudioFiles[index];
    const playlistPosition = playlistEntries.findIndex(entry => entry.relativePath === item.relativePath);
    if (playlistPosition >= 0) await loadPlaylistTrack(playlistPosition);
  });

  async function decodeAudio(file) {
    if (!window.AudioContext && !window.webkitAudioContext) throw new Error("This browser does not support Web Audio.");
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") await audioContext.resume();
    const arrayBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  }
  async function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(wav|mp3|m4a|flac|ogg|aac|aiff|opus)$/i.test(file.name)) {
      showToast("Choose a supported audio file."); return;
    }
    if (rendering) showToast("Preparing audio…");
    currentFile = file;
    specToken++; // abandon any in-flight spectrogram for the previous file
    currentAudioInvalid = file.size === 0;
    updatePlaylistUI();
    dropZone.classList.add("hidden");
    emptyState.classList.add("hidden");
    workspace.classList.remove("hidden");
    $("fileSummary").classList.remove("hidden");
    $("fileName").textContent = file.name;
    $("fileMeta").textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB · Decoding…`;
    $("sampleRateLabel").textContent = "Decoding audio…";
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    audio.load();
    $("spectrogramOverlay").classList.remove("hidden");
    $("waveformOverlay").classList.remove("hidden");
    $("spectrogramOverlay").querySelector("span").textContent = "Generating spectrogram…";
    $("waveformOverlay").querySelector("span").textContent = "Generating waveform…";
    try {
      rendering = true;
      decodedBuffer = await decodeAudio(file);
      duration = decodedBuffer.duration;
      updateAudioProperties(decodedBuffer);
      $("fileMeta").textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB · ${formatTime(duration, false)}`;
      $("sampleRateLabel").textContent = `${(decodedBuffer.sampleRate / 1000).toFixed(1)} kHz · ${decodedBuffer.numberOfChannels} channel${decodedBuffer.numberOfChannels === 1 ? "" : "s"}`;
      buildWaveform(decodedBuffer);
      drawWaveform();
      $("waveformOverlay").classList.add("hidden");
      // Yield to browser before CPU-bound spectrogram computation.
      await new Promise(resolve => setTimeout(resolve, 40));
      await recomputeSpectrogram("Generating spectrogram…");
      updateAxisLabels();
      updateSeekUI();
      setPlayingState(false);
      showToast("Audio loaded. Click either visualization to seek.");
    } catch (err) {
      console.error(err);
      currentAudioInvalid = true;
      updatePlaylistUI();
      showToast(`Could not decode this audio: ${err.message || "unsupported format"}`);
      $("spectrogramOverlay").querySelector("span").textContent = "Unable to decode this audio file";
      $("waveformOverlay").querySelector("span").textContent = "Unable to decode this audio file";
    } finally { rendering = false; }
  }
  function seekFromCanvas(event, canvas) {
    if (!duration) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    updateSeekUI();
  }
  let singleHandle = null, singleFile = null;
  async function pickSingleFile(e) {
    if (typeof window.showOpenFilePicker !== "function" || !window.isSecureContext) return;
    e.preventDefault();
    try {
      const [h] = await window.showOpenFilePicker({ types: [{ description: "Audio", accept: { "audio/*": [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac", ".aiff", ".opus"] } }] });
      const file = await h.getFile();
      if (!isAudioFile(file)) { showToast("Choose a supported audio file."); return; }
      audio.pause(); audio.currentTime = 0;
      playlist = [file]; playlistIndex = 0; playlistEntries = []; directoryHandle = null; playlistSource = "files";
      singleHandle = h; singleFile = file; updatePlaylistUI(); loadFile(file);
    } catch (err) { if (err.name !== "AbortError") console.warn("File picker failed:", err); }
  }
  document.querySelectorAll('label[for="audioInput"], label[for="replaceAudioInput"]').forEach(l => l.addEventListener("click", pickSingleFile));
  input.addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      playlist = [file]; playlistIndex = 0; playlistEntries = []; directoryHandle = null; playlistSource = "files"; updatePlaylistUI();
      loadFile(file);
    }
    input.value = "";
  });
  folderInput.addEventListener("change", e => {
    directoryHandle = null; playlistEntries = []; playlistSource = "files"; invalidAudioFiles = []; refreshCleanupState();
    const selected = Array.from(e.target.files || []).filter(file => isAudioFile(file));
    selected.sort((a, b) => {
      const aPath = a.webkitRelativePath || a.name;
      const bPath = b.webkitRelativePath || b.name;
      return aPath.localeCompare(bPath, undefined, { numeric: true, sensitivity: "base" });
    });
    if (!selected.length) {
      showToast("No supported audio files were found in that folder.");
    } else {
      playlist = selected;
      playlistIndex = 0;
      updatePlaylistUI();
      showToast(`Loaded ${selected.length} audio file${selected.length === 1 ? "" : "s"} from folder.`);
      loadPlaylistTrack(0);
    }
    folderInput.value = "";
  });
  trackSelect?.addEventListener("change", e => {
    const index = Number.parseInt(e.target.value, 10);
    if (Number.isInteger(index)) loadPlaylistTrack(index);
  });
  subfolderSelect?.addEventListener("change", () => {
    refreshCleanupState();
    updatePlaylistUI();
    const visible = visiblePlaylistIndices();
    if (visible.length && !visible.includes(playlistIndex)) loadPlaylistTrack(visible[0]);
  });
  previousTrackButton?.addEventListener("click", () => {
    const visible = visiblePlaylistIndices(); const pos = visible.indexOf(playlistIndex);
    if (pos > 0) loadPlaylistTrack(visible[pos - 1]);
  });
  nextTrackButton?.addEventListener("click", () => {
    const visible = visiblePlaylistIndices(); const pos = visible.indexOf(playlistIndex);
    if (pos >= 0 && pos < visible.length - 1) loadPlaylistTrack(visible[pos + 1]);
  });
  $("chooseFolderButton")?.addEventListener("click", chooseFolderWithPermission);
  $("managerChooseFolder")?.addEventListener("click", chooseFolderWithPermission);
  $("deleteTrack").addEventListener("click", async () => {
    if (playlistIndex < 0 || !playlist.length) return;
    const file = playlist[playlistIndex];
    const viaFolder = playlistSource === "directory" && directoryHandle && playlistEntries[playlistIndex];
    const viaHandle = !viaFolder && singleHandle && playlist[playlistIndex] === singleFile;
    const canDeleteFromDisk = viaFolder || viaHandle;
    if (!canDeleteFromDisk) { showToast("To delete this file from disk, open it with “Choose audio file” in Chrome or Edge on localhost/HTTPS, or open its folder."); return; }
    if (viaHandle && typeof singleHandle.remove !== "function") { showToast("This browser can't delete a single file. Open its folder with “Choose audio folder” instead."); return; }
    const prompt = `${currentAudioInvalid ? "This audio appears empty or has no usable signal metrics. " : ""}Permanently delete "${file.name}" from disk? This cannot be undone.`;
    if (!confirm(prompt)) return;
    audio.pause();
    try {
      if (viaFolder) await playlistEntries[playlistIndex].parentHandle.removeEntry(playlistEntries[playlistIndex].name);
      else { if ((await singleHandle.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("Permission denied"); await singleHandle.remove(); singleHandle = null; singleFile = null; }
      playlist.splice(playlistIndex, 1);
      if (playlistEntries.length) playlistEntries.splice(playlistIndex, 1);
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
      if (!playlist.length) {
        playlistIndex = -1; currentFile = null; decodedBuffer = null; specImage = null; wavePeaks = null; currentAudioInvalid = false;
        audio.removeAttribute("src"); audio.load(); workspace.classList.add("hidden"); dropZone.classList.remove("hidden"); emptyState.classList.remove("hidden");
        $("fileSummary").classList.add("hidden");
        ["peakFrequency","snrValue","peakAmplitude","rmsLevel","propertySampleRate","propertyChannels"].forEach(id => $(id).textContent = "—");
        updatePlaylistUI(); showToast("File deleted from disk."); return;
      }
      playlistIndex = Math.min(playlistIndex, playlist.length - 1);
      updatePlaylistUI(); await loadPlaylistTrack(playlistIndex);
      showToast("Invalid audio file deleted from folder.");
    } catch (err) { console.error(err); showToast("Could not delete file. Check folder permission and try again."); }
  });
  const replaceInput = $("replaceAudioInput");
  replaceInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      playlist = [file]; playlistIndex = 0; playlistEntries = []; directoryHandle = null; playlistSource = "files"; updatePlaylistUI();
      audio.pause();
      audio.currentTime = 0;
      loadFile(file);
    }
    replaceInput.value = "";
  });
  dropZone.addEventListener("dragover", e => { e.preventDefault(); dropZone.classList.add("dragging"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));
  dropZone.addEventListener("drop", e => {
    e.preventDefault(); dropZone.classList.remove("dragging");
    const files = [...e.dataTransfer.files].filter(isAudioFile);
    if (files.length) {
      playlist = files; playlistIndex = 0; playlistEntries = []; directoryHandle = null; playlistSource = "files"; updatePlaylistUI();
      loadPlaylistTrack(0);
    } else showToast("Drop audio files to begin.");
  });
  playButton.addEventListener("click", () => {
    if (!audio.src) { showToast("Choose an audio file first."); return; }
    if (audio.paused) audio.play().catch(() => showToast("Playback could not start. Try again.")); else audio.pause();
  });
  $("backButton").addEventListener("click", () => { audio.currentTime = Math.max(0, audio.currentTime - 5); updateSeekUI(); });
  $("forwardButton").addEventListener("click", () => { audio.currentTime = Math.min(duration, audio.currentTime + 5); updateSeekUI(); });
  seekBar.addEventListener("input", () => { if (duration) { audio.currentTime = Number(seekBar.value) / 1000 * duration; updateSeekUI(); } });
  $("volumeBar").addEventListener("input", e => { audio.volume = Number(e.target.value); });
  audio.volume = 0.85;
  audio.addEventListener("timeupdate", updateSeekUI);
  audio.addEventListener("play", () => setPlayingState(true));
  audio.addEventListener("pause", () => setPlayingState(false));
  audio.addEventListener("ended", () => { setPlayingState(false); updateSeekUI(); });
  specCanvas.addEventListener("pointerdown", e => seekFromCanvas(e, specCanvas));
  waveCanvas.addEventListener("pointerdown", e => seekFromCanvas(e, waveCanvas));
  // ---- Spectrogram settings -------------------------------------------------
  const dbText = v => `${String(v).replace("-", "−")} dB`;
  function syncDbOutputs() { $("dbFloorOut").textContent = dbText(spec.floor); $("dbCeilOut").textContent = dbText(spec.ceil); }
  function onDbInput(which) {
    let f = Number($("dbFloor").value), c = Number($("dbCeil").value);
    if (which === "floor" && f > c - 6) c = f + 6;
    if (which === "ceil" && c < f + 6) f = c - 6;
    $("dbFloor").value = f; $("dbCeil").value = c; spec.floor = f; spec.ceil = c;
    syncDbOutputs(); queueRecolor();
  }
  $("dbFloor").addEventListener("input", () => onDbInput("floor"));
  $("dbCeil").addEventListener("input", () => onDbInput("ceil"));
  ["fftSizeSelect", "hopSelect", "windowSelect"].forEach(id => $(id).addEventListener("change", () => {
    spec.fft = Number($("fftSizeSelect").value); spec.hop = Number($("hopSelect").value); spec.win = $("windowSelect").value;
    recomputeSpectrogram("Recomputing spectrogram…");
  }));
  $("specReset").addEventListener("click", () => {
    Object.assign(spec, SPEC_DEFAULTS);
    $("fftSizeSelect").value = String(spec.fft); $("hopSelect").value = String(spec.hop); $("windowSelect").value = spec.win;
    $("dbFloor").value = spec.floor; $("dbCeil").value = spec.ceil; syncDbOutputs();
    $("frequencyScale").value = "log"; $("paletteSelect").value = "violet";
    recomputeSpectrogram("Recomputing spectrogram…");
  });
  $("frequencyScale").addEventListener("change", () => { freqAxisKey = ""; queueRecolor(); });
  $("paletteSelect").addEventListener("change", queueRecolor);
  specCanvas.addEventListener("pointermove", updateSpecCursor);
  specCanvas.addEventListener("pointerleave", clearSpecCursor);
  syncDbOutputs(); renderAmplitudeAxis();
  window.addEventListener("resize", () => { if (decodedBuffer) { drawSpectrogram(); drawWaveform(); } });
  document.addEventListener("keydown", e => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) || document.querySelector("dialog[open]")) return;
    if (e.code === "Space") { e.preventDefault(); playButton.click(); }
    if (e.code === "ArrowLeft" && audio.src) { audio.currentTime = Math.max(0, audio.currentTime - 5); updateSeekUI(); }
    if (e.code === "ArrowRight" && audio.src) { audio.currentTime = Math.min(duration, audio.currentTime + 5); updateSeekUI(); }
  });
  $("aboutButton").addEventListener("click", () => $("aboutDialog").showModal());
  $("closeAbout").addEventListener("click", () => $("aboutDialog").close());
  $("closeAboutBottom").addEventListener("click", () => $("aboutDialog").close());
  $("aboutDialog").addEventListener("click", e => { if (e.target === $("aboutDialog")) $("aboutDialog").close(); });

  // Progressive Web App installation. Installation requires HTTPS or localhost.
  let installPrompt = null;
  const installButton = $("installButton");
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) { installButton.hidden = false; installButton.textContent = "Install app"; }
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    if (installButton) { installButton.textContent = "App installed"; installButton.disabled = true; }
    showToast("AcousticScope has been installed.");
  });
  installButton?.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      return;
    }
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      showToast("AcousticScope is already installed.");
    } else {
      showToast("To install: open your HTTPS site in Chrome/Edge, then use the browser menu and choose Install app.");
    }
  });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(err => console.error("Service worker registration failed", err)));
  }
})(); 
