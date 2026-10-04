// The outer frontier begins at walking distance 45. Rewards remain expedition loot.
Events.Frontier = {
  fight: function(name, chara, health, damage, loot, nextScene, ranged = true) {
    return { combat: true, enemy: name, enemyName: name, chara: chara,
      notification: _('a {0} blocks the way.', name),
      health: health, damage: damage, hit: 0.8, attackDelay: 2.5, ranged: ranged,
      deathMessage: _('the weapon falls silent. the way is clear.'), loot: loot, nextScene: nextScene };
  },
  loot: function(crystal, steel, cells) {
    return { crystal: { min: crystal, max: crystal + 5, chance: 1 },
      steel: { min: steel, max: steel + 5, chance: 1 },
      'energy cell': { min: cells, max: cells + 3, chance: 1 } };
  },
  guard: function(name, chara, health, damage, deepHealth, deepDamage, nextScene, ranged = true) {
    var scene = Events.Frontier.fight(name, chara, health, damage, {}, nextScene, ranged);
    scene.onLoad = function() {
      // Scene definitions are shared; reset both ways on every visit, including after death.
      var deep = World.getDistance() >= 65;
      scene.health = deep ? deepHealth : health;
      scene.damage = deep ? deepDamage : damage;
    };
    return scene;
  },
  encounter: function(title, scene, min, max, terrain) {
    return { title: title, isAvailable: function() {
      return World.getDistance() >= min && World.getDistance() <= max &&
        World.getTerrain() === terrain;
    }, scenes: { start: scene } };
  }
};

Events.Frontier.encounters = [
  Events.Frontier.encounter(_('A Crystal Stalker'),
    Events.Frontier.fight(_('crystal stalker'), 'C', 65, 8, Events.Frontier.loot(6, 3, 2), undefined, false), 45, 64, World.TILE.FOREST),
  Events.Frontier.encounter(_('An Armoured Patrol'),
    Events.Frontier.fight(_('armoured patrol'), 'P', 80, 10, Events.Frontier.loot(4, 8, 3)), 45, 64, World.TILE.FIELD),
  Events.Frontier.encounter(_('A Salvage Drone'),
    Events.Frontier.fight(_('salvage drone'), 'D', 70, 9, Events.Frontier.loot(5, 6, 4)), 45, 64, World.TILE.BARRENS),
  Events.Frontier.encounter(_('A Crystal Devourer'),
    Events.Frontier.fight(_('crystal devourer'), 'C', 105, 13, Events.Frontier.loot(12, 6, 4), undefined, false), 65, 90, World.TILE.FOREST),
  Events.Frontier.encounter(_('An Assault Automaton'),
    Events.Frontier.fight(_('assault automaton'), 'A', 120, 14, Events.Frontier.loot(8, 14, 6)), 65, 90, World.TILE.FIELD),
  Events.Frontier.encounter(_('A Siege Walker'),
    Events.Frontier.fight(_('siege walker'), 'W', 110, 15, Events.Frontier.loot(10, 12, 8)), 65, 90, World.TILE.BARRENS),
  {
    title: _('A Roving Repair Cart'),
    isAvailable: function() { return World.getDistance() >= 45 && !World.state.repairCartSeen; },
    scenes: {
      start: {
        text: [_('a scarred mechanic shelters beside a humming condenser.'), _('he offers clean water for spare steel. the cart will not wait here again.')],
        onLoad: function() { World.state.repairCartSeen = true; },
        buttons: {
          repair: { text: _('trade 10 steel for water'), cost: { steel: 10 },
            onChoose: function() { World.setWater(World.getMaxWater()); World.updateSupplies(); }, nextScene: 'end' },
          leave: { text: _('leave'), nextScene: 'end' }
        }
      }
    }
  }
];

