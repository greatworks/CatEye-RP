# 页面标签导航实现与验证

2026-10-22。独立重建的普通页面标签范围，未发布；`fullAxureParity=false`、`originalGuiCompared=false`、`published=false`。完整 Axure RP 11 复刻目标保持未完成。

## 实现

Windows Ctrl+Tab / Ctrl+Shift+Tab 按时间访问历史前进/后退，到边界停止。历史保留重复访问，同页重选不追加，从历史中间访问另一页面会截断前向记录。Ctrl+Alt+Right/Left 按打开页面的视觉排列循环；拖动标签只改变排列。Ctrl+W / Ctrl+F4 关闭当前页面标签，Ctrl+Shift+W 关闭全部页面标签。关闭移除该标签全部历史记录、修正游标，并从调整后的历史选择活动页；最后一条记录被关闭而其他标签仍在时，以第一张剩余标签建立新历史。相邻重复记录仍可跨越游标。

历史和标签排列只属于编辑会话，不写入 `.rea.json`，不消耗文档 undo。文档替换时重置，页面删除/撤销时清理不存在的身份并恢复有效页面。关闭全部后保留现有独立 Gallery 页面，双击 Pages 可重新打开页面。

捕获层只接管准确的 Windows 组合键，避免 Pages 将 Ctrl+Tab 解释为缩进、将 Ctrl+Alt+方向键解释为层级修改。普通属性草稿先 blur 提交，富文本使用现有 focusin 提交保护；成功测量后继续原键盘导航，失败保留草稿，Cancel、文档变化或更新的导航使旧请求失效。独立尺寸布局尚未完成时拒绝切页并提示重试。正在进行的画布手势回滚临时变化，不新增 undo。弹窗和标签菜单期间消费这些组合键而不切页。

成功富文本提交的文档写入、队列 expected 更新及编辑器卸载现在在同一个 `flushSync` 中完成，随后 Promise 才返回成功。普通属性 FIFO 不改变。空 flush 不能作为异步 React 更新完成屏障，相关失败证据已保留。

## 原版证据与边界

[原版静态证据](page-tabs-native-evidence.md)、[42 项来源哈希](page-tabs-native-manifest.json)、[22 项指令回放](page-tabs-native-probes.json) 证明所述普通导航算法和 Windows 绑定。全部分析读取原版 PE 元数据/CIL，未执行原版 DLL；22 项是有明确外部副作用替身的有限分支回放，不能当作原版运行时、GUI 或像素验收。

当前使用 page ID 作为原版 package/tab identity 的有限替代，未实现组件与其他打开上下文身份。原版 Gallery 在 ShowGalleryViewTab 开启时参加视觉循环且受关闭保护；当前独立 Gallery 按钮未对齐这一行为，原版设置的有效默认值亦未证实。隐藏/溢出标签提升、原生菜单标题关联、全量焦点行为和 macOS 组合键未覆盖。原版截图连接在前阶段刷新重试后仍超时，本轮未重复无变化的 GUI 请求。原生 `.rp` 写回和完整复刻仍未完成。

## 验证与失败保留

- 起始校验 `.build/page-tabs-baseline.json`：上一阶段 657 份源码、1,191 份证据与 10 份受保护发行/候选文件无漂移。
- `test-results/page-tabs-red.json`：旧构建 4/4 失败，复现视觉导航、关闭、树焦点和数值草稿问题。
- `.build/test-results/page-tabs-green.json`：9/11 通过；两个富文本用例在导航之前发现测试控件缺少明确的 padding/alignment/indicator 声明。初始测试副本保留为 `.build/page-tabs-first-test-fixture.ts`。
- `test-results/page-tabs-green2.json`：11/13 通过；成功富文本提交后未切页为真实异步缺陷。另一个尺寸断言误把开启 auto-fit 的控件当作固定宽度，后续用例改为明确固定宽度输入。
- `test-results/page-tabs-debug.json` / `.build/page-tabs-debug-test.log`：诊断构建证实 Promise 已成功、epoch/文档匹配、未被弹窗阻止，但旧 rich DOM 尚未卸载。`page-tabs-context-review.md` 保留独立审查及修复理由。
- `test-results/page-tabs-corrected.json`：12/13；测试配置通过多参数 defineConfig 合并了多个 webServer，修正版预览服务又缺少正确 cwd，浏览器仍访问旧构建。该记录不能用作新构建验收。配置改为单一服务、准确 cwd 和独立端口，不删除旧失败。
- `test-results/page-tabs-debug2.json`：修复后的单项诊断通过。该构建带临时日志，仅作诊断，不打包。
- `test-results/page-tabs-corrected2.json`：准确的最终生产构建 13/13 专项通过，包含延迟字体、失败、取消、尺寸等待、手势回滚和两项关闭边界。
- `.build/page-tabs-unit-final.json`：6,219/6,219 全量单元通过，maxWorkers=4，未放宽超时。最终类型检查与 Vite 构建通过；已有 Vite config-loader/大块提示未变化。

最终相关生产浏览器 `test-results/page-tabs-final.json` 86/86 通过，覆盖页面树、快捷键、富文本、选择控件属性和手柄；并非全应用浏览器套件重跑。独立 Windows 包 `.build/page-tabs-desktop-audit.json` 的 3 组检查通过：历史/排列/关闭全部/Ctrl+F4，数值草稿/原生保存/撤销，富文本真实测量/切页/保存/撤销。文件选择框响应为测试替身，实际打包程序以独立 userData 隐藏运行；未观察到 renderer 错误或外部网络请求。两个 capturePage 截图已人工视觉复查，均为本程序，不能当作原版 GUI 对照。

打包目录为 `.build/page-tabs-package/REA Prototype Studio-win32-x64`；项目版本 0.1.0，Electron 44.7.0。ASAR SHA-256 `119c5755d6c370462e438377e3652aedd24a68745eda42249e7074fea154b229`，所有应用文件与最终生产构建、桌面壳及读取脚本逐字节一致，22 份许可字体及完整许可证仍在包内，无原版专有程序/素材。最终源码、证据与已有发行文件保全结果见 [最终验证清单](page-tabs-final-verification.json)。此前冻结记录、发行 ZIP、发行目录及候选包保持原样。

首次封存 `page-tabs-verification.json` 将仍在输出的重定向日志也纳入哈希，因此日志结束后该条不匹配；该首次记录和快照保留作失败证据，不作为最终封存。最终清单使用新的快照目录，封存命令直接输出结果，不写入被采集的日志，再独立检查全部哈希。
