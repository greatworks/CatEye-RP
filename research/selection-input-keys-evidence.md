# Selection pointer input：Windows 修饰键与分派合同

本报告复用 Axure RP 11.0.0.4150 固定分发，仅做静态 PE/CIL 读取与保留指令的有界解释。没有加载或执行原 DLL，没有原版 GUI、键盘注入或浏览器像素验证；没有修改产品、旧报告或旧 fixture。网格/引导线/对象吸附算法由另一研究范围负责。

## 原始绑定与结果

- 原 DLL SHA-256：`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。
- 分发 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e7e987687865b876dfe0`；复用提取 Evidence ID：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。
- `selection-input-keys-probes.json`：139/139。包括 8 个平台/能力 predicate，128 个单/多选×八方向×八起始 mask 的按下/连续移动/释放场景，以及 3 个设置分支。几何、吸附和历史终结为明确 sink。
- `selection-input-keys-resize-probes.json`：80/80。单选左右与多选八方向 × 八 mask；240 次实际帧与 240 次 Shift-only 对照帧执行完整既有 CbNX→SelectionButton Size/OI8Z 原指令链。只移除 `platform.keys.read` trace 后，owner、panel、fit、请求与其他全部 effects 严格相等。
- 后一组只证明**已进入 resize mode 且 supplied post-snap delta 相同**的普通独立 SelectionButton roots；不执行按下模式选择，也不证明输入屏幕位移等价。

## SIK-01：Windows Alt 绕过吸附

接口 `I9Sy.NIoi` 100710122 的具体实现是 `N1Je.x1Jx.NIoi` 100726560：IL7 `ldc.i4 262144`，IL12 返回。元数据明确 x1Jx 实现 I9Sy，该方法是 final virtual。

平台身份链已闭合：`xSnT.aS8e` 100708657 IL7–12 → 当前平台 `kIzQ`；`J1Nt.kIzQ` 100726654 读取字段 I1Ne；`J1Nt..ctor` 100726649 IL43–48 创建 x1Jx 并写 I1Ne。这个 J1Nt 与前阶段保留的 Windows `GetKeyState` bridge 相同。没有依靠名称或通用快捷键习惯推定。

262144 是冻结 AxKeys 的 Alt。`Q3GN` 100726676 → 当前 `g3GS` → `QJGS` 100691307，使用位包含测试。因此 Alt、Alt+Shift、Ctrl+Alt、Ctrl+Alt+Shift 都绕过该吸附路径。

`jF4A` 100682868 IL265–328 在每次活动 pointer move 读取此 predicate；Alt 时跳至 IL522 直接取当前 diagram point，之后减 DFQ8 初始 point。非 Alt 时还必须有 SnapToGrid / SnapToGuides / SnapToObjects 任一启用且活动控制器 bInf 为真，才调用候选矩形/吸附消费者。普通 obNM.bInf100686227 恒 true。三个设置分别经 CFwb100682529、JFwm100682566、MFwn100682574。

139 场景将原 correction 服务明确设为 `(3,-4)`：current `(40,70)`、origin `(10,20)` 时，非 bypass 得 `(33,46)`，Alt bypass 得 `(30,50)`。这只验证原条件分支及加减顺序；不是原网格数值 oracle。实际 DFQ8 的 hot-zone 来源、xFY0/iFYq 投影和坐标转换由其他证据绑定。

## SIK-02：Ctrl 是按下时的模式选择，不能一概吞掉

`UbNP` 100686235 先读 `CJGH` 100691312。后者通过 `vJGP` 100691331 屏蔽低 16 位，再与 131072 比较，故要求 **masked modifiers 恰为 Control**。Shift、Alt、Space 等额外 modifier 都使它不成立。另有 mJGL100691324 的 MacControl 比较，记录保留，但不把本报告扩展成 Mac 合同。

通过该键条件后，UbNP 对 AbNC(false) 的结果：count>1 返回 true；count=1 则读取对象 Capabilities.Rotation；空集合返回 false。普通独立 roots 的列表由 facade 注入，不覆盖 Layer 展开或复杂选择过滤。

SelectionButton 的真实 `get_Capabilities` 100702019 返回精确 Int64 `4024498980168564671`，即 `0x37d9e47fefde7fbf`；RadioButton 继承此 getter。Checkbox 另覆写 getter100699783，值为 `0x37d9ec7fefde7fbf`（已冻结 capability getter/metadata）。`Rotation` 100725016 IL13 使用位 `1099511627776`（`0x10000000000`）；两者交集均为 0。读取和探针用 BigInt，避免 JSON double 丢精度；139 回放执行的是 SelectionButton getter，Checkbox 额外按其独立原 Int64 常量核验。因此单 checkbox/radio 的 Ctrl-only 仍为 resize；多选 Ctrl-only 则允许 rotation。

