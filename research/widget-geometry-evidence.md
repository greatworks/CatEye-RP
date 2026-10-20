# Axure RP 11 geometry expression evidence

日期：2026-10-13。对象：官方 RP **11.0.0.4150** 已提取原型 JavaScript。仅运行 SHA 固定的原函数片段与人工桥接数据，未启动原应用、编译原型或执行完整 vendor module。原函数 AST 探针为显式合成输入，不能充当原编译器 STO 类型证据。

## 可执行结论

1. **直接 `This.x/y/width/height/left/right/top/bottom` 每次表达式 lookup 读取新 widget-info。** `variables.js:61` 返回 `$ax.getWidgetInfo(eventInfo.thiswidget.elementId)`，没有直接返回 eventInfo 保存的对象；`Target` 在 `65` 同样重新创建。因而正常动作之后、Wait 续段、case 菜单点击时的直接读取是当前几何。
2. **每个 widget-info 本身懒缓存几何。** `doc.js:449–463`：首次访问四项之一时，读取一次 bounding rect，同时缓存 `xProp/yProp/widthProp/heightProp`；之后同一对象的四项固定。事件创建 `293` 只建对象，不预读几何。不要把“fresh provider”和“retained object cache”合并成单一 snapshot/live 规则。
3. **`Item.Repeater` 是保留对象，区别于直接 `This`。** `doc.js:340` 取 refresh 共用缓存或新建无 suffix root-info；它首次几何读取后固定，即使后续 resize、Wait 或菜单延时。若首次几何读取发生在延时之后，则缓存那时的 root box。
4. **源 ID 决定 This 的 box。** repeater 本体事件源 `r` 读取整体；Item Loaded / Item Resized 源 `r-<itemId>` 读取行容器。普通 template child `c-<itemId>` 读取该 child 在行/父 state 内的坐标。`_getParentElement` 仅爬 `isContained`，不会主动删去行 suffix。
5. **`This.Repeater` 和 `Item.Repeater` 在行源处不同。** `doc.js:373` 对 repeater 类型令 `widget.repeater = widget`。因此源 `r-1` 的 `This.Repeater.width` 就是该行宽度；同 frame 的 `Item.Repeater.width` 是无 suffix `r` 整体宽度。普通 child 源的 This.Repeater 则新建 root-info。Target / Target.Repeater 使用同一规则。
6. **几何不含旋转和 outer shadow。** `doc.js:459` 调 `offsetBoundingRect(true,true)`；`axQuery.std.js:1438` 参数明确为 `ignoreRotation, ignoreOuterShadow, ignorePosition`。left=x、top=y、right=x+width、bottom=y+height（`doc.js:412–421`）。这是父 state/page 局部坐标，不是 viewport/page 坐标；pagex/pagey另走独立方法。

## 来源及重现

包 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。REA extraction：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。

源目录 `P`：`C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`。本报告行号均指未改动的 `P` 下文件。

| 文件 | SHA-256 |
|---|---|
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| variables.js | `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188` |
| sto.js | `c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6` |
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| utils.temp.js | `ef33a9174ea5b4cdcd48229f896195d2f67941116aa7eeae6308a99e02b4832f` |
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |

执行 `node research/scripts/probe-widget-geometry.mjs`：**22 probes / 9 source hashes / 26 excerpts 通过**。脚本与结构结果分别为 [probe-widget-geometry.mjs](D:/WSCodex/REA/research/scripts/probe-widget-geometry.mjs) 和 [widget-geometry-evidence.json](D:/WSCodex/REA/research/widget-geometry-evidence.json)。JSON 含每个观察值、原文片段、执行范围及 mock 边界。

## 求值、缓存与延迟路径

`sto.js:97–112` 对每个 `var` 先读本表达式的 scope，否则调用 globalVariableProvider；`145–161` 的 propCall 先求 parent，再读取属性或调用属性函数。因此直接 `This.width` 的每个 var 节点都会经过 variables 的 fresh getWidgetInfo，而不是查 eventInfo.thiswidget.widthProp。全局同名变量可在 `variables.js:35–44` 先于保留名称命中；本项目是否允许保留名称冲突是另一个模型约束。

`expr.js:204–209` 每个 stringLiteral/HTML expression 都重新建立 scope、求 local variable；`GetWidget` (`712–714`) 返回一个 widget-info。因此以控件为 local variable 的 `L.width` / `L.height` 会在**同次字符串表达式**共享一个缓存对象，但再次执行该字符串时重新创建 local scope。探针证实初次 `30/40`、修改 box 后下次 `35/45`，两次表达式各测量一次。

