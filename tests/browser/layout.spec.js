import { test, expect } from '@playwright/test';

async function open(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack));
  await page.route('https://**', route => route.abort());
  await page.goto('/?lang=zh_cn');
  await page.waitForFunction(() => window.MobileUI?.ready && Engine.activeModule === Room);
  await page.evaluate(() => {
    $.fx.off = true;
    $SM.set('playStats.audioAlertShown', true);
    const stores = {};
    ('wood fur meat teeth scales leather iron steel coal sulphur bait torch bullets crystal rifle cloth medicine charm|laser rifle|energy cell|cured meat|bone spear|iron sword|steel sword|alien alloy|lattice shard|plasma rifle|energy blade|kinetic armour|disruptor|grenade|bolas|hypo|stim|compass|convoy|water tank|s armour').split('|').forEach((item, index) => {
      (index === 0 ? item.split(' ') : [item]).forEach(key => stores[key] = 100000);
    });
    $SM.setM('stores', stores);
    $SM.set('character.perks', { stealthy: true, evasive: true, boxer: true,
      'martial artist': true, 'unarmed master': true, 'slow metabolism': true, 'desert rat': true });
    if (!Outside.panel) Outside.init();
    if (!Path.panel) Path.init();
    Engine.travelTo(Path);
    Room.updateStoresView();
  });
  return errors;
}

async function insideContent(page, selector) {
  await expect.poll(() => page.evaluate(selector => {
    return document.querySelector('#content').getBoundingClientRect().bottom -
      document.querySelector(selector).getBoundingClientRect().bottom;
  }, selector)).toBeGreaterThanOrEqual(0);
}

test('crystal stays home and etched energy-cell batches can be manufactured and packed on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const errors = await open(page);
  await page.evaluate(() => {
    Path.outfit = { crystal: 4, 'cured meat': 2 };
    $SM.set('outfit', { ...Path.outfit });
    Path.updateOutfitting();
  });
  await expect(page.locator('#outfit_row_crystal')).toHaveCount(0);
  expect(await page.evaluate(() => Path.outfit.crystal)).toBeUndefined();
  expect(await page.evaluate(() => $SM.get('stores.crystal'))).toBe(100000);
  expect(await page.evaluate(() => Path.getFreeSpace())).toBe(68);
  await page.evaluate(() => {
    $SM.setM('stores', { crystal: 50, steel: 50, sulphur: 20, 'energy cell': 0 });
    Fabricator.init(); Engine.travelTo(Fabricator);
  });
  const button = page.locator('[fabricateThing="energy cell"]');
  await expect(button).toHaveCount(0);
  await page.evaluate(() => $SM.set('features.industry.etching', true));
  await expect(button).toContainText('能量元件 (x25)');
  await expect(button.locator('.tooltip')).toContainText('晶体');
  await expect(button.locator('.tooltip')).toContainText('硫磺');
  await button.click();
  expect(await page.evaluate(() => $SM.get('stores["energy cell"]'))).toBe(25);
  await expect(page.locator('#notifications')).toContainText('二十五个能量元件亮了起来');
  await page.screenshot({ path: 'test-results/energy-cell-recipe-mobile.png', fullPage: true });
  await button.click();
  expect(await page.evaluate(() => $SM.get('stores["energy cell"]'))).toBe(50);
  await button.click();
  expect(await page.evaluate(() => $SM.get('stores["energy cell"]'))).toBe(50);
  await page.evaluate(() => Engine.travelTo(Path));
  await expect(page.locator('#outfit_supplies #outfit_row_energy-cell')).toHaveCount(1);
  await page.locator('#outfit_row_energy-cell .upManyBtn').click();
  expect(await page.evaluate(() => Path.outfit['energy cell'])).toBe(10);
  await expect(page.locator('#outfit_row_crystal')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  expect(errors).toEqual([]);
});

