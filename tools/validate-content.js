import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parse } from 'acorn';
import { game } from '../tests/helpers/game.js';

const g = game();
g.World.init();
const files = fs.readdirSync('script', { recursive: true }).filter(name => name.endsWith('.js')).map(name => path.join('script', name));
let objects = 0, messages = 0;
const pot = fs.readFileSync('lang/adarkroom.pot', 'utf8');
const catalogMessages = new Set();
let message = null;
for (const line of pot.split(/\r?\n/)) {
  if (line.startsWith('msgid ')) message = JSON.parse(line.slice(6));
  else if (message !== null && line.startsWith('"')) message += JSON.parse(line);
  else if (message !== null) { catalogMessages.add(message); message = null; }
}
const expansionFiles = ['industry.js', 'ships.js', 'ship.js', 'frontier.js'];
const localizedFiles = [...expansionFiles, 'executioner.js', 'fabricator.js', 'space.js', 'mobile.js'];
const runtimeSource = fs.readFileSync('lang/zh_cn/strings.js', 'utf8');
const chinese = JSON.parse(runtimeSource.slice(runtimeSource.indexOf('{'), runtimeSource.lastIndexOf('}') + 1));
const chinesePO = new Map();
let poKey, poValue = '', poField;
for (const line of fs.readFileSync('lang/zh_cn/strings.po', 'utf8').split(/\r?\n/)) {
  if (line.startsWith('msgid ')) {
    if (poKey !== undefined) chinesePO.set(poKey, poValue);
    poKey = JSON.parse(line.slice(6)); poValue = ''; poField = 'key';
  } else if (line.startsWith('msgstr ')) {
    poValue = JSON.parse(line.slice(7)); poField = 'value';
  } else if (line.startsWith('"')) {
    if (poField === 'key') poKey += JSON.parse(line);
    else if (poField === 'value') poValue += JSON.parse(line);
  } else { poField = null; }
}
if (poKey !== undefined) chinesePO.set(poKey, poValue);
const expectedChinese = Object.assign({}, ...['crystal-expansion', 'expansion-interface'].map(name =>
  JSON.parse(fs.readFileSync(`lang/${name}-zh_cn.json`, 'utf8'))));
for (const [source, translation] of Object.entries(expectedChinese)) {
  assert.equal(chinese[source], translation, `runtime translation out of date: ${source}`);
  assert.equal(chinesePO.get(source), translation, `PO translation out of date: ${source}`);
  assert.deepEqual(translation.match(/\{\d+\}/g) || [], source.match(/\{\d+\}/g) || [], `placeholder mismatch: ${source}`);
  assert.equal((translation.match(/<br>/g) || []).length, (source.match(/<br>/g) || []).length, `line breaks missing: ${source}`);
}
let translatedMessages = 0;
for (const file of files) {
  const ast = parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', locations: true });
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ObjectExpression') {
      objects++;
      const keys = new Set();
      for (const prop of node.properties) {
        if (prop.type !== 'Property' || prop.computed || prop.kind !== 'init') continue;
        const key = prop.key.name ?? prop.key.value;
        assert.ok(!keys.has(key), `${file}:${prop.loc.start.line}: duplicate key ${key}`);
        keys.add(key);
      }
    }
    if (expansionFiles.includes(path.basename(file)) && node.type === 'CallExpression' && node.callee.name === '_') {
      const text = node.arguments[0]?.value;
      assert.equal(typeof text, 'string', `${file}: expansion text must be extractable`);
      assert.ok(catalogMessages.has(text), `${file}: missing POT message ${text}`);
      messages++;
    }
    if ((localizedFiles.includes(path.basename(file)) || path.dirname(file) === path.join('script', 'events')) && node.type === 'CallExpression' && node.callee.name === '_' &&
        typeof node.arguments[0]?.value === 'string') {
      const source = node.arguments[0].value;
      assert.ok(chinese[source], `${file}:${node.loc.start.line}: missing Simplified Chinese: ${source}`);
      translatedMessages++;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast);
}

