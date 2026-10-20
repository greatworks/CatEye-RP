# 画布原位文字编辑与文字装饰

本阶段将混合格式编辑移到实际画布元件内，加入独立下划线和删除线，贯通保存、交互状态、自适应与离线 HTML。完整 Axure RP 11 重建仍未完成。

## 作者操作

Style → Text → Edit formatted text，或双击已有富文本，进入画布上的 contentEditable。真实浏览器选区映射到段落/片段模型；工具栏在画布外独立定位，不使用隐藏 textarea 模拟选区。选区格式立即显示，折叠光标的格式设置影响后续输入。字体、字号、字重、斜体、颜色、下划线与删除线可以独立编辑。

Enter 插入段落，Shift+Enter 插入段内软换行；纯文本粘贴保留字面内容，组合输入在结束时归并为一个本地编辑步骤。输入时合并相邻同格式片段，避免逐字生成无界片段。Ctrl+Z/Y 使用本地编辑历史；Done、Ctrl+Enter、点击外部或将焦点移出编辑区/工具栏先提交，再执行外部操作。一次提交只产生一次文档撤销记录；无变化提交不占历史。Cancel/Esc 放弃本次草稿。

上述按键和提交行为是本产品约定。静态调查找到原版命令钩子，但未闭合到原版编辑事务，不能称为原版等价：[原生内联调查](inline-text-native-evidence.md)。IME 检查覆盖模拟浏览器组合事件，真实操作系统输入法候选窗口仍未独立验证。

## 装饰与原版证据

初始片段格式中的 underline/strikethrough 是两个独立布尔量，作者编辑亦独立。原版运行时却将原始自适应/状态覆盖合成一个 CSS textDecoration：单字段有效写入替换整组装饰；underline=false、strikethrough=true 的组合产生无效 CSS，实际状态更新在还原原始片段后忽略该写入。因此无效组合恢复原始格式，不保留前一悬停格式。

产品将原始覆盖合并一次，再做已观察的投影；普通文字与富文本的 Set style、状态及快照共用该规则。原始装饰基底不被运行时动作改写。装饰仅加在文字片段或表单文字上，不加在容器祖先，避免父容器的装饰穿透子控件。证据为原版脚本 28 个装饰实验，以及 6 个独立超链接行为实验：[运行时报告](text-decoration-runtime-evidence.md)。这些原函数隔离实验不能替代完整原版 GUI 对照。

原生 rich 协议升级为版本 2，明确携带七个片段样式字段；旧 .rea.json 缺省装饰仍兼容。严格解析保留 false 和未提供的区别。11 个原生样本复核保留 632 个富文本元件、2,095 个片段、49 个混合格式元件；元件/事件数量无增减。所有成功导入片段装饰均为 false，两个真实 underline=true 片段都位于尚未支持的 AxHyperlink 内，因此本轮没有实际装饰元件新增。见 [格式证据](text-decoration-format-evidence.md) 和 [导入审计](text-decoration-import-audit.json)。

## 验证与边界

全量单元、原生解析、生产浏览器及精确 Windows 安装包检查的最终结果保存在 [验证报告](inline-text-verification.json)。桌面检查通过独立临时用户目录操作真实打包 EXE，文件对话框返回值由测试提供；窗口保持隐藏，截图使用实际渲染结果。可编辑工程为 [inline-text-demo.rea.json](../artifacts/inline-text-demo.rea.json)，离线结果为 [inline-text-demo.html](../artifacts/inline-text-demo.html)。

原版截图桥接此前发生 FrameArrived 超时，本轮没有条件变化，没有重试或宣称视觉/像素一致。超链接、列表、字距、上/下标、Oblique、任意富 HTML 设置、完整原生富文本缓存/自适应语义仍未完成；原生写回、高级元件、协作及 macOS 等缺口保留在 [实现状态](../docs/implementation-status.md)。
