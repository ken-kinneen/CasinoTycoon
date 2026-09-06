import * as THREE from "three";
import { game, CASINOS } from "./state.js";
import { createRenderer, createScene, createCamera } from "./engine/scene.js";
import { createPostFX } from "./engine/postfx.js";
import { Player } from "./engine/player.js";
import { CasinoWorld } from "./world/casino.js";
import { CustomerManager } from "./world/customers.js";
import { Effects } from "./world/effects.js";
import { HUD, toast, quip } from "./ui/hud.js";
import { Ledger } from "./ui/ledger.js";
import { AchievementsScreen } from "./ui/achievements.js";
import { AdvertisingGame } from "./minigames/advertising.js";
import { CashRunGame } from "./minigames/cashrun.js";
import { DealerGame } from "./minigames/dealer.js";
import { fmtMoney } from "./minigames/base.js";
import { PedestrianManager } from "./world/pedestrians.js";
import { FloorEditor } from "./world/editor.js";
import { renderPreviewSnapshot, resolveModelKey } from "./ui/model-preview.js";
import * as music from "./audio/music.js";
import * as sfx from "./audio/sfx.js";
import { DevPanel } from "./ui/devpanel.js";
import { Tutorial } from "./engine/tutorial.js";
import { setMessagesEnabled, snapshotStats, emitStatChanges, showMessage } from "./ui/messages.js";

const $ = (id) => document.getElementById(id);

// ---- boot -------------------------------------------------------------------
const canvas = $("game");
const renderer = createRenderer(canvas);
const scene = createScene(renderer);
const camera = createCamera();
const postfx = createPostFX(renderer, scene, camera);
const world = new CasinoWorld(scene);
const effects = new Effects(scene);
const customers = new CustomerManager(scene, world, game, effects);
const player = new Player(scene, camera, game);
const hud = new HUD(game, customers);
let _placingMachineType = null; // 'machine' | 'table' while placing from inventory

const ledger = new Ledger(game, (u) => {
    if (u && u.spawns) {
        ledger.hide();
        modalOpen = false;
        setOpenModal(null);
        // Keep item in inventory — open Build so the player places it themselves
        setTimeout(() => {
            game.reconcileMachineInventory();
            toggleArrangeMode(true, true);
            renderBuildInventory(u.spawns.type);
            const n = game.machineInventoryFor().filter((t) => t === u.spawns.type).length;
            const label = MACHINE_INV_NAMES[u.spawns.type] || u.spawns.type;
            toast(`${label} in Build inventory (${n}). Click it to place.`, "good", 4500);
        }, 150);
    }
});
const achScreen = new AchievementsScreen(game);
const pedMgr = new PedestrianManager(scene, world);
const editor = new FloorEditor(scene, camera, canvas, world);
player.editor = editor;
ledger.onHide = () => {
    modalOpen = false;
    setOpenModal(null);
};
ledger.onTabChange = (tab) => {
    setOpenModal(`ledger:${tab}`);
};
achScreen.onHide = () => {
    modalOpen = false;
    setOpenModal(null);
};

const PLACEABLE_NAMES = {
    planter: "Casino Planter",
    velvetrope: "Velvet Rope",
    toilet: "Gold Toilet",
    selfstatue: "Your Statue",
    namelights: "Name in Lights",
    fountain: "Champagne Fountain",
    ornateurn: "Ornate Urn",
    palmtree: "Palm Tree",
    tiger: "Pet Tiger",
    aquarium: "Exotic Aquarium",
    megaphone: "Gold Megaphone",
    fireplace: "Grand Fireplace",
    chandelier: "Crystal Chandelier",
};

const MACHINE_INV_NAMES = { machine: "Slot Machine", table: "Dealer Table" };
const MACHINE_INV_MODELS = { machine: "machines", table: "tables" };

let buildHighlight = null;
let _pendingPlaceKey = null;
let _placingFromInventory = null;

function ensureFloorLayout() {
    const cid = game.casinoDef.id;
    if (!game.s.floorLayouts) game.s.floorLayouts = {};
    if (!game.s.floorLayouts[cid]) game.s.floorLayouts[cid] = { machines: [], tables: [], props: [] };
    const L = game.s.floorLayouts[cid];
    if (!L.machines) L.machines = [];
    if (!L.tables) L.tables = [];
    if (!L.props) L.props = [];
    return L;
}

/** Pull one machine/table from inventory and enter move mode to place it. */
function beginPlaceMachine(type) {
    if (_placingMachineType || editor.moveMode) {
        toast("Finish placing the current item first.", "bad", 2500);
        return false;
    }
    if (!game.takeFromInventory(type)) {
        game.reconcileMachineInventory();
        if (!game.takeFromInventory(type)) {
            toast("Nothing to place.", "bad", 2500);
            renderBuildInventory();
            return false;
        }
    }

    const layout = ensureFloorLayout();
    // Safe center of the floor — player position was causing invalid/out-of-bounds spawns
    const entry = { x: 0, z: 0, ry: 0 };
    if (type === "machine") layout.machines.push(entry);
    else layout.tables.push(entry);

    game.recompute();
    game.save();
    rebuildWorld();

    const arr = type === "machine" ? world.machines : world.tables;
    const index = arr.length - 1;
    const item = arr[index];
    if (!item) {
        // Mesh failed to spawn — roll back so the item is not lost
        const arrL = type === "machine" ? layout.machines : layout.tables;
        if (arrL.length) arrL.pop();
        game.returnToInventory(type);
        game.recompute();
        game.save();
        rebuildWorld();
        renderBuildInventory();
        toast("Could not place that item. Try again.", "bad", 3000);
        return false;
    }

    _placingMachineType = type;
    editor.select({ type, index, obj: item.group, data: item });
    editor.enterMoveMode();
    renderBuildInventory();
    toast(`Click to place your ${MACHINE_INV_NAMES[type].toLowerCase()}. Esc cancels.`, "good", 3500);
    return true;
}

