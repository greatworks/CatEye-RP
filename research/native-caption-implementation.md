# 原生库默认样式身份与短标签修复

本阶段修复 `.rplib` 默认样式匹配中的错误零 LibraryId 假设。通过 DesignDocument → StyleSheet → DefaultStyle 读取实际 `(Id, LibraryId)`，在页面 StyleCache 内分别要求默认和基础样式唯一匹配，再按默认、基础、本地、活动状态顺序恢复。缺失、错误标签、重复或冲突身份仍报告未知，明确的本地属性可单独保留。

样式来源只在语义报告顶层保存一次完整文档身份；每个属性保留样式 Id 和 LibraryId。已检查 5,911 个既有本地/活动状态属性，值没有变化。原生文件不被修改。

Personal information form 的 10 个 14px 标签恢复文件中明确的零边距、透明填充、零描边、顶部对齐及自动行距。坐标、宽度和 16px 高度保持原值。首次 Edge 预览/离线测量恢复单行，Canvas 字形墨迹估计没有越界，但实际打包 Electron 的 CDP 确认它把缺失的 Roboto 换成 Noto Sans SC，行框高 20px，Phone 标签仍换行。该失败保存在 `native-caption-electron-before-fonts.json`，没有把 Edge 结果当作桌面版通过。

为消除宿主字体回退差异，编辑器、预览及包含 Roboto 的离线 HTML 嵌入相同的六款正常字体，使用 data URL，无字体网络请求或系统安装。字体为原分发中单独按 Apache 2.0 许可的 Google Roboto 2.137（2017）；六文件内嵌版权/许可字段及 SHA 已核验，副本不改写。完整许可和 NOTICE 随包及嵌入字体的 HTML 提供。字体没有被声称与当前上游下载字节相同，也不代表可使用原应用的其他资源。Thin 的 CSS 100 是本产品家族映射，其原 OS/2 weight 字段是 250。其他字体与字体族栈保持原文档值。

字体行框、估计墨迹及固定元件矩形分开测量；不能把行框超出直接当作可见字形裁切，也不修改存储尺寸去掩盖字体差异。原生自动文本尺寸、斜线的细小墨迹外伸和原生成页面的完整排版仍待对照。

11 个真实样本清点：6 个 `.rp` 的恢复数量保持；5 个库文件恢复正确缓存链。form 顶层导入 530→540、嵌套 406→430；UI 顶层 171→182、嵌套 10→22；Default 顶层 26→27。新增 44 个事件使用已有的 setSelected/setState 支持路径，没有扩大动作解码范围。Icons 仍受页面数量上限限制；没有新增图片恢复。

完整来源与未知属性使最大语义报告达到 24,485,671 字节，因此内部 Worker → IPC 限制从 20 MiB 调整为 32 MiB。30 秒时限、256 MiB Worker 内存限制和工程文件大小限制保持原值。保存后的工程大小仍单独受工程约束。测试工具对大型语义输出使用紧凑 JSON 或足够的有界缓冲区。

验证包括身份负例、真实样本导入和持久化、预览/离线字符位置、Required Fields 对照，以及 Windows 包中的真实 Worker/IPC/转换/保存重开流程。OS 文件选择对话框返回路径由测试替换；文件内容和后续导入路径实际执行。完整结果和包哈希见 `native-caption-verification.json`。

证据：[格式身份与增量](native-caption-evidence.md)、[原渲染证据](native-caption-rendering-evidence.md)、[修复前浏览器测量](native-caption-browser-baseline.json)、[修复后浏览器测量](native-caption-browser-after.json)。本阶段不声称原 Axure GUI、原生成页面像素或完整 RP 读写等价。
