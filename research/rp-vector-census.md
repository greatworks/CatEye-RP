# RP11 VectorShape 实存路径清点

## 范围与结论

本清点使用此前固定 SHA 的 11 个官方样本，由自写 container/object reader 只读解码；未运行供应商 DLL、原版 GUI 或生成器。新增 `rp-vector-census.mjs` 和 `rp-vector-census.json`，不修改产品、解析器或旧研究证据。这里的“候选”只指可识别的存储结构，不代表整个对象可导入、更不代表视觉兼容。

观察到 **2,805 个 VectorShape，5,677 条 path，66,897 个顶点**。直接出现在当前 page/panel-state Diagram 成员表中的对象为 **2,774**；其余 31 个不能当作顶层页面元件追加。所有 11 文件均为 0 package failure、0 diagram semantic failure。

每个顶点恰有 `Path / LowerHandle / HigherHandle / HigherSegmentExists` 四键，三个坐标 map 恰有 `X / Y` 两键。全部锚点为有限数字且在 `[0,1]`。控制柄是有限数字对或两个 NaN 哨兵；**没有半轴 NaN、无穷大、缺键、额外顶点键、空 path 或单点 path**。最短 path 为 2 点、最长 307 点；对象最多 39 条 path、364 点。控制柄不能裁到 `[0,1]`：233 个对象超出单位范围，全部有限控制坐标的总范围为 `[-0.0381085840707982, 1.0341381221238937]`。

数据中的 `NaN` 字符串专门表示 reader 的原始 `{$number:'NaN',numberTag:6}` 哨兵；不是文字控制点、不是零，也不应使用 `Number('NaN')` 后静默补零。

## 每个样本的计数

“含 false”不等同于整个对象开放：复合对象可同时有闭合轮廓与开放直线。

| 文件 | VectorShape 原始对象 | 直接成员 | 复合路径对象 | 至少一个 false 段 |
| --- | ---: | ---: | ---: | ---: |
| Default.rplib | 33 | 23 | 1 | 5 |
| Flow.rplib | 35 | 35 | 12 | 14 |
| Icons.rplib | 920 | 920 | 766 | 0 |
| Sample form patterns.rplib | 997 | 986 | 48 | 50 |
| Sample UI patterns.rplib | 297 | 287 | 14 | 22 |
| Prototype Starter.rp | 101 | 101 | 14 | 2 |
| Prototyping Basics.rp | 219 | 219 | 7 | 6 |
| Quick Win.rp | 28 | 28 | 0 | 2 |
| UX Prototyping.rp | 166 | 166 | 17 | 6 |
| the-basics-tab-menu.rp | 4 | 4 | 0 | 0 |
| complex-interactions-required-fields.rp | 5 | 5 | 0 | 0 |

完整路径分布、来源绝对路径和 SHA 存于 JSON 的 `samples`，逐对象来源由 `sampleSha256 / packageId / packageSha256 / id / offset` 定位。不能单独用 object ID 联结跨 package 对象：Default 库会在不同 package 重用相同 ID。

## 拓扑和控制柄组合

路径数：1 条的对象 1,926；多条的对象 879。855 个复合对象的所有 path 均是全 true；其中只有 95 个是 11.0.0.0 包、93 个是直接成员。**Default 和 Flow 没有全闭合的复合对象**；这两个库中的 compound 都混有开放/断开段，不能用作全闭合洞填充的正例。

| path 的布尔序列 | path 数 |
| --- | ---: |
| 全 true | 5,544 |
| 只有最后一个 false | 125 |
| 非末尾位置有 false | 8 |

8 条内部断开的 path 属于 Flow 的 5 个对象：

