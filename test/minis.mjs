// Screenshots each minigame in its actual play phase, so the canvas art can be reviewed.
import { chromium } from 'playwright';
import fs from 'node:fs';
const OUT = process.env.OUT || '/tmp/minis';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForTimeout(2500);
await page.click('#intro-start');
await page.waitForTimeout(2000);
await page.evaluate(() => { const { customers } = window.__casino; customers.queue(8); window.__casino.step(45); });

const box = async () => page.locator('#minigame-canvas').boundingBox();
const waitGame = async (key, digit, before) => {
  for (let i = 0; i < 60; i++) {
    const ok = await page.evaluate(k => !!window.__activeGame && k in window.__activeGame, key);
    if (ok) { await page.waitForTimeout(120); return true; }
    if (before) await before();
    if (i % 6 === 5) await page.keyboard.press(digit);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(180);
  }
  return false;
};

const closeResult = async () => {
  for (let i = 0; i < 40; i++) {
    const open = await page.evaluate(() => !document.getElementById('result').classList.contains('hidden'));
    if (open) { await page.click('#result-close'); await page.waitForTimeout(400); return true; }
    await page.waitForTimeout(150);
  }
  return false;
};

// ---- ADVERTISING ----
await page.keyboard.press('Digit1'); await page.waitForTimeout(400);
await page.keyboard.press('KeyE');
console.log('ad open:', await waitGame('path', 'Digit1'));
const b = await box(); const toPage = (x, y) => [b.x + x * b.width / 960, b.y + y * b.height / 600];
{
  const path = await page.evaluate(() => window.__activeGame.path);
  const [sx, sy] = toPage(path[0].x, path[0].y);
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.up();
  for (let i = 0; i < path.length * 0.55; i += 2) { const [px, py] = toPage(path[i].x, path[i].y); await page.mouse.move(px, py); await page.waitForTimeout(14); }
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/ad-play.png` });
  // finish the run for the success state
  for (let i = Math.floor(path.length * 0.55); i < path.length; i += 2) { const [px, py] = toPage(path[i].x, path[i].y); await page.mouse.move(px, py); await page.waitForTimeout(14); }
  const [ex, ey] = toPage(path[path.length - 1].x, path[path.length - 1].y);
  await page.mouse.move(ex, ey); await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/ad-success.png` });
  console.log('ad planted:', await page.evaluate(() => window.__activeGame && window.__activeGame.hits));
  await page.evaluate(() => window.__activeGame && (window.__activeGame.timeLeft = 0.01));
  await closeResult();
}

// ---- BLACKJACK (was cash run) ----
{
  const seatForBJ = async () => page.evaluate(() => {
    const { customers, world } = window.__casino;
    const t = world.tables[0];
    if (!t) return 'no tables';
    if (customers.customers.length < 1) customers.queue(1);
    const c = customers.customers[0];
    if (c) {
      if (c.machine) { c.machine.occupant = null; c.machine = null; }
      if (!t.occupants.includes(c)) t.occupants.push(c);
      c.table = t; c.seat = t.seats[0]; c.state = 'using'; c.useTimer = 600; c.path = [];
      c.group.position.set(c.seat.x, c.group.position.y, c.seat.z);
    }
    return customers.tablePlayers().length;
  });
  await seatForBJ();
  await page.keyboard.press('Digit2'); await page.waitForTimeout(400);
  await page.keyboard.press('KeyE');
  console.log('blackjack open:', await waitGame('phase', 'Digit2', seatForBJ));
  // play: stand on every hand to finish quickly
  for (let i = 0; i < 30; i++) {
    const st = await page.evaluate(() => window.__activeGame ? { phase: window.__activeGame.phase } : null);
    if (!st) break;
    if (st.phase === 'player') { await page.keyboard.press('KeyS'); await page.waitForTimeout(300); }
    else { await page.waitForTimeout(200); }
    const done = await page.evaluate(() => !document.getElementById('result').classList.contains('hidden'));
    if (done) break;
  }
  await page.screenshot({ path: `${OUT}/blackjack-result.png` });
  console.log('blackjack summary:', await page.locator('#result-body').innerText().catch(() => 'n/a'));
  await closeResult();
}

// ---- ROULETTE (was dealer) ----
const seatThem = async () => page.evaluate(() => {
  const { customers, world } = window.__casino;
  const t = world.tables[0];
  if (!t) return 'no tables';
  if (customers.customers.length < 3) customers.queue(3);
  let seated = 0;
  for (const c of customers.customers.slice(0, 3)) {
    if (c.machine) { c.machine.occupant = null; c.machine = null; }
    if (c.table && c.table !== t) c.table.occupants = c.table.occupants.filter(o => o !== c);
    if (!t.occupants.includes(c)) t.occupants.push(c);
    c.table = t; c.seat = t.seats[Math.min(seated, t.seats.length - 1)];
    c.state = 'using'; c.useTimer = 600; c.path = []; c.stuck = 0;
    c.group.position.set(c.seat.x, c.group.position.y, c.seat.z);
    seated++;
  }
  return customers.tablePlayers().length;
});
console.log('seated:', await seatThem());
await page.keyboard.press('Digit3'); await page.waitForTimeout(400);
await page.keyboard.press('KeyE');
const dealerOpen = await waitGame('phase', 'Digit3', seatThem);
console.log('dealer open:', dealerOpen, 'players:', await page.evaluate(() => window.__casino.customers.tablePlayers().length));
{
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/roulette-intro.png` });
  for (let i = 0; i < 100; i++) { if (await page.evaluate(() => window.__activeGame && window.__activeGame.phase === 'play')) break; await page.waitForTimeout(100); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/roulette-play.png` });
  // land it inside the margin
  for (let i = 0; i < 600; i++) {
    const st = await page.evaluate(() => { const g = window.__activeGame; return g && g.phase === 'play' ? { n: g.number, t: g.current.target, m: g.current.margin } : null; });
    if (!st) break;
    if (Math.abs(st.n - st.t) < st.m * 0.4) { await page.keyboard.press('Space'); break; }
    await page.waitForTimeout(8);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/roulette-result.png` });
  for (let i = 0; i < 80; i++) { if (await page.evaluate(() => !document.getElementById('result').classList.contains('hidden'))) break; await page.evaluate(() => { const g = window.__activeGame; if (g && g.phase === 'play') g.countdown = 0.02; }); await page.waitForTimeout(300); }
  await page.screenshot({ path: `${OUT}/roulette-summary.png` });
  console.log('roulette summary:', await page.locator('#result-body').innerText().catch(() => 'n/a'));
  await closeResult();
}
console.log('errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
