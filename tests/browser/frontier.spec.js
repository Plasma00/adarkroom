import fs from 'node:fs';
import { test, expect } from '@playwright/test';

test('frontier guard strength follows the current site rather than the previous encounter', async ({ page }) => {
  const errors=await openFixture(page);
  await page.evaluate(()=>{ Path.embark(); $SM.set('stores["kinetic armour"]',1); World.setHp(85); });
  for(const [distance,health]of [[64,85],[65,115],[45,85]]) {
    await page.evaluate(distance=>{
      World.curPos=distance===65?[20,45]:distance===64?[20,44]:[0,45];
      Events.startEvent(Events.Setpieces.fortress);
      Events.loadScene('sentry');
    },distance);
    await expect(page.locator('#enemy')).toBeVisible();
    expect(await page.locator('#enemy').evaluate(el=>$(el).data('maxHp'))).toBe(health);
    await page.evaluate(()=>Events.endEvent());
    await expect(page.locator('#event')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

async function openFixture(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.stack));
  await page.route('https://**', route => route.abort());
  const save = Buffer.from(fs.readFileSync('doc/test-saves/compass-all-perks.txt', 'utf8').trim(), 'base64').toString('utf8');
  await page.addInitScript(save => { localStorage.gameState = save; }, save);
  await page.goto('/?lang=zh_cn');
  await page.waitForFunction(() => window.Path?.panel && window.MobileUI?.ready);
  await page.evaluate(() => { $.fx.off = true; Engine.travelTo(Path); });
  return errors;
}

test('compass fixture imports with all perks, no exploration, and map zoom preserves fog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openFixture(page);
  expect(await page.evaluate(() => Object.keys(Engine.Perks).every(k => $SM.hasPerk(k)))).toBe(true);
  expect(await page.evaluate(() => $SM.get('game.world.mask').flat().filter(Boolean).length)).toBe(1);
  await expect(page.locator('#stores')).toHaveAttribute('data-legend', '资源');
  await expect(page.locator('#trainingGuide')).toHaveCount(0);
  await page.locator('#embarkButton').click();
  await expect(page.locator('#map')).toHaveAttribute('data-cells', '10');
  await expect(page.locator('#mapLegend [data-symbol="Z"]')).toHaveCount(0);
  const initial = await page.locator('#map').evaluate(el => ({ width: el.getBoundingClientRect().width, font: parseFloat(getComputedStyle(el).fontSize) }));
  await page.screenshot({ path: 'test-results/compass-map-10-mobile.png', fullPage: true });
  const fog = await page.evaluate(() => {
    World.setMask(World.state.mask, 10, 0, true);
    const fog = JSON.stringify(World.state.mask); World.drawMap(); return fog;
  });
  await expect(page.locator('#map')).toHaveAttribute('data-cells', '30');
  const expanded = await page.locator('#map').evaluate(el => ({ width: el.getBoundingClientRect().width, font: parseFloat(getComputedStyle(el).fontSize) }));
  expect(expanded.width).toBeCloseTo(initial.width, 0);
  expect(initial.font).toBeLessThanOrEqual(20); expect(expanded.font).toBe(initial.font);
  expect(await page.evaluate(() => JSON.stringify(World.state.mask))).toBe(fog);
  await page.screenshot({ path: 'test-results/compass-map-30-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1200, height: 850 });
  await expect(page.locator('#map')).toHaveAttribute('data-cells', '30');
  expect(await page.evaluate(() => JSON.stringify(World.state.mask))).toBe(fog);
  expect(errors).toEqual([]);
});

test('warehouse, fortress and battlefield play through guarded rewards and correct site conversion', async ({ page }) => {
  const errors = await openFixture(page);
  await page.evaluate(() => {
    $SM.set('character.perks', {}); $SM.set('character.shots', 0);
    $SM.setM('stores', { rifle: 1, bullets: 100, 's armour': 1, 'water tank': 1, convoy: 1 });
    Path.outfit = { rifle: 1, bullets: 30, 'cured meat': 20 }; Path.embark();
    $.fx.off = false; World.Weapons.rifle.damage = 200; World.getHitChance = () => 1;
  });
  const visit = async tile => {
    await page.evaluate(tile => {
      const pos = World.mapSearch(tile, World.state.map, 1)[0]; World.curPos = [pos.x, pos.y]; World.doSpace();
    }, tile);
  };
  const win = async () => {
    await expect(page.locator('#enemy')).toBeVisible();
    await page.locator('#attack_rifle').click();
    await expect(page.locator('#leaveBtn')).not.toHaveClass(/disabled/);
    await page.locator('#leaveBtn').click();
  };
  await visit('G'); await page.locator('#event #enter').click(); await win();
  await expect(page.locator('#event')).toContainText('无法改建为前哨');
  expect(await page.evaluate(() => World.getTerrain())).toBe('G!');
  await page.locator('#event #leave').click(); await expect(page.locator('#event')).toHaveCount(0);
  await visit('Z'); await page.locator('#event #assault').click(); await win();
  await expect(page.locator('#event')).toContainText('负伤的军需官');
  await page.locator('#event #secure').click();
  expect(await page.evaluate(() => World.getTerrain())).toBe('P');
  expect(await page.evaluate(() => World.water)).toBe(await page.evaluate(() => World.getMaxWater()));
  await page.screenshot({ path: 'test-results/fortress-outpost-zh.png', fullPage: true });
  await page.locator('#event #leave').click(); await expect(page.locator('#event')).toHaveCount(0);
  await visit('F'); await expect(page.locator('#event')).toContainText('自动炮台');
  await page.locator('#event #attack').click(); await win();
  expect(await page.evaluate(() => World.getTerrain())).toBe('F!');
  await page.locator('#event #leave').click();
  expect(errors).toEqual([]);
});

test('unlocks determine worker, building and fabrication order in the Chinese interface', async ({ page }) => {
  const errors = await openFixture(page);
  await page.evaluate(() => {
    $SM.set('character.perks.sharpshooter', false); $SM.set('stores.rifle', 1);
    Path.updateOutfitting();
  });
  await expect(page.locator('#outfit_row_rifle .weaponDamage')).toHaveText('5');
  await page.evaluate(() => { $SM.addPerk('sharpshooter'); Path.updateOutfitting(); });
  await expect(page.locator('#outfit_row_rifle .weaponDamage')).toHaveText('8');
  await page.evaluate(() => {
    $SM.set('game.workers["crystal worker"]', 0); $SM.set('game.workers.armourer', 0);
    Outside.updateWorkersView();
    $SM.set('game.buildings["sulphur mine"]', 1); $SM.set('game.buildings["iron mine"]', 1);
    Outside.updateVillage();
    $SM.set('features.location.fabricator', true);
    $SM.set('character.blueprints.stim', true); $SM.set('character.blueprints["laser rifle"]', true);
    Fabricator.init(); Engine.travelTo(Fabricator);
  });
  const workers = await page.locator('#workers .workerRow').evaluateAll(rows => rows.map(r => r.id));
  expect(workers.indexOf('workers_row_crystal-worker')).toBeLessThan(workers.indexOf('workers_row_armourer'));
  const builds = await page.locator('#village .row_key').allTextContents();
  expect(builds.indexOf('硫磺矿')).toBeLessThan(builds.indexOf('铁矿'));
  const crafts = await page.locator('#fabricateButtons [fabricateThing]').evaluateAll(rows => rows.map(r => r.getAttribute('fabricateThing')));
  expect(crafts.indexOf('stim')).toBeLessThan(crafts.indexOf('laser rifle'));
  expect(await page.locator('#blueprints .blueprintRow').allTextContents()).toEqual(['兴奋剂', '激光步枪']);
  expect(errors).toEqual([]);
});
