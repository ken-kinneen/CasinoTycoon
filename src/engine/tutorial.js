// Tutorial state machine. Each step has a condition to advance, UI prompts,
// and optional cutscenes. Lives in game.s.tutorial* (persisted in save).
//
// Steps:
//  0  intro       — Victor sits on the floor of an empty casino, gets up
//  1  buy_machine — open the shop, buy a starter slot or roulette table
//  2  place_it    — go to build mode, drag the machine onto the floor
//  3  nobody      — short cutscene: "…nobody's coming"
//  4  advertise   — walk to the sidewalk and slip a card
//  5  first_guest — the mark shows up, your first customer
//  6  earn_500    — earn $500 to hit the first milestone
//  7  done        — tutorial complete, free play

import { game } from '../state.js';

export const TUTORIAL_STEPS = [
  { id: 'intro',       index: 0 },
  { id: 'buy_machine', index: 1 },
  { id: 'place_it',    index: 2 },
  { id: 'nobody',      index: 3 },
  { id: 'advertise',   index: 4 },
  { id: 'first_guest', index: 5 },
  { id: 'earn_500',    index: 6 },
  { id: 'done',        index: 7 },
];

export const TUTORIAL_PROMPTS = {
  buy_machine: { text: 'Open the Shop and buy your first machine.', hint: 'Press U or click Shop in the sidebar.' },
  place_it:    { text: 'Place your machine on the casino floor.', hint: 'Open Build (G), then click the item in your inventory.' },
  nobody:      null,
  advertise:   { text: 'Go outside and slip someone a card.', hint: 'Press 1 or walk to the sidewalk and press F.' },
  first_guest: { text: 'Your mark is on the way. Wait for them.', hint: 'They should arrive any moment now.' },
  earn_500:    { text: 'Keep hustling. Earn $500 to prove yourself.', hint: 'Advertise, bank hoppers, deal hands — whatever it takes.' },
};

export const TUTORIAL_CUTSCENE_TEXT = {
  intro: [
    '*Victor is sitting on the bare floor of an empty casino.*',
    '"Two hundred bucks. No machines. No customers. Not even a chair."',
    '"...Guess I better get to work."',
  ],
  nobody: [
    '*The machine hums. The casino is dead silent.*',
    '"Got the machine. Got the floor. Got... nobody."',
    '"I need to get people in here. Time to hit the sidewalk."',
  ],
  first_guest: [
    '"There they are. Walking right through the door."',
    '"One sucker at a time. That\'s how empires start."',
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

  /** @deprecated use hasBoughtMachine / hasPlacedMachine */
  hasAnyMachine() {
    return this.hasBoughtMachine();
  }

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
    this._objectiveEl.querySelector('.tut-obj-text').textContent = prompt.text;
    this._objectiveEl.querySelector('.tut-obj-hint').textContent = prompt.hint;
    this._objectiveEl.classList.remove('hidden');
  }

  hideObjective() {
    if (this._objectiveEl) this._objectiveEl.classList.add('hidden');
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
