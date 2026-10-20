# Runtime Rotate：接线审查与实施计划

本报告是 runtime-rotate 阶段的只读源码审查。未修改产品、旧测试或既有证据，未运行测试、浏览器、原版程序或打包。所读源码的 SHA-256 与定位保存在同名 JSON。下述“当前行为”来自产品源码；原版 By/To、锚点、方向、动画和事件顺序以研究代理即将冻结的合同为准，不能用当前产品行为替代原版证据。

## 结论

审查起始快照的 `Widget.rotation` 已贯穿保存、适配视图和 React/离线 CSS 绘制，但没有 Rotate 动作、Rotated 事件、表达式 rotation 属性或运动队列。报告写作期间父线程已新增 Rotate action/event/schema/copy；下表模型和 UI 行号指 `.build/before-runtime-rotate/` 的起始快照，JSON 同时记录当前观察版本，避免把正在变化的源码哈希混成旧基线。运行时仍未实现。`engine.ts` 的交互执行委托给 `createOfflineRuntime`，因此应在这个共同核心实现行为，避免为预览和离线分别编写旋转逻辑。

完整增量不只是增加 `apply({rotation})`：非中心锚点会改变位置；原版事件时序和动作队列须与当前 Wait、导航事务、适配视图刷新、repeater 实例生命周期共存。父线程提示的“onRotate 先于几何”“偏移按已旋转局部坐标”“逐目标运动队列及 Move/Resize 合并”在本报告中均作为待绑定精确源证据的实现要求，不是本次重新执行原版后的结论。

## 当前接线地图

| 入口 | 已核对实现 | 对 Rotate 的影响 |
| --- | --- | --- |
| `src/model/types.ts:8-9,88-99` | EventType/ActionType 没有 rotate；Action 有数值 x/y、通用 duration 和 style | 新增独立结构 payload，不能将角度、偏移、方向偷放入已有 Move 字段 |
| `src/model/document.ts:692-738` | action 严格键白名单；duration 0..60000；结构动作使用专属验证 | Rotate payload 应完整验证并仅在 rotate 动作允许，明确旧通用 duration 与新 payload duration 的关系 |
| `src/model/document.ts:269-379` | 克隆先分配 widget/state/action/group/link ID，再重映射 targetId；表达式只处理已有 value 路径 | Rotate targetId 可复用映射；新增 degrees/offset 表达式必须显式重映射实际 Widget token，保留引号文字 |
| `src/model/components.ts:31,102` | 组件使用 clone/remap；实例容器保留自己的几何 | 必须测组件内部 Rotate 引用及外部引用保持，不能只测普通 Duplicate |
| `src/components/Inspector.tsx:50-85,333-380` | 动作列表及默认值集中；目标列表只有真实 widget；Move/Resize 为数值绝对值；Wait 独立 | 增加 By/To、角度表达式、方向、九宫格锚点、偏移表达式、动画/时长；换动作类型清除旧 payload |
| `src/runtime/engine.ts:10-18,79-110` | snapshot 交互也调用同一 core，再 dispose | 无需第二套 Rotate 引擎；异步完成契约必须让 snapshot helper 不提前 dispose 正在运动的会话 |
| `src/runtime/export-runtime.ts:1276-1386` | action 设置 Target 上下文，按 targetContexts 遍历；Move/Resize 即时 patch | Rotate 需单独完成求值、事件、排队、几何提交，不直接复用 Move 的后置事件顺序 |
| `src/runtime/export-runtime.ts:1526-1628,2056` | Wait 不阻塞其它事件；TaskGroup 跟踪延期任务；atomic 管理导航/等待/menu 回滚 | 运动必须独立于全局 Promise 队列；不能 await 动画而锁住整页事件 |
| `src/runtime/export-runtime.ts:1694-1728` | fitFrom 处理 panel/repeater 祖先；geometryEvent 仅 move/resize，并有限次/深度保护 | 旋转可改变父容器尺寸；何时 fit/触发 move/rotate 需精确合同及递归保护 |
| `src/components/WidgetView.tsx:76` / `src/components/Preview.tsx:172-174` | owner 的 left/top/size 与 CSS rotate 来自 runtime.widget/renderSize | 以模型坐标和角度输出中间帧即可共享绘制；不要拿旋转后的屏幕 DOMRect 当逻辑宽高 |
| `src/runtime/export-runtime.ts:2553,2868-2872` | 离线同样写 owner rotate；notify 通过 microtask render；DOM 身份复用 | 每帧应沿现 render 通道，避免独立 DOM 动画与 React/安全重绘互相覆盖 |
| `src/runtime/export.ts:40-43,56-57` / `src/runtime/frame-player.ts:29-32` | 根离线、动态子框架、固定 CSP frame player 都初始化同一 factory | 新依赖必须在这三条路径可用；不得只让编辑器 bundle 成功 |

