// Headless smoke test: loads the built game, starts it, plays each activity via
// the exposed __casino handle, buys upgrades, and screenshots along the way.
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.env.OUT || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });

await page.goto(process.env.URL || 'http://localhost:4173/');
const frames = async (n=2) => page.evaluate(n => new Promise(r => { let i=0; const f=()=>{ if(++i>=n) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), n);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-intro.png` });
await page.click('#intro-start');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/02-floor.png` });

const info = await page.evaluate(() => {
  const { game, world, customers } = window.__casino;
  return { money: game.s.money, stats: game.stats, machines: world.machines.length, tables: world.tables.length, customers: customers.count, zones: Object.keys(world.zones), colliders: world.colliders.length };
});
console.log('after start:', JSON.stringify(info, null, 1));

// walk forward a bit with W, then screenshot
await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
await page.keyboard.down('KeyA'); await page.waitForTimeout(500); await page.keyboard.up('KeyA');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-walk.png` });

// spawn a bunch of customers and give the hoppers cash
await page.evaluate(() => { const { customers } = window.__casino; customers.queue(6); });
await page.evaluate(() => window.__casino.step(40)); await frames(2);
await page.screenshot({ path: `${OUT}/04-customers.png` });
const c2 = await page.evaluate(() => { const { customers, game } = window.__casino; return { count: customers.count, states: customers.customers.map(c => c.state + ':' + c.type), hopper: game.s.machineCash }; });
console.log('customers:', JSON.stringify(c2));

// go to the street and start advertising
await page.keyboard.press('Digit1'); await frames(3);
await page.keyboard.press('KeyE'); await frames(3);
await page.screenshot({ path: `${OUT}/05-advertising.png` });
const adOpen = await page.evaluate(() => !document.getElementById('minigame').classList.contains('hidden'));
console.log('advertising open:', adOpen);
// simulate playing: follow the path with the mouse
await page.evaluate(async () => {
  const g = window.__casino; // no direct handle to the active game, drive via DOM events
});
const canvasBox = await page.locator('#minigame-canvas').boundingBox();
const toPage = (x, y) => [canvasBox.x + x * canvasBox.width / 960, canvasBox.y + y * canvasBox.height / 600];
for (let round = 0; round < 3; round++) {
  const path = await page.evaluate(() => window.__activeGame ? window.__activeGame.path : null);
  if (!path) break;
  const [sx, sy] = toPage(path[0].x, path[0].y);
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.up();
  for (let i = 0; i < path.length; i += 2) { const [px, py] = toPage(path[i].x, path[i].y); await page.mouse.move(px, py); await page.waitForTimeout(12); }
  const [ex, ey] = toPage(path[path.length - 1].x, path[path.length - 1].y);
  await page.mouse.move(ex, ey); await page.waitForTimeout(150);
}
await page.screenshot({ path: `${OUT}/06-advertising-play.png` });
await page.evaluate(() => window.__activeGame && (window.__activeGame.timeLeft = 0.01));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/07-ad-result.png` });
console.log('ad result text:', await page.locator('#result-body').innerText().catch(() => 'n/a'));
await page.click('#result-close');

// cash run
await page.evaluate(() => { const { world, game } = window.__casino; for (const m of world.machines) m.cash = 120; game.s.machineCash = world.machines.length * 120; });
await page.keyboard.press('Digit2'); await frames(3);
await page.keyboard.press('KeyE'); await frames(3);
await page.screenshot({ path: `${OUT}/08-cashrun.png` });
{
  const stacks = await page.evaluate(() => window.__activeGame ? window.__activeGame.stacks.map(s => ({ x: s.x, y: s.y })) : []);
  const safe = await page.evaluate(() => window.__activeGame.safe);
  for (const s of stacks.slice(0, 4)) {
    await page.evaluate(() => { window.__activeGame.doorT = 0; });
    const [sx, sy] = toPage(s.x, s.y); const [tx, ty] = toPage(safe.x + safe.w / 2, safe.y + safe.h / 2);
    await page.mouse.move(sx, sy); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(sx + (tx - sx) * i / 10, sy + (ty - sy) * i / 10); await page.waitForTimeout(25); }
    await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(60);
  }
  await page.screenshot({ path: `${OUT}/09-cashrun-play.png` });
  await page.evaluate(() => window.__activeGame && (window.__activeGame.timeLeft = 0.01));
  await page.waitForTimeout(600);
  console.log('cash result:', await page.locator('#result-body').innerText().catch(() => 'n/a'));
  await page.click('#result-close');
}

