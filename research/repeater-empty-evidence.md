# Axure RP 11 中继器零行生命周期证据

调查日期：2026-10-13。目标版本：官方 Windows 包 Axure RP 11.0.0.4150。仅阅读分发 JavaScript，并在隔离 Node VM 内执行 SHA 固定的原函数或短片段；没有启动原版应用、原型浏览器、完整脚本模块或 DLL。**本报告不是原版 GUI 验证，也不是完整兼容声明。** 本轮不修改产品源码和产品测试。

结论：部分“有数据 → 无数据”刷新会请求一次 `onBeforeItemLoad → onItemLoad → 模板子控件 onLoad`，但没有新建数据行、行 DOM 或尺寸记录。顶层 repeater 的此事件源是 repeater 本体，内部 `eventInfo.item` 仅为 `{valid:false}`。初始零行不走这个特殊分支。分页的触发条件存在已复现的源码特殊公式，不能简化为“可见行数大于零变为零”。当前产品应暂缓接入空回调，先补齐无效 Item、目标上下文和表达式失败语义。

## 证据与复现

- 原包：`research/vendor/AxureRP-Setup.zip`，SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。
- REA 既有提取 Evidence：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`；既有 JS 分析 parent Evidence：`ev_087ede770347fe8367155aa88a600204baf9051bc362979a94a8e1b170d6f432`。本次直接读已提取文件，没有新建共享 REA 会话。
- 原始目录 `V`：`C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`。
- [repeater-empty-evidence.json](repeater-empty-evidence.json)：9 个文件的绝对路径、字节数、SHA-256，29 个保留片段及原始行号，21 项探针结果。SHA-256：`6c3eb57df93b570dd3cf4195e8de18053ac6d52caddf1fb6be0da20290554d8a`。
- [repeater-empty-probe.mjs](repeater-empty-probe.mjs)：仅 Node 内置 `fs/path/crypto/vm/assert`，SHA-256：`7736cdd5bc8d1f890dc154923f1ed354b16bae0c4925668c0041422b8710bbd4`。先验证 9 个原文件哈希，再运行探针；VM 禁止字符串/wasm 动态代码生成，每段有 1 秒上限。

在仓库根目录执行：

```powershell
node research/repeater-empty-probe.mjs
```

原提取目录已清理时，可向同命令传入重新提取的 `resources/scripts/axure` 目录；字节哈希不符会立即失败。结果为 `pass:true, probes:21, files:9, excerpts:29`，并重新写 JSON。研究片段及样本不纳入产品发布包。

| 原文件 | SHA-256 |
|---|---|
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| variables.js | `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188` |
| sto.js | `c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| utils.temp.js | `ef33a9174ea5b4cdcd48229f896195d2f67941116aa7eeae6308a99e02b4832f` |
| visibility.js | `bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53` |

## 1. 零行加载分支与准确触发条件

**源码直接观察：** `repeater.js:98–149` 进入 refresh guard，在重算排序/过滤之前记录 `previousItemCount = getItemCount(repeaterId)`；之后重算 active data、计算真实可见 bounds。`225–245` 移除旧 DOM、重置尺寸表，`241–298` 仅为实际 bounds 内数据创建行。`329–375` 执行加载回调，最后才清缓存、恢复可见性、fit parent、结束 refresh guard。

`332–335` 的特殊条件是 `previousItemCount > 0 && currentItemCount === 0`。`342–357` 的循环以“仍有真实可见行，或者特殊条件”为入口，第一次迭代后即清特殊标志。因此：

- 真正没有可见数据且条件成立：仅一次额外迭代，`itemId` 是 `undefined`。
- 仍有真实行：第一次真实行消耗特殊标志，不额外增加一行或一次回调。
- 原生模板预求值命中时，`preevalMap` 还能跳过相应 before/load；探针使用空 map。

**分页特殊公式：** `repeater.js:594–603` 的内部 `getItemCount` 用 `min(n, size × page)` 为 start，再向后数 size；而真实可见 bounds `627–645` 使用 `(page−1) × size`。前者近似“下一页剩余数”，不等于当前页可见数。最后一页内部旧计数就是 0，因此最后一页清空时不满足特殊条件。这是此版本原函数行为，不是本报告给出的修正建议。

