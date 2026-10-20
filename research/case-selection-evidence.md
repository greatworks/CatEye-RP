# Axure RP 11 Case selection 菜单证据

日期：2026-10-13。目标：官方 RP **11.0.0.4150** 分发资源。研究使用静态读取原型脚本/CSS及官方文档，未执行原版 GUI 或原生导出 fixture；独立实现与测试结果另列于文末。复用 [条件链证据](D:/WSCodex/REA/research/conditional-case-evidence.md) 与 [Wait 证据](D:/WSCodex/REA/research/wait-scheduling-evidence.md)。

## 决定实现结构的结论

- **菜单按元素实例 ID 管理，可以并存。** 新建时只替换 `elementId + 'linkBox'` 对应的旧菜单；同一元素的不同事件互相替换，不同元素/不同 repeater 行可保留各自菜单。不存在已观察到的全局 single-menu 状态。
- **没有发现外点、mouseleave 或 Escape 取消 case 菜单。** mouseleave 只停止冒泡；Escape 的已查路径是退出评论模式。不要把常见的“点击外部关全部菜单”当作原版已证实行为。
- **跳过菜单取决于调用路径，不能只按事件名分类。** 初始化的 Page/master Loaded 直接传 skip=true；widget/container Loaded、ItemLoaded 经 `raiseSyntheticEvent` 时，后者实际硬编码 skip=false。手动 Fire event 即使目标为 Page Loaded，也传 false。
- `always` + 有条件事件显示一项**整个事件及各 case/action 的组合说明**，点击后才执行条件链、求条件；不是供用户强制选某一条件 case 的多项列表。
- 无条件菜单点击只运行所选 case；无需等待动作中的 Wait 完成，菜单在同步前缀返回后关闭。原生刷新伪动作、事件上下文及延时读取限制继续适用。
- 正式设置名已找到；**factory default 尚未证实**。新 `.rea` 文档使用 `auto`、旧文档缺省 `never` 是本项目兼容约定，与原生内部字符串分开记录。

以上为静态观察/调用路径推断。生成器最终注入代码、菜单真实浏览器交互及边界竞态仍未执行验证。

## 官方设置、内部值与默认值

