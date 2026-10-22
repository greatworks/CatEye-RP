# Selection pointer modifiers：来源绑定与边界

本报告只覆盖固定 Axure RP 11.0.0.4150 的 SelectionButton 拖动调整尺寸管线。原 DLL 未加载、未执行；未操作原版 GUI。55 个场景、163 次连续调用执行的是保留 CIL 指令的受控解释器，平台按键状态、字体测量、graphics 单位服务与对象通知使用明确的 facade。它们不是原版窗口或像素验证。

## 来源与可复现结果

- 原 DLL：`C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll`。
- SHA-256：`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`；固定分发 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0`。
- 复用提取 Evidence ID：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。新增记录由 PEReader 读取元数据/CIL；不把后续静态文件伪称为新的 REA 执行记录。
- 可执行入口：`selection-pointer-modifiers-probe.mjs`，其 session 包装复用已冻结 pointer/controller/numeric/SelectionButton layout 解释器，仅注册 `hInw`、`CbNX` 与真实 key-test 方法，并改由 `hInw` 进入。原方法指令未重写。
- 冻结结果：`selection-pointer-modifiers-probes.json`，55/55 场景通过，163 帧；其 64 个 source 条目在本报告封存时逐个重新核验。这里的“帧”是一次 controller 调用，不是浏览器绘制帧。
- 首次失败保存在 `selection-pointer-modifiers-missing-binding-failure.json` 与 `selection-pointer-modifiers-session-failed.mjs`：55 项均因解释器漏注册 `hInw → CbNX` 调用而失败。修正调用表后通过；这不是原版缺陷或产品红测。旧阶段文件未改写。
- 封存脚本首轮误把产品 SHA 当作 fixture SHA，校验安全失败；`freeze-initial-failure.json` 与 `freeze-initial.mjs` 保留该错误。fixture 实际 SHA `ae4dce01f8d6012cd47f36f8f1263aea72c34e1d074cf90a3997b84c5b1f80bb` 与先前模型报告/快照一致，未重生成 probe。

## SPM-01：实际 Shift 来源

`Axure.Constants.AxKeys`（TypeDef 33556624）的常量为 Shift=65536、Control=131072、Alt=262144、MacControl=524288、SpaceModifier=1048576。`QJGS` 100691307 的 IL7–11 执行 `(mask & requested) == requested`；`BJG9` 100691309 的 IL7–13 使用 requested=65536。因此组合键只要包含 Shift 位，该 predicate 就为真，不能把它当作“仅 Shift”。

`obNM.hInw` 100686246 的 IL33–55 每次调用都会重新读取 `iS8H().g3GS()`，用 BJG9 结果调用 `CbNX` 100686248。55 场景没有直接注入 CbNX 的 preserve-aspect bool，而是向平台按键 facade 提供 AxKeys mask，再解释原 hInw/位测试。

平台静态桥进一步闭合：`J1Nt.g3GS` 100726677 调用 `M1Ei` 100727662，后者读取虚拟键 16/17/18；`MIkG` 100731360 检查返回字段的 32768 位。P/Invoke 元数据确认 `hIcw` 100731465 为 `user32!GetKeyState`。该 P/Invoke 未执行。g3GS 还可叠加独立 SpaceModifier 字段；本次数值会话不覆盖 Space。

## SPM-02：可实施的下游 controller 合同

`CbNX` 的 aspect 门同时要求 Shift 与旋转 90 度的对应 handle 通过 `WbSB`。`WbSB` 100686225 要求 Visible 且非 DbNv。普通单独 checkbox/radio 仅左右 sizing handles 可见，所以 Shift 在这一单选水平子域不会启用 aspect；多选的八个 handles 可以启用。

逐帧仍使用最初捕获的 owner/selection 几何，同时保留上一帧已变化的 panel 和 fit 状态。首次横向调整关闭 AFW 后，按键释放或累计 delta 回零不会恢复 AFW。JbNd 的 fit setter 门使用原 handle movement freedom；不能因为 Shift 令几何同时变化两轴就关闭另一轴的 fit。Top/Bottom 的 AFW=true 用例因此维持 true。

多选采用共享 selectionRect。Mixed locked root 仍进入该可见选择边界，但不写其布局；all-locked 不生成有效尺寸请求。场景覆盖 8 个 mask、single 左/右、multi 八 handles、Shift 按下/释放同一 supplied delta、mixed/all locked 与 AFW false/true。

独立数值例：两个 root 为 `(100,100,240,20)` 与 `(450,100,180,20)`，共享框 `(100,100,530,20)`，Right supplied delta `(106,0)` 且 Shift。原数值链请求高度 24，宽度 288/216，y=98。受控文字服务返回高度 20 后，最终 owner 为 `(100,98,288,20)`、`(520,98,216,20)`；Size 完成后写原请求 Location，没有按实际高度再次锚定。本例的字体/高度服务输出不是原版字体测量。

这些结果足够支持“下一次 pointer move/up 携带当前 Shift，重算同一累计差值”的独立产品子域。Ctrl/Alt 的下游位测试结果不能推出完整手势中 Ctrl/Alt 无效果。

## SPM-03：Shift 还参与上游吸附，55 场景不是完整鼠标管线

已读实际调用路径为 `nFOU` 100682362 注册 `NFnH` 100682895，后者 IL472 调 `jF4A` 100682868。活动 resize 分支中，jF4A 先调用 `xFY0` 100682729 构造候选矩形，再经 `iFYq` 100682731（SnapRectW）得到 correction，加到当前 point，最后减起点并调用 hInw。不能把 supplied delta 说成原版未加工的屏幕鼠标位移。

`jF4A` IL265–328 通过 `Q3GN(NIoi())` 及 SnapToGrid / SnapToGuides / SnapToObjects 选择是否进入吸附。三个设置桥分别为 `CFwb` 100682529、`JFwm` 100682566、`MFwn` 100682574。NIoi 100710122 在本次边界内仍为抽象平台配置，未绑定到具体 Ctrl 或 Alt；不作这种推断。

已静态闭合的 Shift 吸附尾部：iFYq IL2018–2309 仅对四角 Position 3/6/9/12 且 BJG9=true 生效。令比例 `r = rect.height / rect.width`、候选 correction 为 `(dx,dy)`、符号 `s=+1`（3/12）或 `-1`（6/9）。源分支会按其 local6/local7 候选标志及 `abs(dx*r) < abs(dy)` 选择保留哪一轴：写 `dy=s*dx*r` 或 `dx=s*dy/r`；与原值按 qbxO 的 1e-5 参数比较，不相等时写回并清相应候选标志。这里保留 local 编号，不为未完整追踪的候选标志强加公共语义。`xFY0` IL1833–1848 也读取当前 Shift，不能省略为单一尾部操作。

上述吸附段为静态指令结论，没有执行整个 SnapRectW 的 guides/grid/object 搜索，也没有原鼠标/DPI/变换输入回放。55 场景从 hInw 收到的 supplied delta 开始，明确不覆盖这一上游管线。原版 snap 当前仍是产品未实施边界。

## SPM-04：key-only 更新未证明，不凭未知增加行为

已定位 command-key 入口 `dFn4` 100682936 → `LFnn` 100682937，以及 `wjkD.FI8B` 100685872 的 AxKeys 参数。另读注册的 `sFnd` 100682928，及其尾部 `PFnt` 100682889、`gFnq` 100682927。所查直接调用没有进入 hInw/CbNX 或 NFnH/jF4A；这不足以排除平台间接合成鼠标事件，也不足以证明原版必须等下一 mouse event。

`htNZ` 元数据只有有限可读 EventDefinition；不能仅凭 obfuscated accessor 把 rt11 等定名为 KeyUp。最初检查的 bI8J/PI8N 使用 eSYM drag/drop payload，不是 AxKeys，已排除为键盘证据。原始 raw-byte xref 只是候选索引，报告的正面调用结论均取自完整选中方法 CIL。

本轮结论为 key-only 行为未知；产品仅在后续 pointermove/up 取当前 keys，不新增主动 keydown/up 重算，也不声称这已经还原原版完整键盘流程。两条窄查已完成，不继续扩展全键盘图。

## 限制与交付界面

- 本报告没有读取产品实现来反向制造原生 oracle，也未修改产品、测试或历史报告。
- 无原 DLL 执行、原版 GUI、浏览器/桌面 suite 或像素等价证明。
- 字体测量、graphics 单位、平台 key-state、对象通知和选定数据载体是 facade；单选最低尺寸来自原 virtual getter，1×1 是这些场景注入的 provider 值，不是 obN4 literal。
- Ctrl/Alt 上游作用、NIoi 实际绑定、key-only 合成事件、完整 snapping、旋转选区与平台 DPI 输入仍未闭合。本次数值合同不外推这些域。
- 产品支持边界由主线程单独记录；本报告不宣称完整 Axure parity。

完整机器可核对来源、source ranges、fixture hash 和失败保留项见同前缀 `evidence.json` / `manifest.json`。封存脚本只核验与写新报告，不重跑或覆盖已冻结的 55 场景 JSON。
