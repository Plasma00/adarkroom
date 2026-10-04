// Isolated browser profile; never reads or replaces the player's browser save.
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
    $.fx.off = true; Engine.travelTo(Path); Path.embark();
    // Isolate movement/rendering from random encounters, sounds and survival timers.
    World.doSpace = World.checkDanger = World.narrateMove = AudioEngine.playSound = () => {};
  });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const results = [];
  for (const size of [30, 61]) {
    results.push(await page.evaluate(async size => {
      World.curPos = [0, 0]; World.state.mask = World.newMask();
      World.state.mapViewSize = size;
      if (size === 61) {
        for (let x = -World.RADIUS; x <= World.RADIUS; x++) {
          for (let y = -World.RADIUS; y <= World.RADIUS; y++) World.setMask(World.state.mask, x, y, true);
        }
      }
      World.drawMap(); await new Promise(requestAnimationFrame);
      let added = 0, removed = 0;
      const observer = new MutationObserver(records => {
        for (const record of records) { added += record.addedNodes.length; removed += record.removedNodes.length; }
      });
      observer.observe(document.querySelector('#map'), { childList: true, subtree: true });
      const durations = [];
      for (let i = 0; i < 24; i++) {
        await new Promise(requestAnimationFrame);
        const start = performance.now();
        World.move(i % 2 ? [-1, 0] : [1, 0]);
        // Include the style/layout work required before the changed map can be displayed.
        document.querySelector('#map').getBoundingClientRect();
        durations.push(performance.now() - start);
      }
      await new Promise(requestAnimationFrame); observer.disconnect();
      durations.sort((a, b) => a - b);
      return { size, moves: durations.length, cpuSlowdown: 4,
        medianMs: +durations[Math.floor(durations.length / 2)].toFixed(2),
        p95Ms: +durations[Math.floor(durations.length * 0.95)].toFixed(2),
        addedNodes: added, removedNodes: removed };
    }, size));
  }
  const output = JSON.stringify(results, null, 2);
  console.log(output);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], output + '\n');
} finally { await browser.close(); }
