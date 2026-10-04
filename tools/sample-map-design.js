// Read-only simulation: overrides the game model in an isolated test context.
// Run from the project root: node tools/sample-map-design.js [sampleCount]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { game } from '../tests/helpers/game.js';

const samples = Number(process.argv[2] || 1000);
assert.ok(Number.isInteger(samples) && samples > 0);
const output = 'projectdev/decide-design-260914-map';
fs.mkdirSync(output, { recursive: true });
const proposal = {
  I: [1, 5, 5], C: [1, 10, 10], S: [1, 20, 20],
  H: [10, 3, 20], V: [10, 3, 20], O: [15, 10, 25], Y: [20, 20, 40],
  Z: [20, 35, 60], W: [1, 35, 35], B: [20, 35, 60], F: [20, 35, 60],
  M: [1, 15, 35], X: [1, 50, 50], K: [1, 25, 25], E: [1, 30, 30],
  D: [1, 35, 35], R: [1, 40, 40], T: [1, 45, 45], P: [0, 0, 0]
};
const bands = [[0, 19], [20, 29], [30, 34], [35, 44], [45, 49], [50, 54], [55, 60]];
const cells = [];
for (let x = -30; x <= 30; x++) for (let y = -30; y <= 30; y++) {
  const d = Math.abs(x) + Math.abs(y);
  cells.push({ x, y, d, band: bands.findIndex(([a, b]) => d >= a && d <= b) });
}
const area = bands.map((_, i) => cells.filter(c => c.band === i).length);
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const summarize = values => ({ mean: values.reduce((a, b) => a + b, 0) / values.length,
  min: Math.min(...values), p05: percentile(values, .05), median: percentile(values, .5),
  p95: percentile(values, .95), max: Math.max(...values) });
const results = [];
for (const variant of ['current', 'proposed', 'proposed-inclusive', 'proposed-cache1', 'proposed-cache5']) {
  const g = game(), w = g.World;
  w.init();
  if (variant !== 'current') {
    w.LANDMARKS = Object.fromEntries(Object.entries(proposal).map(([symbol, [num, minRadius, maxRadius]]) =>
      [symbol, { num, minRadius, maxRadius }]));
    if (variant.endsWith('cache1') || variant.endsWith('cache5')) {
      w.LANDMARKS.U = { num: variant.endsWith('cache5') ? 5 : 1, minRadius: 55, maxRadius: 60 };
    }
  }
  const expected = Object.fromEntries(Object.entries(w.LANDMARKS).map(([symbol, l]) => [symbol, l.num]));
  const rawPlace = w.placeLandmark;
  let calls = 0, fallbacks = 0, attempts = 0, maxAttempts = 0;
  w.placeLandmark = (min, max, symbol, map) => {
    const before = calls;
    // This diagnostic variant includes the upper endpoint without editing source.
    const pos = rawPlace(min, max + (variant === 'proposed-inclusive' && max > min ? 1 : 0), symbol, map);
    const used = calls - before, retries = Math.floor(used / 4);
    attempts += retries; maxAttempts = Math.max(maxAttempts, retries);
    if (used % 4 === 1) fallbacks++;
    return pos;
  };
  const bandCounts = bands.map(() => []), heat = new Uint32Array(3721);
  const nearestMax = [], nearestMean = [], coverage3 = [], coverage5 = [], cornerCounts = [];
  const outerCounts = [], tipsCounts = [], adjacentPairs = [];
  let anyEmptyCorner = 0, anyEmptyTip = 0, endpoints = 0;
  let example;
  for (let seed = 1; seed <= samples; seed++) {
    let state = seed;
    g.Math.random = () => { calls++; state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
    const map = w.generateMap(), counts = {}, bins = bands.map(() => 0), points = [];
    const corners = [0, 0, 0, 0], tips = [0, 0, 0, 0];
    const distance = new Int16Array(3721).fill(-1), queue = new Int32Array(3721);
    let tail = 0;
    for (const [index, c] of cells.entries()) {
      const tile = w.getTile(map, c.x, c.y);
      if (tile === 'A' || !w.isTerrain(tile)) { distance[index] = 0; queue[tail++] = index; }
      if (tile === 'A' || w.isTerrain(tile)) continue;
      assert.ok(expected[tile] !== undefined, `Unexpected ${tile}`);
      counts[tile] = (counts[tile] || 0) + 1;
      const rule = w.LANDMARKS[tile];
      assert.ok(c.d >= rule.minRadius && c.d <= rule.maxRadius);
      bins[c.band]++; heat[index]++;
      points.push({ ...c, symbol: tile });
      const quadrant = (c.x < 0 ? 0 : 1) + (c.y < 0 ? 0 : 2);
      if (c.d >= 45) corners[quadrant]++;
      if (c.d >= 55) tips[quadrant]++;
      if (c.d === 60) endpoints++;
    }
    for (const [tile, n] of Object.entries(expected)) assert.equal(counts[tile] || 0, n);
    for (let i = 0; i < bins.length; i++) bandCounts[i].push(bins[i]);
    if (corners.some(n => !n)) anyEmptyCorner++;
    if (tips.some(n => !n)) anyEmptyTip++;
    cornerCounts.push(...corners); outerCounts.push(corners.reduce((a, b) => a + b));
    tipsCounts.push(tips.reduce((a, b) => a + b));
    let adjacent = 0;
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      if (Math.abs(points[i].x - points[j].x) + Math.abs(points[i].y - points[j].y) === 1) adjacent++;
    }
    adjacentPairs.push(adjacent);
    // Multi-source BFS measures distance from each cell to any landmark or village;
    // it is a geometric coverage metric, not safe routes or resource reachability.
    for (let head = 0; head < tail; head++) {
      const index = queue[head], x = Math.floor(index / 61), y = index % 61;
      const neighbors = [];
      if (x > 0) neighbors.push(index - 61); if (x < 60) neighbors.push(index + 61);
      if (y > 0) neighbors.push(index - 1); if (y < 60) neighbors.push(index + 1);
      for (const n of neighbors) if (distance[n] < 0) { distance[n] = distance[index] + 1; queue[tail++] = n; }
    }
    assert.equal(tail, 3721);
    nearestMax.push(Math.max(...distance));
    nearestMean.push(distance.reduce((a, b) => a + b, 0) / 3721);
    coverage3.push(distance.filter(d => d <= 3).length / 3721);
    coverage5.push(distance.filter(d => d <= 5).length / 3721);
    if (seed === 1) example = points;
  }
  const total = Object.values(expected).reduce((a, b) => a + b, 0);
  const result = { variant, samples, random: 'LCG 1664525/1013904223, seeds 1..N', expected, total,
    bands: bands.map(([minDistance, maxDistance], i) => ({ minDistance, maxDistance, area: area[i], ...summarize(bandCounts[i]),
      per100Cells: summarize(bandCounts[i]).mean * 100 / area[i] })),
    nearestMean: summarize(nearestMean), nearestMax: summarize(nearestMax),
    coverage3: summarize(coverage3), coverage5: summarize(coverage5),
    corners: summarize(cornerCounts), outer: summarize(outerCounts), tips: summarize(tipsCounts),
    anyEmptyCornerRate: anyEmptyCorner / samples, anyEmptyTipRate: anyEmptyTip / samples,
    exactCornerLandmarksPerMap: endpoints / samples, adjacentPairs: summarize(adjacentPairs),
    placement: { fallbackCount: fallbacks, meanAttempts: attempts / (samples * total), maxAttempts },
    heat: [...heat], example };
  results.push(result);
  console.log(JSON.stringify({ ...result, heat: undefined, example: undefined }));
}
fs.writeFileSync(`${output}/results.json`, JSON.stringify({ samples, proposal, results }, null, 2) + '\n');

