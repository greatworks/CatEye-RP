# Repeater：宿主缩放、边框舍入和 CSS 读回

2026-10-13，补充 [DPR 1 原研究](repeater-box-model-evidence.md)。**本轮复现了 packaged Electron 的空外框 6.66667px：真实宿主缩放1.5时，作者的3/5/7/2边框被浏览器计算为2.66667/4.66667/6.66667/2。修复必须保留 CSS 赋值和原生几何缓存的区别，不能只放宽测试断言。**

原始 [52 项 DPR 1 结果](repeater-box-model-evidence.json) 未覆盖或改写，SHA 仍为 `23e4c30119563b3a5a0b1c03bfa8b422f6ba4ce1520c792b1c42d65e9c47ee0e`。本轮修改研究探针和共享产品测试场景，没有修改产品 runtime/model/renderer。

## 1. 复现与数量

[参数化入口](repeater-box-model-probe.mjs) 复用原 SHA-pinned jQuery、CSS 和 repeater 初始化/尺寸函数；新增 [DPR 矩阵](repeater-box-model-dpr-probes.mjs)。使用原生 Edge 155.0.4283.45，所有配置网络请求0、页面错误0。每个配置包含20个带断言的原函数场景和2份边框/量化测量表，共22份结果。

```powershell
# 真实宿主缩放：浏览器启动参数生效，context 不启用 viewport/DSF 仿真。
node research/repeater-box-model-probe.mjs --dpr=1 --scale-mode=host
node research/repeater-box-model-probe.mjs --dpr=1.25 --scale-mode=host
node research/repeater-box-model-probe.mjs --dpr=1.5 --scale-mode=host
node research/repeater-box-model-probe.mjs --dpr=2 --scale-mode=host

# 对照：只使用 Playwright context deviceScaleFactor。
node research/repeater-box-model-probe.mjs --dpr=1.25 --scale-mode=emulated
node research/repeater-box-model-probe.mjs --dpr=1.5 --scale-mode=emulated
node research/repeater-box-model-probe.mjs --dpr=2 --scale-mode=emulated
```

7种配置全部完成：**154份结果，140个场景检查、14份测量表；350次原函数 resize 与独立普通 DOM CSS setter/readback 对照逐项一致**。对照没有调用产品 helper，也不包含 Axure `_pushItems`；仅对单行模板，使用请求的尺寸差量、当前 computed CSS 尺寸和实际 computed 主方向边框执行读写，逐步严格核对 inline、computed、DOMRect，以及 root/row 的 `setResizedSize` 缓存。每一组还核对减去 computed border 的原点和同根 DOM 刷新恢复。

无参数重跑仍执行原52项，但现在写入 `repeater-box-model-evidence-recheck.json`，保护原始证据文件。DPR 参数结果各写独立文件，不复用原输出名。

## 2. deviceScaleFactor 仿真不是宿主缩放

仅使用 `newContext({deviceScaleFactor:1.5})` 时，`window.devicePixelRatio` 确实为1.5，但这次 Edge 的 computed border 仍是3/5/7/2，空框仍是7×10。1.25和2的仿真同样没有使这些边框按宿主物理像素重新量化。

使用 `chromium.launch({args:['--force-device-scale-factor=1.5']})`，并创建 `{viewport:null}` 的 context，才重现桌面行为。**不能把读取 DPR 数字本身当作缩放边框路径已覆盖。** 新产品 E2E 额外断言实际 `border-right-width=4.66667px`，排除只有 devicePixelRatio 改变的假覆盖。

Playwright Test 的 Desktop Edge preset 还可能将默认 `deviceScaleFactor=1` 注入手动创建的 browser context。与 viewport:null 一起会抛错；host 测试显式将 deviceScaleFactor/isMobile 设为 undefined，停止该仿真。独立 Node 研究脚本没有此 test runner 默认值。

## 3. 整数边框也会改变

统一 fixture：`border=[T3,R5,B7,L2]`、layout padding `[T7,R4,B9,L6]`，单行100×20；纵向。原始 outer CSS赋值110×36。依次 Grow130×35，再 Reset100×20：

