# Axure RP 11 Wait 调度静态证据

调查日期：2026-10-13。范围：官方文档、已提取的官方分发包内原型脚本模板。未运行原版 GUI/原型，未修改产品或测试代码；下文的执行结果均为静态调用路径推导，不冒充原生浏览器实测。它补充 [repeater 生命周期报告](D:/WSCodex/REA/research/repeater-lifecycle-evidence.md)。

## 决定实现架构的结论

1. **Wait 是动作链的异步切分点，0 毫秒也调用 `window.setTimeout`。** handler 安排后半段后立即返回；没有 Promise、没有阻塞同一事件的其它独立 case group，也没有阻塞页面/控件/行初始化。延时到期只是重新 dispatch 原动作数组的下一项，不重新检查原 case 条件。来源：`action.js:351–367`。
2. **后续独立 case 的条件在轮到该 group 时同步计算。** 它能看到前面 case 在 Wait 之前的同步修改，不能看到尚未恢复的 Wait 后修改；同一 if/else group 只执行第一个启用且命中的 case。来源：`events.js:344–370,544–589`。
3. **正常 repeater refresh 的同步栈不跨 Wait 保留。** Item Loaded 遇 Wait 后继续该行子控件 Loaded、其它行，再调用 refreshEnd；延时续段恢复时，对该 repeater 的同步自修改屏蔽已经解除。Page Loaded 的 Wait 同样不阻塞通用 Loaded 和初始 repeater refresh。来源：`repeater.js:342–374`、`init.temp.js:248–251`、`action.js:128–136`。
4. **Wait handler 自身没有 flush repeater。** 原生依赖生成的 `refreshRepeater` 伪动作、case group 补偿和外层事件尾兜底。延时 callback 只显式 flush resize/move。给本项目的每个同步段统一增加 repeater flush 可以是合理实现约定，但目前不能称为完整复现生成器的精确插入位置。来源：`events.js:340–399,567–589`、`action.js:365–367,1974–1996`。
5. **延时上下文是混合语义，并非所有数据 snapshot。** 全局变量、动作局部表达式、This/Target 控件读取通常在恢复后求值；Item 显示元信息沿用事件对象，Item.Column 则经源/目标行 ID 查询当前 dataset。删行后没有找到取消旧 Wait 的协议；不应伪造稳定行 ID 或自动取消的原生保证。

## 来源身份、hash 与行号

