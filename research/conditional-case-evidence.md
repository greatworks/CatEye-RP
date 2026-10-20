# Axure RP 11 条件 Case 分组证据

日期：2026-10-13。目标版本：**11.0.0.4150**。本次只读官方文档、已提取原型 JS 和少量 PE/CLI 元数据/CIL，没有启动原版 GUI、没有执行目标程序集、没有改产品或测试。标记含义：**观察**是文档或原始字节中的事实；**推断**是静态路径推导；**建议**是本项目选择；**unknown**尚无足够证据。关联研究：[Wait 调度](D:/WSCodex/REA/research/wait-scheduling-evidence.md)。

## 可立即实施的结论

- 条件模式下，每个 owner 的每种 event 有自己的有序 case 列表。首项天然开始一条链；后续 `isNewIfGroup:true` 开新链，false/缺省延续当前链。每条链只选择第一个**启用且条件为真**的 case，下一独立 IF 链照常检查。
- **先用完整列表建立链边界，再跳过 disabled 分支。** 禁用 IF case 不会删除它所建立的链边界；先过滤 disabled 会错误合并两条链。
- 无条件分支等价于 true。在 ELSE 链中它就是兜底 `ELSE IF true`，一旦到达便命中，后续同链分支不可达。
- 命中依据是条件，不是动作是否产生效果。传给运行时的 `actions:[]` 仍占用本链；Wait 也不会让同链 ELSE 获得第二次机会。Wait 后续段不重新判断原 case 条件。
- 官方确认的编辑器默认：**首个 conditional case 是 IF，后续新增默认 ELSE**。新编辑器同事件追加可写 `isNewIfGroup:false`；首项可显式写 true。
- **All/Any 的逻辑运算应短路。** 原型表达式 `&&`/`||` 通过延迟求值的左右操作数实现；禁止先把所有条件 `map` 成结果再 `every/some`，否则本应跳过的错误表达式也会求值。无条件 case 仍需独立判真，不能被 `some([])` 改成 false。

## 官方文档覆盖