// A fixed-seed diagram is illustrative; aggregate statistics above drive conclusions.
const views = [results[0], results[1]], scale = 6, size = 366;
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="850" height="460" viewBox="0 0 850 460"><rect width="850" height="460" fill="#242720"/>';
for (const [i, result] of views.entries()) {
  const left = 35 + i * 425, top = 60;
  svg += `<text x="${left}" y="32" fill="#eee" font-family="sans-serif" font-size="18">${i ? 'Proposed: 126 landmarks' : 'Current: 71 landmarks'}</text>`;
  svg += `<rect x="${left}" y="${top}" width="${size}" height="${size}" fill="none" stroke="#92988e"/>`;
  for (const d of [20, 35, 45, 55]) {
    const ring = cells.filter(c => c.d === d);
    for (const c of ring) svg += `<rect x="${left + (c.x + 30) * scale}" y="${top + (c.y + 30) * scale}" width="6" height="6" fill="#373d32"/>`;
  }
  svg += `<text x="${left + 30 * scale}" y="${top + 31 * scale}" fill="#fff" font-size="10" font-family="monospace">A</text>`;
  for (const p of result.example) svg += `<text x="${left + (p.x + 30) * scale}" y="${top + (p.y + 31) * scale}" fill="${p.symbol === 'Z' ? '#f3b964' : p.d >= 45 ? '#a4cfef' : '#d4dec3'}" font-size="8" font-family="monospace">${p.symbol}</text>`;
}
svg += '<text x="35" y="450" fill="#bbc0b4" font-size="12" font-family="sans-serif">Seed 1 | Manhattan distance bands: 20 / 35 / 45 / 55 | Z = proposed military fortress</text></svg>';
fs.writeFileSync(`${output}/comparison.svg`, svg);