function cancelPlaceMachine() {
    if (!_placingMachineType) return;
    const type = _placingMachineType;
    _placingMachineType = null;
    const layout = ensureFloorLayout();
    const arr = type === "machine" ? layout.machines : layout.tables;
    if (arr.length) arr.pop();
    game.returnToInventory(type);
    game.recompute();
    game.save();
    rebuildWorld();
}

function renderBuildInventory(highlightKey) {
    const panel = $("build-inventory");
    const list = $("build-inv-items");
    if (!panel || !list) return;
    if (highlightKey !== undefined) buildHighlight = highlightKey;

    game.reconcileMachineInventory();
    const inv = game.machineInventoryFor();
    const achItems = game.s.achItems || [];

    // Stack identical machine/table types for clearer UI
    const stacks = [];
    const stackMap = {};
    for (const type of inv) {
        if (stackMap[type] == null) {
            stackMap[type] = stacks.length;
            stacks.push({ type, count: 0 });
        }
        stacks[stackMap[type]].count++;
    }

    const hasAnything = stacks.length > 0 || achItems.length > 0;

    if (!hasAnything) {
        list.innerHTML = '<div class="build-inv-empty">Buy machines in the Shop — they show up here to place.</div>';
    } else {
        let html = "";

        for (const stack of stacks) {
            const modelKey = MACHINE_INV_MODELS[stack.type];
            const hi = buildHighlight === stack.type || buildHighlight === `inv-${stack.type}` ? " highlighted" : "";
            const countBadge = stack.count > 1 ? `<span class="build-inv-count">×${stack.count}</span>` : "";
            html +=
                `<div class="build-inv-card${hi}" data-inv-type="${stack.type}">` +
                `<div class="build-inv-preview"><canvas class="build-pv-canvas" data-model="${modelKey}" width="128" height="128"></canvas>${countBadge}</div>` +
                `<span class="build-inv-badge build-badge-stored">CLICK TO PLACE</span>` +
                `<div class="build-inv-label"><div class="build-inv-name">${MACHINE_INV_NAMES[stack.type]}</div></div>` +
                `</div>`;
        }

        html += achItems
            .map((key) => {
                const on = game.isEquipped(key);
                const hi = buildHighlight === key ? " highlighted" : "";
                return (
                    `<div class="build-inv-card${on ? " equipped" : ""}${hi}" data-build-item="${key}">` +
                    `<div class="build-inv-preview"><canvas class="build-pv-canvas" data-model="${key}" width="128" height="128"></canvas></div>` +
                    (on
                        ? `<span class="build-inv-badge build-badge-placed">ON FLOOR</span>`
                        : `<span class="build-inv-badge build-badge-stored">CLICK TO PLACE</span>`) +
                    `<div class="build-inv-label"><div class="build-inv-name">${PLACEABLE_NAMES[key] || key}</div></div>` +
                    `</div>`
                );
            })
            .join("");

        list.innerHTML = html;

        for (const el of list.querySelectorAll("[data-inv-type]")) {
            el.onclick = (e) => {
                e.stopPropagation();
                beginPlaceMachine(el.dataset.invType);
            };
        }

        for (const el of list.querySelectorAll("[data-build-item]")) {
            const key = el.dataset.buildItem;
            if (game.isEquipped(key)) {
                el.onclick = (e) => {
                    e.stopPropagation();
                    game.unequipItem(key);
                    renderBuildInventory();
                };
            } else {
                el.onclick = (e) => {
                    e.stopPropagation();
                    _pendingPlaceKey = key;
                    game.equipItem(key);
                };
            }
        }

        const canvases = list.querySelectorAll(".build-pv-canvas");
        const angle = Math.PI * 0.15;
        for (const c of canvases) {
            const modelKey = resolveModelKey(c.dataset.model);
            renderPreviewSnapshot(modelKey, c, angle);
        }

        if (buildHighlight) {
            const target =
                list.querySelector(`[data-build-item="${buildHighlight}"]`) || list.querySelector(`[data-inv-type="${buildHighlight}"]`);
            if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
        }
    }
    panel.classList.remove("hidden");
}

function _findPropByKey(key) {
    const name = PLACEABLE_NAMES[key];
    if (!name) return null;
    for (let i = 0; i < world.props.length; i++) {
        if (world.props[i].name === name) return { type: "prop", index: i, obj: world.props[i].group, data: world.props[i] };
    }
    return null;
}

function hideBuildInventory() {
    if (_placingMachineType) cancelPlaceMachine();
    const panel = $("build-inventory");
    if (panel) panel.classList.add("hidden");
    buildHighlight = null;
    _pendingPlaceKey = null;
    _placingFromInventory = null;
}

achScreen.onOpenWardrobe = (cosmeticKey) => {
    achScreen.hide();
    modalOpen = true;
    setOpenModal("wardrobe");
    hud.toggleWardrobe(true, { highlight: cosmeticKey });
};
achScreen.onOpenBuild = (itemKey) => {
    achScreen.hide();
    modalOpen = false;
    setOpenModal(null);
    toggleArrangeMode(true);
    renderBuildInventory(itemKey);
};
hud.onWardrobeHide = () => {
    modalOpen = false;
    setOpenModal(null);
};

let started = false;
let activeGame = null;
let modalOpen = true; // intro is open

function setOpenModal(key) {
    game.s.openModal = key || null;
    game.save();
}
let nearbyPed = null;
let inspectionTimer = 90;
let quipTimer = 30;
let saveTimer = 10;
let currentZone = null;
let time = 0;

const AMBIENT_QUIPS = [
    "Look at them. Feeding the machines. Beautiful.",
    "Somebody's kid isn't going to college tonight.",
    "The house always wins. I am the house. I always win.",
    "I could add more oxygen to the vents. Or something stronger.",
    "Vegas. One day. A casino so big it has its own weather.",
    "Every clock I remove adds an hour to their stay. Science.",
    "The longer they stay, the more they leave behind.",
    "Heat's getting high. Someone official is going to want an envelope.",
    "Free drinks are the most expensive thing in this building.",
    "Is it evil if it's profitable? Asking for me.",
    "That carpet cost forty dollars. It has seen things.",
    "I don't gamble. I own gambling.",
];

