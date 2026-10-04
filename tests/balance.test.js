import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from './helpers/game.js';

test('inner spacing exception is symmetric and never permits overwriting a site', () => {
  const g=game(),w=g.World;
  const blank=()=>Array.from({length:91},()=>Array(91).fill('.'));
  for(const [a,b,allowed]of [
    [[5,0],[8,0],true], [[5,0],[7,0],false],
    [[7,0],[10,0],true], [[8,0],[11,0],false],
    [[6,0],[11,0],true], [[11,0],[15,0],false],
    [[0,0],[3,0],true], [[10,0],[10,0],false]
  ])for(const [from,to]of [[a,b],[b,a]]){
    const map=blank();w.setTile(map,...from,'H');
    const blocked=w.createLandmarkPlacement(map);
    assert.equal(blocked[to[0]+45][to[1]+45],!allowed,`${from} -> ${to}`);
  }
});

test('new map counts double ordinary sites only and loading does not regenerate it', () => {
  const g=game(),w=g.World;let rng=73001;
  g.Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
  g.$SM.set('previous.caches',Array.from({length:5},()=>({stores:{wood:1}})));
  w.init();
  const map=g.State.game.world.map;
  const counts={H:20,V:20,O:30,Y:40,G:20,Z:40,B:40,F:40,U:5};
  for(const [tile,n]of Object.entries(counts))assert.equal(w.mapSearch(tile,map).length,n,tile);
  for(const tile of ['I','C','S','M','W','X','K','E','D','R','T'])assert.equal(w.mapSearch(tile,map).length,1,tile);
  const before=JSON.stringify(map);
  w.generateMap=()=>{throw Error('loaded world must not regenerate');};w.init();
  assert.equal(JSON.stringify(g.State.game.world.map),before);
  assert.equal(w.LANDMARKS.H.num,20,'reinitialization does not double twice');
});

test('placement retries are bounded and unrelated errors are never swallowed', () => {
  const w=game().World;let calls=0;
  const error=Object.assign(new Error('No terrain'),{code:'LANDMARK_PLACEMENT'});
  w.generateMapAttempt=()=>{calls++;if(calls<3)throw error;return ['complete'];};
  assert.deepEqual(w.generateMap(),['complete']);assert.equal(calls,3);
  calls=0;w.generateMapAttempt=()=>{calls++;throw error;};
  assert.throws(()=>w.generateMap(),/No terrain/);assert.equal(calls,8);
  calls=0;w.generateMapAttempt=()=>{calls++;throw Error('unexpected');};
  assert.throws(()=>w.generateMap(),/unexpected/);assert.equal(calls,1);
});

test('deep guards scale at 65 through the actual scene entry and reset on return', () => {
  const g=game(),e=g.Events,w=g.World;
  const expected={sentry:[[85,10],[115,13]],raiders:[[75,11],[105,14]],hound:[[95,9],[125,12]],turret:[[85,11],[115,14]]};
  let shown;
  e.startCombat=scene=>{shown=[scene.health,scene.damage];};
  for(const [id,stats]of Object.entries(expected)){
    e.eventStack=[e.Setpieces[id==='turret'?'battlefield':'fortress']];
    for(const [d,tier]of [[64,0],[65,1],[90,1],[45,0],[65,1]]){
      w.getDistance=()=>d;e.loadScene(id);assert.deepEqual(shown,stats[tier],`${id}@${d}`);
    }
  }
});

test('industrial threats grow and sulfur remains accessible before gun production', () => {
  const g=game(),s=g.Events.Setpieces;
  assert.deepEqual(['a1','a2','a3'].map(k=>[s.sulphurmine.scenes[k].health,s.sulphurmine.scenes[k].damage]),[[35,5],[40,6],[55,8]]);
  const guards=[s.crystalworks.scenes.beast,s.chemicalworks.scenes.stalker,s.assemblyworks.scenes.scavenger];
  for(let i=1;i<guards.length;i++)assert(guards[i].health*guards[i].damage/guards[i].attackDelay>guards[i-1].health*guards[i-1].damage/guards[i-1].attackDelay);
  const middle=g.Events.Encounters.find(e=>e.scenes.start.enemy==='feral terror').scenes.start;
  const late=g.Events.Frontier.encounters[0].scenes.start;
  assert(middle.health*middle.damage/middle.attackDelay<late.health*late.damage/late.attackDelay);
  const cargo=s.cargoship.scenes;
  assert.equal(cargo.drone.health,120);assert.equal(cargo.drone.damage,14);
  assert.equal(cargo.cells.buttons.continue.nextScene[1],'guidance');
  assert.equal(cargo.drone.nextScene,'guidance');
});

test('expanded common-site materials grow moderately while ammunition and quests remain intact', () => {
  const s=game().Events.Setpieces;
  const mean=l=>l.chance*(l.min===l.max?l.min:(l.min+l.max-1)/2);
  const groups=[[20,s.warehouse.scenes.stores.loot],[40,s.fortress.scenes.well.loot],[40,s.battlefield.scenes.salvage.loot]];
  for(const [key,baseline]of [['crystal',1010],['steel',1060]]){
    const total=groups.reduce((n,[count,loot])=>n+count*mean(loot[key]),0);
    assert(total/baseline>=1.2&&total/baseline<=1.4,`${key}: ${total}`);
  }
  assert.equal(groups.reduce((n,[count,l])=>n+count*mean(l['energy cell']),0),460);
  assert.equal(40*mean(s.battlefield.scenes.salvage.loot['laser rifle']),12);
  assert.equal(s.cargoship.scenes.cells.loot['energy cell'].min,12);
  assert.equal(s.cargoship.scenes.drone.loot['energy cell'].min,15);
  assert.equal(s.crystalworks.scenes.floor.loot.crystal.min,4);
});
