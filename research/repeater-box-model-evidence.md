# Repeater 边框、padding 与浏览器 used geometry

2026-10-13；目标为已提取的 Axure RP 11.0.0.4150。**52 项探针通过，其中独立布局 oracle 与真实 Edge 对比 24 组、288 次 resize 全部匹配。边框累加是真实 DOM 中可复现的原函数行为，不是上一轮数字 CSS mock 的假象。** 本报告只增加 research 文件，没有修改产品、运行原版应用、加载目标 DLL，或声称完成原版生成页面的端到端验证。

产品可以明确选择 `border-box`、物理 CSS padding 为 0，再采用下述已验证合同。**本轮未证明原版所有 repeater 默认采用 border-box**；这一产品选择必须与原版默认值的结论分开。`content-box` 作为研究对照完成验证，不要求产品提供该模式。

**后续缩放修正：本文的固定数值来自DPR1。真实宿主1.25/1.5会改变computed border和连续CSS读回，不能把作者边框宽度直接当作所有宿主的有效值。详见[DPR补充报告](repeater-box-model-dpr-evidence.md)。原52项JSON及SHA保留；入口脚本后续已参数化，下面的脚本SHA是当时原始版本记录。**

## 1. 执行环境、复现与证据身份

```powershell
Set-Location D:\WSCodex\REA
node research/repeater-box-model-probe.mjs
```

结果为 `pass:true, probes:52`。浏览器为本机 headless Microsoft Edge **155.0.4283.45**，`CSS1Compat`，DPR 1，分发 jQuery **3.7.1**；页面错误 0、网络请求 0。探针对所有网络请求设了 abort；使用空白页、真实元素、真实 jQuery CSS hooks，加载了分发的 `reset.css` 和 `axure_rp_page.css`。没有加载 Axure 整个运行时。固定 adaptive 属性读取、父 fit 回调和事件派发是明确的模拟/记录接口。

- [可复现探针](repeater-box-model-probe.mjs)，SHA-256 `0cbad1085b2eb2c085f48da7735667374a8d0c047362405c2e4a35c50ea2bb46`。
- [52 项结果、浏览器元数据、逐步尺寸和 5 段原源码](repeater-box-model-evidence.json)，SHA-256 `23e4c30119563b3a5a0b1c03bfa8b422f6ba4ce1520c792b1c42d65e9c47ee0e`。
- 原函数读取自 `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`。可将此目录作为探针第一个参数。
- 原包 SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`；原提取证据 `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。

| 原文件 | SHA-256 |
|---|---|
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| jquery-3.7.1.min.js | `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85` |
| axure_rp_page.css | `595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a` |
| default.css | `c386bd6c672653bd7dc596ef3f0349d272b8451e47c5a5cd295f60e3d31677de` |
| reset.css | `579b70dd71cfaca21c03a770a89fb182413a3228bdff0febcb0513f112b2cb59` |

`default.css` 只作静态身份核验，没有应用到探针页。该资源含查看器 UI 的局部规则，不能据此推导 repeater 根元素的 generated CSS。

## 2. 原调用链与初始坐标

`repeater.js:155–172` 根据可见行数、固定个数 wrap、模板 offset、四边 padding 和两轴 gap 求初始外框，并先把**未经 CSS 钳制的数值**传给 `setResizedSize`。`225–230` 移除原行并 reset 尺寸表；`232–240` 求行原点；`270–285` 创建 absolute 行并写位置/尺寸缓存；`287–297` 作固定个数的行列推进；`300` 才给根容器执行 `.css(repeaterSize)`。

令 layout padding 为 `P=[T,R,B,L]`，实际有效 border 为 `B=[T,R,B,L]`。原点分支仅检查根元素 **computed box-sizing**：

| 模式 | 行 CSS left/top | 行 DOM 外边框相对根外边框的位置 |
|---|---|---|
| border-box | `P.left−B.left, P.top−B.top` | `P.left, P.top` |
| content-box | `P.left, P.top` | `P.left+B.left, P.top+B.top` |

原函数 resize 推移行时保留此初始原点，只有 refresh 重建行才重新套用。负的行 CSS left/top 是可能且有效的，例如 padding 为 0、有正边框时，border-box 行能从根的外边框原点开始。