官方包：[AxureRP-Setup.zip](https://axure.cachefly.net/AxureRP-Setup.zip)，已核对版本 **11.0.0.4150**。包 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。REA extraction：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`；已有 JS parent Evidence：`ev_087ede770347fe8367155aa88a600204baf9051bc362979a94a8e1b170d6f432`。详见 [来源摘要](D:/WSCodex/REA/research/rea-evidence-summary.json)。本次为直接只读源码分析，没有新建 REA 分析记录。

本文 `V` 表示以下绝对目录；所有 `文件:行号` 都对应原始文件，未格式化或改写，hash 于本次重新计算：

`C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure`

| 文件 | SHA-256 |
|---|---|
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| init.temp.js | `0f6c77f52d3e1fcb5e3c8590b2d4be324af66832255a6d2385f7c01a5841a6bb` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| variables.js | `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188` |
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| sto.js | `c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6` |
| utils.temp.js | `ef33a9174ea5b4cdcd48229f896195d2f67941116aa7eeae6308a99e02b4832f` |

官方 [Wait 文档](https://docs.axure.com/axure-rp/reference/actions-list/#miscellaneous) 只承诺在后续动作前等待指定毫秒数，没有定义跨 case、初始化、0 毫秒、删除源行或导航时的取消语义。官方 [repeater 文档](https://docs.axure.com/axure-rp/reference/repeaters/#repeater-specific-events) 说明逐项 Item Loaded，不足以证明异步尾段按行完成。下面更细的规则来自此特定分发版本的静态路径。

## 调度、条件与初始化的精确路径

| 问题 | 实际路径与结论 |
|---|---|
| Wait 0 | `action.js:359–367` 无 0 特判；先 eventCopy，调用 setTimeout，回调重新设置 now、清除 resize/move 收集状态，dispatch 下一动作，然后 flush resize/move。0 仍需当前 JavaScript 调用栈退出才可恢复，不能实现成同步 no-op。 |
| 同一事件多个 case | `events.js:344–363` 只分组并扫描 refresh 伪动作；未预先求值全部条件。`365–370` 同步逐 group 调用。`544–548` 到达每个启用 case 时才 evaluate condition；命中后 `583–584` dispatch 然后返回，余下 else 分支不运行。 |
| Wait 后条件是否重测 | callback 直接进入 `dispatchAction(infoCopy, actions, index + 1)`，不回到 `_handleCaseGroup`。故事件触发时通过的条件即使已变假，续段仍继续。若后续动作自身带规则/表达式，则该动作执行时独立求值。 |
| Page Loaded | `init.temp.js:248–251` 先 `loadDynamicPanelsAndMasters()`，再 `initRefresh()`；`events.js:1944–1946` 先 page 事件再遍历容器。Wait 返回即继续这些同步调用，因此不能 await 整条 Page Loaded 动作链完成才加载子控件/repeater。 |
| Item Loaded | 正常刷新先入栈 `repeater.js:98`；`342–356` 逐可见行执行内部 onBeforeItemLoad → onItemLoad → 子控件 Loaded，`374` 出栈。事件派发本身同步（`events.js:1701–1710`）。每行 Wait 都只是排定独立续段，不能 await 某行尾段再派发下一行。 |
| 自刷新保护 | `action.js:129–136` 按当前同步 refresh 栈判断；行增删改的 handlers 在 `1800,1817,1832` 调用它。Wait 后该次正常 refresh 已结束，自操作可能触发新一轮 Item Loaded，不能把“永远忽略 Item Loaded 的行修改”当原生规则。 |

可用于实现回归的确定性例子（无其它嵌套事件）：group A 执行 `Count=1 → Wait 0 → Count=2`；后面的独立 group B 条件为 `Count==1`。B 在当前事件同步阶段命中，A 的后半段在稍后的 timer task 才把 Count 变为 2。若 B 又把 Count 变为 9，A 的原 case 条件也不会因此重测。相反，A 同组的 else case 不应执行。

两行初始化可确定的偏序是 `ItemLoaded(A)同步前缀 → ChildLoaded(A)同步前缀 → ItemLoaded(B)同步前缀 → ChildLoaded(B)同步前缀 → refreshEnd → 已排定timer有机会恢复`。**不承诺所有延时段的总完成顺序或准确毫秒到达时间**；多次 Wait 会进一步拆分，计时器节流/浏览器调度也不在这份源码控制范围内。

## Wait 前后 pending refresh 的处理

- 行数据操作立即写 dataset，并用 `_addRefresh` 去重排队，然后同步 dispatch 后续动作：`action.js:139–140,1793–1838`。
- 若生成动作列表中在 Wait 前已经有 `refreshRepeater`，该伪动作在 `1974–1992` 取走队列项并同步 refresh，完成才 dispatch 下一动作。因此它可以在 Wait 之前完成初始化与状态重置。
- `events.js:354–360` 和 `567–581` 只统计第一个 Wait 之前的 refresh 伪动作。条件未命中/分组选路时还尝试补偿刷新，不把 Wait 后伪动作算作当前同步阶段保证。
- Wait handler 本身不刷新；它返回后其它 group 继续。`events.js:394–399` 是外层事件结尾兜底：先 flush resize/move，取出、清空 repeater pending 列表，再逐个 refresh。没有更早伪动作/嵌套事件影响时，Wait 前遗留 pending 会在这里刷新，早于 0 毫秒 timer 恢复。
- 回调尾只有 `action.js:366` 的 resize/move flush，没有再次运行 `events.js:397–399`。Wait 后的原生生成动作应依赖其后续 refresh 伪动作；若人工动作数组缺失这些伪动作，不能从源码推导出 timer 尾一定有 repeater refresh。
- 这意味着“每个 Wait 都立刻 flush pending，随后才评估下一 group”不是源码已证明的规则；它可能改变下一 group 对 DOM/Item.index 的观察。精确刷新伪动作由生成器何时插入，仍是 unknown。

## 延时数据：live、上下文与缓存分别看待

| 被读对象 | 静态证据与语义 |
|---|---|
| 全局变量 | `variables.js:33–44` 从当前 `_globalVariableValues` 读；没有 Wait 时全变量快照。 |
| 动作表达式/局部变量 | `expr.js:204–218` 每次替换表达式时重新求局部变量值。若局部变量绑定一个控件，`expr.js:712–713` 当次调用 getWidgetInfo。不是 event 开始时固定全部 local values。 |
| This、Target 控件 | `variables.js:61,65` 用保存的 elementId/targetElement 新建 widget info。`doc.js:449–477` 在首次读取该 info 的文字/坐标等属性时从当前 DOM 查询，再缓存于该 info；`expr.js:586–589` 控件文字函数也直接读取当前 DOM。故普通后续动作看到当前控件值，但保留了 widget-info 对象的特殊表达式路径不能笼统称为“永远无缓存”。 |
| Item.index、isFirst/isLast、isEven/isOdd、isMarked/isVisible | 事件创建在 `doc.js:294` 记录 Item；`328–345` 构建当时显示属性；`variables.js:62` 返回保留的 eventInfo.item。Wait callback 没有重建它，因此排序/过滤刷新后旧事件 Item 的显示元信息可能仍是旧值。 |
| TargetItem 元信息 | `variables.js:63` 根据当前 targetElement 重新 getItemInfo，与保留的源 Item 不同。 |
| Item.Column / TargetItem.Column | `sto.js:116–125` 从源/目标 elementId 取 repeater ID 和源数据行号，交给 `repeater.js:1291–1308`。优先同事件 delete map 的原行，否则查当前 dataset；不是从 eventInfo.item 对象保存整行数据。 |
| now / window / cursor 等 | Wait callback 只明确重置 now 与 resize/move 收集器（`action.js:363–364`）。window、cursor、keyInfo 在 `doc.js:285–295` 记录，不能把它们无差别改成恢复时的全新事件。 |

**eventCopy 实际实现异常需要保留证据边界。** `utils.temp.js:28–33` 名为 eventCopy，调用带过滤参数的 deepCopy；但 `42–47` 的过滤条件实际写成 `filter.indexOf[key] != -1`，不是函数调用 `filter.indexOf(key)`。对普通 event 字段，前者为 undefined，与 -1 不等，走直接赋值，因此常规顶层对象字段被共享。Wait 只得到新顶层对象，并不是可靠的深快照。这个观察来自原字节，不应按注释或函数名自行“纠正”后再宣称原生行为。也未确认最终生成器是否转换该 `.temp.js` 片段；需真实原生导出文件核验。

## 删除源行、刷新和导航

**删除源行并没有直接取消其 Wait。** `action.js:359–367` 不保留 timer handle，dispatch 入口 `351–357` 只检查动作索引；`repeater.js:1070–1077` 删除旧行 DOM/状态，`1364–1407` 删除 dataset 行，都没有取消 Wait 的调用。全目录非 minified JS 搜索 `clearTimeout` 仅命中 axQuery 排队和 style 禁用延迟，不与这个 Wait handler 关联。此结论限于已检索的 runtime 路径，不能推断任何未见宿主逻辑。

同一同步事件内，删除 map 保存删掉的行并修正后续行偏移（`repeater.js:1318–1340,1397–1399`），所以紧接 Delete 的 Item.Column 仍可读取该事件保存的数据。但 refresh 在 `repeater.js:108` 清除该 repeater 的映射。若 Wait 副本共享已有 map，该删除也会对它可见；若删除发生在其它事件，旧延时 event 本来就没有那份新 map。

原生行 ID 取当前 dataset 的 1-based 位置（`repeater.js:671–675,776–779`），不是稳定数据 ID。**静态风险推导**：删除刷新后，旧延时源 ID 可能对应补到该位置的另一行；若位置已不存在，`1298–1301` 的读行可能失败。表达式替换处有异常回退（`expr.js:217–220`），不同动作的最终表现未执行确认。没有足够证据承诺“旧行 timer 自动取消”“始终读取被删行快照”或“所有剩余动作安全 no-op”。本项目按稳定 ID 隔离/取消失效行续段应明确列为防错选择，不能冒充已验证的原生一致性。

**导航也不是 handler 中的同步 return/end-chain。** `action.js:400–448` 调用 reload/back/navigate/linkFrame 后，在 `448` 继续 dispatch 下一动作；Close Window 在 `384–386` 也继续 dispatch。`doc.js:768–805` 的 new/popup 调用 window.open；current/parent/parentFrame 改对应 location；frame 设置 iframe src。没有统一取消 Wait 队列。

据此可分开处理：新窗口/popup 不会因这段代码销毁当前页；当前页发生真正 document 卸载后，旧环境不能再像 SPA 同实例那样持续操作新页。页面世代/dispose 取消可用于模拟后者，但“调用 Open Link 立即停止同一同步段的剩余动作”不是静态源码结论。浏览器导航提交前的 timer 竞争、同文档 fragment、失败/被阻止导航、beforeunload 等情形均未原生实测，不对竞态结果作保证。

## 明确 unknown 与建议验证

- 精确生成器插入 refresh 伪动作的位置；尤其 Wait 前后的 DOM 可见时机与跨 group 保证。运行时兜底不等于插入算法。
- `.temp.js` 最终生成处理、eventCopy 异常是否原样存在于正式生成的资源、选 case 描述弹窗模式的独立调度。上述 case 结论针对普通自动执行路径。
- 被删行延时读取、过滤后无 DOM 行目标、原生导航提交竞态、多个相同截止 timer 的完整顺序。需要合法可运行的原生导出 fixture 才能把静态推论提升为行为实证。
- 正常非 limbo refresh 的出栈已明确；`repeater.js:98–104` 存在入栈后 limbo 提前 return 的特殊路径，不能用正常路径证明其栈一定平衡。本次不推断这个边界的实际可达性。
- 建议最小回归：Wait 0 不同步；后续 case 条件看到同步前缀；原条件变化不取消续段；Page/Item Loaded 不阻塞后续初始化；全局变量/控件 live 读取；Item 显示元信息与列数据差异；自 repeater 在 Wait 后允许刷新但有循环保护；导航/restart 取消旧页面任务；源行删除的项目明确策略。最后两项必须将本项目策略与未实测的原生边界分开标注。

## 独立实现状态（2026-10-13）

共享预览/离线运行时已改为只排队同步阶段，Wait 通过独立计时器续行。20 项模块/序列化 VM 测试和 10 项真实预览/离线导出场景覆盖同步前缀、独立事件/条件分支、Wait 0、页面与逐行初始化、混合上下文读取、分段回滚、导航及重启。测试证明本应用的行为；原版导出差分仍未完成。

本应用明确约定：同步阶段尾刷新中继器；源 Item.index/first/last/parity 在事件开始时保留，列数据和变量在续行时读取；每段失败只回滚该段；页面切换提交/dispose 取消旧页面任务；已删除的稳定行身份不继续执行尾段。最后三项为产品策略，不能作为原版原子性、删行身份或导航竞态的实证。等待上限为 60 秒，最多同时保留 10,000 个等待任务。IF／ELSE 自动分组随后已接入，参见 [条件链研究](conditional-case-evidence.md)；Case 选择菜单及更复杂 eventInfo 字段仍未实现。

本报告记录静态观察及独立实现，没有把厂商脚本复制进产品实现。
