# 零行补证：作用域、内部事件与无 DOM 模板 Loaded

日期：2026-10-13。补充 [零行生命周期报告](repeater-empty-evidence.md)，不重复其 21 项探针。本次新增 **13 项函数探针**，使用 6 个原始 SHA 固定的分发 JavaScript 文件、24 个保留片段；另静态读取同包 DLL 的 7 个方法及一个 FieldRVA 常量数组。无原版 app、DLL 执行或浏览器 GUI 验证；不改产品源码。

## 可直接实施的结论

1. 普通外部事件或顶层空回调，在没有同行 source/target 时，模板目标应枚举**当前已经登记的可见行实例**。过滤后零行时，即使源数据仍有行，也返回零目标。不能枚举全部源数据行。
2. 同行 source/target 已明确带行 ID 时，原解析器直接构造目标 ID，未在该分支检查可见性；不要让第 1 条覆盖这个独立分支。
3. Before Item Load（enum 291）不在 repeater 支持的用户事件列表，分发 JS 还临时停止其 trace。保留为内部前置事件，不应因 enum 中存在就添加用户可配置事件入口。
4. 没有 DOM 的模板子控件仍能形成源事件帧并走 Loaded → case → action。窄探针成功执行全局变量和外部输入动作；命名行内目标零匹配。不能把无 DOM 等同于整个 Loaded 不执行。
5. 无 DOM 普通模板源的 `This.Repeater` 仍指向所属 repeater，可以读该 repeater 的真实计数；它不是无效 Item。
6. **独立嵌套 repeater 的空生命周期仍未建立原生合同。** 构造外层后缀的函数结果反而不符合多层行作用域：原 ID parser 只解析一个后缀；repeater 对象在原 parent map 中映射到自身。产品若保留外层 RowContext，应明确是扩展，不得称已恢复原生嵌套语义。

## 原始身份与复现

