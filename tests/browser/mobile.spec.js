import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' });

async function open(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack));
  await page.route('https://**', route => route.abort());
  await page.goto('/?lang=zh_cn');
  await page.waitForFunction(() => window.MobileUI?.ready && Engine.activeModule === Room);
  await page.evaluate(() => { $SM.set('playStats.audioAlertShown', true); });
  return errors;
}

async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth));
}

async function unlock(page) {
  await page.evaluate(() => {
    $SM.set('game.builder.level', 4);
    $SM.setM('stores', { wood: 10000, fur: 1000, iron: 500, steel: 100,
      compass: 1, 's armour': 1, 'cured meat': 500, 'water tank': 1, convoy: 1 });
    if (!Outside.panel) Outside.init();
    if (!Path.panel) Path.init();
    Room.updateBuildButtons();
  });
}

test('Android entry, responsive room, costs, outfit touch targets and landscape', async ({ page }) => {
  const errors = await open(page);
  await expect(page).toHaveURL(/\?lang=zh_cn$/);
  await expect(page.locator('#lightButton')).toBeVisible();
  expect((await page.locator('#lightButton').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await fits(page);
  await unlock(page);
  await expect(page.locator('#buildBtns .tooltip').first()).toBeVisible();
  await expect(page.locator('#buildBtns')).toHaveCSS('opacity', '1');
  await expect(page.locator('#stores')).toHaveCSS('opacity', '1');
  await fits(page);
  await page.screenshot({ path: 'test-results/mobile-room.png', fullPage: true });
  await page.locator('#location_path').tap();
  await expect(page.locator('#pathPanel')).toBeVisible();
  await expect(page.locator('#roomPanel')).toBeHidden();
  await expect(page.locator('#stores')).toBeVisible();
  const add = page.locator('#outfit_row_cured-meat .upManyBtn');
  expect((await add.boundingBox()).width).toBeGreaterThanOrEqual(44);
  await add.tap();
  expect(await page.evaluate(() => Path.outfit['cured meat'])).toBe(10);
  await fits(page);
  await page.setViewportSize({ width: 800, height: 360 });
  await fits(page);
  await expect(page.locator('#pathPanel')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-landscape.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('map taps move one tile, scrolling does not move, dialog blocks controls and return works', async ({ page }) => {
  const errors = await open(page); await unlock(page);
  await page.evaluate(() => { Engine.travelTo(Path); Path.outfit = { 'cured meat': 20 }; Path.embark(); });
  await expect(page.locator('#worldPanel')).toBeVisible();
  await expect(page.locator('#main')).toBeHidden();
  await fits(page);
  const start = await page.evaluate(() => [...World.curPos]);
  await page.locator('[data-direction=right]').tap();
  expect(await page.evaluate(() => World.curPos)).toEqual([start[0] + 1, start[1]]);
  const beforeScroll = await page.evaluate(() => [...World.curPos]);
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{x: 180, y: 350}] });
  for (const y of [310, 260, 210, 150]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{x: 180, y}] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => World.curPos)).toEqual(beforeScroll);
  await page.evaluate(() => Engine.exportImport());
  await expect(page.locator('#event')).toBeVisible();
  await expect(page.locator('#event')).toHaveCSS('opacity', '1');
  expect(await page.locator('#mobileControls').evaluate(el => el.inert)).toBe(true);
  const bounds = await page.locator('#event').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(360);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
  await page.screenshot({ path: 'test-results/mobile-save-dialog.png', fullPage: true });
  await page.evaluate(() => Events.endEvent());
  await expect(page.locator('#event')).toHaveCount(0);
  await page.evaluate(() => World.goHome());
  await expect(page.locator('#pathPanel')).toBeVisible();
  await expect(page.locator('#worldPanel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('flight uses unchanged stage coordinates and touch hold releases on cancellation', async ({ page }) => {
  const errors = await open(page); await unlock(page);
  await page.evaluate(() => Engine.turnLightsOff());
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(39, 40, 35)');
  await page.evaluate(() => {
    Ship.init(); $SM.set('game.spaceShip.lattice', 3); $SM.set('game.spaceShip.hull', 5);
    Engine.travelTo(Ship); Ship.liftOff();
  });
  await expect(page.locator('#spacePanel')).toBeVisible();
  expect(await page.locator('#spacePanel').evaluate(el => el.offsetWidth)).toBe(700);
  const stage = await page.locator('#spacePanel').boundingBox();
  expect(stage.width).toBeLessThanOrEqual(336);
  await fits(page);
  const right = await page.locator('[data-direction=right]').boundingBox();
  const session = await page.context().newCDPSession(page);
  const x = right.x + right.width / 2, y = right.y + right.height / 2;
  const initial = await page.locator('#ship').evaluate(el => parseFloat(el.style.left));
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await expect.poll(() => page.locator('#ship').evaluate(el => parseFloat(el.style.left))).toBeGreaterThan(initial);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await page.evaluate(() => Space.right)).toBe(false);
  await page.screenshot({ path: 'test-results/mobile-flight-dark.png', fullPage: true });
  await page.setViewportSize({ width: 800, height: 360 });
  await fits(page);
  const controls = await page.locator('#mobileControls').boundingBox();
  expect(controls.y + controls.height).toBeLessThanOrEqual(360);
  await page.screenshot({ path: 'test-results/mobile-flight-landscape.png', fullPage: true });
  await page.evaluate(() => Space.crash());
  await expect(page.locator('#shipPanel')).toBeVisible();
  await expect(page.locator('#spacePanel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('small screens fit workers, fabrication and editable save dialogs', async ({ page }) => {
  const errors = await open(page); await unlock(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    $SM.set('game.population', 20); $SM.set('game.buildings.hut', 5);
    $SM.set('game.workers.hunter', 0); Outside.updateWorkersView(); Engine.travelTo(Outside);
  });
  await page.locator('#workers_row_hunter .upManyBtn').tap();
  expect(await page.evaluate(() => $SM.get('game.workers.hunter'))).toBe(10);
  await fits(page);
  await page.evaluate(() => {
    $SM.setM('stores', { 'alien alloy': 20, crystal: 30, 'energy cell': 10 });
    Fabricator.init(); Engine.travelTo(Fabricator);
  });
  await expect(page.locator('#fabricateButtons .tooltip').first()).toBeVisible();
  await fits(page);
  await page.evaluate(() => Engine.exportImport());
  await page.locator('#event #import').tap();
  await page.locator('#event #yes').tap();
  await page.locator('#description textarea').fill('test save text');
  await page.setViewportSize({ width: 320, height: 350 });
  await expect.poll(async () => {
    const dialog = await page.locator('#event').boundingBox();
    return dialog.y + dialog.height;
  }).toBeLessThanOrEqual(350);
  // Some Android keyboards pan/shrink only visualViewport, not the layout viewport.
  await page.evaluate(() => {
    Object.defineProperty(visualViewport, 'height', { configurable: true, value: 240 });
    Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 30 });
    visualViewport.dispatchEvent(new Event('resize'));
  });
  const keyboardDialog = await page.locator('#event').boundingBox();
  expect(keyboardDialog.y).toBeGreaterThanOrEqual(30);
  expect(keyboardDialog.y + keyboardDialog.height).toBeLessThanOrEqual(270);
  await page.screenshot({ path: 'test-results/mobile-input-viewport.png', fullPage: true });
  await fits(page);
  expect(errors).toEqual([]);
});

