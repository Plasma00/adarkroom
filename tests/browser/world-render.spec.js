import fs from 'node:fs';
import { test, expect } from '@playwright/test';

async function openWorld(page) {
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

test('unchanged maps do no DOM work and moving reuses grid and legend nodes', async ({ page }) => {
  const errors = await openWorld(page);
  const result = await page.evaluate(() => {
    for (let x = -World.RADIUS; x <= World.RADIUS; x++) {
      for (let y = -World.RADIUS; y <= World.RADIUS; y++) World.setMask(World.state.mask, x, y, true);
    }
    World.drawMap();
    const map = document.querySelector('#map'), cells = [...map.querySelectorAll('.mapCell')];
    const legend = [...document.querySelectorAll('#mapLegend li')];
    const html = cells.map(cell => cell.innerHTML);
    const observer = new MutationObserver(() => {});
    observer.observe(map, { childList: true, subtree: true, attributes: true, characterData: true });
    World.drawMap();
    const unchangedMutations = observer.takeRecords().length;
    World.curPos = [1, 0]; World.drawMap();
    const mutations = observer.takeRecords(); observer.disconnect();
    const nextCells = [...map.querySelectorAll('.mapCell')];
    const nextLegend = [...document.querySelectorAll('#mapLegend li')];
    return {
      unchangedMutations,
      gridReused: cells.every((cell, i) => cell === nextCells[i]),
      legendReused: legend.every((row, i) => row === nextLegend[i]),
      changedCells: cells.filter((cell, i) => cell.innerHTML !== html[i]).length,
      replacedGrid: mutations.some(record => record.target === map),
      playerCount: cells.filter(cell => cell.textContent.includes('@')).length
    };
  });
  expect(result).toEqual({ unchangedMutations: 0, gridReused: true, legendReused: true,
    changedCells: 2, replacedGrid: false, playerCount: 1 });
  expect(errors).toEqual([]);
});

test('cached cells follow fog rollback, visited sites, outpost usage and grid replacement', async ({ page }) => {
  const errors = await openWorld(page);
  const result = await page.evaluate(() => {
    const cellAt = (x, y) => {
      const view = World.getMapView();
      return document.querySelectorAll('#map > .mapCell')[(y - view.min) * view.size + x - view.min];
    };
    World.state.mapViewSize = 30;
    World.setTile(World.state.map, 1, 0, World.TILE.WAREHOUSE);
    World.setMask(World.state.mask, 1, 0, true); World.drawMap();
    const warehouse = cellAt(1, 0);
    const firstLabel = warehouse.textContent;
    World.markVisited(1, 0); World.drawMap();
    const visited = warehouse.textContent === 'G' && !warehouse.querySelector('.landmark');
    World.setTile(World.state.map, 1, 0, World.TILE.OUTPOST); World.drawMap();
    const unusedOutpost = !!warehouse.querySelector('.landmark');
    World.usedOutposts['1,0'] = true; World.drawMap();
    const usedOutpost = warehouse.textContent === 'P' && !warehouse.querySelector('.landmark');
    // A new expedition can roll back fog while retaining the same grid size.
    World.state = { ...World.state, mask: World.newMask(), discoveredSymbols: {} };
    World.drawMap();
    const fogRestored = cellAt(1, 0) === warehouse && warehouse.textContent.trim() === '';
    const legendRolledBack = !document.querySelector('#mapLegend [data-symbol="G"]');
    World.setMask(World.state.mask, World.RADIUS, World.RADIUS, true); World.drawMap();
    const grew = document.querySelectorAll('#map > .mapCell').length === 91 * 91 && !warehouse.isConnected;
    const oldMap = document.querySelector('#map'); oldMap.remove(); World.drawMap();
    const recreated = document.querySelector('#map') !== oldMap && cellAt(0, 0).textContent.includes('@');
    return { firstLabel, visited, unusedOutpost, usedOutpost, fogRestored, legendRolledBack, grew, recreated };
  });
  expect(result.firstLabel).toContain('仓库');
  for (const [key, value] of Object.entries(result)) if (key !== 'firstLabel') expect(value, key).toBe(true);
  expect(errors).toEqual([]);
});
