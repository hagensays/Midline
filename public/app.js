const els = {
  themeBtn: document.getElementById("themeBtn"),
  themePicker: document.getElementById("themePicker"),
  pasteInput: document.getElementById("pasteInput"),
  usePasteBtn: document.getElementById("usePasteBtn"),
  clearPasteBtn: document.getElementById("clearPasteBtn"),
  sourceSelect: document.getElementById("sourceSelect"),
  refreshSourcesBtn: document.getElementById("refreshSourcesBtn"),
  loadSourceBtn: document.getElementById("loadSourceBtn"),
  speedRange: document.getElementById("speedRange"),
  speedValue: document.getElementById("speedValue"),
  fontRange: document.getElementById("fontRange"),
  fontValue: document.getElementById("fontValue"),
  loopToggle: document.getElementById("loopToggle"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  status: document.getElementById("status"),
  stage: document.getElementById("stage"),
  movingText: document.getElementById("movingText"),
};

const THEME_KEY = "midlineThemePack";
const DEFAULT_THEME = "midnight-classic";

const state = {
  loadedText: "",
  x: 0,
  textWidth: 0,
  playing: false,
  rafId: null,
  lastTs: 0,
  smoothedDt: 1 / 120,
  maxDt: 1 / 30,
  dtSmoothing: 0.22,
};

function getSavedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value || DEFAULT_THEME;
  } catch (_error) {
    return DEFAULT_THEME;
  }
}

function saveTheme(themeName) {
  try {
    localStorage.setItem(THEME_KEY, themeName);
  } catch (_error) {}
}

function updateThemeButtonTitle() {
  if (!els.themePicker || !els.themeBtn) {
    return;
  }
  const idx = els.themePicker.selectedIndex;
  if (idx < 0) {
    return;
  }
  const option = els.themePicker.options[idx];
  els.themeBtn.title = `Theme: ${option.textContent}`;
}

function applyTheme(themeName) {
  if (!els.themePicker) {
    return;
  }
  const resolved = themeName || DEFAULT_THEME;
  els.themePicker.value = resolved;
  const finalTheme = els.themePicker.value || DEFAULT_THEME;
  document.body.setAttribute("data-theme", finalTheme);
  saveTheme(finalTheme);
  updateThemeButtonTitle();
}

function cycleTheme() {
  if (!els.themePicker || !els.themePicker.options.length) {
    return;
  }
  const current = document.body.getAttribute("data-theme") || getSavedTheme();
  let currentIdx = 0;
  for (let i = 0; i < els.themePicker.options.length; i += 1) {
    if (els.themePicker.options[i].value === current) {
      currentIdx = i;
      break;
    }
  }
  const nextIdx = (currentIdx + 1) % els.themePicker.options.length;
  applyTheme(els.themePicker.options[nextIdx].value);
}

function sanitizeText(rawText) {
  return rawText.replace(/\s+/g, " ").trim();
}

function setStatus(message) {
  els.status.textContent = message;
}

function updateSpeedLabel() {
  els.speedValue.value = `${Number(els.speedRange.value)} px/s`;
}

function updateFontLabel() {
  const size = Number(els.fontRange.value);
  els.fontValue.value = `${size} px`;
  els.movingText.style.fontSize = `${size}px`;
  measureText();
  placeText();
}

function measureText() {
  const rect = els.movingText.getBoundingClientRect();
  state.textWidth = rect.width;
}

function placeText() {
  els.movingText.style.transform = `translate3d(${state.x}px, -50%, 0)`;
}

function resetPlayback() {
  pausePlayback();
  state.x = els.stage.clientWidth + 30;
  placeText();
  if (state.loadedText) {
    setStatus("Ready. Press Start.");
  }
}

function setLoadedText(text, sourceName) {
  state.loadedText = text;
  els.movingText.textContent = `   ${text}   `;
  measureText();
  resetPlayback();
  setStatus(`Loaded ${text.length} characters from ${sourceName}.`);
}

function usePastedText() {
  const text = sanitizeText(els.pasteInput.value || "");
  if (!text) {
    setStatus("Paste some text first.");
    return;
  }
  setLoadedText(text, "pasted text");
}