const MOODS = {
    duck: { bloomStrength: 0.45, vignette: 0.6, warmth: 0.07 },
    rat: { bloomStrength: 0.55, vignette: 0.55, warmth: 0.05 },
    diablo: { bloomStrength: 0.65, vignette: 0.5, warmth: 0.09 },
};

function rebuildWorld({ keepCustomers = true } = {}) {
    const def = game.casinoDef;
    world.build(def, game);
    effects.build(world, def);
    postfx.setMood(MOODS[def.id]);
    if (game.s.lighting) applyLightSettings(game.s.lighting);
    scene.fog.density = def.id === "diablo" ? 0.012 : 0.018;
    if (!keepCustomers) customers.clearAll();
    for (const c of customers.customers) {
        c.machine = null;
        c.table = null;
        c.seat = null;
        c.group.position.y = 0;
        const u = c.group.userData;
        if (u.legL) u.legL.rotation.x = 0;
        if (u.legR) u.legR.rotation.x = 0;
        if (c.state !== "leaving") {
            c.state = "entering";
            c.path = [];
            c.stuck = 0;
        }
    }
    world.collide(player.pos, 0.4);
    pedMgr.world = world;
    pedMgr.clearAll();
    editor.setWorld(world);
    loadFloorLayout();
}

game.on("casino", () => {
    rebuildWorld({ keepCustomers: false });
    player.teleport(world.doorInside.x, world.doorInside.z - 1);
    player.rebuildModel();
    if (!started) return;
    toast(`Welcome to ${game.casinoDisplayName()}.`, "good");
    quip(game.s.casino === 2 ? "Vegas. I'm home." : "Bigger floor. Bigger everything.");
});
game.on("upgrade", (u) => {
    // Spawn upgrades stay in inventory until placed — no world rebuild needed
    if (u.spawns) {
        game.reconcileMachineInventory();
        game.save();
        return;
    }
    // Cosmetic / scene upgrades still need a rebuild
    if (!u.model) return;
    rebuildWorld();
});
game.on("skill", () => player.rebuildModel());
game.on("wardrobe", () => {
    player.rebuildModel();
    hud.drawPortrait();
});
game.on("achievement", (a) => {
    if (achScreen.open) achScreen.render();
    if (a.item) rebuildWorld();
});
game.on("equip", () => {
    rebuildWorld();
    if (_pendingPlaceKey) {
        const key = _pendingPlaceKey;
        _pendingPlaceKey = null;
        const propInfo = _findPropByKey(key);
        if (propInfo) {
            _placingFromInventory = key;
            editor.select(propInfo);
            editor.enterMoveMode();
        }
        renderBuildInventory();
    }
});
game.on("won", () => setTimeout(showWin, 1500));
let whaleToastAt = -999;
game.on("customer", ({ type }) => {
    if (type === "whale" && time - whaleToastAt > 25) {
        whaleToastAt = time;
        showMessage("A whale just walked in. Get to the table.", { from: "casino" });
    }
});

// build the world right away so it sits behind the title screen
game.reconcileMachineInventory();
rebuildWorld({ keepCustomers: false });
player.model.visible = false;

// ---- tutorial ---------------------------------------------------------------
const tutorial = new Tutorial();

// Listen for events that advance tutorial steps
game.on("upgrade", (u) => {
    if (!tutorial.isActive()) return;
    if (tutorial.stepId === "buy_table" && (u.spawns || tutorial.hasBoughtTable())) {
        tutorial.advance(); // -> place_it
        tutorial.showObjective("place_it");
        toast("Table acquired! Open Build and click it in your inventory.", "good", 4000);
    }
});

game.on("customer", () => {
    if (!tutorial.isActive()) return;
    if (tutorial.stepId === "first_guest") {
        tutorial.hideObjective();
        tutorial.advance(); // -> deal_roulette
        setTimeout(() => {
            tutorial.showCutscene("first_guest").then(() => {
                tutorial.showObjective("deal_roulette");
            });
        }, 1500);
    }
});

game.on("money", ({ amount, source }) => {
    if (!tutorial.isActive()) return;
    if (tutorial.stepId === "earn_500" && game.s.lifetimeEarned >= 500) {
        tutorial.advance(); // -> done
        tutorial.hideObjective();
        toast("Tutorial complete. The floor is yours.", "good", 5000);
        quip("Five hundred bucks. That's a start. A terrible, beautiful start.");
    }
});

tutorial.onSkip(() => {
    rebuildWorld();
});

// ---- intro / reset ------------------------------------------------------------
const hasSave = game.s.lifetimeEarned > 0 || game.s.playTime > 0;
if (hasSave) {
    $("intro").classList.add("hidden");
} else {
    document.documentElement.classList.remove("has-save");
}

async function runTutorialIntro() {
    player.teleport(world.doorInside.x, world.doorInside.z - 2);
    await tutorial.showCutscene("intro");
    tutorial.advance(); // intro -> buy_table
    tutorial.showObjective("buy_table");
}

function start() {
    player.model.visible = true;
    $("intro").classList.add("hidden");
    modalOpen = false;
    if (!started) {
        started = true;
        if (game.s.playerX !== null && game.s.playerZ !== null) {
            player.teleport(game.s.playerX, game.s.playerZ);
        } else {
            player.teleport(world.doorInside.x, world.doorInside.z - 1);
        }
        hud.show();
        editor.start();
        music.start();
        if (tutorial.shouldRun()) {
            tutorial.active = true;
            runTutorialIntro();
        } else if (!tutorial.complete && tutorial.step > 0 && tutorial.step < 9) {
            // Returning mid-tutorial — restore the objective
            tutorial.active = true;
            const sid = tutorial.stepId;
            if (sid && sid !== "intro" && sid !== "done" && sid !== "nobody") {
                tutorial.showObjective(sid);
            }
            setTimeout(() => quip("Where was I? Right. Building an empire."), 600);
        } else if (!hasSave) {
            setTimeout(() => quip("Two hundred dollars and a dream. Let's ruin some lives."), 600);
        } else {
            setTimeout(() => quip("Back to work. The machines missed me."), 600);
        }
        // Only queue initial customers if they have machines and traffic (not a fresh game)
        if (game.stats.machines + game.stats.tables > 0 && game.stats.trafficPerMin > 0) {
            setTimeout(() => customers.queue(2), 1500);
        }
        restoreOpenModal();
    }
}

