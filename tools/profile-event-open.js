// Measure real combat-dialog rendering in an isolated browser, not the player's save.
import fs from 'node:fs';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('https://**', route => route.abort());
  const save = Buffer.from(fs.readFileSync('doc/test-saves/compass-all-perks.txt', 'utf8').trim(), 'base64').toString('utf8');
  await page.addInitScript(save => { localStorage.gameState = save; }, save);
  await page.goto('http://127.0.0.1:8080/?lang=zh_cn');
  await page.waitForFunction(() => window.Path?.panel && window.MobileUI?.ready);
  await page.evaluate(() => {
    $.fx.off = true; Engine.travelTo(Path); Path.embark(); $.fx.off = false;
    for (let x = -World.RADIUS; x <= World.RADIUS; x++) {
      for (let y = -World.RADIUS; y <= World.RADIUS; y++) World.setMask(World.state.mask, x, y, true);
    }
    World.drawMap();
  });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const results = [];
  const variants = process.argv.includes('--diagnose') ? ['normal', 'contain', 'stableScrollbar', 'noInert', 'noAnimation', 'scopedInert'] : ['normal'];
  for (const variant of variants) {
    results.push(await page.evaluate(async variant => {
      const originalSync = MobileUI.syncDialog;
      let style;
      if (variant === 'contain' || variant === 'stableScrollbar') {
        style = document.createElement('style');
        style.textContent = variant === 'contain' ? '#map {contain: layout paint style;}' : 'html {scrollbar-gutter: stable;}';
        document.head.append(style);
      }
      if (variant === 'noInert') MobileUI.syncDialog = () => {
        document.documentElement.classList.toggle('event-open', !!Events.activeEvent());
      };
      if (variant === 'scopedInert') MobileUI.syncDialog = () => {
        const open = !!Events.activeEvent();
        document.documentElement.classList.toggle('event-open', open);
        $('#main, #spacePanel, #mobileControls, .menu, .logo').each(function() { this.inert = open; });
        if (open) $('#content').attr('aria-hidden', 'true'); else $('#content').removeAttr('aria-hidden');
      };
      if (variant === 'noAnimation') $.fx.off = true;
      const opening = [], frameGaps = [];
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame);
        const start = performance.now();
        Events.startEvent({ ...Events.Encounters[0], scenes: { start: {
          ...Events.Encounters[0].scenes.start, attackDelay: 10000
        } } });
        await Promise.resolve();
        document.querySelector('#event').getBoundingClientRect();
        opening.push(performance.now() - start);
        await new Promise(requestAnimationFrame);
        frameGaps.push(performance.now() - start);
        await new Promise(resolve => setTimeout(resolve, 250));
        Events.endEvent();
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      MobileUI.syncDialog = originalSync; $.fx.off = false; style?.remove();
      opening.sort((a,b) => a-b); frameGaps.sort((a,b) => a-b);
      return { variant, cpuSlowdown: 4, medianOpenMs: +opening[3].toFixed(2),
        maxOpenMs: +opening[5].toFixed(2), medianNextFrameMs: +frameGaps[3].toFixed(2) };
    }, variant));
  }
  console.log(JSON.stringify(results, null, 2));
  if (process.argv[2] && !process.argv[2].startsWith('--')) fs.writeFileSync(process.argv[2], JSON.stringify(results, null, 2) + '\n');
} finally { await browser.close(); }
