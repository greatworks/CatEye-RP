# RP 表单候选与 TextArea 窄导入证据

2026-10-13；Axure RP 11.0.0.4150。本轮先清点真实容器中的表单/形状，随后按 root 决策收敛到 TextArea。只增加本报告与 [rp-form-candidates-evidence.json](D:/WSCodex/REA/research/rp-form-candidates-evidence.json)，未编辑产品、解码器或产品测试。静态读取 DLL metadata/CIL，没有加载或执行原 DLL，也没有运行原版 GUI。

## 可实施范围与计数

11 个真实容器（5 个分发库、4 个分发训练项目、2 个官方教程项目）中共找到 **5 个 TextArea**，全部符合以下明确保存的子集：

| 原存储字段 | 窄范围要求 | 对应处理 |
|---|---|---|
| type | `Axure:DiagramObject:TextArea` | 类型必须精确匹配，不把 WordWrap=true 的其它控件猜成 textarea |
| `TextBlock.text` | 字符串 | 原文；5 样本均为空字符串 |
| `WordWrap` | true | 保留普通多行换行显示；false 暂拒绝 |
| `ReadOnly` | false | 产品暂无 readonly 字段时不可降格只读控件 |
| `Type` | 0 | 已核 InputType.Text=0，其它值暂拒绝 |
| `PlaceholderText` | 空字符串 | 本轮不恢复提示文字 |
| `HideHintOnFocus` | false | 本轮不恢复焦点提示行为 |
| `SubmitButton` | tag3、全零 GUID 引用 | 本轮无指定提交按钮关联；不要把任意零引用泛化成同一含义 |

5 个对象都直接列在所属 Diagram 的成员表中，都有显式且 determined 的 LOCATION/SIZE，rotation/transform absent，AdaptiveStyles=[]、IsContained=false、Selected=false、Error=false。它们的 base/default 缓存链全部不完整；可以沿现有策略恢复显式几何和已知 local style，但应继续报告继承样式、选中样式及未映射属性。**5 是字段候选数量，不是五个完整精确外观/交互恢复承诺。**

初始清点另见 TextBox120、ComboBox27、ListBox1；Dropdown 的具体序列化类型是 ComboBox。已有 TextBox 子集接受 Type0/1、WordWrap=false、ReadOnly=false；只读等对象不能直接放宽成可编辑输入。ComboBox/ListBox 的 list-options/multiple 需另做索引、选项状态、空列表验证，本轮不实现。Shape=15共172个仅是形状分类清点，不是已验证椭圆可导入数量；椭圆路径核实由独立 evidence agent 承担。

## 精确样本与对象身份

Default.rplib SHA-256：`9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50`，本地已有 [Default.rplib](D:/WSCodex/REA/research/samples/Default.rplib)。

Sample form patterns.rplib SHA-256：`1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179`，来源 `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Libraries/Sample form patterns.rplib`。未将官方库加入产品包。

| 来源 / 页面名 | packageId | objectId | 显式 X,Y / W,H |
|---|---|---|---|
| Default / Text area | 9f7d5f6c9ed14312b3112e36a1604eff | 6abb79287fe4442993157dfc369e11a8 | 100,100 / 300,170 |
| Forms / Text area & character count | 1dd62d24bc27417299d6601edc4cceae | b8211c8a2d694d32a3bf23fc778d40d6 | 20,44 / 300,82 |
| Forms / Product feedback form | e75bf1b9234d40d9bb3c2f8a4ece4689 | 2433eab0b0154bbea8436f3b57cdb51c | 37,297 / 450,170 |
| Forms / Instructions | 9f2226d0f29c47a8b104b1293e29b97d | 34c06fd81ecd4d8f9dee9af81aa7e1d4 | 20,1259 / 300,82 |
| Forms / Instructions | c356742c685a47b0b1a9b4abc4dd2ad8 | c96699e911fb432c894747c9797f3ade | 20,4160 / 450,170 |

JSON 保留了五个对象完整原属性 map、package SHA、decoded offset，以及研究开始时的语义恢复快照。快照中 typeCandidate=null 记录的是**扩展前**的跳过原因：原 basicTypeCandidate 没有 TextArea 分支；不是对之后代码状态的断言。原 importer 还只接受 input 对应 TextBox，因此需要 parser 和 converter 两层同时承认新候选，不能只给 source 换名字。

