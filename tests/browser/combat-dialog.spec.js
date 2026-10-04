import fs from 'node:fs';
import { test, expect } from '@playwright/test';

for (const width of [1280, 360]) {
  test(`combat opens without disabling the map tree while background input stays blocked (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack));
    await page.route('https://**', route => route.abort());
    const save = Buffer.from(fs.readFileSync('doc/test-saves/compass-all-perks.txt', 'utf8').trim(), 'base64').toString('utf8');
    await page.addInitScript(save => { localStorage.gameState = save; }, save);
    await page.goto('/?lang=zh_cn');
    await page.waitForFunction(() => window.Path?.panel && window.MobileUI?.ready);
    await page.evaluate(() => {
      $.fx.off = true; Engine.travelTo(Path); Path.embark(); $.fx.off = false;
      World.setMask(World.state.mask, World.RADIUS, World.RADIUS, true); World.drawMap();
      document.querySelector('.logo').focus({ preventScroll: true });
    });
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => Events.startEvent({ ...Events.Encounters[0], scenes: { start: {
        ...Events.Encounters[0].scenes.start, health: 200, attackDelay: 10000
      } } }));
      await expect(page.locator('#event')).toHaveAttribute('role', 'dialog');
      await expect(page.locator('#event')).toHaveAttribute('aria-modal', 'true');
      await expect(page.locator('#event')).toBeFocused();
      await expect(page.locator('#content')).toHaveAttribute('aria-hidden', 'true');
      expect(await page.locator('#content').evaluate(el => el.inert)).toBe(false);
      for (const selector of ['#main', '#mobileControls', '.menu', '.logo']) {
        expect(await page.locator(selector).evaluate(el => el.inert), selector).toBe(true);
      }
      const position = await page.evaluate(() => [...World.curPos]);
      await page.keyboard.press('ArrowRight');
      await page.locator('#map').evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 1000, clientY: 300 })));
      await page.locator('.logo').evaluate(el => el.focus());
      await expect(page.locator('#event')).toBeFocused();
      expect(await page.evaluate(() => World.curPos)).toEqual(position);
      await page.evaluate(() => { World.getHitChance = () => 1; });
      await page.locator('#attack_fists').click();
      await expect.poll(() => page.evaluate(() => $('#enemy').data('hp'))).toBeLessThan(200);
      if (i === 0) await page.screenshot({ path: `test-results/combat-dialog-${width}.png`, fullPage: true });
      await page.evaluate(() => Events.endEvent());
      await expect(page.locator('#event')).toHaveCount(0);
      await expect(page.locator('#content')).not.toHaveAttribute('aria-hidden', 'true');
      expect(await page.locator('.menu').evaluate(el => el.inert)).toBe(false);
      await expect(page.locator('.logo')).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}
