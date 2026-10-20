# Axure RP 11 中继器分页证据

调查日期：2026-10-13。范围为 RP **11.0.0.4150** 已分发 JavaScript 的只读分析、官方文档，以及隔离执行原函数的小型实验；未启动原版应用、原型或整套厂商运行时。没有修改产品源码或测试。完整实验结果见 [repeater-pagination-evidence.json](D:/WSCodex/REA/research/repeater-pagination-evidence.json)，生命周期背景见 [repeater-lifecycle-evidence.md](D:/WSCodex/REA/research/repeater-lifecycle-evidence.md)。

## 实现合同结论

- 分页状态与数据、排序/筛选、标记集合分开存储。先过滤/排序，再取当前页范围；正常整数页内 `Item.index` 从 1 重新编号。
- 初始页码来自生成文件的自适应属性，**不是运行时始终设为 1**。初始 `itemsPerPage == -1` 表示不限数量；动作设置数量为 `-1` 则变为 `1`。`20` 仅是 Set items per page 动作数值转换得到 NaN 的回退，不能据此声称编辑器或初始化默认数量是 20。
- 原生分页动作类型是 `Value / Previous / Next / Last`；没有独立的 `First / Current` 分支，没有循环翻页。First 可用 Value=1 表达；Current 可用当前页表达式作为 Value。
- 普通整数页遵循边界停留，过滤/删除使当前页过大时退到末页；增加数据、排序、仍有效的过滤不会自动回第一页。更改有限每页数量保留页码，再由刷新修正；不限→有限才设第一页。
- 原版 Number 转换后保留有限小数，**不能无依据统一取整**。部分小数合法进入计算但会产生无效数组索引，详见下表。这是原版实现缺陷边界，不应承诺所有小数配置都能正常渲染。
- 翻页和每页数量动作即使不改变结果仍排队 reset 刷新。临时控件状态随刷新复位；已标记的数据行不因翻页/排序/过滤而取消标记。

## 来源身份与核验

