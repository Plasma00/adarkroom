import { test, expect } from '@playwright/test';

async function openGame(page, lang = 'en') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack));
  await page.route('https://**', route => route.abort());
  await page.goto('/?lang=' + lang);
  await page.waitForFunction(() => window.Room?.panel && window.$SM);
  // Skip animation durations, but retain real DOM, event handlers and game logic.
  await page.evaluate(() => { $.fx.off = true; $SM.set('playStats.audioAlertShown', true); });
  return errors;
}

async function expedition(page) {
  await page.evaluate(() => {
    $SM.setM('stores', { wood: 10000, compass: 1, 's armour': 1, 'cured meat': 500, 'water tank': 1, convoy: 1 });
    if (!Outside.panel) Outside.init();
    if (!Path.panel) Path.init();
    Engine.activeModule = World;
    Path.outfit = { 'cured meat': 20 };
    World.onArrival();
    $('#outerSlider').css('left', '-700px');
  });
}

async function visit(page, tile) {
  await page.evaluate(tile => {
    const pos = World.mapSearch(World.TILE[tile], World.state.map, 1)[0];
    World.curPos = [pos.x, pos.y]; World.doSpace();
  }, tile);
  await expect(page.locator('#event')).toBeVisible();
}

test('new game, industrial discoveries, both new ships and lattice launch/crash', async ({ page }) => {
  const errors = await openGame(page);
  await expect(page.locator('#lightButton')).toBeVisible();
  await expedition(page);
  await page.evaluate(() => { $.fx.off = false; World.Weapons.fists.damage = 100; World.getHitChance = () => 1; });
  for (const [tile, button, feature] of [['CRYSTAL_WORKS','enter','crystal'],['CHEMICAL_WORKS','drain','etching'],['ASSEMBLY_WORKS','inspect','assembly']]) {
    await visit(page, tile); await page.locator('#event #' + button).click();
    await expect(page.locator('#enemy')).toBeVisible();
    expect(await page.evaluate(feature => !!World.state.industry?.[feature], feature)).toBe(false);
    // One decisive attack exercises the real victory and continuation handlers.
    await page.locator('#attack_fists').click();
    await expect(page.locator('#leaveBtn')).not.toHaveClass(/disabled/);
    await page.locator('#leaveBtn').click();
    expect(await page.evaluate(feature => World.state.industry[feature], feature)).toBe(true);
    expect(await page.evaluate(feature => !!$SM.get('features.industry.' + feature), feature)).toBe(false);
    await page.locator('#event #leave').click();
    await expect(page.locator('#event')).toHaveCount(0);
  }
  await page.evaluate(() => { $.fx.off = true; });
  await visit(page, 'SCOUT_SHIP');
  await page.locator('#event #reflection').click(); await page.locator('#event #follow').click(); await page.locator('#event #leave').click();
  await visit(page, 'CARGO_SHIP');
  await page.locator('#event #cells').click(); await page.locator('#event #continue').click(); await page.locator('#event #leave').click();
  // Reach the existing introductory reward, without changing its three optional wings or boss.
  await visit(page, 'EXECUTIONER');
  await page.evaluate(() => Events.loadScene('7'));
  await page.locator('#event #leave').click();
  await page.evaluate(() => {
    World.state.ship = true;
    World.goHome();
    Engine.activeModule = Ship;
    $('#locationSlider').css('left', -Ship.panel.position().left + 'px');
    Ship.onArrival();
  });
  expect(await page.evaluate(() => $SM.get('stores["lattice shard"]'))).toBe(3);
  expect(await page.evaluate(() => $SM.get('features.industry'))).toEqual({ crystal: true, etching: true, assembly: true });
  await expect(page.locator('#latticeRow .row_val')).toHaveText('dark');
  await page.evaluate(() => {
    $SM.setM('stores', { crystal: 12, steel: 30, sulphur: 60, 'energy cell': 9, 'alien alloy': 4 });
    Ship.reinforceHull();
  });
  await expect(page.locator('#liftoffButton')).toHaveClass(/disabled/);
  for (const state of ['fractured','aligned','awake']) {
    await page.locator('#latticeButton').click();
    await expect(page.locator('#latticeRow .row_val')).toHaveText(state);
  }
  await expect(page.locator('#liftoffButton')).not.toHaveClass(/disabled/);
  // Space uses repeating animation callbacks; it needs its real animation clock.
  await page.evaluate(() => { $.fx.off = false; });
  await page.locator('#liftoffButton').click(); await page.locator('#event #fly').click();
  expect(await page.evaluate(() => Engine.activeModule === Space)).toBe(true);
  await page.evaluate(() => Space.crash());
  expect(await page.evaluate(() => $SM.get('game.spaceShip.lattice'))).toBe(3);
  expect(await page.evaluate(() => Ship.canLiftOff())).toBe(true);
  expect(errors).toEqual([]);
});

