# Default 库选择控件创建：模板、直接新建、库克隆的证据边界

目标为 Axure RP 11.0.0.4150，DLL SHA-256 dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7。实际 Default.rplib SHA-256 9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50。所有检查只读取包、元数据、保留 CIL，并解释保留指令；未加载/执行原厂 DLL，未重新尝试 GUI 桥接，也未改产品代码、REA 配置或历史冻结证据。

## 可直接用于独立库工厂的声明

实际文件经本地只读容器/对象读取器重新读取；模板的普通样式来自完整的 Default → matched base → local 链，具体字段和原始对象见 selection-creation-template-evidence.json。此前完整导入模型来自 selection-layout-import-origin-checked.json，不能用它的省略字段反证原库没有这些声明。

| 字段 | Checkbox | Radio Button |
|---|---|---|
| package ID | f5eb6c5d4fd041d48f2d93f23c5a8d32 | 1661553b21d64561b7205c5d4edbdc0f |
| object ID | a242d373d93f443cb7674d57893bd3d2 | 761eda201c1640dda072eae1f0388827 |
| 储存文本 | Checkbox | Radio Button |
| 储存位置 | 100,100 | 100,100 |
| 储存尺寸 | 75×15 | 93×15 |
| 库模板共享标志 | AutoFitWidth=true, AutoFitHeight=false, AlignRight=False | 相同 |
| P94 indicator | local determined+overridden 13 | 相同 |
| 普通颜色 | solid fill #ffffff, solid border #797979, text #333333 | 相同 |
| 文本 | Arial, 9.75pt (当前独立模型13px), weight400, normal, 无下划线/删除线 | 相同 |
| 段落 | 左对齐、LineSpacing=0、无列表、Wrapping=0、Trimming=0 | 相同 |
| 模型布局投影 | top/left, lineHeight=normal, padding [0,2,0,2] | 相同 |
| 初始状态 | Selected=false, Disabled=false, Error=false, Visible=true, Locked=false | 相同 |
| 名称 / radio group | name-block.text 空字符串；无 radio-group 字段 | name-block.text 空字符串；radio-group 明确为空字符串 |

富文本是一个明确 AxRun，已有导入投影为 richText.expressionMode=literal。模板无用户自适应覆盖。关闭的 outer/inner/text shadow 仍有参数，完整值在前述模型及原始链里；开关关闭不能误写成开启。库模板不是所有 SelectionButton 的类构造默认，也不应被解析器补入旧工程。独立工厂应产生新 ID，不复制原生对象 ID、导入 notes 或原生库内部引用。

## Disabled 声明：已完整解析

两控件均有本地 P21.Disabled 引用，分别指向包内 c57dc41aea8444c495230192492145fa / 6673b9d510274cf680d5bf3fe863d868。状态对象的 P0 与 MatchInfo 指向 Form disabled：style ID 2829faada5f8449da03773b96e566862，library ID 53f4a189168b474893d409a1b736ad03。每包唯一匹配缓存仅声明 P7，solid ARGB -986896 = #f0f0f0。因此 disabled 覆盖只有 fill:#f0f0f0，其他正常样式继续继承；不是整套替换，也不是 Theme/null fill。selection-creation-state-evidence.json 保留引用对象、缓存、包哈希及断言。

## 三种入口必须区分

1. **类构造。** Checkbox 100699784 / RadioButton 100701388 → SelectionButton 100702028 → TextRectObject 100702361 → RichTextObject 100702323。检查过的构造器不显式把 AFWidth/AFHeight 设 true；SelectionButton 构造有 FriendlyTypeName→Text，RadioButton 有空 RadioGroup。它们还依赖上游样式与通知，不能据构造器零值确定最终工具默认。
2. **按点直接新建。** mj1k.vI8C 100685199 → VI8e 100685194 创建 SelectionButton；位置 xJ0B(point,true,true,null) → set_AutoFitWidth(true) → OI8Z(true) → P94=13 → kj1L(true,false) → bounds。两类型真实分支均在保留 CIL 解释器中命中。该路径请求文字布局，不能拿库中75/93作为其最终宽度。
3. **按矩形直接新建。** mj1k.aI8M 100685203 先 YJ0S(rect,true)，再 P94=13、kj1L(true,false)、bounds；该函数没有上述 AFWidth=true 赋值。几何/样式通知在探针中是显式外部服务，不据此声称完全不会布局。

点/矩形方法是带参数形状的源级区分，尚未把每一个菜单、快捷插入、画布手势与它们逐一绑定；不能把当前产品共用 addWidget 的所有入口都假定为同一原生入口。

## Default 库 Page 克隆链及末尾 Update 门控

静态入口 EFqs.vFYw **100682742** 取载荷中的 Page；源文档类型为2时先 EFYu **100682743**（原 lambda 名 ImportVariablesAndStyles），再 QFYs **100682744**（FinishDragPage）。实际 Default.rplib 的 DesignDocument.document-type 明确为2，这个类型绑定保留在 state evidence；尚未实际操作原版 Toolbox 事件。

QFYs 调 mJ4n.sJnF **100696245** → ztnG.Copy **100716824** 克隆控件，设置背景/坐标/自适应，最后 qFYT **100682741** → ujoT.zjzI **100683029**（PastePasteData）。后者 IL1119 用 ktiR.Hti6 **100715422** 构造 context，IL1124 对插入图元调用 Update。

**该末尾 TextRectObject.Update 不是强制重测证据。** Hti6 及构造器 **100715420** 解释结果 Eti2=true、qtiq=false；BJ0y **100695521** 因 qtiq=false 返回 false，无论之前缓存视图值相同还是不同。TextRectObject.Update **100702380** 遍历 inline links、调用 base Update，随后 ntiC **100715424** 因 Eti2=true 返回 false，结束；这条执行轨迹不调用 OI8Z。模板没有 inline links。base Update 是显式服务边界，这个结论只指 TextRectObject 直接文字布局分支。

本轮没有闭合整个克隆/反序列化、ImportVariablesAndStyles、普通样式通知和 base Update 的所有间接副作用。因此不能断言库拖入最终永远是75×15/93×15，也不能凭 Update 的方法体包含 OI8Z 就在独立库创建时强制重测。保留模板声明与储存几何是明确的模板构造边界，之后已证实的字体/尺寸/样式编辑可调用已有布局服务；原版实际落点后尺寸与字体测量仍未验证。

## 验证与未知

selection-creation-entry-probes.json 包含6个通过的保留指令检查：两类型×点/矩形4例，Hti6末尾Update的两个先前视图值2例。指令、常量字段和字符串表由既有静态解释器处理；构造器、位置写入、样式下游、字形测量等替代边界逐项列出，不是原厂运行结果。

两次研究探针失败保留：failure-1 缺少 switch 指令支持；failure-2 错把末尾 Update 预计为必调用 OI8Z，被实际指令轨迹否定。修正解释器/预期后重跑，没有修改产品或降低数值容差。两次探针旧代码在 .build/selection-creation-entry-probe-before-*.mjs。

仍未知：库条目 UI 事件的完整入口映射、完整 clone/样式导入的所有通知、自动命名政策、目标文档自定义同名样式冲突、字体替换/DPI后的最终几何、原版 GUI/像素。上述6检查和模板读取均不证明原版完整创建等价。
