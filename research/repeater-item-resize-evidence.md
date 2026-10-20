# Axure RP 11：逐行尺寸、换行布局与 Item Resized

日期：2026-10-13。目标：Axure RP 11.0.0.4150 已提取官方分发 JavaScript。此轮只新增研究文件，未改产品或公开仓库。**40 项探针通过**，其中一项为独立几何重算与原函数的 80 组 fixture / 1,280 次逐次 resize 差分。没有运行原版应用、原型浏览器或完整模块，不能称为 GUI 验证。

## 可实施合同

在**非空、非负行宽高和 gap、无边框、初始 adaptive offset 与行 DOM 尺寸一致**的范围内，可以按当前可见顺序与各行的 width/height 全量重算，代替厂商的增量 `_pushItems`；本次 1,280 步全部相等。

1. `vertical=true` 的主轴为 Y：先向下填一列，wrap=N 项后换列。`vertical=false` 主轴为 X：先向右填一行，N 项后换行。
2. wrap 是**固定项数**，不是像素宽度阈值。resize 不改变既有分组，最后一组可不足 N。`wrap=-1` 是不换组；wrap=1 每项单独一组。
3. 组主轴长度为 `Σ item.mainSize + (group.length−1) × mainGap`；组副轴长度为组内 `max(item.crossSize)`。
4. 整体主轴长度为各组主轴长度的最大值；整体副轴长度为各组副轴长度之和加组间 gap；最后加四边 padding。组内项只按自己的主轴尺寸逐个推进，副轴在组首对齐。
5. `setItemSize` 先处理 width，再处理 height，全部位置与尺寸更新后只派发**一次** `onItemResize`。重复设置同尺寸无事件。尺寸变成 0 是实际变化，gap 仍保留。
6. 普通刷新重建尺寸表并使用当次统一初始 offset，旧手动行尺寸不自动延续。Item Loaded 中的动作可以重新改变它，并再次触发 Item Resized。

空行外框、非零 border 与直接 `pushItems` 的事件差异另见下文，不能用这一简化合同概括。

## 证据身份与复现

