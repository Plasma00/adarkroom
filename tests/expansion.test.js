import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from './helpers/game.js';

test('legend discovery follows fog and retains cleared types only in committed expeditions', () => {
  const g = game(), w = g.World;
  w.init(); w.state = g.json(g.State.game.world); w.curPos = [0, 0]; w.usedOutposts = {};
  const initialMask = g.json(w.state.mask);
  w.drawMap();
  assert.deepEqual(g.json(w.state.mask), initialMask);
  for(const tile of ['K', 'E', 'D', 'R', 'T']) assert.equal(w.state.discoveredSymbols[tile], undefined);
  const pos = w.mapSearch('K', w.state.map, 1)[0];
  w.setMask(w.state.mask, pos.x, pos.y, true); w.drawMap();
  assert.equal(w.state.discoveredSymbols.K, true);
  assert.equal(g.State.game.world.discoveredSymbols, undefined);
  // Discarding an expedition also discards its newly revealed legend entries.
  w.state = g.json(g.State.game.world); w.drawMap();
  assert.equal(w.state.discoveredSymbols.K, undefined);
  w.curPos = [pos.x, pos.y]; w.setMask(w.state.mask, pos.x, pos.y, true); w.drawMap();
  w.clearDungeon();
  assert.equal(w.state.discoveredSymbols.K, true);
  assert.equal(w.state.discoveredSymbols.P, true);
  w.commitWorld();
  w.state = g.json(g.State.game.world); w.curPos = [0, 0]; w.drawMap();
  assert.equal(w.state.discoveredSymbols.K, true);
});

test('laser rifle requires a recovered blueprint and crafts without alien alloy', () => {
  const g = game();
  g.$SM.set('features.location.fabricator', true);
  g.$SM.setM('stores', { steel: 80, crystal: 80, 'energy cell': 10 });
  const button = g.element('laserCraft').attr('fabricateThing', 'laser rifle');
  const before = g.json(g.State.stores);
  assert.equal(g.Fabricator.fabricate(button), false);
  assert.deepEqual(g.json(g.State.stores), before);
  assert.deepEqual(g.json(g.Events.Executioner['executioner-intro'].scenes['7'].loot['laser rifle blueprint']), { min: 1, max: 1, chance: 1 });
  g.Path.outfit['laser rifle blueprint'] = 1;
  g.World.redeemBlueprints();
  assert.equal(g.Path.outfit['laser rifle blueprint'], undefined);
  assert.equal(g.Fabricator.canFabricate('laser rifle'), true);
  g.Fabricator.fabricate(button); g.Fabricator.fabricate(button);
  assert.equal(g.State.stores['laser rifle'], 2);
  assert.equal(g.State.stores.steel, 0);
  assert.equal(g.State.stores.crystal, 0);
  assert.equal(g.State.stores['energy cell'], 0);
  assert.equal(g.$SM.get('stores["alien alloy"]', true), 0);
  assert.equal(g.Fabricator.fabricate(button), false);
});

test('laser blueprints cannot be bought while alloy remains renewable', () => {
  const g = game();
  g.$SM.set('features.location.fabricator', true);
  g.$SM.set('game.buildings["trading post"]', 1);
  assert.equal(g.Room.TradeGoods['laser rifle blueprint'], undefined);
  assert.equal(g.Room.buyUnlocked('laser rifle blueprint'), false);
  assert.equal(g.Room.buy(g.element('laserBuy').attr('buildThing', 'laser rifle blueprint')), false);
  g.$SM.setM('stores', { 'alien alloy': 0, fur: 3000, scales: 1500, teeth: 600 });
  assert.equal(g.Room.buyUnlocked('alien alloy'), true);
  const alloy = g.element('alloyBuy').attr('buildThing', 'alien alloy');
  g.Room.buy(alloy); g.Room.buy(alloy);
  assert.equal(g.State.stores['alien alloy'], 2);
  assert.equal(g.State.stores.fur, 0);
  assert.equal(g.State.stores.scales, 0);
  assert.equal(g.State.stores.teeth, 0);
});