test('industrial entrance exits and combat deaths do not unlock factories', async ({ page }) => {
  const errors = await openGame(page, 'zh_cn');
  await page.evaluate(() => Engine.turnLightsOff());
  for (const [tile, button, feature] of [['CRYSTAL_WORKS','enter','crystal'],['CHEMICAL_WORKS','drain','etching'],['ASSEMBLY_WORKS','inspect','assembly']]) {
    await expedition(page);
    await visit(page, tile);
    await page.locator('#event #leave').click();
    expect(await page.evaluate(feature => !!World.state.industry?.[feature], feature)).toBe(false);
    await visit(page, tile);
    await page.locator('#event #' + button).click();
    await expect(page.locator('#enemy')).toBeVisible();
    await expect(page.locator('#description')).toContainText(/[\u4e00-\u9fff]/);
    await expect(page.locator('#event')).toHaveCSS('background-color', 'rgb(39, 40, 35)');
    if(tile === 'CRYSTAL_WORKS') await page.screenshot({ path: 'test-results/industrial-combat-zh.png' });
    await page.evaluate(() => {
      Events.damage($('#enemy'), $('#wanderer'), 1000, 'ranged');
      Events.checkPlayerDeath();
    });
    await expect(page.locator('#event')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Engine.keyLock)).toBe(false);
    expect(await page.evaluate(feature => !!$SM.get('features.industry.' + feature), feature)).toBe(false);
    expect(await page.evaluate(feature => !!$SM.get('game.world.industry.' + feature), feature)).toBe(false);
    expect(await page.evaluate(() => Events._combatTimers.length)).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('cargo combat route, expedition death rollback, and bunkhouse capacity', async ({ page }) => {
  const errors = await openGame(page); await expedition(page);
  await visit(page, 'SCOUT_SHIP'); await page.locator('#event #sky').click(); await page.locator('#event #leave').click();
  await page.evaluate(() => World.die());
  await page.waitForFunction(() => !Engine.keyLock);
  expect(await page.evaluate(() => State.game.world.shardSources || {})).toEqual({});
  await expedition(page);
  await page.evaluate(() => {
    $SM.set('stores["kinetic armour"]', 1); World.setHp(85);
    Path.outfit['energy blade'] = 1; Path.outfit['plasma rifle'] = 1;
    Path.outfit['energy cell'] = 20; World.getHitChance = () => 1;
  });
  await visit(page, 'CARGO_SHIP'); await page.locator('#event #alloy').click();
  expect(await page.locator('#enemy').evaluate(el => $(el).data('maxHp'))).toBe(120);
  // Use an obtainable late-game pair with real damage, enemy attacks and cooldowns.
  await page.evaluate(() => { $.fx.off = false; });
  for (let round = 0; round < 6; round++) {
    for (const weapon of ['energy-blade', 'plasma-rifle']) {
      const hp=await page.locator('#enemy').evaluate(el => $(el).data('hp'));
      if(hp<=0) break;
      await expect(page.locator('#attack_'+weapon)).not.toHaveClass(/disabled/);
      await page.locator('#attack_'+weapon).click();
      await expect.poll(()=>page.locator('#enemy').evaluate(el => $(el).data('hp'))).toBeLessThan(hp);
    }
    if(await page.locator('#enemy').evaluate(el => $(el).data('hp'))<=0) break;
  }
  expect(await page.evaluate(() => World.health)).toBeGreaterThan(0);
  expect(await page.evaluate(() => Path.outfit['energy cell'])).toBeLessThan(20);
  await expect(page.locator('#leaveBtn')).toBeVisible();
  await expect(page.locator('#leaveBtn')).not.toHaveClass(/disabled/); await page.locator('#leaveBtn').click();
  await page.locator('#event #leave').click();
  expect(await page.evaluate(() => Path.outfit['lattice shard'])).toBe(1);
  await page.evaluate(() => {
    $.fx.off = true;
    World.state.industry = { assembly: true };
    World.goHome();
    $SM.setM('stores', { wood: 10000, steel: 200, leather: 500 });
    $SM.set('game.builder.level', 4); $SM.set('game.temperature.value', Room.TempEnum.Warm.value);
    $SM.set('game.buildings.hut', 20);
    Engine.travelTo(Room);
    Room.updateBuildButtons();
  });
  await page.locator('[buildThing="bunkhouse"]').click(); await page.locator('[buildThing="bunkhouse"]').click();
  expect(await page.evaluate(() => Outside.getMaxPopulation())).toBe(100);
  await expect(page.locator('[buildThing="bunkhouse"]')).toHaveClass(/disabled/);
  expect(errors).toEqual([]);
});

for (const beacon of [false, true]) test(`successful ending preserves ${beacon ? 'fleet beacon branch' : 'ordinary branch'} and clears expansion inheritance`, async ({ page }) => {
  const errors = await openGame(page); await expedition(page);
  await page.clock.install();
  await page.evaluate(beacon => {
    Ship.init();
    $SM.setM('stores', { crystal: 20, 'lattice shard': 3, 'fleet beacon': beacon ? 1 : 0 });
    $SM.setM('game.spaceShip', { hull: 3, lattice: 3 });
    Space.done = false;
    Engine.activeModule = Space;
    $('<div>').attr('id', 'starsContainer').appendTo('body');
    // Start the actual successful-flight sequence at its boundary, keeping all ending logic.
    Space.endGame();
  }, beacon);
  await page.clock.runFor(5000);
  if (beacon) {
    await page.clock.runFor(20000);
    await expect(page.locator('.outroContainer')).toContainText('wanderer homefleet');
    await page.locator('#wait-btn').click(); await page.clock.runFor(3500);
  }
  await expect(page.locator('.centerCont')).toContainText('score for this game');
  expect(await page.evaluate(() => State.game?.spaceShip?.lattice)).toBeUndefined();
  expect(await page.evaluate(() => State.previous.stores.crystal)).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => State.previous.stores['lattice shard'])).toBeUndefined();
  expect(errors).toEqual([]);
});

