# RP 11 原生混合富文本：结构、转换及导入证据

本阶段恢复了此前只保留纯文本的全部 **49 个混合字体对象**，共 **241 段、1093 个 AxRun**，其中 116 个 run 为 Italic。第 50 个对象含 `AxHyperlink`，仍明确拒绝其富文本恢复。全 11 样本当前有 632 个成功导入的结构化富文本元件；包括 619 个 VectorShape、13 个 RadioButton。没有丢失此前已导入的元件。

证据来自原样本字节、自写容器/对象读取器、原 DLL 的静态 ECMA-335 metadata/CIL，以及当前自写 parser/importer 的精确数据回归。未执行原 DLL、未启动原厂应用、未进行原 GUI 差分。原生控件字体回退、字形度量和像素级自动布局仍未证明。`lineHeightPx:'normal'` 是浏览器自动行高映射，不是原厂字体度量完全相等的声明。

## 1. 来源与可复现清单

原 DLL `AxureRP11.dll` SHA-256：`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。所有新证据文件、生产解析器和测试的完整 SHA-256 清单在 [rich-text-format-evidence.json](rich-text-format-evidence.json) 的 `sources` 中；每个样本的路径、原字节 SHA 和当前导入结果在 [rich-text-format-import-audit.json](rich-text-format-import-audit.json)。完整 50 个源对象的 ID、包 ID、原字段值和缓存链快照在 [rich-text-format-census.json](rich-text-format-census.json)。这些是研究证据，不随产品复制原厂 DLL、脚本或样本素材。

包含 49 个可恢复 mixed owners 的样本：

| 样本 | SHA-256 | mixed 数量 |
|---|---|---:|
| Sample form patterns.rplib | `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179` | 31 |
| Sample UI patterns.rplib | `cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b` | 7 |
| Prototype Starter.rp | `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714` | 1 |
| Prototyping Basics.rp | `26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7` | 10 |

旧的 `font-style-format-*` 和 `font-style-import-audit.json` 保留原样，作为此前平铺文本的基线。新报告不将旧阶段的 0 italic 误写成当前结果。

## 2. 精确载体及真实值域

`RichTextBlock` 是三项 map：`*type='rich-text-block'`、`attributed-string`、`property-dictionary`。后者含 `type='rich-text-object'`、`diagram-object-label`、`text-object-id`、`parent-diagram-id`。复制自库的元件可保留旧 metadata ID，因此这些 ID 仅作为惰性来源记录，不能当作引用去解析另一个元件。

`attributed-string` 仅含 `Version` 与 `Paragraphs`；本阶段要求明确的 `11.0.0.0`。Paragraph 明确存 `Wrapping, Trimming, HorizontalAlignment, LineSpacing, ListInfo, Inlines`。每个 AxRun 明确存 `Type, Text, Family, Size, Weight, Style, Stretch, Underline, Color, Baseline, CharacterSpacing, Strikethrough`。未知项、重复项、缺项与错误类型均不能静默忽略。

49 个对象的全部真实字段计数：

| 字段 | 观察值及出现次数 | 本阶段转换 |
|---|---|---|
| Family | Arial 1026；Poppins 4；Montserrat 63 | 字面安全字体名，不宣称每台机器都有字体 |
| Size | 9.75 ×1026；13.5 ×43；16.5 ×24 | 除以 0.75 → 13、18、22 CSS px |
| Weight | 400 ×739；700 ×354 | 保留数值 |
| Style | Normal 0 ×977；Italic 1 ×116 | normal / italic；Oblique、None 不混同 |
| Stretch | 5 ×1093 | 仅 Normal/Medium 5；其他宽度不扁平化 |
| Underline / Strikethrough | 全部 false | 本阶段不支持非默认装饰 |
| Baseline / CharacterSpacing | 全部 0 | 非默认上/下标和字距拒绝 |
| Color | -1367932 ×1026；-11842741 ×56；-14574314 ×6；-13684945 ×5 | 原 ARGB 数值转换，含透明度 |
| Wrapping / Trimming / Alignment | 全部 0 | 已证 Wrap / None / Near；另允许已证 Center1、Far2 |
| ListInfo | 全部 IndentLevel0 / ListType0 | 无缩进列表；非默认列表拒绝 |
| LineSpacing | 0 ×180；12 ×41；21 ×15；27 ×5 | normal；16、28、36 CSS px |

完整 50 owners 则为 252 段、1138 个直接 inline：1137 AxRun 加 1 AxHyperlink。该 hyperlink 内另有 run（包含 Underline=true），没有当作第 49 个支持范围里的普通 run。其 owner ID 是 `14ea8a9456d14c888e8e483e64492173`。

## 3. 段落换行的修正，不丢空段

49 owners 的 192 个非末段，全部在最后一个 run 尾部保存 **恰好一个 LF**；所有 49 个末段均无 LF。没有内部 LF、CR、TAB、重复终止 LF。89 个空段由 `Text='\n'` 表达；另外 2 个段尾空 run 也保留。最大单对象是 14 段、每段最多 19 runs、1091 个字符。

因此采用窄转换：先删除每个非末段最后 run 的一个 LF，再将各段以单个 LF 连接成 `Widget.text`。这与原 run 内容按源顺序直接拼接一致。此前 `recoverPlainText` 在已带 LF 的段间又补 LF，49 个对象共多出 192 个 LF；新 `Widget.text` 纠正这些重复。原 `text` 读取协议保持旧值，importer 要求它与结构化段落的双 LF 投影严格一致，再接受新投影，防止 worker 同时传递彼此矛盾的文字。

全 632 个导入 rich 元件中，共 **88 个多段对象纠正341个重复LF**；其中42个 mixed 对象纠正192个，另46个 uniform 对象纠正149个，其余7个 mixed 对象只有一段而无需修改纯文本。按样本：Form32对象/158LF、UI10/37、Starter16/61、Basics15/24、Quick3/12、UX12/49。`rich-text-format-import-audit.json` 的 `textCorrections` 保留每个 ID 及旧/新完整文字；这是预期数据修正，不是丢字。其他样本没有此文字差异。

空段、空 run 不删除；段末真实多个 LF、run 内换行、CR、TAB 和无终止 LF 的非末段暂不推断。结构化 native 文字一律 `expressionMode:'literal'`。例如 form 包 `c598ff6cf4ba459cbef032f0cd4048f7` 的 `f5c250636b6340ac82b96a677bec69a2` 在教学文字里包含 `[[...]]`，不是可执行表达式载体。

## 4. 原始 CIL 依据和优先级

所有偏移均为保存的原始 CIL 指令偏移，可用 `research/scripts/show-rp-cil.mjs` 定位，不依赖反编译猜测。

| 文件 / 方法 | token 与 IL | 证明范围 |
|---|---|---|
| `font-style-format-conversion-cil.json`，RPFormatExtensions.bJcT | 100692664；0xE、0x13、0x15、0x1A | 原绘制转换对 run 文本调用 TrimEnd(char10) |
| 同上 | 0x3E..0x4D；0x6F；0x85 | run Size /0.75、Platform font style 转换、weight 转换 |
| `samples/font-scale-cil.json`，XJc4 | 100692660；0x58..0x6B、0x72..0x81 | spacing0 走默认参数，正值 /0.75；不能把 0 当 0px |
| `rich-text-format-html-cil.json`，cNCQ.ONiF | 100699551；0x3EE | HTML writer 遍历段及 run，以该 run 调用 KNiN |
| `rich-text-format-html-inline-cil.json`，KNiN / BNiS | 100699555，0x41；100699556，0xC | run 自身传入样式构造及 PNKu.RNxS |
| `rich-text-format-html-style-cil.json`，RNxS | 100699318；0x12..0x14、0x49..0x4E | 读 run provider 的 Size 并写转换后的 CSS 值 |

字体 Style 采用既有已证 `Axure.Platform.AxFontStyle` 0/1，不能误套 graphics 中不同编号的枚举。额外的 wrapping/trimming/alignment/baseline/stretch 枚举来自 `rich-text-format-metadata.json`；Paragraph 类型的静态访问器保存在 `rich-text-format-paragraph-cil.json`。

**真实冲突不能让 Widget.style 覆盖 run。** Basics 包 `8165e87159f34c58a974459d9e910e34` 内 `9ae80b88ab624d3aa80eb671b09e5c7f`、`c4338edb658541abaea6b13bdefe6d83`、`343f5bc495e94af3aa5abf4d71685da7`，MyStyle 显式 Size13.5（18px），runs 全部 Size16.5（22px）。新的模型同时保留 base18 和 run22；HTML 链读取 run provider，所以显式 run 字号不能被 base18 抹平。

这 49 个对象的局部 FONT_WEIGHT、FONT_STYLE 汇总条目均 overridden=true 但 determined=false。它们表达混合状态，不能当成把全部 run 改回 400/normal 的命令。后续选中、悬停等活动样式则由独立状态投影处理，本报告不把 base 汇总和活动状态混为一类。

HTML 字符转义/换行 writer 的部分字面串仍通过混淆表读取（`rich-text-format-html-text-cil.json`、`rich-text-format-html-linebreak-cil.json`）。本阶段未解码这些字面量，也不以绘制层 TrimEnd 单独宣称所有 HTML 内部换行等价；采用上述逐对象观察到的严格 LF 边界。字体替换与颜色饱和度路径 `iSXv.GSXA` 存在，系统字体替换后的精确视觉效果未验证。

## 5. 协议、安全及能力边界

Reader `richTextRecovery` 的成功状态为 `supported-rich-text`，包含 `richText`、规范化 `text`、段/run/LF 数量和单位换算来源。Importer 独立验证完整键集合、允许字体字段、安全颜色、literal 模式、段落结构、文本一致性与来源计数，最后复用 `parseRichText`。不输出原厂 HTML，不 eval，不为文字插入链接。

本阶段资源界限：每对象最多 1000 段、10000 runs、100000 原文本字符；字号 native0.75..384，正行距 native0.075..750（输出0.1..1000px），weight100..1000。未知字形宽度、上/下标、装饰、字距、列表、特殊 wrap/trim、Hyperlink 等会报告 `unsupported-rich-text`。已有可读 plain fallback 保留并出 `rich-text-omitted` 报告，不能称为恢复了这些格式。成功 rich 载体限定已支持的 VectorShape、RadioButton、CheckBox，不把 input 值变成 rich HTML。

全样本导入的 rich 数量：Default9、Flow0、Form210、UI106、Starter26、Basics151、Quick28、UX96、TabMenu2、RequiredFields4。Icons 仍因页面数上限拒绝整份导入；这是既有边界，不算本阶段失败。最大 compact semantic 输出为 Form **25,445,010 bytes**，保持在已存在的 64MiB worker 输出上限内。

## 6. 同阶段独立的本地状态 OD 筛选增量

详见 [selected-style-filter-evidence.md](selected-style-filter-evidence.md)。新证据证明原生 IX_STYLES JSON generator 对 **原始本地 state 属性**应用 `Overridden && !Indeterminate`。实现先校验全部 property 结构及重复，再筛活动项；未知活动属性仍原子拒绝。默认/base 缓存及已按精确 identity 解析出的 named-color cache 不套用此筛选。已通过 cached Form Hint `#999999` 等回归。