| 真实宿主缩放 | computed border T/R/B/L | 行 CSS left/top | empty computed W×H | Grow cache W×H | Reset cache W×H |
|---:|---|---|---|---|---|
| 1 | 3 / 5 / 7 / 2 | 4 / 4 | 7×10 | 150×61 | 130×56 |
| 1.25 | 2.4 / 4.8 / 6.4 / 1.6 | 4.4 / 4.6 | 6.4×8.8 | 148.8×59.8 | 127.6×53.6 |
| 1.5 | 2.66667 / 4.66667 / 6.66667 / 2 | 4 / 4.33333 | 6.66667×9.33333 | 149.333×60.3333 | 128.656×54.6562 |
| 2 | 3 / 5 / 7 / 2 | 4 / 4 | 7×10 | 150×61 | 130×56 |

empty 的 raw/cache 仍是−6×−2，inline仍为0×0。DPR不会替换这个原始几何值；它改变的是 CSS border minimum 和后续 CSS 读回。

1.5时，Reset 后 inline width/height 是 **128.666px / 54.6666px**，而 computed（也就是原函数读入缓存的字符串）是 **128.656px / 54.6562px**。DOMRect 是 **128.65625 / 54.65625**。这些数值是三个不同层次，不能互相覆盖。

`repeater.js:1279–1289` 每次从 jQuery `.css(prop)` 读当前 computed 数值，再加差量和主方向 border；1287再次读取两轴 computed 存到几何缓存。即使累计公式正确，若把 computed 返回值作为下一次 renderer 的 CSS 赋值，会多一次量化，产生与原版不同的连续缩放结果。

## 4. 小数边框、原点和 layout 量化

作者边框 `[T0.1,R0.5,B1.25,L2.9]` 的实测值：

| 宿主缩放 | computed T/R/B/L |
|---:|---|
| 1 | 1 / 1 / 1 / 2 |
| 1.25 | 0.8 / 0.8 / 0.8 / 2.4 |
| 1.5 | 0.666667 / 0.666667 / 0.666667 / 2.66667 |
| 2 | 0.5 / 0.5 / 1 / 2.5 |

额外测试包括零/极细边框 `[0,0.01,0.99,1.01]`、小数padding `[0.1,1.2,2.3,3.4]`、border-style:none，以及25个边框宽度和14个位置/尺寸输入的逐值测量表。none 的有效 border 为0，不能继续按作者 strokeWidth 加边框。

这些 Edge 样本与“正宽度至少一个宿主物理像素，其余向下到物理像素”的模式一致，但**不是跨浏览器算法保证，也不是应写进 runtime 的 DPR 公式**。前节已证明 navigator.devicePixelRatio 与实际宿主边框量化可以分离。浏览器缩放、显示器迁移、CSS zoom、继承/额外样式也不能靠作者值乘一个全局 DPR可靠重现。

原点同样要区分 CSS数值与实际位置：1.5时 native 初始化执行 `7−2.66667`，行 CSS top 为4.33333；行 DOM outer top 相对根却是6.989585876464844，而不是精确7。因为 CSS left/top 的返回字符串可以保留赋值，实际布局位置又被量化。测量表里的长度步进与该宿主下 `1/(64×scale)` 的网格一致；该表只描述此 Edge版本结果，不承诺固定1/64 CSS像素或所有引擎相同。

独立测量控制例：1.5时 width=0.1 → computed0.09375，width=0.2 →0.197917；width=4.33333 →4.32292，但 `getComputedStyle(...).left` 仍可显示4.33333。DOMRect还会有浮点精度表现。因此：native几何缓存要采用它实际读的 computed width/height，不能用 offsetWidth（整数）或 DOMRect（另一精度）代替。

## 5. 给 runtime 的合同及支持边界

建议通过真实宿主 DOM测量服务注入，而不是硬编码浏览器舍入：

1. 按最终使用的 border-width、border-style、box-sizing、padding 设置独立测量元素，读取 computed 四边。用于 native 的原点扣减及主方向 border 总和。
2. 保留当前 **CSS赋值状态** 与 **原生几何缓存** 两份数据。初始化 cache仍是raw envelope，包括empty负数；DOM写max(0,raw)。
3. X→Y 每次有效根尺寸更新：测量当前CSS赋值得到 computed → 加理想envelope差量与实际主方向border → 保存新的CSS赋值 → 测量读回两轴到几何cache。renderer继续写保存的CSS赋值，不能改写成舍入后的cache。
4. 原点按padding−computedborder存为CSS坐标；不要为了让实际DOM边缘恰好落在padding上而反向补偿。源码采用的正是CSS读值表达式。
5. 测量环境改变时应重新读取宿主结果；缓存策略不能只以作者border数值或navigator.devicePixelRatio为键来假定永远相同。

