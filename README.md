# CatEye-RP

对照 Axure RP 11 研究并独立实现的 Windows 原型编辑器。当前为 **0.1.0 开发版**。

本分支保存截至 2026-10-21 已完成并验证的源码，新增选择控件文字测量、SVG 显示、Inspector 尺寸、文字自适应及指示器左右切换。本轮源码尚未完成 Windows 打包和全量浏览器验收；此前已验收的组缩放 Windows 发行仍为上一阶段。

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
- 选择控件的文字测量、受限 SVG 指示器、尺寸与文字适配、左右位置切换和单次撤销。
- 保存/打开 `.rea.json`、预览、独立离线 HTML 及实验性 Axure `.rp` 只读子集导入。

## 验证与边界

最新源码阶段通过 5,469 项单元测试、29 项专项生产浏览器检查；856 项读取器检查在输入未变的前提下沿用。详见 [最新源码验收](research/selection-author-verification.json)、[本次提交记录](docs/github-milestone.json) 和 [实现范围](docs/implementation-status.md)。此前组缩放 Windows 发行的记录见 [已发布阶段验收](research/layer-resize-verification.json)。

P94 作者入口、尺寸手柄、容器局部坐标、复杂绘制、完整 Axure 功能、原生文件写回、云协作及原版 GUI/逐像素对照仍未完成。通过本项目测试不代表完整 Axure 兼容。

## 测试与数据

运行 `npm test`。部分原生导入测试需要在 `research/samples/` 自行提供对应的原始 Axure 样本。大型研究数据使用 Git LFS；原厂程序、私有样本、依赖目录和打包程序不随源码发布。字体及其他第三方资源保留许可证和声明。