// dealer: force a customer to a table
await page.evaluate(() => { const { customers, world } = window.__casino; const c = customers.customers[0]; if (c) { if (c.machine) { c.machine.occupant = null; c.machine = null; } c.table = world.tables[0]; world.tables[0].occupants.push(c); c.state = 'using'; c.useTimer = 200; c.path = []; } });
await page.keyboard.press('Digit3'); await frames(3);
await page.keyboard.press('KeyE'); await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/10-dealer.png` });
{
  // wait until the number is near the target and lock
  for (let i = 0; i < 400; i++) {
    const st = await page.evaluate(() => window.__activeGame ? { phase: window.__activeGame.phase, n: window.__activeGame.number, t: window.__activeGame.current.target } : null);
    if (!st) break;
    if (st.phase === 'play' && Math.abs(st.n - st.t) < 2) { await page.keyboard.press('Space'); break; }
    await page.waitForTimeout(10);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/11-dealer-result.png` });
  // let the remaining hands time out
  for (let i = 0; i < 60; i++) { const open = await page.evaluate(() => !document.getElementById('result').classList.contains('hidden')); if (open) break; await page.evaluate(() => { const g = window.__activeGame; if (g && g.phase === 'play') g.countdown = 0.01; }); await page.waitForTimeout(500); }
  console.log('dealer result:', await page.locator('#result-body').innerText().catch(() => 'n/a'));
  await page.click('#result-close').catch(() => {});
}

// ledger + purchases
await page.evaluate(() => { window.__casino.game.s.money = 20000; });
await page.keyboard.press('KeyU'); await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/12-ledger.png` });
const buyResults = await page.evaluate(() => {
  const { game } = window.__casino;
  const before = { ...game.stats };
  const r = [game.buyCasinoUpgrade('d_slots1'), game.buyCasinoUpgrade('d_neon'), game.buyCasinoUpgrade('d_gas'), game.buyCasinoUpgrade('d_windows'), game.buyAd('ad_bus'), game.buySkill('poker'), game.buySkill('poker'), game.buySkill('tongue'), game.buyAward('aw_toilet')];
  // Floor-driven: place inventory machines so they count
  const cid = game.casinoDef.id;
  if (!game.s.floorLayouts[cid]) game.s.floorLayouts[cid] = { machines: [], tables: [], props: [] };
  const inv = game.machineInventoryFor();
  let i = 0;
  while (inv.length) {
    const type = inv.shift();
    const entry = { x: (i % 3) * 1.5 - 1.5, z: Math.floor(i / 3) * 1.5, ry: 0 };
    if (type === 'machine') game.s.floorLayouts[cid].machines.push(entry);
    else game.s.floorLayouts[cid].tables.push(entry);
    i++;
  }
  game.recompute();
  // Trigger world rebuild so meshes match the new layout
  window.dispatchEvent(new CustomEvent('casino-rebuild'));
  return { r, before: { machines: before.machines, stay: before.stayTime, heat: before.heat }, after: { machines: game.stats.machines, stay: game.stats.stayTime, heat: game.stats.heat }, money: game.s.money };
});
console.log('purchases:', JSON.stringify(buyResults));
await page.evaluate(() => { if (window.__casino.rebuildWorld) window.__casino.rebuildWorld(); });
await page.keyboard.press('KeyU'); await frames(3);
await page.keyboard.press('KeyU'); await frames(3);
await page.click('[data-tab="skills"]'); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/13-skills.png` });
await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
await page.evaluate(() => { const { player, world } = window.__casino; player.camDist = 9; player.camPitch = 0.7; player.teleport(0, world.D / 2 - 4); });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/14-upgraded-floor.png` });
await page.keyboard.press('Tab'); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/15-stats.png` });

// buy casino 2 and 3
const cas = await page.evaluate(() => { const { game } = window.__casino; game.s.money = 1e6; return [game.buyCasino(1)]; });
await page.waitForTimeout(2500);
await page.evaluate(() => { const { customers, player, world } = window.__casino; customers.queue(15); player.camDist = 12; player.camPitch = 0.8; player.teleport(0, world.D / 2 - 8); window.__casino.step(40); });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/16-casino2.png` });
await page.evaluate(() => { const { game } = window.__casino; game.s.money = 5e6; game.buyCasino(2); });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/17-vegas-win.png` });
await page.click('#result-close').catch(() => {});
await page.evaluate(() => { const { game, customers, player, world, rebuildWorld } = window.__casino; for (const u of ['p_slots1', 'p_sky', 'p_volcano', 'p_tower', 'p_tables']) game.buyCasinoUpgrade(u); const cid = game.casinoDef.id; if (!game.s.floorLayouts[cid]) game.s.floorLayouts[cid] = { machines: [], tables: [], props: [] }; const inv = game.machineInventoryFor(); let i = 0; while (inv.length) { const type = inv.shift(); const entry = { x: (i % 4) * 1.5 - 2, z: Math.floor(i / 4) * 1.5 - 2, ry: 0 }; if (type === 'machine') game.s.floorLayouts[cid].machines.push(entry); else game.s.floorLayouts[cid].tables.push(entry); i++; } game.recompute(); rebuildWorld(); for (const a of ['aw_tiger', 'aw_fountain', 'aw_statue', 'aw_lights']) game.buyAward(a); customers.queue(30); });
await page.waitForTimeout(1000);
await page.evaluate(() => { const { player, world } = window.__casino; player.camDist = 13; player.camPitch = 0.8; player.teleport(0, world.D / 2 - 12); });
await page.evaluate(() => window.__casino.step(60)); await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/18-vegas-floor.png` });
await page.evaluate(() => { const { player, world } = window.__casino; player.camYaw = 0; player.camDist = 14; player.camPitch = 0.35; player.teleport(6, world.D / 2 + 7); });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/19-vegas-outside.png` });

const perf = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) res(n / 2); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
console.log('approx fps (swiftshader):', perf);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
