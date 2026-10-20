# 节点提交：轮廓筛选与旋转边界

本轮修正节点编辑的外框计算：远处的退化轮廓不再撑大有效曲线的外框；只剩一个节点的路径可提交；极小旋转和整周旋转按原版尺寸框及分支规则处理。所有原节点、控制柄、子路径顺序与填充规则仍保存，当前视图几何、共享路径、AutoFit 和撤销事务保持既有约定。

这是独立编辑器的一次局部补齐，完整 Axure RP 11 复现仍未完成。原版窗口标题 Untitled 可读取，但本轮两次截图请求分别返回 FrameArrived 与 window capture 超时；没有原版画布、交互或逐像素对照结果。

## 证据与规则

- [旋转证据](native-point-contours-rotation-evidence.md)与[数值矩阵](native-point-contours-rotation-fixtures.json)：尺寸框在绝对角度严格小于 1e-5 度时先成为无旋转框，再把归一化控制点转成世界坐标。整周角度保留旋转分支身份；三角几何使用原版带符号余数和特殊角度判断，不能用统一正模替代。
- [轮廓探针](native-point-contours-topology-probes.json)：临时曲线集合按原版顺序建立和筛选。端点与有效控制柄的 Manhattan 距离严格小于 .001 才构成退化判定；单独剩余曲线还有独立端点检查。未旋转与旋转分支的参与筛选、空集合回退分别处理。
- 无有效曲线的未旋转路径使用整个输入的第一个原锚点回退，跳过普通外框向外舍入后直接扩充最小尺寸；有曲线时，孤立锚点不参与外框。旋转分支保留其不同的零矩形回退，不能借用未旋转的首点规则。
- [作者模型分析](native-point-contours-authoring-analysis.md)：测量集合与保存命令分离，不改变 vectorSegments 的命中、插点或逻辑节点索引，也不扩大持久格式。

原始程序集为 Axure RP 11.0.0.4150，SHA-256 dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7。研究只读取元数据和 CIL；受限指令回放中的存储、集合或数值计算替身均在各报告中注明。静态回放和独立数值组合不等同于执行原厂 DLL。

## 实现与兼容

核心变化集中于 vector-commit 及其测量辅助函数；M/L/C/Z 投影到原生临时 carrier 是本产品可表达子集的适配。开放轮廓的临时闭合边只用于已证分支，不写回原命令。空命令数组仍由严格 schema 拒绝。普通导入器、播放器、工程格式与依赖未因此扩展。

演示工程：[编辑后工程](../artifacts/native-point-contours-demo.rea.json)、[离线页面](../artifacts/native-point-contours.html)。主矩形远处有一条 .0005 像素长线段，移动主节点后外框为 50,100,250,100，所有七条命令仍存在。Windows 包另验证单节点数值编辑、最小外框、单次撤销、重做及从不同文档状态重新打开。

## 验证

修复前专项 85 项中 26 项失败，59 项通过；红测原始输出保留于 .build/native-point-contours-unit-red.json。按已证合同更新旧断言时，原文件保留在 .build/before-native-point-contours。

独立复查另发现小数单节点的舍入分支遗漏：世界节点 12.25,30.75、描边 1 时，原版 X 为 11，首轮实现为 12。新增红测保留于 .build/native-point-contours-fallback-red.json；修正前的 3656 项全绿结果与候选包另存 .build/native-point-contours-before-fallback-fix，未作为最终验收。

- 类型检查通过；全量单元 3657/3657，150 个文件。
- 原生读取器 698 项通过。
- 完整生产浏览器 301 项通过，无失败、跳过或 flaky。
- 同一 Windows 候选包 9 组桌面检查通过；本轮主场景 11 次保存回读、一次离线导出、三张截图，并检查没有脚本错误或网络请求。
- 独立检查：retainedCilRotation=126；retainedCilTopology=65；independentRotationModel=69；boundedArithmeticOrder=231；independentTopologyModel=71。

执行入口：node .build/run-native-point-contours-checks.mjs；node .build/run-native-point-contours-browser.mjs release-final；node scripts/smoke-native-point-contours.mjs <候选 exe>；node .build/run-native-point-contours-smokes.mjs。构建来源、ASAR 内容、原报告哈希及 ZIP 全部文件的校验由 .build/verify-native-point-contours.mjs 和归档校验脚本完成；实际发行标识见 [最终验收](native-point-contours-verification.json)。

## 尚未完成

原版画布及像素一致性；任意原生断口/无效闭合控制柄；一般变换矩阵、缓存角度来源及完整旋转作者约束；RN4I 等其他操作的跨视图副作用；隐藏边框/旧独立圆角参数形状的节点编辑；原生 RP 写回、协作及其余完整产品功能。播放器使用既有 SVG/CSS 绘制，并未因本次作者测量修正而声称原版绘制等价。