test('mobile ending removes movement controls and fits the final story and score', async ({ page }) => {
  const errors = await open(page); await unlock(page);
  await page.clock.install();
  await page.evaluate(() => {
    $.fx.off = true; Ship.init(); $SM.set('stores["fleet beacon"]', 1);
    $SM.setM('game.spaceShip', { hull: 3, lattice: 3 });
    Space.done = false; Engine.setActiveModule(Space);
    $('<div id="starsContainer">').appendTo('body'); Space.endGame();
  });
  await page.clock.runFor(25000);
  await expect(page.locator('.outroContainer')).toContainText('流浪者母舰队');
  await expect(page.locator('#mobileControls')).toBeHidden();
  await fits(page);
  await page.locator('#wait-btn').tap(); await page.clock.runFor(3500);
  await expect(page.locator('.centerCont')).toBeVisible();
  await fits(page);
  expect(errors).toEqual([]);
});

test('desktop resize restores the shared stores to their desktop parent', async ({ page }) => {
  await open(page);
  // Simulate a desktop window entering and leaving compact layout.
  await page.evaluate(() => { MobileUI.touchDevice = false; });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('html')).not.toHaveClass(/mobile/);
  expect(await page.locator('#storesContainer').evaluate(el => el.parentElement.id)).toBe('roomPanel');
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('html')).toHaveClass(/mobile/);
  expect(await page.locator('#storesContainer').evaluate(el => el.parentElement.id)).toBe('mobileStores');
});

