# Axure RP 11 repeater 生命周期与行操作证据

调查日期：2026-10-13。范围：官方文档 + 已提取官方 RP 11.0.0.4150 分发资源的只读静态分析，没有把厂商实现复制进产品。后续原版启动与菜单观察见 [启动核对](axure-runtime-check.json)，尚未执行其原型预览。下文的“静态”表示调用路径推导，不表示浏览器实测。

## 实现结论

- `Item Loaded` 按当前显示顺序逐行派发；每行顺序为内部 `onBeforeItemLoad` → 用户 `onItemLoad` → 该行子控件 `Loaded`，之后才派发下一行。**Wait 之后的异步续段不保证完成顺序**。
- 普通数据、排序、筛选、分页刷新使用 **reset**：删除旧行 DOM、从模板创建当前页可见行、初始化状态、重跑上述事件。临时输入、选中、禁用、显示/隐藏、移动/尺寸等不应被默认为持久行数据。需要持久化的值应写入 dataset，再在 Item Loaded/数据绑定中恢复。
- 行操作先修改数据并标记待刷新；运行时在生成的 `refreshRepeater` 伪动作处刷新，并有事件结束兜底。**不能断言每条行操作立刻刷新，也不能断言任何生成文件都只在 case 最后刷新**。本次未观察生成器如何放置所有伪动作。
- `Item.index` 是**筛选、排序、分页后的当前页内 1-based 显示位置**；`isFirst/isLast/isEven/isOdd` 据此计算。它不是稳定 ID，也不是永久原始数据行号。

## 官方文档承诺