本轮实际集成与回归范围是根边框/空外框/原点以及整数行尺寸的示范操作。**小数行尺寸与复杂多行位置推移的逐次舍入仍需下一阶段**：原 `_pushItems` 还会读回行 CSS 再写其 `setResizedSize` 缓存。1.5时请求行width130.1，可读回130.094，之后继续变化还会累积行自身的量化。此次研究已记录这些值，产品没有因修复根外框就宣称小数行尺寸/This几何完全等价。也未重新验证跨浏览器、嵌套多级fit、动画、旋转或官方生成器默认box-sizing。

## 6. 独立产品回归

共享 [exerciseRepeaterBox](../scripts/repeater-box-scenario.mjs) 现在使用独立 DOM小oracle，输入固定作者fixture，按上面的原始算法测每一步预期；没有导入产品helper，没有把断言放宽为任意有限值。DPR1的固定110×36→150×61→130×56→110×36仍保留。两轴CSS字符串和日志cache严格比较，行原点/DOMRect误差约束小于1e-4。说明文字也不再把4/4和7×10写成各宿主通用常量。

定向验证结果：

- 原preview与实际下载file:// offline两项通过；
- 新 `offline-host-1.5` 实际导出测试通过（单独8.4秒），明确使用浏览器启动缩放、验证实际边框舍入；
- 共3项完成验证；没有运行完整套件。初次host测试因test runner默认deviceScaleFactor与viewport:null冲突，仅修正测试context配置后重跑通过；不是放宽几何断言。

[宿主1.5截图](../artifacts/repeater-box-offline-host-1p5.png) 已目视检查：日志显示149.333×60.3333、empty raw−6×−2，布局及说明不遮挡。[可复用fixture](../artifacts/repeater-box-demo.rea.json) 已更新。图像来自独立产品，不是原版Axure GUI证明。主任务另负责packaged Electron的同环境验证及完整开发/生产套件。

## 7. 新结果 SHA-256

所有JSON保留每步原函数快照、独立DOM对照、实际DPR、scaleMode、浏览器版本和原源文件SHA。原源码身份与行号继续见原报告，未更换供应商版本。

| 文件 | SHA-256 |
|---|---|
| [host 1](repeater-box-model-dpr-1-host.json) | `c76e3bd1897325161baf9071697cdcbec34bc57370c26c995a896db309a59f2d` |
| [host 1.25](repeater-box-model-dpr-1p25-host.json) | `68016df90484b1e351fe680c8af4258136c2ecd317e1bfff84abfdac0d895904` |
| [host 1.5](repeater-box-model-dpr-1p5-host.json) | `5087ccf5715f02f5c4c0a03db12718fb03e4fabf762a145a5c91a383467c4878` |
| [host 2](repeater-box-model-dpr-2-host.json) | `8f0dc79ec246882ac9febdbbd66ec1bcd80edea42c36d54379d05f540eec484c` |
| [emulated 1.25](repeater-box-model-dpr-1p25-emulated.json) | `15cc0561f6fb6ff84d800e440a5d459cdc86fe112081ddaf7b435d837cd44379` |
| [emulated 1.5](repeater-box-model-dpr-1p5-emulated.json) | `67ec8ee557d0de3d7ed3f529b6981e8b66963f250f835432e614e9eda9a2b4dd` |
| [emulated 2](repeater-box-model-dpr-2-emulated.json) | `71ea24e1b195d57b2b6bfd3ef90da386925c9aa70cd07d3f3fe1ad849ee89806` |
| [DPR矩阵脚本](repeater-box-model-dpr-probes.mjs) | `8773a079ae313c2752f261307a8450bde40cc110b3be4039d26c017882678528` |
| [参数化入口脚本](repeater-box-model-probe.mjs) | `a6f6b7b7f25f0b81485cc76367f5e29bd63062ad0579156dac7575a25a105380` |
