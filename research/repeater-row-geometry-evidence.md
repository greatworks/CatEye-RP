# Repeater 行请求尺寸、CSS读回与几何缓存

2026-10-13。独立静态审查 Axure RP **11.0.0.4150** 原型资源；研究阶段不运行原应用、不修改产品。后续另按授权新增独立产品回归测试，见末节。与 format agent 的真实 Edge 行量化实验分工：本文确认原函数读写哪一层数据，浏览器量化数值由其独立探针确认。

## 关键合同

**至少分开保存名义尺寸、CSS赋值、几何缓存三层。** 原 `repeaterSizes.sizesMap` 不会在行CSS读回后被量化值覆盖。`This.width` 读取的却是 visibility几何缓存，而不是这个名义表。单个widget-info上还有第四层“首次读取几何后固定”的对象缓存。

| 层次 | 源字段/入口 | 更新和用途 |
|---|---|---|
| 名义行尺寸 N | `repeaterSizes[repeaterId].sizesMap[itemId]`，与布局数组同一对象 | `resetItemSizes` 建立；`setItemSize`计算requested−N；`_pushItems`在原N上加delta。决定无操作、组最大值/组长度、推动后项的差量。 |
| CSS赋值 I / 当前CSS读值 C | `itemObj.css(prop, getNumFromPx(itemObj.css(prop)) + delta)` | 写入值以当前jQuery CSS读值C为基数，而非前次赋值I或直接requested。浏览器可以将赋值与读值分离。 |
| visibility几何 G | `_resizedIds[rowElementId]` / `_movedIds[rowElementId]` | 行resize后读回两轴CSS写G；初始化路径有时直接写raw offset。`offsetBoundingRect`优先读此G。 |
| widget-info懒缓存 W | `xProp/yProp/widthProp/heightProp` | 同一个widget-info首次读四项之一，同时保存G与位置；之后不因setResizedSize失效。直接This/Target会每lookup重新创建info；保留Item.Repeater则可能继续读旧W。 |

对于可见有效行，单轴请求R的路径是：`delta = R − N` → 若零则不做CSS读写 → 否则 `newCssInput = currentCssRead + delta` → CSS setter → 再读两轴成为G → 名义表 `N += delta`，同时按名义差量维护root与后项位置。**不能用R直接覆写CSS；不能用G替换N；不能用DOMRect替代原jQuery读值。**

## 来源及身份

包SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。REA extraction：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。

源目录：`C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`。

本轮重新核验6个SHA，21个精确行片段保存于 [repeater-row-geometry-evidence.json](D:/WSCodex/REA/research/repeater-row-geometry-evidence.json)。

| 文件 | SHA-256 |
|---|---|
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| visibility.js | `bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| variables.js | `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |

名称澄清：此版原 `repeater.js` 没有 `resizeItems` 符号；实际相关函数是 `resetItemSizes`（1081）、`setItemSize`（1118）、`_pushItems`（1136）与 `_updateRepeaterSize`（1279）。不能把独立产品函数名视为原版入口。

## 名义尺寸与零差量

`repeater.js:1085–1109` 同时构建顺序数组和sizesMap，两者引用同一个 `{itemId,width,height}`。`getItemSize:1112–1115` 返回这个对象。`setItemSize:1121–1124` 的deltaX/Y只减这里的尺寸，两者都falsy便return false。它不比较CSS、visibility cache或DOMRect；delta在两个push开始前一起计算。

`_pushItems:1137` 也在delta==0时立即返回。发生非零push后，名义尺寸仅在各分支的 `1161` / `1231` / `1248` 用 `+= delta` 更新，未见把CSS读值写回名义表。组最大值及行列总和使用该数组（1157–1173、1203–1221、1239–1260）。

因此有两类容易误判的事件：

- **重复同requested仅在当前名义值与requested精确相等时是no-op**。例如上次requested=130.1、当前This.width=130.094，若名义表精确为130.1，则delta=0，不进行CSS写入和额外事件。不能假定任意第一次请求后N必然等于R：原更新是浮点 `N += delta`，而不是 `N = requested`。
- **设置为当前This.width可能不是no-op**。上述例子会得到delta≈−0.006；先从当前CSS130.094再减此差量，经CSS读回后更新G，并因名义差量触发Item Resized。具体最终值取决于宿主，不能硬编码130.088或固定DPR算法。
- **非零名义delta也可能不改变实际used CSS尺寸**。原setItemSize仍会在1131派发事件，因为条件是deltaX||deltaY，不是“比较resize前后DOMRect”。这点为源码推论，具体微小delta实例由真实浏览器探针覆盖。

