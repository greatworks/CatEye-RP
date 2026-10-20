# 自适应放置、取消放置与恢复

此阶段补齐普通控件的 Place/Unplace 流程。完整 Axure RP 11 重建仍未完成，原版桌面画布和像素对照仍未通过；这份说明不把局部功能完成当作整体等价。

## 使用

Outline 保留未放置对象，用红色状态和独立的 Place in view 按钮恢复。眼睛按钮控制 Hidden，与放置状态分别保存。当前视图的放置声明沿父级继承；显式 Place 能覆盖父视图的 Unplace。

在子视图按 Delete 会取消放置；在 Base 删除或使用 Edit → Delete from All Views 则实际移除对象。Edit 提供 Place/Unplace in All Views，写 Base 并清除各视图同一对象的放置声明，其他位置、外观和状态效果不变。“Placement and insertion: all views”只控制放置、新增与删除，通用 Affect All Views 样式编辑仍待实现。默认在子视图新增的对象只出现在该分支。操作支持撤销、保存和重新打开。

## 数据与运行

`placed?: boolean` 缺省为放置。旧工程不补写此字段；显式 true 和 false 都保留。取消放置不会删除文档节点、交互目标或子项。表格、菜单、树只允许整体的局部放置声明；结构内的单元格和节点继续遵守共享结构限制。

预览和离线 HTML 使用同一运行器。未放置对象保留 DOM 和控件值，但不显示；它自身不能成为普通路径动作的目标。普通面板中的子项仍有自己的目标身份，实际显示和聚焦受父容器约束。放置切换本身不发 Show/Hide。容器自适应尺寸和重复器刷新排除相应未放置内容。保持内联框架实例是本产品的实现策略；原版框架在此状态下的完整网络生命周期未实测。

## 原生导入边界

原生属性 P111 是 `BoolOverride` 数值枚举：IGNORE=0、TRUE=1、FALSE=2。原生成器把有效声明的 `value == 1` 取反生成 limbo，因此有效的 0 不等于缺省。产品严格核验原始类型、Overridden/Determined 标志和来源；普通 Boolean 不是该载体。

当前恢复 RP11 包版本 `[11,0,0,0]` 中可独立归因的直接 Base MyStyle 与局部自适应声明。非默认命名/缓存提供者链、原生 Layer/master 特殊传播和 contained 子对象不作泛化恢复。11 份固定原始样本含 1,598 条 P111，全部为数值 1，位于缓存、默认样式、格式刷或非激活的状态样式；没有直接 Base/local 未放置正例。

[演示工程](../artifacts/adaptive-placement-demo.rea.json) 来自独立编码的 SYNTHETIC 原始 RP：目标在 Base 放置、Tablet 取消、Phone 显式恢复；另一对象在 Base 未放置、Phone 恢复。它验证真实读取器、导入器、保存和播放器之间的接口，不证明 Axure 能读取这些测试字节，也不提供原生写回。

## 证据与验证

- [作者命令证据](adaptive-placement-authoring-evidence.md)：官方流程、原 DLL 的静态 CIL、事务与属性清理范围。
- [运行证据](adaptive-placement-runtime-evidence.md)：保留原函数的 55 项 NodeVM 检查和 8 项隔离 Edge DOM 检查；不是完整原版生成工程或桌面交互实测。
- `adaptive-placement-format-*`：原枚举、转换与生成链、11 文件清点以及严格读取边界。
- [完整原文件比较](adaptive-placement-corpus-audit.json)：与实施前固定的完整文档及导入报告逐项比较。
- `release/verification.json` 只在通过当前源码、生产构建、桌面包及 ZIP 校验后更新；本阶段最终结果同时保存在 `adaptive-placement-verification.json`。

Layer 特殊恢复、RDO/master 独立集合、剪贴板视图声明迁移、通用全视图样式修改、完整原生文件写回、原版 GUI 与逐像素等价仍需后续证据与实现。