function restoreOpenModal() {
    const m = game.s.openModal;
    if (!m) return;
    if (m === "settings") {
        openSettings();
    } else if (m === "help") {
        $("help").classList.remove("hidden");
        modalOpen = true;
    } else if (m === "achievements") {
        achScreen.show();
        modalOpen = true;
    } else if (m.startsWith("ledger")) {
        const tab = m.split(":")[1];
        ledger.show(tab);
        modalOpen = true;
    } else if (m === "wardrobe") {
        hud.toggleWardrobe(true);
        modalOpen = true;
    }
}

function updateDisplayNames() {
    const name = game.s.playerName;
    $("portrait-name").textContent = name.toUpperCase();
    $("stats-player-name").textContent = name.toUpperCase();
    $("intro-name").textContent = name;
    $("intro-casino").textContent = game.casinoDisplayName(0);
}
updateDisplayNames();

if (hasSave) start();
$("intro-start").onclick = start;
$("intro-reset").onclick = () => {
    if (confirm("Wipe the books and start over?")) {
        game.reset();
        window.location.reload();
    }
};
$("help-close").onclick = () => {
    $("help").classList.add("hidden");
    modalOpen = false;
    setOpenModal(null);
};
$("result-close").onclick = () => {
    $("result").classList.add("hidden");
    modalOpen = false;
    setOpenModal(null);
};
$("btn-ledger").onclick = () => toggleLedger();
$("btn-achievements").onclick = () => {
    if (!started || activeGame) return;
    if (achScreen.open) {
        achScreen.hide();
    } else if (!modalOpen) {
        achScreen.show();
        modalOpen = true;
        setOpenModal("achievements");
    }
};
$("btn-wardrobe").onclick = () => {
    if (!started || activeGame) return;
    if (hud._wardrobeOpen) {
        hud.toggleWardrobe(false);
        modalOpen = false;
        setOpenModal(null);
    } else if (!modalOpen) {
        hud.toggleWardrobe(true);
        modalOpen = true;
        setOpenModal("wardrobe");
    }
};
$("btn-help").onclick = () => {
    $("help").classList.remove("hidden");
    modalOpen = true;
    setOpenModal("help");
};

// ---- settings screen ----------------------------------------------------------
function updateSettingsUI() {
    $("settings-music-toggle").classList.toggle("muted", music.isMuted());
    $("settings-music-label").textContent = music.isMuted() ? "OFF" : "ON";
    $("settings-vol").value = Math.round(music.getVolume() * 100);
    $("settings-vol-num").textContent = `${Math.round(music.getVolume() * 100)}%`;
}
function openSettings() {
    $("settings-name").value = game.s.playerName;
    $("settings-casino-name").value = game.casinoDisplayName();
    $("settings-casino-name").placeholder = game.casinoDef.name;
    updateSettingsUI();
    $("settings").classList.remove("hidden");
    modalOpen = true;
    setOpenModal("settings");
}
function closeSettings() {
    let changed = false;
    const rawName = $("settings-name").value.trim();
    if (rawName && rawName !== game.s.playerName) {
        game.s.playerName = rawName;
        updateDisplayNames();
        changed = true;
    }
    const rawCasino = $("settings-casino-name").value.trim();
    const cid = game.casinoDef.id;
    const defaultName = game.casinoDef.name;
    const newCasinoName = rawCasino || defaultName;
    if (newCasinoName !== game.casinoDisplayName()) {
        if (newCasinoName === defaultName) delete game.s.casinoNames[cid];
        else game.s.casinoNames[cid] = newCasinoName;
        changed = true;
    }
    if (changed) {
        game.save();
        rebuildWorld();
        updateDisplayNames();
    }
    $("settings").classList.add("hidden");
    modalOpen = false;
    setOpenModal(null);
}
$("btn-settings").onclick = () => {
    if (!started || activeGame) return;
    if (!$("settings").classList.contains("hidden")) closeSettings();
    else if (!modalOpen) openSettings();
};
$("settings-close").onclick = closeSettings;
$("settings").onclick = (e) => {
    if (e.target === $("settings")) closeSettings();
};
$("settings-music-toggle").onclick = () => {
    music.toggleMute();
    updateSettingsUI();
};
$("settings-vol").oninput = () => {
    music.setVolume($("settings-vol").value / 100);
    $("settings-vol-num").textContent = `${$("settings-vol").value}%`;
};
// ---- lighting settings ----------------------------------------------------------
function applyLightSettings(ls) {
    postfx.bloom.strength = ls.bloom / 100;
    renderer.toneMappingExposure = ls.exposure / 100;
    postfx.grade.uniforms.grain.value = ls.grain / 1000;
    postfx.grade.uniforms.vignette.value = ls.vignette / 100;
}

applyLightSettings(game.s.lighting);

// ---- perf stats overlay ---------------------------------------------------------
let perfOn = !!game.s.perfStats;
const perfEl = $("perf-stats");
let perfFrames = 0,
    perfTime = 0,
    perfFPS = 0;

function updatePerfUI() {
    perfEl.classList.toggle("hidden", !perfOn);
}
updatePerfUI();
function perfTick(dt) {
    if (!perfOn) return;
    perfFrames++;
    perfTime += dt;
    if (perfTime >= 0.5) {
        perfFPS = Math.round(perfFrames / perfTime);
        perfTime = 0;
        perfFrames = 0;
        const si = postfx.sceneInfo;
        const mem = renderer.info.memory;
        const heap = performance.memory;
        perfEl.textContent =
            `FPS ${perfFPS}  |  Draw ${si.calls}  |  Tri ${(si.triangles / 1000).toFixed(1)}k  |  Tex ${mem.textures}  |  Geo ${mem.geometries}` +
            (heap ? `  |  Heap ${(heap.usedJSHeapSize / 1048576).toFixed(0)}MB` : "");
    }
}
// ---- uncap FPS toggle -----------------------------------------------------------
let uncapped = !!game.s.uncapFPS;

