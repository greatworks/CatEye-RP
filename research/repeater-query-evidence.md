# Axure RP 11 命名筛选与排序证据

2026-10-13。目标为已提取的 **Axure RP 11.0.0.4150** 分发 JavaScript。只读原始资源，并隔离执行指定原函数；未启动原版应用/原型，没有修改产品源码或测试。

交付：[完整实验 JSON](D:/WSCodex/REA/research/repeater-query-evidence.json)、[可重跑 probe](D:/WSCodex/REA/research/scripts/probe-repeater-query.mjs)。已有背景：[生命周期](D:/WSCodex/REA/research/repeater-lifecycle-evidence.md)、[分页](D:/WSCodex/REA/research/repeater-pagination-evidence.md)。

## 可执行合同

1. **筛选按追加管理，名称不是唯一键。** 同名筛选可共存；按名称移除会删除全部精确同名规则。`removeOtherFilters` 才先清空已有筛选。
2. **排序按列替换，名称也不是唯一键。** 添加排序先删除该列旧排序，按需 toggle 旧方向，再放到尾部。最后添加者是最高优先级；早先规则只在原比较器规定的 tie 条件下执行。不同列可共用名称，按名称移除会一起删除。
3. 筛选有 **Smart=0、All=1、Any=2**，由最后一条筛选的 `comboType` 控制整个集合。All 是 AND，Any 是 OR；Smart 为同列规则 OR、列组之间 AND、无列的表达式规则另以 AND 连接。不能默认多筛选只有 AND。
4. 添加筛选时不求值。保存原表达式、添加者元素 ID；每次刷新逐候选行重新计算，读取当时全局变量和控件文本。改变变量本身并未在这些函数中自动排队刷新，须等后续刷新触发。
5. 字符串返回值**只有精确 `"true"` 通过**。空串、`"false"`、`"0"`、`"1"`、`"TRUE"`、前后空白和任意非空文本均不通过。原始 boolean true 也通过；这不是通用 JavaScript truthiness。
6. `Item` 不必然是候选行：行内添加筛选时通常指添加者行；`TargetItem` 是候选行。源非行元素时 Item 回退候选。原列访问还有“源 repeater 无该列则回退候选”的分支。
7. 源行隐藏不会取消绑定；删除后的原生位置 ID 可能指到后继行或越界。产品若以稳定 ID 保存源、失效时回退候选，这是明确的安全差异，不能当作原版证据。
8. 普通字符串规则中 STO 求值失败被包装层保留为原 `[[...]]`，最终过滤为 false。该 catch 不覆盖 localVariables 的前置求值、上下文准备或任意未知表达式类型。

## 来源身份与方法