## 表达式与坐标

`export-runtime.ts:780-812` 的几何属性是 x/y/width/height/left/right/top/bottom，刻意读取逻辑框，未读取旋转后的外接框。`expressions.ts:24-26` 的白名单也没有 `This.rotation` / `Target.rotation`。新增这些属性应同时修改 whitelist 与 core reader，并在原始 expr.js 的证据闭合后确定读取累计角、归一角还是动画目标角。

`resolve`（860-881）已提供 Item/TargetItem/This/Target 及安全解释器；Rotate 应复用它，而不是 `eval` 或 HTML 属性计算。角度与 offset 的数值解析不能擅自统一：研究代理最新通知原角度使用 `parseFloat`，offset 使用 `Number`，均在实际队列启动时求值。具体 source/target row provider 与非有限数值的处理仍须完整 probe 固定。UI 保存表达式字符串，源数据和动作规范不应被播放修改。

坐标始终区分：widget 相对于其容器的逻辑框、父容器自身旋转、repeater item 的位置、页面屏幕位置。普通 shape/line/vector/text/image 共用 owner transform；不能把父级旋转二次计入 child.rotation。非中心 pivot 可通过严格原公式转换为新的逻辑 x/y 加中心旋转，保持现 CSS 中心原点；具体锚点比例、offset 旋转与尺寸读值必须以原函数为 oracle。没有理由把 native-point 的舍入、轮廓 bounds 或角度阈值搬到运行时 Rotate。

## 平面 Group 与原生 Layer 的边界

`groupWidgets`（document.ts:383-391）只给同层对象写一个 groupId，没有独立 group Widget、旋转、边框、交互或嵌套 group tree。`collectWidgetIdentifiers` 和 `remapWidgetIds` 确实会映射 group target ID，但当前 core 在 1277/1300 只接受 `widgets.has/get`，故组目标现在不会执行，也没有 Target 几何 provider。Inspector 的目标 picker 也没有组条目。

可兼容现有平面组的最小方案是 core 额外索引 `(page, containing widget/state, repeater-owner chain, groupId)` 的成员，在每个实际 RowContext 计算组框，保存该实例的组逻辑角度，并按源规则旋转成员的位置/角度。它不能是 panel wrapper：增加包裹会改变 local 坐标、fit、事件和文档结构。组入口必须拒绝或明确排除无法唯一定位的跨 scope groupId，而不是合并不同页面或不同 repeater 行。

新增组逻辑缓存须有完整 atomic/导航/refresh/adaptive/dispose 生命周期，并确认成员被单独 Move/Resize/Rotate 后怎样更新组基准。父子同在目标集时不能对子树重复施加旋转。组自己的 Rotated event、原生 Layer 的嵌套继承/布局/可见性在当前 model 没有载体；允许平面组目标不等于完成原生 Layer 重建。父线程在 runtime 支持与证据闭合前不应发布可选择但无效的组目标。

## 最小一致核心设计

1. **保留一个行为引擎。** Rotate 规范由 model 严格解析，core 读取新结构。父已落类型 `rotate:{mode:'by'|'to',degrees:string,clockwise:boolean,anchor:<九个原生值>,offsetX:string,offsetY:string,easing:<原生值>,duration:number}`；anchor 为 top left/top/top right/left/center/right/bottom left/bottom/bottom right，当前 easing 仅已验证 none/swing/linear，完整枚举尚在取证。旧文档不新增默认字段。
2. **分离纯几何、逻辑目标、绘制帧。** 在 core 内部以不可变输入算目标帧；每目标的累计/目标角缓存与本帧 CSS 角度是否需要区分，由原动画 getter/queue 合同决定。现 RuntimeState.widgetOverrides 可表示 x/y/rotation，无需改写原 Widget 或 vectorPath。
3. **逐实际实例排队。** 使用现 `instanceKey`（328-335）的完整 row tuple，不能只 key widgetId 或 Item.index。队列条目携带 page generation、target identity、源事件 frame 和 TaskGroup。动作后续语句是否立即执行、同 target Move/Resize 如何合并、后来的 To/By 从何基准起步均需源序列断言。
4. **运动时钟不占整页队列。** 现 queueTask（306-313）只运行同步段；运动 tick 通过受控短任务更新与 notify，其生命周期计入 TaskGroup。测试以 fake clock 验证真实中间状态/并行目标/最终结束，不靠延迟断言。初步优先 core 内自包含调度，以保持 bare `createOfflineRuntime.toString()` 可调用；若确需外部 factory，应显式改所有导出/bootstrap 调用，不能产生隐式模块闭包依赖。
5. **回滚以外层事务为边界。** atomic（1543-1604）已保留原 Wait、撤销新 Wait、延迟不可逆导航取消。运动也需要“旧任务留存、新任务撤销、成功最外层才取消被导航卸载任务”的对称规则。只恢复角度数值而丢 queue/timer 会重现上一轮导航 rollback 缺陷。
6. **生命周期覆盖所有入口。** `forgetInstance/forgetRow/resetPage`（1069-1110）、真正换 view 的 geometry 清理（2127-2160）、repeater persist=2 重建、dispose（2368）都必须处理运动。相同 view 不清已有 action 几何，这是现有合同。原生对动画中的隐藏、unplace、refresh 和视图切换的确切行为仍需证据；未知不能静默采用“总是继续”或“总是取消”。
7. **事件前置不是复用后置 move。** 若精确原源确认 onRotate 先于几何，则单独事件函数及循环保护，允许 handler 导航、Wait、再 Rotate 或报错时按源终止/继续。不能简单把 rotate 加进现 `geometryEvent` 的尾部。fit/repeater ItemResize 与 Rotate、Move 的先后及触发次数以原 probe 固定。

