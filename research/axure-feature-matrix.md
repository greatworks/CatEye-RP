# Axure RP 11 功能证据与验收矩阵

调研日期：2026-10-13（Asia/Shanghai）  
范围：Axure 官方产品页、更新记录及当前官方参考文档。  
证据类型：**官方文档观察**。本报告没有执行 Axure、反编译原程序或验证兼容性；“验收”列均是建议的未来测试，不能据此声称已经实现。

## 版本基线与结论

官方更新记录当前列出的最新 RP 11 正式版本为 **11.0.0.4150，2026-09-24**；RP 11 最初发布条目是 2024-10-07。后续版本新增了本地只读 MCP、Windows Snap 支持和 Mac 渲染优化。因此，“RP 11 一样”不能只参照最初发布界面。[官方更新记录](https://www.axure.com/changelog?filter=Axure+RP)

从公开行为可以把产品拆成：**可视化文档编辑器、声明式交互编辑器、浏览器原型运行器、可复用组件与数据模型、发布/团队服务、文件与外部工具互操作**。这是一种重建所用的架构推断，不是对原程序源码架构的断言。

完成标准须分别记录界面接近程度、编辑行为、原型运行行为、文件互通、云端服务、平台支持。只画出类似界面或只支持按钮跳转，不能代表全产品等价。

## 功能矩阵

状态说明：以下所有条目均为“文档已证实 / 重建实现与原软件对照尚未验收”。每行 ID 可用于后续功能台账和自动化测试映射。

### A. RP 11 新增能力

| ID | 官方能力 | 建议验收 |
|---|---|---|
| N01 | `/` Quick Actions：插入控件/组件、页面跳转、应用样式 | 在画布、组、面板内分别呼出；插入目标和搜索结果正确 |
| N02 | Gallery：页面/组件概览 | 缩略图、搜索、类型筛选与打开目标一致 |
| N03 | Apply Style、停用事件/案例/动作 | 临时停用后不执行，恢复后顺序和配置保留 |
| N04 | 直接定位组件、组件直接绑定事件、替换组件 | 事件作用于选定实例，不误改其他实例 |
| N05 | Variable Changed | 变量动作更新后触发所配事件 |
| N06 | 样式过渡、Transform、缩放动画及缓动 | 开始/结束外观、时长、原点和最终几何正确 |
| N07 | 网格分布、等距间隙、重排/交换 | 数值设定与拖柄操作产生相同结果 |
| N08 | 控件模糊/背景模糊、清除样式覆盖、移动触控光标切换 | 覆盖可还原；背景模糊只影响后方内容 |

N01–N08 的新增属性来源：[RP 11 升级说明](https://www.axure.com/upgrade-to-11)。组/面板内 Quick Insert 的后续增强来源：[更新记录](https://www.axure.com/changelog?filter=Axure+RP)。具体语义继续参照下列各模块文档，不能只按营销标题实现。

### B. 编辑环境、页面与基础控件

| ID | 能力和必要行为 | 建议验收 | 官方来源 |
|---|---|---|---|
| E01 | 中央画布；工具栏；Pages、Outline、Libraries、Components、Style、Interactions、Notes；面板停靠/浮动与深色模式 | 重排界面、开关面板及主题后仍可编辑；记录对照截图 | [Environment](https://docs.axure.com/axure-rp/reference/environment/) |
| E02 | 页面/文件夹增删改名、层级重排、标签页、Gallery；改名保持页面链接；第一页面为入口 | 建立多层页面，改名/移动后所有链接仍指向原页面 | [Managing pages](https://docs.axure.com/axure-rp/reference/managing-pages/) |
| E03 | 拖放、坐标/尺寸输入、锁定比例、多选、群组、图层、对齐与分布 | 多选整体变换与逐项数值修改分别对照；图层改变也检查表单 Tab 顺序 | [Organizing widgets](https://docs.axure.com/axure-rp/reference/organizing-widgets/) |
| E04 | 网格、页面/全局参考线、吸附、距离辅助线 | 网格隐藏时仍可吸附；预览不显示编辑辅助线 | [Grid, guides, snapping](https://docs.axure.com/axure-rp/reference/grid-guides-snapping/) |
| E05 | 矩形/圆形/按钮/文本等形状、钢笔曲线、向量点、布尔运算、旋转；SVG 转形状 | 编辑曲线与合并/相减等路径后，保存和预览不变形 | [Shapes](https://docs.axure.com/axure-rp/reference/shapes/) |
| E06 | 图片、热区、线/箭头、Inline frame、文本框/文本区、下拉/列表、复选/单选、树、表格、菜单、快照 | 为每类建立可编辑、可保存、可预览样例；不能把所有类型当矩形 | [Basic widgets 目录](https://docs.axure.com/axure-rp/reference/shapes/) |
| E07 | 流程图、连接点及随节点移动重排的连接线；页面结构自动生成流程图 | 移动节点保持连接；引用页面改名同步反映 | [Flow diagrams](https://docs.axure.com/axure-rp/reference/flow-diagrams/) |
| E08 | 自动备份与恢复；默认 15 分钟备份、保留 30 天，间隔可配置 | 模拟未保存修改和恢复，恢复前另存，不覆盖当前文件 | [Auto-saved backups](https://docs.axure.com/axure-rp/reference/auto-saved-backups/) |

### C. 交互与原型运行语义

| ID | 能力和必要行为 | 建议验收 | 官方来源 |
|---|---|---|---|
| I01 | Event → Case → 有序 Actions；案例可命名、重排、多目标 | 同一事件执行设置文字→等待→跳转，验证顺序；多无条件案例按生成器配置出现选择菜单 | [Events, cases, actions](https://docs.axure.com/axure-rp/reference/events-cases-actions/) |
| I02 | 页面/控件鼠标、键盘、加载、焦点、选中、尺寸/位置变化；类型专有事件 | 事件适用列表因控件变化；Page Loaded、Widget Loaded、Window Resized 的顺序要对照 | [Events list](https://docs.axure.com/axure-rp/reference/events-list/) |
| I03 | 条件比较；All/Any；IF/ELSE 链 | 表单空/有效/无效输入分别命中正确分支；链中一项成功后不执行后续 ELSE | [Conditional logic](https://docs.axure.com/axure-rp/reference/conditional-logic/) |
| I04 | 跨页全局变量；动作/条件内局部变量；默认值与重置 | 页面 A 输入→全局变量→页面 B 展示；局部变量不泄露到其他动作 | [Variables](https://docs.axure.com/axure-rp/reference/variables/) |
| I05 | `[[...]]` 表达式、数学/字符串/日期/控件与中继器相关函数 | 为官方函数目录建立分组测试；非法表达式明确报错，不静默变空文本 | [Math, functions, expressions](https://docs.axure.com/axure-rp/reference/math-functions-expressions/) |
| I06 | 链接/iframe/锚点；显隐、面板状态、文字/图片、选择/错误/禁用、位置/旋转/尺寸/图层/样式/透明度/焦点；变量及数据动作 | 动作的编辑值、保存值、运行结果一致；重新加载复位 | [Actions list](https://docs.axure.com/axure-rp/reference/actions-list/) |
| I07 | Wait、Fire Event、Raise Event、切换自适应视图 | 等待不会阻塞整个运行器；手动触发事件执行正确目标 | [Actions list](https://docs.axure.com/axure-rp/reference/actions-list/) |
| I08 | Hover、Pressed、Selected、Disabled、Error、Focused、Hint 样式；状态退出后还原 | 叠加选择/悬停/禁用状态，按真实软件确定优先级并加回归测试 | [Style effects](https://docs.axure.com/axure-rp/reference/style-effects/) |
| I09 | 淡入淡出、缩放、滑动、翻转；缓动、时长、变换原点 | 同一固定时间线捕获起点/中间/终点；中断、连续触发须另实测 | [Animations](https://docs.axure.com/axure-rp/reference/animations/) |
| I10 | 预览播放器：页树、视图切换、备注、变量控制台、交互 trace | 能看到变量变化、条件判断和事件顺序；重置变量有效 | [Prototype player](https://docs.axure.com/axure-rp/reference/prototype-player/) |

### D. 动态面板与中继器

| ID | 能力和必要行为 | 建议验收 | 官方来源 |
|---|---|---|---|
| D01 | 多状态容器；当前只显示一个状态；新增/复制/删除/重排/全部状态视图 | 三态标签页：编辑非当前态不污染当前态；预览仅一态可见 | [Dynamic panels](https://docs.axure.com/axure-rp/reference/dynamic-panels/) |
| D02 | Fit to content、内部滚动、100% 宽、固定浏览器位置；拖动/滑动 | 长列表内部滚动；滚动页面时固定头部不移动；100% 宽不擅自拉伸内部控件 | [Dynamic panels](https://docs.axure.com/axure-rp/reference/dynamic-panels/) |
| D03 | 切指定/前一/后一状态、循环、停止；内部控件同名事件优先于面板事件 | 轮播循环/停止；点击内部按钮不额外执行父面板相同事件 | [Dynamic panels](https://docs.axure.com/axure-rp/reference/dynamic-panels/) |
| R01 | Repeater = 单个 item 模板 + dataset；文本/图片列绑定；从表格粘贴数据 | 5 行数据各渲染一份模板；修改模板同步到每行 | [Repeaters](https://docs.axure.com/axure-rp/reference/repeaters/) |
| R02 | 添加/更新/删除/标记/取消标记行 | 仅目标行变化；其他数据、选择和绑定不被覆盖 | [Repeater actions](https://docs.axure.com/axure-rp/reference/actions-list/#repeaters) |
| R03 | 排序、筛选及其移除、分页和每页数量 | 数值/文本排序，组合筛选，空数据和末页边界分别检查 | [Repeater 参考目录](https://docs.axure.com/axure-rp/reference/repeaters/) |
| R04 | Item Loaded 与 Item Resized；数据变更会重新触发 Item Loaded | 数据更新后的文本、样式和运行时行状态符合对照结果 | [Repeater events](https://docs.axure.com/axure-rp/reference/events-list/#repeaters-only) |

### E. 组件、样式、可复用库

| ID | 能力和必要行为 | 建议验收 | 官方来源 |
|---|---|---|---|
| C01 | 组件定义与实例；定义修改同步所有实例；文本/图片覆盖；脱离 | 两页同一导航组件同步；实例覆盖和脱离实例不被错误覆盖 | [Components](https://docs.axure.com/axure-rp/reference/creating-and-using-components/) |
| C02 | 固定组件位置/任意放置/脱离放置；批量添加/移除；使用报告；组件替换 | 固定位置的组件不能重复放置到同一页；使用报告准确 | [Components](https://docs.axure.com/axure-rp/reference/creating-and-using-components/) |
| C03 | Component Views 的继承与局部覆盖 | 子视图改颜色后父视图改色不会覆盖它；文字/备注/交互跨视图共享 | [Component views](https://docs.axure.com/axure-rp/reference/component-views/) |
| C04 | 组件实例或内部控件可被外部动作定位；Raised Events 提供组件对外事件 | 同一组件两个实例回调不同操作，无实例串扰 | [Components / Interactions](https://docs.axure.com/axure-rp/reference/creating-and-using-components/#interactions) |
| S01 | 字体/段落、渐变/图片填充、边框、圆角、透明度、内外阴影、模糊 | 多文本样式及透明度叠加对照；保存后外观一致 | [Styling widgets](https://docs.axure.com/axure-rp/reference/styling-widgets/) |
| S02 | 命名控件样式集中管理、覆盖与还原、格式刷 | 更新命名样式影响引用对象；清除覆盖恢复继承属性 | [Styling widgets](https://docs.axure.com/axure-rp/reference/styling-widgets/) |
| L01 | `.rplib` 本地/Cloud 库；自建交互控件、分类、图标、提示、库中样式 | 创建库→重启→加载→拖入新文件，样式与交互仍在 | [Widget libraries](https://docs.axure.com/axure-rp/reference/widget-libraries/) |

### F. 响应式/自适应

| ID | 能力和必要行为 | 建议验收 | 官方来源 |
|---|---|---|---|
| A01 | 视图集合、Base 与继承链，按宽度自动选择适合的最大视图 | 320/768/1200 视图，在 767/768/769 等边界切换 | [Adaptive views](https://docs.axure.com/axure-rp/reference/adaptive-views/) |
| A02 | 位置/尺寸/样式局部覆盖；文字、备注、交互共享 | 子视图改颜色后父视图修改仍保留覆盖；文字更改跨视图一致 | [Adaptive views](https://docs.axure.com/axure-rp/reference/adaptive-views/) |
| A03 | Unplace/Place 与全局删除有区别；Affect All Views；交互强制视图 | 子视图取消放置不删除 Base 控件；Base 删除影响所有视图 | [Adaptive views](https://docs.axure.com/axure-rp/reference/adaptive-views/) |

### G. 文档、发布与团队服务

| ID | 能力和必要行为 | 建议验收 | 官方来源 |
|---|---|---|---|
| P01 | 页面/控件备注、多个字段与集合、分配/取消分配、编号层级、关联文本/交互 | 更新控件后关联备注更新；播放器定位正确控件 | [Notes](https://docs.axure.com/axure-rp/reference/page-widget-notes/) |
| P02 | 预览与 HTML 生成配置：选择页面、备注、案例选择行为、页面引用选项 | 同一 fixture 的编辑器预览与导出 HTML 行为相同 | [HTML output](https://docs.axure.com/axure-rp/reference/customizing-html-output/) |
| P03 | Cloud 发布/更新项目、workspace、访问码、评论开关、分享链接 | 发布后独立浏览器读取真实链接；更新保持目标项目身份 | [Publishing](https://docs.axure.com/axure-rp/reference/publishing-axure-rp-projects/) |
| P04 | Word `.docx` 规格说明；页面、组件、截图、控件表、备注/交互、模板配置 | 导出可打开文档，页数/表格/截图/备注与选择项一致 | [Word specification](https://docs.axure.com/axure-rp/reference/word-specification/) |
| T01 | Cloud 中央工程+本地副本；页/组件等检出/检入、发送/获取更改 | 两用户：A 检出后 B 不可编辑；A 检入后 B 获取准确更改 | [Team projects](https://docs.axure.com/axure-rp/reference/team-projects-overview/) |
| T02 | 提交/发送产生修订；下载历史 `.rp`，导入并检入完成回滚 | 修订记录作者/时间/说明；下载旧版本并验证真实内容 | [Team history](https://docs.axure.com/axure-rp/reference/team-project-history/) |
| T03 | 升级旧团队文件有备份；恢复旧版本存在丢弃新版本改动的语义 | 在隔离测试项目升级/恢复；检查备份可打开 | [Upgrading team projects](https://docs.axure.com/axure-rp/reference/upgrading-team-projects/) |

团队功能在原产品需要 Team/Enterprise 版；这是产品范围事实，不代表重建工具必须采用同样收费策略。Cloud 评论、权限和账号服务应单独验收，本地模拟不能写成与 Axure Cloud 互通。

### H. 文件与外部工具互操作

| ID | 能力和边界 | 建议验收 | 官方来源 |
|---|---|---|---|
| F01 | 普通 `.rp`、库 `.rplib`、现代团队 `.rpteam`；旧 `.rpprj` 属于 RP 8 团队目录格式 | 每类使用实际样本识别版本、保存重开及跨工具往返；不能只换扩展名 | [Libraries](https://docs.axure.com/axure-rp/reference/widget-libraries/)、[Team upgrade formats](https://docs.axure.com/axure-rp/reference/upgrading-team-projects/) |
| F02 | 从 RP 文件导入项目内容；团队本地副本可导出独立 RP | 导入含页面/组件/交互/资源的 fixture，引用关系不失效 | [Backup import](https://docs.axure.com/axure-rp/reference/auto-saved-backups/)、[Team export](https://docs.axure.com/axure-rp/reference/troubleshooting-team-projects/) |
| F03 | Figma/Sketch/XD 官方插件通过复制/粘贴导入可编辑形状；SVG 转形状 | 保留文本、形状层级及尺寸；不把截图导入当作可编辑导入 | [Shapes import](https://docs.axure.com/axure-rp/reference/shapes/#import-from-figma) |
| F04 | 浏览器 HTML 输出、DOCX、备份与原生文件是不同交付类型 | 独立启动导出文件；检查不依赖开发服务器；原生格式另做互通测试 | [HTML](https://docs.axure.com/axure-rp/reference/customizing-html-output/)、[DOCX](https://docs.axure.com/axure-rp/reference/word-specification/) |
| M01 | RP 11 build ≥4147 的本地 MCP（实验性，只读）：开放文件/页树/控件/交互/备注/截图/当前选择 | 读取当前文档；关闭文件后不再可读；编辑请求不能改变原文件 | [RP MCP](https://docs.axure.com/axure-rp/reference/mcp/) |
| M02 | MCP 默认回环地址 `127.0.0.1:41414/mcp`；端口冲突可顺延；Windows 发现文件位于 `%LOCALAPPDATA%\Axure\mcp-server.json` | 本机 health 响应、实际 URL 与发现文件一致；不能误把 Cloud MCP 当 RP MCP | [RP MCP](https://docs.axure.com/axure-rp/reference/mcp/#troubleshooting) |

## 如何组织重建（推断与工程建议）

以下是根据可观察功能提出的实现结构，不声称 Axure 内部采用这些数据结构或技术栈。

1. **文档模型**：页面树、控件树、稳定 ID、嵌入资源、样式引用、组件定义/实例、视图覆盖、备注、交互 AST、数据集。避免把页面直接存成 HTML，因为编辑器还需要结构、引用和继承关系。
2. **编辑内核**：选择、变换、吸附、图层、组/容器、命令历史、剪贴板、序列化；撤销/重做须围绕同一文档事务，而非每个面板私有状态。
3. **交互内核**：事件分派→案例条件求值→有序动作执行→状态变化→后续事件；独立处理运行状态，防止预览修改写回设计文档。
4. **布局/样式解析**：组合 Base、视图覆盖、组件覆盖、命名样式、运行时样式与效果；精确优先级必须用原软件 fixture 锁定。
5. **统一渲染与导出**：编辑画布可有选区辅助层，但预览和 HTML 导出应共享解析器及运行器，降低两套行为分叉风险。
6. **持久化与恢复**：正式保存、自动备份、资源去重、格式版本迁移、失败时原文件保全；`.rp` 互操作独立做解析/生成适配器。
7. **团队/发布服务**：账号、权限、项目资源、修订、检出锁、分享与评论；不能用浏览器 localStorage 假装多用户协同。

这七层是全产品目标的分解，不是把目标缩减成网页画布。平台、云服务和文件互通未验收前应保持明确的待完成状态。

## 优先建立的端到端对照场景

每个场景应在相同固定版本的 Axure 与重建工具中各执行一次，保留输入项目、操作步骤、截图、运行日志、导出文件及版本。截图接近只证明外观，不能替代行为断言。

| 场景 | 关键验收 |
|---|---|
| 1. 登录原型 | 表单输入、条件 All/Any、错误态、焦点、变量、跳转；空/有效/无效三条路径 |
| 2. 三页原型文件 | 页面树/改名/重排、复制粘贴、撤销/重做、保存重启、链接与资源完整 |
| 3. 多状态标签与模态框 | 动态面板状态、固定位置、遮罩、内部点击覆盖父事件、关闭/重开 |
| 4. 数据列表 | Repeater 模板+5 行数据、编辑/删除、筛选、排序、分页、空结果；不得只演示静态重复卡片 |
| 5. 导航组件 | 两个实例、文本覆盖、组件更改同步、Raised Event、实例替换、脱离 |
| 6. 三断点页面 | 断点边界、继承与覆盖、Unplace、跨视图共享文字、手动/自动切换 |
| 7. 动画与样式 | Selected/Hover/Disabled 组合、Apply Style、Transform 原点、连续触发、中途关闭页面 |
| 8. 注释与规格 | 多备注字段、编号、页面/组件/状态截图、HTML 注释定位和 DOCX 文档 |
| 9. 文件互操作 | Axure 生成→重建读取→重建保存→Axure 重开；未知字段、损坏文件、大图片及中文路径 |
| 10. 团队与发布 | 两独立用户检出冲突/检入同步、历史恢复；独立浏览器访问发布原型、权限拒绝和评论 |
| 11. 桌面质量 | Windows 安装/启动/卸载、DPI、中文输入、剪贴板、快捷键、恢复；Mac 单独验收 |
| 12. MCP | 开放文档/选择/截图读取、关闭后移除、端口冲突、只读边界 |

安全/质量测试建议：外部链接/图片/iframe 的输入校验；表达式执行隔离；恶意导入文件不得任意执行代码或覆盖工程目录；大项目性能和低内存失败；云项目权限隔离；保存失败/断电恢复。以上是新实现的工程验收建议，并非官方文档证明的 Axure 内部实现。

## 已知缺口和待核验项

1. **原软件运行未核验**：本报告不能证明窗口尺寸、字体、图标、快捷键细节、鼠标命中、滚动/缩放手感或平台一致性。必须采集指定 RP11 build 的真实界面/行为。
2. **原生格式未解析**：官方文档证明文件用途，不公开 `.rp`/`.rplib` 完整序列化规格。不能据此承诺任意现有工程无损往返。
3. **版本/文档不完全一致**：Getting started 写四个内置库，而 Widget libraries 写五个并包含 Sample Form Patterns。[Getting started](https://docs.axure.com/)、[Widget libraries](https://docs.axure.com/axure-rp/reference/widget-libraries/) 主调查已在官方包提取内容 `DefaultSettings/Libraries` 确认五个库，包含 `Sample form patterns.rplib`（REA extraction Evidence `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`；包 SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`）。这是包资源观察，尚非本分工运行界面核验。
4. **精细运行语义未穷尽**：表达式全函数集、类型转换、样式叠加优先级、Wait 与动画并发/中断、事件重入、组件/面板/中继器多层嵌套、循环数据更新均需专门 fixtures。
5. **Cloud 和插件协议未核验**：公开用户流程不是服务端协议；原生 Axure Cloud 发布兼容性、插件剪贴板格式与账号权限仍未知。
6. **安装/授权未核验**：原程序依赖、真实许可证/试用状态由主调查确认；重建不包含绕过原产品授权的实现。
7. **补充导出需专项调查**：打印/PDF、图片导出、Web fonts、SVG 特性和各格式保真度未完整展开，不能标为覆盖完成。
8. **矩阵粒度**：本表覆盖主要功能族和关键验收路径，不是每个菜单项/属性/错误分支的穷尽清单；每个功能族还需对照安装包与运行器细化。

官方可获取的初始测试样本：[Animations.rp](https://docs.axure.com/assets/files/Animations-e3a9ee7e8dbc4fcc87ebd6d836b604a5.rp)，来自 [Animations 文档](https://docs.axure.com/axure-rp/reference/animations/)，对应嵌入演示 [xz03hr.axshare.com](https://xz03hr.axshare.com/)。本分工没有下载或运行该文件。

## 本次改动与验证

- 仅新增本 Markdown 调研报告；未编写应用代码、修改全局配置或发布外部内容。
- 已逐类读取官方参考文档与版本记录，链接使用一手来源。
- 未运行原应用、未进行重建测试；矩阵中的建议场景都保留为待验收。
- 后续以主调查获得的安装包、官方样例、静态结构及运行证据补齐缺口，再更新功能台账。
