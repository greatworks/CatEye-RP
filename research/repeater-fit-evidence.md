# Axure RP 11 行自动适配与 This Item 尺寸证据

2026-10-13，目标 Axure RP 11.0.0.4150。范围是自动 fit 的触发、父层传播、几何边界、显式 This Item resize 和默认设置；`setItemSize/_pushItems` 的布局矩阵见[独立行尺寸证据](repeater-item-resize-evidence.md)。本次只增加研究材料，没有修改产品代码、运行原版应用或捕获原版 GUI。

**实现合同：repeater 自动 fit 按可见子控件的右/下边界调整该行，不平移原点；fit=false 时停止自动测量。显式 This Item resize 直接调整源行，不关闭 repeater 的 fit；后续自动 fit 可以覆盖显式尺寸。加载刷新先恢复生成尺寸，期间动作可同步触发 fit，没有每行 Loaded 之后统一重新测量的步骤。**

## 证据身份与复现

包 SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`，REA 提取 `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。原目录：

```text
C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure
```

| 原文件 | SHA-256 |
|---|---|
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| math.js | `f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883` |
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| visibility.js | `bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |

运行 `node research/scripts/probe-repeater-fit.mjs`。结果：**24 项通过，7 个原文件 SHA 校验通过，33 段源码，2 个 Default.rplib 中继器样本**。探针仅执行完整原函数片段，VM 禁止字符串/wasm 动态执行，单次 1 秒限制。数据、DOM 可见性、父层映射是明确 mock；`setItemSize` 是记录调用的 sink，不重复另一代理的推移矩阵或事件实验。

- [原函数探针](scripts/probe-repeater-fit.mjs)，SHA `6f2285d1b9e01dcc80815778cc37f37dfcf7dd31b5df5f96ea61527bf293431e`。
- [完整结果及源码片段](repeater-fit-evidence.json)，SHA `fdc8245ebc965e401ee884f349fa649328ae229d87196b4eae63fbc6a8cfb707`。
- [Repeater 窄 CIL](repeater-fit-Repeater-cil.json) 与 [默认尺寸相关 CIL](repeater-fit-default-size-cil.json)，均只静态读取，目标 DLL SHA `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。

## 1. 自动 fit 的调用链

`repeater.js:1590–1626` 的 `fitParentPanel(widgetId)` 顺序为：

1. 先找直接 group/layer 或 master，更新对应边界 cache；仅边界变化才继续递归，随后返回（1592–1601）。
2. 再找父 dynamic panel，更新移动滚动和对应 state 的 fit；仅 `_updateFitPanel` 返回 true 才继续递归，随后返回（1605–1610）。
3. 否则找父 repeater；对象存在、child ID 不等于 repeater 本体、`repeaterPropMap.fitToContent` 为真，才计算当前 item 容器的 `childrenBoundingRect()`，用 **right/bottom** 调 `setItemSize`（1613–1621）。
4. 不满足则只更新 body mobile scroll（1624）。

这是按父层变化传播，不是无条件遍历所有祖先。对固定尺寸 panel 的内部 child 移动，不能越过 panel 直接扩大 repeater 行。

| 动作/变化 | 源码调用点 | 确定行为与边界 |
|---|---|---|
| Show / Hide / Toggle | `axQuery.std.js:399–420`；`visibility.js:55–62` | visibility 完成回调调用 fit。重复设为现有值也可能调用 onComplete；limbo 被单独跳过。压缩/push-pull 有另外的布局逻辑。 |
| Move | `axQuery.std.js:457–482` | MoveWidget 完成回调调用 fit；动画期间/完成的精确队列时序不能简化成每帧测量。 |
| Rotate / 环绕移动 | `axQuery.std.js:541–568` | rotation/circular move 完成回调调用 fit。 |
| Resize 普通 child | `axQuery.std.js:655–663` | 完成回调先 fitParentPanel，再完成队列/触发 child onResize。 |
| Resize dynamic panel | `action.js:1307–1310`；`axQuery.std.js:600–622` | panel 自己的 fit 被关闭，之后其新外框触发父层 fit。**这是 panel 规则，不是 This Item 规则。** |
| Set Panel State | `visibility.js:689–703,733–778` | 完成时 fitParentPanel；fit panel 先按目标 state 求尺寸。设置已显示 state 且无需 show 时会早退；若需要显示，则调用 fit。 |
| Set rich text | `expr.js:316–385,469–552` | 写文本后调用 autofitWidget；仅对象带 autoFitHeight/Width 且测量尺寸实际变化时走 query.resize，再经 resize 完成回调触发父 fit。普通固定尺寸文字变化没有这条父 fit 路径。 |
| Set form text | `expr.js:289–300` | 更新 input 值/placeholder/文本变化事件；这里没有直接尺寸 fit 调用。用户在文本变化事件中再执行布局动作是另一路径。 |
| 数据刷新 | `repeater.js:225–230,329–374` | 恢复模板/生成尺寸，期间具体加载动作可能触发 fit；结尾只 fit repeater 的外部祖先。 |