已实证浮点残差：初始名义100，请求0.1后N为 `0.09999999999999432`；第二次请求0.1仍是非零delta，仍派发事件，然后N精确成为0.1；第三次才no-op。真实host 1与1.5均观察到，见下方新实验数据。不能用epsilon去重或直接赋requested消除这一可见差异。

## CSS读写、位置和事件顺序

`repeater.js:1140–1144` 在处理任何一个轴时：先读该轴的CSS并加delta写回，然后读取**宽高两轴**并setResizedSize。因此仅resize X也会将初始化时尚为raw的height缓存转换为CSS读回height，哪怕height没有写入。这发生在名义尺寸更新和root尺寸更新之前。

后项位置不是由width缓存全量重算：`1266–1273` 对每个受影响行读当前CSS left/top，加有效delta写回，再读CSS left和top更新_movedIds。主轴使用本行名义delta；wrap副轴使用本组名义最大值差。CSS读回坐标、DOM实际边缘与名义尺寸可能不同。

root更新 `1279–1289` 读取root当前CSS，加理想envelope的有效差量，再加主方向两侧computed border；写CSS后读两轴存root G，并同步fit ancestor。root的历史补偿与行本身的CSS读回是两条状态链，不能只修root而把row合并成requested数值。

setItemSize按X→Y调用push，两个轴都结束后，在1131只发一次源为 `r-rowId` 的Item Resized。事件中的新This widget-info会读已更新行G。root G和受影响行位置通常也在派发前更新。

副轴非最大项很关键：nowrap分支会先更新row CSS/G和N，root delta可能0（1173）；root更新函数1280随即返回，root缓存仍旧；setItemSize仍发一次事件。wrapped副轴非最大项在1252提前返回，直接push自身不发事件，但外层setItemSize的1131仍发一次。不能把所有push入口的事件规则合并。

## 初始化和刷新不是resize读回

| 路径 | 名义表N的来源 | 行G来源 | 后果 |
|---|---|---|---|
| 普通非pregen refresh | 230传入当次adaptive offset；1081–1098直接使用 | 284直接写offset.width/height | 初始G可以保留未量化raw值；无需等于CSS读回。首次任一轴push会在1144读回两轴。 |
| `_initPregen` | 554传undefined；1092–1095逐行读CSS宽高 | 后续itemsPregen refresh的205读CSS | 名义初始值已来自CSS读回，不一定等于作者raw尺寸。 |
| 主refresh的itemsPregen分支 | 依赖已有尺寸表；该分支没有230的重建调用 | 205–206逐行从CSS读取宽高和位置；preEval子项还在197–198读回 | 不可假定所有初始入口都执行相同raw写入。 |

普通refresh先给临时div设offset（215–218），再在276–282为clone设置obj.width/height，284依旧把offset写G。两种值不一致的复杂adaptive/生成器场景，本轮未构造原版编译fixture，不能强行等同。普通refresh会重新建立N、重新写G，解除此前连续resize读回带来的偏差；仅DOM raw/css具体差值仍服从宿主。

root初始化另在172先缓存raw envelope、300才写CSS；没有紧随的root读回。因此row与root都存在“初始raw缓存，之后resize读回缓存”的阶段差异，但写入时点和生效条件不同。

## This 与 Item.Repeater缓存

`visibility.js:1392–1394` 的setResizedSize只是以新对象覆盖 `_resizedIds[id]`，没有比较、量化、DOM访问或widget-info失效通知。getResizedSize在1382–1383直接返回；`axQuery.std.js:1452,1512–1513` 优先使用这个值构造boundingRect，不重新测量CSS。This.width因此不是任意时候都直接测DOM。

`doc.js:449–463` 的widget-info首读四项几何后一起缓存；setResizedSize不会清这些Prop。`variables.js:61` 的直接This每lookup重建getWidgetInfo，所以读取当时的G；行事件源保持row suffix，读取row G。相同源的 `This.Repeater` 对repeater类型自指，也读该row G（doc373）。普通child的This.Repeater则读root G。