源目录、官方包 SHA 与 REA 提取 Evidence 沿用 [主报告](repeater-empty-evidence.md#证据与复现)。本次仍基于 Axure RP 11.0.0.4150，包 SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`；DLL `AxureRP11.dll` SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。

```powershell
node research/repeater-empty-scope-probe.mjs
& research/inspect-repeater-empty-metadata.ps1
```

第一个脚本可接受重新提取的 `resources/scripts/axure` 目录为首参数；第二个脚本可用 `-AssemblyPath` 指向同 SHA 的 DLL。二者都核验输入 SHA；后者只用 PEReader 读取 ECMA-335 metadata、IL 与 FieldRVA，绝不加载目标 assembly。此前 21 项探针没有被再次执行。

| 研究文件 | SHA-256 |
|---|---|
| [repeater-empty-scope-probe.mjs](repeater-empty-scope-probe.mjs) | `09303675b0963f640289c0b564978f2c49d4a634c2b8dfffeb5cd4f917d5bc5a` |
| [repeater-empty-scope-evidence.json](repeater-empty-scope-evidence.json) | `9549a66c016bf03f99de0b41f737cc033bb7ab5f406a3ace035c7fe80ed74161` |
| [inspect-repeater-empty-metadata.ps1](inspect-repeater-empty-metadata.ps1) | `9b5c0e81e9287c72007d75b051ba27d90be4c1c86667bd846abe90daf8cc3935` |
| [repeater-empty-native-events.json](repeater-empty-native-events.json) | `f3c34647ea7e341beff2aa4022067934a28fbf9551554edbe9b7020410142280` |
| [repeater-empty-Repeater-cil.json](repeater-empty-Repeater-cil.json) | `2a0af53317860fd22e6785a5552ec4e8dc0bbdcc246055aa7932f08847e489e9` |

JSON 保留每个原 JS 的绝对路径、SHA、字节数、片段原始行号与全部探针结果。研究文件不纳入产品包。

## A. 目标实例来自哪一个集合

**静态直接观察：**

- `doc.js:221–244` 的 `_getElementsIdFromEventAndScriptId` 先读 source 的 item ID；没有才尝试 target。若该行所属 repeater 与目标 template owner 一致，直接返回拼接 ID。
- 否则它调用 `getItemIdsForRepeater(parentRepeater)`。该函数 `doc.js:677–685` 读取 `repeaterIdToItemIds`，不是 `repeaterToCurrentDataSet` 或 active row 数组。
- `repeater.js:229` 调用 `removeItems`；`1070–1078` 移除已登记行 DOM 并清空上述 ID 集。`241–245` 仅在当前 `start <= pos < end` 可见 bounds 内调用 `addItemIdToRepeater`。`doc.js:626–633` 将这些 item ID 登记到集合。
- `This.visibleItemCount` 同样优先读这份登记集，见 `doc.js:392`。

**新增探针：** inner 源数据保留一行，而登记集分别为 `[2,5]` 与 `[]`。普通外部按钮 → child 得到 `['child-2','child-5']` 或 `[]`。empty source inner → child 也为 `[]`。显式 source child-2 即使已不在登记集，仍返回 `['child-2']`。无 suffix source + target child-5 则回退到该 target 行。

因此产品应保存“上次渲染提交的可见 ID 集”，在还未 flush 的动作链里不要用提前计算的新过滤结果替换它。这里的“可见”指当前分页/过滤后已生成实例，并非 CSS `display` 是否显示；隐藏 widget 或隐藏 repeater 不能单凭这个词再被过滤。

## B. 嵌套后缀：已经证明什么，没有证明什么

探针手工构造 outer repeater，含 outerText 和 inner repeater；inner 含 child。使用原 `doc.js:107–150` 建立映射，得到：

```text
outer     → outer
outerText → outer
inner     → inner
child     → inner
```

inner 起初会因父循环登记到 outer，但随后在原 `IsRepeater` 分支被映射到自身。它仍可能留在 outer 的 child script 列表中；这不等于存在独立的层级 row path。

原 `repeater.js:1483–1490,1503–1519` 的实际函数结果：

| 构造调用 | 结果 |
|---|---|
| createElementId('inner-7', undefined) | `inner-7` |
| createElementId('inner-7', 3) | `inner-7-3` |
| getScriptIdFromElementId('inner-7-3') | `inner` |
| getItemIdFromElementId('inner-7-3') | `7`，不是 3，也不是 `[7,3]` |

在上述**人为构造**的树和 suffix 条件下，原 getItemInfo('inner-7') 得到 valid=true、无 index、repeater 指向 inner、isMarked=false、isVisible=false。原 getWidgetInfo('inner-7') 的 This 保留 elementId=inner-7，但计数从 scriptId=inner 读取。inner-7 源指向 child 时产生 child-7；指向 outerText 时则枚举 outer 的真实登记行。

这些是函数的确定结果，却不是“原版允许并生成这种嵌套项目”的证据。没有原版生成 fixture、HTML 初始化与独立 nested dataset 调用链，不能赋予 suffix 7 “外层 RowContext” 的语义。当前产品将嵌套 scope 作为独立能力时，应明确自己的行为。

静态 CIL 还有边界信号：`Repeater.get_SupportedIxEventTypes`（0x0600965C）与 `get_PrimaryInteractionEventTypes`（0x0600965D），在 `get_IsInnerRepeater` 为 true 时返回长度 0 的事件数组。已保留 getter 0x0600961C 及其 helper `YNdr` 0x0600961D 原 CIL；该 helper 含混淆的父发现、缓存与清理逻辑，本轮未完整解析。因此不单凭属性名称宣称“原版一概禁止 nested repeater”。

## C. Before Item Load 是内部前置事件

已有 [IxEventType metadata](rp-interaction-IxEventType-cil.json) 确认 `OnBeforeItemLoad=291`。但 enum 包含某值不等于用户交互面板允许编辑它。

本次直接读取 `Repeater` 的两个用户事件 getter 与静态 initializer：

- `get_SupportedIxEventTypes` 0x0600965C：IL_0008 调用 `get_IsInnerRepeater`；普通分支 IL_0012 读取字段 `xNOt`；inner 分支 IL_0018 创建空数组。
- `get_PrimaryInteractionEventTypes` 0x0600965D 同样读取 `hNO5` 或返回空数组。
- `.cctor` 0x0600965F：IL_0028 与 IL_006C 引用相同常量字段，IL_002D / IL_0071 调用 `RuntimeHelpers.InitializeArray`，分别写 `xNOt` / `hNO5`。这只是读取调用/字节证据，未执行 initializer。
- Field token `0x04004F1D`，RVA **202360**，24 字节 `200100002101000022010000140100001501000013010000`，按 6 个 Int32 得到 `[288,289,290,276,277,275]`，即 OnLoad、OnItemLoad、OnItemResize、OnShow、OnHide、OnMove。**没有 291。**
- helper `eNdk` 0x06009653 在 IL_0040/IL_0094 使用 291 查找/创建 event/case；`sNq8` 0x060095D1 的 IL_00D8 使用 291，随后调用 evaluator。内部路径有此事件，并不需要把它公开成用户事件。
- `repeater.js:346–353` 明示隐藏该 before event 的 trace：临时设 `isTracing='tempStop'`，执行它，恢复 trace 后再执行 Item Load。

官方 [Repeater 文档](https://docs.axure.com/axure-rp/reference/repeaters/#repeater-specific-events) 的用户事件描述也只列 Item Loaded / Item Resized；这只是文档佐证，主要判据是上述当前目标版本的用户事件数组。不能把内部 291 的任意导入行为、所有自动数据绑定动作编码都说成已恢复；本轮没有反混淆字符串表或覆盖其全部生成逻辑。

## D. 无 DOM 模板 Loaded 能做什么

相比主报告仅记录 `raiseSyntheticEvent` 请求，本次新增探针执行更长的原函数链：

```text
loadDynamicPanelsAndMasters
→ fireEventThroughContainers
→ raiseSyntheticEvent
→ getEventInfoFromEvent / getWidgetInfo / getItemInfo
→ handleEvent → handleCaseGroup
→ dispatchAction → setFunction / expr
→ fcall → SetGlobalVariableValue / SetWidgetFormText
```

使用明示 mocks：合成对象树、路径到 script ID、禁用/trace/浏览器环境、无 DOM 的空 jQuery 选择集，以及一个现存外部 input。原函数不是改写为预期行为；表达式/动作 JSON 是手工构造，仅覆盖无条件一个 case，case menu 在此探针设为关闭。

**实测函数结果：** child 没有 DOM，仍形成 `{srcElement:'child', item:{valid:false}, thiswidget:{valid:true, elementId:'child', ...}}`。Loaded 内 SetGlobalVariableValue 把 seen 改成 loaded；外部 SetWidgetFormText 把 outside_input 改成 external changed；命名 child 目标零匹配；显式 This path 则返回 `['child']`，但对应空 jQuery val 写入不产生 DOM。最后 child 仍不存在。

`expr.js:107–115` 的 `pathLiteral.isThis` 直接返回 sourceElement，绕过普通模板枚举。因此不能概括“无 DOM Loaded 的所有 target 都是 []”。这里只验证 form text 在空 selection 的 no-op；富文本创建、show/hide、尺寸/位置、image 等动作各有自身 DOM 边界，未作一揽子保证。

另一个新增探针通过原 `getVariableValue('This', eventInfo)` 读取无 DOM child 的 `.repeater`：源有 1 行、active/rendered 为零时得到 dataCount=1、itemCount=0、visibleItemCount=0、pageCount=1、pageIndex=1。`doc.js:372–373` 显式令普通模板控件的 widget.repeater 指向所属 repeater，**所以 This.Repeater 元信息不能因为 source 本身不是 repeater 而返回空值。**

This.text、DOM geometry、富文本、case menu、adaptive/master 实例路径和实际浏览器 jQuery 行为不在这条成功链的完整验证范围；不能将隔离探针称为端到端原版预览。

## E. 对本轮实现的窄审阅

只读核对 `src/runtime/export-runtime.ts` 后：

- `emptyTransitionCount` 保留 `page × size` 公式，旧 committed active count 在 refresh 前读取；当前读取顺序未发现与已证顶层算法的确定冲突。
- `targetContexts` 改为无同行时枚举 `committedVisibleRowIds`、有同行时直接构造 scope，符合 A 节两条分支；不要再改回全部 source IDs。
- `loadEmptyTemplate` 对每个 panel state 递归、对内含 repeater 只派发本体 Loaded 而不建其行，符合所见 wrapper 的遍历边界。对独立嵌套空帧保留外层 context 是产品扩展，不在原生证明范围。
- 已向 root 报告一个确定缺口：当时 `readThis` 仅在 source.repeater 存在时提供 This.Repeater 计数，导致普通 child 的空 Loaded → Set Variable `[[This.Repeater.dataCount]]` 得到空值。**最终代码复核已确认修复**：由 template owner 找 repeater 与其 scope，`This.dataCount` 仍只适用于 repeater 本体，并先检查已初始化的 sourceRows，避免属性读取创建无 DOM 的孤立 nested dataset。root 报告新增 module/portable 回归覆盖源 3 行过滤到零、每页 2、child Loaded 读到 `3/0/0/0/1`；其 empty 44/44 与 query 76/76 产品测试通过。本 agent 读了对应实现/测试，未重复执行 root 的产品测试。其余所审三条路径未发现新的确定源码证据冲突。

调查停止在以上边界，不扩大 nested 原版完整调查。没有修改生产文件。