// ---- dev panel ------------------------------------------------------------------
const devPanel = new DevPanel({
    onCasinoChange: (idx) => {
        customers.clearAll();
        rebuildWorld({ keepCustomers: false });
        player.teleport(world.doorInside.x, world.doorInside.z - 1);
        player.rebuildModel();
        updateDisplayNames();
    },
    onMoneyChange: () => {},
    onReset: () => {
        game.reset();
        tutorial.reset();
        updateDisplayNames();
        rebuildWorld({ keepCustomers: false });
        player.rebuildModel();
        hud.drawPortrait();
        player.teleport(world.doorInside.x, world.doorInside.z - 1);
        // Full page reload so the tutorial triggers cleanly on the fresh state
        window.location.reload();
    },
    onGodModeChange: () => {},
    onPerfChange: () => {
        perfOn = !perfOn;
        game.s.perfStats = perfOn;
        game.save();
        updatePerfUI();
    },
    onUncapChange: () => {
        uncapped = !uncapped;
        game.s.uncapFPS = uncapped;
        game.save();
    },
    onLightingChange: () => applyLightSettings(game.s.lighting),
    onTutorialSkip: () => {
        tutorial.skip();
        rebuildWorld();
    },
    onTutorialReset: () => {
        tutorial.reset();
    },
    onStatMessagesChange: () => {
        game.s.showStatMessages = !game.s.showStatMessages;
        game.save();
        setMessagesEnabled(game.s.showStatMessages);
        if (game.s.showStatMessages) snapshotStats();
    },
});

// ---- unified message banner --------------------------------------------------
if (game.s.showStatMessages) setMessagesEnabled(true);
snapshotStats();
{
    const origRecompute = game.recompute.bind(game);
    game.recompute = function () {
        snapshotStats();
        origRecompute();
        emitStatChanges();
    };
}

// ---- floor editor (always-on: hover outlines, click to select) ------------------

// Panel buttons use pointerdown + stopPropagation so they never leak to the canvas.
for (const btn of $("editor-info").querySelectorAll("button")) {
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("mousedown", (e) => e.stopPropagation());
}

editor.onSelect = (info, screenPos) => {
    const panel = $("editor-info");

    // Nothing selected, or we're in move mode — hide the panel
    if (!info || info.moveMode) {
        panel.classList.add("hidden");
        if (!info || !info.moveMode) {
            $("move-tooltip").classList.add("hidden");
            _lastTooltipKey = null;
        }
        return;
    }
    $("move-tooltip").classList.add("hidden");
    _lastTooltipKey = null;

    // Show panel at click position
    panel.classList.remove("hidden");
    const pw = panel.offsetWidth || 240;
    const ph = panel.offsetHeight || 200;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let px = vw - pw - 18;
    let py = vh / 2 - ph / 2;
    if (screenPos && (screenPos.x || screenPos.y)) {
        px = screenPos.x + 16;
        py = screenPos.y - ph / 2;
        if (px + pw > vw - 12) px = screenPos.x - pw - 16;
    }
    if (py < 12) py = 12;
    if (py + ph > vh - 12) py = vh - ph - 12;
    panel.style.left = px + "px";
    panel.style.top = py + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    $("editor-info-type").textContent = info.type;
    $("editor-info-name").textContent = info.name;
    $("editor-info-stats").innerHTML = info.stats
        .map((s) => `<div class="erow"><span class="ek">${s.label}</span><span class="ev">${s.value}</span></div>`)
        .join("");

    const dealBtn = $("editor-deal");
    if (info.type === "Dealer Table") {
        dealBtn.classList.remove("hidden");
        dealBtn.disabled = !info.canInteract;
        dealBtn.title = info.canInteract ? "" : info.near ? "No players at the table" : "Walk closer to deal";
    } else {
        dealBtn.classList.add("hidden");
    }

    $("editor-info-hint").innerHTML = "<kbd>R</kbd> rotate · <kbd>Esc</kbd> close";
};
editor.onChange = () => {
    saveFloorLayout();
    world.rebuildColliders();
};

// Wrap editor.onChange to also detect tutorial place_it step
const _origEditorOnChange = editor.onChange;
editor.onChange = () => {
    _origEditorOnChange();
    game.recompute();
    // Tutorial: roulette table placed (step 2 -> nobody -> advertise)
    if (tutorial.isActive() && tutorial.stepId === "place_it" && tutorial.hasPlacedTable()) {
        if (arrangeMode) toggleArrangeMode(false);
        tutorial.advance(); // -> nobody
        tutorial.hideObjective();
        setTimeout(async () => {
            await tutorial.showCutscene("nobody");
            tutorial.advance(); // -> advertise
            tutorial.showObjective("advertise");
        }, 800);
    }
    // Tutorial: slot machine placed (step 8 -> earn_500)
    if (tutorial.isActive() && tutorial.stepId === "place_slot" && tutorial.hasPlacedSlot()) {
        if (arrangeMode) toggleArrangeMode(false);
        tutorial.advance(); // -> earn_500
        tutorial.hideObjective();
        setTimeout(async () => {
            await tutorial.showCutscene("slot_placed");
            tutorial.showObjective("earn_500");
        }, 800);
    }
};

// tooltip follows the object during move mode
const moveTooltip = $("move-tooltip");
const TOOLTIP_OK =
    '<kbd>R</kbd> <span class="sep">·</span> rotate <span class="sep">·</span> click to place <span class="sep">·</span> <kbd>Esc</kbd> <span class="sep">·</span> cancel';
