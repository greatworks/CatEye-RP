# 下一轮 RP 只读导入覆盖审计

2026-10-13；使用当前容器/对象/semantics 读取器与 importer，对原始文件重新执行只读审计。**优先候选是严格规范椭圆，其次是有原生空值省略证据的无文字基础形状。** 表单详细字段由另一研究分支负责；本文没有修改产品或测试，没有启动原版 GUI。

机器证据：[rp-next-coverage-evidence.json](D:/WSCodex/REA/research/rp-next-coverage-evidence.json)。其中冻结审计时 reader/importer SHA、每个源文件 SHA、跳过对象 ID/包 ID、椭圆及空矩形逐对象记录、代表对象原生字段，以及 CIL 文件摘要。统计属于本轮实现前的基线，不代表后来修改后的导入结果。

## 审计范围与基线

4 个 shipped `.rp`、2 个教程 `.rp`，另用 Default、Flow、Sample form patterns、Sample UI patterns 四个 `.rplib` 佐证结构；没有扫描 Icons 库，也没有将库页面统计当作 `.rp` 项目覆盖率。

| RP 样本 | 顶层恢复/跳过 | 嵌套恢复/跳过 | 规范椭圆 | 椭圆有文本/省略文本 |
|---|---:|---:|---:|---:|
| Prototype Starter | 31 / 57 | 9 / 19 | 1 | 0 / 1 |
| Prototyping Basics | 113 / 86 | 9 / 43 | 52 | 43 / 9 |
| Quick Win | 31 / 11 | 2 / 0 | 0 | 0 / 0 |
| UX Prototyping | 98 / 55 | 0 / 0 | 0 | 0 / 0 |
| the-basics-tab-menu | 3 / 0 | 2 / 0 | 0 | 0 / 0 |
| complex-interactions-required-fields | 7 / 0 | 0 / 0 | 0 | 0 / 0 |

6 个 RP 共枚举 649 个页面/状态图成员；导入 305，实际遍历并跳过 271。其余 73 属未关联/未进入的状态图成员，不应混入“已尝试导入”分母。271 个跳过对象按源类型为 VectorShape **185**、ImageBox **50**、DynamicPanel **17**、Layer **15**、ImageMapRegion **2**、Checkbox **1**、Connector **1**。

主要首个失败原因：形状/路径/表单类型未知 **129**；未观察到文本字段 **74**；PNG eXIf **33**；其它图片边界 **17**；字段对象无效 **7**；固定/百分比布局 **6**；fit 子元件边界未知 **4**；富文本内联不支持 **1**。这是每个对象当前首先遇到的错误，解除后仍需复查其后守卫。

## 候选 1：严格规范椭圆

**观察**：全部 10 个文件共 **172** 个 `Axure:DiagramObject:VectorShape` 的 `Shape=15`，其 `ControlPoints` 逐字序列化后只有 **1 个唯一指纹**。其中 RP 53 个，库 119 个（Default 2、Flow 1、form 94、UI 22）。库对象很多仍有其它布局/继承或父状态障碍，119 不是承诺新增量。

`research/samples/metadata-RPShapeType.json` 的原 DLL 元数据明确：`Axure.DocumentAPI.Widgets.RPShapeType.Ellipse = 15`。不要误用另一个 `Axure.Axvg.Graphics.ShapeType.Ellipse = 1`。VectorShape `get_Shape` token **100702789** 返回 `SN8X` 字段；对应窄 CIL 保存在 `rp-next-coverage-vector-cil.json`。

存储指纹（单 path；恰好四点；全部 `HigherSegmentExists=true`）：

| Path | LowerHandle | HigherHandle |
|---|---|---|
| (0.5, 0) | (0.21999999999999997, 0) | (0.78, 0) |
| (1, 0.5) | (1, 0.21999999999999997) | (1, 0.78) |
| (0.5, 1) | (0.78, 1) | (0.21999999999999997, 1) |
| (0, 0.5) | (0, 0.78) | (0, 0.21999999999999997) |

可独立实现：只接受 `Shape=15` 与完整规范指纹同时成立，再沿用有限尺寸、坐标、零旋转/无变换、样式继承、父容器和文本守卫。允许循环起点只是实现的保守泛化，现样本全部同一起点；不要接收反向、额外 path、任意 handle 或仅因 Shape=15 就猜测未编辑曲线。

代表对象：

- Prototyping Basics：页面包 `8165e87159f34c58a974459d9e910e34`，对象 `46989012ce3a4f449aa31c1c02418dcc`，`LOCATION=(50,7992)`，`SIZE=(32,32)`，纯文本 `1`；源解码 offset **143801**，part SHA `59276e6a79af545e322ff655c4bfbaf60ddfd5cb6de0cd68fcf5b78357dd8459`。
- 同文件状态包 `6b9b525b48b14c799f24311f9d7cc7f5`，对象 `7099430bf4f443c9adb254fc1a084504`，`LOCATION=(232,30)`，`SIZE=(16,16)`，无文本字段。
- Flow 库包 `1fb7a270d26e4c83b1f65c906d302926`，对象 `8998e1d53dc2495d947c88e6af7056f3`，`SIZE=(100,60)`，证明确为非圆椭圆，同样规范指纹。

**收益推断**：对 53 个 RP 椭圆使用独立新页面，以 box 仅作为现有几何/样式守卫的载体做资格检查，不改生产代码：43 个明确文本对象全部通过其余现有守卫；另外 10 个只在把缺失文本转换为显式空字符串的研究试验后通过。这不是椭圆导入或渲染验证，父状态、分组完整性仍需最终产品复查。

