var World = {
  RADIUS: 45,
  LANDMARK_SEPARATION: 5,
  INNER_LANDMARK_RADIUS: 10,
  INNER_LANDMARK_SEPARATION: 3,
  MAP_GENERATION_ATTEMPTS: 8,
  VILLAGE_POS: [0, 0],
  toIndex: n => n + World.RADIUS,
  toCoord: i => i - World.RADIUS,
  isInBounds: (x, y) => Number.isInteger(x) && Number.isInteger(y) &&
    x >= -World.RADIUS && x <= World.RADIUS && y >= -World.RADIUS && y <= World.RADIUS,
  getTile: (map, x, y) => World.isInBounds(x, y) ? map[World.toIndex(x)][World.toIndex(y)] : undefined,
  setTile: (map, x, y, value) => {
    if (!World.isInBounds(x, y)) return false;
    map[World.toIndex(x)][World.toIndex(y)] = value;
    return true;
  },
  getMask: (mask, x, y) => !!World.getTile(mask, x, y),
  setMask: (mask, x, y, value) => World.setTile(mask, x, y, value),
  TILE: {
    VILLAGE: 'A',
    IRON_MINE: 'I',
    COAL_MINE: 'C',
    SULPHUR_MINE: 'S',
    FOREST: ';',
    FIELD: ',',
    BARRENS: '.',
    ROAD: '#',
    HOUSE: 'H',
    CAVE: 'V',
    TOWN: 'O',
    CITY: 'Y',
    OUTPOST: 'P',
    SHIP: 'W',
    BOREHOLE: 'B',
    BATTLEFIELD: 'F',
    SWAMP: 'M',
    CACHE: 'U',
    EXECUTIONER: 'X',
    CRYSTAL_WORKS: 'K',
    CHEMICAL_WORKS: 'E',
    ASSEMBLY_WORKS: 'D',
    SCOUT_SHIP: 'R',
    CARGO_SHIP: 'T',
    FORTRESS: 'Z',
    WAREHOUSE: 'G'
  },
  TILE_PROBS: {},
  LANDMARKS: {},
  STICKINESS: 0.5, // 0 <= x <= 1
  LIGHT_RADIUS: 2,
  BASE_WATER: 10,
  MOVES_PER_FOOD: 2,
  MOVES_PER_WATER: 1,
  DEATH_COOLDOWN: 120,
  FIGHT_CHANCE: 0.20,
  BASE_HEALTH: 10,
  BASE_HIT_CHANCE: 0.8,
  MEAT_HEAL: 8,
  MEDS_HEAL: 20,
  HYPO_HEAL: 30,
  FIGHT_DELAY: 3, // At least three moves between fights
  NORTH: [ 0, -1],
  SOUTH: [ 0,  1],
  WEST:  [-1,  0],
  EAST:  [ 1,  0],

  Weapons: {
    'fists': {
      verb: _('punch'),
      type: 'unarmed',
      damage: 1,
      cooldown: 2
    },
    'bone spear': {
      verb: _('stab'),
      type: 'melee',
      damage: 2,
      cooldown: 2
    },
    'iron sword': {
      verb: _('swing'),
      type: 'melee',
      damage: 4,
      cooldown: 2
    },
    'steel sword': {
      verb: _('slash'),
      type: 'melee',
      damage: 6,
      cooldown: 2
    },
    'bayonet': {
      verb: _('thrust'),
      type: 'melee',
      damage: 8,
      cooldown: 2
    },
    'rifle': {
      verb: _('shoot'),
      type: 'ranged',
      damage: 5,
      cooldown: 1,
      cost: { 'bullets': 1 }
    },
    'laser rifle': {
      verb: _('blast'),
      type: 'ranged',
      damage: 8,
      cooldown: 1,
      cost: { 'energy cell': 1 }
    },
    'grenade': {
      verb: _('lob'),
      type: 'ranged',
      damage: 15,
      cooldown: 5,
      cost: { 'grenade': 1 }
    },
    'bolas': {
      verb: _('tangle'),
      type: 'ranged',
      damage: 'stun',
      cooldown: 15,
      cost: { 'bolas': 1 }
    },
    'plasma rifle': {
      verb: _('disintegrate'),
      type: 'ranged',
      damage: 12,
      cooldown: 1,
      cost: { 'energy cell': 1 }
    },
    'energy blade': {
      verb: _('slice'),
      type: 'melee',
      damage: 10,
      cooldown: 2
    },
    'disruptor': {
      verb: _('stun'),
      type: 'ranged',
      damage: 'stun',
      cooldown: 15
    }
  },

  name: 'World',
  options: {}, // Nothing for now
  init: function(options) {
    this.options = $.extend(
      this.options,
      options
    );

    var savedMap = $SM.get('game.world.map');
    World.RADIUS = savedMap ? ($SM.get('game.world.radius') || (savedMap.length - 1) / 2) : 45;

    // Setup probabilities. Sum must equal 1.
    World.TILE_PROBS[World.TILE.FOREST] = 0.15;
    World.TILE_PROBS[World.TILE.FIELD] = 0.35;
    World.TILE_PROBS[World.TILE.BARRENS] = 0.5;

    // Setpiece definitions
    World.LANDMARKS[World.TILE.OUTPOST] = { num: 0, minRadius: 0, maxRadius: 0, scene: 'outpost', label: _('An&nbsp;Outpost') };
    World.LANDMARKS[World.TILE.IRON_MINE] = { num: 1, minRadius: 5, maxRadius: 5, scene: 'ironmine', label:  _('Iron&nbsp;Mine') };
    World.LANDMARKS[World.TILE.COAL_MINE] = { num: 1, minRadius: 10, maxRadius: 10, scene: 'coalmine', label:  _('Coal&nbsp;Mine') };
    World.LANDMARKS[World.TILE.SULPHUR_MINE] = { num: 1, minRadius: 20, maxRadius: 20, scene: 'sulphurmine', label:  _('Sulphur&nbsp;Mine') };
    World.LANDMARKS[World.TILE.HOUSE] = { num: 10, minRadius: 3, maxRadius: 20, scene: 'house', label:  _('An&nbsp;Old&nbsp;House') };
    World.LANDMARKS[World.TILE.CAVE] = { num: 10, minRadius: 3, maxRadius: 20, scene: 'cave', label:  _('A&nbsp;Damp&nbsp;Cave') };
    World.LANDMARKS[World.TILE.TOWN] = { num: 15, minRadius: 15, maxRadius: 25, scene: 'town', label:  _('An&nbsp;Abandoned&nbsp;Town') };
    World.LANDMARKS[World.TILE.CITY] = { num: 20, minRadius: 20, maxRadius: 40, scene: 'city', label:  _('A&nbsp;Ruined&nbsp;City') };
    World.LANDMARKS[World.TILE.SHIP] = { num: 1, minRadius: 35, maxRadius: 35, scene: 'ship', label:  _('A&nbsp;Crashed&nbsp;Starship')};
    World.LANDMARKS[World.TILE.BOREHOLE] = { num: 20, minRadius: 35, maxRadius: 60, scene: 'borehole', label:  _('A&nbsp;Borehole')};
    World.LANDMARKS[World.TILE.BATTLEFIELD] = { num: 20, minRadius: 35, maxRadius: 60, scene: 'battlefield', label:  _('A&nbsp;Battlefield')};
    World.LANDMARKS[World.TILE.SWAMP] = { num: 1, minRadius: 15, maxRadius: 35, scene: 'swamp', label:  _('A&nbsp;Murky&nbsp;Swamp')};
    World.LANDMARKS[World.TILE.EXECUTIONER] = { num: 1, minRadius: 50, maxRadius: 50, scene: 'executioner', 'label': _('A&nbsp;Ravaged&nbsp;Battleship')};
    World.LANDMARKS[World.TILE.CRYSTAL_WORKS] = { num: 1, minRadius: 25, maxRadius: 25, scene: 'crystalworks', label: _('Abandoned&nbsp;Crystal&nbsp;Works') };
    World.LANDMARKS[World.TILE.CHEMICAL_WORKS] = { num: 1, minRadius: 30, maxRadius: 30, scene: 'chemicalworks', label: _('A&nbsp;Chemical&nbsp;Works') };
    World.LANDMARKS[World.TILE.ASSEMBLY_WORKS] = { num: 1, minRadius: 35, maxRadius: 35, scene: 'assemblyworks', label: _('A&nbsp;Precision&nbsp;Assembly&nbsp;Plant') };
    World.LANDMARKS[World.TILE.SCOUT_SHIP] = { num: 1, minRadius: 40, maxRadius: 40, scene: 'scoutship', label: _('A&nbsp;Crashed&nbsp;Scout&nbsp;Ship') };
    World.LANDMARKS[World.TILE.CARGO_SHIP] = { num: 1, minRadius: 45, maxRadius: 45, scene: 'cargoship', label: _('A&nbsp;Buried&nbsp;Transport') };

    World.LANDMARKS[World.TILE.FORTRESS] = { num: 20, minRadius: 35, maxRadius: 60, scene: 'fortress', label: _('A Military Fortress') };
    World.LANDMARKS[World.TILE.WAREHOUSE] = { num: 10, minRadius: 25, maxRadius: 35, scene: 'warehouse', label: _('A Supply Warehouse') };

    // Only add the cache if there is prestige data
    if(Prestige.getCaches().length) {
      World.LANDMARKS[World.TILE.CACHE] = { num: Prestige.getCaches().length, minRadius: 55, maxRadius: 60, scene: 'cache', label: _('An Ancestral Dark Room')};
    } else {
      delete World.LANDMARKS[World.TILE.CACHE];
    }

    // Keep existing worlds intact; new worlds span -45..45 (walking distance 90).
    if (World.RADIUS === 45) {
      // Double ordinary exploration sites only; unique sites and inherited caches retain their counts.
      ['H', 'V', 'O', 'Y', 'G', 'Z', 'B', 'F'].forEach(function(tile) {
        World.LANDMARKS[tile].num *= 2;
      });
      var ranges = { I: [5, 5], C: [10, 10], S: [20, 20], H: [3, 25],
        V: [5, 32], O: [18, 40], Y: [30, 55], G: [32, 44], Z: [45, 90],
        W: [45, 49], B: [45, 90], F: [45, 90], M: [20, 35], X: [65, 75],
        K: [32, 36], E: [38, 42], D: [45, 49], R: [55, 65], T: [75, 90], U: [75, 90] };
      Object.keys(ranges).forEach(function(tile) {
        if (World.LANDMARKS[tile]) {
          World.LANDMARKS[tile].minRadius = ranges[tile][0];
          World.LANDMARKS[tile].maxRadius = ranges[tile][1];
        }
      });
    }

    if(typeof $SM.get('features.location.world') == 'undefined') {
      $SM.set('features.location.world', true);
      $SM.set('features.executioner', true);
      $SM.setM('game.world', {
        radius: World.RADIUS,
        map: World.generateMap(),
        mask: World.newMask()
      });
    }
    else if (!$SM.get('features.executioner')) {
      // Place the Executioner in previously generated maps that don't have it
      const map = $SM.get('game.world.map');
      const landmark = World.LANDMARKS[World.TILE.EXECUTIONER]
      for(let l = 0; l < landmark.num; l++) {
        World.placeLandmark(landmark.minRadius, landmark.maxRadius, World.TILE.EXECUTIONER, map);
      }
      $SM.set('game.world.map', map);
      $SM.set('features.executioner', true);
    }

    World.ensureExpansionLandmarks();

    // Create the World panel
    this.panel = $('<div>').attr('id', "worldPanel").addClass('location').appendTo('#outerSlider');

    // Create the shrink wrapper
    var outer = $('<div>').attr('id', 'worldOuter').appendTo(this.panel);

    // Create the bag panel
    $('<div>').attr('id', 'bagspace-world').append($('<div>')).appendTo(outer);
    $('<div>').attr('id', 'backpackTitle').appendTo(outer);
    $('<div>').attr('id', 'backpackSpace').appendTo(outer);
    $('<div>').attr('id', 'healthCounter').appendTo(outer);
    World.createMapLegend();

    Engine.updateOuterSlider();

    // Map the ship and show compass tooltip
    World.ship = World.mapSearch(World.TILE.SHIP,$SM.get('game.world.map'),1);
    World.dir = World.compassDir(World.ship[0]);
    // compass tooltip text
    Room.compassTooltip(World.dir);

    // Check if everything has been seen
    World.testMap();

    //subscribe to stateUpdates
    $.Dispatch('stateUpdate').subscribe(World.handleStateUpdates);
  },

  clearDungeon: function() {
    Engine.event('progress', 'dungeon cleared');
    World.setTile(World.state.map, World.curPos[0], World.curPos[1], World.TILE.OUTPOST);
    World.drawRoad();
  },

  createMapLegend: function() {
    var legend = $('<section>').attr('id', 'mapLegend').attr('aria-labelledby', 'mapLegendTitle').appendTo(World.panel);
    $('<h2>').attr('id', 'mapLegendTitle').text(_('map legend')).appendTo(legend);
    $('<ul>').appendTo(legend);
  },

  updateMapLegend: function() {
    if(!World.state) return;
    // Remember types within the expedition, just like revealed terrain. Safe returns persist them.
    var known = World.state.discoveredSymbols || (World.state.discoveredSymbols = {});
    known['@'] = true;
    for(var x = -World.RADIUS; x <= World.RADIUS; x++) {
      for(var y = -World.RADIUS; y <= World.RADIUS; y++) {
        if(World.getMask(World.state.mask, x, y) || (World.curPos[0] === x && World.curPos[1] === y)) {
          known[World.getTile(World.state.map, x, y).charAt(0)] = true;
        }
      }
    }
    var entries = [
      ['@', _('Wanderer')],
      [World.TILE.VILLAGE, _('The&nbsp;Village')],
      [World.TILE.ROAD, _('road')],
      [World.TILE.FOREST, _('forest')],
      [World.TILE.FIELD, _('field')],
      [World.TILE.BARRENS, _('barrens')]
    ];
    Object.keys(World.LANDMARKS).forEach(function(tile) {
      entries.push([tile, World.LANDMARKS[tile].label]);
    });
    var list = $('#mapLegend ul');
    var signature = JSON.stringify(entries.filter(function(entry) { return known[entry[0]]; }));
    if(list[0] && World._legendElement === list[0] && World._legendSignature === signature) return;
    list.empty();
    World._legendElement = list[0];
    World._legendSignature = signature;
    entries.forEach(function(entry) {
      if(!known[entry[0]]) return;
      var row = $('<li>').attr('data-symbol', entry[0]).appendTo(list);
      $('<span>').addClass('mapSymbol').text(entry[0]).appendTo(row);
      $('<span>').text(' — ' + entry[1].replace(/&nbsp;/g, ' ')).appendTo(row);
    });
  },

  ensureExpansionLandmarks: function() {
    if ($SM.get('game.world.crystalExpansion')) return;
    // Work on a copy so an exhausted terrain band cannot leave a partial migration.
    var map = $SM.get('game.world.map').map(row => row.slice());
    ['CRYSTAL_WORKS', 'CHEMICAL_WORKS', 'ASSEMBLY_WORKS', 'SCOUT_SHIP', 'CARGO_SHIP'].forEach(key => {
      var tile = World.TILE[key], landmark = World.LANDMARKS[tile];
      if (!World.mapSearch(tile, map, 1).length) World.placeLandmark(landmark.minRadius, landmark.maxRadius, tile, map);
    });
    $SM.setM('game.world', { map: map, crystalExpansion: true, radius: World.RADIUS });
  },

  claimLatticeShard: function(source) {
    var sources = World.state.shardSources || (World.state.shardSources = {});
    if (sources[source]) return false;
    sources[source] = true;
    Path.outfit['lattice shard'] = (Path.outfit['lattice shard'] || 0) + 1;
    Notifications.notify(World, _('a lattice shard rests safely in the pack.'));
    World.updateSupplies();
    return true;
  },

  commitWorld: function() {
    // Quest inventory and its source ledger must enter the save together.
    var previous = $SM.get('game.world.shardSources') || {};
    var sources = World.state.shardSources || {};
    var gained = Object.keys(sources).filter(source => sources[source] && !previous[source]).length;
    if (gained > 0) $SM.add('stores["lattice shard"]', gained, true);
    delete Path.outfit['lattice shard'];
    Prestige.redeemCaches();
    $SM.setM('game.world', World.state, true);
    Engine.saveGame();
    $SM.fireUpdate('game.world');
    $SM.fireUpdate('stores');
  },

  completeIndustry: function(feature) {
    var industry = World.state.industry || (World.state.industry = {});
    industry[feature] = true;
    World.markVisited(World.curPos[0], World.curPos[1]);
    World.drawRoad();
  },

  redeemIndustry: function() {
    var industry = World.state.industry || {};
    Object.keys(industry).forEach(key => {
      if (industry[key]) $SM.set('features.industry.' + key, true);
    });
    if (industry.crystal && typeof $SM.get('game.workers["crystal worker"]') !== 'number') {
      $SM.set('game.workers["crystal worker"]', 0);
      Notifications.notify(null, _('the villagers can now cut crystal.'));
    }
    Room.updateBuildButtons();
  },

  drawRoad: function() {
    var findClosestRoad = function(startPos) {
      // We'll search in a spiral to find the closest road tile
      // We spiral out along manhattan distance contour
      // lines to ensure we draw the shortest road possible.
      // No attempt is made to reduce the search space for
      // tiles outside the map.
      var searchX, searchY, dtmp,
        x = 0,
        y = 0,
        dx = 1,
        dy = -1;
      for (var i = 0; i < Math.pow(World.getDistance(startPos, World.VILLAGE_POS) + 2, 2); i++) {
        searchX = startPos[0] + x;
        searchY = startPos[1] + y;
        if (World.isInBounds(searchX, searchY)) {
          // check for road
          var tile = World.getTile(World.state.map, searchX, searchY);
          if (
             tile === World.TILE.ROAD ||
            (tile === World.TILE.OUTPOST && !(x === 0 && y === 0))  || // outposts are connected to roads
            tile === World.TILE.VILLAGE // all roads lead home
           ) {
            return [searchX, searchY];
          }
        }
        if (x === 0 || y === 0) {
          // Turn the corner
          dtmp = dx;
          dx = -dy;
          dy =  dtmp;
        }
        if (x === 0 && y <= 0) {
          x++;
        } else {
          x += dx;
          y += dy;
        }
      }
      return World.VILLAGE_POS;
    };
    var closestRoad = findClosestRoad(World.curPos);
    var xDist = World.curPos[0] - closestRoad[0];
    var yDist = World.curPos[1] - closestRoad[1];
    var xDir = Math.abs(xDist)/xDist;
    var yDir = Math.abs(yDist)/yDist;
    var xIntersect, yIntersect;
    if(Math.abs(xDist) > Math.abs(yDist)) {
      xIntersect = closestRoad[0];
      yIntersect = closestRoad[1] + yDist;
    } else {
      xIntersect = closestRoad[0] + xDist;
      yIntersect = closestRoad[1];
    }

    for(var x = 0; x < Math.abs(xDist); x++) {
      if(World.isTerrain(World.getTile(World.state.map, closestRoad[0] + (xDir*x), yIntersect))) {
        World.setTile(World.state.map, closestRoad[0] + (xDir*x), yIntersect, World.TILE.ROAD);
      }
    }
    for(var y = 0; y < Math.abs(yDist); y++) {
      if(World.isTerrain(World.getTile(World.state.map, xIntersect, closestRoad[1] + (yDir*y)))) {
        World.setTile(World.state.map, xIntersect, closestRoad[1] + (yDir*y), World.TILE.ROAD);
      }
    }
    World.drawMap();
  },

  updateSupplies: function() {
    var supplies = $('div#bagspace-world > div');

    if(!Path.outfit) {
      Path.outfit = {};
    }

    // Add water
    var water = $('div#supply_water');
    if(World.water > 0 && water.length === 0) {
      water = World.createItemDiv('water', World.water);
      water.prependTo(supplies);
    } else if(World.water > 0) {
      $('div#supply_water', supplies).text(_('water:{0}' , World.water));
    } else {
      water.remove();
    }

    var total = 0;
    for(var k in Path.outfit) {
      var item = $('div#supply_' + k.replace(' ', '-'), supplies);
      var num = Path.outfit[k];
      total += num * Path.getWeight(k);
      if(num > 0 && item.length === 0) {
        item = World.createItemDiv(k, num);
        if(k == 'cured meat' && World.water > 0) {
          item.insertAfter(water);
        } else if(k == 'cured meat') {
          item.prependTo(supplies);
        } else {
          item.appendTo(supplies);
        }
      } else if(num > 0) {
        $('div#' + item.attr('id'), supplies).text(_(k) + ':' + num);
      } else {
        item.remove();
      }
    }

    // Update label
    var t = _('pockets');
    if($SM.get('stores.rucksack', true) > 0) {
      t = _('rucksack');
    }
    $('#backpackTitle').text(t);

    // Update bagspace
    $('#backpackSpace').text(_('free {0}/{1}', Math.floor(Path.getCapacity() - total) , Path.getCapacity()));
  },

  setWater: function(w) {
    World.water = w;
    if(World.water > World.getMaxWater()) {
      World.water = World.getMaxWater();
    }
    World.updateSupplies();
  },

  setHp: function(hp) {
    if(typeof hp == 'number' && !isNaN(hp)) {
      World.health = hp;
      if(World.health > World.getMaxHealth()) {
        World.health = World.getMaxHealth();
      }
      $('#healthCounter').text(_('hp: {0}/{1}', World.health , World.getMaxHealth()));
    }
  },

  createItemDiv: function(name, num) {
    var div = $('<div>').attr('id', 'supply_' + name.replace(' ', '-'))
      .addClass('supplyItem')
      .text(_('{0}:{1}',_(name), num));

    return div;
  },

  moveNorth: function() {
    Engine.log('North');
    World.move(World.NORTH);
  },

  moveSouth: function() {
    Engine.log('South');
    World.move(World.SOUTH);
  },

  moveWest: function() {
    Engine.log('West');
    World.move(World.WEST);
  },

  moveEast: function() {
    Engine.log('East');
    World.move(World.EAST);
  },

  move: function(direction) {
    if (!World.isInBounds(World.curPos[0] + direction[0], World.curPos[1] + direction[1])) return false;
    var oldTile = World.getTile(World.state.map, World.curPos[0], World.curPos[1]);
    World.curPos[0] += direction[0];
    World.curPos[1] += direction[1];
    World.narrateMove(oldTile, World.getTile(World.state.map, World.curPos[0], World.curPos[1]));
    World.lightMap(World.curPos[0], World.curPos[1], World.state.mask);
    World.drawMap();
    if(World.getDistance() >= 45 && !World.state.frontierReached) {
      World.state.frontierReached = true;
      Notifications.notify(World, _('beyond the old roads, crystal engines still hunt. cleared fortresses may offer water.'));
    }
    World.doSpace();

    // play random footstep
    var randomFootstep = Math.floor(Math.random() * 5) + 1;
    AudioEngine.playSound(AudioLibrary['FOOTSTEPS_' + randomFootstep]);

    if(World.checkDanger()) {
      if(World.danger) {
        Notifications.notify(World, _('dangerous to be this far from the village without proper protection'));
      } else {
        Notifications.notify(World, _('safer here'));
      }
    }
  },

  keyDown: function(event) {
    switch(event.which) {
      case 38: // Up
      case 87:
        World.moveNorth();
        break;
      case 40: // Down
      case 83:
        World.moveSouth();
        break;
      case 37: // Left
      case 65:
        World.moveWest();
        break;
      case 39: // Right
      case 68:
        World.moveEast();
        break;
      default:
        break;
    }
  },

  swipeLeft: function(e) {
    World.moveWest();
  },

  swipeRight: function(e) {
    World.moveEast();
  },

  swipeUp: function(e) {
    World.moveNorth();
  },

  swipeDown: function(e) {
    World.moveSouth();
  },

  click: function(event) {
    if(Engine.keyLock || Events.activeEvent()) return;
    var map = $('#map'),
      view = World.getMapView(),
      gridOrigin = map.children('.mapCell').first().offset() || map.offset(),
      // measure clicks relative to the centre of the current location
      centreX = gridOrigin.left + map.width() * (World.curPos[0] - view.min + 0.5) / view.size,
      centreY = gridOrigin.top + map.height() * (World.curPos[1] - view.min + 0.5) / view.size,
      clickX = event.pageX - centreX,
      clickY = event.pageY - centreY;
    if (clickX > clickY && clickX < -clickY) {
      World.moveNorth();
    }
    if (clickX < clickY && clickX > -clickY) {
      World.moveSouth();
    }
    if (clickX < clickY && clickX < -clickY) {
      World.moveWest();
    }
    if (clickX > clickY && clickX > -clickY) {
      World.moveEast();
    }
  },

  checkDanger: function() {
    World.danger = typeof World.danger == 'undefined' ? false: World.danger;
    if(!World.danger) {
      if($SM.get('stores["i armour"]', true) === 0 && World.getDistance() >= 8) {
        World.danger = true;
        return true;
      }
      if($SM.get('stores["s armour"]', true) === 0 && World.getDistance() >= 18) {
        World.danger = true;
        return true;
      }
    } else {
      if(World.getDistance() < 8) {
        World.danger = false;
        return true;
      }
      if(World.getDistance() < 18 && $SM.get('stores["i armour"]', true) > 0) {
        World.danger = false;
        return true;
      }
    }
    return false;
  },

  useSupplies: function() {
    World.foodMove++;
    World.waterMove++;
    // Food
    var movesPerFood = World.MOVES_PER_FOOD;
    movesPerFood *= $SM.hasPerk('slow metabolism') ? 2 : 1;
    if(World.foodMove >= movesPerFood) {
      World.foodMove = 0;
      var num = Path.outfit['cured meat'];
      num--;
      if(num === 0) {
        Notifications.notify(World, _('the meat has run out'));
      } else if(num < 0) {
        // Starvation! Hooray!
        num = 0;
        if(!World.starvation) {
          Notifications.notify(World, _('starvation sets in'));
          World.starvation = true;
        } else {
          $SM.set('character.starved', $SM.get('character.starved', true));
          $SM.add('character.starved', 1);
          if($SM.get('character.starved') >= 10 && !$SM.hasPerk('slow metabolism')) {
            $SM.addPerk('slow metabolism');
          }
          World.die();
          return false;
        }
      } else {
        World.starvation = false;
        World.setHp(World.health + World.meatHeal());
      }
      Path.outfit['cured meat'] = num;
    }
    // Water
    var movesPerWater = World.MOVES_PER_WATER;
    movesPerWater *= $SM.hasPerk('desert rat') ? 2 : 1;
    if(World.waterMove >= movesPerWater) {
      World.waterMove = 0;
      var water = World.water;
      water--;
      if(water === 0) {
        Notifications.notify(World, _('there is no more water'));
      } else if(water < 0) {
        water = 0;
        if(!World.thirst) {
          Notifications.notify(World, _('the thirst becomes unbearable'));
          World.thirst = true;
        } else {
          $SM.set('character.dehydrated', $SM.get('character.dehydrated', true));
          $SM.add('character.dehydrated', 1);
          if($SM.get('character.dehydrated') >= 10 && !$SM.hasPerk('desert rat')) {
            $SM.addPerk('desert rat');
          }
          World.die();
          return false;
        }
      } else {
        World.thirst = false;
      }
      World.setWater(water);
      World.updateSupplies();
    }
    return true;
  },

  meatHeal: function() {
    return World.MEAT_HEAL * ($SM.hasPerk('gastronome') ? 2 : 1);
  },

  medsHeal: function() {
    return World.MEDS_HEAL;
  },

  hypoHeal: () => World.HYPO_HEAL,

  checkFight: function() {
    World.fightMove = typeof World.fightMove == 'number' ? World.fightMove : 0;
    World.fightMove++;
    if(World.fightMove > World.FIGHT_DELAY) {
      var chance = World.FIGHT_CHANCE;
      chance *= $SM.hasPerk('stealthy') ? 0.5 : 1;
      if(Math.random() < chance) {
        World.fightMove = 0;
        Events.triggerFight();
      }
    }
  },

  doSpace: function() {
    var curTile = World.getTile(World.state.map, World.curPos[0], World.curPos[1]);

    if(curTile == World.TILE.VILLAGE) {
      World.goHome();
    } else if(curTile === World.TILE.EXECUTIONER) {
      // Old saves may already have completed the introductory expedition.
      if (World.state.executioner) World.claimLatticeShard('executioner');
      const scene = World.state.executioner ? 'executioner-antechamber' : 'executioner-intro';
      const sceneData = Events.Executioner[scene];
      Events.startEvent(sceneData);
    } else if(typeof World.LANDMARKS[curTile] != 'undefined') {
      if(curTile != World.TILE.OUTPOST || !World.outpostUsed()) {
        Events.startEvent(Events.Setpieces[World.LANDMARKS[curTile].scene]);
      }
    } else {
      if(World.useSupplies()) {
        World.checkFight();
      }
    }
  },

  getDistance: function(from, to) {
    from = from || World.curPos;
    to = to || World.VILLAGE_POS;
    return Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
  },

  getTerrain: function() {
    return World.getTile(World.state.map, World.curPos[0], World.curPos[1]);
  },

  getDamage: function(thing) {
    var weapon = World.Weapons[thing], damage = weapon.damage;
    if(typeof damage !== 'number') return damage;
    var guns = { rifle: 8, 'laser rifle': 12, 'plasma rifle': 15 };
    if($SM.hasPerk('sharpshooter') && guns[thing]) damage = guns[thing];
    if(weapon.type === 'unarmed') {
      if($SM.hasPerk('boxer')) damage *= 2;
      if($SM.hasPerk('martial artist')) damage *= 3;
      if($SM.hasPerk('unarmed master')) damage *= 2;
    }
    if(weapon.type === 'melee' && $SM.hasPerk('barbarian')) damage = Math.floor(damage * 1.5);
    return damage;
  },

  narrateMove: function(oldTile, newTile) {
    var msg = null;
    switch(oldTile) {
      case World.TILE.FOREST:
        switch(newTile) {
          case World.TILE.FIELD:
            msg = _("the trees yield to dry grass. the yellowed brush rustles in the wind.");
            break;
          case World.TILE.BARRENS:
            msg = _("the trees are gone. parched earth and blowing dust are poor replacements.");
            break;
        }
        break;
      case World.TILE.FIELD:
        switch(newTile) {
          case World.TILE.FOREST:
            msg = _("trees loom on the horizon. grasses gradually yield to a forest floor of dry branches and fallen leaves.");
            break;
          case World.TILE.BARRENS:
            msg = _("the grasses thin. soon, only dust remains.");
            break;
        }
        break;
      case World.TILE.BARRENS:
        switch(newTile) {
          case World.TILE.FIELD:
            msg = _("the barrens break at a sea of dying grass, swaying in the arid breeze.");
            break;
          case World.TILE.FOREST:
            msg = _("a wall of gnarled trees rises from the dust. their branches twist into a skeletal canopy overhead.");
            break;
        }
        break;
    }
    if(msg != null) {
      Notifications.notify(World, msg);
    }
  },

  newMask: function() {
    var mask = new Array(World.RADIUS * 2 + 1);
    for(var i = 0; i <= World.RADIUS * 2; i++) {
      mask[i] = new Array(World.RADIUS * 2 + 1);
    }
    World.setMask(mask, 0, 0, true);
    return mask;
  },

  lightMap: function(x, y, mask) {
    var r = World.LIGHT_RADIUS;
    r *= $SM.hasPerk('scout') ? 2 : 1;
    World.uncoverMap(x, y, r, mask);
    return mask;
  },

  uncoverMap: function(x, y, r, mask) {
    World.setMask(mask, x, y, true);
    for(var i = -r; i <= r; i++) {
      for(var j = -r + Math.abs(i); j <= r - Math.abs(i); j++) {
        if(World.isInBounds(x + i, y + j)) {
          World.setMask(mask, x+i, y+j, true);
        }
      }
    }
  },

  testMap: function() {
    if(!World.seenAll) {
      var dark; 
      var mask = $SM.get('game.world.mask');
      loop:
      for(var i = -World.RADIUS; i <= World.RADIUS; i++) {
        for(var j = -World.RADIUS; j <= World.RADIUS; j++) {
          if(!World.getMask(mask, i, j)) {
            dark = true;
            break loop;
          }
        }
      }
      World.seenAll = !dark;
    }
  },

  applyMap: function() {
    var mask = $SM.get('game.world.mask'), unseen = [];
    for (var x = -World.RADIUS; x <= World.RADIUS; x++) {
      for (var y = -World.RADIUS; y <= World.RADIUS; y++) {
        if (!World.getMask(mask, x, y)) unseen.push([x, y]);
      }
    }
    if (unseen.length) {
      var pos = unseen[Math.floor(Math.random() * unseen.length)];
      World.uncoverMap(pos[0], pos[1], 5, mask);
    }
    World.testMap();
  },

  generateMap: function() {
    // Retry the complete candidate world, never drop a site or relax its constraints.
    for (var attempt = 1; attempt <= World.MAP_GENERATION_ATTEMPTS; attempt++) {
      World.mapGenerationAttempts = attempt;
      try { return World.generateMapAttempt(); }
      catch (error) {
        if (error.code !== 'LANDMARK_PLACEMENT' || attempt === World.MAP_GENERATION_ATTEMPTS) throw error;
      }
    }
  },

  generateMapAttempt: function() {
    var map = new Array(World.RADIUS * 2 + 1);
    for(var i = 0; i <= World.RADIUS * 2; i++) {
      map[i] = new Array(World.RADIUS * 2 + 1);
    }
    // The Village is always at the exact center
    // Spiral out from there
    World.setTile(map, 0, 0, World.TILE.VILLAGE);
    for(var r = 1; r <= World.RADIUS; r++) {
      for(var t = 0; t < r * 8; t++) {
        var x, y;
        if(t < 2 * r) {
          x = -r + t;
          y = -r;
        } else if(t < 4 * r) {
          x = r;
          y = -(3 * r) + t;
        } else if(t < 6 * r) {
          x = (5 * r) - t;
          y = r;
        } else {
          x = -r;
          y = (7 * r) - t;
        }

        World.setTile(map, x, y, World.chooseTile(x, y, map));
      }
    }

    // Reserve the mines and unique quest locations before the common sites.
    var types = Object.keys(World.LANDMARKS).filter(function(k) { return World.LANDMARKS[k].num; });
    types.sort(function(a, b) {
      var first = World.LANDMARKS[a], second = World.LANDMARKS[b];
      return (first.num > 1) - (second.num > 1) ||
        (first.maxRadius - first.minRadius) - (second.maxRadius - second.minRadius);
    });
    var placement = World.createLandmarkPlacement(map);
    for(var i = 0; i < types.length; i++) {
      var k = types[i];
      var landmark = World.LANDMARKS[k];
      var quadrants = landmark.num >= 4 ? [0, 0, 0, 0] : null;
      for(var l = 0; l < landmark.num; l++) {
        World.placeLandmark(landmark.minRadius, landmark.maxRadius, k, map, quadrants, placement);
      }
    }

    return map;
  },

  mapSearch: function(target, map, required) {
    var targets = [];
    for (var x = -World.RADIUS; x <= World.RADIUS; x++) {
      for (var y = -World.RADIUS; y <= World.RADIUS; y++) {
        if ((World.getTile(map, x, y) || '').charAt(0) === target) {
          targets.push({ x: x, y: y });
          if (required && targets.length >= required) return targets;
        }
      }
    }
    return targets;
  },

  compassDir: function(pos){
    var dir = '';
    var horz = pos.x < 0 ? 'west' : 'east';
    var vert = pos.y < 0 ? 'north' : 'south';
    if(Math.abs(pos.x) / 2 > Math.abs(pos.y)) {
      dir = horz;
    } else if(Math.abs(pos.y) / 2 > Math.abs(pos.x)){
      dir = vert;
    } else {
      dir = vert + horz;
    }
    return dir;
  },

  landmarkQuadrant: function(x, y) {
    // Assign each axis to one quadrant, preserving rotational symmetry.
    return x > 0 && y >= 0 ? 0 : x <= 0 && y > 0 ? 1 : x < 0 && y <= 0 ? 2 : 3;
  },

  landmarkSeparation: function(x, y, otherX, otherY) {
    // The inner exception is symmetric: crossing the d=10 boundary still requires five.
    if (World.RADIUS < 45 || (Math.abs(x) + Math.abs(y) <= World.INNER_LANDMARK_RADIUS &&
        Math.abs(otherX) + Math.abs(otherY) <= World.INNER_LANDMARK_RADIUS)) {
      return World.INNER_LANDMARK_SEPARATION;
    }
    return World.LANDMARK_SEPARATION;
  },

  blockLandmarkSpace: function(blocked, x, y) {
    var radius = World.RADIUS;
    for (var dx = 1 - World.LANDMARK_SEPARATION; dx < World.LANDMARK_SEPARATION; dx++) {
      var reach = World.LANDMARK_SEPARATION - 1 - Math.abs(dx);
      for (var dy = -reach; dy <= reach; dy++) {
        if (x + dx < -radius || x + dx > radius || y + dy < -radius || y + dy > radius) continue;
        if (Math.abs(dx) + Math.abs(dy) >= World.landmarkSeparation(x, y, x + dx, y + dy)) continue;
        blocked[x + dx + radius][y + dy + radius] = true;
      }
    }
  },

  createLandmarkPlacement: function(map) {
    var radius = World.RADIUS, size = radius * 2 + 1;
    var blocked = Array.from({ length: size }, function() { return new Array(size).fill(false); });
    for (var x = -radius; x <= radius; x++) for (var y = -radius; y <= radius; y++) {
      if (!World.isTerrain(map[x + radius][y + radius])) World.blockLandmarkSpace(blocked, x, y);
    }
    return blocked;
  },

  placeLandmark: function(minRadius, maxRadius, landmark, map, quadrants, placement) {
    // Enumerate legal cells: no radius bias, unbounded retries or relaxed spacing.
    var candidates = [[], [], [], []], radius = World.RADIUS;
    var blocked = placement || World.createLandmarkPlacement(map);
    for (var x = -radius; x <= radius; x++) {
      for (var y = -radius; y <= radius; y++) {
        var d = Math.abs(x) + Math.abs(y);
        if (d >= minRadius && d <= maxRadius && !blocked[x + radius][y + radius]) {
          candidates[World.landmarkQuadrant(x, y)].push([x, y]);
        }
      }
    }
    var eligible = [];
    var least = quadrants ? Math.min.apply(null, quadrants) : 0;
    for (var q = 0; q < 4; q++) {
      if (!quadrants || quadrants[q] === least) eligible = eligible.concat(candidates[q]);
    }
    if (!eligible.length) {
      var error = new Error('No terrain available for landmark ' + landmark + ' with required spacing');
      error.code = 'LANDMARK_PLACEMENT';
      throw error;
    }
    var pos = eligible[Math.floor(Math.random() * eligible.length)];
    World.setTile(map, pos[0], pos[1], landmark);
    World.blockLandmarkSpace(blocked, pos[0], pos[1]);
    if (quadrants) quadrants[World.landmarkQuadrant(pos[0], pos[1])]++;
    return pos;
  },

  isTerrain: function(tile) {
    return tile == World.TILE.FOREST || tile == World.TILE.FIELD || tile == World.TILE.BARRENS;
  },

  chooseTile: function(x, y, map) {

    var adjacent = [
      World.getTile(map, x, y-1), World.getTile(map, x, y+1),
      World.getTile(map, x+1, y), World.getTile(map, x-1, y)
    ];

    var chances = {};
    var nonSticky = 1;
    var cur;
    for(var i in adjacent) {
      if(adjacent[i] == World.TILE.VILLAGE) {
        // Village must be in a forest to maintain thematic consistency, yo.
        return World.TILE.FOREST;
      } else if(typeof adjacent[i] == 'string') {
        cur = chances[adjacent[i]];
        cur = typeof cur == 'number' ? cur : 0;
        chances[adjacent[i]] = cur + World.STICKINESS;
        nonSticky -= World.STICKINESS;
      }
    }
    for(var t in World.TILE) {
      var tile = World.TILE[t];
      if(World.isTerrain(tile)) {
        cur = chances[tile];
        cur = typeof cur == 'number' ? cur : 0;
        cur += World.TILE_PROBS[tile] * nonSticky;
        chances[tile] = cur;
      }
    }

    var list = [];
    for(var j in chances) {
      list.push(chances[j] + '' + j);
    }
    list.sort(function(a, b) {
      var n1 = parseFloat(a.substring(0, a.length - 1));
      var n2 = parseFloat(b.substring(0, b.length - 1));
      return n2 - n1;
    });

    var c = 0;
    var r = Math.random();
    for(var l in list) {
      var prob = list[l];
      c += parseFloat(prob.substring(0,prob.length - 1));
      if(r < c) {
        return prob.charAt(prob.length - 1);
      }
    }

    return World.TILE.BARRENS;
  },

  markVisited: function(x, y) {
    World.setTile(World.state.map, x, y, World.getTile(World.state.map, x, y).charAt(0) + '!');
  },

  getMapView: function() {
    var farthest = Math.max(Math.abs(World.curPos[0]), Math.abs(World.curPos[1]));
    for(var x = -World.RADIUS; x <= World.RADIUS; x++) {
      for(var y = -World.RADIUS; y <= World.RADIUS; y++) {
        if(World.getMask(World.state.mask, x, y)) farthest = Math.max(farthest, Math.abs(x), Math.abs(y));
      }
    }
    var size = Math.min(World.RADIUS * 2 + 1,
      Math.max(World.state.mapViewSize || 10, 10 * Math.ceil((2 * farthest + 4) / 10)));
    World.state.mapViewSize = size;
    var min = -Math.floor(size / 2);
    return { size: size, min: min, max: min + size - 1 };
  },

  drawMap: function() {
    var map = $('#map');
    if(map.length === 0) {
      map = new $('<div>').attr('id', 'map').appendTo('#worldOuter');
      // register click handler
      map.click(World.click);
    }
    var view = World.getMapView();
    // Render caches belong to the DOM, not the save. Rebuild only when the grid size
    // or element changes; all other redraws compare cells against their last output.
    var cache = World._mapRender;
    var rebuild = !map[0] || !cache || cache.element !== map[0] || cache.size !== view.size;
    if(rebuild) {
      // The bundled jQuery predates CSS custom properties.
      if(map[0]) map[0].style.setProperty('--map-cells', String(view.size));
      map.attr('data-cells', view.size);
    }
    var contents = [], index = 0;
    var mapString = "";
    for(var j = view.min; j <= view.max; j++) {
      for(var i = view.min; i <= view.max; i++) {
        var cell = '';
        var ttClass = "";
        if(i > 0) {
          ttClass += " left";
        } else {
          ttClass += " right";
        }
        if(j > 0) {
          ttClass += " top";
        } else {
          ttClass += " bottom";
        }
        if(World.curPos[0] == i && World.curPos[1] == j) {
          cell = '<span class="landmark">@<div class="tooltip ' + ttClass + '">'+_('Wanderer')+'</div></span>';
        } else if(World.getMask(World.state.mask, i, j)) {
          var c = World.getTile(World.state.map, i, j);
          switch(c) {
            case World.TILE.VILLAGE:
              cell = '<span class="landmark">' + c + '<div class="tooltip' + ttClass + '">'+_('The&nbsp;Village')+'</div></span>';
              break;
            default:
              if(typeof World.LANDMARKS[c] != 'undefined' && (c != World.TILE.OUTPOST || !World.outpostUsed(i, j))) {
                cell = '<span class="landmark">' + c + '<div class="tooltip' + ttClass + '">' + World.LANDMARKS[c].label + '</div></span>';
              } else {
                if(c.length > 1) {
                  c = c[0];
                }
                cell = c;
              }
              break;
          }
        } else {
          cell = '&nbsp;';
        }
        if(rebuild) mapString += '<span class="mapCell">' + cell + '</span>';
        else if(cache.contents[index] !== cell) cache.cells[index].innerHTML = cell;
        contents.push(cell);
        index++;
      }
      if(rebuild && j < view.max) mapString += '<br/>';
    }
    if(rebuild) {
      map.html(mapString);
      if(map[0]) World._mapRender = { element: map[0], size: view.size, contents: contents,
        cells: map[0].querySelectorAll('.mapCell') };
    } else cache.contents = contents;
    var scale = $('#mapScale');
    if(!scale.length) scale = $('<div>').attr('id', 'mapScale').appendTo('#worldOuter');
    if(rebuild) scale.text(_('map extent: {0} × {1}', view.size, view.size));
    World.updateMapLegend();
  },

  die: function() {
    if(!World.dead) {
      Events.clearTimeouts();
      World.dead = true;
      Engine.log('player death');
      Engine.event('game event', 'death');
      Engine.keyLock = true;
      // Dead! Discard any world changes and go home
      Notifications.notify(World, _('the world fades'));
      World.state = null;
      Path.outfit = {};
      $SM.remove('outfit');
      AudioEngine.playSound(AudioLibrary.DEATH);
      $('#outerSlider').animate({opacity: '0'}, 600, 'linear', function() {
        $('#outerSlider').css('left', '0px');
        $('#locationSlider').css('left', '0px');
        $('#storesContainer').css({'top': '0px', 'right': '0px'});
        Engine.setActiveModule(Room);
        $('div.headerButton').removeClass('selected');
        Room.tab.addClass('selected');
        Engine.setTimeout(function(){
          Room.onArrival();
          $('#outerSlider').animate({opacity:'1'}, 600, 'linear');
          Button.cooldown($('#embarkButton'));
          Engine.keyLock = false;
          Engine.tabNavigation = true;
        }, 2000, true);
      });
    }
  },

  goHome: function() {
    // Home safe! Commit the changes.
    World.commitWorld();
    World.testMap();

    if(World.state.sulphurmine && $SM.get('game.buildings["sulphur mine"]', true) === 0) {
      $SM.add('game.buildings["sulphur mine"]', 1);
      Engine.event('progress', 'sulphur mine');
    }
    if(World.state.ironmine && $SM.get('game.buildings["iron mine"]', true) === 0) {
      $SM.add('game.buildings["iron mine"]', 1);
      Engine.event('progress', 'iron mine');
    }
    if(World.state.coalmine && $SM.get('game.buildings["coal mine"]', true) === 0) {
      $SM.add('game.buildings["coal mine"]', 1);
      Engine.event('progress', 'coal mine');
    }
    if(World.state.ship && !$SM.get('features.location.spaceShip')) {
      Ship.init();
      Engine.event('progress', 'ship');
    }
    if (World.state.executioner && !$SM.get('features.location.fabricator')) {
      Fabricator.init();
      Notifications.notify(null, _('builder knows the strange device when she sees it. takes it for herself real quick. doesn’t ask where it came from.'));
      Engine.event('progress', 'fabricator');
    }
    World.redeemBlueprints();
    World.redeemIndustry();
    World.state = null;

    if(Path.outfit['cured meat'] > 0) {
      Button.setDisabled($('#embarkButton'), false);
    }

    World.returnOutfit();

    $('#outerSlider').animate({left: '0px'}, 300);
    Engine.setActiveModule(Path);
    Path.onArrival();
    Engine.restoreNavigation = true;
  },

  redeemBlueprints: () => {
    let redeemed = false;
    const redeem = (blueprint, item) => {
      if (Path.outfit[blueprint]) {
        $SM.set(`character.blueprints['${item}']`, true);
        delete Path.outfit[blueprint];
        redeemed = true;
      }
    };

    redeem('hypo blueprint', 'hypo');
    redeem('laser rifle blueprint', 'laser rifle');
    redeem('kinetic armour blueprint', 'kinetic armour');
    redeem('disruptor blueprint', 'disruptor');
    redeem('plasma rifle blueprint', 'plasma rifle');
    redeem('stim blueprint', 'stim');
    redeem('glowstone blueprint', 'glowstone');

    if (redeemed) {
      Notifications.notify(null, _('blueprints feed into the fabricator data port. possibilities grow.'));
    }
  },

  returnOutfit: () => {
    for(var k in Path.outfit) {
      if (k === 'lattice shard') continue; // Delivered atomically with the source ledger.
      $SM.add('stores["'+k+'"]', Path.outfit[k]);
      if(World.leaveItAtHome(k)) {
        Path.outfit[k] = 0;
      }
    }
    $SM.set('outfit', $.extend({}, Path.outfit));
  },

  leaveItAtHome: function(thing) {
     return thing != 'cured meat' && thing != 'bullets' && thing != 'energy cell'  && 
      thing != 'charm' && thing != 'medicine' && thing != 'stim' && thing != 'hypo' &&
      typeof World.Weapons[thing] == 'undefined' && typeof Room.Craftables[thing] == 'undefined';
  },

  getMaxHealth: function() {
    if($SM.get('stores["kinetic armour"]', true) > 0) {
      return World.BASE_HEALTH + 75;
    } else if($SM.get('stores["s armour"]', true) > 0) {
      return World.BASE_HEALTH + 35;
    } else if($SM.get('stores["i armour"]', true) > 0) {
      return World.BASE_HEALTH + 15;
    } else if($SM.get('stores["l armour"]', true) > 0) {
      return World.BASE_HEALTH + 5;
    }
    return World.BASE_HEALTH;
  },

  getHitChance: function() {
    if($SM.hasPerk('precise')) {
      return World.BASE_HIT_CHANCE + 0.1;
    }
    return World.BASE_HIT_CHANCE;
  },

  getMaxWater: function() {

    if($SM.get('stores["fluid recycler"]', true) > 0) {
      return World.BASE_WATER + 100;
    } else if($SM.get('stores["water tank"]', true) > 0) {
      return World.BASE_WATER + 50;
    } else if($SM.get('stores.cask', true) > 0) {
      return World.BASE_WATER + 20;
    } else if($SM.get('stores.waterskin', true) > 0) {
      return World.BASE_WATER + 10;
    }
    return World.BASE_WATER;
  },

  outpostUsed: function(x, y) {
    x = typeof x == 'number' ? x : World.curPos[0];
    y = typeof y == 'number' ? y : World.curPos[1];
    var used = World.usedOutposts[x + ',' + y];
    return typeof used != 'undefined' && used === true;
  },

  useOutpost: function() {
    Notifications.notify(null, _('water replenished'));
    World.setWater(World.getMaxWater());
    // Mark this outpost as used
    World.usedOutposts[World.curPos[0] + ',' + World.curPos[1]] = true;
  },

  onArrival: function() {
    Engine.tabNavigation = false;
    // Clear the embark cooldown
    Button.clearCooldown($('#embarkButton'));
    Engine.keyLock = false;
    // Explore in a temporary world-state. We'll commit the changes if you return home safe.
    World.state = $.extend(true, {}, $SM.get('game.world'));
    // State.outfit holds village loadout preferences, never uncommitted expedition loot.
    Path.outfit = $.extend({}, Path.outfit);
    World.setWater(World.getMaxWater());
    World.setHp(World.getMaxHealth());
    World.foodMove = 0;
    World.waterMove = 0;
    World.starvation = false;
    World.thirst = false;
    World.usedOutposts = {};
    World.curPos = World.copyPos(World.VILLAGE_POS);
    World.drawMap();
    World.setTitle();
    AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_WORLD);
    World.dead = false;
    $('div#bagspace-world > div').empty();
    World.updateSupplies();
    $('#bagspace-world').width($('#map').width());
  },

  setTitle: function() {
    document.title = _('A Barren World');
  },

  copyPos: function(pos) {
    return [pos[0], pos[1]];
  },

  handleStateUpdates: function(e){

  }
};
