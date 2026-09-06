import { game, STAT_META } from '../state.js';
import { ICONS } from './icons.js';
import { HUD, STAT_ICON } from './hud.js';

const $ = id => document.getElementById(id);
const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 4500;

let enabled = false;
let prevStats = null;
let persistentEl = null;

export const MSG_FROM = {
  casino:   { icon: 'building', label: 'Casino',     cls: 'msg-from-casino' },
  player:   { icon: 'person',   label: 'You',        cls: 'msg-from-player' },
  stat:     { icon: 'stats',    label: 'Stats',       cls: 'msg-from-stat' },
  inspect:  { icon: 'shield',   label: 'Inspector',   cls: 'msg-from-inspect', dismiss: true },
  system:   { icon: 'gear',     label: 'System',      cls: 'msg-from-system' },
  trophy:   { icon: 'trophy',   label: 'Achievement', cls: 'msg-from-trophy',  dismiss: true },
  tutorial: { icon: 'help',     label: 'Tutorial',    cls: 'msg-from-tutorial' },
};

export function setMessagesEnabled(on) {
  enabled = on;
  const el = $('message-banner');
  if (el) el.classList.toggle('hidden', !on);
}

export function isMessagesEnabled() { return enabled; }

function getPlayerPortrait() {
  if (HUD.portraitDataURL) return HUD.portraitDataURL;
  return null;
}

function buildAvatar(from) {
  const sender = MSG_FROM[from] || MSG_FROM.system;
  const isPlayer = from === 'player';

  if (isPlayer) {
    const portrait = getPlayerPortrait();
    if (portrait) {
      return `<div class="msg-avatar msg-avatar-portrait"><img src="${portrait}" class="msg-portrait-img" /></div>`;
    }
    return `<div class="msg-avatar msg-avatar-portrait"><span class="msg-avatar-icon msg-avatar-icon-lg">${ICONS.person}</span></div>`;
  }
  return `<div class="msg-avatar"><span class="msg-avatar-icon">${ICONS[sender.icon] || ICONS.star}</span></div>`;
}

/**
 * Show a message in the unified banner.
 *
 * @param {string}  text             - message body (may contain HTML for stat formatting)
 * @param {object}  [opts]
 * @param {string}  [opts.from]      - sender key from MSG_FROM (default 'system')
 * @param {number}  [opts.duration]  - ms before auto-fade (default 4500, ignored when dismiss is true)
 * @param {boolean} [opts.persistent] - if true, stays until dismissMessage() is called
 * @param {boolean} [opts.dismiss]   - if true, requires click to dismiss (overrides sender default)
 * @param {string}  [opts.kind]      - extra CSS class on .msg-item
 */
export function showMessage(text, { kind = '', from = 'system', duration = DEFAULT_DURATION, persistent = false, dismiss } = {}) {
  if (!enabled) return;
  const box = $('message-banner');
  if (!box) return;

  const sender = MSG_FROM[from] || MSG_FROM.system;
  const isPlayer = from === 'player';
  const needsDismiss = dismiss !== undefined ? dismiss : !!sender.dismiss;

  const el = document.createElement('div');
  el.className = `msg-item ${kind} ${sender.cls}`.trim();
  if (persistent) el.classList.add('msg-persistent');
  if (needsDismiss) el.classList.add('msg-dismissable');

  const senderLabel = isPlayer ? (game.s.playerName || 'Victor Vane') : sender.label;

  const dismissBtn = needsDismiss
    ? `<button class="msg-dismiss" aria-label="Dismiss">${ICONS.close || '✕'}</button>`
    : '';

  el.innerHTML =
    buildAvatar(from) +
    `<div class="msg-body">` +
      `<div class="msg-sender">${senderLabel}</div>` +
      `<div class="msg-content">${text}</div>` +
    `</div>` +
    dismissBtn;

  if (needsDismiss) {
    el.querySelector('.msg-dismiss').onclick = () => {
      el.classList.add('msg-fade');
      setTimeout(() => el.remove(), 350);
    };
  }

  if (persistent) {
    dismissMessage();
    persistentEl = el;
    box.prepend(el);
    return;
  }

  while (box.querySelectorAll('.msg-item:not(.msg-persistent)').length >= MAX_VISIBLE) {
    const first = box.querySelector('.msg-item:not(.msg-persistent)');
    if (first) first.remove(); else break;
  }
  box.appendChild(el);

  if (!needsDismiss) {
    setTimeout(() => {
      el.classList.add('msg-fade');
      setTimeout(() => el.remove(), 500);
    }, duration);
  }
}

/** Remove any persistent message (e.g. tutorial objective). */
export function dismissMessage() {
  if (persistentEl) {
    persistentEl.remove();
    persistentEl = null;
  }
}

// ---- stat change tracking ---------------------------------------------------

function formatDelta(key, from, to) {
  const meta = STAT_META[key];
  if (!meta) return null;
  const diff = to - from;
  if (Math.abs(diff) < 0.001) return null;

  const isGood = meta.good > 0 ? diff > 0 : diff < 0;
  const arrow = diff > 0 ? '▲' : '▼';
  const sign = diff > 0 ? '+' : '';

  let deltaText;
  if (key === 'sharpness' || key === 'autoCollect') {
    deltaText = `${sign}${(diff * 100).toFixed(0)}%`;
  } else if (key === 'heat') {
    deltaText = `${sign}${diff.toFixed(0)}%`;
  } else if (Number.isInteger(diff)) {
    deltaText = `${sign}${diff}`;
  } else {
    deltaText = `${sign}${diff.toFixed(2)}`;
  }

  return { label: meta.label, deltaText, arrow, isGood, key };
}

export function snapshotStats() {
  if (!game.stats) return;
  prevStats = { ...game.stats };
}

export function emitStatChanges() {
  if (!enabled || !prevStats || !game.stats) return;

  const allKeys = new Set([...Object.keys(prevStats), ...Object.keys(game.stats)]);
  for (const key of allKeys) {
    const from = prevStats[key];
    const to = game.stats[key];
    if (from === undefined || to === undefined) continue;
    const info = formatDelta(key, from, to);
    if (!info) continue;

    const iconKey = STAT_ICON[info.key] || 'star';
    const iconHtml = ICONS[iconKey] ? `<span class="msg-stat-icon">${ICONS[iconKey]}</span>` : '';
    const colorCls = info.isGood ? 'msg-val-good' : 'msg-val-bad';

    const html =
      `${iconHtml}` +
      `<span class="msg-stat-label">${info.label}</span> ` +
      `<span class="msg-stat-val ${colorCls}">${info.arrow} ${info.deltaText}</span>`;

    showMessage(html, { from: 'stat', duration: 3500 });
  }

  prevStats = { ...game.stats };
}
