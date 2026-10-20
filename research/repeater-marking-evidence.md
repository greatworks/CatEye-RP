# Axure RP 11 中继器标记行证据

日期：2026-10-13。目标：Axure RP **11.0.0.4150** 的已提取分发 JavaScript。范围为标记目标、集合生命周期、Marked 更新/删除、表达式行上下文。未运行厂商完整应用、原型浏览器、DLL 或生成器；未修改产品源码或测试。

本报告的“静态”表示直接读取原文件并沿调用关系推导；“隔离验证”表示只执行 SHA 固定的指定函数，显式替换 DOM/表达式求值等依赖。后者不是完整 Axure 浏览器行为实测。总体刷新顺序另见 [repeater-lifecycle-evidence.md](repeater-lifecycle-evidence.md)。

## 可实施合同

1. 标记是 **repeater 实例 × 数据行身份** 的独立集合，不是控件 selected/checked，不应随行 DOM 重建清空。初始为空，重复 Mark 幂等，Unmark 不在集合的行无效果。
2. Mark/Unmark 的 **This** 取事件源所在行；**All** 是整个当前数据集；**Rule** 扫描整个当前数据集，包含筛选掉或分页隐藏的行。不要用当前可见行下标实现这些目标。
3. 标记操作只改变集合，**不排队刷新、不重跑 Item Loaded、不自动勾选控件**。原版标记入口也没有数据操作的刷新中屏蔽条件，因此 Item Loaded 内标记自身可以执行。
4. 排序、筛选、翻页、每页数量变化和普通 reset 保留标记。添加行不自动标记新行；更新行保留标记。删除行清除该行的标记，并让余下标记继续指向原有数据行。产品用稳定 row ID 集合可表达此正常路径，不必复制原版的数组位置编号。
5. **Update Marked / Delete Marked** 使用整个标记集合，包含当前不可见行；随后按普通数据操作刷新。原版 Mark/Unmark handler 没有独立 `marked` 分支；产品若提供该快捷目标，应标明它是相当于 Rule(`TargetItem.isMarked`) 的简化。Mark Marked 等于幂等保留，Unmark Marked 清除集合，但这不是已观察的原生专用分支。
6. 正式表达式名称为 `Item.isMarked` / `TargetItem.isMarked`。**当前原版 JS 的 Item 元信息是事件快照，TargetItem 元信息按当前目标即时取得**。同一行事件里 Mark This 后，后续 `Item.isMarked` 仍可为旧值；不能把即时集合查询误称为完全相同的原生语义。若产品选择即时读取，应明确为产品约定。

