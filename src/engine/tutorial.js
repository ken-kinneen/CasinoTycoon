// Tutorial state machine. Each step has a condition to advance, UI prompts,
// and optional cutscenes. Lives in game.s.tutorial* (persisted in save).
//
// Steps:
//  0  intro         — Victor on the floor of an empty casino
//  1  buy_table     — buy a roulette table (only option available)
//  2  place_it      — place the roulette table on the floor
//  3  nobody        — cutscene: nobody's coming
//  4  advertise     — slip a card on the sidewalk
//  5  first_guest   — the mark arrives
//  6  deal_roulette — deal on the roulette table, stay until you win
//  7  buy_slot      — earned enough to buy a slot machine
//  8  place_slot    — place the slot machine on the floor
//  9  earn_500      — earn $500 lifetime to hit the milestone
// 10  done          — tutorial complete, free play

import { game } from '../state.js';
import { showMessage, dismissMessage, isMessagesEnabled } from '../ui/messages.js';

export const TUTORIAL_STEPS = [
  { id: 'intro',         index: 0 },
  { id: 'buy_table',     index: 1 },
  { id: 'place_it',      index: 2 },
  { id: 'nobody',        index: 3 },
  { id: 'advertise',     index: 4 },
  { id: 'first_guest',   index: 5 },
  { id: 'deal_roulette', index: 6 },
  { id: 'buy_slot',      index: 7 },
  { id: 'place_slot',    index: 8 },
  { id: 'earn_500',      index: 9 },
  { id: 'done',          index: 10 },
];

export const TUTORIAL_PROMPTS = {
  buy_table:     { text: 'Open the Shop and buy a roulette table.', hint: 'Press U or click Shop in the sidebar.' },
  place_it:      { text: 'Place the roulette table on the casino floor.', hint: 'Open Build (G), then click it in your inventory.' },
  nobody:        null,
  advertise:     { text: 'Go outside and slip someone a card.', hint: 'Press 1 or walk to the sidewalk and press F.' },
  first_guest:   { text: 'Your mark is on the way. Wait for them.', hint: 'They should arrive any moment now.' },
  deal_roulette: { text: 'Get to the roulette table and deal.', hint: 'Click the table, then press Deal in the popup.' },
  buy_slot:      { text: 'Time for passive income. Buy a slot machine.', hint: 'Press U to open the Shop.' },
  place_slot:    { text: 'Place the slot machine on the floor.', hint: 'Open Build (G), then click it in your inventory.' },
  earn_500:      { text: 'Keep hustling. Earn $500 to prove yourself.', hint: 'Slots earn passively. Deal roulette. Slip more cards.' },
};

export const TUTORIAL_CUTSCENE_TEXT = {
  intro: [
    '*Victor is sitting on the bare floor of an empty casino.*',
    '"Two hundred bucks. No machines. No customers. Not even a chair."',
    '"...Guess I better get to work."',
  ],
  nobody: [
    '*The table sits ready. The casino is dead silent.*',
    '"Got the table. Got the floor. Got... nobody."',
    '"I need to get people in here. Time to hit the sidewalk."',
  ],
  first_guest: [
    '"There they are. Walking right through the door."',
    '"One sucker at a time. That\'s how empires start."',
  ],
  roulette_win: [
    '"That\'s how it\'s done. The wheel does what I tell it."',
    '"Now I need something that makes money while I sleep. A slot machine."',
  ],
  slot_placed: [
    '"Passive income. Beautiful. Now I\'ve got a table AND a machine."',
    '"Time to build this dump into something real."',
  ],
};

export class Tutorial {
  constructor() {
    this._overlay = null;
    this._objectiveEl = null;
    this._cutsceneResolve = null;
    this._skipCb = null;
    this.active = false;
    this._createUI();
  }

  get step() { return game.s.tutorialStep || 0; }
  set step(v) { game.s.tutorialStep = v; game.save(); }

  get complete() { return !!game.s.tutorialComplete; }
  set complete(v) { game.s.tutorialComplete = v; game.save(); }

  get stepId() { return TUTORIAL_STEPS[this.step]?.id || 'done'; }

  isActive() { return this.active && !this.complete; }

  /** New save with zero progress — tutorial should run. */
  shouldRun() {
    return !this.complete && game.s.lifetimeEarned === 0 && game.s.playTime < 5;
  }