| 文档 | 可直接支持的语义 |
|---|---|
| [Repeater widgets：Item loaded、dataset properties](https://docs.axure.com/axure-rp/reference/repeaters/#repeater-specific-events) | 首次加载及增删改数据时逐项触发 Item Loaded；从上到下处理。isFirst/isLast 以排序、筛选、分页后的可见行判定；isEven/isOdd 由 index 奇偶决定。文档将 index 简述为 dataset 行号，未充分说明分页语义，需下方静态补充。 |
| [List of events](https://docs.axure.com/axure-rp/reference/events-list/#repeaters-only) | Item Loaded 在首次加载及 dataset 变化时触发；普通 widget Loaded 在 Page Loaded 后。没有完整规定 Item Loaded 与 repeater 自身 Loaded 的相对位置。 |
| [Updating repeater rows](https://docs.axure.com/axure-rp/reference/updating-repeater-rows/) | 当前教程名称是 Edit row data：行内矩形 Click → 目标 repeater → This → 指定 Column1 值；预览仅被点击行的数据变更。 |
| [List of actions](https://docs.axure.com/axure-rp/reference/actions-list/#repeaters) | 动作目录仍称 Update rows；还列出增删行、标记/取消标记、排序/筛选及其移除、分页/每页数量。这是文档命名差异，不是两个独立更新功能。 |
| [Marking repeater rows](https://docs.axure.com/axure-rp/reference/marking-repeater-rows/) | checkbox Selected/Unselected 分别 Mark/Unmark This；外部按钮 Delete Marked Rows 操作已标记集合。 |
| [Paginating repeaters](https://docs.axure.com/axure-rp/reference/repeater-pagination/) | 教程在 Item Loaded 设置页码标签，并说明翻页后标签更新，为翻页重跑 Item Loaded 提供官方示例支持。 |

## 静态证据身份与定位

官方包：[AxureRP-Setup.zip](https://axure.cachefly.net/AxureRP-Setup.zip)。包 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。

REA extraction：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`；已有 JS 分析 parent Evidence：`ev_087ede770347fe8367155aa88a600204baf9051bc362979a94a8e1b170d6f432`。来源身份/版本见 [rea-evidence-summary.json](D:/WSCodex/REA/research/rea-evidence-summary.json)。本次以下细节来自直接读取该提取目录，未新建 REA 分析结果。

`V` = `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`。行号以该原始文件为准。临时提取目录若被清理，可用同一包重新提取并校验：`repeater.js` SHA-256 `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b`。

| 文件入口 | 关键位置与观察 |
|---|---|
| [repeater.js](<C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/repeater.js:73>) | 49–55：初始遍历所有 repeater；73–105：默认 reset、未 ready 延迟、limbo 跳过；136–149：先取排序/筛选结果，再截分页范围；228–311：删除旧项、模板克隆、初始化；329–374：行事件循环；605–625：显示元信息；671–690、770–779：数据快照→过滤→排序→行 ID；1070–1077：旧项清理；1409–1449：更新行。 |
| [action.js](<C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/action.js:128>) | 128–140：刷新栈、防递归、待刷新去重；351–367：同步 dispatch 和 Wait 定时续段；1793–1968：增删改、sort/filter/page 均排队刷新；1974–1996：refresh 伪动作同步刷新后继续下一动作。 |
| [events.js](<C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/events.js:340>) | 340–370、544–588：识别 wait 前的刷新，跨条件组兜底；394–399：事件末尾剩余刷新；805–838：reset 按模板初始化 selected/error/disabled；1701–1710：同步 synthetic event；1833–1838、1930–2014：Loaded 遍历 page/container/widget。 |
| [init.temp.js](<C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/init.temp.js:238>) | 238–256：初始化状态/变量后，先通用 Loaded 遍历，再 `initRefresh`，最后触发 resize。 |
| [doc.js](<C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/doc.js:328>) | 328–345：Item 信息来自所属 repeater 和行 ID；display props 由 repeater 计算；isVisible 用行 DOM 是否存在，非屏幕可见性；390–396：计数属性。 |
| [style.js](<C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/style.js:2348>) | 2348–2356：reset 清 hint/error/selected/disabled 字典；repeater 重建 DOM 同时还原模板表单和面板结构。 |
| [variables.js](<C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure/variables.js:60>) | 60–64：Item 优先使用事件源行，缺失才回退 TargetItem；TargetItem 来自当前 action target 行。 |

## 生命周期、范围与刷新时机

**初始顺序（静态）**：Page Loaded → 通用 widget/container Loaded（含 repeater 自身）→ repeater 初始刷新。初始 Loaded 遍历进入所有动态面板状态，但不进入 repeater 模板；模板子控件 Loaded 留到各行 Item Loaded 之后。因此普通无 Wait 场景：`PageLoaded, RepeaterLoaded, ItemLoaded(row1), ChildLoaded(row1), ItemLoaded(row2), ChildLoaded(row2)`。同级普通 widget 的前后位置依赖对象遍历顺序，不应再额外承诺。证据：init.temp.js 248–251；events.js 1835–1836、1944–1946、1992–2005；repeater.js 342–356。

**隐藏与非活动面板**：初始 repeater 枚举没有可见性过滤；刷新中的 `shown` 仅决定刷新过程临时隐藏/恢复，不阻止行创建/事件；合成事件不受普通交互的不可见阻断。动态面板 Loaded 遍历所有 state。故已放置但 hidden/位于非活动 state 的 repeater 仍会初始加载。**Unplaced/limbo 是另一状态，会跳过**（repeater.js 86–105、225–229；events.js 324、1992–1995）。这是静态推导，尚未用原生导出 fixture 运行核验。

**普通刷新**：可见行指通过 filter 且位于当前 repeater page 的行，不是 viewport 内行。先为全部当前页行重建模板、初始化事件/默认样式，再逐行派发 `onBeforeItemLoad`、`onItemLoad`、子控件 Loaded。排序/筛选触发的是全部结果行刷新，非只处理变动行。无持久化数据写入的临时控件状态会消失。`Item Loaded` 不是仅“一次创建事件”。

**触发器（静态）**：add 非空集合；delete/update（即使规则无匹配也排队）；添加/移除 sort/filter；设置页码/每页数量。Mark/Unmark 只改标记集合，没有 `_addRefresh`。普通 Set Text、勾选、面板切换本身不修改 dataset。自适应 view 变化另走 `refreshAllRepeaters` 的 **persist** 模式，仍重建 DOM/运行 Item Loaded，但保留部分状态字典；不能把它与普通 reset 等同（repeater.js 472–477；adaptive.js 139、148）。

**动作边界（静态）**：数据先修改，待刷新 ID 去重；生成伪动作决定刷新位置。refresh 伪动作执行时是同步的，完成后继续原 case。event 尾还有兜底，条件组存在额外刷新逻辑。Wait 通过 setTimeout 续行，故有 Wait 的 Item Loaded 不阻塞下一行；刷新过程中针对**同一个 repeater**的增删改/sort/filter/page 动作被 `_ignoreAction` 跳过，避免同步递归（action.js 128–140）。延时动作等刷新结束后执行，不能套用这一同步屏蔽结论。

**零行特殊分支**：repeater.js 332–355 对“先前 item count > 0，当前 count = 0”设置单次事件循环哨兵，意在最后一行消失时仍触发一次 Item Loaded。此时没有正常行 ID；空初始数据与该转换不同。该分支使用内部 `getItemCount`，分页边界行为及无行时 Item 属性尚未运行验证，应独立列为待验证边界，不把 Item.index=1 臆造给空行。

## Edit row data / Update rows 与 Item 元信息

更新目标（repeater.js 1409–1449）：

- **This**：从源控件所在行定位，仅更新该行；排序不应令它错指另一数据行。
- **Marked**：遍历标记集合。
- **Rule**：扫描整个当前数据集，包括被过滤/分页隐藏的行；先选中匹配行，再逐指定列写值。全选可表达为恒真规则。本次静态函数未出现独立的 `all` 分支，产品若提供 `all` 应说明是 UI 简化。
- 只更新指定列，其他列保留。每个目标行计算新值时设定 TargetItem；行内源事件的 Item 仍指源行。多列写入是依次执行，不应臆称原子快照计算。删除操作另维护事件内被删行映射，避免同事件后续引用错行。

显示属性（repeater.js 605–625）：可见页按 1..N 连续编号；first 为 1，last 为 N，奇偶同 index。稳定内部行身份必须与显示 index 分开。对不在当前可见页中的行，`setDisplayProps` 直接返回，**不会赋予 index/first/last/parity**；表达式最后如何格式化缺失属性尚未运行验证。过滤规则求值阶段的 index 也不能直接套用“最终显示结果”，因为此时尚在形成结果列表。

独立验收例：数据 `[A,B,C,D]`，排序为 `[D,C,B,A]`，过滤去掉 C，每页 2 条：第一页 D=`(index1,first,odd)`、B=`(index2,last,even)`；第二页 A=`(index1,first,last,odd)`。在 B 行点击 This 更新列，刷新后 B 数据改变、其它数据不变、所有当前结果行事件重跑。若 B 变更排序/过滤键，显示位置/是否出现依新数据重新计算。

## 实现与验收边界

- 本项目此前 E2E 的“临时输入/checkbox/panel 跨 sort/filter 保留”验证了增强行为，**不构成 Axure 默认行为一致性证据**。应改成：刷新前各行隔离；刷新后临时状态复位；写入 dataset 的值通过绑定/Item Loaded 恢复。
- 建议用两个以上行记录事件日志，同时断言排序/过滤后的 index、This 更新、全体/规则更新、隐藏行数据更新、未指定列保留、带引号和 `[[...]]` 的字面数据无额外求值；再分别验证 Wait 与空数据边界。
- 厂商 action.js 多处明确假设 repeater 不嵌套在 repeater 内；本项目嵌套 repeater 是扩展，目前无官方 RP11 一致性证据。
- 精确生成器伪动作插入算法、刷新回调中的复杂嵌套事件、空行事件上下文、adaptive persist 全部状态范围仍未确定。官方教程嵌入示例 `https://1p70pa.axshare.com/` 在本次读取返回认证跳转，未绕过认证，未取得它的生成动作 JSON。以上不确定项不能用社区帖子替代原生证据。
