# 阴影：实现与证据边界

本阶段继续 Axure RP 11 复刻目标，补齐跨画布、运行时和原生导入的阴影样式。当前产品仍不是完整 Axure 替代品。

## 使用与保存

Style → Shadows 提供 Outer shadow、Inner shadow、Text shadow。Offset X/Y 是像素偏移，Blur 是模糊半径，Color 可含透明度；Inner shadow 另有 Spread。每个阴影独立启用或关闭。关闭保留其参数，便于重新启用。

Interactions → Style effects 与 Set style 的 Override 决定是否覆盖该种阴影。取消 Override 恢复下层样式；保留 Override 而关闭 enabled 则明确关闭下层阴影。三个阴影是独立的整对象，状态之间不会混合子字段。自适应视图清除基态阴影时保存明确的关闭值，复制和组件实例不共享可变参数对象。

旧工程不补写阴影。模型严格校验字段及安全颜色语法；偏移允许 -1000 至 1000，Blur/Spread 允许 0 至 1000。范围是本产品支持范围，未证明等于原版作者界面的限制。

演示：[工程](../artifacts/shadow-demo.rea.json)、[离线 HTML](../artifacts/shadow-demo.html)。演示包含表面、内阴影、文字、三角路径、输入框、嵌套元件、中继器行和内嵌页面。演示内容由本项目独立创建。

## 绘制与兼容

表面阴影使用 CSS box-shadow；矢量外阴影针对 SVG 轮廓，内阴影使用 SVG 过滤器。文字阴影只绘制本元件文字，不把整个父容器及其子元件一起投影。每次重绘明确清除已关闭的效果，运行时操作不写回工程初值。阴影不扩大保存的宽高与布局框。

父级裁切保持既有规则。图片、线条和动态面板只开放外阴影，框架和热区不开放阴影控制；无文字的容器不开放文字阴影。表格单元格与树标签可编辑，整表根和树节点根沿用既有受限作者流程。仍保存但未支持绘制的属性明确列为保留值。

原版生成器中部分路径会将外阴影模糊值减半，动态面板背景路径只传外阴影；完整类型/生成目标仍未全部恢复。因此普通矩形、表单和图片容器的 CSS 绘制仍是明确的实现选择，不能声称所有生成模式与原版逐像素一致。详见 [运行时证据](shadow-runtime-evidence.md) 与 [格式证据](shadow-format-evidence.md)。

## 证据与未完成部分

原始程序为已保留的官方 Axure RP 11.0.0.4150。托管程序集 SHA-256：`dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。提取 Evidence：`ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。

原版脚本的定向实验见 [原函数探针](shadow-runtime-probes.json)，它在 NodeVM 中执行精确提取的原函数，并模拟 DOM/CSS 接收端。真实浏览器测试只证明本项目的实际行为；不把这两类证据说成原版 GUI 或逐像素等价。

本轮重新定位原版 `Untitled` 窗口成功，可读取菜单树。点击 View 返回 `coordinate input geometry is unavailable`；按恢复流程重新定位后，截图返回 `FrameArrived timed out: timed out waiting on channel`。因此未继续使用旧坐标或控件索引。

原生存储含 On、OffsetX、OffsetY、BlurRadius、Color、Spread 六字段，没有凭空加入角度/距离转换。实际样本的明确外阴影与状态阴影按确定性条件恢复；缺乏有效覆盖证据的值不自动成为可见样式。完整原生自适应/样式继承、原版作者默认值、所有形状及原版像素对照仍待完成。最终测试与包哈希见 [验证记录](shadow-verification.json)。

11 份原生样本中，1,731 个已导入元件保留确定的阴影字段，其中 123 个样式对象启用外阴影（105 个基态、18 个状态）。没有把内阴影或文字阴影的非活动快照误当成启用值。新增恢复 6 个选中变化事件、12 个指向已恢复目标的动作；已有元件数量、树、菜单、表格、链接与内联框架结构不变。[审计记录](shadow-format-import-audit.json) 包含逐项归因。

独立复查重现并修复了两项问题：无效颜色会被 CSS 忽略并留下旧阴影，现仅允许明确的命名颜色、正确长度的十六进制及支持的 RGB/HSL 语法；普通 HTTP 页面缺少 crypto.randomUUID，过滤器实例 ID 已改用 getRandomValues。真实 Edge 的非安全 HTTP 根页面和嵌套导出页面均列入回归。
