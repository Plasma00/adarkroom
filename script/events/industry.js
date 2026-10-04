// Industrial discoveries commit with the expedition when the wanderer returns home.
Events.Setpieces.crystalworks = {
  title: _('Abandoned Crystal Works'),
  scenes: {
    start: {
      text: [_('thin crystal sheets rest beneath shattered glass.'), _('each is cut with impossible precision.')],
      buttons: {
        enter: { text: _('clear the cutting floor'), nextScene: { 1: 'beast' } },
        leave: { text: _('leave'), nextScene: 'end' }
      }
    },
    beast: {
      combat: true, enemy: 'crystal den beast', enemyName: _('crystal den beast'), chara: 'B',
      notification: _('a pale beast rises from the shards beneath the cutting tables.'),
      health: 45, damage: 6, hit: 0.8, attackDelay: 2.5, ranged: false,
      loot: {}, deathMessage: _('the beast falls. the cutting floor is quiet.'),
      nextScene: 'floor'
    },
    floor: {
      text: [_('human hands copied the pattern. poorly.'), _('the cutters can still be worked. the village could use them.')],
      loot: { crystal: { min: 4, max: 4, chance: 1 } },
      onLoad: () => World.completeIndustry('crystal'),
      buttons: { leave: { text: _('mark the route home'), nextScene: 'end' } }
    }
  }
};

Events.Setpieces.chemicalworks = {
  title: _('A Chemical Works'),
  scenes: {
    start: {
      text: [_('dry channels run between the corrosion tanks.'), _('yellow residue cakes the filters. sulphur, once carefully measured.')],
      buttons: {
        drain: { text: _('follow the drainage channels'), nextScene: { 1: 'stalker' } },
        leave: { text: _('leave'), nextScene: 'end' }
      }
    },
    stalker: {
      combat: true, enemy: 'drain stalker', enemyName: _('drain stalker'), chara: 'S',
      notification: _('claws scrape the channel walls. something blocks the way to the filters.'),
      health: 55, damage: 7, hit: 0.8, attackDelay: 2.5, ranged: false,
      loot: {}, deathMessage: _('the creature sinks into the dry channel. the filters are within reach.'),
      nextScene: 'filters'
    },
    filters: {
      text: [_('beneath the residue, fine grooves trace a familiar pattern.'), _('these tools could etch new paths through crystal.')],
      onLoad: () => World.completeIndustry('etching'),
      loot: { sulphur: { min: 20, max: 20, chance: 1 } },
      buttons: { leave: { text: _('mark the route home'), nextScene: 'end' } }
    }
  }
};

Events.Setpieces.assemblyworks = {
  title: _('A Precision Assembly Plant'),
  scenes: {
    start: {
      text: [_('steel frames stand in silent rows.'), _('tiny joints hold each piece exactly where it belongs.')],
      buttons: {
        inspect: { text: _('inspect the frames'), nextScene: { 1: 'scavenger' } },
        leave: { text: _('leave'), nextScene: 'end' }
      }
    },
    scavenger: {
      combat: true, enemy: 'armoured scavenger', enemyName: _('armoured scavenger'), chara: 'S',
      notification: _('a scavenger steps between the frames, steel plates strapped across its chest.'),
      health: 75, damage: 9, hit: 0.8, attackDelay: 2.5, ranged: true,
      loot: {}, deathMessage: _('the scavenger collapses against a frame. the workshop is yours.'),
      nextScene: 'frames'
    },
    frames: {
      text: [_('a frame small enough for the ship. others large enough for shelter.'), _('the shapes can be copied. the light inside them cannot.')],
      onLoad: () => World.completeIndustry('assembly'),
      loot: { steel: { min: 10, max: 10, chance: 1 } },
      buttons: { leave: { text: _('mark the route home'), nextScene: 'end' } }
    }
  }
};
