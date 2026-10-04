import fs from 'node:fs';
import { test, expect } from '@playwright/test';

async function openExpedition(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack));
  await page.route('https://**', route => route.abort());
  const save = Buffer.from(fs.readFileSync('doc/test-saves/compass-all-perks.txt', 'utf8').trim(), 'base64').toString('utf8');
  await page.addInitScript(save => { localStorage.gameState = save; }, save);
  await page.goto('/?lang=zh_cn');
  await page.waitForFunction(() => window.Path?.panel && window.MobileUI?.ready);
  await page.evaluate(() => { $.fx.off = true; Engine.travelTo(Path); Path.embark(); });
  return errors;
}

test('early map glyphs stay small through actual steps and late zoom still fits the grid', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const errors = await openExpedition(page);
  await expect(page.locator('#map')).toHaveAttribute('data-cells', '10');
  const earlyFont = await page.locator('#map').evaluate(el => getComputedStyle(el).fontSize);
  expect(parseFloat(earlyFont)).toBeLessThanOrEqual(20);
  await page.screenshot({ path: 'test-results/bugfix-initial-map.png', fullPage: true });
  await page.evaluate(() => {
    World.checkFight = () => {};
    for (let x = 1; x <= 6; x++) World.setTile(World.state.map, x, 0, World.TILE.FIELD);
  });
  for (let x = 1; x <= 5; x++) {
    await page.locator('[data-direction=right]').click();
    expect(await page.evaluate(() => World.curPos)).toEqual([x, 0]);
    await expect(page.locator('#map')).toHaveCSS('font-size', earlyFont);
  }
  // The visual cell and the click coordinate calculation must share the same centre.
  const playerCell = page.locator('#map > .mapCell').filter({ hasText: '@' });
  const cell = await playerCell.boundingBox();
  await page.mouse.click(cell.x + cell.width * 0.8, cell.y + cell.height / 2);
  expect(await page.evaluate(() => World.curPos)).toEqual([6, 0]);
  await page.evaluate(() => {
    World.setMask(World.state.mask, World.RADIUS, World.RADIUS, true); World.drawMap();
  });
  await expect(page.locator('#map')).toHaveAttribute('data-cells', '91');
  const geometry = await page.locator('#map').evaluate(el => ({
    font: parseFloat(getComputedStyle(el).fontSize), width: el.clientWidth, height: el.clientHeight,
    scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight,
    cells: el.querySelectorAll('.mapCell').length
  }));
  expect(geometry.font).toBeLessThan(20);
  expect(geometry.width).toBe(geometry.height);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height + 1);
  expect(geometry.cells).toBe(91 * 91);
  expect(errors).toEqual([]);
});