let _lastTooltipKey = null;
editor.onMoveUpdate = (sx, sy, valid, reason) => {
    moveTooltip.classList.remove("hidden");
    moveTooltip.style.left = sx + "px";
    moveTooltip.style.top = sy - 16 + "px";
    moveTooltip.classList.toggle("invalid", !valid);
    const key = valid ? "ok" : reason || "blocked";
    if (key !== _lastTooltipKey) {
        if (valid) {
            moveTooltip.innerHTML = TOOLTIP_OK;
        } else {
            moveTooltip.innerHTML = `<span class="err-msg">${reason || "Can't place here"}</span> <span class="sep">·</span> <kbd>Esc</kbd> <span class="sep">·</span> cancel`;
        }
        _lastTooltipKey = key;
    }
};

$("editor-move").onclick = () => { $("editor-info").classList.add("hidden"); editor.enterMoveMode(); };
$("editor-deal").onclick = () => {
    if (!editor.selected || editor.selected.type !== "table") return;
    editor.deselect();
    // During tutorial deal_roulette step, force roulette instead of blackjack
    if (tutorial.isActive() && tutorial.stepId === "deal_roulette") startActivity("roulette");
    else startActivity("dealer");
};

// Arrange Floor button in sidebar — toggles arrange mode
let arrangeMode = false;
function toggleArrangeMode(force, silent) {
    arrangeMode = force !== undefined ? force : !arrangeMode;
    editor.arrangeMode = arrangeMode;
    $("btn-arrange").classList.toggle("active", arrangeMode);
    if (arrangeMode) {
        game.reconcileMachineInventory();
        if (!silent) toast("Click an item in your inventory to place it on the floor.", "good", 2800);
        renderBuildInventory();
    } else {
        editor.deselect();
        hideBuildInventory();
    }
}
$("btn-arrange").onclick = () => {
    if (!started || activeGame || modalOpen) return;
    toggleArrangeMode();
};
$("build-inv-close").onclick = () => toggleArrangeMode(false);
// when editor enters move mode from any path, mark arrange as active
const _origEnter = editor.enterMoveMode.bind(editor);
editor.enterMoveMode = function () {
    _origEnter();
    if (editor.moveMode) $("btn-arrange").classList.add("active");
};
// if move is cancelled on an item placed from inventory, unequip / return it
const _origCancel = editor.cancelMove.bind(editor);
editor.cancelMove = function () {
    const wasPlacing = _placingFromInventory;
    const wasMachine = _placingMachineType;
    _placingFromInventory = null;
    _placingMachineType = null;
    _origCancel();
    if (wasPlacing) game.unequipItem(wasPlacing);
    if (wasMachine) {
        const layout = ensureFloorLayout();
        const arr = wasMachine === "machine" ? layout.machines : layout.tables;
        if (arr.length) arr.pop();
        game.returnToInventory(wasMachine);
        game.recompute();
        game.save();
        rebuildWorld();
    }
    if (arrangeMode) renderBuildInventory();
};
// confirm placement of a machine from inventory
const _origConfirm = editor.confirmMove.bind(editor);
editor.confirmMove = function () {
    if (!editor.moveMode || !editor.selected || !editor._placementValid) return;
    const confirmedMachine = _placingMachineType;
    _placingFromInventory = null;
    _placingMachineType = null;
    _origConfirm(); // finishes move + fires onChange (saves layout)
    if (confirmedMachine) {
        game.recompute();
        game.save();
    }
    if (arrangeMode) renderBuildInventory();
    else {
        $("btn-arrange").classList.remove("active");
        hideBuildInventory();
    }
};
// when move ends via other paths, keep build inventory open if in arrange mode
const _origFinish = editor._finishMove.bind(editor);
editor._finishMove = function () {
    _origFinish();
};

function saveFloorLayout() {
    const cid = game.casinoDef.id;
    const layout = editor.getLayout();
    if (!game.s.floorLayouts) game.s.floorLayouts = {};
    game.s.floorLayouts[cid] = layout;
    game.save();
}
function loadFloorLayout() {
    if (!game.s.floorLayouts) return;
    const cid = game.casinoDef.id;
    const layout = game.s.floorLayouts[cid];
    if (!layout) return;
    // Apply saved positions to however many match (partial apply is fine
    // when new machines/tables were added by an upgrade)
    editor.applyLayout(layout);
    world.rebuildColliders();
}
document.querySelectorAll(".sb-action").forEach((h) => {
    if (h.id === "btn-arrange") return; // handled separately
    if (!h.dataset.key) return; // shortcut buttons have their own handlers
    h.onclick = () => {
        if (!started || modalOpen || activeGame) return;
        const k = h.dataset.key;
        if (k === "office") return toggleLedger("casino");
        if (k === "advertising") {
            jumpTo(k);
            toast("Walk up to someone on the sidewalk and press F.", "good");
            return;
        }
        jumpTo(k);
        startActivity(k);
    };
});

function jumpTo(key) {
    if (key === "advertising") {
        player.teleport(world.streetPos.x, world.streetPos.z, Math.PI);
        return;
    }
    if (key === "dealer" || key === "roulette") {
        if (world.tables.length) player.teleport(world.tables[0].pos.x, world.tables[0].pos.z + 3);
        return;
    }
    const z = world.zones.office;
    if (z) player.teleport(z.pos.x, z.pos.z);
}
function toggleLedger(tab) {
    if (ledger.open) {
        ledger.hide();
        modalOpen = false;
        setOpenModal(null);
    } else {
        ledger.show(tab);
        modalOpen = true;
        setOpenModal(`ledger:${tab || ledger.tab}`);
    }
}
function showResult(title, html, stamp = "PAID") {
    $("result-title").textContent = title;
    $("result-stamp").textContent = stamp;
    $("result-body").innerHTML = html;
    $("result").classList.remove("hidden");
    modalOpen = true;
}
function showWin() {
    showResult(
        "You made it to Vegas.",
        `
    <p>${game.casinoDisplayName(2)} is yours. A cathedral of neon, forty floors of no checkout desk, and a volcano that scares the insurance guy.</p>
    <div class="row"><span>Lifetime take</span><span class="big">${fmtMoney(game.s.lifetimeEarned)}</span></div>
    <div class="row"><span>Guests fleeced</span><b>${game.s.lifetimeCustomers}</b></div>
    <p>The dream was never the casino. The dream was the next one. There are 15 more upgrades in this building and ${game.s.playerName}'s name isn't in lights yet.</p>
    <div class="quip">"They said I'd never make it. They were right. I took it."</div>`,
        "VEGAS",
    );
}