相对于旧 `font-style-import-audit.json`，该修正（不是 rich text 本身）额外恢复 **2 个 nested radio +36 events/cases/actions**，全部在 Form。当前 Form 是558 top widgets +440 nested widgets、74 events；此前558+438、38 events。没有新增交互解码器或放松 target scope。

2 个 radio：包 `4399b2ea663a4d099fbde37f98e45acb` /对象 `2991ca3b277d4f56be5a8a6b375dc47c`；包 `09332e4125a048ce94f5f8453595c385` /对象 `ed4299cb3bc04c65bbbe576810a1d1f2`。两者 selected patch 均为 `stroke:#1e98d7`，原始分组 `pay with options`。

36 events 均为已有 decoder 支持的 `setSelected`，按包分布：

| 包 ID | click | focus | blur |
|---|---:|---:|---:|
| c356742c685a47b0b1a9b4abc4dd2ad8 | 10 | 5 | 3 |
| d769a1bb062d46ae9140ccafe936455e | 0 | 5 | 3 |
| e75bf1b9234d40d9bb3c2f8a4ece4689 | 10 | 0 | 0 |

原先讨论的 8 个 dropdown focus/blur 是这36项的子集。逐来源 ID、旧事件数组、新 interaction/action/target 和 target selectionRecovery 全部保存在 `rich-text-format-import-audit.json` 的 `eventChanges`。20 个 ellipse click 只应用已存 fill/stroke/color；其他16个 focus/blur 只应用已存 color。没有将未生效快照里的字体或 shadow 当成活动 patch。

