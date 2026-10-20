# Repeater 小数行尺寸与多行位置推移：真实宿主量化证据

2026-10-13。目标为 Axure RP **11.0.0.4150** 分发的原型 JavaScript。只执行 SHA 固定的局部原函数，在 Edge 真 DOM 中与独立 DOM 模型比较；未启动原 Axure 应用、未完成原版 GUI 差分。没有修改产品源码或产品测试。

## 结论和可实施数据合同

必须分别保存 **名义尺寸 N、CSS 赋值 I、几何缓存 G**，并分别保存 CSS 位置与移动缓存。请求值、浏览器 CSS 读回、DOMRect 不能合并成一个值。原行模型是带历史的逐轴修改，无法由当前 requested 尺寸重新排布后得到全部相同行为。

1. 初始化普通行时，N 与 G 都使用 raw template offset；CSS 写 template 尺寸后，不立即用 CSS 读值覆盖 G。初始 root 同样先存 raw envelope，后写 CSS。
2. `setItemSize` 同时先算 `deltaX = requestedWidth − N.width`、`deltaY = requestedHeight − N.height`。两者为零立即返回 false，保留所有 I/G/位置/事件计数。
3. 按 **X → Y** 处理非零轴。行新 CSS 赋值为当前该轴 CSS 读值加名义 delta；写后读回宽高两轴存 G，即使只改变 X，也会把 raw height 转为 CSS 读值。
4. N 使用 **`N += delta`**，不能直接设为 requested。组长度、最大值和推移差量使用 N；不能改用量化后的 G。
5. 主轴推动同组后继，差量就是本次名义 delta。wrap 副轴只在本组最大值改变时，按新旧最大值差推动后续全部组。对每个受影响行，读其当前 CSS left/top，加差量，写入，再读回 left/top 存移动缓存。不能重新从起点按所有行 G 累加。
6. root 的有效差量非零时，当前 CSS 读值加有效差量，再加布局主方向两侧 **computed border**，写 CSS，随后读回两轴存 root G。若 root 有效差量为零，保留原 root G，包括仍未量化的初始 raw 值。
7. X/Y 处理全部结束，发一次源为该行的 `onItemResize`。非零名义 delta 即可发事件；不要求 used CSS/DOMRect 实际发生变化。
8. 普通 refresh 重建 N/G/移动缓存并恢复初始 raw 计算。pregen 初始入口另从 CSS 读取 N，不属于本次数值矩阵覆盖范围。

原生 getter/provider 的静态补充见 [repeater-row-geometry-evidence.md](D:/WSCodex/REA/research/repeater-row-geometry-evidence.md)：直接 This 的新 widget-info 读取 G；保留的 Item.Repeater widget-info 还有首次读取后的懒缓存，不能通过本次 CSS 量化改动消除该独立语义。

## 方法、范围与复现

脚本：[repeater-row-quantization-probe.mjs](D:/WSCodex/REA/research/repeater-row-quantization-probe.mjs)。独立模型：[repeater-row-quantization-oracle.mjs](D:/WSCodex/REA/research/repeater-row-quantization-oracle.mjs)。

```powershell
Set-Location D:\WSCodex\REA
node research/repeater-row-quantization-probe.mjs --dpr=1
node research/repeater-row-quantization-probe.mjs --dpr=1.5
```

使用本机 Edge **155.0.4283.45**、分发的 jQuery **3.7.1**、原 reset/page CSS；`--force-device-scale-factor=1|1.5` 与 `viewport:null`，不是仅设置 context.deviceScaleFactor。原探针已证后者虽报告相同 devicePixelRatio，却不等价于宿主 CSS border 量化，详见 [repeater-box-model-dpr-evidence.md](D:/WSCodex/REA/research/repeater-box-model-dpr-evidence.md)。两次均 0 网络请求、0 page errors。

原路径执行精确源码片段 `resetItemSizes/setItemSize/_pushItems/_updateRepeaterSize`；初始化使用原 envelope 与 origin/位置递增片段，加最小自写行 DOM 构造。每行没有额外 border、padding、transform，template CSS 尺寸与 adaptive offset 相等，root 明确 border-box。独立模型用组 extent 和真实 DOM CSS 写读推演，未调用原函数、未调用产品 helper、未硬编码 DPR 或 1/64 量化公式。为研究浮点语义，保留 N+=delta 与原 raw 初始化算式的运算顺序。

比较每一步的名义表、inline CSS 字符串、computed CSS 字符串、root/row 几何缓存、移动缓存、事件 payload 和事件次数，均为精确比较。DOMRect 另作 <1e−4 容差比较，不作为 G 的替代来源。初始与重建也独立比较；不匹配时保留 JSON 并令脚本失败。

**每个宿主 10 fixtures、94 resize steps，全部匹配。合计 188 resize 匹配、20 initial 匹配、20 refresh/reinitialization 匹配，0 差异。**

