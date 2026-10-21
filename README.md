# CatEye-RP

**简体中文** | [English](README_EN.md)

对照 Axure RP 11 研究并独立实现的 Windows 原型编辑器。当前为 **0.1.0 开发版**。

本分支保存截至 2026-10-21 已完成并验证的源码，现已包含选择控件的新建默认值、文字测量与适配、尺寸手柄、网格与修饰键、多选旋转，以及受限 SVG 状态、自适应缩放和外框裁切。最新修改已有独立 Windows 测试包验证；正式发行文件仍为此前的组缩放阶段，最新构建尚未完成全量应用回归和发行替换。

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

- 页面与画布编辑、富文本、矢量、表格、菜单、树和多种样式。
- 条件交互、表达式、动态面板、中继器、组件及自适应视图。
- 嵌套组、组交互、八向组缩放和固定尺寸约束。
- 选择控件的新建默认值、文字测量和适配、左右指示器、尺寸手柄、网格与修饰键、多选旋转及单次撤销。
- 受限 SVG 状态绘制、自适应视图缩放历史、外框裁切和单选圆点路径。
- 保存/打开 `.rea.json`、预览、独立离线 HTML 及实验性 Axure `.rp` 只读子集导入。

## 验证与边界

最新 SVG 外框/裁切源码阶段通过 6,192 项单元测试、21 项专项生产浏览器检查及 3 组实际 Windows 测试包检查。此前选择控件候选版的 411 项全量浏览器和 14 组桌面检查属于较早构建，不覆盖后续全部修改。详见 [最新源码验收](research/selection-svg-body-verification.json)、[本次提交记录](docs/github-milestone.json) 和 [实现范围](docs/implementation-status.md)。此前组缩放发行记录见 [已发布阶段验收](research/layer-resize-verification.json)。

复杂状态与容器组合、一般变换、原生字体/DPI、原版 GUI/逐像素对照、原生文件完整兼容与写回、云协作及完整 Axure 功能仍未完成。通过本项目测试不代表完整 Axure 兼容。

## 测试与数据

运行 `npm test`。部分原生导入测试需要在 `research/samples/` 自行提供对应的原始 Axure 样本。大型研究数据使用 Git LFS；原厂程序、私有样本、依赖目录和打包程序不随源码发布。字体及其他第三方资源保留许可证和声明。