const tiles = Object.values(g.World.TILE);
assert.equal(new Set(tiles).size, tiles.length, 'landmark symbols must be unique');
const itemIds = new Set([
  ...Object.keys(g.Room.Craftables), ...Object.keys(g.Room.TradeGoods), ...Object.keys(g.Room.MiscItems),
  ...Object.keys(g.Fabricator.Craftables), ...Object.keys(g.World.Weapons), ...Object.keys(g.Prestige.storesMap),
  ...Object.keys(g.Score.weights), 'medicine', 'charm', 'water', 'hp', 'fists',
  ...Object.keys(g.Fabricator.Craftables).map(item => item + ' blueprint')
]);
for (const [key, weapon] of Object.entries(g.World.Weapons)) {
  for (const ammo of Object.keys(weapon.cost || {})) assert.ok(itemIds.has(ammo), `${key}: unknown ammunition ${ammo}`);
  assert.ok(typeof weapon.damage === 'number' || weapon.damage === 'stun', `${key}: invalid damage/status`);
}
for (const [key, recipe] of Object.entries(g.Fabricator.Craftables)) {
  assert.ok(chinese[key], `untranslated fabrication item: ${key}`);
  if(recipe.blueprintRequired) assert.ok(chinese[key + ' blueprint'], `untranslated blueprint: ${key}`);
  for (const item of Object.keys(recipe.cost())) assert.ok(itemIds.has(item), `${key}: unknown recipe item ${item}`);
}
for (const item of Object.keys(g.Ship.LATTICE_COST)) assert.ok(itemIds.has(item), `lattice: unknown item ${item}`);
const events = { ...g.Events.Setpieces, ...g.Events.Executioner };
for (const [tile, landmark] of Object.entries(g.World.LANDMARKS)) {
  assert.ok(landmark.scene === 'executioner' || events[landmark.scene], `${tile}: missing event ${landmark.scene}`);
}
for (const [id, event] of Object.entries(events)) {
  assert.ok(event.scenes.start, `${id}: missing start scene`);
  for (const [name, scene] of Object.entries(event.scenes)) {
    for (const item of Object.keys(scene.loot || {})) assert.ok(itemIds.has(item), `${id}/${name}: unknown loot ${item}`);
    const checkTarget = target => {
      const targets = typeof target === 'object' ? Object.values(target) : [target];
      for (const dest of targets) if (dest && dest !== 'end') assert.ok(event.scenes[dest], `${id}/${name}: missing scene ${dest}`);
    };
    checkTarget(scene.nextScene);
    for (const button of Object.values(scene.buttons || {})) {
      checkTarget(button.nextScene);
      if (button.nextEvent) assert.ok(events[button.nextEvent], `${id}/${name}: missing event ${button.nextEvent}`);
    }
  }
}

// Every completing route through a new ship must encounter its guaranteed shard.
for (const [id, rewardScene] of [['scoutship','chart'], ['cargoship','guidance']]) {
  const scenes = events[id].scenes, seen = new Set();
  function walk(name, rewarded = false) {
    rewarded ||= name === rewardScene;
    const key = name + ':' + rewarded;
    if (seen.has(key)) return;
    seen.add(key);
    if (name === 'end') return;
    const scene = scenes[name];
    if (name === rewardScene) assert.equal(typeof scene.onLoad, 'function');
    for (const [buttonId, button] of Object.entries(scene.buttons || {})) {
      const targets = typeof button.nextScene === 'object' ? Object.values(button.nextScene) : [button.nextScene];
      for (const target of targets) {
        // Retreat before discovery remains legal; completion must secure the shard.
        if (target === 'end' && name === rewardScene) assert.ok(rewarded);
        else if (target && target !== 'end') walk(target, rewarded);
      }
    }
    if (scene.nextScene && scene.nextScene !== 'end') walk(scene.nextScene, rewarded);
  }
  walk('start');
  assert.ok(seen.has(rewardScene + ':true'), `${id}: shard scene unreachable`);
}
assert.equal(typeof events['executioner-intro'].scenes['7'].onLoad, 'function');
console.log(`Content valid: ${objects} object definitions, ${Object.keys(events).length} events, ${tiles.length} unique tiles, ${messages} catalogued expansion strings, ${translatedMessages} Chinese text references.`);
