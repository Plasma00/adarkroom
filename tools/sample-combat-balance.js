// Direct-damage sensitivity model, not an automated full playthrough.
// Full HP at start of sequence; health, ammunition and healing cooldowns carry across fights.
// Player actions have 0.2s reaction delay and a shared 0.2s input interval.
// No control/status skills, loot pickup, walking regeneration or unlocked-perk acquisition.
import fs from 'node:fs';
import { game } from '../tests/helpers/game.js';
const g=game(),w=g.World,s=g.Events.Setpieces;
const old=(scene,health,damage,attackDelay=scene.attackDelay)=>({...scene,health,damage,attackDelay});
const enemy=(scene,distance=45)=>{w.getDistance=()=>distance;scene.onLoad?.();return {...scene};};
const forest=g.Events.Encounters.find(e=>e.scenes.start.enemy==='feral terror').scenes.start;
const sets={
 steel:{hp:45,weapons:['steel sword'],meat:10,medicine:3,bullets:0,cells:0},
 rifle:{hp:45,weapons:['steel sword','rifle'],meat:5,medicine:3,bullets:40,cells:0},
 laser:{hp:45,weapons:['bayonet','laser rifle'],meat:5,medicine:3,bullets:0,cells:30},
 end:{hp:85,weapons:['energy blade','plasma rifle'],meat:5,medicine:3,bullets:0,cells:30},
 veteran:{hp:45,weapons:['bayonet','laser rifle'],meat:5,medicine:3,bullets:0,cells:30,trained:true},
};
function run(enemies,gear,seed) {
 let rng=seed,random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
 g.State.character.perks=gear.trained?{barbarian:true,precise:true,evasive:true,sharpshooter:true}:{};
 const weapons=gear.weapons.map(name=>({damage:w.getDamage(name),cd:w.Weapons[name].cooldown*10,cost:w.Weapons[name].cost,ready:2}));
 let hp=gear.hp,time=0,nextInput=2,damageTaken=0,shots=0;
 const ammo={bullets:gear.bullets,'energy cell':gear.cells};
 const aids=[{n:gear.meat,heal:8,cd:50,ready:0,used:0},{n:gear.medicine,heal:20,cd:70,ready:0,used:0}];
 const heal=(time,danger)=>{for(const a of aids)if(a.n&&a.ready<=time&&(gear.hp-hp>=a.heal||hp<=danger)){
  hp=Math.min(gear.hp,hp+a.heal);a.n--;a.used++;a.ready=time+a.cd;
 }};
 for(const foe of enemies){
  let health=foe.health,nextEnemy=time+Math.round(foe.attackDelay*10);
  for(;hp>0&&health>0&&time<6000;time++){
   heal(time,foe.damage);
   if(time>=nextInput)for(const a of weapons)if(time>=a.ready&&(!a.cost||Object.entries(a.cost).every(([k,v])=>ammo[k]>=v))){
    if(a.cost){for(const [k,v]of Object.entries(a.cost))ammo[k]-=v;shots++;}
    if(random()<(gear.trained?.9:.8))health-=a.damage;
    a.ready=time+a.cd;nextInput=time+2;break;
   }
   if(health<=0)break;
   if(time>=nextEnemy){nextEnemy+=Math.round(foe.attackDelay*10);if(random()<foe.hit*(gear.trained?.8:1)){hp-=foe.damage;damageTaken+=foe.damage;}}
  }
  if(hp<=0||health>0)return {win:false,time:time/10};
  time+=10; // Continue button delay; no free full heal or cooldown reset.
 }
 return {win:true,time:time/10,hp,damageTaken,meat:aids[0].used,medicine:aids[1].used,shots};
}
const sulfur=['a1','a2','a3'].map(k=>s.sulphurmine.scenes[k]);
const cases=[
 ['sulfur before','steel',sulfur.map((f,i)=>old(f,[50,50,65][i],[8,8,10][i]))],
 ['sulfur after','steel',sulfur],['sulfur after','rifle',sulfur],
 ['forest21–44 before','rifle',[old(forest,45,6,1)]],['forest21–44 after','rifle',[forest]],
 ['forest45–64','rifle',[g.Events.Frontier.encounters[0].scenes.start]],
 ...[['crystal',s.crystalworks.scenes.beast],['chemical',s.chemicalworks.scenes.stalker],['assembly',s.assemblyworks.scenes.scavenger]].map(([k,f])=>[k,'rifle',[f]]),
 ...['rifle','laser','veteran','end'].map(k=>['plains65–90',k,[g.Events.Frontier.encounters[4].scenes.start]]),
 ['fortress45','rifle',[enemy(s.fortress.scenes.sentry,45)]],
 ['fortress65','rifle',[enemy(s.fortress.scenes.sentry,65)]],
 ['fortress65+commander','laser',[enemy(s.fortress.scenes.sentry,65),s.fortress.scenes.commander]],
 ['fortress65+commander','end',[enemy(s.fortress.scenes.sentry,65),s.fortress.scenes.commander]],
 ['cargo before','rifle',[old(s.cargoship.scenes.drone,35,6,2)]],
 ['cargo after','laser',[s.cargoship.scenes.drone]],['cargo after','end',[s.cargoship.scenes.drone]],
];
const samples=5000,rows=[];
for(const [name,gear,enemies]of cases){
 const runs=Array.from({length:samples},(_,i)=>run(enemies,sets[gear],810001+i));
 const wins=runs.filter(r=>r.win),avg=k=>wins.length?wins.reduce((n,r)=>n+r[k],0)/wins.length:null;
 rows.push({name,gear,samples,winRate:wins.length/samples,winningMean:Object.fromEntries(['time','hp','damageTaken','meat','medicine','shots'].map(k=>[k,avg(k)]))});
}
const output='projectdev/build-feature-261004-balance';fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(output+'/combat-sample.json',JSON.stringify({model:'direct damage with carried sequence state; no statuses or loot; not actual playthrough win rates',sets,rows},null,2)+'\n');
console.table(rows.map(r=>({case:r.name,gear:r.gear,win:100*r.winRate,time:r.winningMean.time?.toFixed(1),meat:r.winningMean.meat?.toFixed(2),medicine:r.winningMean.medicine?.toFixed(2),shots:r.winningMean.shots?.toFixed(1)})));