## 必要的红测与验证矩阵

- **Schema/UI/复制**（父线程）：By/To、九 pivot、正负/零表达式、方向与完整 easing；非法枚举/NaN结果/多余字段；动作切换不留旧 payload；save/reopen、undo、组件实例及富文本链接内部 action 引用；复制仅重映射实际表达式 token，不重写引号字面。
- **几何 oracle**：非正方形含初始角度，九锚点和非零 offset，By/To 与方向、±360/多圈、负值、小数；旋转父 panel 下的子项，line/vector/image/forms；size 来自有效 adaptive、fit panel 和 repeater 实际布局的区别。对原未支持类型按原 gate 验证，不凭 CSS 能转即开放。
- **事件与动作顺序**：onRotate handler 读旧/新 geometry、handler 中 Move/Resize/Rotate、独立 case、动作尾语句、零时长、Wait 与两个目标并行、相同目标排队/合并；递归 cycle 抛错且恢复事务，不 hang。
- **生命周期**：导航成功取消旧任务；导航 Loaded 失败恢复旧任务并撤销目标页新任务；adaptive 成功/失败/同view；row 删除、排序、过滤、分页、persist refresh；两个相同模板行及两层 row keys；dispose/restart/嵌套 iframe realm 清理。
- **组边界**：同层成员不同初始角、成员 panel 子树不重复转、隐藏成员/跨scope身份、组与成员连续动作；无原生 Layer 载体的边界保持明确。
- **真实浏览器**（父线程）：preview + 实际离线 HTML + 嵌套 frame 的中间和最终 geometry；样式更新与 SVG/shadow/gradient 不覆盖 transform；定时动画不是瞬移；保存源文档字节不变，pageerror/network 保持可解释。

现成测试风格可复用但不要改预期来迎合新实现：`tests/wait-scheduling.test.ts` 的 module/VM fake timers；`runtime-adaptive-transition.test.ts` 的外层 rollback 与旧/新 Wait；`widget-geometry.test.ts` 的 This/Target/target-row 语义；`repeater-row-geometry.test.ts` 的逻辑/CSS/读回分层；`runtime-render-base-lifecycle.test.ts` 的 display-only row 清理；`inline-frame-player-build.test.ts` 的自包含/CSP；`rotation-authoring.test.ts` 仅是作者 resize/marquee，不是运行时 Rotate oracle。

## 分工与待证事项

父线程已建议：本代理后续拥有 `src/runtime/export-runtime.ts`、必要的新 runtime helper、`engine.ts` / `expressions.ts` 及新的 runtime unit/serialized 测试；父线程拥有 types/document、Inspector/作者 helper、copy/remap、browser/desktop/发行。当前没有任何产品写入，待精确 motion 合同后分段实施。若实现确需 Preview/export/frame-player 的时钟/宿主注入，应提前向父线程列出窄改动，不暗中扩大 ownership。

研究代理在本报告完成前同步了 action.js:1066-1255 的初步合同：To 使用 desired-current、By 直接 delta，没有最短弧；onRotate 在任何几何写入前且零差值也触发；完成顺序 fireRotateQueue→fitParentCallback→annotation；普通中心没有类型 gate，offset 自转仅 image/hotspot/panel/vector/line，其他对象只 orbit；动作链不等待动画。该通知尚待冻结源/probe 文件绑定，本代理未执行原版。必须保留其重要区别：动画是 private plain-object jQuery animation，不能因为 DOM 被删就假定原动画已取消。

仍需研究代理交付：完整 easing/默认/clockwise 与 To 的关系；精确 pivot 和 group/layer bounds/成员 gate；表达式 rotation getter及 provider；队列合并/取消和 fit/event 的完整序列；导航、自适应、row 重建中的原行为。上述未知不构成只做中心或只做零时长的范围削减，属于完整实现前必须明确的合同。