两个 character-count 对象（b821…与34c0…）各有 native event50，但其 SetFunction SetWidgetRichText 当前不支持，必须继续按事件原子拒绝。其 focus48/blur49 为设置另一个形状 selected；实际保留还取决于该目标是否成功恢复。其余三个 TextArea 没有存储交互。

推荐真实字段 fixture：Default 单对象作为空文本、普通 bounds 的最小正常样本；Forms 的 b821…作为已知 local style、unsupported TextChange 动作与可单独核对 focus/blur 的样本；2433…作为450×170的独立页面样本。应按 packageId+objectId 定位，不依赖库中全局 objectId 唯一性。

## 元数据佐证及其边界

目标 DLL SHA-256：`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。

- TextArea 类型 token33557592；构造器100702253在IL46调用 SelectablePlainTextObject 构造器，100702254在IL20调用其另一构造器。get_SupportedIxEventTypes token100702248在IL7读取 dNZL。此次最小静态 CIL 保存于 JSON 的 managed 字段。
- IxEventType 是 **Axure.Constants.IxEventType**；OnTextChange field token67121717，原常量小端 `32000000`，即50。来源 [rp-interaction-IxEventType-cil.json](D:/WSCodex/REA/research/rp-interaction-IxEventType-cil.json)。样本 event50、该 enum、浏览器事件代码三者相互佐证。
- InputType.Text 的常量0由 [rp-interaction-InputType-cil.json](D:/WSCodex/REA/research/rp-interaction-InputType-cil.json) 确认。
- [PlainTextObject CIL](D:/WSCodex/REA/research/rp-interaction-PlainTextObject-cil.json) 中 get_ReadOnly100701328、get_PlaceholderText100701331、get_HideHintOnFocus100701333、get_Type100701335分别在IL8读取 kNpW/MNp6/CNpD/nNpL，setter分别为100701329/332/334/336。

这些 getter 的名称和字段证明类成员语义，**并不单独证明所有序列化字符串到内部字段的完整转换**。本轮 wire key 名称和值来自五个实际对象 map；未执行字符串解密器或声称已穷尽 serializer。TextArea 静态构造器使用 InitializeArray，未额外解出完整支持事件数组；event50的可用性由真实样本和下述原浏览器函数确认即可。

## GetWidgetText 与换行

原 `expr.js:586–590`：先检查 placeholder active（active时返回空），选取 INPUT DOM，然后调用 `$ax(...).text()`。原 `axQuery.std.js:883–916`：textarea 不走 div 富文本分支，直接返回 jQuery `.val()`，undefined则空字符串。因此 TextArea 可以与已支持 TextBox 一起作为已成功导入的原生 GetWidgetText 条件载体；不能因此放宽所有形状/未知输入控件。

本轮用 Edge155.0.4283.45、分发 jQuery3.7.1、原 GetWidgetText 两层函数，在隔离 textarea DOM 中实际执行6组读取，全部通过：

| 赋值 | 原函数读回 |
|---|---|
| 空字符串 | 空字符串 |
| `A\nB` | `A\nB` |
| `A\r\nB` | `A\nB` |
| `A\rB` | `A\nB` |
| `\nA\n` | 前后 LF 全部保留 |
| `<b>x</b> & [[Item.name]]` | 原样文字，不进行 HTML 或表达式展开 |

CRLF/CR→LF来自 textarea DOM value 规范化与实际 val读取路径，而不是观察到 .rp serializer 把存储文本改写。本轮真实 RP TextArea 都为空，**没有带非空多行文本的原厂保存样本**。新增非空/CRLF导入测试应明确是自写变化 fixture；保留原存储文本与渲染/用户输入值的边界，不能把浏览器探针说成原厂保存格式全覆盖。

## OnTextChange 的时机与去重

原 `events.js:1195–1213` 明确为 textbox/textarea建立 text-change 监听：先用当前 `.val()` 初始化缓存，然后将 keydown、keyup、input 三类 DOM 事件连接到 TryFireTextChanged。`events.js:1796–1800` 的 HasTextChanged 只接受 TextBox/TextArea且拥有 interactionMap.onTextChange。

原 `events.js:1802–1808` 的 TryFireTextChanged读取 `_input` 的 `.val()`；值未变化就return；变化则先更新缓存再 raiseSyntheticEvent('onTextChange')。比较函数来自 `doc.js:715–721`：缓存为 elementIdToText，判断为 `old != text`。对于此普通 textarea 路径，两者均字符串；本轮不泛化该 loose comparison 到其它值类型。

隔离探针执行的是原绑定块、Has/TryFire与原缓存函数；ID后缀映射和最终事件分发为最小 stub。依次派发 input空、input两行、keyup同值、keydown同值、input三行、input同值，**6次 dispatch仅产生2次onTextChange**，事件值分别 `a\nb`、`a\nb\nc`。因此普通编辑应在 input 时检查/派发，不应只等待 blur/change；同时重复键盘通知不应重复产生相同值事件。

程序动作另有 `expr.js:289–300` 的 SetWidgetFormText：设 `.val(value)` 后会在存在 onTextChange时调用 TryFireTextChanged，并带有相同值/placeholder早返回。本文只静态记录这一路；本轮未执行原程序设置动作、键盘默认编辑行为、IME composition、disabled状态、repeater后缀或完整事件调度。手动派发键盘事件证明监听/去重连接，不等同真实键盘输入覆盖。

## 证据身份及复查入口

分发包 SHA：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`；REA extraction `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。所有读取和探针使用同一个已提取包；0网络请求。

| 原文件 | SHA-256 |
|---|---|
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| axQuery.std.js | `0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| jquery-3.7.1.min.js | `8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85` |