独立代理另以原对象重读验证了全部30个事件 owner /36 events、2个新增radio和30个不同target style：70个OD活动属性全部为6/7/8纯色；1392个未生效属性没有激活。每个event/case/action与独立 `recoverInteractionMap` 结果逐字段相等，颜色由独立ARGB转换对照。见 [selected-style-filter-import-verification.json](selected-style-filter-import-verification.json) 与 `selected-style-filter-verify-import.mjs`。

## 7. 本代理实际验证

- `node --test research/scripts/read-rp-rich-text.test.mjs`：新增6/6，含全部49真实对象及第50 hyperlink拒绝。
- `npx vitest run tests/import-rp-rich-text.test.ts`：新增16/16，包含 literal、字体冲突、16/28/36px、空段、save/reopen、不合法协议原子拒绝。
- 联合 rich/selected/font/state/error-hint：45/45 Node；rich/font importer：31/31 Vitest。
- 主线程全套发现的旧诊断/计数预期已精确修正；`read-rp-appearance.test.mjs` 19/19、dropdown/input-types 两文件53/53定向通过。缺失PropList仍给出明确错误，未降低断言或放宽格式。
- `npx tsc --noEmit`：通过。
- `node research/rich-text-format-import-audit.mjs`：11份 SHA 样本、既有成员不丢失、全部可导入文档 save/reopen 等值、49 mixed 完整恢复。

全局测试、真实播放器、原生 EXE 打包验证由主线程负责，本报告不提前宣称它们通过。可复现报告：运行 `rich-text-format-census.mjs`、`rich-text-format-import-audit.mjs`，再运行 `rich-text-format-evidence.mjs`。