// ---- activities ---------------------------------------------------------------
function launchAdGame(ped) {
    if (activeGame || modalOpen) return;
    const victim = { type: ped.type, difficulty: ped.difficulty, name: ped.name };
    pedMgr.remove(ped);
    player.enabled = false;
    editor.deselect();
    const finish = (fn) => (res) => {
        activeGame = null;
        player.enabled = true;
        player.keys = {};
        if (!res.aborted) fn(res);
    };
    activeGame = new AdvertisingGame(game, victim);
    activeGame.onDone = finish((res) => {
        const slipped = res.deposited > 0;
        if (slipped) customers.queue(1);
        if (slipped) {
            sfx.playRandom("triumph", "chuckle");
            showResult(
                "Card slipped",
                `<div class="row"><span>The mark</span><b>${victim.name}</b></div><div class="row"><span>Guest on their way?</span><span class="big">Yes</span></div><div class="quip">"They'll come. They always come."</div>`,
                "HOOKED",
            );
            if (tutorial.isActive() && tutorial.stepId === "advertise") {
                tutorial.advance(); // -> first_guest
                tutorial.showObjective("first_guest");
            }
        } else {
            sfx.playRandom("angry", "frustrate");
            showResult(
                "Busted",
                `<div class="row"><span>The mark</span><b>${victim.name}</b></div><div class="quip">"${["They felt that. Sloppy.", "Gone. Find someone less alert.", "Tighter grip next time."][Math.floor(Math.random() * 3)]}"</div>`,
                "BUSTED",
            );
        }
    });
    activeGame.open(`Guide the card into ${victim.name}'s pocket without touching the fabric.`);
}

function startActivity(key) {
    if (activeGame || modalOpen) return;
    if (key === "office") {
        toggleLedger("casino");
        return;
    }
    if (key === "dealer" && !customers.tablePlayers().length) {
        showMessage("Nobody at the table. Advertise, wait for a whale, or let a drunk wander over.", { from: "casino" });
        quip("An empty table. My least favourite kind.");
        return;
    }
    player.enabled = false;
    editor.deselect();
    const finish = (fn) => (res) => {
        activeGame = null;
        player.enabled = true;
        player.keys = {};
        if (!res.aborted) fn(res);
    };
    if (key === "dealer") {
        activeGame = new CashRunGame(game, customers.tablePlayers());
        activeGame.onDone = finish((res) => {
            game.save();
            const net = res.won - res.lost;
            const hadBJ = res.hands.some((h) => h.blackjack);
            if (hadBJ) sfx.play("triumph");
            else if (net > 0) sfx.playRandom("chuckle", "happy", "ching");
            else if (net < 0) sfx.playRandom("oof", "groan", "frustrate");
            else sfx.play("huff");
            showResult(
                "Blackjack",
                `<div class="row"><span>Hands dealt</span><b>${res.hands.length}</b></div><div class="row"><span>House wins</span><b>${res.hands.filter((h) => h.hit).length}</b></div><div class="row"><span>Net</span><span class="big ${net < 0 ? "neg" : ""}">${net >= 0 ? "+" : "-"}${fmtMoney(Math.abs(net))}</span></div><div class="quip">${res.hands[res.hands.length - 1].quip}</div>`,
                net >= 0 ? "HOUSE" : "OUCH",
            );
        });
        activeGame.open("Beat the dealer — get closer to 21 without busting. H to hit, S to stand.");
    } else if (key === "roulette") {
        activeGame = new DealerGame(game, customers.tablePlayers());
        activeGame.onDone = finish((res) => {
            game.save();
            const net = res.won - res.lost;
            const hadBullseye = res.hands.some((h) => h.bullseye);
            if (hadBullseye) sfx.play("triumph");
            else if (net > 0) sfx.playRandom("chuckle", "happy", "ching");
            else if (net < 0) sfx.playRandom("oof", "groan", "frustrate");
            else sfx.play("huff");
            showResult(
                "Roulette",
                `<div class="row"><span>Spins</span><b>${res.hands.length}</b></div><div class="row"><span>House wins</span><b>${res.hands.filter((h) => h.hit).length}</b></div><div class="row"><span>Net</span><span class="big ${net < 0 ? "neg" : ""}">${net >= 0 ? "+" : "-"}${fmtMoney(Math.abs(net))}</span></div><div class="quip">${res.hands[res.hands.length - 1].quip}</div>`,
                net >= 0 ? "HOUSE" : "OUCH",
            );
            // Track roulette spins for the first_spin achievement
            game.s.lifetimeRouletteSpins = (game.s.lifetimeRouletteSpins || 0) + res.hands.length;
            game.save();
            game.checkAchievements();
            // Tutorial: first roulette game done -> achievement grants slot -> place it
            if (tutorial.isActive() && tutorial.stepId === "deal_roulette") {
                tutorial.advance(); // -> place_slot
                tutorial.hideObjective();
                setTimeout(async () => {
                    $("result").classList.add("hidden");
                    modalOpen = false;
                    setOpenModal(null);
                    await tutorial.showCutscene("roulette_done");
                    tutorial.showObjective("place_slot");
                    game.reconcileMachineInventory();
                    toggleArrangeMode(true, true);
                    renderBuildInventory("machine");
                    toast("Slot machine in your inventory. Click it to place.", "good", 4500);
                }, 1500);
            }
        });
        activeGame.open("Stop the wheel near the target number. SPACE or click.");
    }
}