| 探针场景（旧 active → 新 active） | 每页数 / 旧页 | 旧内部计数 | Item Load 请求数 | 结果解释 |
|---|---:|---:|---:|---|
| 初始真正 0 → 0 | 不分页 | 0 | 0 | 不触发空回调 |
| 3 → 0（删除或过滤后的同一 active 转换） | 不分页 | 3 | 1 | repeater 本体作为源 |
| 已空 0 → 0 再刷新 | 不分页 | 0 | 0 | 无重复空回调 |
| 0 → 2 | 不分页 | 0 | 2 | 两个真实行 |
| 3 → 0 | 2 / 1 | 1 | 1 | 非最后一页清空 |
| 2 → 0 | 2 / 1 | 0 | 0 | 单页也是最后一页 |
| 5 → 0 | 2 / 3 | 0 | 0 | 最后一页清空 |
| 5 → 0 | 2 / 2 | 1 | 1 | 中间页清空 |
| 3 → 2 | 2 / 1 | 1 | 2 | 不追加空回调 |
| 3 → 3，请求页 99 | 2 / 99 | 0 | 1 | bounds 钳制到最后一页，有一个真实行 |

21 项探针中的 11 项覆盖上述 active/bounds/load-loop 情况（删除和过滤名称分列），**不执行 delete/filter action 或完整 `getOrderedIds`**。所以它们证明给定 active 转换时的回调算法，而不单独证明所有用户动作都产生该转换。普通正整数分页超页会钳制，不会把非空数据变成无可见行。分页配置异常值不在本次证明范围内。

初次刷新时，若旧 active 已从非空源初始化、过滤后变零，也可能满足上述条件；不能把“初次渲染”与“源数据初始零行”混为一谈。

## 2. 空事件的 Item / TargetItem / This

`repeater.js:1483–1490` 对 falsy `itemId` 返回不加行后缀的源 ID。顶层源 `r` 因而不是 `r-0`、`r-undefined` 或任何伪造行。`doc.js:291–299` 为事件创建 `item`；`328–347` 在没有行 ID 时直接返回 `{valid:false}`，未写入其余字段。

| 读值层次 | 顶层空回调的直接观察 |
|---|---|
| 内部 `eventInfo.item.valid` | `false` |
| 内部 `eventInfo.item.index/isfirst/islast/iseven/isodd/ismarked/repeater/isvisible` | 属性不存在；不是 0、false 或计数对象 |
| 表达式变量 `Item` | `variables.js:62` 发现 source Item 无效，回退到 `TargetItem` |
| 表达式变量 `TargetItem` | `variables.js:63` 按当前 action target 取 item；没有 target 时为 undefined |
| `This` | `variables.js:61` 按事件 source widget ID 动态调用 getWidgetInfo；这里是 repeater 本体 |

这意味着 **`eventInfo.item.valid === false` 不等于用户 `[[Item.valid]]` 必然显示 false**。目标可以改变 provider 的结果；有效目标行可以令 `Item` 回退到该行。metadata 属性名称在原始运行时为小写；产品对外 camelCase 需保留明确映射。

原生 STO 和字符串替换有两个不同层次：

1. `sto.js:145–160` 属性访问没有 null guard；无 target 时 `Item` 为 undefined，读 `Item.index` 等会抛异常。`expr.js:204–244` 字符串替换捕获该异常并保留原 `[[...]]`。探针中 valid、index、isFirst/isLast/isEven/isOdd/isMarked/repeater 对应原生小写属性均保留字面量。
2. target 是普通非行控件时，TargetItem 是 `{valid:false}`；缺少的属性读到 undefined。`sto.js:216–234` 按 STO 类型转换，明确构造的 string/bool/int 类型分别得到字符串 `"undefined"`、`"false"`、`"NaN"`。**探针 STO 类型是显式合成的，不是从已生成官方原型提取，不能断言任意实际 Set Text 都选择其中同一结果。**
3. 数据列用 `sto.js:116–125` 的独立 item handler；源无数据时改读 target。target 不存在时，行 ID 解析抛异常，字符串替换同样保留 `[[Item.Name]]` / `[[TargetItem.Name]]`。不能把列 provider 与 metadata provider 合并成统一返回空串。

`doc.js:349–397` 直接说明 repeater 源的 `This` 有独立元信息。其 `This.Repeater` 为自身；计数走真实 repeater provider，不能借一个假 Item 提供。探针验证 provider 的以下值，`This` 到这些函数的连接是静态证据：