复用 REA extraction `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。原包 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。目录与前期来源详见 [零行报告](repeater-empty-evidence.md)。没有重复执行旧 21 项 empty probes 或 13 项 scope probes。

| 文件 | SHA-256 |
|---|---|
| 原 repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| 原 doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| [repeater-item-resize-probe.mjs](repeater-item-resize-probe.mjs) | `214680d69b16e91e35b9e1e8cdc3e0cb935f9fb197d34f0cb90f9c02644ddd48` |
| [repeater-item-resize-evidence.json](repeater-item-resize-evidence.json) | `68d0493a43c26af46aa328ecebb29ec1a320d884da08ffc6b33c2e74b93b2222` |

```powershell
node research/repeater-item-resize-probe.mjs
```

可传重新提取的 `resources/scripts/axure` 目录作为首参数。脚本校验原文件 SHA，保留 10 个片段及原始行号；使用禁止字符串/wasm 动态代码生成的独立 VM，每次执行上限 1 秒。只依赖 Node 内置模块。JSON 保存完整数值矩阵、每个事件时的布局、This 尺寸、Item 元信息，以及差分的所有 fixture、操作序列、最终结果。

## 原函数如何改变布局

### resetItemSizes：可见顺序与刷新

`repeater.js:1080–1110` 按 `ids[bounds.start ... bounds.end)` 顺序建表，普通项为 `{itemId,width,height}`。wrap=-1 时是一维序列；否则按 N 项一个数组分组。map 通过 itemId 索引，但布局顺序由数组决定，与原始数据行号或 ID 数值大小无关。

传入 itemSize 时每项初始宽高统一来自它；未传入时读每个现存行的 CSS。普通 refresh 在 `229–230` 先移除旧行并调用 `resetItemSizes(repeaterId, offset, bounds, orderedIds, vertical, wrap)`，因此不保留旧可变尺寸。

`offset` 来自当次 adaptive repeaterPropMap view（主刷新函数约 `120–125`）。须区分：行 DOM 创建在 `280–281` 用 `obj.width/obj.height`，visibility cache 在 `284` 用 offset。这里所有 fixture 均使两者一致；有 adaptive 差异时未证明可直接拿产品模板基础宽高替代。

初始化位置使用 `232–240` 的 padding 起点及 `287–297` 的固定换组推进。随后变更不重新计算分组。测试中 visible IDs `[6,1]` 来自 ordered IDs `[9,3,6,1]` 的 page 2 bounds `[2,4)`；第 6 号行触发事件时 index=1，而不是 6 或原数据位置。

### setItemSize 与增量 push

`1118–1134` 计算与尺寸表的差值；无变化直接返回 false。X、Y 分别调用 `_pushItems(..., suppressFire=true)`，最终对 `createElementId(repeaterId,itemId)` 触发一次 `onItemResize`。

`1136–1277` 的分支与重算合同对应：

- 不换组的副轴变化：只改变总体最大副轴尺寸，不移动兄弟项。非最大项缩小时，外框不变。
- 主轴变化：只推动本组后续项。换组时，外框主轴依据各组“尺寸和 + gap”的最大值变化；最大组缩小时，另一组可接管最大值。
- 换组副轴变化：先计算本组最大副轴尺寸的有效差值；最大值变化才移动后续整组。如果变更项仍未超过同组另一项，位置与外框不变。
- 间距在 resize 过程中不变。宽高为 0 不删除项、不删 gap、不减少组数。

独立 oracle 没有复制上述增量分支，而是从全部行宽高重新分组和求和/求最大值。80 个确定性 seed fixture 覆盖两方向、wrap `[-1,1,2,3,12]`、1–9 行、gapX 0–12、gapY 0–8；每组 16 次任意行 resize，width 0–160、height 0–60。1,280 步均与原函数完整 root/row 矩阵一致。此有限差分与源码代数结构共同支持实现方案，不代表全域形式化证明。

## 可执行 expected 矩阵摘录

所有默认行初始 100×20，gapX=8、gapY=4，padding `[left=3,top=5,right=7,bottom=11]`，border=0。行表示 `[id,x,y,w,h]`。完整 expected 与每次 event snapshot 均在 JSON。

| 场景 / 动作 | 最终 root `[w,h]` | 关键最终行 |
|---|---|---|
| vertical、3 行、不换组；1 → 100×35 | `[110,99]` | 1=`[1,3,5,100,35]`，2 y=44，3 y=68 |
| vertical、不换组；2 → 150×20 | `[160,84]` | 其他行位置不变 |
| vertical、不换组；2 先宽150再宽60 | `[110,84]` | 另一行宽100接管总体宽度 |
| vertical、不换组；1 → 0×0 | `[110,64]` | 2 y=9，3 y=33，gap仍为4 |
| horizontal、3 行；1 → 130×20 | `[356,36]` | 2 x=141，3 x=249 |
| horizontal；2 → 100×45 | `[326,61]` | 兄弟项位置不变 |
| horizontal；2 → 0×20 | `[226,36]` | 3 x=119，仍留8的gap |
| vertical、5 行、wrap2 初始 | `[326,60]` | 组为 `[1,2] [3,4] [5]`，各组 x=3/111/219 |
| horizontal、5 行、wrap2 初始 | `[218,84]` | 同组划分，各组 y=5/29/53 |
| vertical wrap2；1 高35 | `[326,75]` | 2 y=44；3/4/5不移动 |
| vertical wrap2；1 高10 | `[326,60]` | 2 y=19；第二列维持最大整体高度 |
| vertical wrap2；5 高35后高50 | `[326,66]` | 不足N项的末列也参与最大值 |
| vertical wrap2；1 宽150 | `[376,60]` | 第二列 x=161，第三列 x=269 |
| vertical wrap2；1 宽150、2 宽120 | `[376,60]` | 第二次改变不移动组，setItemSize仍发事件 |
| vertical wrap2；1 宽150后宽90 | `[326,60]` | 2 宽100成为首列最大，后组恢复原x |
| horizontal wrap2；1 高35 | `[218,99]` | 后组 y=44/68 |
| wrap1；1 → 500×60 | `[942,76]` | 仍是五组，后项x=511/619/727/835，不按像素重排 |
| wrap10、3行；2 高40 | `[110,104]` | 只有一组，3 y=73 |
| 单项 → 0×0 | `[10,16]` | 仅剩 padding |
| vertical wrap2；1 高80、3 高45、1 缩到10 | `[326,85]` | max组变为第二列：45+4+20=69，整体高69+16 |
| page2、可见顺序 `[6,1]`；6 → 120×30 | `[130,70]` | 6=`[6,3,5,120,30]`，1=`[1,3,39,100,20]` |

## Item Resized 时序、This 与 Item

尺寸 setter 在两个轴都结束后派发事件。探针捕获到的事件 snapshot 已包含最终行宽高、后续项位移与总体外框。`_updateRepeaterSize:1279–1289` 先写 repeater CSS/visibility 尺寸，再调用 ancestor fit；本探针的 fit 日志在 Item Resized 之前。

事件源是 `r-itemId`，不是没有行 suffix 的 repeater 本体。原 `doc.js:328–347` 返回有效 Item，按当前 active/page 顺序填写 index、first/last/even/odd，并读 isMarked 与 DOM 实例存在性。原 `getWidgetInfo:349–543` 的 This 以该行 ID 读几何：page2 案例得到 This.width=120、This.height=30、Item.index=1、isFirst=true、isLast=false。

这段 provider 探针执行原函数，但几何查询 `offsetBoundingRect` 是显式 CSS rectangle mock，不能冒充浏览器实际测量。实际旋转、border-box、隐藏、transform 等几何仍需别的证据。Item.Repeater 计数还可能使用 refresh 阶段缓存；本次未重做前期计数/Wait调查。

同步回调中再次 resize 是同步嵌套事件。探针把第一次 120×30 的 Item Resized 回调改成 130×40，顺序为 fit、fit、event(120×30)、fit、fit、event(130×40)，最终第二行位置和 root 反映后者。产品应保留现有循环/递归上限，不要把所有变化无条件延后到同一个末尾事件。

resetItemSizes 自身不派发事件。普通刷新清尺寸后、再逐行运行 Item Loaded；若 Item Loaded 重新设置不同尺寸，事件可嵌入该行加载过程，并非总在所有 Loaded 之后。自动 fit 调用点及显式 This Item resize 的触发链由本轮另一份研究负责，本报告不扩大到完整动作生命周期。

## 不能混同的边界

### 直接 pushItems 的事件差异

原 `setItemSize` 的契约与直接 `_pushItems(..., suppressFire=false)` 不相同：

- wrapped 副轴非最大项变化，`1252` 提前 return，没有 push 自身的 Item Resized；但由 setItemSize 调用时，外层仍在 `1131` 派发一次。
- nowrap 副轴非最大项变化，`1178` 仍会派发，即使外框不变。
- direct push 有效主轴变化，在后续项位置更新之后派发。三个分支都有新增 probe。

因此产品中“显式尺寸动作”可对齐 setItemSize；其他 move/push 自动路径需要按其调用方式判定，不能给所有调用统一套同一个事件规则。

### 零行外框不是简单 0×0

初始 `155–172` 公式不特判 shownCount=0。以下是原数字函数结果：

| empty 模式 | 原公式 | 默认 fixture 结果 |
|---|---|---|
| vertical、wrap=-1 | `[paddingX+offset.width, paddingY−gapY]` | `[110,12]` |
| horizontal、wrap=-1 | `[paddingX−gapX, paddingY+offset.height]` | `[2,36]` |
| 正数 wrap | `[paddingX−gapX,paddingY−gapY]` | `[2,12]` |

若 padding 小于 gap，会得到负 CSS 设置值；实际浏览器 used value 未验证。空表没有可 resize 的 row entry，不能通过造零行修正布局。产品若采用友好的非负空外框，应标明差异而非称完全相等。

### 非零 border 与非法输入

`_updateRepeaterSize:1281–1285` 在本次 prop 更新时，无论 prop 是 width 还是 height，都按 repeater 主方向累加边框：vertical 用 top+bottom，horizontal 用 left+right。其 CSS getter/setter 和 box model 可能影响实际浏览器结果，不能只凭数值 mock 认定这是原版 GUI bug。

数值 probe：vertical 单项、border `[L2,T3,R5,B7]`，尺寸从100×20改120×30，root从110×36变为140×56；X更新加20+10，Y更新加10+10。border-box 初始化另使 x=paddingLeft−borderLeft、y=paddingTop−borderTop。**这不属于 border0 重算等价范围。**

原函数不自行 clamp 负宽高：单项设为−5×−7时数值 mock 得 root5×9。它也假设 itemId 在已初始化可见尺寸表内；分页隐藏行或不存在行会缺少 entry 而抛错。产品可以在模型/动作边界拒绝这些非法输入，不应把函数缺少校验解释为推荐支持负尺寸或隐藏行 resize。

## 建议的运行时状态边界

以下为独立产品设计建议，不是原厂字段名称：保存每个 repeater instance 的已提交 visible ID 顺序、每行实际宽高、layout revision、固定方向/wrap/gap。刷新先按模板/adaptive已支持范围重置；作用于当前真实行的 resize 改尺寸并重算所有已提交可见行布局，再派发该行的 Item Resized。渲染、This.width/height、Item事件源与hitbox应共享同一布局结果。

无边框常规数据可用本报告矩阵作合同。复杂adaptive、原版非零border补偿、负CSS、empty envelope浏览器行为仍属于未验证差异；嵌套 repeater 的独立数据作用域仍沿用前次报告的产品扩展边界。没有把厂商实现复制进产品。