公开文档确认 `Item` 与 `TargetItem` 都具有标记状态属性，后者用于访问交互目标行；官方教程以 Selected/Unselected 触发 Mark/Unmark This，再用外部按钮 Delete Marked。[Repeater properties](https://docs.axure.com/axure-rp/reference/repeaters/#item-and-targetitem)、[Marking tutorial](https://docs.axure.com/axure-rp/reference/marking-repeater-rows/)。以下持久性与快照细节来自分发脚本，而不是把教程扩写成规范。

## 证据身份与复现

官方分发包 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。既有 REA extraction Evidence：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`；既有 JS analysis parent：`ev_087ede770347fe8367155aa88a600204baf9051bc362979a94a8e1b170d6f432`。本轮没有新建共享 REA 状态会话。

原始目录 `V`：

```text
C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure
```

| 原文件 | SHA-256 |
| --- | --- |
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| variables.js | `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188` |
| sto.js | `c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6` |

[repeater-marking-evidence.json](repeater-marking-evidence.json) 留存 5 个文件的绝对路径、字节数和 SHA，16 个窄源码片段的原始行号，以及 9 项隔离验证结果。JSON SHA-256：`cb43d4b16582964fafa4e49bb58bfe815ee60252de45a88fc75331cfbc2e1e7e`。

[repeater-marking-probe.mjs](repeater-marking-probe.mjs) 先校验五个原文件 SHA，才截取明确行号范围放入限制代码生成的 Node VM；没有加载完整原始模块。脚本 SHA-256：`e98677b9b213ab33bf5c0f601e902f105863a0c07a973b89034da048b45ea016`。从本项目根目录运行：

```powershell
node research/repeater-marking-probe.mjs
```

原提取目录变化时可把同一分发目录作为首个参数。脚本仅写自身旁的研究 JSON。当前结果：`pass=true, probes=9, sourceFiles=5, excerpts=16`。研究脚本和源码证据均不应进入产品包。

## 目标选择与表达式求值

`action.js:1745–1785` 的 handler 名称为 `modifyDataSetEditItems`。`repeatersToAddTo` 决定添加，否则读取 `repeatersToRemoveFrom`。

| 目标 | 直接证据 | 结论 |
| --- | --- | --- |
| This | action.js:1757–1762 | 从 `srcElement` 提取 item ID，再由源 script ID 取得所属 repeater。即使 `data.path` 指向别的 repeater，实际 This 分支仍取源所属 repeater；产品可拒绝不合理跨目标配置，不能静默换用目标的可见 index。 |
| All | action.js:1763–1766；repeater.js:1451–1457 | 枚举 `repeaterToCurrentDataSet.length` 的全部 1-based ID；不取 active/filter/page 列表。 |
| Rule | action.js:1767–1780 | 同样先拿全数据行 ID；逐行暂设 `targetElement`，求值规则，恢复原 target；先收集完所有命中行，再一次增/减集合。 |
| Marked | action.js:1767–1780 | 本 handler 无专门判断，非 This/All 都进入 Rule。传一个裸 `type:'marked'` 不能据此期待原生已标记目标语义。 |

Rule 比较是求值结果 `== "true"`，没有 Update/Delete Rule 的 `toLowerCase()`。本轮没有原始生成 action JSON 证明每一种规则的表达式节点/返回类型，不推广任意字符串或布尔值的强制转换规则。

Rule 扫描时只改 target，不改 source 或 `eventInfo.item`。因此来自行 B 的事件，其 Item 元信息仍为 B；TargetItem 元信息是当前候选行。外部按钮没有有效 Item 时，Item 会回退 TargetItem。Rule 的“选哪些行”阶段是批量快照：某一候选命中不会提前影响随后候选的标记集合。

## 标记集合与刷新生命周期

`repeater.js:13–35` 定义本模块局部 `repeaterToEditItems`，并在首次载入 repeater 时初始化为空。该变量的全部引用只出现在初始化、删除行、更新已标记行、增/减/查询标记函数；刷新、sort/filter/page 代码没有清空它的写入。

| 操作 | 标记结果 | 原文件位置 |
| --- | --- | --- |
| Mark / Unmark | 原地增删，数字 ID 去重；不存在的标记 Unmark 无效果 | repeater.js:1459–1481 |
| 普通 reset | 清的是 selected/disabled 等控件字典，不是标记集合 | repeater.js:73–84 |
| Sort / Filter | 从 current dataset 复制 active dataset 并带原数据序号，再操作 active；标记集合保留 | repeater.js:671–693 |
| 翻页 / 改每页数量 | 改 `repeaterToPageInfo`；标记集合保留 | repeater.js:1015–1068 |
| Add | 将新行追加 local dataset；未写标记集合，故正常新行未标记 | repeater.js:1342–1362 |
| Update | 改指定单元格；未删除标记 | repeater.js:1409–1449 |
| Delete | 删除相应数据行；移除被删行标记，大于被删序号的标记减一以跟随原行 | repeater.js:1364–1407 |
| 页面重新载入 | 新模块/初始化建立空集合，不是序列化到文档里的持久标记 | repeater.js:13–35；推导 |

Mark/Unmark handler 中既无 `_addRefresh`，也无 `_ignoreAction`；该函数直接继续下一动作。与之对比，Add 非空行、Delete 和 Update handler 都明确调用 `_addRefresh`，并有 `_ignoreAction` 防止刷新过程中对同一 repeater 的递归数据操作（action.js:128–140、1793–1839）。因此仅标记不会重置输入、重新执行 Item Loaded 或自动改变 checkbox。若 Item Loaded 用户动作主动 Unmark All，刷新后当然可能改变集合；“刷新保留标记”指引擎本身不清空，而非用户交互不可改变它。

分页/筛选把某行暂时移出显示集合并不删除数据身份，故该行再次出现时仍可读取标记；需要视觉勾选时应在 Item Loaded 显式读取标记恢复相应控件。普通 reset 对控件状态和标记状态有不同生命周期。

## Update / Delete Marked

`repeater.js:1369–1371` 的 Delete Marked 复制标记数组，然后降序删除（1387–1404），避免本次集合变动影响待删列表。删除标记行后相应标记消失；删除未标记的前驱行会调整余下标记位置，使正常下一事件/刷新仍指向原来的行。

`repeater.js:1414–1416` 的 Update Marked 直接读取整个标记数组，按其顺序遍历。原版外层循环是列，内层循环是目标行（1432–1444）；每个值表达式求值时设置该行的 TargetItem，再写入指定单元格。它没有承诺所有值来自同一个不可变数据快照。未指定列保持原样，标记本身保留。

这两个操作不以行 DOM、active filter 结果或当前页为边界。不存在匹配行时 handler 仍排队刷新（action.js:1818–1819、1834–1835）。但同一复杂事件中连续删除后、还未刷新时的旧行编号与 `repeaterDeleteMap` 有额外语义，不能把正常路径的稳定身份结论扩大成完整旧编号兼容。

## isMarked 命名、Item 快照与 TargetItem

公开名称 `Item.isMarked` 与 `TargetItem.isMarked` 均可用于表达式。[官方属性列表](https://docs.axure.com/axure-rp/reference/repeaters/#item-and-targetitem)。生成运行时的字段名为小写 `ismarked`（doc.js:342），并非 `isMarked` 或 `marked`。`variables.js:34` 小写化变量名，`sto.js:145–160` 直接读取生成 STO 的 `prop` 字段。本轮未检查生成器将所有用户大小写形式规范化的规则；只确认正式拼写和 runtime 内部键。

元信息的明确调用链：

1. `doc.js:293–294` 建事件时取得 `thiswidget` 和 `eventInfo.item`。
2. `_getItemInfo` 在 `doc.js:328–345` 创建新的普通对象；342 把当前 membership 布尔值赋入 `ismarked`，它不是 getter。
3. `variables.js:62` 读取 Item 时优先返回已存的有效 `eventInfo.item`；63 读取 TargetItem 时重新调用 `_getItemInfo(targetElement)`。
4. Mark/Unmark 只改集合，不更新事件对象中的 Item。于是初始未标记行 B 的同一事件执行 Mark This 后，Item.isMarked 仍为 false；若后续求值的 target 正是 B，TargetItem.isMarked 为 true；下一个新事件的 Item.isMarked 为 true。隔离验证直接复现了这三项结果。

这条快照规则针对 **Item 元信息**。数据列走 `sto.js:116–125` 与 `repeater.js:1291–1309` 的独立实时数据读取路径；不要据此把 Item.ColumnName 也冻结。数据列还允许 source 不具有该列时回退 target，因此也不应将它与元信息变量混为同一个无差别字符串替换器。

筛选刷新会另行设置候选 target、filter 创建源及重新取得 source Item（repeater.js:935–940），最后还原原上下文（856–859）。这不是 Mark Rule 只改变 target 的同一实现；本轮不要求复制全部筛选源继承细节。

## 隔离验证覆盖和未知

九项验证：All 的完整枚举/幂等、This 取源所属 repeater、Rule 批量收集/target 恢复/Item 保持、Item 与 TargetItem 快照差异、外部 Item 回退、Mark 无裸 Marked 专用分支、Update Marked 保留集合、删除未标记前驱仍跟随原行、Delete Marked 删除完整目标并清除集合。

限制：DOM、布局、完整事件调度、生成表达式类型和浏览器原型都未运行；sort/filter/page 的标记保留由局部变量的全部读写位置和调用路径静态确认，没有把模拟排序当作厂商函数验证。没有证明任意嵌套 repeater、共享 dataset 切换、跨 repeater 非法 This、同事件多次删除旧编号、Wait 续段、页面返回缓存和 malformed action 的完全行为。产品的安全边界和稳定身份可以更严格，但不要宣称这些未知情形已兼容。