test('saved 1.1 world migrates before initialization and survives a second reload', async ({ page }) => {
  const errors = await openGame(page);
  await page.evaluate(() => {
    const map = Array.from({ length: 61 }, () => Array(61).fill('.'));
    const mask = Array.from({ length: 61 }, () => Array(61).fill(false));
    map[30][30] = 'A'; map[35][30] = 'I'; map[30][58] = 'W';
    mask[30][30] = true; mask[30][58] = true;
    localStorage.gameState = JSON.stringify({ version: 1.1,
      stores: { wood: 321, compass: 1 }, world: { map, mask },
      perks: { scout: true }, ship: { hull: 7, thrusters: 4 },
      config: { soundOn: false }, playStats: { audioAlertShown: true } });
  });
  for (let reload = 0; reload < 2; reload++) {
    await page.reload();
    await page.waitForFunction(() => window.World?.panel && window.Ship?.panel);
    const state = await page.evaluate(() => ({
      version: State.version, wood: State.stores.wood, radius: World.RADIUS,
      size: State.game.world.map.length, village: World.getTile(State.game.world.map, 0, 0),
      mine: World.getTile(State.game.world.map, 5, 0),
      ship: World.mapSearch('W', State.game.world.map),
      swampCount: World.mapSearch('M', State.game.world.map).length,
      hull: State.game.spaceShip.hull, scout: State.character.perks.scout,
      revealed: World.getMask(State.game.world.mask, 0, 28)
    }));
    expect(state).toEqual({ version: 1.4, wood: 321, radius: 30, size: 61,
      village: 'A', mine: 'I', ship: [{ x: 0, y: 28 }], swampCount: 1,
      hull: 7, scout: true, revealed: true });
  }
  expect(errors).toEqual([]);
});

test('saved 1.3 world reloads with additive landmarks and keeps the battleship/ship state', async ({ page }) => {
  const errors = await openGame(page); await expedition(page);
  const before = await page.evaluate(() => {
    State.game.world = { radius: 30, map: Array.from({ length: 61 }, () => Array(61).fill(".")) };
    delete State.features.location.world; World.init();
    const map = $SM.get('game.world.map');
    for (const key of ['CRYSTAL_WORKS','CHEMICAL_WORKS','ASSEMBLY_WORKS','SCOUT_SHIP','CARGO_SHIP']) {
      const p = World.mapSearch(World.TILE[key], map, 1)[0]; World.setTile(map, p.x, p.y, '.');
    }
    delete State.game.world.crystalExpansion;
    State.game.world.executioner = true; State.game.world.ironmine = true;
    State.game.spaceShip = { hull: 4, thrusters: 3 }; State.version = 1.3;
    State.features.location.fabricator = true; State.features.location.spaceShip = true;
    localStorage.gameState = JSON.stringify(State);
    return { ship: World.mapSearch('W', map), battle: World.mapSearch('X', map) };
  });
  await page.reload(); await page.waitForFunction(() => window.World?.panel && window.Ship?.panel);
  const state = await page.evaluate(() => ({
    version: State.version, radius: State.game.world.radius, ship: World.mapSearch('W', State.game.world.map),
    battle: World.mapSearch('X', State.game.world.map), scout: World.mapSearch('R', State.game.world.map).length,
    shard: State.stores['lattice shard'], hull: State.game.spaceShip.hull
  }));
  expect(state).toEqual({ version: 1.4, radius: 30, ...before, scout: 1, shard: 1, hull: 4 });
  await page.reload(); await page.waitForFunction(() => window.Ship?.panel);
  expect(await page.evaluate(() => State.stores['lattice shard'])).toBe(1);
  expect(errors).toEqual([]);
});

