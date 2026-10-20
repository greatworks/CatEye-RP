# Axure RP 11 如何工作：当前证据与重建方法

分析对象是官方 Windows 免安装包中的 **Axure RP 11.0.0.4150**。对照文件 SHA-256：`f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`。官方程序仅用于本地研究，没有加入本应用发布包。

## 工作过程

从官方文档和包内资源可以观察到，Axure 将“设计文档”和“浏览器中的原型运行”分开。编辑器维护页面、元件、位置样式、组件、数据和事件规则；预览/导出把这些描述交给浏览器运行器，由事件触发条件判断和顺序动作。动态面板把多个状态放在同一容器内，中继器则将一个模板重复绑定到多行数据。组件负责定义复用，自适应视图负责不同宽度的布局覆盖。

这个分解是重建方案所用的架构推断，不是声称已经恢复原软件完整源码架构。[官方事件与动作说明](https://docs.axure.com/axure-rp/reference/events-cases-actions/)、[动态面板说明](https://docs.axure.com/axure-rp/reference/dynamic-panels/)、[中继器说明](https://docs.axure.com/axure-rp/reference/repeaters/)

## 直接观察

| 证据 | 得出的有限结论 | 边界 |
|---|---|---|
| 官方 ZIP 与 EXE 版本信息 | 本次样本为 Windows 11.0.0.4150 | 不代表其他平台实现相同 |
| `AxureRP11.runtimeconfig.json` | 该样本声明 .NET 10，包含 .NETCore、WindowsDesktop、AspNetCore 10.0.10 框架 | 声明依赖本身不能证明各框架具体用途 |
| `DefaultSettings/Prototype_Files` 中的运行资源 | 原型有独立 JavaScript 浏览器运行资源 | 没有执行原版生成/预览流程，不能声称动态行为已观测 |
| 5 个内置 `.rplib` 和官方教程样本 | `.rp/.rplib` 有自定义索引容器和压缩对象成员 | 不是 ZIP，也不能直接当通用 JSON 工程打开 |
| 静态读取 DLL 元数据与序列化相关 CIL | 可逐步将标签、字符串/GUID池、位置/尺寸常量和样本记录对上 | 混淆、继承、自动尺寸及对象引用仍需进一步验证 |

官方安装与版本资料：[Windows 安装说明](https://docs.axure.com/axure-rp/reference/installing-on-windows/)、[Axure 下载](https://www.axure.com/downloads)。原生格式细节和新增发现见 [文件格式研究](../research/axure-file-format.md)。

## REA 证据索引

- 提取清单：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`，清单 ID `agm_4289bead12e4e9a365f6c54b95f4a9fdd0d96d4ec6d317d8f486c1dfc6db51336`。
- 托管 DLL 检查：`ev_f0036570d4705d93beb771a90d7eea9390e7ff5b75631e8e3ec92bd8d4aa0788`。REA 的完整元数据表示超过 64 MiB 预算，返回 **partial**；未返回的类/方法事实未知。
- JavaScript 资源分析：摘要 `ev_21d2df05dfbc134964e251e118923c541d74e97c0d8092202896ff817945d6ad`，父记录 `ev_087ede770347fe8367155aa88a600204baf9051bc362979a94a8e1b170d6f432`。49 个相关文件、40 个 JS 文件成功解析，无语法解析失败；语义覆盖仍因资源预算为 **partial**。

这些结果的便携摘要保存在 [rea-evidence-summary.json](../research/rea-evidence-summary.json)。后续逐类型静态元数据读取是独立研究证据，不能伪装成上述 REA 工具已经完成的分析。

2026-10-13 经用户授权启动了原版进程。用户手动处理账号窗口后，文本观察确认 `Create account` 已消失，并读到 File、Edit、View、Project、Arrange、Publish、Team、Account、Help 主菜单。Ctrl+O 能打开本地文件对话框，Escape 能退出；但截图持续超时、鼠标缺少输入几何、文件名填写没有可靠读回，重置控制会话后仍未解决。未成功载入样本、建立测试工程或执行原版生成/预览与交互差分。记录见 [启动核对](../research/axure-runtime-check.json)。

## 本项目的实现选择

本项目使用 React/TypeScript 构建编辑环境，使用 Electron 提供 Windows 窗口与文件对话框。文档模型与渲染分离，纯数据操作负责 ID、验证与撤销快照；交互以受限声明式动作执行，不执行任意用户脚本。预览和导出共用可独立序列化的运行时。导出 HTML 将文档嵌入为转义后的 JSON，使用 DOM 文本写入，并阻止网络访问。

中继器研究进一步区分了数据身份和临时控件状态：数据行保持稳定身份，但普通数据、排序和筛选刷新重新创建模板状态，并按显示顺序执行 Item loaded 和行内 Loaded。当前实现已按这一静态证据修正，支持目标行更新、部分显示元信息及非阻塞 Wait 续段。生成器刷新边界、复杂延时上下文、零行转换事件仍待对照。详见 [生命周期证据](../research/repeater-lifecycle-evidence.md) 和 [Wait 调度研究](../research/wait-scheduling-evidence.md)。

Case 不是一律独立执行：原版生成资源先按 `isNewIfGroup` 建立 IF／ELSE 链，每链只执行首个启用且命中的分支；下一独立链继续，同链不会因 Wait 再次选路。All／Any 对应的逻辑运算会短路。重建版现已接入这些执行规则及链编辑入口，见 [条件链证据](../research/conditional-case-evidence.md)。菜单模式现在支持逐个无条件 Case 选择，或条件事件的整体入口；初始化页面和控件/行加载具有不同的绕过路径，菜单可跨元件/行并存。原版完整描述、视觉和部分编辑手势仍待复现，见 [菜单证据](../research/case-selection-evidence.md)。

组件实例以单状态透明 panel 实体化，保存源 ID 到实例 ID 的映射；传播组件定义时保持各实例外层位置和稳定内部引用。这个选择使现有运行器无需额外组件特例，同时明确将实例覆写与多级组件继承留作后续工作。

原生文件兼容必须独立验证：先严格解包和解析对象，再恢复页面、元件及样式语义，然后测试导入和写回。仅有看起来相似的画布或能读取文本，不足以达到“一模一样”的目标。

现阶段已用静态 CIL 常量和官方样本对上基础样式、字号缩放、颜色通道、文字与面板状态引用。只读导入恢复明确的字段，将未知值及其来源保留在报告；所有成功转换的官方样本都再经过应用文档校验。样本审计见 [import-summary.json](../research/samples/import-summary.json)，这仍不代表完整工程互通。