| Diagram 名称 | packageId | object ID |
| --- | --- | --- |
| Logical or | 92476d9294a046d287418b0e2bca600a | 9b4ede1f17314ff080e3468a52cc0eff |
| Summing junction | 4dc932a8e03547abb1304d1852d8e81c | 93e48049d6c24a7b8fcdf0ee77ab05be |
| Internal storage (RAM) | 53fcdc5c5ccf4bba996da33f9fcf6d38 | 8f734fc8bbd342258cbd6a433b05f447 |
| Multi-document | b11826e3576f4257b44f2f2de1aa1c43 | 8e68b32ab0f04b01b09cf6a244938674 |
| Subroutine/Predefined process | 4a256a8b7c3f41fab020b3c7c69821fc | f59e523963ff4d8f8cef9b9f6ffedce1 |

这些对象的 fill 分组与断点处理需要额外原生证据，当前不建议为了扩大覆盖率自行旋转起点、补闭合段或填充内部断口。

按单个顶点的 `Lower / Higher`：12,350 点双 NaN、32,223 点双有限、11,162 点只有 Lower 有限、11,162 点只有 Higher 有限。1,443 个对象有单侧有效顶点，但这通常只是直线/曲线交界。**真正一个已启用段的 `previous.Higher / current.Lower` 单侧缺失只有 20 条**，不能把这两个统计混淆。

| 已启用段两端柄组合 | 段数 |
| --- | ---: |
| NaN / NaN | 23,369 |
| 有限 / 有限 | 43,375 |
| NaN / 有限 | 10 |
| 有限 / NaN | 10 |

另有 15 对循环相邻锚点相同。这是存储观察，不能不检查控制柄就删除同锚点曲线。段是否启用按前一顶点的 `HigherSegmentExists` 清点；起始前一顶点为该 path 的最后一项。此解释与并行 CIL 调查的 `L5vW.J5vd` token `100722490` 相符；具体绘制/填充规则由该调查负责，本清点不重复反编译。

## Shape 枚举不是几何替代品

枚举来自已留存 `metadata-Shape.json` 的 **Axure.Platform.Shape，type token 33558174**，不能套用 `Axure.Axvg.Graphics.ShapeType` 的不同编号。

| Shape 值 / 名称 | 对象数 |
| --- | ---: |
| 0 Rectangle | 1,388 |
| 300 Vector | 1,127 |
| 15 Ellipse | 172 |
| 29 HorizontalLine | 79 |
| 10 Placeholder | 7 |
| 207 Triangle | 7 |
| 16 ArrowButtonRight | 4 |
| 30 VerticalLine、214 StackedRect、27 SpeechBubbleRight、32 Pie | 各 2 |
| 21 DropUpsideDown、204 File、203 Diamond、208 Trapezoid、213 Database、212 Actor、202 BeveledRectangle、211 Parallelogram、205 Bracket、206 Semicircle、210 Hexagon、216 StackedFile、25 ArrowRight | 各 1 |

同一种外观可能保存为 `Shape=300` 自定义路径。应恢复明确的 ControlPoints，不能依据 Shape 的名字生成一个近似 CSS 图形再声称恢复了原路径。

## 空文本、版本和候选上限

2,805 个对象中，包版本分布为 11.0.0.0 的 1,890、9.0.0.0 的 914、9.0.1.0 的 1。旧 9.0.0.0 对象都在 Icons 库，且是无显式文字的 Shape300；9.0.1.0 对象在 Required Fields，Shape0 且有显式文字。产品 parser 能读取旧包并不等于新空文本推断已获旧版语义证据。

无 TextBlock 和 RichTextBlock 的对象共 1,526。限定 11.0.0.0 和原有 18 个已观察属性键后为 **609**，其中直接成员 586；原 Shape0/15 的 291 个之外有 **318 个新增形状候选（直接成员 316）**。共同继承的 VectorShape→TextRectObject→RichTextObject 空串省略写入机制应由 CIL 证据支持；本清点只证明字段集合与版本一致，不能单独证明任意缺字段对象为空串。

所有无文字候选的共同键仍是：`ControlPoints, Shape, reference-page-package-id, name-block, tooltip, IsContained, IsLocked, SelectedStyleGroup, MyStyle, AdaptiveStyles, SubmitButton, Disabled, Selected, Error, VisibleFromSettings, AutoFitHeight, AutoFitWidth`；可选 `InteractionMap`。另外 3 个 RP11 无文字对象带 `SmartControlPoints`（Sample UI 的两个 Pie32 和 Basics 的一个 ArrowRight25），不在此推广范围。914 个旧版无文字对象也不在范围内。

