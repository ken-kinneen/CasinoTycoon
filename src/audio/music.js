const CACHE_NAME = 'casino-tycoon-music-v1';
const MUSIC_URL = './music.mp3';
const STORAGE_KEY = 'casino-tycoon-music-muted';
const VOL_KEY = 'casino-tycoon-music-vol';
const POS_KEY = 'casino-tycoon-music-pos';
const SAVE_INTERVAL = 3000;

let audio = null;
let muted = localStorage.getItem(STORAGE_KEY) === '1';
let volume = (() => { const v = parseFloat(localStorage.getItem(VOL_KEY)); return Number.isFinite(v) ? v : 0.3; })();
let started = false;
let posTimer = null;

function savePosition() {
  if (audio && !audio.paused) {
    localStorage.setItem(POS_KEY, String(audio.currentTime));
  }
}

function getSavedPosition() {
  const v = parseFloat(localStorage.getItem(POS_KEY));
  return Number.isFinite(v) ? v : 0;
}

async function loadFromCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    let response = await cache.match(MUSIC_URL);
    if (!response) {
      await cache.add(MUSIC_URL);
      response = await cache.match(MUSIC_URL);
    }
    if (!response) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return MUSIC_URL;
  }
}

async function init() {
  const src = await loadFromCache() || MUSIC_URL;
  audio = new Audio(src);
  audio.loop = true;
  audio.volume = volume;
  audio.muted = muted;
  audio.currentTime = getSavedPosition();
}

function startSaving() {
  if (posTimer) return;
  posTimer = setInterval(savePosition, SAVE_INTERVAL);
  window.addEventListener('beforeunload', savePosition);
}

export function start() {
  if (started) return;
  started = true;
  if (!audio) {
    init().then(() => {
      if (!muted) audio.play().catch(() => {});
      startSaving();
    });
  } else {
    if (!muted) audio.play().catch(() => {});
    startSaving();
  }
}

export function toggleMute() {
  muted = !muted;
  localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  if (audio) {
    audio.muted = muted;
    if (!muted && audio.paused) audio.play().catch(() => {});
  }
  return muted;
}

export function isMuted() { return muted; }

export function getVolume() { return volume; }

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  localStorage.setItem(VOL_KEY, String(volume));
  if (audio) audio.volume = volume;
}

init();
