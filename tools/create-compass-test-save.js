// Creates a separate importable fixture; never reads or writes browser storage.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { game } from '../tests/helpers/game.js';

const g = game();
let seed = 9142026;
g.Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
g.$SM.set('version', g.Engine.VERSION);
g.$SM.setM('features.location', { room: true, outside: true });
g.$SM.set('game.builder.level', 4);
g.$SM.set('game.fire', g.Room.FireEnum.Burning);
g.$SM.set('game.temperature', g.Room.TempEnum.Warm);
g.$SM.setM('game.buildings', { trap: 10, cart: 1, hut: 5, lodge: 1,
  tannery: 1, smokehouse: 1, workshop: 1, 'trading post': 1 });
g.$SM.set('game.population', 20);
g.$SM.setM('game.workers', { hunter: 5, trapper: 1, tanner: 2, charcutier: 3 });
g.$SM.setM('stores', { wood: 1200, fur: 800, meat: 100, teeth: 30, scales: 30,
  leather: 100, 'cured meat': 150, bait: 20, torch: 10, cloth: 20,
  'bone spear': 1, 'l armour': 1, waterskin: 1, rucksack: 1, compass: 1 });
for(const perk of Object.keys(g.Engine.Perks)) g.$SM.set(`character.perks['${perk}']`, true);
g.$SM.setM('character', { shots: 300, punches: 300 });
g.$SM.set('outfit', { 'cured meat': 12, torch: 3 });
g.$SM.set('config.lightsOff', true);
g.$SM.set('config.language', 'zh_cn');
g.$SM.set('playStats.audioAlertShown', true);
g.World.init();
g.$SM.set('game.world.mapViewSize', 10);
g.Outside.updateVillageIncome();
const state = g.json(g.State);
assert.equal(state.game.world.mask.flat().filter(Boolean).length, 1);
assert.equal(Object.values(state.character.perks).filter(Boolean).length, Object.keys(g.Engine.Perks).length);
assert.equal(state.features.location.fabricator, undefined);
assert.equal(state.game.world.map.flat().some(tile => tile.endsWith('!')), false);
assert.equal(state.stores.compass, 1);
const encoded = Buffer.from(JSON.stringify(state), 'utf8').toString('base64');
assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')), state);
fs.mkdirSync('doc/test-saves', { recursive: true });
fs.writeFileSync('doc/test-saves/compass-all-perks.txt', encoded + '\n');
console.log(`Created compass-all-perks.txt: ${Object.keys(state.character.perks).length} perks; 1 revealed village cell; no visited sites or industrial unlocks.`);