| 一手来源 | 观察 | 不足以证明 |
|---|---|---|
| [Conditional logic：多条 IF/ELSE 链](https://docs.axure.com/axure-rp/reference/conditional-logic/#creating-multiple-if--else-chains) | 首 conditional case 默认 IF，后续默认 ELSE；右键 Toggle IF / ELSE 可开新链。链内首次成功后停止后续条件；独立 IF 继续检查。无条件 ELSE 是 true 兜底；All/Any 指全部/任一条件满足。 | 重排、删除、改事件时如何修补 flag；逻辑运算求值副作用。 |
| [Required fields 官方教程](https://docs.axure.com/axure-rp/tutorials/required-fields/) | 在已有条件的 Click or tap 下 Add Case，未添加逻辑时新分支为 `ELSE IF true`。这直接支持同事件追加默认 ELSE。 | 所有 UI 入口、粘贴/复制/拖动 case 的默认值。 |
| [Terms and conditions 官方教程](https://docs.axure.com/axure-rp/tutorials/terms-conditions/) | 同样通过 Text changed → Add case → 不加逻辑，建立默认 ELSE IF true。 | 非条件的多 case 模式是否自动转条件模式。 |
| [Events, cases, and actions](https://docs.axure.com/axure-rp/reference/events-cases-actions/#cases) | 支持 Add case、删除 case、拖动排序；普通多 case 可以显示选择菜单，条件逻辑则自动选分支；事件/case/action 均可 Disable。 | 拖动/删除后的 IF 边界是随对象移动还是留在位置槽；首分支自动重标算法。 |

文档中的“IF 条件总会检查”应结合禁用语义理解；被禁用的 case 在运行时直接跳过。本文不引用社区结论。

## 分发资源身份与静态定位

包：[AxureRP-Setup.zip](https://axure.cachefly.net/AxureRP-Setup.zip)，SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。REA extraction `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`；已有 managed inspection `ev_f0036570d4705d93beb771a90d7eea9390e7ff5b75631e8e3ec92bd8d4aa0788` 为表示预算受限结果，**不能当成完整方法覆盖**。身份记录见 [rea-evidence-summary.json](D:/WSCodex/REA/research/rea-evidence-summary.json)。本轮沿用已提取资源并作定点读取，没有重复巨型分析。

源码目录 `V`：`C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`。以下行号对应未格式化原文件。

| 文件 | SHA-256 |
|---|---|
| V/events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| V/action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| V/expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| Axure RP 11/AxureRP11.dll | `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7` |

| 精确位置 | 观察与推断 |
|---|---|
| events.js:281–282,332–352 | `_handleEvent` 接收当前 `axEventObject`，每次新建 caseGroups/currentCaseGroup。仅当前事件数组参与分组；第一个数组元素即使 flag=false 也属于第一链。后续 truthy isNewIfGroup 才新建组。 |
| events.js:344–352,544–548 | 建组阶段包含所有 case；执行阶段先判断 disabled，再判断条件。因此禁用链首仍保留组边界，但它自身不占用命中。 |
| events.js:365–370 | 顺序调用所有 group；表达式先求 `_handleCaseGroup(...)` 再与 bubble 合并，因此前组命中不会通过短路跳过后组。 |
| events.js:544–589 | 每组按顺序求条件；首命中后 dispatch actions 并直接 return。没有条件视为真；未命中/禁用才看后续分支。 |
| action.js:351–357 | 空 action 数组立即返回；外层 group 仍在 events.js:584 返回“已处理”，所以不会落入同链 ELSE。这里证明运行时对已有空数组的语义，不证明编辑器/生成器一定保留空 case。 |
| action.js:359–367 | Wait 复制事件上下文并 setTimeout，handler立即返回；group已选中。延时继续数组下一动作，不返回条件选择器，不能给同链 ELSE“补跑”。 |
| events.js:593–594；expr.js:85–90 | case 条件直接进入 evaluateExpr；binaryOp 将左右表达式包装成函数，未提前求值。 |
| expr.js:5–6,61–65 | `&&` 与 `||` 先求左侧，只在必要时调用 right；left 为 undefined 的内部特例直接返回 false。支持正常条件短路，不支持“先求所有条件”。 |
| events.js:1701–1710 | 每次合成事件按自己的 eventName 查 interactionMap，再调用 handleEvent；组命中状态不是全局缓存。嵌套触发也有独立组遍历。 |

**跨事件隔离（推断）**：Click、Mouse enter、Loaded 等各自选择分支；不同 owner、重复点击、新的合成事件也不继承上次的“已命中”状态。但是全局变量、控件值等是共享应用状态，前事件修改可影响后事件的条件；“隔离”仅指链选择状态，不是数据事务隔离。现有事件冒泡、禁用控件、suppressedEvent 等前置拦截与分组不同，不能为“跨事件隔离”删去这些规则。

## 新增、删除、重排与改事件

**已观察**：原型 runtime 没有编辑器操作，只依据收到的数组顺序和每项 flag 分组。删除整个 event 的第一项后，新的第一项自然成为隐式链首，不必依靠 flag=true。若删除中部 `IF` 链首，而保留其后 false 分支且不修改任何 flag，这些分支就会接到前一链；这是给定数据变换的运行结果，**不是已证明的编辑器删除行为**。

**CIL 窄查**：通过既有 [静态检查脚本](D:/WSCodex/REA/research/scripts/inspect-rp-serialization.ps1) 的 PEReader/MetadataReader 读取 DLL，没有加载程序集或调用目标方法。MVID `b42b41f0-60a3-4acd-ab71-f504da879900`。

| 定位 | 观察 |
|---|---|
| `Axure.DocumentModel.Interaction.IxCase.get_IsNewIfGroup`，token `0x06009C8B`，RVA `0x007CB274`，IL_0008 | 读取该 case 对象的布尔字段 `WNTa`（field token `0x040047FD`）。raw IL SHA-256 `48fbbf28cba405a5de86faf70b42608d5c34ef3666b644542595a3e5ae76d117`。 |
| `IxCase.set_IsNewIfGroup`，token `0x06009C8C`，RVA `0x007CB284`，IL_0041–0043、IL_005C–0062 | 写入同一字段，随后通知 CaseChanged 路径。raw IL SHA-256 `1b355fb2be95d078a4e2db412c1892c52a944186fb8904f1bc40730c95622e49`。 |
| `jV2z.KV2o.oVh2`，token `0x06002D28`，RVA `0x002F8BFC`，IL_00CC–00D8 | 对选中 IxCase 读取 IsNewIfGroup、与 0 比较取反、调用 setter。这与 Toggle 的语义一致；具体菜单 handler 关联仍为推断。raw IL SHA-256 `34fb1815f5e08c23618ca70b75ee806d2f3eaf76bb6fc05e862e577a0bbde4d5`。 |

可复核窄结果：[conditional-case-cil.json](D:/WSCodex/REA/research/conditional-case-cil.json:326)（SHA-256 `b8f8003d71463982beac5ccbf0df517f147dd0ee4c63f3420b8a19110501a07c`）；[conditional-toggle-cil.json](D:/WSCodex/REA/research/conditional-toggle-cil.json:495)（SHA-256 `ed445d5a7d99952c1b890a734d4e155450517e3ce4ba16deb0f6949b5ce221e9`）。检查脚本按方法 token/IL offset 定位；JSON 行号仅辅助阅读。

**搜索边界**：扫描 DLL 方法体中直接 call/callvirt setter 的字节候选，找到上述一个候选并用完整指令解码确认；字段写入候选位于 setter 及 IxCase 序列化读取路径。没有解析全部混淆的 UI 命令、动态/反射调用和泛型容器操作，不能据“只有一个直接 setter 引用”证明其它命令不会修补边界。

**unknown**：拖动时边界随 case 对象移动还是保留位置槽；删除链首是否将下一项提升为 IF；将 case 改到另一 event 时是否重设 flag；复制/粘贴跨 event 的规则。官方允许删除/重排但不规定这些细节；已查看 CIL 也未覆盖相应命令。两种产品策略都不能标为“原版已验证”。

**建议**：本项目应选一个可说明、可保存/导入、可撤销的规则，并在实现/测试说明中标记为项目约定。若选择随 case 移动且新事件首项归一化为 true，应测试中间 IF 删除、首项下移、ELSE 上移、跨事件迁移；若选择保留位置槽边界，也须明确这是避免隐式合链的设计选择。无论选择哪种，都不应在 runtime 偷改其它 case 的边界。

## 本项目模型与旧文档兼容建议

拟用 `Interaction.isNewIfGroup?: boolean` 足够表达原型链边界，不需要单独存 ELSE 枚举：是否首项/flag决定 IF 或 ELSE IF，无条件决定 true 兜底。`enabled`、conditions、actions 是独立属性。

- 新建事件首 case 显式 true；同一事件追加 false；用户选择新 IF 时设 true。
- 同 owner 的同 event 内排序，再分组；即使 flat interactions 数组中夹有其它 event，也不能让它们共享链命中状态。
- **旧 `.rea.json` 缺省 true 是项目兼容规则**，用于保留历史“每 case 独立”的行为。建议读取时规范化或保存时写明布尔，不能把它称为原生默认。
- **原生 Axure 生成 JSON 缺省是 falsy、延续当前链**。原生导入需要按原生语义转换后显式写值，不能无条件套用旧 `.rea.json` 缺省 true。
- 启用/禁用不改变 flag；删除全部 condition 表示无条件 true。All/Any 对非空条件集按顺序短路，条件集合为空时的模型表示需归一为无条件 case。

## 无条件多 case 菜单：原条件链阶段的后续入口

后续阶段已实现菜单和设置，新的调用路径、边界与当前实现说明见 [Case selection 证据](./case-selection-evidence.md)。以下保留原条件链阶段的定位依据。

官方介绍无条件多 case 的选择菜单。实际调度分支在 `events.js:333–374,432–500,528–541`：

| 配置与数据 | 运行时观察 |
|---|---|
| 调用传入 skipShowDescriptions=true | `333` 直接绕过菜单判断，自动执行链；配置无权覆盖这一调用级绕过。 |
| linkStyle=`alwaysDisplayTargets` | `_shouldShowCaseDescriptions` 首先返回 true。无条件事件显示逐 case 选项；有任何 condition 的事件则显示组合说明，点击后以 skip=true 重新执行整个条件事件。 |
| linkStyle=`neverDisplayTargets` | 返回 false，直接按链规则执行。即使全无条件，也不是自动把所有 case 无差别执行。 |
| 其它/默认配置 | 0 case 不显示；只要任一 case 有 condition 就不显示；否则启用 case 至少 2 个才显示。`_isEventSimulating` 检查 condition 时**没有过滤 disabled**，故禁用的有条件 case 也会影响是否进入菜单。 |
| 无条件菜单选项 | `events.js:443–445` 过滤 disabled；点击某一项在 `467–469` 仅 dispatch 该 case 的 actions并关菜单，不执行全部独立 IF 链。 |

不能仅根据“conditions 数组非空”猜测配置枚举的正式默认名称；本次只确认两个显式字符串及其它值的 fallback。本轮条件链实现若不支持选择菜单，应在限制中明确列出，不能以“所有无条件 case 自动执行”代替原版菜单并声称相同。

## 建议回归与完成状态

| 检查 | 预期/证据边界 |
|---|---|
| IF 真 → ELSE IF 真 → ELSE；下一 IF 真 | 只执行第一和下一独立 IF。运行时明确。 |
| IF 假 → ELSE IF 假 → 无条件 ELSE | 只执行兜底。运行时明确。 |
| disabled IF 真 → ELSE 真；前链已命中 | ELSE 仍属独立新链，可以执行。运行时明确。 |
| IF 真但 actions=[] → ELSE | ELSE 不执行。运行时明确；原编辑器是否保留空 case unknown。 |
| IF 真 → Wait 0 → 后动作；同链 ELSE、后独立 IF | ELSE跳过，独立IF先同步检查，计时器恢复原续段。运行时明确。 |
| All：首项false、后项错误；Any：首项true、后项错误 | 后项不求值。表达式运行时短路明确；不通过“先map全部结果”实现。 |
| 不同事件/owner/重复触发 | 命中状态独立；共享变量仍实时影响条件。 |
| 新增、toggle、Save/Open | 官方新增/Toggle语义已支持；旧文档迁移必须独立验证。 |
| 首项/中间IF删除、重排、改事件 | 检验本项目所选规则并明确非原生行为实证。 |

本轮已回答运行时分组、默认新增、禁用、空动作、Wait、跨事件及短路；重排/删除/改事件的原编辑器自动修正规则仍为 unknown。由于并行 worker 配额已满，独立文档子任务创建被拒，本轮顺序完成检索，没有重复尝试 GUI 捕获或扩大目标执行。

## 独立重建的整合验证

共享运行时现已按事件维护链选路状态，保留禁用 IF 的边界，命中后跳过同链条件与动作；All／Any 已改为短路。页面快照帮助函数改为一次派发整组事件，避免逐 Case 执行丢失链。29 项针对性测试覆盖模型保存/克隆、非法标记、模块与序列化 VM、逐行加载、页面/控件加载、等待和条件短路。分组修复前 16 项失败；追加短路场景在修复前另有 4 项失败，修复后全部通过。

5 项浏览器场景在开发版和生产版均通过，实际操作 Inspector 新增/排序/复制/改事件/删除首分支，下载保存后重开，并分别运行预览和断网 `file://` 导出。最终完整回归为 181 项单元测试、开发/生产各 33 项浏览器测试；旧中继器用例改用 New IF 明确创建独立动作，原有结果断言保持。最终 Windows EXE 也通过真实 UI 新增条件链、原生保存重开和预览首命中检查，以及既有 RP/图片导入检查。截图 `artifacts/conditional-case-editor.png` 已检查。验证的是本应用在上述范围内的实现，不是原版 GUI 差分认证。完整发布回归结果与最终包摘要见 `release/verification.json`。