test('Simplified Chinese renders fabrication, blueprints, battle text and touch labels', async ({ page }) => {
  const errors = await open(page); await unlock(page);
  await expect(page.locator('#mobileLanguage')).toHaveAttribute('aria-label', '语言');
  await expect(page.locator('.volume')).toHaveText('开启声音');
  await page.evaluate(() => {
    $SM.setM('stores', { 'alien alloy': 20, crystal: 30, 'energy cell': 10, 'kinetic armour': 1 });
    $SM.set('character.blueprints', { hypo: true, 'plasma rifle': true });
    Fabricator.init(); Engine.travelTo(Fabricator);
  });
  await expect(page.locator('#location_fabricator')).toHaveText('嗡鸣制造台');
  await expect(page.locator('#fabricateButtons')).toHaveAttribute('data-legend', '制造：');
  await expect(page.locator('[fabricateThing="energy blade"]')).toContainText('能量刃');
  await expect(page.locator('[fabricateThing="hypo"]')).toContainText('治疗针剂');
  await expect(page.locator('#blueprints')).toContainText('等离子步枪');
  await expect(page.locator('#notifications')).not.toContainText('。.');
  expect(await page.evaluate(() => _('hypo blueprint'))).toBe('治疗针剂蓝图');
  expect(await page.evaluate(() => _('not enough {0}', _('crystal')))).toBe('晶体不足');
  await expect(page.locator('#fabricateButtons')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/mobile-fabricator-zh.png', fullPage: true });
  await page.evaluate(() => {
    Engine.travelTo(Path); Path.outfit = { 'cured meat': 20, hypo: 1, stim: 1, 'energy cell': 2 };
    Path.embark();
    Events.startEvent(Events.Executioner['executioner-intro']);
  });
  await expect(page.locator('.eventTitle')).toHaveText('残破战舰');
  await expect(page.locator('#description')).toContainText('沉默而封闭的城市');
  await page.evaluate(() => Events.endEvent());
  await expect(page.locator('#event')).toHaveCount(0);
  await page.evaluate(() => Events.startEvent({ title: _('A Ravaged Battleship'), scenes: { start: {
    ...Enemies.Executioner.guard, health: 1000, attackDelay: 100000, loot: {}, nextScene: 'end'
  } } }));
  // Combat deliberately draws ASCII characters; enemy names live in encounter data.
  await expect(page.locator('#enemy .label')).toHaveText('G');
  expect(await page.evaluate(() => Enemies.Executioner.guard.enemyName)).toBe('机械守卫');
  const hp = page.locator('#enemy .hp');
  await expect(hp).toHaveCSS('white-space', 'nowrap');
  await expect(page.locator('#hypo')).toContainText('注射治疗针剂');
  await expect(page.locator('#shld')).toContainText('护盾');
  await expect(page.locator('#use-stim')).toContainText('强化');
  await expect(page.locator('[data-direction=right]')).toHaveAttribute('aria-label', '向右');
  await expect(page.locator('#event')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/mobile-combat-zh.png', fullPage: true });
  await fits(page);
  expect(errors).toEqual([]);
});