上述关系在真实浏览器的非对称边框 `[T3,R5,B7,L2]` 下验证，涵盖两方向、无 wrap 与 wrap=2。这里不包含 CSS transform、滚动条、margin、百分比宽高或自定义样式注入。

## 3. padding 不是同一个量

原函数从 `repeaterPropMap` 读取的 padding 是**布局输入**，参与原点和总外框计算。浏览器的 `style.padding` 是独立 CSS 盒属性；两者不能无条件写成同一份值再一起加总。

例如 layout padding `[T5,R7,B11,L3]`、单行 `100×20`，raw envelope 为 `110×36`，border `[T3,R5,B7,L2]`：

| 模式 | 物理 CSS padding | `.css(width/height)` | DOM outer | `.width()/.height()` | 首行相对根外框 |
|---|---|---:|---:|---:|---:|
| border-box | 全 0 | 110×36 | 110×36 | 103×26 | 3,5 |
| content-box | 全 0 | 110×36 | 117×46 | 110×36 | 5,8 |
| border-box | `[13,17,19,23]` | 110×42 | 110×42 | 63×0 | 3,5 |
| content-box | `[13,17,19,23]` | 110×36 | 157×78 | 110×36 | 5,8 |

第三行说明 border-box 的 CSS used 高度有 `paddingTop+paddingBottom+borderTop+borderBottom=42` 的下限，尽管 inline height 仍是 `36px`。初始 `setResizedSize` 缓存还是 raw 36，不自动变为 42。

**可实施产品约定：layout padding 单独保存和计算，根元素物理 CSS padding=0。** 这是已探针验证、与当前模型可组合的合同；未把“原版生成器永远不写 CSS padding”当作已证事实。

## 4. resize 的边框累加与可执行合同

`setItemSize`（1118–1134）依次 push X、push Y，再发一次 Item Resized。`_pushItems`（1136–1277）用当前各组的尺寸变化求 envelope 的有效增减，并移动受影响的行。根更新 `1279–1289` 先读当前 jQuery `.css(prop)`，加有效差量，再加**主方向的两边边框总和**：纵向为 top+bottom；横向为 left+right。无论本次更新的是 width 还是 height，都使用该主方向边框总和。

这段行为在 content-box 和 border-box 都存在。单行初始 `110×36`，上述非对称边框，先 X 从100→130，再 Y 从20→35，随后 X→100、Y→20：

| 模式/方向 | 最后 inline / computed | 最后 DOM outer | 刷新后 computed |
|---|---:|---:|---:|
| border-box / vertical | 130×56 | 130×56 | 110×36 |
| content-box / vertical | 130×56 | 137×66 | 110×36 |
| border-box / horizontal | 124×50 | 124×50 | 110×36 |
| content-box / horizontal | 124×50 | 131×60 | 110×36 |

即使所有行尺寸回到初始值，root 仍累加每次有效更新的 border；**不能用纯几何重算覆盖这部分历史状态**。刷新才重置。

在产品明确 border-box、物理 CSS padding=0 的范围内，已验证以下独立实现合同：

1. 维护理想 envelope：按可见顺序、固定个数 wrap、每行尺寸、gap 和 layout padding 全量重算。其公式见[上一轮布局矩阵](repeater-item-resize-evidence.md)。它只决定 resize 的有效差量，不替换已累加的 root CSS 尺寸。
2. 初始化：缓存 raw envelope；DOM inline 尺寸为 `max(0,raw)`，CSS computed 尺寸为 `max(axisBorderSum,inline)`。行 CSS 原点使用 padding 减左/上边框。
3. resize 按 X→Y 处理。某轴理想 envelope 差量 `d=0` 时不更新 root，不累加边框。`d≠0` 时，`nextInline=max(0,currentComputed+d+primaryBorderSum)`；随后 `nextComputed=max(axisBorderSum,nextInline)`。
4. 每次有效 root 更新后，读取**两轴**的 computed width/height 到原尺寸缓存；另一轴即使没写入，也可能从初始 raw 值变成浏览器的最小边框尺寸。`_updateRepeaterSize:1287` 是这个双轴读回点。
5. 非最大行的变化可能改变某个 row，却没有 envelope 差量；不得因此加 border。如果 X/Y 两轴都不改变 envelope，root cache 可继续保留原始 raw。相同 row 尺寸是 setItemSize no-op。
6. 刷新同一个根 DOM 容器时重建行、resetItemSizes，并重新写 raw envelope；这会清除此前累加。筛选/分页/排序导致的 refresh 使用新的可见行顺序。