test('short desktop viewport scrolls to all inventory and keeps dialogs onscreen', async ({ page }) => {
  await page.setViewportSize({ width: 1008, height: 539 });
  const errors = await open(page);
  await expect(page.locator('html')).not.toHaveClass(/mobile/);
  await insideContent(page, '#storesContainer');
  await insideContent(page, '#embarkButton');
  expect(await page.locator('#content').evaluate(el => el.offsetHeight)).toBeGreaterThan(700);
  await page.locator('#stores > div').last().scrollIntoViewIfNeeded();
  await expect(page.locator('#stores > div').last()).toBeInViewport();
  await page.screenshot({ path: 'test-results/desktop-inventory-full.png', fullPage: true });
  await page.evaluate(() => Engine.exportImport());
  await expect(page.locator('#event')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#eventBackdrop')).toBeVisible();
  await page.evaluate(() => Events.endEvent());
  await page.evaluate(() => { Engine.travelTo(Room); });
  await insideContent(page, '#storesContainer');
  expect(errors).toEqual([]);
});

test('desktop map has a reachable Chinese legend and resizes without revealing fog', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => { Path.outfit = { 'cured meat': 20 }; Path.embark(); });
  await expect(page.locator('#mapLegendTitle')).toHaveText('地图图例');
  for (const symbol of ['K', 'E', 'D', 'R', 'T']) {
    const row = page.locator('#mapLegend li[data-symbol="' + symbol + '"]');
    await expect(row).toHaveCount(0);
    await page.evaluate(symbol => {
      const pos = World.mapSearch(symbol, World.state.map, 1)[0];
      World.setMask(World.state.mask, pos.x, pos.y, true);
      World.drawMap();
    }, symbol);
    await expect(row.locator('span').nth(1)).toContainText(/[\u4e00-\u9fff]/);
    await expect(row.locator('span')).toHaveCount(2);
  }
  const mask = await page.evaluate(() => JSON.stringify(World.state.mask));
  await insideContent(page, '#mapLegend');
  await page.locator('#mapLegend li').last().scrollIntoViewIfNeeded();
  await expect(page.locator('#mapLegend li').last()).toBeInViewport();
  await page.screenshot({ path: 'test-results/desktop-map-legend.png', fullPage: true });
  const height = await page.locator('#content').evaluate(el => el.offsetHeight);
  await page.evaluate(() => { for (let i = 0; i < 20; i++) Engine.updateLayout(); });
  expect(await page.locator('#content').evaluate(el => el.offsetHeight)).toBe(height);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.locator('html')).toHaveClass(/mobile/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(await page.locator('#mobileControls').evaluate(el => el.nextElementSibling.id)).toBe('mapLegend');
  await page.locator('#mapLegend li').last().scrollIntoViewIfNeeded();
  await expect(page.locator('#mapLegend li').last()).toBeInViewport();
  await page.screenshot({ path: 'test-results/mobile-map-legend.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await insideContent(page, '#mapLegend');
  expect(await page.evaluate(() => JSON.stringify(World.state.mask))).toBe(mask);
  await page.evaluate(() => World.goHome());
  await insideContent(page, '#storesContainer');
  await insideContent(page, '#embarkButton');
  expect(errors).toEqual([]);
});

for (const width of [1008, 360]) {
  test(`dark dialogs and grouped outfitting at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const errors = await open(page);
    await page.evaluate(() => Engine.turnLightsOff());
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(39, 40, 35)');
    await expect(page.locator('#outfitting .outfitGroup h3')).toHaveText(['武器', '补给', '功能性装备']);
    await expect(page.locator('#outfit_weapons #outfit_row_plasma-rifle')).toHaveCount(1);
    await expect(page.locator('#outfit_supplies #outfit_row_energy-cell')).toHaveCount(1);
    await expect(page.locator('#outfit_supplies #waterRow')).toHaveCount(1);
    await expect(page.locator('#outfit_utility #outfit_row_torch')).toHaveCount(1);
    await expect(page.locator('#outfit_utility #armourRow')).toHaveCount(1);
    const before = await page.evaluate(() => Path.outfit['cured meat'] || 0);
    await page.locator('#outfit_row_cured-meat .upBtn').click();
    expect(await page.evaluate(() => Path.outfit['cured meat'])).toBe(before + 1);
    await page.evaluate(() => { Path.updateOutfitting(); Path.updateOutfitting(); });
    await expect(page.locator('#outfit_row_cured-meat')).toHaveCount(1);
    await page.screenshot({ path: `test-results/outfit-dark-${width}.png`, fullPage: true });
    await page.evaluate(() => Engine.exportImport());
    await expect(page.locator('#event')).toHaveCSS('background-color', 'rgb(39, 40, 35)');
    await expect(page.locator('#description')).toHaveCSS('color', 'rgb(238, 238, 238)');
    await page.locator('#event #import').click();
    await page.locator('#event #yes').click();
    await expect(page.locator('#event textarea')).toHaveCSS('background-color', 'rgb(23, 24, 19)');
    await page.screenshot({ path: `test-results/dialog-dark-${width}.png`, fullPage: true });
    await page.evaluate(() => { $('body').addClass('noMask'); });
    await expect(page.locator('#event')).toHaveCSS('background-color', 'rgb(39, 40, 35)');
    await expect(page.locator('#description')).toHaveCSS('color', 'rgb(238, 238, 238)');
    await page.evaluate(() => { $('body').removeClass('noMask'); Engine.turnLightsOff(); });
    await expect(page.locator('#event')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(errors).toEqual([]);
  });
}
