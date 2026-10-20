# 原生 RP 交互恢复范围

2026-10-13。本阶段把只读 RP 对象图转换成可编辑和可运行的交互子集。证据来自官方样本、托管程序集的静态元数据/CIL 和随程序分发的生成器 JavaScript；没有执行原 DLL，也尚未与原版 GUI 进行运行差分。

## 实际样本结果

| 官方样本 | 页面/顶层元件 | 导入事件 | 跳过事件 | 主要结果 |
|---|---:|---:|---:|---|
| Required Fields | 2 / 7 | 3 | 0 | 邮箱与密码 Focus 隐藏错误，Sign Up 的 AND 条件成功跳转/ELSE 显示错误；4 Case、4 动作 |
| UX Prototyping | 10 / 98 | 6 | 9 | Overview 与 Sample Overview 各 3 条页面链接；相同原生对象 ID 按包区分 |
| Tab Menu | 1 / 3 | 2 | 0 | 指定状态 + This SetCheckState；两状态内容、缓存继承坐标和 fit 尺寸已恢复 |
| Quick Win | 2 / 31 | 0 | 4 | 六个单选框及组/初值已恢复；两个动画事件拒绝，另两个事件的 fit 目标含自动文字尺寸仍未导入 |

所有四个样本都明确保存一个 `OnLoadVariable` 空初值和 `DisplayMultipleTargetsOnly` 配置。变量集合通过唯一 GUID、大小写不敏感名称和安全键校验后一次性导入。配置序列化经过自定义字符串表，不能把枚举名直接当作字符串；本轮只承认有实样本证据的 `DisplayMultipleTargetsOnly → auto`。未知配置下保留几何但拒绝事件，避免改成错误的自动执行方式。

## 转换约束

事件顺序来自 `InteractionTreeMap` 的 Tree/Node children 和 node-table；不是对象在文件中的排列。节点父引用、树引用、可达性、重复、深度和数量均检查。引用以包为作用域，页面跳转用包 ID，面板状态用其状态包 ID。跨包控件路径、This、组件和中继器复杂路径尚未转换。

受支持的动作限于普通显隐/切换、当前窗口的内部页面链接、明确指定的面板状态及普通控件的 SetCheckState；动画、灯箱、压缩、前置、重复或其他影响行为的非默认选项会拒绝。Tab Menu 的两条完整点击事件已在预览和离线 HTML 验证。SetCheckState 仅静态 true/false/toggle，支持已证的 This 或本地普通目标；容器传播不支持。

解码器可识别基础点击/双击、鼠标进入/离开、表单变更、Focus/Blur、Loaded/ItemLoaded/PageLoaded 的枚举；转换器仍要求载体和目标实际存在。原生 52/53/54 映射为 selectedChange/select/unselect；Quick Win 的 OnSelect 已解码但因目标布局未恢复而未导入。当前成功导入的真实样本事件仍限于点击和焦点。控件几何被跳过时，其事件也会报告跳过。

每个事件作为一个提交单位：任意 Case、条件、动作或目标未知，整个事件没有可执行残片，其他事件仍可恢复。这避免把失败的 IF 删除后只留下 ELSE。报告分别计数事件、Case、动作、变量，以及事件数量不可确定的损坏树。

## 条件比较与输入

只支持同类 AND 或 OR 组合的输入框 GetWidgetText 与字符串字面值 equals/notEquals。原生 GetWidgetText 对面板等 div 会聚合后代文字，而本模型的 widget.text 不等价，因此这类载体整事件拒绝。混合逻辑树、函数、动态绑定和数值比较尚不转换。Case 的启用状态、空名称和 IsNewIfGroup 明确保留，不能套用旧 REA 文档的缺省独立 Case 行为。

`comparisonMode: 'axure'` 表示独立实现的原生字符串比较子集：忽略大小写的 true/false 转布尔，然后按原生等值转换比较。`'FALSE' == ''`、`'TRUE' == '1'` 为真，`'0' == ''`、`' True ' == 'true'` 为假。不裁剪空白。条件右值包含 `[[` 或 `]]` 暂拒绝，避免误转为 REA 表达式。Inspector 限制此模式为 equals/notEquals，并显示 Native comparison；旧条件缺省保持原规则。

输入框支持 `inputType: text/password`；密码只改变显示，条件读取原始值。Focus/Blur 只绑定实际表单控件，不向容器重复分发。菜单自身聚焦和恢复焦点时不调度这两种事件，真实用户点击与 Tab 切换继续触发。React 与离线版本均有先失败后通过的菜单循环回归。

## 验证与证据

- [对象树与动作证据](rp-interaction-evidence.md)、[原始映射](rp-interaction-object-evidence.json)
- [枚举及序列化 CIL](rp-interaction-cil-evidence.md)、[布尔字符串比较证据](rp-interaction-comparison-evidence.json)
- `read-rp-interactions.test.mjs`：真实样本、顺序扰动、条件/动作丢失、损坏树及跨包目标
- `read-rp-settings.test.mjs`：设置与变量引用、歧义、未知枚举字符串、四样本交叉核对
- `import-rp-interactions.test.ts`：模型往返、原子拒绝、作用域 ID、原生比较边界和实际运行状态
- `rp-interactions.spec.ts`：真实 RP 解析后预览及下载 HTML 的 Required Fields 流程与 UX 六条链接
- `smoke-rp-import.mjs`：Windows 实际 Worker/IPC 导入、报告、保存重开、预览、真实导出文件、无网络请求和源文件摘要不变

这些测试证明本产品在所列场景中的行为；原版加载样本、生成原型和视觉/运行差分仍未完成。完整 RP 写回、其他状态样式、完整表单控件、复杂布局继承和其余动作仍是后续工作。

截图核对另发现通用 5px 边距与 1.35 行高会裁剪样本的窄标签。现在按确定的 PName 11/12/13/14 恢复四边文字边距，PName 10 恢复垂直对齐。有效 LINE_SPACING 与每个富文本段落 LineSpacing 都为 0 时采用浏览器 `normal`；这是自动字体排版的保守映射，provenance 明确 `nativeFontMetricsVerified:false`，不声称原版字体度量已验证。新增 DOM Range 边界检查实际验证标签、错误提示和成功提示没有裁剪；预览在修复前失败、离线通过。详细依据见 [文字布局证据](rp-text-layout-evidence.md)。

本轮选中状态将白色底样式与蓝色 Selected 覆盖分开；radio checked 与事件样式状态有独立 runtime 记录。完整事件顺序、重复指针与键盘差异、禁用表单程序赋值，以及原版可配置的行隔离边界，见 [选择研究](rp-selected-state-evidence.md)。Fit 面板按当前状态可见子内容边界动态计算；原生导入要求所有子元件完整且不依赖未实现的自动文字/阴影。详见 [选择与布局证据](rp-selection-layout-evidence.md)。