官方包 [AxureRP-Setup.zip](https://axure.cachefly.net/AxureRP-Setup.zip)，包 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。REA extraction：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。沿用既有版本证据，没有再次下载或执行安装程序。

下文 `V` 指 `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`。行号对应这些未修改文件。本轮重新计算并核验了下列 5 项 SHA-256：

| 文件 | SHA-256 |
|---|---|
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| variables.js | `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188` |
| sto.js | `c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6` |

官方 [Repeater widgets：Pagination](https://docs.axure.com/axure-rp/reference/repeaters/#pagination) 说明初始默认显示所有条目；启用分页后可指定每页数量和初始页，初始页默认 1。官方 [Paginating repeaters](https://docs.axure.com/axure-rp/reference/repeater-pagination/) 用 Next/Previous 翻页，并在 Item Loaded 更新页码标签。官方文档没有完整规定小数、NaN、空数据或未刷新动作链的行为，下述边界来自分发代码与隔离实验。

## 精确状态和动作规则

| 入口与原始行号 | 已观察规则 |
|---|---|
| `repeater.js:485–497` `_initPageInfo`；`580–591` `_getAdaptiveProp` | 读取当前 adaptive view 的 `itemsPerPage`、`currPage`，逐级回退默认 map。只有数量与 -1 宽松相等时记录 `noLimit=true`；其余直接复制数量和页码，没有初始化 Number、默认 20 或有效性检查。初始有限页 3 得到页 3；超末页直到 bounds 计算才被修正。 |
| `repeater.js:472–477` 自适应刷新 | 再调用 `_initPageInfo`，故会恢复对应视图已编译的页码/数量，然后 persist 刷新。这与一般翻页后的运行时状态保留不同。 |
| `repeater.js:1015–1042` `setRepeaterToPage` | 不限数量时立即返回。优先用已提交 active 数据长度，无 active 时才用 current 数据。末页为 `max(1, ceil(activeLength / limit))`。Value 执行 `Number`，NaN→1，小于 1→1，大于末页→末页，其他数值原样保留。 |
| 同上 `1032–1037` | Previous 仅当当前页 >1 时减 1；Next 仅当当前页 <末页时加 1；Last 直接设末页。整数端点不循环；小数时前置判断不等于结果 clamp。 |
| 同上 `1038–1039` | `First`、`Current` 这两个字面 type 没有专门逻辑，打印 Unknown type，页码不变。产品若提供这些 UI 项，应映射成 Value，而不是宣称原生存在同名分支。 |
| `repeater.js:1044–1050` `setNoItemLimit` | 删除 `currPage`、`itemsPerPage`，设置 `noLimit=true`。 |
| `repeater.js:1052–1068` `setItemLimit` | 不限→有限先设页码 1；已有限时页码不变。表达式求值期间 target 临时为 repeater。Number 后 NaN→20，<1→1；无取整、无有限性检查、无上限。表达式引擎自身的输入限制需另外区分。 |
| `action.js:1936–1971` | 遍历动作目标；缺失/unplaced 或正在刷新同一 repeater 时跳过。其余调用上述函数后都 `_addRefresh`，包括不限状态的 SetPage、已在端点的 Next/Previous、相同数值。 |

`Number` 转换阶段的例子：`""`、`null`、`false` 转为 0 后下限成为 1；非数字文本和 `undefined` 转为 NaN，分别回退页 1/数量 20。此实验仅验证转换阶段，未声称原版表达式求值器会把任意输入对象原样传至该阶段。有限小数原样保留；Infinity 数量会造成无效 bounds，产品现有拒绝非有限表达式的政策应与原生输入处理差异明确区分。

## 范围、修正和小数边界

`repeater.js:136–149` 先调用 `getOrderedIds` 形成 active 筛选排序结果，再由 `627–646` 计算 bounds。设数量 `L`、页码 `P`、active 长度 `N`：初始 `end=L*P`，`start=end-L`；若 `start>=N`，改页码为 `floor((N-1)/L)+1`，再保证页码至少 1，并重算 start/end；最后 `end=min(end,N)`。**没有对负 start 或非整数索引进行另一次修正。** `getVisibleDataCount` 也调用此函数，因此读取 fallback visible count 本身可能修正页码。

`repeater.js:241–245` 使用 `pos=start; pos<end; pos++` 逐项读取 `orderedIds[pos]`，**不是 JavaScript Array.slice 的整数转换语义**。`605–625` 的 display metadata 同样读取 `data[start+i].index`。隔离原函数实验及等价索引循环得出：

| active 长度 | 页码 / 数量 | bounds / 行索引结果 | 证据限定 |
|---|---|---|---|
| 6 | 1 / 2.5 | `[0,2.5]`，访问 0、1、2，共 3 行 | bounds getter 返回 2.5；若完成正常行注册，public visibleItemCount 取注册数量 3。原函数验证这三行 index 为 1/2/3，但 isLast 全 false，因为比较对象为 2.5。 |
| 6 | 1.5 / 2 | `[1,3]`，访问 1、2，共 2 行 | display metadata 能正常得到页内编号。 |
| 6 | 1.5 / 3 | `[1.5,4.5]`，访问 1.5、2.5、3.5 | 数组读取 undefined；隔离执行原 `setDisplayProps` 抛出 undefined.index。没有运行整套 DOM 渲染器，因此不臆测最终页面外观。 |
| 6 | 2 / 2.5 | `[2.5,5]`，访问 2.5、3.5、4.5 | 同样的无效数组索引问题。 |
| 6 | 3 / 2.5 | `[5,6]`，访问 5 | 可以取最后一行。 |
| 6 | 1 / 1.25 | `[0,1.25]`，访问 0、1 | 两次迭代，不能按 floor(1.25) 处理。 |
| 5 | 1.5 / 2 后 Previous | 变为 0.5；bounds `[-1,1]` | 不做低页码修正，首个数组索引为 -1。 |
| 5 | 2.5 / 2 后 Next | 动作先变 3.5；bounds 阶段修正为 3，`[4,5]` | 上界检查发生在后续范围计算，不是 Next 自身结果 clamp。 |

正常整数例子：5 行、每页 2、当前页 3，过滤到 1 行后退到页 1；过滤恢复后仍页 1。排序不会改变条数，保留当前页但该页可能显示其他数据行。空有限数据的最终页码为 **1**，总页数为 **0**；空无限数据页码/总页数都为 **1**。

**未刷新快照边界**：`setRepeaterToPage` 优先 active snapshot，而 add/delete/update 先修改 current dataset，筛选/排序结果到 refresh 才重算。隔离实验：active=5/current=7、limit=2 时 Last 设页 3，不是按 7 行设页 4。后续刷新只纠正无效的超界页，不自动重做 Last。生成器在哪个动作之间插入刷新伪动作见既有生命周期报告；不能把这个现象泛化到所有编辑器生成的动作链。

## 表达式名称与数据来源

官方 [Dataset objects and properties](https://docs.axure.com/axure-rp/reference/repeaters/#dataset-objects-and-properties) 使用以下规范拼写；分页教程也直接给出 `Item.Repeater.pageIndex`、`Item.Repeater.pageCount`。下表的值来源来自 `doc.js:390–396` 和 `repeater.js:648–669`。

| 面向用户的表达式 | 原生内部键 | 新建 widgetInfo 时的数据来源 |
|---|---|---|
| `Item.Repeater.dataCount` | `datacount` | current source dataset 长度，包含过滤/分页隐藏行 |
| `Item.Repeater.itemCount` | `itemcount` | active dataset 长度，即提交的过滤后总行数，未截当前页 |
| `Item.Repeater.visibleItemCount` | `visibleitemcount` | 已注册行 ID 集合存在时取其 length；否则通过 bounds 得到范围差 |
| `Item.Repeater.pageCount` | `pagecount` | 有限为 ceil(active length / limit)；不限为 1 |
| `Item.Repeater.pageIndex` | `pageindex` | 有限 currPage；不限为 1 |

`doc.js:328–345` 的 Item 信息调用 `setDisplayProps` 并提供 `ismarked`。`Item.index / isFirst / isLast / isEven / isOdd` 在正常整数分页下由**当前页**的位置产生；排序/筛选/分页之外的行未获得这些 display 属性，不是永久源行号。标记身份使用源行身份，不能使用页内 index。

计数在 `doc.js` 中赋为数值，而非 live getter。`repeater.js:330` 在逐行 Item Loaded 前缓存 widgetInfo，`362` 在该批次后清除；`doc.js:320–340` 的 Item.repeater 优先该缓存。因此这批行事件通过 Item.Repeater 看到的计数可为同一快照，不能承诺事件内部每个读取都重新统计 current dataset。

`variables.js:33–34` 仅证明变量入口名 lower-case；`sto.js:145–160` 是直接 `thisObj[sto.prop]` 查属性。内部小写键与文档驼峰名称间由编译输入衔接，本轮未检查表达式编译器的大小写处理，**不能据此声称原生任意大小写都被接受**。本项目可支持规范写法；额外别名需作为自身兼容选择说明。

注意 `repeater.js:594–603` 名为 `getItemCount` 的内部函数并非上述 public `itemCount`。它用 `limit*currPage` 起算，5 行/limit2/page3 时返回 0，虽然当前页可见 1 行；在 `334–335` 用于零行转换事件判断。这一内部偏移不能复制为 public itemCount 的语义，零行转换的全部影响仍未运行原生原型验证。

## 刷新与标记保留

`repeater.js:13–20、29–43` 分开保存标记、过滤、排序、分页状态，初始化才创建空标记数组。普通 reset 在 `73–84` 清临时 selected/disabled 字典；`220–245、1070–1077` 删除和重建当前页行 DOM，不清标记集合。`329–362` 对新当前页逐行派发 Item Loaded 和模板子 Loaded；Wait 续段不阻塞下一行，详见既有生命周期/Wait 研究。

`1459–1480` 的 mark/unmark 仅增删数值源行 ID，去重后查成员身份。翻页、设置数量、排序、过滤、普通刷新不会取消标记；被过滤或移至别页的已标记行仍属于 Marked 目标集合。当前页上 checkbox 勾选状态与标记不同：前者随 reset 复位，后者需显式取消，若需要持久勾选展示应通过 Item Loaded 读取 isMarked 恢复。隔离实验中标记 `[2,5,3]` 在 Page/Limit/NoLimit 操作后保持不变。

删除 `repeater.js:1364–1407` 遍历 current dataset/Marked 集合而非当前页；删除已标记行时移除其标记，删除其他较早源行后对后续存储 ID 减 1。此为原版基于位置的身份维护机制；产品使用稳定行 ID 只要保持同一数据记录的标记身份即可，不应把分页位置当作标记 ID。跨多个删除动作的原生 deleteMap 细节不属于本轮完整验证范围。

## 验证范围与建议回归

JSON 记录了 41 组主场景（初始化 3、Value 8、导航 7、数量 7、小数 7、计数 6、snapshot 2、marks 1），另记录页 1/数量 2.5 下 4 个行身份的原 display metadata。原函数在独立 Node VM 内执行；只注入 literal evaluator、默认 adaptive map、数据与页码容器，未载入应用、DOM、网络或其余原版运行时。索引循环验证的是静态循环的访问结果，不冒充原版浏览器端到端证据。

建议实现回归覆盖：初始指定页；整数边界与无循环；不限与有限互切；数量 NaN/小于 1；删除/过滤后末页修正；恢复过滤不跳页；空数据 1/0 与 1/1；当前页 index/parity；源数据与筛选/可见数量区分；同值动作仍刷新；跨页 mark 与 Marked 更新/删除；已有临时状态 reset；有限小数的有证算术行为及可控错误处理。小数无效索引、编译器属性大小写、编辑器初始每页数量、复杂零行转换、生成器精确刷新位置仍需明确区分，不能凭本轮结果称完整原版分页一致。