| 当前数据状态 | dataCount | itemCount（active） | visibleItemCount | pageCount | pageIndex |
|---|---:|---:|---:|---:|---:|
| 真零行，不分页 | 0 | 0 | 0 | 1 | 1 |
| 真零行，每页 2 | 0 | 0 | 0 | 0 | 1 |
| 源 3 行、过滤后零，每页 2 | 3 | 0 | 0 | 0 | 1 |

`visibleitemcount` 会优先取已登记的 item ID 数组，否则调用 bounds provider（`doc.js:392`）；本表针对刷新到零后的状态，不能外推到任意动作链内尚未刷新时刻。

上述探针针对顶层 repeater。嵌套、master isolation、已有外层行后缀的源 ID 没有完整生成样例验证；不能从顶层结论推导“任意嵌套空事件都丢弃外层 Item”。下一轮应保留 repeater instance scope，单独确认内外层 provider。

## 3. 模板 Loaded 是请求，不是新建行

`repeater.js:355–357` 在特殊迭代里仍调用 `loadDynamicPanelsAndMasters(..., undefined)`。`events.js:1833–1838` 和 `1930–2018` 的遍历为普通子对象构造无行后缀 ID，并请求 `onLoad`；动态面板会遍历各 state；master 按其路径处理；这层 wrapper 不递归搜索嵌套 repeater 的数据行。

使用一个普通模板子控件的原遍历探针，记录到的请求严格为：

```text
r      onBeforeItemLoad
r      onItemLoad
child  onLoad
```

合成事件入口 `events.js:1701–1716` 按 script object 查事件，并非必须找到实际行 DOM 才请求执行。但本探针把 `raiseSyntheticEvent` 替换为日志，**没有证明任意无 DOM 子控件的完整用户动作都成功**。完整事件评价中的 DOM 属性、富文本、导航和 case menu 仍可能影响结果。

`doc.js:221–244` 还表明：找目标模板控件时，若 source/target 都没有可用同行 ID，便枚举该 repeater 的实际 item IDs。真正零行时返回空目标列表，不应该让子 Loaded 凭空创建行内控件实例。外部控件目标仍可解析。直接假造一个 `rowId` 会错误地使行内 Show/Set Text/Update This 等动作变成有效操作。

## 4. Item Resized 依赖真实布局

没有证据表明“数据变零”或初始化零行本身无条件触发 `onItemResize`。实际源码路径是：

- `repeater.js:1080–1110` 按真实可见 bounds 建立尺寸表；空 bounds 的表是空的，不注册哨兵。
- `1118–1134` 的 `setItemSize` 读取实际行 size。两个方向都无变化则返回 false，不派发。变化时先完成 X/Y push，再对该实际行 ID 派发一次 `onItemResize`。
- `_pushItems` 的 `1136–1277` 更新尺寸、repeater 外框、后续行位置；`1279–1289` 还 fit ancestor。直接 push 也可按其参数派发事件，不能声称所有路径都只来自自动 fit。
- `1590–1626` 的子控件 fit 链在所属 repeater `fitToContent` 开启时可调用 `setItemSize`。`action.js:1258–1271` 的显式 `thisItem` resize 也可调用它；并非仅自动 fit 才能触发。
- `visibility.js:1392–1394` 的 `setResizedSize` 只是存储，不是这个事件触发器。

原尺寸函数隔离探针用 CSS/parent-fit mock 和两个 100×20 行，把首行改成 120×30：只记录一次事件，事件时首行已为 120×30，第二行 top=30，repeater height=50，ancestor fit 已被调用。零 delta 无事件。空尺寸表执行 `setItemSize(undefined,...)` 缺少 entry 而抛错，不能把它作为合法空行 resize。

如果 Item Loaded、Before Item Load 或子 Loaded 里的动作修改真实行布局，可能在那个动作调用栈内同步触发 Item Resized；没有固定“所有 Item Loaded 结束后才触发”的规则。当前产品只有固定模板布局/行高时，不能用简单补发事件声称支持原生 Item Resized。完整 DOM、旋转、隐藏、wrap、混合尺寸和祖先 fit 组合仍未原版浏览器验证。

## 5. 同步数据保护与 Wait