官方 [Customizing the HTML output](https://docs.axure.com/axure-rp/reference/customizing-html-output/#case-behavior) 将设置放在 **HTML generator → Interactions → Case Behavior**，入口包括 Publish 中的预览、HTML生成及发布配置。三项正式名称和此版本运行时的对应关系：

| 正式 UI 名称 | 内部字段 | 静态规则 |
|---|---|---|
| Always show case names | `configuration.linkStyle == 'alwaysDisplayTargets'` | 菜单判断首先返回 true；但调用级 skip=true 仍优先绕过。 |
| Show case names only with multiple cases | 已查资源没有独立比较此选项的内部字符串 | 其它值/字段缺省进入 fallback：没有任何 condition 且至少 2 个 enabled case 才显示。 |
| Never show case names | `configuration.linkStyle == 'neverDisplayTargets'` | 自动执行条件链，不显示菜单。 |

文档解释默认多 case 模式会由条件逻辑自动选择分支；never 且无条件时描述为执行首 case。这与普通单链的数据一致；人为设置多条独立 IF 时，以 runtime 的逐组规则为准。这里没有把文档简述扩大成“永远只执行数组第一项”。

**默认值边界**：上述文档没有明确标注新建 generator 的出厂选项。已提取 Prototype_Files 只找到两个特殊值比较，没有找到给 `configuration.linkStyle` 赋初值的生成配置；DefaultSettings 中本次没有匹配的 JSON/XML/INI/config 文本可直接佐证。官方截图有配置示例，但本次未据示例断定工厂默认。因此可确认的是 **runtime 缺省行为为 auto**，不能替代编辑器 factory default 证据。`auto/always/never` 为本项目自定义枚举，旧 `.rea.json` 缺省 never 为兼容选择。

## 来源身份与 hash

包：[AxureRP-Setup.zip](https://axure.cachefly.net/AxureRP-Setup.zip)，SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。REA extraction `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`；来源身份见 [rea-evidence-summary.json](D:/WSCodex/REA/research/rea-evidence-summary.json)。本轮是提取资源的定点读取，没有重新调用巨型分析。

`P` = `C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files`。以下 `*.js:行号` 默认为 `P/resources/scripts/axure/` 下文件，CSS为 `P/resources/css/`。行号对应未修改原文件；hash本轮重新计算。

| 文件 | SHA-256 |
|---|---|
| events.js | `a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| legacy.js | `aa4f16d4597fb1c9ea9efc1d3c8372a4651d6fb76402bf1fed396bd8537b8e88` |
| init.temp.js | `0f6c77f52d3e1fcb5e3c8590b2d4be324af66832255a6d2385f7c01a5841a6bb` |
| axure_rp_page.css | `595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a` |

## 菜单判定的优先顺序

`events.js:333` 首先判断调用参数 `!skipShowDescriptions`，再调用 `_shouldShowCaseDescriptions`。后者 `528–541` 顺序如下：

1. always 返回 true，never 返回 false。
2. 0 case 返回 false。
3. **任何 case 有 condition** 即视为条件事件，返回 false。这一步没有过滤 disabled。
4. 启用 case 数量至少 2 才返回 true，否则自动执行。

因此 disabled case 不计入数量阈值，但其 condition 可以令整个事件进入条件模式。**无动作但启用的 case 计入阈值**，没有 action 数量过滤；展示时同样保留这种选项。always 下 0 case 虽判定显示，`_showCaseDescriptions` 在 `434` 直接返回，不创建空菜单；所有 case disabled、但数组非空且无 condition 时，则会创建无选项容器，这是静态边界，不建议把空菜单当完整交互验收目标。

## skipShowDescriptions 调用路径表

| 入口 | 传递路径 | 最终进入 `_handleEvent` 的 skip 与推论 |
|---|---|---|
| 普通绑定的 click/hover等控件事件 | `events.js:154–175` | 未传参数，falsy；按设置决定菜单。 |
| 初始 Page Loaded | `1833–1836` → `1932` 将 onLoad设true → `1944` → `1901–1918` | true，始终绕过 case 菜单。 |
| 初始化 master 定义的 Loaded | `1983–1985` → `fireEventForPageOrMaster` → `1918` | true，绕过菜单。 |
| master 实例自身 Loaded | `1986` → `raiseSyntheticEvent` | 后者 `1710` 硬编码 false，可能显示。不要与 master 定义事件合并判断。 |
| 普通 widget、table/menu/tree子项 Loaded | `1965–1972` 或 `1876–1892` → `raiseSyntheticEvent` | 调用方传true，但 `1710` 实际传false；可能显示。 |
| dynamic panel / repeater自身 / layer Loaded | `1990,2000,2008` → `raiseSyntheticEvent` | 同上，最终false；可能显示。 |
| repeater `onBeforeItemLoad`、`onItemLoad` | `repeater.js:351,353` 传true → `events.js:1701–1710` | 最终false；仍受菜单策略约束。内部 before事件是否存在多case由生成数据决定，本次没有建立其具体fixture。 |
| repeater行内子控件 Loaded | `repeater.js:356` → `loadDynamicPanelsAndMasters` → widget Loaded路径 | 最终false；实例行ID不同，对应不同菜单。 |
| selection/text/error等合成事件 | `events.js:1689–1697,1807` → `raiseSyntheticEvent` | 最终false；synthetic标志本身不是菜单豁免。 |
| 手动 Fire event / raised event | `action.js:2153,2168` 直接handleEvent | false；包含手动触发的 Page Loaded。 |
| always条件事件说明被点击 | `events.js:489–490` | true，运行整个条件事件而不再次弹菜单。 |
| proxy/冒泡转发 | `events.js:296,384` | 保留原调用skip，不另行按事件类型重算。 |

**参数名不能代替调用证据**：`raiseSyntheticEvent` 接收 `skipShowDescription`（`1701`），创建 eventInfo 时也传它（`1708`），但最终 handleEvent 的第4参是字面 false（`1710`）。`doc.js:269` 可把该值记入 `eventInfo.skipShowDescriptions`；对整个提取资源搜索只找到这处写入，没有在 handleEvent或菜单判定消费它。上述反直觉差异应明确标为此版本静态实现，而不是推测作者意图。

Loaded遍历和ItemLoaded循环不会因菜单挂起而await用户选择：菜单创建同步返回，初始化继续。若很多行/子控件均有需选择的多case，按此路径可同时出现多个待选菜单；这是源代码推断，尚未原生运行验证。

## 选项与执行时机

**无条件事件**（`events.js:441–475`）：按数组顺序创建每个 enabled case 的 description 文本项；保留空动作case，不看 isNewIfGroup。菜单创建时保存 eventCopy；点击项在 `467` 直接 dispatch 该case动作数组，绕过整组条件选择，只执行选中的一项。随后 `468` flush resize/move、`469` 移除自身ID。动作参数仍在实际动作执行时读取；这不是所有变量/控件值的快照。eventCopy的浅共享异常及Item语义见既有Wait报告。

**有条件事件 + always**（`477–495`）：只有一项组合说明，包含事件description、所有case description和action description；此说明循环没有过滤disabled。点击时 `490` 重新调用 handleEvent(skip=true)，**条件在用户点击时求值**，而非打开菜单时选好。执行阶段仍跳过disabled并尊重IF链。产品若用“Run event”按钮替代冗长说明，该名字/呈现方式应称为项目UI选择，不能当原版逐case选择。

**Wait与刷新**：点击后执行到Wait即返回，所以菜单同步关闭，Wait续段稍后继续；关闭菜单并不取消该计时器。无条件选项callback只显式flush resize/move，没有再次进入通用事件尾的repeater兜底；原生生成动作依赖refresh伪动作。always条件入口会重新走通用handleEvent及其兜底。此区别不应被描述为“用户一选择便重新触发完整原事件”。

## 并存、替换、关闭与导航

| 情形 | 静态事实/证据 | 实现含义与未知 |
|---|---|---|
| 同一元素再次需要菜单 | `events.js:436–439` 只按 elementId+'linkBox' remove旧节点并重建 | key不含eventName；同元素不同event互替。若新事件无需菜单，根本不进入此函数，因此不会因触发新事件自动清旧菜单。 |
| 不同元素同时需要菜单 | `498` append到body；`legacy.js:25–35`仅提高该节点z-index | 支持collection。不能在打开B时无依据清除A。 |
| 选择无条件项/运行条件事件 | `467–469` / `490–492` 正常回调尾按ID移除 | 关闭在同步动作前缀返回之后，不等待Wait。源码不是finally；异常时的清理不能据此承诺。 |
| mouseleave | `497` 调SuppressBubble；`legacy.js:14–22`仅阻止冒泡 | 不关闭菜单。 |
| body外点/Escape | 全提取资源查intcases/linkBox只见创建、同ID替换、点击后remove；相关document/body处理未发现清理。`events.js:1517–1518`的Escape发exitCommentMode | 没有正面取消证据；增加外点/Escape关闭或Cancel按钮应明确为本项目便利功能。生成HTML内联注入未覆盖，不能绝对声称所有输出均无取消。 |
| repeater刷新/源行删除 | 菜单为body直接子节点；`repeater.js:1070–1077`只删除行容器/状态 | 没有源行到菜单的清理映射；可能留下悬空菜单。原生最终表现unknown。产品按稳定rowId使失效菜单清除/不可选可作为防错偏差。 |
| 当前文档导航/刷新 | `doc.js:768–805`修改location，真正卸载销毁旧document | 用page generation/dispose清理所有旧菜单可模拟生命周期；导航尚未提交/失败/同文档hash等未验证。 |
| 新窗口、popup、iframe导航 | `doc.js:773–789`改变其它目标，未清除当前页菜单集合 | 不能把任何navigate都等同当前文档销毁。所选菜单仍因选项callback正常收尾关闭，其它元素菜单没有对应清理。 |

还有一个静态边界：选项的清理按ID而不是持有的旧DOM引用；若动作同步又为同一元素建立新菜单，旧callback末尾可能连新菜单一并删除。该重入边界未原生验证，不应引入复杂行为并声称保证一致。

## 位置与视觉依据

- `doc.js:275–282` 记录触发时cursor坐标；body为relative时作水平偏移校正。合成事件没有新的鼠标事件时可沿用全局最后鼠标位置，不能凭事件名猜测应定位在控件下方。
- `events.js:502–514` 将菜单放在 `eventInfo.cursor.x/y`，按 `innerWidth+scrollX` / `innerHeight+scrollY` 的右/下边缘留5px。没有显式左/上边界clamp；大菜单可能得到负坐标。
- `516–522` 显示并抬至前景；页面自适应样式宽度为0时设nowrap并取消max-width。位置计算在这个样式调整之前，最终尺寸变化的精确表现未实测。
- `axure_rp_page.css:89–118`：absolute定位、白底、Inter 12px、1px浅灰边、4px圆角、阴影；一般max-width250px、pre-wrap；每项3px/8px内边距、5px外边距，hover浅灰。节点是div，不带role、tabindex或菜单专用键盘处理；无障碍增强应按项目改进说明。

## 覆盖边界与建议验证

已核对：配置名称/判定顺序、普通/Loaded/ItemLoaded/Fire event调用级skip、选项数量、条件求值时机、不同元素并存、同元素替换、Wait收尾、位置与CSS。未确认：factory default、fallback正式内部字符串、最终生成HTML可能注入的外点关闭逻辑、原生菜单交互、异常/重入/源行失效及导航竞态。

建议本轮分别测试：auto阈值和disabled条件影响；always单条件入口；Page初始化与widget/ItemLoaded不同路径；两元素菜单并存、同元素不同事件替换；选择空动作/Wait；菜单打开后变量变化再运行条件；导航/restart清理。outside/Escape取消与删行防错若实现，应在测试名称/交付说明中明确是项目约定。

## 独立实现与复核结果

已实现严格可选 `Document.caseSelection`、Project → Prototype settings、预览/离线共用调度器及菜单样式。运行会话保存多个菜单，按 sourceId 与完整稳定行上下文替换同源项，令牌在选择/取消/导航/dispose 后失效。页面初始化绕过菜单，控件/Item Loaded 与显式触发事件使用配置；不会等待用户选择而暂停页面初始化。

一次独立复核发现 always 条件菜单最初在选择时重建了 Item 显示信息。现已传递打开时的 frame，条件和动作中的 Item.index 等使用触发快照，变量与数据列仍实时读取；排序并更新列后选择的 module/serialized × conditional/unconditional 四项回归已覆盖。

再次核对 `events.js:154–178,750–791` 确认普通 DOM 事件绑定不按 Case.disabled 过滤，`HasClick:1828–1830` 也只查 interactionMap.onClick。已移除本应用 runtime/UI 的 enabled-only 事件入口门禁，保留控件本身的 disabled 保护；Always 全禁用无条件事件有可取消的空菜单，有条件事件仍有 Run event、执行时无分支。生成器最终是否移除全禁用事件尚未实测。

45 项针对性单元检查覆盖策略边界、旧文档、严格输入、直接单项选择、条件实时求值、显示快照、并存/替换/取消、空菜单、加载路径、Wait 和失效源，分别执行模块及序列化 VM。无交互的快照帮助函数明确绕过菜单，不返回失去运行会话的选择令牌。

菜单固定定位和上下边界限制、Cancel/Escape、键盘导航与焦点恢复、源行删除清理是项目改进；默认无指针时的 16/80 坐标、简化 Run event 描述也不是原版等价声明。新界面和设置截图在 `artifacts/case-selection-*.png`，已检查可读性。最终浏览器/桌面回归、包内源码比对和 ZIP 摘要记录在 `release/verification.json`；这些检查验证本应用，不替代原版差分运行。

本阶段最终检查：226 项单元测试（含菜单 45 项）、44 项 RP 读取/恢复测试；开发版和生产版各 40 项端到端场景（各含新增菜单/设置 7 项）全部通过。三个最终 EXE 检查通过原生保存/重开、菜单选择和预览、只读 RP 恢复、4 张内嵌图片恢复及离线解码。发布包内全部应用文件与当前源码一致，ZIP 中 EXE/ASAR 摘要与受测目录一致；没有打入原厂资源。
