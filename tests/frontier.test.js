import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from './helpers/game.js';

test('frontier encounters cover every terrain at 45 through 90 and command vaults start at 65', () => {
  const g = game(), w = g.World, e = g.Events;
  w.state = {};
  const command = e.Setpieces.fortress.scenes.courtyard.buttons.command;
  for (const distance of [35, 44, 45, 64, 65, 90]) {
    w.getDistance = () => distance;
    assert.equal(command.available(), distance >= 65);
    for (const terrain of [w.TILE.FOREST, w.TILE.FIELD, w.TILE.BARRENS]) {
      w.getTerrain = () => terrain;
      const available = e.Frontier.encounters.filter(f => f.isAvailable());
      const fights = available.filter(f => f.scenes.start.combat);
      assert.equal(fights.length, distance >= 45 ? 1 : 0);
      if (fights.length) assert.equal(fights[0].scenes.start.health >= 100, distance >= 65);
      let chosen;
      e.startEvent = event => { chosen = event; };
      g.Math.random = () => 0;
      e.triggerFight();
      assert.ok(chosen?.scenes.start.combat, `no combat at ${distance} on ${terrain}`);
    }
  }
});

test('fabricator uses large crystal and steel recipes and crystal production stalls without inputs', () => {
  const g = game();
  for(const recipe of Object.values(g.Fabricator.Craftables)) {
    const cost = recipe.cost();
    assert.ok(cost.crystal > 20 && cost.steel > 20);
    assert.equal(cost['alien alloy'], undefined);
  }
  g.State.game.population = 1; g.$SM.set('game.workers', { 'crystal worker': 1 });
  g.Outside.updateVillageIncome();
  g.$SM.setM('stores', { 'cured meat': 2, steel: 0, coal: 2, crystal: 0 });
  g.$SM.collectIncome();
  assert.equal(g.State.stores.crystal, 0);
  assert.equal(g.State.stores['cured meat'], 2);
  g.State.stores.steel = 1; g.State.income['crystal worker'].timeLeft = 0;
  g.$SM.collectIncome();
  assert.equal(g.State.stores.crystal, 1);
  for(const material of ['steel', 'coal', 'cured meat']) assert.equal(g.State.stores[material], 0);
});

test('actual ammo-consuming shots including misses unlock sharpshooter at 300, excluding grenades', () => {
  const g = game(), e = g.Events;
  e.eventStack = [{ scenes: { start: { combat: true } } }]; e.activeScene = 'start';
  g.element('#enemy').data('hp', 1000);
  g.Path.outfit = { bullets: 400, 'energy cell': 400, grenade: 2 };
  let damage;
  e.animateRanged = (_, d) => { damage = d; };
  g.Math.random = () => 1; // Misses still use ammunition and count toward practice.
  const shoot = key => e.useWeapon(g.element('attack').attr('id', 'attack_' + key.replace(/ /g, '-')));
  for(let i = 0; i < 299; i++) shoot(['rifle', 'laser rifle', 'plasma rifle'][i % 3]);
  assert.equal(damage, -1);
  assert.equal(g.State.character.shots, 299);
  assert.ok(!g.$SM.hasPerk('sharpshooter'));
  shoot('grenade'); assert.equal(g.State.character.shots, 299);
  g.Path.outfit.bullets = 0; shoot('rifle'); assert.equal(g.State.character.shots, 299);
  g.Math.random = () => 0;
  shoot('plasma rifle');
  assert.equal(g.State.character.shots, 300); assert.equal(damage, 15);
  assert.equal(g.$SM.hasPerk('sharpshooter'), true);
  assert.deepEqual(['rifle', 'laser rifle', 'plasma rifle'].map(g.World.getDamage), [8, 12, 15]);
  assert.equal(g.World.getDamage('grenade'), 15);
  g.State.character.punches = 300; e.recordWeaponUse('fists');
  for(const perk of ['boxer', 'martial artist', 'unarmed master']) assert.ok(g.$SM.hasPerk(perk));
});

test('discovery ordering persists independently of counts and source object order', () => {
  const g = game();
  g.$SM.set('game.workers.tanner', 0); g.$SM.set('game.workers.hunter', 0);
  g.$SM.set('game.workers.tanner', 3); g.$SM.set('game.workers.tanner', 0);
  assert.deepEqual(g.json(g.$SM.orderedKeys('workers', ['hunter', 'tanner'])), ['tanner', 'hunter']);
  g.$SM.set('features.location.fabricator', true);
  g.$SM.set('character.blueprints.stim', true); g.$SM.set('character.blueprints["laser rifle"]', true);
  assert.deepEqual(g.json(g.$SM.orderedKeys('blueprints', ['laser rifle', 'stim'])), ['stim', 'laser rifle']);
  const order = g.State.game.unlockOrder.fabricator;
  assert.ok(order.indexOf('stim') < order.indexOf('laser rifle'));
});

test('map view grows from 10 cells without changing fog and survives safe return', () => {
  const g = game(), w = g.World; w.init(); w.state = g.json(g.State.game.world); w.curPos = [0, 0];
  assert.equal(w.getMapView().size, 10);
  assert.equal(w.state.mask.flat().filter(Boolean).length, 1);
  w.setMask(w.state.mask, -10, 2, true);
  const before = g.json(w.state.mask);
  assert.equal(w.getMapView().size, 30);
  assert.deepEqual(g.json(w.state.mask), before);
  w.commitWorld(); w.state = g.json(g.State.game.world);
  assert.equal(w.getMapView().size, 30);
  w.setMask(w.state.mask, 45, 45, true);
  assert.equal(w.getMapView().size, 91);
});

test('each ancestral cache commits its own reward once, with death rolling back claims', () => {
  const g = game(), w = g.World;
  g.$SM.set('previous.caches', [{ stores: { crystal: 30 } }, { stores: { steel: 40 } }]);
  w.init(); w.state = g.json(g.State.game.world);
  const sites = w.mapSearch('U', w.state.map);
  w.curPos = [sites[0].x, sites[0].y]; g.Prestige.collectStores();
  assert.equal(g.State.stores.crystal, undefined);
  w.state = g.json(g.State.game.world); // Discard the failed expedition.
  assert.equal(w.state.cacheClaims, undefined);
  for(const pos of sites) { w.curPos = [pos.x, pos.y]; g.Prestige.collectStores(); }
  w.commitWorld(); w.commitWorld();
  assert.equal(g.State.stores.crystal, 30); assert.equal(g.State.stores.steel, 40);
  for(let i = 0; i < 6; i++) g.Prestige.save();
  assert.equal(g.Prestige.getCaches().length, 5);
});
