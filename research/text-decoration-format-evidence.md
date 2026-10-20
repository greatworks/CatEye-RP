# RP 11 下划线、删除线与相邻文字字段

本阶段按原生独立布尔字段恢复 `underline`、`strikethrough`：基础样式、普通 AxRun 和已验证的活动状态补丁均保留 `true`、`false` 与缺省的区别。两项同时为 true 不互相替换。状态如何生成单条 CSS `text-decoration` 由原 JavaScript 的独立探针决定，不能从两个布尔字段直接推导所有状态组合的视觉结果。

证据来自原始样本、自写对象读取器、原 DLL 静态 ECMA-335 metadata/CIL，以及自写 parser/importer 的定向验证。没有加载或执行原 DLL，没有原版 GUI 对照。原始 DLL SHA-256 为 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。来源文件、样本 SHA、实现和测试 SHA 见 [text-decoration-format-evidence.json](text-decoration-format-evidence.json)。旧的 rich-text/font-style 报告保持原样。

## 确切字段及原始指令

| 载体 / 方法 | token、IL | 直接证明 |
|---|---|---|
| `Axure.Constants.PName` | UNDERLINE field67121778=5；STRIKETHROUGH field67121833=95；CHARACTER_SPACING field67121829=91；TEXT_BASELINE field67121830=92 | 属性编号，不凭字段字符串推测值类型 |
| `aSXQ.iSXv.TIQr` / `UIQF` | 100707831 /100707833，签名`200002` | Underline / Strikethrough getter 返回 Boolean |
| `iSXv.eIwT` | 100707862；0x190调用TIQr→0x195转换→0x19A加入map；0x252调用UIQF→0x257转换→0x25C加入map | 两个字段分别序列化；不是同一个互斥枚举或位掩码 |
| `RPFormatExtensions.bJcT` | 100692664；0x98..0x9D、0xCC..0xD2 | 原绘制转换分别调用`set_Strikethrough`、`set_Underline` |
| `INKs.PNKu.RNxS` | 100699318；0x53..0x7A | 从property provider读5和95，分别拆箱Nullable<Boolean>、GetValueOrDefault |
| 同上 | 0x80..0x8B | 两个bool做OR；任意为true才调用mNx9；不能据此声称双方false在此处必然输出CSS none |
| `PNKu.mNx9` | 100699319；0xD..0x2F与0x35..0x57 | 两个Boolean参数独立控制StringBuilder.Append；两者true可同时追加；0x80检查长度，0xB1写CSS字典 |
| `wJe6.rJeU` | 100694323；0x7..0xE、0x283..0x2AC | 先应用既有OD筛选；活动Prop<Boolean>走属性名writer并写JSON Boolean，显式false不等于字段缺省 |

原始 CIL 文件依次为 `samples/metadata-PName.json`、`font-style-format-run-base-cil.json`、`font-style-format-conversion-cil.json`、`rich-text-format-html-style-cil.json`、新建的 `text-decoration-css-cil.json`，以及既有 `selected-style-filter-json-entry.json`。`text-decoration-json-keys-cil.json` 和 `text-decoration-property-names-cil.json` 保留 JSON 属性名调用链。CSS/JSON属性名称的部分底层字符串仍通过原混淆表读取，没有执行字符串解码器，也不宣称已逐字节解出全部字面表。字段名称、类型、枚举及相邻原JS是交叉证据。

状态仅对**原始本地 state PropList**沿用已证的 `Overridden && !Indeterminate` 筛选。先检查结构和重复，再筛选，未知活动属性继续原子拒绝；默认/匹配base缓存不套用此过滤。命名Hint等已解析缓存颜色路径保持原来的精确identity限制。参见 [selected-style-filter-evidence.md](selected-style-filter-evidence.md)。

## 字距与基线：证据到哪，支持到哪

`iSXv.YIQb`（100707837，签名`20000D`）返回CharacterSpacing的Double；序列化在eIwT的0x225..0x230。`FIQj`（100707839）返回`Axure.Platform.Baseline`，序列化在0x1F3。既有 `rich-text-format-metadata.json` 的Baseline为Normal0、Super1、Sub2。

HTML链对CharacterSpacing读PName91后调用`PNKu.zNxI`（100699324，RNxS 0x90..0xC5），状态writer也调用同一个zNxI（rJeU 0x241..0x272）。非零zNxI在0x90..0xAA调用`a5ib.x5ig(value,72)`后格式化。新证据 `text-decoration-character-units-cil.json`：x5ig（100719575）按 **value ×96 ÷72** 计算，随后传3位和模式1给`rbx2.ybxu`（100688822）；`text-decoration-rounding-cil.json`显示它直接调用`System.Math.Round`。因此native`.3`不能直接当CSS`.3px`；算术值会变为`.4`。零值分支、最终单位/字面量及精确字形效果尚未完整解码/对照，本阶段**仍只支持CharacterSpacing=0**，不为非零数据猜单位。