本报告 JSON SHA：`b3224f3af1aadab47232d5b4eefdcc8e873f0a0b4d611957217340557548fb1d`。JSON包含11文件身份、类型数量、每个表单的package/object身份、5个完整TextArea原属性与语义快照、CIL/enum引用哈希、上述7段源码原文与行号、6个文本probe及6次事件dispatch结果。未单独增加probe脚本；这些有限函数和输入已落盘供重放，未复制供应商函数进产品。

读取样本可复用 `inspectRpObjects(file)` → `recoverRpSemantics(decoded)`；在候选修改前的语义快照已保存在JSON，不应将当前重新运行的结果与快照中的null candidate混淆。全部容器在本次原对象解码中无package失败；后续样式和动作的不支持情况独立保留。

## 后续定向审查补记

2026-10-13：root 请求独立只读审查新 ellipse/textarea/empty-text/GetWidgetText/commitText 路径。此前 JSON 保持不变，以上 SHA 仍指原证据快照。本节只补充新的清点和审查结果。

对同11个容器的全部原对象，筛选 `VectorShape`、Shape0/15、TextBlock/RichTextBlock均缺失，共291个：Default13、Flow3、Sample form patterns145、Sample UI patterns40、Prototype Starter26、Prototyping Basics40、Quick Win2、UX Prototyping22，其余0。全部所在 package.version 为 `[11,0,0,0]`。这是原对象清点，包含非直接页面成员或尚未满足其它守卫者，不能当作新增成功导入数。

这291个对象都有同样17个键：ControlPoints、Shape、reference-page-package-id、name-block、tooltip、IsContained、IsLocked、SelectedStyleGroup、MyStyle、AdaptiveStyles、SubmitButton、Disabled、Selected、Error、VisibleFromSettings、AutoFitHeight、AutoFitWidth。唯一额外键为 InteractionMap，出现24次。未观察到其它旧文本载体；CIL的legacy key仍未解出，不能声称已发现某个实际旧键。

已复核 root 加固后的 `recoverWidgetText(widget, version)`：空值推断只在11.0.0.0、VectorShape、Shape0/15、上述18键白名单且两个文本字段均不存在时成立；陌生键、旧版本、显式null/畸形富文本继续不恢复。该约束与本轮证据边界相符。

其余审查未发现必要阻塞问题：椭圆曲线指纹和不精确轮廓声明一致；TextArea严格选项及plain-text守卫保留，CRLF/CR转换有报告；GetWidgetText只放行成功导入的input/textarea，仍按packageId+objectId定位并拒绝歧义本地ID，不跨包猜目标；事件仍整项提交或拒绝；离线commitText按input更新并比较当前值去重。未把未验证的程序设置/键盘fallback完整语义当作已经实现。

独立执行验证：`npm test -- tests/import-rp-shapes-forms.test.ts tests/import-rp-interactions.test.ts` 为47/47；`node --test research/scripts/read-rp-shapes-forms.test.mjs` 为8/8（包含新空字段版本/未知键变异）。未运行全E2E或打包验证，也未修改产品及测试。