| 矩阵 | 每宿主步骤数 | 涵盖 |
|---|---:|---|
| 两方向 nowrap fractional | 24 | 请求与测量值不同、重复请求、再请求 G、后项移动 |
| 两方向 wrap max-owner-switch | 24 | 组最大值变更、非最大项、跨组增长/缩小 |
| 两方向 subpixel template | 16 | 初始 .1×.2，padding/gap 小数、多次超小尺寸请求 |
| zero-border position history | 12 | 排除 root border 累加后独立观察位置/CSS 历史 |
| single-row small repetition | 6 | IEEE-754 微小非零 delta 与再次重复的 no-op |
| 两方向 shared five-row fixture | 12 | 可视场景：非最大 shrink、grow、repeat、已推移行再 grow、restore |

这里的 refresh 是调用同一提取初始化/reset 片段，以倒序 visible IDs 重建 root/rows；证明所选重置计算恢复 raw/template/顺序状态，**不是完整原 refresh 生命周期执行**，没有证明对象复用、Item Loaded 链、fit 递归的全部时序。筛选和分页在此只体现为已给定的可见 ID 顺序，本轮没有重新执行查询函数。

## 初始化浮点顺序

`repeater.js:155–172`：先求主/副方向 count，计算 `xOffset = offset.width + spacingX`；root raw width 先为 `paddingLeft + paddingRight`，然后 `+= offset.width + (widthCount−1)*xOffset`。Y 同理。不是先累加每一行，也不是代数展开的 `count*width + (count−1)*gap`。

共用 vertical fixture 的 width=140.1、gapX=8.4、widthCount=3、paddingX=6.4+4.2，在同一 JS 引擎中：

| 运算 | 结果 |
|---|---:|
| 原式 `(6.4+4.2) + (140.1 + 2*(140.1+8.4))` | 447.70000000000005 |
| 展开乘法 `(6.4+4.2) + 3*140.1 + 2*8.4` | 447.7 |
| 从 padding 开始逐项累加行宽与 gap | 447.69999999999993 |

原初始行几何直接是 140.1×46.2。`232–240` 起点为 paddingLeft/Top 减 computed borderLeft/Top；`287–297` 根据 wrap 逐次 `+= xOffset/yOffset`。初始移动缓存存这些 JS raw 数；后续被推移时，缓存会转为 CSS 字符串解析值。初始 root G 不应先通过 CSS 或 toFixed 归一化。

## 代表数值：请求、CSS 与重复

`vertical-nowrap-fractional-request-vs-measured` 使用三行100×20、gap .1/.2、padding[7,4,9,6]、border[3,5,7,2]，均为 top/right/bottom/left。host1.5：

| 操作 | changed | N | row G | root G | 累计事件 |
|---|---|---|---|---|---:|
| row1→130.1×35.2 | true | 130.1×35.2 | 130.094×35.1979 | 149.427×100.927 | 1 |
| 相同请求再次执行 | false | 130.1×35.2 | 130.094×35.1979 | 149.427×100.927 | 1 |
| row1→100.1×20.2 | true | 100.1×20.2 | 100.094×20.1875 | 128.75×95.25 | 2 |
| 相同请求再次执行 | false | 100.1×20.2 | 100.094×20.1875 | 128.75×95.25 | 2 |
| 用当前 G=100.094×20.1875 请求 | true | 100.094×20.1875 | 100.083×20.1667 | 138.073×104.562 | 3 |
| 再用当前 G 请求 | true | 100.083×20.1667 | 100.062×20.1458 | 147.385×113.865 | 4 |

**“设置为自己当前几何”不保证 no-op**，因为 G 与 N 不同。以上请求是 harness 将原几何缓存数值送回 setItemSize，不是完整 Axure 表达式运行；This provider 的读取来源另有静态证据。

`single-row-small-request-repetition` 另证没有 epsilon 判断。100×20→.1×.2 后，N 是 `.09999999999999432 × .1999999999999993`，再次同请求有极小正 delta，所以 still true，再次触发事件/root border 更新；第三次才 false。host1.5 的前两步 root G 为19.4271×25.5312→28.7604×34.8542，而 row CSS 两步都为.09375×.197917。禁止把 `N += delta` 改成直接 requested 或用 epsilon 抹去差量后再声称忠实此路径。

## 五行共用可视场景

参数：5 rows，wrap=2，140.1×46.2，gapX=8.4、gapY=6.3，padding[7.1,4.2,9.3,6.4]、border[3,5,7,2]。JSON 中 ID 为1..5；产品示例0-based row0/2/4分别对应1/3/5。

操作顺序：row1 副轴缩小（vertical120.05×46.2；horizontal140.1×35.1），row1→180.3×62.4，相同请求，row3→180.3×62.4，row5→180.3×62.4，row1恢复140.1×46.2，再重建。每个方向的累计事件依次1/2/2/3/4/5，重复请求 changed=false。

host1.5 vertical：