test('crystal energy-cell batches require etching and commit materials and output together', () => {
  const g = game(), f = g.Fabricator;
  const button = g.element('cellFabricate').attr('fabricateThing', 'energy cell');
  const stock = { crystal: 50, steel: 50, sulphur: 20, 'energy cell': 7 };
  g.$SM.setM('stores', stock);
  const before = g.json(g.State.stores);
  assert.equal(f.fabricate(button), false);
  g.$SM.set('features.location.fabricator', true);
  assert.equal(f.fabricate(button), false);
  assert.deepEqual(g.json(g.State.stores), before);
  g.$SM.set('features.industry.etching', true);
  assert.equal(f.canFabricate('energy cell'), true);
  const saved = [];
  g.Engine.saveGame = () => saved.push(g.json(g.State.stores));
  f.fabricate(button);
  assert.equal(saved.length, 1);
  for (const [key, amount] of Object.entries({ crystal: 25, steel: 25, sulphur: 10, 'energy cell': 32 })) {
    assert.equal(saved[0][key], amount);
  }
  f.fabricate(button);
  assert.equal(g.State.stores['energy cell'], 57);
  for (const missing of ['crystal', 'steel', 'sulphur']) {
    g.$SM.setM('stores', { ...stock, [missing]: 0 });
    const before = g.json(g.State.stores);
    assert.equal(f.fabricate(button), false);
    assert.deepEqual(g.json(g.State.stores), before);
  }
});

test('removing prepared crystal leaves stock intact and expedition loot still returns home', () => {
  const g = game();
  g.$SM.setM('stores', { crystal: 10 });
  g.Path.outfit = { crystal: 4, 'cured meat': 2 };
  g.$SM.set('outfit', { crystal: 4, 'cured meat': 2 });
  g.Path.clearCrystalSelection();
  assert.equal(g.Path.outfit.crystal, undefined);
  assert.equal(g.$SM.get('outfit.crystal'), undefined);
  assert.equal(g.$SM.get('stores.crystal'), 10);
  // Picked-up resources are returned through the existing expedition inventory.
  g.Path.outfit.crystal = 3;
  g.World.returnOutfit();
  assert.equal(g.$SM.get('stores.crystal'), 13);
  assert.equal(g.Path.outfit.crystal, 0);
});

test('every industrial reward route crosses combat; leaving grants no discovery', () => {
  const g = game();
  for (const id of ['crystalworks', 'chemicalworks', 'assemblyworks']) {
    const scenes = g.Events.Setpieces[id].scenes;
    let rewards = 0, exits = 0;
    function walk(id, fought, trail = []) {
      if(id === 'end') { exits++; return; }
      assert.ok(!trail.includes(id), 'industrial route must terminate');
      const scene = scenes[id];
      assert.ok(scene, 'all routes resolve');
      fought ||= !!scene.combat;
      if(scene.onLoad || (scene.loot && Object.keys(scene.loot).length)) {
        assert.ok(fought, 'discovery and resources require a victory'); rewards++;
      }
      if(scene.combat) {
        assert.ok(scene.health > 0 && scene.damage > 0 && scene.attackDelay > 0);
        assert.ok(!scene.buttons, 'no scene button may bypass combat');
      }
      const next = [scene.nextScene, ...Object.values(scene.buttons || {}).map(button => button.nextScene)].filter(Boolean);
      for (const target of next) for (const child of typeof target === 'string' ? [target] : Object.values(target)) {
        walk(child, fought, [...trail, id]);
      }
    }
    walk('start', false);
    assert.equal(rewards, 1);
    assert.equal(exits, 2);
    assert.equal(scenes.start.buttons.leave.nextScene, 'end');
  }
});

test('energy cells become renewable trade goods after discovery', () => {
  const g = game();
  g.$SM.set('game.buildings["trading post"]', 1);
  assert.equal(g.Room.buyUnlocked('energy cell'), false);
  g.$SM.setM('stores', { 'energy cell': 0, scales: 20, teeth: 20 });
  assert.equal(g.Room.buyUnlocked('energy cell'), true);
  const button = g.element('cellBuy').attr('buildThing', 'energy cell');
  g.Room.buy(button); g.Room.buy(button);
  assert.equal(g.$SM.get('stores["energy cell"]'), 2);
  assert.equal(g.$SM.get('stores.scales'), 0);
  assert.equal(g.$SM.get('stores.teeth'), 0);
  g.Room.buy(button);
  assert.equal(g.$SM.get('stores["energy cell"]'), 2);
});