Events.Setpieces.warehouse = {
  title: _('A Supply Warehouse'),
  scenes: {
    start: {
      text: [_('freight shelves stand behind a buckled shutter.'), _('a scavenger has wired an alarm across the only entrance.')],
      buttons: {
        enter: { text: _('lift the shutter'), nextScene: { 1: 'guard' } },
        leave: { text: _('leave'), nextScene: 'end' }
      }
    },
    guard: Events.Frontier.fight(_('warehouse scavenger'), 'S', 55, 7, {}, 'stores'),
    stores: {
      text: [_('sealed cases hold steel and unfinished crystal.'), _('the roof is unsafe and the cistern is dry. this cannot become an outpost.')],
      loot: { ...Events.Frontier.loot(9, 12, 3),
        'cured meat': { min: 8, max: 13, chance: 1 }, medicine: { min: 3, max: 6, chance: 1 } },
      onLoad: function() { World.markVisited(World.curPos[0], World.curPos[1]); },
      buttons: { leave: { text: _('leave'), nextScene: 'end' } }
    }
  }
};

Events.Setpieces.fortress = {
  title: _('A Military Fortress'),
  scenes: {
    start: {
      text: [_('gun slits watch the broken approach.'), _('beneath the walls, a water pump still turns. armed figures guard the gate.')],
      buttons: {
        assault: { text: _('approach the gate'), nextScene: { 0.34: 'sentry', 0.67: 'raiders', 1: 'hound' } },
        leave: { text: _('leave'), nextScene: 'end' }
      }
    },
    sentry: Events.Frontier.guard(_('fortress sentry'), 'S', 85, 10, 115, 13, 'courtyard'),
    raiders: Events.Frontier.guard(_('veteran rifleman'), 'R', 75, 11, 105, 14, 'courtyard'),
    hound: Events.Frontier.guard(_('armoured war hound'), 'H', 95, 9, 125, 12, 'courtyard', false),
    courtyard: {
      text: [_('a wounded quartermaster lowers his weapon.'), _('he will keep the pump running if you secure the yard. deeper forts also hold a command vault.')],
      buttons: {
        secure: { text: _('secure the pump and supplies'), nextScene: { 1: 'well' } },
        command: { text: _('storm the command vault'), available: function() { return World.getDistance() >= 65; }, nextScene: { 1: 'commander' } },
        leave: { text: _('withdraw'), nextScene: 'end' }
      }
    },
    commander: Events.Frontier.fight(_('fortress commander'), 'C', 130, 15, Events.Frontier.loot(13, 13, 10), 'well'),
    well: {
      text: [_('the quartermaster opens the reserve crates and starts the pump.'), _('the fortress becomes a friendly outpost. its road will guide later expeditions.')],
      loot: { ...Events.Frontier.loot(15, 15, 5),
        'cured meat': { min: 10, max: 15, chance: 1 }, medicine: { min: 4, max: 7, chance: 1 } },
      onLoad: function() {
        if(World.getTile(World.state.map, World.curPos[0], World.curPos[1]) === World.TILE.FORTRESS) {
          World.state.fortressesCleared = (World.state.fortressesCleared || 0) + 1;
          World.clearDungeon();
          World.useOutpost();
          World.updateSupplies();
        }
      },
      buttons: { leave: { text: _('leave'), nextScene: 'end' } }
    }
  }
};

// Guard the existing battlefield rewards; only victory marks the site visited.
Events.Setpieces.battlefield.scenes.salvage = Events.Setpieces.battlefield.scenes.start;
Events.Setpieces.battlefield.scenes.start = {
  text: [_('an automatic turret sweeps the wreckage with a red targeting beam.'), _('the old weapons lie inside its firing arc.')],
  buttons: {
    attack: { text: _('engage the automatic turret'), nextScene: { 1: 'turret' } },
    leave: { text: _('leave'), nextScene: 'end' }
  }
};
Events.Setpieces.battlefield.scenes.turret = Events.Frontier.guard(_('automatic turret'), 'T', 85, 11, 115, 14, 'salvage');
Events.Setpieces.battlefield.scenes.salvage.loot.crystal = { min: 6, max: 15, chance: 1 };
Events.Setpieces.battlefield.scenes.salvage.loot.steel = { min: 6, max: 15, chance: 1 };
// Keep ammunition useful on long expeditions, but avoid doubling surplus guns and alloy.
Events.Setpieces.battlefield.scenes.salvage.loot.rifle.max = 1;
Events.Setpieces.battlefield.scenes.salvage.loot['laser rifle'].max = 1;
Events.Setpieces.battlefield.scenes.salvage.loot['alien alloy'].chance = 0.2;
Events.Setpieces.borehole.scenes.start.loot['alien alloy'].max = 1;