Item.Repeater依据doc340保留root-info对象：refresh开始在repeater330共享创建，结束362只移除全局映射，不清旧对象。若首读在resize之前，后续Item.Repeater.width可以保持旧root W，而This/Target.Repeater fresh读root G；若直到Wait后才首读，则锁定那时root G。TargetItem每lookup创建getItemInfo，在refresh内也可共享同holder，refresh外重新创建。详细22个原函数验证见 [widget-geometry-evidence.md](D:/WSCodex/REA/research/widget-geometry-evidence.md)。

这是两个正交问题：CSS读回决定新G；widget-info首次读取决定W何时锁定G。不能通过更准确的CSS读回就消除Item.Repeater的旧快照，也不能把全部This读取改为触发时快照。

## 建议的运行入口与验证

优先使用与当前真实浏览器研究同样的窄入口：原resetItemSizes → 原setItemSize/原push →真实jQuery/CSS →记录N、inline、CSS读回、visibility G →原getWidgetInfo。这可直接区别每层，而无需执行整个Axure app或原GUI。

交互级入口另为 `action.js:1258–1271` 的objectPath=`thisItem`：从事件源取repeater/row，用getItemSize的**名义宽高**作为 `_getSizeFromInfo` 旧值，再setItemSize。未填尺寸/NaN等回退使用名义旧值（1535–1548），不使用This的读回宽度。当前独立产品的resizeItem x/y仅数字，应先记录This.width，再把其number作为下一次请求做验证；不要为此临时增加表达式动作语法。

产品应以可注入宿主CSS reader做确定性单元测试，断言三层分离与调用顺序；reader仅提供指定输入的读回值，不伪造DPR公式。真实宿主多行/小数/反复变化由format agent负责。重点场景：与当前名义值精确相等才no-op、浮点残差重复事件、从当前This值发起非零请求、单轴更新双轴缓存、非最大行不更新root、refresh恢复raw、事务失败时新CSS/G/N一起回滚。最后一项是本产品安全约定，不是原函数自带事务。

## 数值佐证及未知边界

format agent已完成 [DPR报告](D:/WSCodex/REA/research/repeater-box-model-dpr-evidence.md)，host1.5原数据 [repeater-box-model-dpr-1p5-host.json](D:/WSCodex/REA/research/repeater-box-model-dpr-1p5-host.json) SHA `5087ccf5715f02f5c4c0a03db12718fb03e4fabf762a145a5c91a383467c4878`。其中requested130.1读回row130.094支持三层不能合一。

本次多行原函数实验的 [host 1数据](D:/WSCodex/REA/research/repeater-row-quantization-host-1.json) SHA `3566e662eee12c58c86300d328bf02027f105bbcaa3d9e3f0bffe737480dde5b`、[host 1.5数据](D:/WSCodex/REA/research/repeater-row-quantization-host-1p5.json) SHA `74b0c7a5e153b509592589e805c2ad21f67e6ded87402a5a578f2c6634095b21` 已直接核验。两份 `probe.outcomes[7].operations[0..2]` 包含上述100→0.1、重复0.1的名义残差与事件序列；这是执行原函数的数据，不是产品测试自行合成的预期。

未验证或未覆盖：原生成器所有默认box-sizing与复杂adaptive obj.width/offset关系；所有浏览器/宿主缩放量化；动画中间帧、跨显示器变化、CSS zoom；fit回调同步重入导致第二轴仍使用先前计算delta的极端场景；非法尺寸/隐藏行ID。源码没有名义尺寸、几何缓存和DOM回滚事务，不能将本产品事务保障归为原生。

## 独立产品回归验证

后续授权新增 [repeater-row-geometry.test.ts](D:/WSCodex/REA/tests/repeater-row-geometry.test.ts)，13个场景分别在模块调用与序列化portable runtime执行，**26/26通过**；`npm run typecheck`通过。有限表宿主reader只返回给定输入的确定数值，没有推导DPR量化公式。覆盖初始raw缓存、请求/CSS/几何三层分离、精确no-op、浮点残差、以This宽度发起下一次请求、单轴刷新双轴缓存、两轴事件顺序、非最大行、后行坐标、刷新重建及事务回滚。本阶段未修改运行时代码，未重跑全套浏览器测试。