`CbNh` 100686243 IL1112–1137 在允许旋转的普通按下入口选择 `KbSk=2`（UbNP=true），否则 `KbSk=1`。普通 `YInu` 100686238 IL33–37 传允许值 true。判断与 handle 是角还是边无关；单选仍受前阶段已证明的实际左右 handle 可见性限制。探针对单选不可见方向只覆盖分派 predicate，不表示原 UI 暴露该 handle。

| 起始 modifiers | 单 SelectionButton | 多普通 SelectionButton |
| --- | --- | --- |
| 无、Shift、Alt、Shift+Alt | resize (1) | resize (1) |
| Ctrl | resize (1) | rotation (2) |
| Ctrl+Shift、Ctrl+Alt、Ctrl+Shift+Alt | resize (1) | resize (1) |

多选 Ctrl-only 的 rotation 几何不在本次实现合同内；已有旋转分支原 CIL保留为来源，但本报告没有把它伪装成 resize。

## SIK-03：模式在手势开始捕获；中途按键只影响对应消费者

`CbNX` 100686248 IL106–113 只读取已存 KbSk 并选择 rotation/resize 分支，不再调用 UbNP。`hInw` 100686246 每次调用重新读 Shift 并传 aspect 候选 bool；它不重新选择模式。CbNX 后续仍执行单/多选与 orthogonal handle 的原 aspect gate。

因此：无 Ctrl 开始的 resize，在中途单独按 Ctrl 仍然是 resize；Ctrl-only 开始的多选 rotation，松 Ctrl 不会自动变成 resize。Ctrl+Alt 开始为 resize；途中松 Alt、只剩 Ctrl，也仍为 resize，但吸附 bypass 立即取消。Shift 的 aspect 与 Alt 的 bypass 独立逐 move 读取。

80 个完整下游差分确认：在这里的普通独立 SelectionButton resize 子域、相同 post-snap delta 下，移除 Ctrl/Alt 而只保留 Shift，不改变任何布局结果或非按键 trace。该结论不推广至 Layer/Panel 子成员 pins、旋转 mode、选择行为或按下入口。

可实施的输入层策略是：begin 先捕获真实 mode，不能无条件吞 Ctrl；mode=1 的后续 input 先消费 Alt 的 snapping gate，再把 Shift 交给已有 resize planner。当前没有选框旋转支持时，应明确拒绝实际进入 mode=2 的手势，不能拒绝所有含 Ctrl 的 resize 组合。

## SIK-04：release 可以计算吸附，但不新增尺寸帧

`PF4p` 100682822 在实际 moved/active controller 分支重新读取 Alt。非 Alt 且相关 snap 设置启用时会经 xFY0/iFYq；否则直接取 SFsQ release point。它与 move 的细节不同：release 分支 DSOB 后没有 move 分支的 Rotate(handle, angle)，因此不应复用 move 投影并声称等价。

PF4p 最终 IL465–485 调虚方法 `Moved(dx,dy)`。`obNM.Moved` 100686261 IL33–37 调 `EbNf(true,true,false)`，随后 IL69–72 将 dx/dy 传给基类 `IjWz.Moved` 100686117。基类只有直接返回。这个 override 没有 CbNX/hInw/Size 调用；EbNf100686262→mbNT100686263 在所留 CIL 中完成 snapshot/history/overlay/hot-zone 终结，没有重新消费 release delta 做尺寸投影。

139 场景解释了 PF4p、obNM.Moved 和基类空方法；EbNf/history是明确终结 sink。因此证据支持输入 API 的 release 只返回完成，不再向 resize planner 提交一帧新的 raw point/key 几何。不把 sink 当真实编辑器历史或异常撤销测试。

## 可复现与失败保留

两 probe 脚本均只读取冻结原 CIL，未导入产品。主 probe 第一轮漏注册具体 `J1Nt.g3GS` 调用，失败保存在 `selection-input-keys-failure-1.json` 与 `probe-failed-1.mjs`；补入明确的平台按键 facade 后 139 绿。首次绿使用显式基类 call sink；`probe-first-green.mjs` / `probes-first-green.json` 保留该版本。最终在同一 release 边界补了真正基类空方法记录，以 call/callvirt 语义分派，未改写原 CIL operands，139 结果不变。

只读来源、历史源快照映射和最终 SHA 清单见 `selection-input-keys-evidence.json` / `selection-input-keys-manifest.json`。旧 `selection-pointer-modifiers-*` 报告仍保持原结论和原哈希；本报告作为新增证据关闭其 NIoi 未知项，不回写历史。

## 仍未覆盖

本报告没有实现网格算法、真实 Windows 输入/DPI、旋转选框数值、复杂包含选择、原字体/graphics 服务或原版 GUI。key-only 主动重算没有本轮新入口证明，继续保留未知；不因这一新 Alt 绑定推断全键盘生命周期已完成。