`action.js:359–368` 的 Wait 用 eventCopy 保存 frame，计时器回调仅更新 now、清 resize/move queue 后继续。`utils.temp.js:42–47` 实际使用 `filter.indexOf[key]`，不是函数调用；原函数探针确认复制后的 frame 不同，但 `.item` 与 `.thiswidget` 与原 frame 是同一对象。我们没有替换或修正该原实现。无条件菜单 `events.js:442–467` 保存 eventCopy；有条件菜单 `489–490` 保留原 eventInfo。两种原菜单 callback 的直接 This.width 都在延后点击时读取新 box。

### Item.Repeater 的准确缓存周期

- `repeater.js:330`：每次 refresh 在行 Loaded 循环前 `cacheRepeaterInfo(repeaterId, getWidgetInfo(repeaterId))`；此时几何仍未求值。
- `342–356`：每行创建 eventInfo，`doc.js:340` 将缓存的同一个对象放入每个 Item.repeater。
- 任一 frame 首读 Item.Repeater 的四个几何字段之一，就为这个共用对象缓存四项。后续同步行 Loaded 首读可能看到前面行已经锁定的尺寸。
- `repeater.js:362`：同步行循环结束后 `removeCachedRepeaterInfo`；`doc.js:324–325` 仅将映射设为 undefined，没有擦除旧对象属性或旧 frame 引用。
- 已排定的 Wait/已打开菜单仍引用旧 Item.repeater；下次 refresh 新建另一个对象。对尚未首读的旧对象，延时首次读取仍使用该 root element 的当前几何。
- refresh 外的新行事件没有 global cache 时由 doc340 新建 root-info，仍是这个事件 frame 保留对象的首次读缓存。

建议实现中为 frame 的 Item.Repeater 保存明确的 geometry holder，并在刷新同步行事件间共享 holder；holder 首读时同时填充四项；不要在移除全局缓存时清 holder。This / Target 则应按每次 resolver lookup 重新读取。这里是源语义建议，不宣称本项目已实现。

## 几何来源与目标

| 情况 | 原路径与结果 |
|---|---|
| 普通控件 | getWidgetInfo → offsetBoundingRect(true,true)。move 缓存优先；否则 `data-left/top`；否则当前状态/自适应的 style.location（axQuery.std1470–1479）。尺寸先 resizedSize，再 data-width/height，再 style.size（1512–1522）。 |
| repeater `r` 本体 | refresh 根据行布局、spacing、padding计算整体尺寸并存 resizedSize（repeater155–172）。This 读取该值。 |
| 行源 `r-1` | Loaded 来源由 repeater343–353 的 createElementId产生；ItemResize 在1131同样产生行 ID。行 moved/resized缓存已在205–206或284–285建立。doc652–654让其对象类型仍为 repeater，但查询 elementId仍带行suffix。 |
| template child `c-1` | 使用 child 自身 style与实例 override；不会额外把 root location或row location相加。 `doc613–624` 仅对 IsContained 内部对象提升到父对象。 |
| `Target.*` | `variables.js:65` 根据当前 eventInfo.targetElement 建新对象。`expr.js:141–144` 在 fcall 参数求值期间逐目标设置 targetElement，`166–167` 在 setter真正执行前恢复旧 target。 |
| 无 Target | 没有 targetElement时 provider得到undefined；读取几何抛错，stringLiteral的逐片段catch保留 `[[Target.x]]`（expr214–220）。不应无依据回退This。 |
| 源行 DOM已不存在 | 原 getWidgetInfo 不检查DOM存在性；若 moved/resized记录已清，offsetBoundingRect可回落到 repeater类型的style，而非稳定ID无效判定。探针只证明该fallback分支；真实删除清理时点/Wait之后的浏览器结果仍unknown。 |

层或 master/RDO 的特殊 position累加在 axQuery.std1494–1504；fixed定位校正在1540–1544。它们没有纳入本轮 mock。不能把局部坐标结论扩大为“所有组件/固定定位均直接等于存储x/y”。

## Repeater padding / style字段归属