test('real combat handles hypo/stim/shield, wins, and cleans timers between events', async ({ page }) => {
  const errors = await openGame(page); await expedition(page);
  await page.evaluate(() => {
    $.fx.off = false;
    $SM.set('stores["kinetic armour"]', 1); World.setHp(60);
    Object.assign(Path.outfit, { hypo: 1, stim: 1, 'energy cell': 2, 'plasma rifle': 1 });
    Events.startEvent({ title: 'combat regression', scenes: { start: {
      ...Enemies.Executioner.guard, health: 10, attackDelay: 1000, loot: {}, nextScene: 'end'
    } } });
  });
  await expect(page.locator('#hypo')).not.toHaveClass(/disabled/);
  await page.locator('#hypo').click();
  expect(await page.evaluate(() => World.health)).toBe(85);
  await expect(page.locator('#hypo')).toHaveClass(/disabled/);
  await page.locator('#use-stim').click();
  expect(await page.evaluate(() => Path.outfit.stim)).toBe(0);
  await expect(page.locator('#wanderer')).toHaveClass(/boost/);
  await expect(page.locator('#wanderer')).not.toHaveClass(/boost/, { timeout: 4500 });
  await page.locator('#shld').click();
  const before = await page.evaluate(() => World.health);
  await page.evaluate(() => Events.damage($('#enemy'), $('#wanderer'), 10, 'ranged'));
  expect(await page.evaluate(() => World.health)).toBe(before);
  await page.evaluate(() => { World.getHitChance = () => 1; });
  await page.locator('#attack_plasma-rifle').click();
  await expect(page.locator('#leaveBtn')).toBeVisible();
  await expect(page.locator('#leaveBtn')).not.toHaveClass(/disabled/);
  await page.locator('#leaveBtn').click();
  await expect(page.locator('#event')).toHaveCount(0);
  expect(await page.evaluate(() => Events._combatTimers.length)).toBe(0);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => World.health)).toBe(before);
  expect(errors).toEqual([]);
});

test('laser blueprint is obtained only from battleship loot and unlocks fabrication', async ({ page }) => {
  const errors = await openGame(page, 'zh_cn'); await expedition(page);
  await visit(page, 'EXECUTIONER');
  await page.evaluate(() => Events.loadScene('7'));
  await expect(page.locator('#take_laser-rifle-blueprint')).toContainText('激光步枪蓝图');
  await page.locator('#take_laser-rifle-blueprint').click();
  expect(await page.evaluate(() => !!$SM.get('character.blueprints["laser rifle"]'))).toBe(false);
  await page.locator('#event #leave').click();
  await page.evaluate(() => { World.goHome(); Engine.travelTo(Fabricator); });
  await expect(page.locator('#blueprints')).toContainText('激光步枪');
  await expect(page.locator('[fabricateThing="laser rifle"]')).toHaveCount(1);
  await page.evaluate(() => {
    $SM.setM('stores', { steel: 40, crystal: 40, 'energy cell': 5, 'alien alloy': 0 });
  });
  await page.locator('[fabricateThing="laser rifle"]').click();
  expect(await page.evaluate(() => $SM.get('stores["laser rifle"]'))).toBe(1);
  expect(await page.evaluate(() => $SM.get('stores["alien alloy"]'))).toBe(0);
  await page.screenshot({ path: 'test-results/laser-rifle-fabrication.png', fullPage: true });
  await page.evaluate(() => {
    $SM.set('game.buildings["trading post"]', 1);
    Room.updateBuildButtons(); Engine.travelTo(Room);
  });
  await expect(page.locator('[buildThing="laser rifle blueprint"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('new text has Chinese translations and other languages fall back to English', async ({ page }) => {
  const errors = await openGame(page, 'zh_cn'); await expedition(page);
  await visit(page, 'CRYSTAL_WORKS');
  await expect(page.locator('.eventTitle')).toHaveText('废弃晶体厂');
  expect(await page.evaluate(() => _('lattice shard'))).toBe('晶格碎片');
  expect(errors).toEqual([]);
  await page.goto('/?lang=fr'); await page.waitForFunction(() => window.Room?.panel);
  expect(await page.evaluate(() => _('the final lattice needs a precision frame.'))).toBe('the final lattice needs a precision frame.');
});