`action.js:128–141` 维护 refresh 栈；`1793–1839` 的 Add/Delete/Update，以及 `1856–1964` 的 filter/sort/paging handler 检查 `_ignoreAction`，刷新中的相同 repeater 数据操作会被跳过。这适用于空回调仍位于 refresh guard 内的情况。

`action.js:1745–1785` 的 Mark handler 没有相同 guard；不能把整个空事件所有动作都统一禁用。Mark All 对真正零数据没有目标；本报告没有把 invalid Mark This 的内部边界行为提升成有效行语义。

`action.js:359–368` 的 Wait 即使 0 也调用 `setTimeout`，复制 eventInfo，之后继续动作链。刷新在 `repeater.js:374` 结束，所以正常定时器续段在 guard 解除后运行。探针执行原 wait、dispatch、add handler，使用手动释放的 timer queue：同步 Add 被忽略；Wait 0 后续 Add 成功并登记待刷新；复制的 item 仍是 `{valid:false}`。

探针用 JSON-safe event copy 代替原 copy 便于记录；原 `utils.temp.js:5–49` 的静态证据支持保留无效 item，而不会在新数据出现后自动把旧 frame 变为有效行。此处没有实测浏览器时间精度、页面离开取消、删除 target、异常后恢复等完整生命周期。

## 6. 下一轮最小正确接入方案（建议，非原厂字段声明）

本轮查看的 `src/runtime/export-runtime.ts` 中 `EventFrame` 只有 pageEpoch/sourceId/itemDisplay，`RowContext` 只表示真实行；`resolve` 的 provider 返回 string，缺失值默认为空；`flushRepeaters` 仅遍历真实 rows。这些约束使“多 dispatch 一次空 ItemLoaded”不足以保持已证明语义。建议按以下依赖顺序接入：

1. **保持真实行集合纯净。** EventFrame 明确区分 valid row 与 invalid source item，并独立记录触发 repeater 的 instance scope/sourceId；不为零回调分配 rowId、不把 `{}` 插入 dataset、不建 row DOM/尺寸条目。嵌套 repeater 外层 scope 必须保留并独立验证。
2. **计算正确的特殊分支。** 在重算 active data 之前保存原内部旧计数，之后按原 page/limit/clamp 顺序算新内部计数。它与产品可见数、itemCount、committed 数据数不是同一个字段。初始真零不触发；最后一页特殊公式应有独立回归。只有真实 rows 为零且条件成立才额外派发一次。
3. **provider 不再混淆 absent/invalid/空字符串。** source `Item` 无效时按当前目标回退；TargetItem 是当前目标的实时 item，This 按 sourceId 动态读取；有效 Item 的快照与列读取保留既有规则。为无效属性访问提供可区别的结果或异常，不把所有缺失值变成 0/false/空串。
4. **表达式先确定产品受支持子集。** 对字符串插值，原生失败会保留原 `[[...]]`；类型转换还受生成 STO 元数据控制。产品如果没有原 STO 类型，需明确只支持已验证的有界表达式子集并报告差异，不能宣称恢复任意原表达式。条件表达式的异常/类型强转需要另外验证，不能直接套用字符串替换规则。
5. **目标解析与生命周期分离。** 无行 frame 可以运行外部控件动作、变量动作和 Wait；模板控件目标须枚举实际行，零行就是无目标。请求模板 Loaded 时不创建实例，事件 sourceId 和 target resolution 分别处理。内部 Before Item Load 如果仍未支持，应明确限制。
6. **保护和等待保留。** 空回调放在 refresh guard 内；同步自数据 mutation 仍跳过，Mark 不泛化同一禁令。Wait 后保留原 invalid snapshot、page epoch 和真实外层 scope 的有效性；不能仅因空 frame 没 rowId 就取消，也不能在新行出现后给它补成有效 Item。
7. **Item Resized 独立迭代。** 先引入真实逐行 size/layout 状态与变更后的派发，覆盖显式 This Item resize、内容 fit 和同步嵌套事件，再添加此事件。零行路径不造 size entry、不无条件派发。

建议下一轮首先做顶层 repeater 的空回调、This 计数、无效 Item 字符串语义、外部目标、同步 guard 与 Wait；嵌套源 provider 和真实 Item Resized 若证据仍不足则保留明确限制。至少需真实生成原型/浏览器差分来确认 STO 编译、空模板控件的用户动作与菜单行为。本轮 21 项隔离探针只能证明明确列出的函数边界。