独立 oracle 没有复制 `_pushItems` 的分支；它以完整理想几何重算加上述历史补偿，与真实原函数比较 24 组/288 次操作，全部匹配。这些操作中 133 次至少一个轴差量为 0，10 次两个轴都为 0，覆盖“行变但外框不变”的情况。尺寸包含 0、边框不对称、padding 小于边框；每一步比较 inline、computed、outer、cache 和所有行实际相对位置。

极小初始尺寸很重要：单行模板 `0×0`、padding=0、border `[T3,R5,B7,L2]`，初始 inline=`0×0`、computed=`7×10`、缓存=`0×0`。行变为10×10后，vertical root 为27×30，horizontal 为24×27。应从 used CSS minimum 计算，不能从 raw 0 直接加差量。

## 5. 空行数、负 CSS set 与恢复

初始公式没有对 0 行做一般的零外框特判：

| 0 行布局 | raw width | raw height |
|---|---|---|
| vertical/no-wrap | `paddingX+templateWidth` | `paddingY−gapY` |
| horizontal/no-wrap | `paddingX−gapX` | `paddingY+templateHeight` |
| wrap（两方向） | `paddingX−gapX` | `paddingY−gapY` |

padding 四边均1，gapX8/gapY4，wrap=2 的 raw 是 **−6×−2**。真实原 jQuery `.css({width:-6,height:-2})` 将 inline 写为 `0px/0px`，不是保留之前值；content-box 的 computed 是0×0、outer7×10，border-box computed/outer 都为7×10。两种模式的初始原版缓存均仍是 **−6×−2**。

对照实验直接执行 `element.style.width='-6px'` 会被浏览器拒绝并保留旧110px；它和原 jQuery setter 的钳0结果不同，不能用裸 CSS 负值推测原函数表现。有物理 CSS padding `[13,17,19,23]` 的对照中，empty outer 为47×42。

padding 大于 gap 时也验证：四边 `[T15,R17,B19,L23]` 给 wrapped empty32×30、vertical/no-wrap140×30、horizontal/no-wrap32×54。不能把所有空数据外框一律写0，也不能把所有空外框一律钳到 border 总和。

额外4项在**同一根元素**执行：非空→resize→empty→按新顺序恢复非空。两方向/两模式都证实 raw/cache 重新初始化、inline 钳0、行顺序和原始外框恢复。该探针调用的是提取出的初始化/布局片段，没有重复原版完整 refresh 数据/事件生命周期；空回调事件语义仍见[空数据证据](repeater-empty-evidence.md)。

## 6. 生成器证据：默认 box-sizing 尚未收敛

资源 CSS 可以排除一个错误推断：`axure_rp_page.css:65–66` 的 border-box 属于 input，77–78 属于 textarea；没有给普通 div/repeater 统一指定该模式。真实页面只应用 `reset.css` 和 `axure_rp_page.css` 时，测试 div 的 computed box-sizing 为 content-box。这不代表正式 generated `files/.../styles.css` 不会覆写。

本轮用 PEReader 静态扫描方法引用，不加载目标程序集：

- [扫描脚本](repeater-box-model-callers.ps1)，SHA `4204137f4051bf2fcbf3bfd044cf13a13489dc46cbf6db431a08d6728d151bfe`。
- [getter 调用点索引](repeater-box-model-callers.json)，SHA `4f428418fb6a2c9dbec12e039dbdbe18aabb61f3c914fb6f395b3b4551a610e1`。
- [repeater generator CIL](repeater-box-model-generator-cil.json)，SHA `1690934ce6146dd1f07fa30f6bf2b55065febc055618ad4c2fb7e24ec62db453`。
- [CSS writer CIL](repeater-box-model-css-writer-cil.json)，SHA `47847456f0e75763bf70acc3ad99ee1b83ad65632a9e522740726353f9981681`。
- 目标 `AxureRP11.dll` SHA `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。

可复现命令：

```powershell
pwsh -NoProfile -File research/repeater-box-model-callers.ps1 |
  Set-Content -Encoding utf8 research/repeater-box-model-callers.json