for (const width of [1280, 360, 280]) {
  test(`full backpack drop menu and loot columns remain stable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const errors = await openExpedition(page);
    await page.evaluate(() => {
      Path.outfit = { 'cured meat': Path.getCapacity() - 5, charm: 1, teeth: 1, iron: 1, medicine: 1, torch: 1 };
      // Fill exactly to capacity, including items whose weight differs from one.
      Path.outfit['cured meat'] += Path.getFreeSpace();
      World.updateSupplies();
      Events.startEvent({ title: _('An Old House'), scenes: { start: {
        text: [], loot: { 'cured meat': { min: 8, max: 8, chance: 1 }, cloth: { min: 4, max: 4, chance: 1 } },
        buttons: { leave: { text: _('leave'), nextScene: 'end' } }
      } } });
    });
    const cloth = page.locator('#take_cloth');
    await expect(cloth).toBeVisible();
    const before = await cloth.boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + before.height - 2);
    await expect(page.locator('#dropMenu')).toBeVisible();
    // Sample successive animation frames with the pointer stationary: no enter/leave loop.
    const samples = await page.evaluate(async () => {
      const samples = [];
      for (let i = 0; i < 45; i++) {
        await new Promise(requestAnimationFrame);
        const rect = document.querySelector('#take_cloth').getBoundingClientRect();
        const all = document.querySelector('#all_take_cloth').getBoundingClientRect();
        samples.push({ x: rect.x, y: rect.y, width: rect.width, allY: all.y, menu: !!document.querySelector('#dropMenu') });
      }
      return samples;
    });
    for (const sample of samples) {
      expect(sample.menu).toBe(true);
      expect(sample.x).toBeCloseTo(before.x, 1); expect(sample.y).toBeCloseTo(before.y, 1);
      expect(sample.width).toBeCloseTo(before.width, 1); expect(sample.allY).toBeCloseTo(before.y, 1);
    }
    await page.screenshot({ path: `test-results/bugfix-loot-${width}.png`, fullPage: true });
    const beforeMeat = await page.evaluate(() => Path.outfit['cured meat']);
    await page.locator('#drop_cured-meat').click();
    expect(await page.evaluate(() => Path.outfit.cloth)).toBe(1);
    expect(await page.evaluate(() => Path.outfit['cured meat'])).toBe(beforeMeat - 1);
    expect(await page.evaluate(() => $('#take_cloth').data('numLeft'))).toBe(3);
    expect(await page.evaluate(() => $('#take_cured-meat').data('numLeft'))).toBe(9);
    expect(await page.evaluate(() => Path.getFreeSpace())).toBe(0);
    await page.mouse.move(0, 0);
    await expect(page.locator('#dropMenu')).toHaveCount(0);
    expect(await page.locator('#event').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('touch can cancel dropping and reach the last exchange choice in a short viewport', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 480 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const errors = await openExpedition(page);
    await page.evaluate(() => {
      Path.outfit = { 'cured meat': 1, charm: 1, teeth: 1, iron: 1, medicine: 1, torch: 1 };
      Path.outfit['cured meat'] += Path.getFreeSpace();
      Events.startEvent({ title: _('An Old House'), scenes: { start: {
        text: [], loot: { cloth: { min: 4, max: 4, chance: 1 } },
        buttons: { leave: { text: _('leave'), nextScene: 'end' } }
      } } });
    });
    await page.locator('#take_cloth').tap();
    await expect(page.locator('#dropMenu')).toBeVisible();
    await page.locator('#no_drop').tap();
    await expect(page.locator('#dropMenu')).toHaveCount(0);
    expect(await page.evaluate(() => Path.outfit.cloth || 0)).toBe(0);
    await page.locator('#take_cloth').tap();
    await page.locator('#drop_torch').tap();
    expect(await page.evaluate(() => Path.outfit.cloth)).toBe(1);
    expect(await page.evaluate(() => Path.outfit.torch || 0)).toBe(0);
    expect(await page.evaluate(() => $('#take_torch').data('numLeft'))).toBe(1);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('two-headed creature and vision event render Chinese titles, story and combat messages', async ({ page }) => {
  const errors = await openExpedition(page);
  await page.evaluate(() => Events.startEvent(Events.Encounters.find(e => e.scenes.start.enemy === 'two-headed creature')));
  await expect(page.locator('#event .eventTitle')).toHaveText('双头怪物');
  await expect(page.locator('#description')).toContainText('较小的头颅不停地颤抖');
  expect(await page.evaluate(() => Events.activeEvent().scenes.start.enemyName)).toBe('双头怪物');
  await page.evaluate(() => { $.fx.off = false; World.getHitChance = () => 1; });
  await page.locator('#attack_fists').click();
  await expect(page.locator('#description')).toContainText('双头怪物的两个头颅都垂了下来。');
  await page.evaluate(() => Events.endEvent());
  await expect(page.locator('#event')).toHaveCount(0);
  await page.evaluate(() => Events.startEvent(Events.Marketing[0]));
  await expect(page.locator('#event .eventTitle')).toHaveText('彭罗斯');
  await expect(page.locator('#description')).toContainText('扭曲的曲线');
  await expect(page.locator('#event')).toContainText('沉入幻象');
  expect(await page.locator('#event').innerText()).not.toMatch(/thrumming|inviting|give in/);
  expect(errors).toEqual([]);
});
