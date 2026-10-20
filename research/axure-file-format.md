# Axure RP 11 文件容器与 HTML 运行时调查

调查日期：2026-10-13（Asia/Shanghai）。文件分析方法为针对公开样例及官方分发包的静态、只读检查，不依赖目标程序执行。后续经授权启动原版进行有限菜单观察，记录另见 [启动核对](axure-runtime-check.json)。没有解密、绕过授权或修改原始样例；没有声称完成完整格式兼容。

## 结论及可用范围

**观察：RP 11 的 `.rp` 与 `.rplib` 样例采用同一种分段二进制容器，不是 ZIP，也不是单个 JSON/XML 文档。** 文件头之后是 LZ4 压缩的 JSON 索引，索引指定各个包/缩略图/设置数据的偏移。被索引的各段混合使用 gzip 和原始存储。对象包解压后仍是 Axure 自有二进制对象序列。

已实现三层独立研究读取器：`read-rp-container.mjs` 验证分段；`read-rp-objects.mjs` 将已观察到的二进制对象结构转换为惰性数据；`read-rp-semantics.mjs` 恢复页面名、图元引用、显式存储的坐标/尺寸、部分文字、经控制点核对的矩形/圆角、有限缓存样式链及面板状态包引用。**这不是任意 RP 导入器，也不能写回 RP，不能据此称为 Axure 兼容编辑器。** 当前无 `.rpteam` 样例和验证。

HTML 侧的官方分发资源证明其原型运行时由页面/文档模型加载、事件分发、条件表达式求值、动作执行、状态/样式更新等模块组成。工程上可独立实现这种功能架构；本调查未复制这些脚本作为新产品实现。

## 来源与样例身份

官方来源：