| 阶段 | row1 G | root G | row3 移动缓存 | row5 移动缓存 |
|---|---|---|---|---|
| initial | 140.1×46.2 | 447.70000000000005×115.1 | 152.9,4.43333 | 301.4,4.43333 |
| nonmax trim | 120.042×46.1979 | 同 initial raw | 同 initial | 同 initial |
| grow1 | 180.292×62.3958 | 497.229×140.625 | 193.1,4.43333 | 341.6,4.43333 |
| grow3 | 同上 | 546.76×140.625 | 193.1,4.43333 | 381.8,4.43333 |
| grow5 | 同上 | 596.292×140.625 | 193.1,4.43333 | 381.8,4.43333 |
| restore1 | 140.083×46.1875 | 565.417×140.625 | 152.9,4.43333 | 341.6,4.43333 |

host1.5 vertical 初始 row CSS 是140.094×46.1979，与 initial raw G 不同。trim仅写 X，却读回两轴更新 G；root 未变化，继续保留 raw。grow1 后 root inline 是497.231×140.627，G则是497.229×140.625，不能将读回值再写回 CSS 当作原赋值。

host1.5 horizontal 的 root G 依次为 initial299.20000000000005×167.6、trim仍raw、grow1为346.062×190.458、repeat不变、grow3为352.719×213.323、grow5为352.719×236.188、restore1为352.719×226.646。对应 row5 y 缓存为109.43333→125.633→141.833→141.833→125.633，显示读 CSS 再递增后的字符串精度历史，不等于任意时刻 raw 起点加理想长度。

### 主轴同长组也可能有非零差量

上述 horizontal grow3 的“原本同长”组，`1203–1221` 先累加本组 before，然后 **after=before+delta**，与其余组的循环总和比较；不是先改成员，再全量重算 after。此例有效差量是 `5.684341886080802e−14`，所以触发 root width CSS 更新并加主方向 computed border。

实际原函数 host1宽度346.375→353.375；host1.5宽度346.062→352.719。独立 oracle 的每步 `rootWrites` 提供所预测的具体差量与赋值，最终 CSS/G 与原函数全部一致。该差量诊断来自独立模型并受对应源码计算次序支持；JSON未额外 hook 原函数内部局部变量。不能用近似相等或“理想 envelope 没变化”消除此观察。

## 证据文件、来源与哈希

包 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。REA extraction：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。源位于 `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources`。

| 文件 | SHA-256 |
|---|---|
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| jquery-3.7.1.min.js | `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85` |
| axure_rp_page.css | `595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a` |
| reset.css | `579b70dd71cfaca21c03a770a89fb182413a3228bdff0febcb0513f112b2cb59` |
| [host1 JSON](D:/WSCodex/REA/research/repeater-row-quantization-host-1.json) | `3566e662eee12c58c86300d328bf02027f105bbcaa3d9e3f0bffe737480dde5b` |
| [host1.5 JSON](D:/WSCodex/REA/research/repeater-row-quantization-host-1p5.json) | `74b0c7a5e153b509592589e805c2ad21f67e6ded87402a5a578f2c6634095b21` |
| probe.mjs | `05ce678526d6dbbba87618783cddd96c10f11d8c9a41f741290143321eafc127` |
| oracle.mjs | `9cb0763190f7d1546b5afe52a4c7cb947383b49c31721baa9988204989e0b745` |

两份 JSON 保存所有 fixture、请求/之前/之后、原函数与 oracle完整快照、环境信息和 SHA；保存了原源码行155–172、232–240、270–300、1080–1289、1483–1490的最小上下文。其他相关位置：普通 refresh230传offset；pregen554不传offset；1118–1134控制delta/顺序/事件；1143–1144行CSS读写；1153–1179 nowrap副轴；1196–1233主轴；1234–1263 wrap副轴；1266–1273后继移动；1279–1289 root更新。

## 独立产品对照及未证明边界

root agent另运行了 [verify-repeater-row-product.mjs](D:/WSCodex/REA/research/verify-repeater-row-product.mjs)，结果 [repeater-row-product-verification.json](D:/WSCodex/REA/research/repeater-row-product-verification.json)，记录时间2026-10-13T11:17:18.806Z。已读取报告确认：序列化产品 runtime 在真实 host1/1.5 下，对本报告两份固定 SHA JSON 的20 fixtures/188 steps及全部 initial/refresh 精确匹配 CSS字符串、N、G、移动缓存、事件数。该文件记录产品源 SHA；这是该版产品局部运行时验证，不等同后续版本、完整编辑UI或打包产品验证。共享 scenario/E2E 由 editor_core agent另行实现，其结果不计入本报告188步。

未证明：完整原GUI/生成器默认box-sizing、pregen数值矩阵、template CSS size与offset不一致的adaptive配置、row自身CSS border/padding、变换/动画/跨显示器/运行中缩放、嵌套fit重入、完整refresh事件链、隐藏/非法行请求、其它浏览器版本与宿主缩放值。parent fit、事件分发只是记录器；本轮没有复刻其布局递归。正数有效可见行的狭窄量化路径有证据，不代表 Axure 整体兼容。