这部分是静态 schema 证据，未做真实 box-model 测量。DLL SHA：`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。原始 CIL为 `repeater-geometry-style-cil.json`、`repeater-geometry-style-chain-cil.json`、`repeater-geometry-style-property-cil.json`、`repeater-geometry-chain-owner-cil.json`；输入hash、12个 getter→chain→PName 对应和两个官方库样本整理于 [repeater-geometry-style-evidence.json](D:/WSCodex/REA/research/repeater-geometry-style-evidence.json)。

| 属性 | PName code / 字段 | 确定归属 |
|---|---|---|
| PaddingLeft/Top/Right/Bottom | 11/12/13/14 `PADDING_*` | Repeater getter100701678–681 → get_RepeaterChain → k5VP对应属性。默认库的 RepeaterStyle.PropList 显式存4边0。 |
| RepeaterBackColor | 7 `FILL` | 整体背景 getter100701677；与下面的item背景是不同属性。Table repeater 的 RepeaterStyle显式存浅灰fill。 |
| BorderColor / Width / Style | 8 `BORDER_FILL` /15 `BORDER_WIDTH` /16 `LINE_PATTERN` | getter100701673–675通过RepeaterChain；Table repeater的RepeaterStyle宽度0，但其MyStyle另有code8边框色。不能把两个style对象直接拼成一个无优先级字典。 |
| CornerRadius | 71 `CORNER_RADIUS` | getter100701676；Table repeater的RepeaterStyle显式0。 |
| BackColor | 1204 `ITEM_BACK_COLOR` | getter100701688；每行item背景。runtime称backColor，不是root背景。 |
| HasAltColor / AltColor | 1205 /1206 `ITEM_HAS_ALT_COLOR` / `ITEM_ALT_COLOR` | getter100701689–690；交替item背景开关及fill。 |

JS `repeaterPropMap` 保存 layout/padding/item-background 的自适应字段，读取规则在 `repeater.js:580–592`：沿view chain逆序取own property，再base，最后 `map.default[prop]`。主文档base key `''`，master/referenceDiagramObject用特定base ID。paddingTop/Left/Bottom/Right在160–163计入整体尺寸；item placement在233–234从top/left padding开始。backColor/hasAltColor/altColor在138–140按view读取，然后赋给行容器；不等同root CSS的fill。

实际 `.rplib` object含独立 `MyStyle`、`AdaptiveStyles` 与 `RepeaterStyle`、`AdaptiveRepeaterStyles` 引用。Table repeater与Card两个例子均有4边padding=0、独立item背景和alternate设置。这里可安全恢复的是**已确定、唯一、显式存储的本地属性值**；缺失或未确定属性不能擅自当0/透明/false，RepeaterChain合并优先级与native默认库链仍未复原。完整采样标志、值和引用ID在JSON。

format agent的独立box-model调查已定位 CSS writer `FNiU::SNil` / `zNPX` → `JNLP::PNLQ`，见其 `repeater-box-model-generator-cil.json` 与 `repeater-box-model-css-writer-cil.json`。writer的具体字符串仍混淆，本报告不推断root统一content-box或border-box，也不将padding元数据等同浏览器CSS padding。

## 本轮边界

已证：直接/provider vs retained object的区别；Wait和两类菜单callback；普通/本体/行/模板/contained来源；逐target求值；四项懒缓存共享；无Target片段保留；padding/style字段名和库内对象归属。

未证：原编译器如何标注每种复杂local expression的computedType；固定定位/复杂master坐标/真实删除DOM后fallback；生成CSS属性字符串与整体box-model；所有style链默认与继承优先级。研究阶段没有重复fit的24项；后续获指令新增的独立重建测试见下节。

## 后续独立实现验证

研究完成后按 root 新指令扩展 `src/runtime/expressions.ts` 的封闭白名单：This/Target 及其 Repeater、Item/TargetItem.Repeater 的上述8个几何叶子，Widget.UUID仍仅支持text。`tests/expressions.test.ts` **37项通过**；新增 `tests/widget-geometry.test.ts` **28项通过**（14场景×module/完整portable解释器与runtime）。合并定向命令为 `npx vitest run tests/widget-geometry.test.ts tests/expressions.test.ts`，最终 **65/65**；类型检查也通过。

运行时测试涵盖普通及旋转源、row/body/child区别、per-target实例override、四维同缓存、同refresh共享、延迟首次读取、旧Wait holder跨下一次refresh仍保留、两类菜单fresh读取。独立研究发现无Target被静默替换为空串的问题后由root修复；新增回归确认逐片段保留、后续正常片段继续、`if(false, Target.x, 1)`不读取失效目标、合法target正常且不泄漏到后续SetVariable。

TargetItem.Repeater补充：`variables.js:63` 的变量provider每次getItemInfo(target)，所以refresh内仍可通过 `doc.js:340` 共享全局holder；refresh外无global cache时每次新建root-info。root补充此路径后，新增回归确认：同步ItemLoaded先读Item锁定70、resize至120，再对row child SetText读Item/TargetItem/Target.Repeater得 `70/70/120`；Wait释放refresh缓存并另行resize至160后，同样读取变成 `70/160/160`。上述产品验证是独立重建行为测试，不是原版GUI验证。