**外观限制**：handle 距离对应 cubic 系数约 0.56。CSS `border-radius:50%` 是浏览器椭圆，不应宣称与该原生 Bezier 路径逐像素一致。本轮未证明原 HTML 生成器是否把此路径转换为数学 ellipse；建议明确报告“映射为浏览器椭圆，原生曲线未逐像素对照”。

## 候选 2：省略空文本的基础 VectorShape

在已识别矩形中，6 个 RP 共 **79** 个 `no-observed-text-field`；其中 **74** 个已被遍历并仅因缺文本跳过（Prototype 25、Basics 30、Quick 2、UX 17）。另 5 个在当前未访问的 UX 状态图。以上 79 个在独立资格探针中全部通过其它当前守卫；不要把不可达的 5 个直接计为本轮新增。

代表：Prototype Starter 包 `f7e2243565784629b89328593f0458fb` 的 `72fc176787e4473c998e76bf57ee7a31`，规范矩形、`LOCATION=(100,520)`、`SIZE=(1000,300)`、AutoFitWidth/Height=false，既无 `TextBlock` 也无 `RichTextBlock`。offset **48332**，part SHA `d01f3a425722dc07b5b60604f3991bf69a7ba082a6ea0db993cef3ddabb784c6`。

### 原生省略链静态证据

所有下列窄 CIL 均来自 **Axure RP 11.0.0.4150** `AxureRP11.dll`，SHA `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`，只用 PEReader/ECMA-335 读取，未加载/执行 DLL。

1. VectorShape writer **100702762** IL346 调 TextRectObject writer **100702405**；后者 IL35 调 `RichTextObject::YNZq` **100702349**。
2. `YNZq` IL321–332：取 `get_AttributedString`，调用 `kSaf::XSaw` **100707631**；只有 false 才进入写入路径。true 的后继最终均返回，发生在当前/legacy rich text 写入之前。
3. `XSaw` IL42–49 比较对象与 null；非 null 在 IL33–39 调 `rSma::IsEmpty`，null 路径返回 true。**空/无 attributed string 被 serializer 主动省略**，并非凭样本名字猜测空文本。
4. `RichTextObject` 构造器 **100702324** IL53–59 以 null attributed-string 创建 `RichTextPanel`；其构造器 **100701870** IL109–129 在 null 时使用 IL117 的 `ldstr ""`，调用 `rSma::lSmU` 并安装结果。该 ldstr 是可直接读出的空字符串。
5. Reader `RichTextObject::WNZO` **100702351** IL209–252 读取 map 值；IL157–159 对 null 分支，只有非 null 才在 IL106–135 构造 rich-text reader 并调用 `RNO1`。底层 `StXT::Ytmx` **100716030** 调 `stXy` **100716027**；后者 IL33–47 用 `TryGetValue` 并返回 out 值，缺键返回 null。

证据文件：`rp-next-coverage-vector-cil.json`、`rp-next-coverage-textrect-cil.json`、`rp-next-coverage-richtext-cil.json`、`rp-next-coverage-empty-string-cil.json`、`rp-next-coverage-textpanel-cil.json`、`rp-next-coverage-map-cil.json`；文件 SHA 见主 JSON 的 `cilEvidence`。

**严格边界**：文本字段键仍经 `sIho` 间接字符串表，未逐字解码该调用的键；字段身份由真实样本 `RichTextBlock/attributed-string` 结构与 writer/reader 的富文本对象调用链相互佐证。CIL 有混淆的无效入口和不透明分支，本报告没有执行原函数证明所有分支。可将已识别基础 VectorShape 的“两个文本字段均不存在、无其它已知旧文本载体”恢复为空，但必须单独标明该恢复依据；`RichTextBlock=null`、畸形 map、未知 inline、空/坏 Paragraphs 不能一律当空，不能外推到任意未知控件类型或母版覆盖。

若采用这条受限恢复，已遍历的空矩形 74 加规范椭圆 53，共 **127 个基线 skip** 可解除其当前主障碍；仍是最终实测前的上界，不是宣布全部已恢复。未采用空文本恢复时，可先仅恢复 43 个带明确文本的椭圆。

## 暂不优先：Layer 分组

6 个 RP 有 15 个 Layer 被跳过（Prototype 12，Basics 3），四个库中另有大量 Layer。实存对象 `a6e9638527f743d89b54906308f12025` 的 `DiagramObjects` 明确引用同包对象 `72fc176787e4473c998e76bf57ee7a31`、`a0a26b8177954006b1712834fe787f01`、`f91c00f1ad2d483999638cae209712e3`（tag 3）；同对象缺 LOCATION/SIZE。不能简单转单状态 panel 并猜尺寸：原页面成员也含这些引用，必须核对去重、坐标、事件传播 `Propagate`、选中组作用域和内容边界。本轮价值/风险比低于规范椭圆，不建议同时展开。

## 源文件摘要

| 文件 | SHA-256 |
|---|---|
| Prototype Starter.rp | `6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714` |
| Prototyping Basics.rp | `26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7` |
| Quick Win.rp | `04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051` |
| UX Prototyping.rp | `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72` |
| the-basics-tab-menu.rp | `0aaae2dbc56b5c55ed3ef23bc3bf076ea82e36052bc90ed2682228ab5194c4d4` |
| complex-interactions-required-fields.rp | `0139703abe8e30b27279997ccfd0dd31b4cac97f4900dc59a2af3c310618d77c` |
| Default.rplib | `9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50` |
| Flow.rplib | `95d85ffaddac36144ae8ebd645341b2e557f0a6157b092319e7dac7b71d9d451` |
| Sample form patterns.rplib | `1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179` |
| Sample UI patterns.rplib | `cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b` |

REA extraction evidence：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。只读审计、元数据/CIL 与真实存储字段是本轮证据；没有新增原版 GUI 或 rendered pixel parity 声明。