官方分发包 [AxureRP-Setup.zip](https://axure.cachefly.net/AxureRP-Setup.zip)，包 SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`；REA extraction `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。复用已有版本/提取证据，未重新下载。

`V` 为 `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`。行号以该目录原文件为准。

| 文件 | SHA-256 |
|---|---|
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| variables.js | `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188` |
| sto.js | `c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6` |
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |

Probe 校验前五个文件与既有摘要一致，并记录 expr.js 的本轮摘要。仅执行 JSON 所列源代码切片；多数谓词由确定性 callback 提供，以观察原 filter/sort 控制流。另一个实验执行原 `stringLiteral → substituteSTOs → evaluateExpr` 包装链，桥接到原 Item accessor，验证异常边界。没有运行编译器、完整表达式系统、DOM 或网络。Node `v24.18.0`，默认 locale `zh-CN`；Alphanumeric 结果依赖此 locale，不能泛化成全部浏览器区域设置。Probe 内 **15 项断言通过**，JSON 包含 21 个证据类别。

官方 [Sorting repeater rows](https://docs.axure.com/axure-rp/reference/sorting-repeater-rows/) 明确介绍命名排序、按列/类型排序、Toggle 的默认方向，以及移除全部或指定名称。官方 [Filtering repeater rows](https://docs.axure.com/axure-rp/reference/filtering-repeater-rows/) 使用 `Item.Column1` 与 `This.text`，并支持全部/按名移除；其文字有把“小于”与“过滤掉”混用的问题，本报告依据其预期结果和原函数，不据该措辞反转谓词。官方教程未完整规定以下重名、组合、失效源或复杂 ties，细则由静态/隔离证据补充。

## 参数、名称与更新顺序

| 入口 | 参数和已证规则 |
|---|---|
| `action.js:1856–1878` / `repeater.js:943–956` | `addFilter(repeaterId, removeOtherFilters, label, filter, condition, columnName, comboType, thisId)`。thisId 取添加动作的 `eventInfo.srcElement`。其他字段原样传入，不做表达式求值。先按 removeOtherFilters 清空，再追加对象；truthy label/filter/condition/columnName 才写入对应字段，comboType 始终记录。 |
| `action.js:1881–1898` / `repeater.js:959–974` | `removeAll` 为真时不传名称，清全部。否则 `filterName != ''` 才按名调用；空名动作不删除任何规则。内部函数直接接收 falsy label 会清全部，与动作层“空名称 no-op”不同。按名删除反向遍历所有规则，精确匹配全部同名。 |
| `action.js:1901–1915` / `repeater.js:977–994` | `addSort(repeaterId, label, columnName, ascending, toggle, sortType, removeAllSorts)`。在已有列表按 columnName 找第一个同列规则并移除；toggle 时 ascending 改为旧方向的反值，无旧同列规则则保留输入默认方向。最后 removeAllSorts 选择仅保留新规则，否则追加尾部。 |
| `action.js:1918–1933` / `repeater.js:997–1012` | removeAll/空名称逻辑与 filter 相同；按 label 删除全部同名 sort。 |

上述名称没有运行时 trim、大小写折叠或插值。Probe 添加字面名称 `[[Name]]` 后，移除 `Name` 无效，移除 `[[Name]]` 成功；`same` 与 `Same` 不同。空名、名称未找到或重复参数的 remove 动作仍 `_addRefresh`。所有四个 handler 都先跳过缺失目标/正在刷新中的同一 repeater，再排队刷新；刷新时点沿用既有生命周期合同，不能把每条动作都解释为立即重建。

Probe 的筛选重名例：X 为 1/2/3，同时追加 `same: X>1` 与 `same: X<3`，All 结果只剩 X=2；移除 `same` 删除两条，保留 `Same`。排序例：先 X ascending，再 Y ascending，结果首先按 Y，再按 X；重新添加 X 并 toggle 后，X 移至最高优先级，改为旧方向的反向，旧名称随旧同列规则一起消失。

## 筛选组合、求值与上下文

`repeater.js:833–927`：最后一条规则的 comboType 决定集合模式，移除最后一条后可改变整体组合方式。缺失/未知 comboType 会逐候选输出 INVALID FILTER COMBINATION 并不通过，没有隐式 All 默认。All/Any 按存储顺序短路。Smart 按首次出现的列顺序建立组，组内 Any；任何组失败即返回 false，最后才 All 求值无 columnName 的表达式规则。columnName 在这里用于分组，并不替代表达式内容。

隔离数据为 A=(red,small)、B=(blue,large)、C=(green,large)、D=(red,large)，规则 red、blue、large，再加无列规则 not B。最后规则模式 Smart 结果 D，All 结果空，Any 结果 A/B/C/D；移除最后规则后沿用前一条的 All，结果又为空。JSON 保存了逐表达式调用序列，验证短路而非先求出全部 boolean。

`repeater.js:929–933` 判真表的完整 15 个 primitive 输入在 JSON `filterTruth`。对产品字符串解释器应使用精确 `value === 'true'`。原代码还存在 JavaScript 抽象相等的对象转换可能性，本轮没有把任意对象作为合法产品规则返回类型支持。

添加仅保存对象（943–956）；`applyFilter` 在刷新时（835–860）对每行调用 `_evaluateFilter`。`expr.js:204–208` 在每次字符串表达式求值时重新生成 localVariables scope；`sto.js:97–103` 重新读取 scope 或全局变量；`variables.js:33–44` 取当前变量值；`expr.js:578–589` 的全局/控件文本函数也读当前值。Probe 添加后求值次数为 0；同一个已存筛选的阈值先读 3，随后全局改为 2，结果从 A/B 变 A；再将全局与源文本改为 4，结果变为 A/B/C。此处 widget 文本由桥接提供，原 DOM 文本读取没有执行。

`repeater.js:935–940` 为每次候选求值设置 targetElement=候选行 ID、srcElement=保存的 thisId，并重取 source Item；本次 applyFilter 缓存每个源的 widgetInfo，但 `variables.js:61` 的 This 又调用 getWidgetInfo，text 本身也通过 getter读取。成功结束后恢复传入 eventInfo 原来的 target/src/this/item（856–859）。这些动作没有保存添加时的变量值或控件文本快照。

| 表达式路径 | 绑定规则 |
|---|---|
| Item 元信息 | `variables.js:62`：有效 eventInfo.item 优先，否则 TargetItem。`doc.js:328–345` 只需元素 ID 可解析行号即 valid，不要求 DOM 存在。 |
| TargetItem 元信息 | `variables.js:63`：根据当前 targetElement 重取，即候选行。 |
| Item.Column | `sto.js:116–125`：若源 repeater 的列定义含此列，用源位置 ID；否则用候选。`repeater.js:1312–1315` 的 hasData 检查列 schema，不检查该源行仍存在。 |
| TargetItem.Column | 同一 STO 路径的 isTarget 强制选择候选。 |

源行隐藏/被过滤后，Item.Column 仍读取源行，而 isVisible 可为 false。删除源行或其之前行后，保存的 thisId 仍是原数字位置，未见 filter 规则随数据身份改写。`repeater.js:1291–1301、1332–1340` 先使用当前事件 deleteMap 中保留的旧 row，再按调整后的数字位置取 current dataset；后续不带该 deleteMap 的刷新可能读到后继行。Probe 将 source-2 的 X 从 2 改成 4，然后删除第二行；相同源 ID 的读取变成下一行的 3，再删除后继行会在底层 accessor 越界。

**异常边界纠正**：底层 accessor 越界不等于字符串筛选向外抛错。`expr.js:214–220` 捕获 STO 求值异常，保留原占位文本；242–244 的 stringLiteral 经此返回，`repeater.js:929–933` 最终判 false。补充实验走这条实际包装链：删除 source-2 后，`[[Item.X]]` 原样返回，filter 结果为空且不外抛。此前 callback probe 的 TypeError 仅证明 accessor 边界，JSON 已注明。另一方面，localVariables 的求值在 try 之前，_updateEventInfoForFilter 也在 filter evaluator 之前；evaluateExpr 主入口（760–763）没有总 catch。不能笼统声明所有异常都被吞掉。

## 筛选中的元信息阶段

`getOrderedIds` 在 `repeater.js:687` 先把 active 指向完整 current 数据深拷贝，690 才过滤，之后才排序。候选 Item/TargetItem 元信息通过 `setDisplayProps:605–625` 读取这份尚未过滤/排序的数据，以及当时页码；最终分页 bounds 尚未运行。**这里的 index 不是最终查询结果里的 index。**

原函数实验：A..E、每页 2、当前页 2，已有降序 sort，filter 检查 `TargetItem.index===1`。求值时 A/B/E 的 index 缺失，C 为 1，D 为 2，最终仅保留 C；不是按未来降序结果把 E 视为第 1 项。新建 repeater widgetInfo 的 itemCount/pageCount 此时同样基于这份完整 active，而 visibleItemCount 还可能来自旧注册 DOM；本轮未模拟 DOM 计数缓存。产品若支持 filter 内元信息，应明确这一阶段，不能直接用最终过滤后窗口回填。

## 排序类型、转换和 ties

`repeater.js:678–684` 存在 7 种运行时类型。所有类型先取 cell.text；缺失 cell 或 falsy text 视作空串。比较器构建在 `715–771`，排序采用自身 mergesort（698–713），不是宿主 Array.sort。

| 数值 | 行为 |
|---|---|
| 1 Number | 非空文本执行 Number；精确空串变 NaN，纯空白因 Number 变 0。NaN 永远在有效数值后，无论升/降序；两个 NaN 直接返回 0。Infinity 等 Number 可识别值并未在此排除。 |
| 2 Text | 先 toLowerCase，再用 JavaScript 字符串 `<`；不是 localeCompare。大小写折叠后相同才进入次级规则。 |
| 3 Text case-sensitive | 原文本按 JavaScript `<` 比较，区分大小写。 |
| 4 Alphanumeric | `localeCompare` 使用默认 locale 和 numeric=true，未显式指定 sensitivity。locale 返回 0 但原字符串不同时没有正确 tie 分支。 |
| 16 Date YMD | 先按 '-' 切；如果完全没有 '-' 才按 '/' 切；必须 3 段，依次 Number(year,month,day)。 |
| 17 Date MDY | 同一解析方式，映射为 month/day/year。 |
| 18 Date DMY | 同一解析方式，映射为 day/month/year。 |

日期解析（782–830）校验 month>0 且<=12，day>0 且不超过该月天数；闰年按 4/100/400。没有整数、年份范围或有限性校验。实验确认 `2024-2.5-1`、`2024-1-1.5`、空年份 `-1-1`、`Infinity-1-1` 都被标 valid；这不是 Date.parse 语义。日期无效值与数字 NaN 一样固定在尾部，两者都无效直接 0。

只有**类型转换前的 text 相同**才调用上一条规则的比较器；Text 模式先进行了小写折叠，所以其大小写差异也能进入 tie-break。数字/日期转换之后的相等不自动进入次级规则：

| 主键与次级键 | 隔离原 mergesort 结果 |
|---|---|
| A/B/C 主文本都为 `2`；次键 2/3/1 | 主键升/降都按次键得到 C,A,B。 |
| 主文本为 `2` / `02` / `2.0`；次键仍 2/3/1 | 数值虽同，升序 C,B,A，降序 A,B,C；次键被忽略。原比较器在数值相等、文本不同时升序双向 +1，降序双向 -1。 |
| 主文本为不同非数字 `bad` / `no` / `NaN` | 两个 NaN 返回 0，稳定保留 A,B,C，不看次键。若三个文本都为同一个 `bad`，则会看次键。 |
| 日期为同一天的 `2024-1-1` / `2024/01/01` / `2024-01-01` | 日期差为 0，保留 A,B,C，不看次键。 |
| Alphanumeric 文本 `2` / `02` / `002` | 本机 locale 下 collator 认为相等，但升序 C,B,A，降序 A,B,C，忽略次键。 |

mergesort 只在比较值 0 时稳定保留左项；初始排序输入每次都是源 dataset 拷贝，所以“稳定”指源数据顺序，不是上次排序后的屏幕顺序。由于部分比较器不满足对称性，用另一个稳定排序算法也未必得到相同输出。所有 sort 被移除后恢复源 dataset 顺序；没有永久改变源数据。

## 初始化、分页及范围限制

`repeater.js:29–39` loadRepeaters 调用 setDataSet；`60–65` 将 filters/sorts 明确初始化为空数组。对这两个存储对象的本文件写入检索仅找到初始化及 add/remove，没有从 style 或 repeaterPropMap 读取初始规则集合。此结论限定在分发运行时加载路径；没有检查所有编辑器/编译器配置，不排除作者编辑数据顺序已经烘焙进 data。使用 Loaded 动作配置初始规则符合当前证据，不需要臆造独立 style rule 字段。

过滤先于排序，二者完成后才执行分页（136–149、687–690、771–779）。改变过滤/排序均排队 reset，临时行状态按既有生命周期复位，标记不清空；分页只在结果缩水导致当前页过大时向末页修正，不因增加/移除规则必然回第一页。Probe 原始 5 行、页 3/每页 2，过滤 X<4 再降序后为 C/B/A，分页修到页 2、显示 A。新的 filter 依赖变量/This 时应到真正 query 刷新才求值；提前计算会错误捕获同一同步动作段之后才写入的值。

本轮已回答：参数、同名、优先级、组合、求值时点、主要 Item/TargetItem 绑定、类型转换、稳定性、分页和运行时初始化。仍未验证：编辑器 UI 默认 comboType、所有类型的 UI 可选项/名称、编译器对表达式与列名的完整转换、完整 DOM 下失效源控件文本、locale 跨机器差异、所有表达式异常类型、生成器精确刷新伪动作插入位置。嵌套 repeater 属于本产品扩展，不由本轮官方语义保证。