test('world origin, corners, rendering, roads and movement use logical coordinates', () => {
  const g = game(), w = g.World;
  w.init(); w.state = g.json(g.State.game.world); w.curPos = [0, 0]; w.usedOutposts = {};
  assert.deepEqual(g.json(w.VILLAGE_POS), [0, 0]);
  assert.equal(w.getDistance([0, 0], [45, 45]), 90);
  assert.equal(w.state.map.length, 91);
  w.narrateMove = w.doSpace = () => {};
  for (const x of [-45, 45]) for (const y of [-45, 45]) {
    w.curPos = [x, y];
    const before = g.json(w.curPos);
    w.move([Math.sign(x), 0]); w.move([0, Math.sign(y)]);
    assert.deepEqual(g.json(w.curPos), before);
    w.move([-Math.sign(x), 0]);
    assert.equal(w.curPos[0], x - Math.sign(x));
    w.curPos = [x, y]; w.uncoverMap(x, y, 2, w.state.mask);
    assert.equal(w.getMask(w.state.mask, x, y), true);
    w.drawRoad();
  }
  w.curPos = [0, 0]; w.drawMap();
  const rows = g.element('#map').value.split('<br/>');
  assert.equal(rows.length, 91);
  assert.ok(rows.every(row => row.replace(/<div class="tooltip[^>]*>.*?<\/div>/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').length === 91));
  assert.equal(w.toCoord(w.toIndex(-45)), -45);
  assert.equal(w.isInBounds(46, 0), false);
});

test('generated landmarks are unique, in range, and dense maps fail finitely', () => {
  const g = game(), w = g.World; w.init();
  assert.equal(w.RADIUS, 45);
  for (const [tile, distance] of [['I', 5], ['C', 10], ['S', 20]]) {
    assert.equal(w.LANDMARKS[tile].minRadius, distance);
    assert.equal(w.LANDMARKS[tile].maxRadius, distance);
  }
  for (let seed = 1; seed <= 30; seed++) {
    let state = seed;
    g.Math.random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
    const map = w.generateMap();
    const sites = [{ x: 0, y: 0 }];
    for (const [tile, landmark] of Object.entries(w.LANDMARKS)) {
      const positions = w.mapSearch(tile, map);
      assert.equal(positions.length, landmark.num, tile);
      sites.push(...positions);
      if (landmark.num >= 4) {
        const counts = [0, 0, 0, 0];
        for (const { x, y } of positions) counts[w.landmarkQuadrant(x, y)]++;
        assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, tile);
      }
      for (const { x, y } of positions) {
        assert.ok(w.isInBounds(x, y));
        const distance = w.getDistance([x, y]);
        assert.ok(distance >= landmark.minRadius && distance <= landmark.maxRadius, tile);
      }
    }
    for (let i = 0; i < sites.length; i++) for (let j = 0; j < i; j++) {
      const inner = [sites[i], sites[j]].every(p => Math.abs(p.x) + Math.abs(p.y) <= 10);
      assert.ok(Math.abs(sites[i].x - sites[j].x) + Math.abs(sites[i].y - sites[j].y) >= (inner ? 3 : 5));
    }
  }
  const full = Array.from({ length: 91 }, () => Array(91).fill('H'));
  assert.throws(() => w.placeLandmark(20, 26, 'K', full), /No terrain/);
  w.RADIUS = 45;
  assert.equal(w.generateMap().length, 91);
  assert.equal(w.isInBounds(-40, 40), true);
});

for (const version of [1.0, 1.1]) test(version + ' save loads with its original map instead of resetting progress', () => {
  const g = game(), w = g.World;
  assert.equal(w.RADIUS, 45); // Loading happens before World.init selects the saved radius.
  const map = Array.from({ length: 61 }, () => Array(61).fill('.'));
  const mask = Array.from({ length: 61 }, () => Array(61).fill(false));
  map[30][30] = 'A'; map[35][30] = 'I'; map[0][60] = 'W';
  mask[30][30] = true; mask[0][60] = true;
  const original = structuredClone(map), events = [];
  g.localStorage = { gameState: JSON.stringify({ version, stores: { wood: 321 },
    world: { map, mask }, perks: { scout: true }, ship: { hull: 7, thrusters: 4 } }) };
  g.Engine.event = (...args) => events.push(args);
  g.Engine.loadGame();
  assert.equal(g.State.stores?.wood, 321, 'migration must not fall back to a new game');
  assert.equal(g.State.version, 1.4);
  assert.equal(g.State.game.world.radius, 30);
  assert.equal(w.RADIUS, 45, 'migration restores the runtime radius until World.init');
  assert.equal(g.State.game.spaceShip.hull, 7);
  assert.equal(g.State.character.perks.scout, true);
  assert.deepEqual(g.json(g.State.game.world.mask), mask);
  const changed = [];
  for (let x = 0; x < 61; x++) for (let y = 0; y < 61; y++) {
    if (g.State.game.world.map[x][y] !== original[x][y]) changed.push([x, y]);
  }
  assert.equal(changed.length, 1, 'only the newly introduced swamp changes the map');
  const [x, y] = changed[0], distance = Math.abs(x - 30) + Math.abs(y - 30);
  assert.equal(g.State.game.world.map[x][y], 'M');
  assert.ok(distance >= 15 && distance <= 45);
  assert.deepEqual(events, []);
  const migrated = g.json(g.State);
  g.$SM.updateOldState();
  assert.deepEqual(g.json(g.State), migrated, 'migration is idempotent');
});

test('1.3 migration preserves progress and gives an existing battleship its shard exactly once', () => {
  const g = game(), w = g.World; w.init();
  g.State.game.world = { radius: 30, map: Array.from({ length: 61 }, () => Array(61).fill(".")) };
  delete g.State.features.location.world; w.init();
  g.State.version = 1.3;
  const original = g.json(g.State.game.world.map);
  Object.assign(g.State.game.world, { executioner: true, ironmine: true, curPos: [0, 60], usedOutposts: { '20,40': true } });
  g.State.game.spaceShip = { hull: 7, thrusters: 4 };
  g.$SM.updateOldState(); g.$SM.updateOldState();
  assert.equal(g.State.version, 1.4);
  assert.deepEqual(g.json(g.State.game.world.map), original);
  assert.deepEqual(g.json(g.State.game.world.curPos), [-30, 30]);
  assert.equal(g.State.game.world.usedOutposts['-10,10'], true);
  assert.equal(g.State.stores['lattice shard'], 1);
  assert.equal(g.State.game.spaceShip.hull, 7);
  assert.equal(g.State.game.spaceShip.lattice, 0);
  const map = g.State.game.world.map;
  for (const key of ['CRYSTAL_WORKS','CHEMICAL_WORKS','ASSEMBLY_WORKS','SCOUT_SHIP','CARGO_SHIP']) {
    const tile = w.TILE[key], pos = w.mapSearch(tile, map, 1)[0];
    w.setTile(map, pos.x, pos.y, '.');
  }
  delete g.State.game.world.crystalExpansion;
  w.ensureExpansionLandmarks(); const first = g.json(g.State.game.world.map); w.ensureExpansionLandmarks();
  assert.deepEqual(g.json(g.State.game.world.map), first);
  assert.equal(w.mapSearch('R', g.State.game.world.map).length, 1);
});

test('lattice transactions require both civilizations and every material; launch needs all three stages', () => {
  const g = game(), s = g.Ship;
  g.State.game.spaceShip = { hull: 1, lattice: 0 };
  for (const [key, value] of Object.entries(s.LATTICE_COST)) g.State.stores[key] = value * 3;
  let before = g.json(g.State.stores);
  assert.equal(s.repairLattice(), false); assert.deepEqual(g.json(g.State.stores), before);
  g.$SM.set('features.location.fabricator', true); g.$SM.set('features.industry.etching', true);
  for (const key of Object.keys(s.LATTICE_COST)) {
    const count = g.State.stores[key]; g.State.stores[key] = 0;
    before = g.json(g.State.stores);
    assert.equal(s.repairLattice(), false); assert.deepEqual(g.json(g.State.stores), before);
    g.State.stores[key] = count;
  }
  assert.equal(s.canLiftOff(), false); assert.equal(s.checkLiftOff(), false);
  assert.equal(s.repairLattice(), true); assert.equal(s.repairLattice(), true);
  before = g.json(g.State.stores);
  assert.equal(s.repairLattice(), false); assert.deepEqual(g.json(g.State.stores), before);
  g.$SM.set('features.industry.assembly', true);
  assert.equal(s.repairLattice(), true); assert.equal(s.canLiftOff(), true);
  assert.equal(s.repairLattice(), false);
  assert.ok(Object.values(g.State.stores).every(n => n === 0));
  g.State.game.spaceShip.hull = 0; assert.equal(s.canLiftOff(), false);
});

test('housing destruction and deaths retain valid worker counts with mixed housing', () => {
  const g = game(), o = g.Outside;
  g.State.game.buildings = { hut: 20 }; assert.equal(o.getMaxPopulation(), 80);
  g.State.game.buildings.bunkhouse = 2; assert.equal(o.getMaxPopulation(), 100);
  g.State.game.population = 100; g.State.game.workers = { hunter: 40, 'crystal worker': 60 };
  assert.equal(o.destroyHuts(30), 80);
  assert.equal(g.State.game.buildings.hut, 0); assert.equal(g.State.game.population, 20);
  assert.equal(o.getNumGatherers(), 0); assert.equal(o.destroyHuts(1, true), 0);
  o.killVillagers(500);
  assert.equal(g.State.game.population, 0); assert.equal(o.getNumGatherers(), 0);
  assert.ok(Object.values(g.State.game.workers).every(n => n >= 0));
});

test('fragment claims roll back with death and cannot be farmed on revisits', () => {
  const g = game(), w = g.World; w.init();
  w.state = g.json(g.State.game.world);
  for (const source of ['executioner','scout','cargo']) {
    assert.equal(w.claimLatticeShard(source), true); assert.equal(w.claimLatticeShard(source), false);
  }
  assert.equal(g.Path.outfit['lattice shard'], 3); assert.equal(g.Path.getWeight('lattice shard'), 0);
  assert.equal(g.State.game.world.shardSources, undefined);
  w.state = g.json(g.State.game.world); g.Path.outfit = {};
  assert.equal(w.claimLatticeShard('cargo'), true);
  w.commitWorld(); w.returnOutfit();
  w.state = g.json(g.State.game.world);
  assert.equal(w.claimLatticeShard('cargo'), false); assert.equal(g.State.stores['lattice shard'], 1);
});

test('autosaves cannot retain a temporary quest fragment without its source ledger', () => {
  const g = game(), w = g.World; w.init();
  g.State.outfit = { 'cured meat': 5 }; g.Path.outfit = g.State.outfit;
  w.onArrival();
  w.claimLatticeShard('scout');
  assert.equal(g.State.outfit['lattice shard'], undefined);
  assert.equal(g.State.game.world.shardSources, undefined);
  let saved;
  g.Engine.saveGame = () => { saved = g.json(g.State); };
  w.commitWorld();
  assert.equal(saved.stores['lattice shard'], 1);
  assert.equal(saved.game.world.shardSources.scout, true);
  w.commitWorld(); assert.equal(g.State.stores['lattice shard'], 1);
});

test('industrial unlocks survive every discovery order and use the existing income system', () => {
  for (const order of [['crystal','etching','assembly'],['assembly','etching','crystal'],['etching','crystal','assembly'],['crystal','assembly','etching'],['assembly','crystal','etching'],['etching','assembly','crystal']]) {
    const g = game(), w = g.World; w.init(); w.state = g.json(g.State.game.world); w.curPos = [20, 0]; w.usedOutposts = {};
    g.Room.updateBuildButtons = g.Room.updateIncomeView = () => {};
    for (const feature of order) w.completeIndustry(feature);
    assert.equal(g.State.features.industry, undefined);
    w.redeemIndustry();
    assert.ok(order.every(key => g.State.features.industry[key]));
    g.State.game.population = 2; g.State.game.workers['crystal worker'] = 2;
    g.Outside.updateVillageIncome();
    assert.equal(g.State.income['crystal worker'].delay, 45);
    assert.equal(g.State.income['crystal worker'].stores.crystal, 2);
    g.$SM.setM('stores', { 'cured meat': 4, steel: 2, coal: 4 }); g.$SM.collectIncome();
    assert.equal(g.State.stores.crystal, 2); assert.equal(g.State.stores['cured meat'], 0);
  }
});

test('stim expires, consumes stock, and combat cleanup cancels status and explosion callbacks', () => {
  const g = game(), e = g.Events, player = g.element('#wanderer');
  player.attr('id', 'wanderer').data('hp', 80).data('maxHp', 85);
  g.State.stores['kinetic armour'] = 1; g.World.health = 80; g.Path.outfit.stim = 2;
  e.setHeal = () => {}; e.drawFloatText = () => {};
  e.useStim(); assert.equal(g.Path.outfit.stim, 1); assert.equal(player.data('status'), 'boost');
  g.advance(2999); assert.equal(player.data('status'), 'boost');
  g.advance(1); assert.equal(player.data('status'), 'none');
  e.useStim(); e.clearTimeouts(); g.advance(10000); assert.equal(g.timers.size, 0);
  e.explode(g.element('#enemy'), player, 50); e.clearTimeouts(); const hp = g.World.health;
  g.advance(4000); assert.equal(g.World.health, hp);
  assert.equal(e.useStim(), false);
});

test('hypo respects stock and full health, and shields block without healing', () => {
  const g = game(), e = g.Events, p = g.element('#wanderer'), enemy = g.element('#enemy');
  p.attr('id', 'wanderer').data('hp', 40).data('maxHp', 85); enemy.attr('id', 'enemy');
  g.State.stores['kinetic armour'] = 1; g.World.health = 40; g.Path.outfit.hypo = 1;
  e.setHeal = () => {}; e.drawFloatText = () => {};
  e.useHypo(); assert.equal(g.World.health, 70); assert.equal(g.Path.outfit.hypo, 0);
  e.useHypo(); assert.equal(g.World.health, 70);
  g.World.health = 85; g.Path.outfit.hypo = 1; e.useHypo(); assert.equal(g.Path.outfit.hypo, 1);
  p.data('hp', 40); g.World.health = 40; g.Path.outfit['energy cell'] = 1;
  e.useShield(); assert.equal(g.Path.outfit['energy cell'], 0);
  e.damage(enemy, p, 10, 'ranged'); assert.equal(g.World.health, 40); assert.equal(p.data('status'), 'none');
  e.damage(enemy, p, 10, 'ranged'); assert.equal(g.World.health, 30);
});

test('fabricator enforces blueprint and maximum guards; score and prestige use IDs', () => {
  const g = game(); g.State.features.location = { fabricator: true };
  g.State.stores['fluid recycler'] = 1;
  g.State.stores['alien alloy'] = 20; g.State.stores.crystal = 20; g.State.stores.steel = 50;
  const button = g.element('fabricate').attr('fabricateThing', 'fluid recycler');
  const before = g.json(g.State.stores); g.Fabricator.fabricate(button); assert.deepEqual(g.json(g.State.stores), before);
  button.attr('fabricateThing', 'plasma rifle'); assert.equal(g.Fabricator.fabricate(button), false);
  g.State.stores = { crystal: 10, 'lattice shard': 100, 'alien alloy': 2, wood: 5 };
  assert.equal(g.Score.calculateScore(), 75);
  const inherited = g.Prestige.getStores(false);
  assert.equal(inherited.wood, 5); assert.equal(inherited.crystal, 10); assert.equal(inherited['lattice shard'], undefined);
  g.State.previous.stores = [10, 20]; g.Prestige.collectStores(); g.Prestige.collectStores();
  assert.equal(g.State.stores.wood, 15); assert.equal(g.State.stores.fur, 20);
});

test('missing audio stays silent, including space volume changes with no background track', async () => {
  const g = game(), audio = g.AudioEngine;
  assert.equal(await audio.loadAudioFile(undefined), null);
  g.location = { href: 'http://localhost:8080/index.html' };
  audio._audioContext = {};
  audio._master = {};
  g.fetch = () => Promise.reject(new Error('offline'));
  assert.equal(await audio.loadAudioFile('audio/missing.flac'), null);
  g.fetch = () => Promise.resolve({ ok: false });
  assert.equal(await audio.loadAudioFile('audio/missing.flac'), null);
  assert.doesNotThrow(() => audio.setBackgroundMusicVolume(0.5));
});