async function refreshSources() {
  try {
    const response = await fetch("/api/sources", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to fetch sources");
    }
    const data = await response.json();
    const files = Array.isArray(data.files) ? data.files : [];
    els.sourceSelect.innerHTML = "";
    for (const name of files) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      els.sourceSelect.append(option);
    }
    if (!files.length) {
      setStatus("No .txt files found in .txt sources.");
    } else {
      setStatus(`Found ${files.length} text file(s) in .txt sources.`);
      els.sourceSelect.selectedIndex = 0;
    }
  } catch (error) {
    setStatus("Could not load source list.");
  }
}

async function loadSelectedSource() {
  const selected = els.sourceSelect.value;
  if (!selected) {
    setStatus("Pick a file from the list first.");
    return;
  }
  try {
    const response = await fetch(`/api/source?name=${encodeURIComponent(selected)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Load failed");
    }
    const data = await response.json();
    const text = sanitizeText(data.text || "");
    if (!text) {
      setStatus(`${selected} is empty.`);
      return;
    }
    els.pasteInput.value = text;
    setLoadedText(text, selected);
  } catch (error) {
    setStatus("Failed to load selected file.");
  }
}

function tick(ts) {
  if (!state.playing) {
    return;
  }

  if (!state.lastTs) {
    state.lastTs = ts;
  }

  let dt = (ts - state.lastTs) / 1000;
  state.lastTs = ts;

  if (dt < 0) dt = 0;
  if (dt > 0.1) dt = 0.1;
  dt = Math.min(dt, state.maxDt);

  state.smoothedDt =
    (1 - state.dtSmoothing) * state.smoothedDt + state.dtSmoothing * dt;

  const speed = Number(els.speedRange.value);
  const step = speed * state.smoothedDt;
  state.x -= step;

  if (state.x + state.textWidth < 0) {
    if (els.loopToggle.checked) {
      state.x = els.stage.clientWidth + 30;
    } else {
      pausePlayback();
      setStatus("Finished.");
      return;
    }
  }

  placeText();
  state.rafId = requestAnimationFrame(tick);
}

function startPlayback() {
  if (!state.loadedText) {
    usePastedText();
    if (!state.loadedText) {
      return;
    }
  }
  if (state.playing) {
    return;
  }
  state.playing = true;
  state.lastTs = 0;
  state.smoothedDt = 1 / 120;
  setStatus("Playing...");
  state.rafId = requestAnimationFrame(tick);
}

function pausePlayback() {
  if (!state.playing) {
    return;
  }
  state.playing = false;
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
  setStatus("Paused.");
}

function togglePlayPause() {
  if (state.playing) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function clearPastedInput() {
  els.pasteInput.value = "";
}

function handleSpaceShortcut(event) {
  if (event.code !== "Space") {
    return;
  }
  const tagName = document.activeElement ? document.activeElement.tagName : "";
  if (tagName === "TEXTAREA" || tagName === "INPUT" || tagName === "SELECT") {
    return;
  }
  event.preventDefault();
  togglePlayPause();
}

function onResize() {
  if (!state.playing) {
    placeText();
  }
}

function wireEvents() {
  els.themeBtn.addEventListener("click", cycleTheme);
  els.themePicker.addEventListener("change", (event) => applyTheme(event.target.value));

  els.usePasteBtn.addEventListener("click", usePastedText);
  els.clearPasteBtn.addEventListener("click", clearPastedInput);
  els.refreshSourcesBtn.addEventListener("click", refreshSources);
  els.loadSourceBtn.addEventListener("click", loadSelectedSource);

  els.speedRange.addEventListener("input", updateSpeedLabel);
  els.fontRange.addEventListener("input", updateFontLabel);
  els.startBtn.addEventListener("click", startPlayback);
  els.pauseBtn.addEventListener("click", pausePlayback);
  els.resetBtn.addEventListener("click", resetPlayback);

  window.addEventListener("keydown", handleSpaceShortcut);
  window.addEventListener("resize", onResize);
}

function init() {
  applyTheme(getSavedTheme());
  wireEvents();
  updateSpeedLabel();
  updateFontLabel();
  resetPlayback();
  refreshSources();
}

init();