  skip() {
    this.complete = true;
    this.active = false;
    this.hideObjective();
    this.hideCutscene();
    if (this._skipCb) this._skipCb();
  }

  reset() {
    this.step = 0;
    this.complete = false;
    this.active = false;
    this.hideObjective();
    this.hideCutscene();
  }

  advance() {
    if (this.complete) return;
    this.step = Math.min(this.step + 1, TUTORIAL_STEPS.length - 1);
    if (this.stepId === 'done') {
      this.complete = true;
      this.active = false;
      this.hideObjective();
    }
  }

  /** Check if the player has bought any machine/table (inventory or placed). */
  hasBoughtMachine() {
    return game.machineInventoryFor().length > 0
      || this.hasPlacedMachine()
      || game.ownedSpawnCount('machine') + game.ownedSpawnCount('table') > 0;
  }

  /** Check if any machine/table is physically on the floor. */
  hasPlacedMachine() {
    return game.placedCount('machine') + game.placedCount('table') >= 1;
  }

  hasBoughtTable() {
    return game.machineInventoryFor().includes('table')
      || game.placedCount('table') >= 1
      || game.ownedSpawnCount('table') > 0;
  }

  hasPlacedTable() { return game.placedCount('table') >= 1; }

  hasBoughtSlot() {
    return game.machineInventoryFor().includes('machine')
      || game.placedCount('machine') >= 1
      || game.ownedSpawnCount('machine') > 0;
  }

  hasPlacedSlot() { return game.placedCount('machine') >= 1; }

  // ---- UI: objective banner at top of screen ----

  _createUI() {
    this._objectiveEl = document.createElement('div');
    this._objectiveEl.id = 'tutorial-objective';
    this._objectiveEl.className = 'tutorial-objective hidden';
    this._objectiveEl.innerHTML = '<div class="tut-obj-text"></div><div class="tut-obj-hint"></div>';
    document.body.appendChild(this._objectiveEl);

    this._overlay = document.createElement('div');
    this._overlay.id = 'tutorial-cutscene';
    this._overlay.className = 'tutorial-cutscene hidden';
    this._overlay.innerHTML = '<div class="tut-cs-box"><div class="tut-cs-lines"></div><button class="tut-cs-btn">Continue</button></div>';
    document.body.appendChild(this._overlay);

    this._overlay.querySelector('.tut-cs-btn').onclick = () => {
      if (this._cutsceneResolve) this._cutsceneResolve();
    };
  }

  showObjective(stepId) {
    const prompt = TUTORIAL_PROMPTS[stepId];
    if (!prompt) { this.hideObjective(); return; }
    if (isMessagesEnabled()) {
      showMessage(`${prompt.text}<div class="msg-hint">${prompt.hint}</div>`, { from: 'tutorial', persistent: true });
      this._objectiveEl.classList.add('hidden');
      return;
    }
    this._objectiveEl.querySelector('.tut-obj-text').textContent = prompt.text;
    this._objectiveEl.querySelector('.tut-obj-hint').textContent = prompt.hint;
    this._objectiveEl.classList.remove('hidden');
  }

  hideObjective() {
    if (this._objectiveEl) this._objectiveEl.classList.add('hidden');
    dismissMessage();
  }

  showCutscene(key) {
    const lines = TUTORIAL_CUTSCENE_TEXT[key];
    if (!lines) return Promise.resolve();

    return new Promise(resolve => {
      this._cutsceneResolve = () => {
        this._cutsceneResolve = null;
        this.hideCutscene();
        resolve();
      };
      const box = this._overlay.querySelector('.tut-cs-lines');
      box.innerHTML = lines.map(l => {
        const isAction = l.startsWith('*') && l.endsWith('*');
        const text = isAction ? l.slice(1, -1) : l;
        return `<div class="tut-cs-line ${isAction ? 'action' : 'speech'}">${text}</div>`;
      }).join('');
      this._overlay.classList.remove('hidden');
    });
  }

  hideCutscene() {
    if (this._overlay) this._overlay.classList.add('hidden');
    if (this._cutsceneResolve) {
      this._cutsceneResolve();
      this._cutsceneResolve = null;
    }
  }

  onSkip(fn) { this._skipCb = fn; }
}
