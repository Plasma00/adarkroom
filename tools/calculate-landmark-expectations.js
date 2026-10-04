// Analytic finite sums only: no random draws or map generation.
import fs from 'node:fs';
const source = fs.readFileSync('script/world.js', 'utf8');
const definitions = [...source.matchAll(/World\.LANDMARKS\[World\.TILE\.([A-Z_]+)\] = \{ num: (\d+), minRadius: (\d+), maxRadius: (\d+)/g)]
  .map(([, type, n, a, b]) => ({ type, n: +n, a: +a, b: +b })).filter(x => x.n > 0);
const translationSource = fs.readFileSync('lang/zh_cn/strings.js', 'utf8');
const chinese = JSON.parse(translationSource.slice(translationSource.indexOf('{'), translationSource.lastIndexOf('}') + 1));
for (const definition of definitions) {
  const line = source.split('\n').find(line => line.includes(`World.LANDMARKS[World.TILE.${definition.type}] =`));
  const label = line.match(/(?:'label'|label):\s*_\('([^']+)'\)/)?.[1];
  definition.name = (chinese[label] || label || definition.type).replace(/&nbsp;/g, ' ');
}
const probabilityInBounds = (radius, d) => d <= radius ? 1 : Math.max(0, (2 * radius - d + 1) / (d + 1));
const shellCells = (radius, d) => d === 0 ? 1 : d <= radius ? 4 * d : Math.max(0, 4 * (2 * radius - d + 1));
function expectations(radius) {
  const perDistance = Array.from({length: 2 * radius + 1}, (_, d) => ({ distance: d, cells: shellCells(radius, d), expected: 0, byType: {} }));
  for (const { type, n, a, b } of definitions) {
    const weights = Array.from({ length: b - a + 1 }, (_, i) => probabilityInBounds(radius, a + i));
    const total = weights.reduce((a,b) => a+b, 0);
    if (!total) throw new Error(`${type}: no valid distance for radius ${radius}`);
    weights.forEach((weight, i) => {
      if (!weight) return;
      const row = perDistance[a+i], count = n * weight / total;
      row.expected += count; row.byType[type] = count;
    });
  }
  const bands = [];
  for (let low = 1; low <= 2 * radius; low += 10) {
    const high = Math.min(low + 9, 2 * radius), rows = perDistance.slice(low, high + 1);
    const expected = rows.reduce((sum, row) => sum + row.expected, 0);
    const cells = rows.reduce((sum, row) => sum + row.cells, 0);
    bands.push({ low, high, cells, expected, per100Cells: 100 * expected / cells });
  }
  return { radius, total: definitions.reduce((sum,x) => sum+x.n, 0), bands, perDistance };
}
const current = expectations(30), proposed = expectations(45);
const result = { method: 'Finite-sum conditional expectation accounting for boundary rejection; ignores occupied-cell rejection.', definitions, current, proposed };
fs.writeFileSync('projectdev/fix-260915-combat-dialog/landmark-expectations.json', JSON.stringify(result, null, 2) + '\n');
const rows = proposed.bands.map((band, i) => {
  const old = current.bands[i];
  return `| ${band.low}–${band.high} | ${old ? old.expected.toFixed(2) : '—'} | ${band.expected.toFixed(2)} | ${band.cells} | ${old ? old.per100Cells.toFixed(2) : '—'} | ${band.per100Cells.toFixed(2)} |`;
}).join('\n');
const types = definitions.map(x => x.type);
fs.writeFileSync('doc/map-radius45-expectations.csv', ['distance,cells,expected,' + types.join(','),
  ...proposed.perDistance.slice(1).map(row => [row.distance, row.cells, row.expected.toFixed(6),
    ...types.map(type => (row.byType[type] || 0).toFixed(6))].join(','))].join('\n') + '\n');
const report = `# 半径45地图的地点数期望（解析计算）

半径从30扩大到45，完整地图从61×61变为91×91。以下沿用当前地点数量、生成距离和生成算法；没有修改地图配置，没有随机抽样或生成地图。首周目地点总数136，原点村庄另计1；前哨初始为0。继承时的遗址另加u个（最多5个），全部计入51–60段。

距离采用游戏的曼哈顿距离 d=|x|+|y|，不同于显示窗口使用的 max(|x|,|y|)。新地图最远距离为90。每个距离壳层的格数是：d=1…45时为4d，d=46…90时为4(91−d)。

## 计算口径

当前生成器先在闭区间[a,b]均匀选整数距离d，再均匀选整数x∈[0,d]并令y=d−x，随机翻转正负号。越界或遇到已有地点时会重抽距离，因此不能直接把数量除以距离区间长度。

先考虑边界拒绝：q(d)=1（d≤45），q(d)=(91−d)/(d+1)（45<d≤90）。单种数量n、距离限制[a,b]在距离d的期望为 n×q(d)/Σ(q(k), k=a…b)。对所有类型及目标距离段求和得到下表。q(d)不是壳层格数比例，因为原生成器对坐标轴上的点有不同的提议概率。

这是**考虑边界、忽略地点互斥及500次重试兜底的理论期望**，不是实际生成器包含全部碰撞相关性的精确期望。已有地点占位会造成额外偏移；表中保留两位小数仅便于比较。总数136和距离61…90没有初始地点则是确定结论。

## 距离段结果

| 距离 | 当前半径30期望 | 新半径45期望 | 新区域格数 | 当前每100格地点 | 新每100格地点 |
|---|---:|---:|---:|---:|---:|
${rows}

新地图共有8280个非村庄格，136个地点的全图平均密度为1.64个/100格；旧地图为3.66个/100格，平均降低约55%。但d≤30的格子集合完全未改变，小木屋、洞穴、小镇、矿山等的距离范围也未改变，早期密集感不会随扩图一起明显降低。

所有初始地点仍止于d=60。新地图d=61…90共有1860格，占全图约22.5%，没有初始地标；d≤60的6420个非村庄格平均有2.12个地点/100格。现有后期常规敌人的有效距离也止于60，外侧只有尚未遇过的修理车等例外，因此若要利用外围区域，还必须同步设计地点和遭遇范围。

## 当前配置

| 类型 | 数量 | 距离闭区间 |
|---|---:|---|
${definitions.map(x => `| ${x.name} | ${x.n} | ${x.a}–${x.b} |`).join('\n')}

全部90个整数距离、各类型的贡献见 [CSV](map-radius45-expectations.csv)。原始数值和计算脚本分别位于 projectdev/fix-260915-combat-dialog/landmark-expectations.json 和 tools/calculate-landmark-expectations.js。

## 对“场景密集”的区分

地点生成密度与随机战斗频率是两套机制。目前经过3次普通地形移动的保护期后，每次检查有20%概率触发遭遇，有潜行专长时为10%。在每次触发都存在合适事件的区域，遭遇间隔期望分别为3+1/0.2=8、3+1/0.1=13次普通地形移动。地标格不走这套随机检查，触发到非战斗事件或没有合适事件也会影响实际战斗间隔。扩图不改变这些概率。

只扩大半径主要稀释中后期地点，不足以解决近村密集或现有区域的随机攻击框过频。若继续调整，应分别评估早期地点数量/距离、后期地点及敌人是否延伸到60以外，以及随机遭遇间隔；不能用扩图代替这三项配置。
`;
fs.writeFileSync('doc/map-radius45-expectations.md', report);
console.log(JSON.stringify({ total: proposed.total, current: current.bands, proposed: proposed.bands,
  lateGroup45: proposed.perDistance.filter(x => x.distance >= 35 && x.distance <= 60).map(x => ({d:x.distance, n:x.byType.FORTRESS})) }, null, 2));