- [Tab menu tutorial](https://docs.axure.com/axure-rp/tutorials/tab-menu/) → [官方 RP 样例](https://docs.axure.com/samples/the-basics-tab-menu.rp)。教程描述两种动态面板状态及标签选择组。
- [Required fields tutorial](https://docs.axure.com/axure-rp/tutorials/required-fields/) → [官方 RP 样例](https://docs.axure.com/samples/complex-interactions-required-fields.rp)。教程描述表单字段校验与条件分支。
- [Installing on Windows](https://docs.axure.com/axure-rp/reference/installing-on-windows/) → [官方免安装分发包](https://axure.cachefly.net/AxureRP-Setup.zip)。包保存在 `research/vendor/AxureRP-Setup.zip`；父任务通过 REA 提取后，本调查只读检查其中 `Axure RP 11/DefaultSettings`。
- [Widget libraries](https://docs.axure.com/axure-rp/reference/widget-libraries/)：说明 `.rplib` 为独立库文件，自定义库以类似页面编辑的方式创建。
- [Viewing and sharing prototypes](https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/)：说明 HTML/CSS/JavaScript/图片导出、预览和本地分发。
- [Customizing HTML output](https://docs.axure.com/axure-rp/reference/customizing-html-output/)：说明页面选择、注释、条件用例展示和字体配置。

以下为下载/复制后计算的 SHA-256，完整样例在 `research/samples/`。文件内版本标识是样例保存版本，不能拿来替代分发程序的产品版本。

| 样例 | 字节数 | 文件内版本段 | SHA-256 |
|---|---:|---|---|
| `the-basics-tab-menu.rp` | 56,137 | `11.0.0.4127.version` | `0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4` |
| `complex-interactions-required-fields.rp` | 58,612 | `11.0.0.4122.version` | `0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c` |
| 官方分发包内 `Default.rplib` | 2,274,216 | `11.0.0.4112.version` | `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50` |

免安装 ZIP 的 SHA-256（来自父任务提取输入）：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。

额外只读验证了分发包的全部 5 个内置库及 4 个训练 RP 文件，9/9 容器均成功解析；逐文件大小、散列、分段数及版本见 `research/samples/shipped-containers-summary.json`。其中最大的 `Icons.rplib` 为 7,200,289 字节，2,767 段，解码总量 22,412,432 字节。此结果扩大了容器层覆盖，不表示已验证全部对象语义。

## 直接观察到的容器结构

| 文件区域 | 本次样例中的结构 | 证据限制 |
|---|---|---|
| 偏移 0..1 | `AC EF` | 仅确定这些文件共同使用的标记 |
| 偏移 2..3 | `0B 00`，LE 整数 11 | 与 RP11 版本段吻合；其他版本未验证 |
| 偏移 4..7 | LE uint32 索引区字节长度 | 在全部 11 个独立样例中匹配其数据区起点 |
| 索引区 | 首字节 `01`，两个 7-bit varint，随后 LZ4 raw block | 两个 varint 分别与解码/编码字节长度一致；未知编码标记会被读取器拒绝 |
| LZ4 解码结果 | UTF-8 JSON，含 `root`、`children`、`parts` | `children` 是对象路径树；`parts` 将段名映射为相对数据区偏移 |
| 每个分段头 | 4 字节零值，4 字节 LE 载荷长度 | 首字段的正式语义未知；读取器拒绝非零值 |
| 分段载荷 | gzip，或原始字节 | 以 gzip 魔数识别并验证解压，其余保持不透明字节 |

Tab menu 样例的索引长度为 456 字节，解码 JSON 为 575 字节，数据区从文件偏移 464 开始。第一个 `package` 的相对偏移为 0，载荷长度 743 字节；8 字节段头与载荷合计 751，恰好等于第二段偏移。

三个样例的容器验证摘要：

| 样例 | 段数 | gzip 段 | 原始段 | 解码总字节 |
|---|---:|---:|---:|---:|
| Tab menu | 11 | 10 | 1 | 141,990 |
| Required fields | 11 | 9 | 2 | 143,356 |
| Default library | 128 | 48 | 80 | 2,992,057 |

原始存储内容至少包括 JPEG 缩略图和库的 `widgetinfo` 二进制数据，**不能假设所有段都使用 gzip**。读取器不会把“非 gzip”当作已理解的对象格式。

### 对象流：静态 CIL 与多样本交叉证据

父任务的 REA managed 元数据分析遇到 64 MiB 表示预算限制（证据 `ev_f0036570d4705d93beb771a90d7eea9390e7ff5b75631e8e3ec92bd8d4aa0788`）；没有安装原生分析引擎，也没有重复扩大 REA 预算。随后使用 PowerShell 自带的 `System.Reflection.Metadata` / `PEReader`，只读文件内 ECMA-335 元数据和方法体。**没有 `Assembly.Load`，没有运行目标 DLL。** 可复用脚本为 `research/scripts/inspect-rp-serialization.ps1`。

被检查的 `AxureRP11.dll` 为 16,314,368 字节，SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。证据保存在 `serialization-cil.json`、`serialization-object-loop-cil.json`、`metadata-PName.json` 和 `metadata-DOAName.json`。混淆方法中可见跳过的无效元数据调用与控制流噪声；这里只解释已追踪的读取路径，不把整份反汇编当成复原源码。

| 读取行为 | 静态方法证据 |
|---|---|
| 字符串数量、预置索引 0 为 null、长度前缀 UTF-8 | `G1GC.R1GX`, MethodDef `0x0600cccd`, RVA 9719292 |
| GUID 数量、预置索引 0 为 Guid.Empty、每项 16 字节 | `G1GC.j1Gm`, `0x0600ccce`, RVA 9719620 |
| schema 50001 的池索引读取 | `N1Gp` / `j1Gq`, `0x0600ccd0` / `0x0600ccd1` |
| 对象 ID、类型名、属性字典 | `H1Gd`, `0x0600ccd2`, RVA 9720388 |
| 值标记分发与低 5 位掩码 | `N1GZ`, `0x0600ccd5`, RVA 9721464 |
| 标量 int32/float32/float64/GUID/bool/int64 | `n1Gl`, `0x0600ccdf`, RVA 9722640 |
| 对象记录循环与结束标记 | `<LoadObjects>d__36.MoveNext`，见单独证据 JSON |

对象流在本次所有匹配标头的样本段中使用以下顺序（整数均 LE int32）：

1. 标记 `27`，四段版本号，schema `50001`。
2. 标记 `31`，字符串数，再逐项读取“字节长度 + UTF-8”。池索引从 1 开始。
3. 标记 `30`，GUID 数，再逐项读取 .NET 字节顺序的 16 字节 GUID。池索引从 1 开始。
4. 对象包：标记 `26`、`15`、根对象 GUID 索引、`18`、包 GUID 索引；随后重复 `9`、对象 GUID 索引、类型字符串索引、属性字典；最后 `28`。
5. 库 `widgetinfo`：池后是一个独立结构值，最后同样为 `28`。不能套用对象包头。

读取器要求完整消费至段末，拒绝未知 schema/版本、越界池索引、非法 UTF-8、未知值标记、截断与尾随字节。普通字典用 `$map` 键值对列表保留，避免原型污染以及重复/非字符串键的信息丢失；64 位整数保留十进制字符串，非有限浮点单独标记。二进制值保留偏移、长度及散列，不执行或加载它。

**直接观察：** 共 11 个独立官方样本的 2,339 个以标记 27 开始的对象结构段全部完整读取，得到 41,662 个对象记录；没有未知标记、未消费尾部或解析失败。JPEG/图片、XML 版本段等仍单独由容器层处理。这些计数是结构解码覆盖，不是功能兼容率。详细结果和每个源文件散列在 `research/samples/objects-summary.json`。

本次出现的内部版本为 `9.0.0.0`、`9.0.1.0`、`10.0.1.0`、`10.0.3.0`、`10.0.4.0`、`11.0.0.0`，均位于外层 RP11 容器中；因此不能仅凭外层版本假定所有子包使用相同保存版本。读取器仅放行以上已观察组合和 schema。标签 `1/2/3/4/5/6/8/16/17/19/20/22/25/29` 在真实样本中出现，次数见 `object-value-tags-summary.json`；`7/21/23/24` 的读法来自静态分发路径，真实样本覆盖尚缺。

### 有证据支持的部分语义恢复

**枚举证据：** `Axure.Constants.PName.LOCATION = 101`、`SIZE = 105`；`Axure.Constants.DOAName.NAME = 0x0fffffff`、`DETERMINED = 0x80000000`、`OVERRIDDEN = 0x40000000`。因此 `MyStyle → Axure:Style.PropList → DOAName & NAME` 能可靠区分存储的位置和尺寸，而不是根据浮点外形猜测二进制字段。位置内容带明确 `X`/`Y` 键，尺寸带 `Width`/`Height` 键。研究输出同时保留标志位，不尝试推导样式层叠。

页面包的根对象 `Axure:Page` 通过 `diagram` 引用 `Axure:Diagram`；该对象的 `diagram-objects` 数组给出直接成员引用。`DesignDocument` 中 `Axure:PackageInfo` 的 `package-id` 与 `package-name` 建立包名称映射。面板的 `panel-diagrams` 保存有序的 `Axure:PanelState` 包引用，状态包根对象通过 `diagram` 引用 `Axure:PanelDiagram`，后者的 `Name` 保存状态名称。

文本仅恢复两种已观察形式：`TextBlock.text`；或者 `RichTextBlock.attributed-string.Paragraphs[].Inlines[]` 中类型为 `Axure:AttributedString:AxRun` 的 `Text`。段落以换行拼接，格式不做恢复。未知内联类型会输出失败状态，不猜测其文字或链接。

| 样例字段 | 实际读取值 | 证据边界 |
|---|---|---|
| Tab menu / Page 1 / Tab 1 | `(50,50)`，`140×40`，文字 `Tab 1` | 显式 MyStyle 值 |
| Tab menu / Page 1 / Tab 2 | `(190,50)`，`140×40`，文字 `Tab 2` | 显式 MyStyle 值 |
| Tab menu / 动态面板 | `(50,90)`，存储 `10×10`，`fit-to-content=true` | **不能称为实际显示尺寸** |
| Tab menu / State1、State2 内容 | 存储 `300×170`，文字 `Tab 1 Content` / `Tab 2 Content` | 没有本地 LOCATION 值，输出 null；没有擅自填 `(0,0)` |
| Required fields / Email Field | `(50,75)`，`300×25`，文本为空字符串 | 空文本不同于未知文本 |
| Required fields / Page 2 | 文字 `Thank you for signing up!` | 页面名及文字均从对象引用恢复 |

详见两个 `*.rp.semantics.json` 以及 `Default.rplib.semantics.json`，其中包含源段 SHA-256、对象 ID、解码后对象偏移及缺失字段状态，可返回原始对象报告核查。

| 官方文件 | 对象段 / 对象记录 | Page 类型根 / PanelState 根 | 直接图元成员 / 同时有显式位置尺寸 / 可恢复文本 |
|---|---:|---:|---:|
| Default.rplib | 87 / 870 | 40 / 1 | 40 / 40 / 14 |
| Flow.rplib | 80 / 622 | 37 / 0 | 37 / 37 / 0 |
| Icons.rplib | 1,846 / 12,038 | 920 / 0 | 920 / 0 / 0 |
| Sample form patterns.rplib | 160 / 21,695 | 48 / 58 | 1,359 / 1,138 / 862 |
| Sample UI patterns.rplib | 64 / 3,353 | 15 / 28 | 411 / 294 / 194 |
| Prototype Starter.rp | 37 / 1,008 | 8 / 23 | 137 / 117 / 58 |
| Prototyping Basics.rp | 12 / 706 | 1 / 5 | 251 / 240 / 165 |
| Quick Win.rp | 11 / 279 | 2 / 3 | 48 / 47 / 32 |
| UX Prototyping.rp | 25 / 831 | 10 / 9 | 201 / 193 / 121 |
| Tab menu | 9 / 123 | 1 / 2 | 5 / 3 / 4 |
| Required fields | 8 / 137 | 2 / 0 | 7 / 7 / 7 |

**观察到的失败边界：** 直接成员中有 1,300 个没有同时保存可恢复的位置和尺寸，包含 Icons 库的全部 920 个直接成员；这不是 0 尺寸证明。`Sample UI patterns.rplib` 中对象 `14ea8a9456d14c888e8e483e64492173` 和 `Prototyping Basics.rp` 中对象 `4f4e187b657a4108aa50438dd7d0fca8` 使用 `AxHyperlink` 富文本内联，当前明确报告 `unsupported-rich-text-inline`。上述表格的 Page 类型根包含库元件页面，不能解释成用户设计页面数。

**推断：** 可以制作有明确丢失信息报告的只读转换器，先恢复简单页面/显式矩形/纯文本，再分批补全样式和布局。现有证据不足以直接把解析成功的对象图宣称为可编辑 Axure 场景。

**未知且未实现：** 完整样式继承与默认值求解、自适应视图、旋转与变换、自动尺寸和字体度量、组/组件/母版的坐标与覆盖规则、站点树的页面层级和顺序、实例化中继器、完整图片资源映射、富文本链接、交互和表达式执行、版本迁移、未知对象写回保真。下文的扩展仅处理唯一匹配的缓存链、局部存储矩形和部分外观。源对象图保留更多数据，并不等于已理解其含义。用户已授权启动官方 UI，进程及 Untitled 窗口出现；但 Computer Use 激活失败，重新选择后截图发生 FrameArrived timeout。因此尚未完成原版界面/行为差分，也没有 Axure GUI 导入/导出验收。

### 第二阶段：圆角、外观和固定尺寸面板

以下是同日后续实现，替代先前仅 0/1 个元件的实验转换结果；底层结构读取计数不变。

**新增直接证据：**

- `Axure.Axvg.RPToAxvg.RPFormatExtensions.bJcT`（MethodDef `0x060072b8`）的 IL 62–77 为 `get_Size → ldc.r8 0.75 → div → Axure.Axvg.Graphics.Run.set_Size`。因此本次恢复将存储字号除以 `0.75`；保存值 `9.75/10.5/13.5/24` 分别得到 `13/14/18/32`。见 `font-scale-cil.json`。这不是依据 UI 常用字号猜测。
- 颜色构造 `B5kg.m5k3.B5ke`（MethodDef `0x0600da25`）调用 `BitConverter.GetBytes` 并将字节索引 `3/2/1/0` 写入 A/R/G/B 字段；`RPFormatExtensions.FJc2` 将各字段除以 255 写入 Axvg Color。见 `argb-construction-cil.json`、`argb-channel-cil.json`、`color-alignment-cil.json`。输出保留透明度，例如存储 `16777215` 转为 `#ffffff00`，不是白色不透明。
- `AxStringAlignment` 元数据为 Near=0、Center=1、Far=2、Justify=3；这里只映射前三项至 left/center/right。PName 同时直接确认 `FILL=7`、`BORDER_FILL=8`、`BORDER_WIDTH=15`、`FONT_NAME=1`、`FONT_SIZE=2`、`FONT_WEIGHT=1001`、`OPACITY=70`、`VISIBLE=110`。未知值不索引或猜测。
- 两个教程文件的 Shape=0 分别保存四角普通矩形、仅顶部圆角的标签，以及四角圆角的按钮。读取器验证完整控制点序列、边界、相等的横纵角半径，以及已观察的三次曲线控制柄（距离角点 `0.44×radius`），再恢复 `[TL,TR,BR,BL]`。任意改动控制柄、额外路径段、缺少边界点都会取消类型候选。没有仅凭 Shape=0 把任意编辑路径当成矩形。

**有条件的缓存链恢复（受限推断，非完整样式引擎）：** 从 DesignDocument 的 StyleSheet → DefaultStyle → Id 找到默认样式身份；页面 StyleCache 中必须存在唯一匹配的默认项和 MyStyle.MatchInfo 的 Id+LibraryId 项，而且 MyStyle 的 BASE_STYLE 必须与匹配项一致，才按“保存的默认缓存 → 匹配基础缓存 → 本地属性”组合。已选中/禁用/错误状态仅在恰好一个状态有效、且能解析对应本地 IX_STYLES 引用时读取该状态覆盖。多个状态同时有效不猜优先级。每个应用字段都记录来源 `provenance`；缺失、重复或错配的缓存链不会自动补色。

统一富文本运行中的字体名、字号、字重、颜色、段落对齐可作为直接格式证据；本地对象/状态覆盖优先。混合字号或颜色不能用单一 WidgetStyle 表达，删除该恢复字段并记入 `unknown`。渐变、阴影、边距、部分边框、富文本链接和其他未转换属性的原值及来源仍保存在报告，而非静默丢失。普通属性、边框可见性、对象可见性和交互样式引用都必须设置 `DETERMINED` 位才应用；变异测试确认未确定的值不会变成隐藏/去边框/选择样式指令。

在 Required fields 中，错误文字的富文本仍保存灰色，但对象显式前景色覆盖为 `#d9001b`；`VISIBLE=false` 也覆盖通用 `VisibleFromSettings=true`。本次测试分别检查最终红色和隐藏标记。Tab menu 的 Tab 1 保存 Selected=true，单独的 Selected 样式给出填充 `#81d3f8`；Tab 2 保持默认白色。动态切换选择样式的交互仍未恢复。

**存储几何与计算几何的边界：** AutoFitWidth/AutoFitHeight=true 的简单文字矩形现在可作为静态快照导入，但仍必须有明确存储的 LOCATION/SIZE，且逐对象报告 `stored-autofit-snapshot`。这不重算字体度量，也不承诺后续编辑自动适应。`fit-to-content=true` 的动态面板继续跳过；Tab menu 的 `10×10` 没有被当成实际 `300×170`。

固定尺寸 DynamicPanel 仅在 `fit-to-content=false`、位置和尺寸明确、有可解析的有序 PanelState 包引用时恢复。子元件保留状态内的存储坐标。缺失成员逐项报告，循环/重复状态引用被拒绝，递归深度和总成员预算仍受限。模型初始展示保存顺序中的首状态，并明确说明未执行页面加载动作或恢复状态切换交互。没有将状态包误当独立页面。

| 官方文件 | 导入页数 | 顶层元件 / 跳过 | 状态内元件 / 跳过 | 面板状态数 | 冻结 AutoFit 元件 |
|---|---:|---:|---:|---:|---:|
| Tab menu | 1 | 2 / 1 | 0 / 0 | 0 | 0 |
| Required fields | 2 | 6 / 1 | 0 / 0 | 0 | 4 |
| Default.rplib | 40 | 10 / 30 | 0 / 0 | 1 | 6 |
| Flow.rplib | 37 | 0 / 37 | 0 / 0 | 0 | 0 |
| Sample form patterns.rplib | 48 | 336 / 395 | 338 / 132 | 28 | 305 |
| Sample UI patterns.rplib | 15 | 107 / 152 | 10 / 0 | 2 | 82 |
| Prototype Starter.rp | 8 | 31 / 57 | 9 / 19 | 11 | 28 |
| Prototyping Basics.rp | 1 | 113 / 86 | 8 / 44 | 5 | 101 |
| Quick Win.rp | 2 | 25 / 17 | 2 / 0 | 1 | 17 |
| UX Prototyping.rp | 10 | 98 / 55 | 0 / 0 | 0 | 83 |
| Icons.rplib | — | — | — | — | — |

Icons 的 920 个 Page 类型根超过应用 200 页上限，因此整体明确拒绝，不能说“导入成功”。其他结果均执行了实际对象解析 → 语义恢复 → 纯转换 → 应用 `serializeDocument/parseDocument` 验证。详见 `research/samples/import-summary.json`，包含固定源 SHA-256、候选数、成功缓存链数、圆角数、失败原因和上述计数。这是结构/模型验证，不是原程序视觉验收。

### 第三阶段：明确内嵌 PNG 图片

已验证 ImageBox → MyStyle → IMAGE(27) → Stream 的同对象包字节范围映射。在保存矩形明确、受限静态 PNG 结构校验通过、源/目标比例一致且图像布局不含裁剪等未知项时恢复。Quick Win 和 UX Prototyping 各增加 2 张图片，上表已更新；其余样例计数不变。详细观察、来源哈希、API、字节/像素/IPC 预算及失败边界见 [图片恢复报告](axure-image-recovery.md)。其他格式、EXIF、VectorImage、非等比例、自动尺寸、图像圆角/滤镜等仍跳过。最终 Windows 包已通过两份样例的真实导入、原字节保存回读、编辑器/预览/离线 HTML 解码检查；原版视觉差分仍未完成。

## HTML 导出运行时：静态证据

证据来自已提取分发包的 `Axure RP 11/DefaultSettings/Prototype_Files/`，均未执行。原包哈希已在上方记录，以下路径指 ZIP 中同名成员。

| 子系统 | 实际观察 | 本地成员与行号 |
|---|---|---|
| 原型播放器 | 外框中有 `mainFrame` iframe，加载 jQuery、消息中心和 player 初始化模块 | `start.html:129,148-153` |
| 模型加载 | 分别接收 `pageData` 与 `document`，再初始化页面和文档数据 | `resources/scripts/axure/doc.js:752-759` |
| 事件/用例 | 遍历事件的 cases，跳过 disabled case，对条件求值，分发所选 case 的 actions | `resources/scripts/axure/events.js:443-467,543-560` |
| 表达式 | 以 `exprType` 选择 handler 执行表达式，而非仅依靠静态页面链接 | `resources/scripts/axure/expr.js:760-763` |
| 动作执行 | 根据动作名选择 handler，并维护移动、状态、显隐、尺寸、旋转等动画队列 | `resources/scripts/axure/action.js:5-12,24-37,356` |
| 全局变量 | 名称转小写后保存值，向消息中心发布变更，值变化时触发变量变化事件 | `resources/scripts/axure/variables.js:8-29` |

用于再次定位的关键成员 SHA-256：

- `doc.js`: `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1`
- `events.js`: `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3`
- `expr.js`: `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6`
- `action.js`: `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3`
- `variables.js`: `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188`
- `start.html`: `5824e1ff6a79007a5dabd62cb567cf70718e3e9b0a41fd283745b60b59a05bb4`

**推断：** HTML 生成器将编辑器文档转成浏览器可加载的数据模型、DOM/CSS/图片及一套通用解释执行运行时。复现时应分开编辑器场景模型与预览运行状态，再通过确定的事件→条件→动作流程更新状态；仅绘制相似工具栏不足以复现工作方式。

**未知：** 当前未从 Axure GUI 实际导出同一测试文档，未完成截图/点击/跨页变量/动画时序的差分验证。官方 Tab menu 在线 iframe 当前请求进入授权重定向，未尝试绕过；本报告不把静态源码检查称为浏览器运行验证。

## 可复现验证与下一步边界

运行：

```powershell
node research/scripts/read-rp-container.mjs research/samples/the-basics-tab-menu.rp
node research/scripts/read-rp-objects.mjs research/samples/the-basics-tab-menu.rp
node research/scripts/read-rp-semantics.mjs research/samples/the-basics-tab-menu.rp
node --test research/scripts/read-rp-container.test.mjs research/scripts/read-rp-objects.test.mjs research/scripts/read-rp-appearance.test.mjs research/scripts/read-rp-images.test.mjs research/scripts/synthetic-rp-fixture.test.mjs
node research/scripts/audit-rp-samples.mjs '<已提取的 Axure RP 11 目录>'
node research/scripts/audit-rp-imports.mjs '<已提取的 Axure RP 11 目录>'
npx vitest run tests/import-rp.test.ts
```

当前结果：13/13 容器、14/14 对象/语义、8/8 外观、8/8 图片、1/1 合成 RP 测试通过，共 44 项；纯类型转换另有 22/22 Vitest 测试通过。最终 npm run typecheck 通过（并行 runtime 的临时参数错误已由负责该文件的主任务修正）。测试包含独立合成流、LZ4 重叠复制、每个截断位置、越界池引用、未知 schema/版本/标签、gzip 校验、非法 UTF-8、重复属性、字典原型污染、64 位精度、嵌套/解码预算、固定源哈希、元数据常量、控制点校验、错配缓存拒绝、混合富文本、透明度、面板及受限图片恢复。实际运行自写 CLI 读取官方 RP/库并验证应用文档保存回读，没有加载原厂 DLL。

原生冒烟脚本 `scripts/smoke-rp-import.mjs` 验证 Required fields 6/1、Tab menu 2/1，以及保存后的坐标、颜色、字号和圆角。补充 `DETERMINED` 三处 guard 后，最终 EXE 已重新打包，桌面与 RP 导入两项 native smoke 均通过。状态栏按文件 API 的返回值显示文件名，测试另读取完整目标路径的真实文件验证内容。发布压缩包内 app.asar 与该已测试目录散列相同，三个解析器与源文件逐字节一致，见 [发布校验](../release/verification.json)。现有 6 个官方 `.rp` 均有可恢复元件；零恢复保留当前工程的测试使用 `scripts/synthetic-rp-fixture.mjs` 自写生成的 `SYNTHETIC-empty-page.rp`，经过真实文件读取、worker 和三个解析器，而非替换 IPC 结果。该合成容器只检验应用处理链路，不构成原厂可打开/写回兼容性证明，也不混称官方样例。

读取器仅使用 Node 内置模块；默认上限为文件 128 MiB、索引 8 MiB、单段解码 32 MiB、总解码 256 MiB、10,000 段及树深 64。对象读取另限制每段 200,000 个值节点、100,000 字符串、64 层递归。没有路径解压、脚本执行、原厂对象实例化或网络请求。

### 供实验导入使用的接口与明确丢失信息

```javascript
import { inspectRpSemantics } from './research/scripts/read-rp-semantics.mjs';
const recovery = inspectRpSemantics(absoluteRpPath);
// {status:'partial-read-only-recovery', recoveryVersion:1, fileSha256,
//  packageFailures, semanticFailures, diagrams:[{packageId, rootId, rootType,
//  diagramId, name, widgets:[{id,type,typeCandidate,label,storedGeometry,text,
//  styleRecovery:{style,provenance,unknown,cacheChainComplete,visible},
//  imageRecovery?:{status,mime?,width?,height?,source?,dataUrl?,reason?},
//  storedFlags,panelStatePackages}]}]}
```

运行依赖只有本项目自写的三个模块 `read-rp-semantics.mjs` → `read-rp-objects.mjs` → `read-rp-container.mjs` 和 Node 内置 `fs`、`crypto`、`zlib`、`url`。元数据读取脚本、证据 JSON、官方样例、DLL 和原厂脚本均不属于运行依赖，也不得随产品打包。

`src/model/import-rp.ts` 提供纯函数 `importRpSemantics(input: unknown, name?: string): {document, report}`。报告固定包含 `sourceSha256`、`pagesImported`、`widgetsImported`、`widgetsSkipped`、`panelStatesImported`、`nestedWidgetsImported`、`nestedWidgetsSkipped` 和 `issues[]`；每项 issue 为 `{code,message,severity:'warning'|'skipped',packageId?,sourceId?,details?:unknown}`。顶层元件统计仅指 Page 根下的直接成员，面板状态内的元件另计。样式的原始未知值和 provenance 保存在 `partial-style-recovery` issue 的 `details`。ID 按源包/对象 ID 稳定组合，不生成随机关联。

类型候选是更窄的一层：`box` 仅限 Shape=0 且完整路径符合上文已验证的矩形或圆角矩形模板；原 DLL 中 `RPShapeType.Rectangle` 和 `Platform.Shape.Rectangle` 的枚举值均为 0，证据另存 `metadata-RPShapeType.json` / `metadata-Shape.json`。`input` 仅限明确的普通 TextBox（Type=0、非换行、非只读）；密码类型不降格成普通输入框。`panel` 候选也必须通过固定尺寸、状态引用等后续校验。候选之外仍保留原始 type/id，但不强行导入。

转换器进一步要求本地明确、已覆盖的位置和尺寸；拒绝 fit-to-content 计算尺寸、容器关系未知、自适应覆盖、显式旋转/变换、非有限/过大/非正尺寸、未知富文本和状态。AutoFit 只保留已存矩形并逐对象警告。默认外观与页面尺寸始终列入报告。Tab menu 导入 1 个页面、2 个圆角标签、跳过 1 个动态面板；Required fields 导入 2 个页面、6 个基础文字/矩形/输入框、跳过 1 个密码框。语义读取能恢复更多存储数据，转换器有意只使用已收窄的子集。不得以“解析无错误”替代这些丢失信息。

下一步需要用已获授权的 Axure 实例制作最小控制样本，每次只改变一个字段（坐标、文字、面板状态、条件、变量等），比较对象包；据此扩展现有带版本检查、保留未知字段的语义解码器。任何 RP 写回都必须经过“原文件→读取→写出→Axure 打开→保存→再次读取”的完整验收。渲染一致性还需要相同字体、相同缩放和固定浏览器环境下的截图与交互差分。

当前兼容性声明应限定为：**已验证指定官方样本的 RP11 容器和对象结构读取，能够实验性恢复少量明确的页面/基础对象/存储矩形/纯文本；完整对象语义、原生文件写回和渲染/交互等价仍未完成。**