| 分层过滤（不含样式/布局/文字最终检查） | 原始对象 | 直接成员 | RP11 原始 | RP11 直接 |
| --- | ---: | ---: | ---: | ---: |
| 仅明确顶点结构 | 2,805 | 2,774 | 1,890 | 1,859 |
| 再拒绝内部 false | 2,800 | 2,769 | 1,885 | 1,854 |
| 再仅新 Shape（排除 0/15） | 1,240 | 1,238 | 326 | 324 |
| 全闭合复合对象 | 855 | 853 | 95 | 93 |

这些行是不同筛选层，不是可相加的新增恢复量，也不是最终 importer 计数。

## 边框与样式观察

PName 元数据列出的边框字段为 BORDER_FILL=8、BORDER_WIDTH=15、LINE_PATTERN=16、BORDER_VISIBILITY=80。显式本地 BORDER_WIDTH 全为单个有限数值（0/1/2/4/5/7/20），未见每段或每边宽度 map；ControlPoints 顶点也没有样式键。本地 BORDER_FILL 1,567 项均为 solid；本地 FILL 为 1,486 项 solid、7 项 linear-gradient、2 项 radial-gradient。没有本地 LINE_PATTERN 项，不能由缺失推出默认 solid。

但 **45 个对象本地 BORDER_VISIBILITY 为局部边掩码**：1×8、2×16、3×2、4×2、5×1、6×2、8×14（前者是值，后者是数量）；全部是 Shape0。它们不能直接把单个 BORDER_WIDTH 绘成全轮廓 uniform stroke。当前受限语义快照中只有 521 个直接对象得到完整缓存链；2,253 个没有完整继承链。未映射的有效 LINE_PATTERN 原始值有 525 项值 1，本清点不凭数字猜 enum 名称。

因此能证明的是“单一宽度字段”，不是“每个样本的可见边框都统一完整”。新 Vector/非矩形本地未出现局部边掩码，但继承、adaptive、状态样式、虚线/端点/连接方式和外阴影仍须明确解析或保留警告；只统计本地字段不能宣布全样式保真。

## 推荐真实回归对象

1. **开放复合十字**：Sample form patterns.rplib，package `0581800951de42b9b1e81ec3aa427dfa`，object `a013e4439c9f4eea97bd3e1e19144660`，Diagram `Input stepper 1`。两条 path 分别为 `(0,.5)→(1,.5)` 与 `(.5,0)→(.5,1)`，每条 flags `[true,false]`、全部柄 NaN；显式 `(x,y,w,h)=(278,48,14,14)`，本地 stroke `#717171`、width 2。
2. **单端柄补锚**：Flow.rplib，package `a54b78fa63b74288806a69616ceff901`，object `faf5956c4dad4ea5aa21fe383b24a645`，Diagram `Delay`，闭合 5 点。锚点依次 `(0.0049019607843136725,0.008169934640522788)`, `(0.0049019607843136725,0.9844771241830065)`, `(0.53921568627451,0.9844771241830065)`, `(1,0.4983660130718955)`, `(0.53921568627451,0.008169934640522788)`。仅第四点有柄：Lower `(1,1.0212418300653596)`，Higher `(1,-0.0245098039215686)`；其余柄 NaN。保存 bounds `(100,100,100,59.80392156862745)`，**另有 6 个 adaptive 样式，不能当完整无条件导入正例**。
3. **全闭合复合路径**：Prototype Starter.rp，package `90fd4ed4c9744465add63a878e1da5f1`，object `9400519e576846fba77e7f7b43374366`，PanelState `Blood`。两条 path 为 5+6 点、全 true；保存 bounds `(298,142,24,33)`，AutoFit 两项 false、adaptive 0，本地 solid fill 与 strokeWidth 0。第二条位于第一条内部；是否形成洞取决于填充规则，不能只凭包含关系臆造 hole。JSON 保存完整双精度控制点。相同路径另见同文件 package `dbf50f111c33407cab8d0fdc6bcae297` / object `d03d7e4205ab4c879bcb27b9b1d5a6a7`，位置 `(808,309)`。
4. **内部断点拒绝**：上表 Flow `Logical or`。三条 path 为 `4+2+2`；第三条两点 flags `[false,true]`，不是通常末点 false 的线。可验证严格拒绝，不应擅自把它改成 `[true,false]`。

