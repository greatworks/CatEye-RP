# Open Sans 与深层容器字体导出

本阶段将保留的 Open Sans 1.10 十个独立字形接入编辑器、预览、内联框架与离线 HTML，并修复字体仅出现在表格、菜单、子菜单或树节点时被离线导出漏掉的问题。Roboto 的原有接口和十二个字形继续保留。字体工具栏加入两个内嵌字体，并保留当前文档自定义字体的显示。

## 字体与来源

Open Sans 注册为统一 CSS family，包含 300、400、600、700、800 各自的正体与斜体。400 斜体使用 `OpenSans-Italic.ttf`；保留分发中的 `RegularItalic` 与它字节相同，不重复嵌入。十个文件共 967,952 字节，均保留原字节，不调用系统字体安装、不设置 `local()` 字体优先源，也不从网络下载字体。实际字形断言针对演示中的英文和数字；不将这些断言扩大为所有 Unicode 字符均由该字体覆盖。

本地字体元数据识别 Google copyright、Ascender 和 Apache 2.0；独立 NOTICE 与完整 Apache 2.0 许可随包提供，并随使用该字体的离线文件嵌入。历史官方 Google Fonts 分发同样使用 Apache 2.0，但其字节与本地保留字体不同。未声称已找到完全对应的原始上游字体归档。详见 [字体元数据](open-sans-font-evidence.md) 和 [历史上游审计](open-sans-upstream-evidence.md)。此许可只覆盖这些独立字体，不覆盖 Axure 的应用程序代码或专有素材。

## 导出修复

导出器遍历普通/状态样式、交互动作、富文本片段和链接、面板状态、中继器模板、表格单元格、菜单及子菜单、树节点和标签，以及页面动作、自适应覆盖、组件和共享样式。只要文档可能使用一个内嵌字体，就附带该字体的全部字重及样式，保障延迟动作或未展开内容之后仍能显示。

字体列表识别带引号名称、逗号分隔的后备字体与未加引号名称中的 CSS 空白。没有实际使用内嵌字体的文档不附带字体；名称中的子串不误判为该字体。此处未新增 `Open Sans Light` 等旧名称的 CSS 别名。

## 验证

失败基线保留于 `.build/open-sans-fonts-before.log`：直接 Open Sans 导出和两种字体的四类深层容器共九项断言全部失败。空白规范化的独立失败也已保留。修复后字体专项 83 项通过；完整验证和当前 Windows ZIP 的对应哈希见 [本阶段验证清单](open-sans-verification.json)。

浏览器及实际打包 Electron 使用 CDP 检查实际渲染字体的 PostScript 名与 `isCustomFont`，不以 CSS 属性或 `document.fonts.check()` 代替实际字体证明。演示覆盖十个字形、工具栏修改和撤销、运行时切换到 800 斜体、深层容器、富文本与独立 iframe。离线验证禁用网络，并核对导出字形数量、许可和完整保存文档未被运行时修改。

真实 `UX Prototyping.rp` 通过打包 Worker 重新导入，完整保存文档与上阶段冻结文件逐字段比较；四个 Problems/Ideas 标题检查实际使用 OpenSans-Bold。源 `.rp`、演示工程与所测应用包均检查未被测试修改。原版 Axure 的实际页面生成和像素对比仍未完成。

## 仍存在的布局差异

字体接入不改变原生导入的 28px 字号、位置或保存矩形。UX 样本的标题仍因当前固定文字布局出现换行或裁切，本阶段没有解决 AutoFit。已有实验表明改成 20px 可以容纳文字，但这只说明几何关系，不能作为更改原生字号的证据。字号/自动适应必须继续依据独立的格式与生成器取证接入，不能将字体修复当作与原版完全一致。

可直接打开 [演示工程](../artifacts/open-sans-demo.rea.json) 或 [离线演示](../artifacts/open-sans-demo.html)。

后续自动适应研究已另存为 [文字层 CSS 证据](text-autofit-native-evidence.md)、[DOM 结构证据](text-autofit-dom-evidence.md) 和 [基础 CSS 与文本动作](text-autofit-base-css-evidence.md)。这些只读结果尚未接入本版本；生成模式、样式类及完整页面级 CSS 的实际裁切行为仍需确认。当前 Widget 模型没有保存导入报告中的 AutoFit 标志，React、富文本和离线渲染均有独立的固定布局规则，后续修改需要共同覆盖这些路径，并保留原 owner 几何。
