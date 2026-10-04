// Small deterministic sample of the actual game generator, without browser storage.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { game } from '../tests/helpers/game.js';

const plan = JSON.parse(fs.readFileSync('doc/map-radius45-uniform-plan.json', 'utf8'));
const samples = Number(process.env.MAP_SAMPLES || 50);
assert(Number.isInteger(samples) && samples > 0);
const scenarios = [0, 1, 2, 3, 4, 5];
const bands = Array.from({length: 9}, (_, i) => ({min: i*10+1, max: i*10+10, cells: 0, count: 0}));
for (let x=-45; x<=45; x++) for (let y=-45; y<=45; y++) {
  const d=Math.abs(x)+Math.abs(y);
  if(d) bands[Math.floor((d-1)/10)].cells++;
}
let minSeparation=Infinity, minOuterSeparation=Infinity, maxQuadrantSpread=0, maxAttempts=0;
const firstWorldCount=plan.landmarks.reduce((n,s)=>n+(s.symbol==='A'?0:s.count),0);
const quadrants=[0,0,0,0];
const start=performance.now();
for (const caches of scenarios) for(let seed=1; seed<=samples; seed++) {
  const g=game(); let rng=seed*7919+caches*104729;
  g.Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
  if(caches) g.$SM.set('previous.caches', Array.from({length:caches},()=>({stores:{wood:1}})));
  g.World.init(); const w=g.World, map=g.State.game.world.map, all=[];
  maxAttempts=Math.max(maxAttempts,w.mapGenerationAttempts);
  assert.equal(w.RADIUS,45);
  for(const site of plan.landmarks) {
    if(site.symbol==='A') continue;
    const positions=w.mapSearch(site.symbol,map), count=site.symbol==='U'?caches:site.count;
    assert.equal(positions.length,count,`${seed}: ${site.symbol} count`);
    const perQuadrant=[0,0,0,0];
    for(const {x,y} of positions) {
      const d=Math.abs(x)+Math.abs(y), q=w.landmarkQuadrant(x,y);
      assert(d>=site.min && d<=site.max,`${seed}: ${site.symbol} distance ${d}`);
      all.push([x,y]); perQuadrant[q]++;
      if(!caches) { bands[Math.floor((d-1)/10)].count++; quadrants[q]++; }
    }
    if(count>=4) assert(Math.max(...perQuadrant)-Math.min(...perQuadrant)<=1);
  }
  assert.equal(all.length,firstWorldCount+caches);
  if(!caches) {
    const perQuadrant=[0,0,0,0];
    for(const [x,y] of all) perQuadrant[w.landmarkQuadrant(x,y)]++;
    maxQuadrantSpread=Math.max(maxQuadrantSpread,Math.max(...perQuadrant)-Math.min(...perQuadrant));
  }
  all.push([0,0]);
  for(let i=0;i<all.length;i++) for(let j=0;j<i;j++) {
    const d=Math.abs(all[i][0]-all[j][0])+Math.abs(all[i][1]-all[j][1]);
    const inner=[all[i],all[j]].every(([x,y])=>Math.abs(x)+Math.abs(y)<=10);
    assert(d>=(inner?3:5),`${seed}: spacing ${d}`); minSeparation=Math.min(minSeparation,d);
    if(!inner) minOuterSeparation=Math.min(minOuterSeparation,d);
  }
  if(seed%25===0) console.log(`caches=${caches}: ${seed}/${samples} maps passed`);
}
const meanDensity=firstWorldCount/8280*100;
for(const b of bands) { b.mean=b.count/samples; b.per100Cells=b.mean/b.cells*100; delete b.count; }
// Fixed mines deliberately add early progression sites. Assess bulk area uniformity from d=11.
const maxBulkDeviation=Math.max(...bands.slice(1).map(b=>Math.abs(b.per100Cells/meanDensity-1)));
assert(maxBulkDeviation<0.25,`bulk density deviation ${maxBulkDeviation}`);
const result={samplesPerScenario:samples,scenarios,maps:samples*scenarios.length,minSeparation,minOuterSeparation,maxAttempts,
  meanDensity,maxBulkDeviation,maxQuadrantSpread,quadrantMeans:quadrants.map(n=>n/samples),bands,
  elapsedMs:Math.round(performance.now()-start)};
fs.mkdirSync('projectdev/build-feature-261004-balance',{recursive:true});
fs.writeFileSync('projectdev/build-feature-261004-balance/sample.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