上述 bounds 仅为保存的对象样式；不保证浏览器或原 GUI 的渲染外框与其逐像素相同。官方样本用于本地研究与测试，不打包进产品。

## 复现、哈希与未证明内容

在 `D:\WSCodex\REA` 执行：

```powershell
node research/rp-vector-census.mjs
```

脚本读取冻结的上一阶段 sample manifest，并验证每个来源文件 SHA。JSON 保存生成时所有 reader 源 SHA；执行末尾再次检查源文件未在过程中改变。`records[].paths` 的元组编码为 `[Path.X,Path.Y,Lower.X,Lower.Y,Higher.X,Higher.Y,HigherSegmentExists]`。`candidateLayers`、`aggregateDetails` 可用于筛选，不必打印全部 13 MB 逐对象证据。

- 本次 JSON SHA256：`cc3218a404ce0e05dc1ba6d3165f9009721673e05e53924458e2ead1e6c2e15a`
- 本次脚本 SHA256：`5a717d577d4157e9a0a71704150759d5df95942d41648f2acf873b01056bdcfe`
- 旧 sample manifest SHA 保持：`b3224f3af1aadab47232d5b4eefdcc8e873f0a0b4d611957217340557548fb1d`

未证明：原版 fill-rule、复合 path 分组/内部断点填充、端点/连接方式、世界/本地坐标和描边内缩的完整变换、旧版空文本语义、复杂 adaptive/selected/contained 布局、完整原版 GUI 渲染。CIL 路径构造与填充由并行专门调查提供，不能把这份 corpus 清点当作其替代证据。

## 后续独立只读审阅（2026-10-13 20:06）

并行静态调查已另在 `rp-vector-path-evidence.md` 记录 SVG fill 的显式 NonZero=0 链和开放轮廓填充闭合规则；它补充了上面的“本清点未证明”项，不意味着已完成原版 GUI 差分。

审阅本轮 `read-rp-semantics.mjs` 的 `recoverVectorPath/basicTypeCandidate/recoverWidgetText`、`src/model/import-rp.ts` 路径入口及 `src/model/vector.ts` 的严格数据格式后，**未发现本轮必要阻塞问题**。重点核对：闭合曲线先保存最终 C 再 Z、单端柄用对应锚点补齐、不把 NaN 裁成零、拒绝内部断段、拒绝未知/重复坐标字段、路径和命令数量限制、非 300 形状仅保留 stored snapshot 而非宣称参数重建、严格 RP11 空文本版本与属性白名单、导入边界纯数据解析与报告 provenance。

只读内存回放冻结 JSON 中所有 2,805 对象的原始 tuple 到新 `recoverVectorPath`：**2,800 接收，5 拒绝**，拒绝集合恰好等于上述 5 个 Flow 内部断段对象。该回放只验证路径结构转换边界，不能代替最终对象导入计数或原版渲染验证。

针对性既有测试 **82/82 通过**，未修改产品或测试文件：

```powershell
node --test research/scripts/read-rp-vectors.test.mjs research/scripts/read-rp-shapes-forms.test.mjs
npx vitest run tests/vector.test.ts tests/import-rp-shapes-forms.test.ts tests/import-rp.test.ts
```

前者 16 项，后者 66 项；未在此重复全套 E2E 或 native smoke。边框、渐变、继承样式、参数化形状再生与 GUI 逐像素等差异继续由导入报告及独立证据边界说明。