$rpDll = 'C:\Users\Administrator\AppData\Local\Temp\rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc\Axure RP 11\AxureRP11.dll'
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $rpDll -TypeName FNiU -MethodNames SNil,aNPa,zNPX |
  Set-Content -Encoding utf8 research/repeater-box-model-generator-cil.json
& research/scripts/inspect-rp-serialization.ps1 -AssemblyPath $rpDll -TypeName JNLP -MethodNames PNLQ,VNL2,SNLp |
  Set-Content -Encoding utf8 research/repeater-box-model-css-writer-cil.json
```

已确认调用点：

- `FNiU::SNil` token `0x06008DEF`，IL `0x61–0x96` 读取 Repeater BorderWidth/BorderStyle/BorderColor、可见边/圆角等参数，调用 `JNLP::PNLQ`；返回样式项被装入字典，后续交给 writer。
- `FNiU::zNPX` token `0x06008E1B`，IL `0x173–0x1AF` 有同一边框 writer 路径，再由 `JNLP::SNLp` 写出。
- `JNLP::PNLQ` token `0x06008C63`，IL `0x0D–0x2A` 的前置条件是 border width>0、style≠9、color 非透明；`0x2F–0x31` 还检查一个 flag。`0x36–0x72` 在该分支加一对字符串键值，之后 `0x77–0x98` 加 border width/style/color。
- 该字符串键值经 `wIhA.zIhQ::sIho` 和内部静态字段还原，本轮未解析其字符串表。**不能把这对字符串写成已证的 `box-sizing:border-box`，也不能由此认定无边框/透明边框时模式相同。**

因此采用明确的产品 border-box 设置可实现前述真实原函数合同，但“原版所有新建、导入、inner repeater、无边框/透明/隐藏边的默认模式”仍未知。没有为证明这个默认值而执行目标 DLL、启动原程序或扩大解密研究。

## 7. 边界

已证明的是指定版本/浏览器下、显式探针 CSS 的真实盒模型和原函数数值变化。DOM 行创建是对 `270–285` 的最小手写等价构造，初始 template CSS size 与 adaptive offset 相等。函数内部没有替写成产品实现。

尚未覆盖：原生成器完整 CSS 输出；adaptive 中初始 CSS size 与 offset 不同；滚动条、zoom、transform、跨浏览器、非整数边框舍入；嵌套 repeater 与 parent fit 反馈、动画和完整用户事件链。边框有效宽度以浏览器 computed border 为准；比如 border-style:none 的视觉边框宽度不应简单从作者 strokeWidth 推定。本轮不是原版 GUI 验证，也没有为这些未证模式扩大产品支持声明。

## 8. 独立产品的后续回归（与原函数探针分开）

研究完成后新增 [repeater-box-geometry.spec.ts](../tests/e2e/repeater-box-geometry.spec.ts)、共享 [exerciseRepeaterBox](../scripts/repeater-box-scenario.mjs) 及其类型声明。运行 `npx playwright test tests/e2e/repeater-box-geometry.spec.ts`：**2/2 通过（11.2 秒）**，分别使用实际编辑器预览与下载的 `file://` HTML；离线 context 禁网，HTTP(S) 请求0、页面错误0。`npm run typecheck` 同样通过，没有运行全套 E2E。

场景覆盖 padding `[7,4,9,6]`、border `[3,5,7,2]`、100×20 单行，确认 CSS origin4/4、root110×36；Grow130×35→root150×61；Reset100×20→root130×56；refresh→110×36。同尺寸动作不重复发事件。空 wrapped 的 inline0×0、computed/outer7×10，与 This/Target raw−6×−2 分开断言；另一个普通 widget 移动/缩放后，这两种 provider 均读取实时位置尺寸。

初次试跑发现的是新 fixture 的错误事件挂载：初始0行不会触发 Item Loaded。改用 repeater 自身 Loaded 记录初始 This raw 后，两播放器通过；没有因测试预期而修改产品生命周期。

- [可复用 `.rea.json` 场景](../artifacts/repeater-box-demo.rea.json)
- [预览截图](../artifacts/repeater-box-preview.png)
- [真正导出离线 HTML 截图](../artifacts/repeater-box-offline.png)

两张截图均已目视检查，三组说明/日志可读且不遮挡。以上截图来自独立产品，不能作为原版 Axure GUI 差分证据。后续完整套件、打包及 native smoke 由主任务统一执行，本报告不提前声明其结果。