文本自动测量还涉及字体、padding、换行和 alignment。`expr.js:523–545` 在 resize 后因右/中/底对齐另外移动 widget；该移动直接调用 MoveWidget，未传相同的 fit 回调。完整文本测量、字体加载与该时序没有浏览器探针；本轮不应把任意 SetText 都变成 row-resize。

## 2. 初始刷新、隐藏与非活动 panel state

刷新的 `repeater.js:116–125` 取 `repeaterPropMap` 当前 adaptive view 的 offset；`230` 用此 offset resetItemSizes。每行 `342–357` 执行 BeforeItemLoad、ItemLoad、模板子 Loaded，未在每次循环末尾重测行内容。结尾 `368` 调用 `fitParentPanel(repeaterId)`；自身 ID 检查使它不会在此重新 fit 自己的全部行。

因此：初始/刷新行尺寸来自生成时的 template bounds；初始载入动作里的 show/move/resize/状态切换可在该动作完成时改变某行。不能为了统一实现而在所有行 Loaded 后无条件覆盖显式 This Item 尺寸。原脚本还有 `repeater.js:1871–1878` 对非默认状态的 fit panel 更新祖先的专门路径，不等于每行加载都有统一 fit。

`_updateFitPanel` 的关键规则（`repeater.js:2022–2078`）：

- panel 不是 fit-to-content 时立即 false（2026），不继续父层。
- 对目标 state 计算其子控件边界；新旧尺寸相同则 false（2046）。
- 即便是非当前 state，也可能更新该 state 内部尺寸；然后 2060–2063 检查不是当前状态，返回 false，不扩大当前 panel/repeater。
- 当前 state 尺寸改变时，更新 panel 尺寸并触发 panel onResize，最后返回 true（2069–2077），上层才继续递归。

`visibility.js:15–22` 的可见性只检查元素自己的 inline `style.visibility`，刻意不查祖先有效可见性。**hidden panel 内的 child 仍可以重算内部尺寸**；当传播到行容器时，该 panel 自身 hidden，所以从行边界聚合中排除。不能把“祖先隐藏”当作禁止执行所有布局动作或内部 fit 的理由。

探针对 parent panel/layer 的 lookup/change 标志采用 mock，只验证原 fitParentPanel 的递归/停止分支；非活动 state 的实际停止条件属于上述原函数静态证据。

## 3. 几何边界的确定规则

`axQuery.std.js:1325–1353,1368–1371` 聚合 children。right/bottom 从 0 开始，取所有合格 child 的最大 right/bottom。忽略无对象、limbo、自己 hidden、带 fixedHorizontal 的 panel，以及宽高均为 0 的空 group。不使用 `right-left`/`bottom-top` 作行尺寸，不把负 left/top 平移回原点。

`offsetBoundingRect`（1438–1575）考虑位置/尺寸 override、初始 style、外阴影，以及旋转；未传 ignoreRotation/ignoreOuterShadow，因此两者默认参与。`math.js:132–149` 旋转四角绕原中心，取轴对齐包围框。

| 原函数探针 child 输入 | setItemSize 得到 W×H |
|---|---:|
| x=10,y=20,w=30,h=40 | 40×60 |
| x=-10,y=-20,w=30,h=40 | 20×20 |
| x=-50,y=-60,w=30,h=40 | 0×0 |
| x=10,y=20,w=20,h=100,rotation=90° | 70×80 |
| 20×30 可见 child，另有更远 hidden / limbo / fixed-panel / empty-layer | 20×30 |
| 全部 child hidden | 0×0 |
| x=10,y=20,w=30,h=40，shadow offset 5/6、blur 4 | 49×70 |

这里的 0 合法；不能给行尺寸随意施加 widget 常见的最小 1。复杂 master 内坐标、复合向量、百分比 panel、边框 CSS 和跨 adaptive 的几何仍需专门验证。聚合对 shadow 的具体公式来自该版本脚本，不等价于所有浏览器阴影的视觉像素范围。

## 4. 显式 This Item resize

`action.js:1258–1283` 对 `objectPath == 'thisItem'` 走独立分支：从 `eventInfo.srcElement` 提取 repeater 与 item ID，读当前行尺寸，调用 `_getSizeFromInfo`，立即 `setItemSize`，然后继续下一个 target。该分支不进入普通 resize 动画队列、不调用 `_ignoreAction`，也不改 repeater fit 开关。