`PNKu.BNxJ`（100699316）将Baseline1、2及默认值分支转换成混淆字符串（比较位置0x21..0x23、0x42..0x44），未逐字节解出CSS基线值。全部真实runs的Baseline=0；本阶段继续拒绝非零基线，不将super/sub降格为普通文字。Stretch也保持已证默认5边界。

## 11样本清点与不可混淆的快照

独立 [text-decoration-census.json](text-decoration-census.json) 包含所有来源SHA、包SHA、对象ID、原始字段、路径和DOAName位。递归计数包括hyperlink内的run：

| AxRun字段 | 真实出现次数 |
|---|---|
| Underline | false2860；true2 |
| Strikethrough | false2862；true0 |
| Baseline | 0×2862 |
| CharacterSpacing | 0×2726；0.3×130；0.113×4；0.6×2 |

650条underline=true与637条strikethrough=true**属性记录不代表同量的活动元件装饰**：统计包含缓存、默认样式和未生效快照。与IX_STYLES引用对应的1440条相关记录全部不满足OD；其中359条underline=true、359条strike=true均未生效。恢复器不会把它们激活。本轮11样本最终已导入的基础样式、富文本run及状态均没有true装饰。

两条实际Underline=true都位于AxHyperlink里，因此依旧拒绝整个rich payload，保留明确省略报告；没有为增加数字把超链接扁平化：

| 样本 | 包ID / ownerID | 下划线文字 |
|---|---|---|
| Sample UI patterns.rplib，SHA`cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b` | `27f59a68aaf249d298b4edbb44f8e2ae` / `14ea8a9456d14c888e8e483e64492173` | Learn more about Repeaters |
| Prototyping Basics.rp，SHA`26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7` | `8165e87159f34c58a974459d9e910e34` / `4f4e187b657a4108aa50438dd7d0fca8` | www.axure.com/support |

前阶段的“第50个hyperlink owner”指50个mixed-font owners集合，不是声称全11样本只存在一个hyperlink。当前清点明确这一区别。兄弟报告 `text-decoration-runtime-hyperlink-graph.json` 保留UI示例的交互对象闭包；它没有授予本解析器简化该链接继承/动作的权限。

## 生产协议与测试边界

`richTextRecovery.source.runStyleSchemaVersion=2`；每个成功native run的style必须明确保存恰好七项：`fontFamily,fontSize,fontWeight,fontStyle,color,underline,strikethrough`。Importer独立要求v2、全部七项及严格Boolean，缺少装饰字段不会默认为false。Parser/worker与importer随同版本升级；原先保存的 `.rea.json` 模型仍允许缺省装饰字段，旧文档没有被强加新字段。

基础与run均保留两个独立Boolean；活动补丁缺省不被补全，false与base相同仍保留。源属性5、95对应输出字段严格校验，完整状态补丁上限由16变为18（含四边padding）。底层本地非OD默认快照不覆盖uniform run装饰；显式local override与既有字体字段一致优先保留，而structured run自身的明确格式不被base汇总擦除。对于未知base仍只容许已有独立颜色子集，不扩张不明样式继承。

Renderer不能在父容器上设置会传播的装饰再要求子run的none清除它；独立模型的字段恢复与浏览器视觉实现需要区分。原JS特殊状态拼串（包括underline:false+strike:true的非法串）由另一个独立原函数探针报告，不能把本报告的字段合同冒称原版所有组合的CSS直接等价。

本轮实际验证：

- 新Node6项 +原rich6项，共12/12；四组合、显式关闭、局部非OD、恶意类型、活动未知项、真实hyperlink/非零字距拒绝。
- 关联font/state/ErrorHint/selected Node39/39；包含命名缓存色，未把缓存记录当本地OD过滤。
- 新importer21项 +原rich16项，共37/37；v2严格协议、旧文档省略兼容、状态原子省略、18源字段及save/reopen。
- `npx tsc --noEmit`通过。
- `node research/text-decoration-import-audit.mjs`：11份原SHA样本，全部既有导入计数逐字段等值；仍为632 rich元件、2095 runs、49 mixed owners；新增/丢失元件、事件、rich owners全部0。Form仍558 top+440 nested/74 events。Icons保留原页面数上限拒绝。最大compact输出Form25,873,524 bytes，未超过64MiB worker边界。

真实strike=true、both=true及装饰活动state在本语料中没有案例；这些能力依据明确CIL字段语义和独立合成协议测试，不能写成已由真实原版GUI验证。全套测试、两个播放器、原生包及字体度量由主线程独立验证，本报告仅列本代理实际完成的检查。

复现顺序：`node research/text-decoration-census.mjs`、`node research/text-decoration-import-audit.mjs`、上述定向测试，再运行`node research/text-decoration-format-evidence.mjs`生成来源清单。
