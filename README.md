# CatEye-RP

**简体中文** | [English](README_EN.md)

Axure RP 11 完全免费开源的替代品，对照 Axure RP 11 拆解并独立实现的免费开源 Windows 产品原型设计工具。当前为 **0.1.0 开发版**。

本分支保存截至 2026-10-22 已完成并验证的源码。本轮新增完整快捷键组合匹配与上下文保护，以及普通页面标签的历史导航、按排列循环、关闭当前/全部标签和草稿提交保护。此前的选择控件绘制、缩放和文字适配均保留。最新源码已有独立 Windows 测试包验证，正式发行文件尚未替换。

<img width="2560" height="1519" alt="CatEye RP_17926446259633" src="https://github.com/user-attachments/assets/ea2a9681-f221-484d-8eae-e85eee202659" />

## 运行

需要 Node.js、npm 和 Git LFS。

```powershell
git lfs install
git lfs pull
npm ci
npm run dev
```

浏览器打开终端提供的本地地址。桌面运行：

```powershell
npm run build
npm run desktop
```

生成 Windows 便携包使用 `npm run package:win`。

## 当前能力

- 快捷键完整组合匹配、弹窗及表格/矢量局部输入保护，复用对齐、工具、预览、导出、网格和缩放入口。
- 普通页面标签的访问历史导航、按标签顺序循环、关闭当前/全部标签，以及富文本草稿和未完成手势的切页保护。

- 页面与画布编辑、富文本、矢量、表格、菜单、树和多种样式。
- 条件交互、表达式、动态面板、中继器、组件及自适应视图。
- 嵌套组、组交互、八向组缩放和固定尺寸约束。
- 选择控件的新建默认值、文字测量和适配、左右指示器、尺寸手柄、网格与修饰键、多选旋转及单次撤销。
- 受限 SVG 状态绘制、自适应视图缩放历史、外框裁切和单选圆点路径。
- 保存/打开 `.rea.json`、预览、独立离线 HTML 及实验性 Axure `.rp` 只读子集导入。

## 验证与边界

最新页面标签源码阶段通过 6,219 项单元测试、86 项相关生产浏览器检查及 3 组实际 Windows 测试包检查。此前 411 项全量浏览器和 14 组桌面检查属于较早候选构建，不覆盖后续全部修改。详见 [最新源码验收](research/page-tabs-final-verification.json)、[快捷键验收](research/editor-shortcuts-verification.json)、[本次提交记录](docs/github-milestone.json) 和 [实现范围](docs/implementation-status.md)。

Gallery 的导航参与和可见性、组件/打开上下文身份、完整菜单与焦点、macOS 快捷键、复杂状态/容器组合、一般变换、原生字体/DPI、原版 GUI/逐像素对照、原生文件完整兼容与写回、云协作及完整 Axure 功能仍未完成。通过本项目测试不代表完整 Axure 兼容。

## 测试与数据

运行 `npm test`。部分原生导入测试需要在 `research/samples/` 自行提供对应的原始 Axure 样本。大型研究数据使用 Git LFS；原厂程序、私有样本、依赖目录和打包程序不随源码发布。字体及其他第三方资源保留许可证和声明。
