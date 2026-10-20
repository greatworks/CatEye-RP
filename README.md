# catEye-RP

对照 Axure RP 11 研究并独立实现的 Windows 原型编辑器。当前版本 **0.1.0 开发版**。

本分支保存 2026-10-20 已验收的嵌套组缩放与约束阶段；选择控件布局等后续开发未包含在本里程碑。

## 运行

需要 Node.js 和 npm。

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
- 保存与打开 `.rea.json`、预览和独立离线 HTML 导出。
- 实验性 Axure `.rp` 只读子集导入。

## 验证与边界

该阶段验收记录包含 4,712 项单元、841 项读取器、332 项生产浏览器测试及 13 组 Windows 包检查通过。详见 [阶段验收](research/layer-resize-verification.json) 与 [实现范围](docs/implementation-status.md)。

尚未完成完整 Axure 功能、原生文件写回、云协作及原版画布/逐像素对照。通过本项目测试不代表完整 Axure 兼容。

大型研究数据使用 Git LFS。原厂程序、私有样本、依赖目录和打包程序不包含在源码仓库中。字体及其他第三方资源保留其许可证和声明。

## 测试

运行 `npm test`。部分原生导入测试需要在 `research/samples/` 自行提供对应的原始 Axure 样本；这些样本不随源码发布。完整样本要求及历史摘要见研究证据和测试文件。

本次上传前重新构建，6 个生产文件与已验收版本字节一致。使用本机样本执行 4,712 项单元测试，其中两项在并发运行时超时；两份相关测试文件以单进程和 30 秒上限复验，30 项全部通过。
