// Analytic expectation of the proposed area-uniform sampler. No map generation or simulation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const plan = JSON.parse(fs.readFileSync('doc/map-radius45-uniform-plan.json', 'utf8'));
const shell = d => d === 0 ? 1 : d <= plan.radius ? 4*d : Math.max(0, 4*(2*plan.radius-d+1));
const area = (a,b) => Array.from({length:Math.max(0,b-a+1)}, (_,i) => shell(a+i)).reduce((a,b) => a+b, 0);
const counts = Array(2*plan.radius+1).fill(0);
for (const location of plan.landmarks) {
  if (!location.count || location.symbol === 'A') continue;
  assert(location.min >= 1 && location.max <= 2*plan.radius);
  const available = area(location.min, location.max);
  for (let d=location.min; d<=location.max; d++) counts[d] += location.count*shell(d)/available;
}
assert(Math.abs(counts.reduce((a,b) => a+b)-136) < 1e-9);
const meanDensity = 136/area(1,2*plan.radius)*100;
const bands = [];
for (let a=1; a<=2*plan.radius; a+=10) {
  const b=Math.min(a+9,2*plan.radius), cells=area(a,b);
  const expected=counts.slice(a,b+1).reduce((a,b)=>a+b,0);
  bands.push({min:a,max:b,cells,expected,per100Cells:expected/cells*100});
}
const maxRelativeDeviation = Math.max(...bands.map(b=>Math.abs(b.per100Cells/meanDensity-1)));
const output={radius:plan.radius,total:136,meanDensity,maxRelativeDeviation,bands,
  perDistance:counts.slice(1).map((expected,i)=>({distance:i+1,cells:shell(i+1),expected}))};
fs.writeFileSync('doc/map-radius45-uniform-expectations.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({meanDensity,maxRelativeDeviation,bands},null,2));