// ---- keys ---------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
    if (!started || activeGame) return;
    if (e.code === "KeyU") {
        if (!modalOpen || ledger.open) toggleLedger();
    } else if (e.code === "Tab") {
        e.preventDefault();
        if (hud._wardrobeOpen) {
            hud.toggleWardrobe(false);
            modalOpen = false;
            setOpenModal(null);
        } else if (!modalOpen) {
            hud.toggleWardrobe(true);
            modalOpen = true;
            setOpenModal("wardrobe");
        }
    } else if (e.code === "KeyH") {
        if (!modalOpen) {
            $("help").classList.remove("hidden");
            modalOpen = true;
            setOpenModal("help");
        } else if (!$("help").classList.contains("hidden")) {
            $("help").classList.add("hidden");
            modalOpen = false;
            setOpenModal(null);
        }
    } else if (e.code === "Escape") {
        if (devPanel.open) devPanel.setOpen(false);
        else if (editor.selected) {
            /* editor handles its own Escape */
        } else if (arrangeMode) toggleArrangeMode(false);
        else if (achScreen.open) achScreen.hide();
        else if (ledger.open) toggleLedger();
        else if (hud._wardrobeOpen) {
            hud.toggleWardrobe(false);
            modalOpen = false;
            setOpenModal(null);
        } else if (!$("settings").classList.contains("hidden")) closeSettings();
        else if (!$("result").classList.contains("hidden")) $("result-close").click();
        else if (!$("help").classList.contains("hidden")) $("help-close").click();
    } else if (e.code === "KeyM") {
        music.toggleMute();
        updateSettingsUI();
    } else if (e.code === "KeyJ") {
        if (achScreen.open) {
            achScreen.hide();
            modalOpen = false;
            setOpenModal(null);
        } else if (!modalOpen) {
            achScreen.show();
            modalOpen = true;
            setOpenModal("achievements");
        }
    } else if (e.code === "KeyN") {
        if (!$("settings").classList.contains("hidden")) closeSettings();
        else if (!modalOpen) openSettings();
    } else if (e.code === "KeyF") {
        if (modalOpen) return;
        if (nearbyPed) {
            launchAdGame(nearbyPed);
        } else if (currentZone) startActivity(currentZone.key);
    } else if (!modalOpen && e.code === "Digit1") jumpTo("advertising");
    else if (!modalOpen && e.code === "Digit2") jumpTo("dealer");
    else if (!modalOpen && e.code === "Digit3") jumpTo("roulette");
    else if (!modalOpen && e.code === "KeyG") toggleArrangeMode();
});

// ---- main loop ------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
    if (uncapped) setTimeout(frame, 0);
    else requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    time += dt;
    window.__activeGame = activeGame;
    if (started) pedMgr.update(dt, player.pos);
    if (started && !activeGame && !modalOpen) {
        player.enabled = true;
        nearbyPed = pedMgr.highlighted;
        if (nearbyPed) {
            const tier = nearbyPed.difficulty.charAt(0).toUpperCase() + nearbyPed.difficulty.slice(1);
            hud.setPrompt(`Slip a card to ${nearbyPed.name} (${tier})`, "advertising");
        } else {
            currentZone = null;
            let best = Infinity;
            for (const z of Object.values(world.zones)) {
                const d = player.pos.distanceTo(z.pos);
                if (d < z.r && d < best) {
                    best = d;
                    currentZone = z;
                }
            }
            hud.setPrompt(
                currentZone ? currentZone.label : null,
                currentZone ? (currentZone.key === "office" ? "office" : currentZone.key) : null,
            );
        }
    } else if (started) {
        player.enabled = false;
        nearbyPed = null;
    }
    if (started) {
        game.s.playTime += dt;
        customers.update(dt);
        const st = game.stats;
        inspectionTimer -= dt;
        if (inspectionTimer <= 0) {
            inspectionTimer = 90 + Math.random() * 60;
            if (Math.random() < (st.heat / 100) * 0.6) {
                const bribe = Math.round(Math.min(game.s.money, Math.max(50, game.s.money * (0.02 + (st.heat / 100) * 0.06))));
                game.spend(bribe);
                showMessage(`The envelope cost ${fmtMoney(bribe)}. Heat is at ${Math.round(st.heat)}%.`, {
                    from: "inspect",
                    duration: 6000,
                });
                effects.float(player.pos.x, 2.4, player.pos.z, `-${fmtMoney(bribe)}`, "#ff3b3b", 1.4);
                quip(
                    [
                        "Cost of doing business. Business is crime.",
                        "He took the envelope and a buffet voucher. Classy.",
                        "I should buy someone higher up.",
                    ][Math.floor(Math.random() * 3)],
                );
            }
        }
        quipTimer -= dt;
        if (quipTimer <= 0) {
            quipTimer = 40 + Math.random() * 30;
            quip(AMBIENT_QUIPS[Math.floor(Math.random() * AMBIENT_QUIPS.length)]);
        }
        saveTimer -= dt;
        if (saveTimer <= 0) {
            saveTimer = 10;
            game.s.playerX = player.pos.x;
            game.s.playerZ = player.pos.z;
            game.save();
        }
    }
    if (started) {
        player.update(dt, world);
        hud.update(dt);
    } else {
        camera.position.set(Math.sin(time * 0.08) * 16, 5.5, world.D / 2 + 15);
        camera.lookAt(0, 3, world.D / 2 - 4);
    }
    world.update(dt, time);
    effects.update(dt);
    editor.playerPos.copy(player.pos);
    editor.update(dt, time);
    if (!activeGame) postfx.render(dt);
    perfTick(dt);
}
frame();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    postfx.resize(window.innerWidth, window.innerHeight);
});
window.addEventListener("beforeunload", () => {
    if (started) {
        game.s.playerX = player.pos.x;
        game.s.playerZ = player.pos.z;
    }
    game.save();
});

window.__casino = {
    game,
    world,
    customers,
    player,
    effects,
    pedMgr,
    editor,
    devPanel,
    tutorial,
    rebuildWorld,
    step: (secs) => {
        for (let t = 0; t < secs; t += 0.05) customers.update(0.05);
    },
};
