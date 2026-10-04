Events.Setpieces.scoutship = {
  title: _('A Crashed Scout Ship'),
  scenes: {
    start: {
      text: [_('a narrow hull lies broken against the hillside.'), _('two star charts flicker. one follows the sky, the other its reflection.')],
      buttons: {
        sky: { text: _('follow the steady light'), nextScene: { 1: 'chart' } },
        reflection: { text: _('follow the reflection'), nextScene: { 1: 'echo' } },
        leave: { text: _('leave'), nextScene: 'end' }
      }
    },
    echo: {
      text: [_('the reflected stars lead back to an empty observation blister.'), _('behind the glass, one unbroken line points inward.')],
      buttons: { follow: { text: _('follow the line'), nextScene: { 1: 'chart' } }, leave: { text: _('leave'), nextScene: 'end' } }
    },
    chart: {
      text: [_('pale crystal runs behind the walls.'), _('the broken lines still carry light.'), _('the chart spills its memory across the surrounding land.')],
      onLoad: () => {
        if (World.claimLatticeShard('scout')) {
          World.uncoverMap(World.curPos[0], World.curPos[1], 12, World.state.mask);
        }
        World.markVisited(World.curPos[0], World.curPos[1]);
        World.drawMap();
      },
      buttons: { leave: { text: _('take the fragment and leave'), nextScene: 'end' } }
    }
  }
};

Events.Setpieces.cargoship = {
  title: _('A Buried Transport'),
  scenes: {
    start: {
      text: [_('cargo doors jut from the sand. a single line of light remains.'), _('there is power for one hold. the guidance chamber has its own reserve.')],
      buttons: {
        cells: { text: _('power the cell racks'), nextScene: { 1: 'cells' } },
        alloy: { text: _('power the cargo lift'), nextScene: { 1: 'drone' } },
        leave: { text: _('leave'), nextScene: 'end' }
      }
    },
    cells: {
      text: [_('the racks open. the last cargo drones fall silent.')],
      loot: { 'energy cell': { min: 12, max: 12, chance: 1 } },
      buttons: { continue: { text: _('enter the guidance chamber'), nextScene: { 1: 'guidance' } } }
    },
    drone: {
      ...Enemies.Executioner.guard,
      notification: _('the lift wakes a cargo sentry.'),
      health: 120, damage: 14, attackDelay: 2.5,
      loot: { 'alien alloy': { min: 5, max: 5, chance: 1 }, 'energy cell': { min: 15, max: 15, chance: 1 } },
      deathMessage: _('the sentry folds beside the open hold.'),
      nextScene: 'guidance'
    },
    guidance: {
      text: [_('every fragment points the same way.'), _('the reserve fades as the last crystal comes free.')],
      onLoad: () => {
        World.claimLatticeShard('cargo');
        World.markVisited(World.curPos[0], World.curPos[1]);
        World.drawMap();
      },
      buttons: { leave: { text: _('take the fragment and leave'), nextScene: 'end' } }
    }
  }
};