`_getSizeFromInfo`（1528–1551）暂设 `eventInfo.targetElement` 为它的第 5 参数；This Item 调用没有传该参数，因此尺寸表达式求值期间 Target 未设置，完成后恢复旧 target。宽高分别求值；空值/NaN 保留旧维度，负数钳 0，小数保留。

原函数的空判断是宽松 `value != ''`，探针明确区分：字符串 `'0'` 得 0，数字 `0` 被当空而保留旧值；`'2.5'` 得 2.5；`'-5'` 得 0；`''` / `'bad'` 保留旧值。这是 evaluator 返回类型的敏感性，**不是原编译器对用户输入 0 的输出证明**。原函数没有统一有限值检查；产品现有数值上限/Infinity 拒绝属于产品约束，不应伪称原生规则。

两种 fit 状态均已探针验证：显式 size 改变但 fit 值保持原样；fit=true 时后续 child 布局引起的自动 fit 会覆盖手设尺寸。fit=false 仍允许显式 resize；文档对 Item resized 的说明针对 contained-widget 自动变化，不能用它推导显式 resize 不派事件。

## 5. Item Resized 与数据刷新 guard

本轮不重复 setItemSize/_pushItems 的布局探针。静态调用关系是：自动 fit 与 This Item resize 都直接进入 setItemSize，后者按差量派发 `onItemResize`；合成事件调用没有新增 timer（`events.js:1701–1716`）。无动画的相关动作可在原调用栈中嵌套执行 Item Resized，Wait 才分出异步续段。

数据 refresh 从 `repeater.js:98` 进入 refreshStart，到 `374` refreshEnd；ItemLoad 中的布局动作及其 ItemResize 嵌套仍位于该栈。`action.js:128–141` 的 `_ignoreAction` 被 Add/Delete/Update/查询/分页 handlers 使用，所以这些同步自数据修改受保护。**显式 This Item resize 本身没有该 guard**，可以在加载/resize handler 里再次调整尺寸；若数值不断变化，不能假设原版自动阻止递归。产品应保留已有循环上限并明确其为保护策略。

outside-refresh 用户动作引起的 ItemResize 没有这层“正在刷新自身”的理由去忽略数据动作。关于确切事件次序、同值 no-op、双轴派发次数以及推移兄弟项，引用独立布局矩阵结果，不能从本报告的 setItemSize sink 推出。

## 6. 默认设置与尺寸证据

[官方 repeater 文档](https://docs.axure.com/axure-rp/reference/repeaters/#fit-to-content-in-html) 明示 Fit to content in HTML 默认开启；关闭后子控件大小、位置与显隐变化不再自动改变行边界。[同页布局说明](https://docs.axure.com/axure-rp/reference/repeaters/#layout-spacing-and-pagination) 给出的默认值是纵向单列、0 间距、显示全部行。[Item resized 说明](https://docs.axure.com/axure-rp/reference/repeaters/#item-resized) 描述的是由 contained widgets 的变化触发的自动适配事件。

本机已提取 `Default.rplib` 的 SHA 是 `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`。解析对象图的两例：

| 样例 | Object ID | 已存设置 |
|---|---|---|
| Table repeater | fde99102eb56443a8195d884090104ab | FitToContent=true，IsolateRadioGroups=true，IsolateSelectionGroups=true |
| Repeater - card | a9540d486f004aa5b8ce1f0d7c470ca6 | 同上 |

JSON 保存原始属性、style、repeater style 与模板 child。两例自己的 MyStyle 都保留 250×150 的尺寸值，但模板不同：表格有 120×30、54×30 元件；card 背景是 300×100。**不能把这个 MyStyle 的存值直接当作最终 item 尺寸或新建 GUI 尺寸。**

静态 CIL：Repeater ctor token100701619/100701620 在 IL220–243 把 100×100 存入 oNON；get_DefaultSize token100701762 的 fallback 分支返回该字段，而有数据/子控件路径会计算内容、行列和间距。get_ItemsWidth/Height token100701698/100701697 调内容几何助手。fit getter token100701637 读 tNdU，不能仅凭 ctor 未显式写这个字段就否定官方 UI/库的默认 true，因为工厂、加载和 setter 路径不等于裸 CLR 构造器。

建议产品新建 repeater 明确 fit=true；旧文档缺省继续 fixed 是兼容决策。初始 itemWidth/itemHeight 应为编辑模板的生成边界，或产品自己明示的默认尺寸；本次没有证据证明所有新建入口共享一个固定行高/宽。原版 GUI 新建、原编译器生成 propMap 的完整路径与原浏览器字体测量仍未验证。
