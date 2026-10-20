REA Prototype Studio {{VERSION}} — Windows 便携开发版

嵌套组：Ctrl+G 建立有独立标识的组，Ctrl+Shift+G 解组；双击组编辑成员，Outline 可选择组内元件，Exit 返回所属容器。移动组保持成员坐标关系，支持复制、撤销、保存重开。
Group 属性的 X/Y 移动成员；拖动八个尺寸手柄或修改 Group width / Group height 缩放已支持的成员。缩放仅写当前视图，即使勾选 Affect all views；一次拖动对应一次撤销，Escape 取消。组内可以嵌套组，成员坐标仍属于原容器。
Style > Resize pins 设置水平/垂直约束及固定宽高，约束属性本身遵循当前/所有视图设置。含动态面板、中继器、表格、菜单、树、复选框等尚未闭合作者尺寸规则的组暂不缩放；组与普通元件混选也会整次拒绝并说明原因。整组作者旋转和 Shift 比例锁定仍未开放。Propagate 控制悬停与按下样式传播，选中状态递归独立处理。
组可以作为 Move / Set size / Rotate 等动作目标，预览、离线 HTML 与内部框架使用同一运行时；中继器中的组按行隔离。
实验性原生导入恢复 182 个完整 Layer 和 13 个组点击交互，并从已验证的样式来源保留缩放约束。未支持的属性、成员或交互仍在导入报告中列出。原生中继器内部组、部分 fit 面板、完整作者行为与原版画面对照仍有限制。

自适应放置：Outline 的 Place in view / Unplace from view 分别恢复或取消放置，与隐藏分开。
子视图按 Delete 取消放置；Base 中 Delete 或 Edit > Delete from All Views 才移除整个对象。
Edit 中的 All Views 放置命令写入 Base，并只清除各视图的放置声明；其他局部样式保留。支持撤销、保存和重新打开。
“Affect all views”控制普通位置、尺寸、样式以及放置、新增和删除。关闭时在子视图新增只出现在该分支。
全视图编辑按修改的属性写入 Base，并清除活动及非活动视图的对应声明，其他属性保留。位置按完整 X/Y、尺寸按完整 W/H 应用；相同有效值不自动清理覆盖。
文字内边距按边分别保存和继承：修改右边距不清除其它三边。旧工程的完整内边距仍可读取；改单边后使用稀疏声明保存。
已有状态效果的编辑会将当前整张效果图应用到全视图；当前无任何效果时首次添加仅写当前视图，后续修改走全视图。此特例来自原版静态代码，未以原版画布实测。
旧任意四角半径、四边宽度仍作为本产品扩展保留。原生独立圆角半径和可见掩码已支持；表格边框命令及 Layer/master 特殊作者操作仍有缺口。
预览和离线 HTML 保留未放置对象的 DOM 与输入值。普通 Show/Hide 动作不能恢复未放置目标；切换视图不会额外触发 Show/Hide。
实验性 RP 导入恢复可独立归因的 Base 与局部放置枚举；未证实的命名/缓存链、原生 Layer/master 传播不承诺等价。
11份原始样本没有直接的未放置正例；放置导入演示使用明确标注的 SYNTHETIC 测试文件，不代表原版生成或原生写回。

实验性原生自适应导入：File > Import Axure .rp 读取完整定义的共享集合、页面指派、局部位置/尺寸/显隐/外观、Set adaptive view 动作及页面视图变化事件。
普通空声明保持继承；显式清空状态效果会阻止祖先效果。没有定义的视图只保留为非活动数据，不补造尺寸或名称；不支持的有效属性与事件会出现在导入报告。
11份原始样本新增9个Flow图形及27条空局部记录。完整命名集合与动作的正例另以SYNTHETIC测试RP验证，不代表原版生成或原生写回。
原生设备预览光标只保留在导入来源报告；页面自适应背景、局部复合变换及完整原版GUI/像素对照仍未实现。

自适应视图：新工程按视图尺寸选择，先比较宽度，再以高度区分同宽视图。Base有独立尺寸，默认0×0；例如Base设1200×0、Mobile设390×0，可分别表示桌面和手机。
画布上方的Width、Height编辑视图尺寸；Inherit from指定父视图，新增视图默认继承当前视图。子视图仅保存本地布局/样式变化，文字和结构共享。
Reset恢复父视图；删除父视图后其直接子视图接到上一层，支持撤销。尺寸0的画布轴借用页面尺寸显示。旧工程保留原max-width规则，点击Use view sizes显式切换。
自适应运行：页面初次加载和跳转前即按当前播放器尺寸选取视图，隐藏元件及非活动面板的 Loaded 同样读取该视图。
真正切换视图时恢复声明的位置、尺寸、显隐和样式；同一视图内调整窗口宽度保留动作结果。恢复显隐不会额外触发 Show/Hide。
普通元件保留运行时文字、输入和选中/错误/禁用状态。中继器切换视图时重建模板内容，保留对应行状态并恢复初始分页；普通排序/筛选刷新仍清除临时状态。
预览、离线 HTML 和内部框架共用这些规则；嵌套框架各自按自身宽高运行。原生组件专用视图、完整桌面及逐像素对照仍未完成。

原生形状文字：实验性导入保留 AutoFitWidth/Height 标志，文字层按内容自然增高，与保存的元件矩形分离。自动宽度不折行，但保留显式换行和段落；支持三种垂直对齐与四边内边距。
初始画布、预览、内部框架和离线 HTML 保持保存的元件矩形。旧工程未保存这些标志时保留旧布局。
原生普通形状的 Set Text 现按实际文字测量调整 AutoFit 开启的轴，再按对齐移动；保留首段首文字片段格式，换行仅拆 CRLF/LF，文字按字面安全绘制。
Interactions > Resized / Moved 可配置尺寸和位置事件；Resize 先看到新尺寸，再发生对齐 Move。自适应切换重测已登记实例；重复器普通数据刷新清除旧行状态。预览不会改变作者保存的工程。
本阶段仅支持具备原生标志及明确内边距、对齐设置的普通 box/ellipse/path；未加标志编辑控件，完整原版桌面及逐像素对照仍未完成。

旋转：Style > Layout > Rotate 设置中心旋转角度。拖动旋转控件的把手沿局部轴缩放，对侧固定；单轴拖动保留另一轴的小尺寸和小数值。框选按旋转后的矩形相交判断。
支持保存、撤销、嵌套预览和离线HTML；实验性原生导入新增12个已验证的旋转元件，保留原位置、尺寸、存储路径及小数角度。
一般组合变换、非中心作者原点和原版GUI/像素对照仍未完成；运行时 Rotate 动作的配置与范围见文末说明。

线条：Style > Line pattern 选择图案；开放路径和直线可设置 Start arrow / End arrow，矩形表面可设置 Visible borders。
工具栏 Line style 提供相同入口；状态和 Set style 分别覆盖图案、整对端点和四边显隐，取消 Override 恢复继承。
图案、端点、颜色、线宽分别保存。动态端点按当前样式重新生成；原版的部分旧几何缓存行为、复杂曲线扩边和逐像素一致性仍未复现。

渐变：Style > Fill type / Border type 分别选择填充或边框的 Linear gradient / Radial gradient，编辑点坐标、双轴及色标后 Apply，Cancel 放弃草稿。
选择 Solid 只清除对应渐变；状态与动作中的填充和边框覆盖可独立恢复继承。支持保存、撤销、自适应、预览及离线HTML。图片边框的线性渐变使用首个色标，径向渐变透明。
11份原生样本保留9个填充渐变，0个真实边框渐变；边框导入另有合成用例。RP11角度兼容占位按存储端点处理，旧版本非零角度、全部原版生成类型及像素对照仍待完成。

阴影：Style > Shadows 设置 Outer shadow、Inner shadow、Text shadow 的偏移、模糊和颜色；内阴影还有 Spread。
Style effects 与 Set style 可覆盖整套阴影；取消 enabled 显式关闭，取消 Override 恢复继承。支持保存、撤销、自适应、组件、预览与离线HTML。
矢量外阴影跟随路径，文字阴影只作用于本元件文字；父容器的既有裁切保留。图片/线/动态面板仅提供外阴影，框架/热区不提供阴影控制。
原生恢复限已验证的明确属性，完整样式继承与原版界面/像素对照仍未完成。

内联框架：Libraries > Inline Frame 新建，双击或 Style > Add frame target 选择项目页面、HTTP/HTTPS地址或本地文件。
Hide borders与Scroll控制实际框架；None/Video/Map/Custom预览图只出现在编辑画布。自定义图片嵌入工程，目标文件不自动复制。
Open link in frame动作可跳转指定框架或Parent frame。内部页面运行状态独立，外围编辑不重载框架；再次打开相同目标会重载。
外部内容需要联网，部分网站禁止嵌入。本地目标应在本地导出及兼容浏览器中使用；HTTP预览不能访问本地文件。
原生导入目前仅恢复已验证的默认空框架。完整原生目标/动作、导航变量快照与原版桌面操作尚未覆盖。

树控件：Libraries > Tree 新建；Style > Tree structure 添加子/兄弟节点，移动、缩进、删除子树及设置初始展开。至少保留一个节点。
双击节点文字编辑富文本；节点和文字保留独立身份。画布开合可保存/撤销，Outline临时展开不改初值。
预览点击文字选中并执行节点交互；点击箭头仅开合与选中。树外框保持保存尺寸，后续行重排。Expand/Collapse/Toggle tree node动作可控制节点。
树内容和样式跨自适应视图共享，只有整棵树的放置/隐藏独立。原生导入限已验证的默认树，完整树格式、特殊图标和原版桌面操作仍未验证。

菜单：Libraries > Horizontal Menu / Vertical Menu 新建。选择菜单项后，Style > Menu structure 可插入/删除/移动项，添加/删除子菜单和设置四边Padding。
Edit submenu 或 Outline 可打开子菜单编辑。每项支持独立富文本、样式、备注与交互；菜单的布局与内容在自适应视图间共享。
预览与离线HTML通过悬停展开子菜单，移出后收起。点击叶项不会自动收起或选中。菜单容器的Resize、Enable/Disable、Set Selected和Set Error不改变状态；Set Text应指向具体菜单项。
原生菜单导入只恢复已验证的零Padding、无子菜单样本；完整原生子菜单格式与原版桌面操作一致性尚未验证。

表格：Libraries > Table 新建；单击选格，Shift/拖动多选，双击或 Enter 原位编辑富文本。
灰色行列标题可拖动重排，边界可拖动缩放整行/列；Style > Table structure 可插入/删除/移动行列。单元格 W/H 作用于完整列/行。
Edit > Paste as table 将制表符分隔的文字变成新表；在已有表格粘贴只填已有格，不自动扩展。表格结构与单元格格式在自适应视图间共享。
各格保留独立文字、样式、名称、备注和交互。运行时 Set Text 指向单元格；Move 可独立移动一格，不重排其它格。Resize、Enable/Disable、Set Error 对表格及单元格不起作用；Set Selected 仅支持单元格。
尚无合并格、格内图片及运行时动态行列；原版边框接缝像素、整体缩放舍入和完整桌面交互仍未完成对照。

字体样式：Style > Text > Font style 可选择 Normal / Italic / Default (normal)。Style effects 可独立覆盖 Font style，Normal 会清除下层斜体。
字重和斜体独立；自适应视图、交互动作、保存与撤销均保留字体设置。Roboto 内嵌 6 种字重，Open Sans 内嵌 300、400、600、700、800 五种字重，各自包含正体和斜体，离线 HTML 同样可用。字体工具栏可直接选择这两种字体。
Style > Text > Edit formatted text：在画布原位编辑文字，可设置选区字体、字号、粗细、斜体、下划线、删除线及颜色；光标处设置格式用于后续输入。已有富文本双击进入。
Enter 新段落，Shift+Enter 段内换行；Done、Ctrl+Enter 或点击编辑区和工具栏之外提交一次修改，Cancel/Esc 放弃。编辑时 Ctrl+Z/Y 局部撤销/重做，各段可设置对齐/行距。这些提交约定尚未证明与原版相同。
原生普通文字保留字面内容；Text expressions 可显式启用表达式。预览与离线导出保留混合格式和空段，Set Text 保留首个文字片段的格式。
富文本选区可 Add hyperlink，进入链接后可 Edit hyperlink / Remove hyperlink。Link interactions 编辑完整点击条件和动作，Link MouseOver / MouseDown 编辑文字效果。链接操作保留已有片段格式。
Open URL 支持字面 HTTP/HTTPS 地址，Current window 在编辑器预览中复用独立目的窗口，New window 每次新建；离线 HTML 的 Current 跳转自身。目的窗口不加载本编辑器的桌面文件接口。
实验性导入现恢复 634 个富文本元件、2,149 个片段，新增 2 个含独立点击事件的原生链接元件。任一链接结构、动作或目标不支持时整文字元件跳过。Oblique、任意字体嵌入及完整原生富文本动作尚未实现。

Select 元件：Style > List options 逐项编辑选项与初始选择，保留空格、空项和同名项；Select presentation 可切换列表框，Allow multiple selection 启用多选。
Interactions > Set selected option 按值设置列表选择；Selected option 条件读取首个选中值。预览的临时选择不会覆盖工程初值。
实验性 RP 导入新增 28 个列表元件，包括 Personal information form 的国家/地区与省/州。原生复杂交互、列表回车提交、类型化数组表达式及原版下拉菜单像素仍未完整复现。

交互样式：选中元件后在 Interactions → Style effects 添加 MouseOver、MouseDown、Focused、Selected、Error、Hint、Disabled。
勾选要覆盖的颜色、边框、字号、透明度等属性；编辑时画布临时显示，Close effect 恢复普通外观。
取消属性勾选恢复继承，Remove effect 删除整项；工程保存和撤销保留效果配置。
预览中按住移出仍显示 MouseDown，松开还原。有非空 Focused 效果时排除鼠标效果，Selected 按属性叠加，Disabled 最后覆盖。
文本框/文本域可设置 Hint text、Hide hint after（输入或聚焦），提示不成为真实控件文本。密码框在提示期间显示普通文字，输入后恢复密码模式。
Error by default 设置初始错误；Set error state 动作支持 true/false/toggle/表达式。状态变化触发 Error set／Error removed，禁用控件忽略错误赋值。
Selected → Error → Hint → Disabled 按属性叠加。没有指定 Disabled 透明度时不统一减半。
原版完整默认表单样式、初始 Error 事件时机、特殊 Hint 样式的原生像素、效果转场与自适应效果继承尚未完成。
实验性 RP 导入可恢复有明确来源的 MouseOver、MouseDown、Focused、Disabled 颜色；复杂继承与不支持的属性会跳过，仍不支持原生 RP 写回。
RP 导入现可恢复受支持文本框/文本域的提示文字、策略及明确 Error/Hint 颜色，也可唯一匹配命名 Form Hint 颜色。带未支持内容的原生交互整条跳过。

运行：双击同目录 REA Prototype Studio.exe。请保留整个文件夹，不能只复制 EXE。

File > Open interactive example：打开带页面、表单、动态面板和中继器的示例。
左侧双击或拖入元件；右侧设置样式、交互、备注。
Style 可分别设置四个圆角，也可恢复统一圆角。
Style 可设置文字四边边距、垂直对齐和行高。
双击面板/中继器编辑其内容。View 管理移动端等自适应视图。
F5：预览。Export HTML：导出独立离线原型。
Ctrl+S：保存 .rea.json 工程。Ctrl+O：打开工程。
Pages 单击选中、双击打开；页面和文件夹均可包含子项。右键添加到目标前、后或内部，F2 改名。
拖动行上沿/中央/下沿分别移到目标前/内部/后；Ctrl+方向键调整顺序或层级，Tab/Shift+Tab 缩进/反缩进。
搜索保留匹配项的祖先，清空后恢复折叠状态。Delete 删除含子项的节点时先确认，至少保留一张页面。
页面树操作可撤销并随文件保存。顶部已打开页面标签可拖排和关闭，右键可关闭其它/全部标签；标签关闭不会删除页面。
标签顺序与页面树顺序独立。预览和离线 HTML 显示文件夹与子页面；树中最前面的实际页面是导出入口。
组件修改后用 Components > Update linked copies 发布到全部关联实例。

Interactions 按事件显示 IF／ELSE 链。Add branch 新增后续分支，New IF 新建独立条件链。
Branch 切换 IF 与 ELSE IF／ELSE，空条件 ELSE 为兜底；All／Any 按顺序短路判断。
每链只执行首个启用且命中的 Case，即使它没有动作或执行到 Wait，也跳过同链后续分支。
上下箭头调整同事件 Case 顺序，保留位置的组边界。旧工程原有的独立 Case 行为保留。
Project > Prototype settings 设置 Case 选择菜单，支持 Automatic / Always / Never，并随工程保存。
新工程 Automatic：至少两个启用 Case 且事件没有任何条件时显示菜单，选择只执行该 Case。
Always 的条件事件显示 Run event，点击时判断整个事件；Never 直接执行。
不同控件/行的菜单可以并存，Cancel 或 Escape 可取消。初始页面加载直接运行；控件/行加载仍按设置显示。
旧工程缺少该设置时按 Never 执行。原版菜单视觉、组合说明和复杂竞态仍待对照。
输入框可在 Style 切换 Text / Password；表单控件支持 Focus / Blur。
菜单自身移动或恢复焦点不触发新的焦点事件，用户点击和 Tab 切换仍触发。

中继器临时控件状态按行隔离。数据、排序和筛选刷新会复位临时状态，并按行执行 Item loaded 与子控件 Loaded。
需保留的值通过 Update repeater rows 写入数据，再用 Item.Name 或 Item loaded 恢复。
更新/删除支持当前行、全部行、已标记行、显示索引和匹配条件，包括被筛选及其他页的目标行。
Style > Enable pagination 设置每页数量和起始页；交互支持指定页、前后页、首尾页及每页数量/显示全部。
Mark/Unmark rows 的标记跨页、排序和筛选保留。Item loaded 中 Set Selected > expression > [[Item.isMarked]] 可恢复复选框。
Item.Repeater 提供 dataCount、itemCount、visibleItemCount、pageCount 和 pageIndex；Item 使用事件快照，TargetItem 读取当前值。
重新进入页面会恢复初始控件、数据、分页与标记，全局变量保留。
Add/Remove named filter 管理多条命名规则；同名允许重复，按名删除会一起移除，名字保留大小写和空格。
最后一条筛选的 All/Any/Smart 决定整体组合。Smart：同列 OR、不同列 AND、无列表达式额外 AND。
例如 [[TargetItem.Cost >= Minimum]] 会在刷新时重新读变量。输入框可用 [[contains(lower(TargetItem.Name), lower(This.text))]] 搜索。
Add/Remove named sort 支持数值、文本、区分大小写文本、自然顺序、年/月/日三种日期格式；新排序按列替换并优先，Toggle 反向旧方向。
初始规则放在 Loaded 事件；移除不存在的名称也会刷新。空名称只刷新，不移除。
旧单条筛选继续按 AND 额外应用，旧排序作为最低优先级；Remove all/Remove other 一并清除旧规则。
Wait 等待期间其他按钮、独立条件链和后续行继续执行；0 毫秒也会延后续段。
延时动作读取最新变量和数据列，Item.index 等信息保留触发时的值；重启或页面切换取消旧页面等待。
原版精确刷新边界、adaptive persist 与完整原生表达式仍未完成；.rp 导入尚不恢复中继器。

实验性 .rp 导入恢复部分存储/完整缓存继承矩形、文字、颜色、字号、圆角和面板状态。
导入还会校验原始 sitemap 的引用、父子关系与节点顺序，恢复文件夹和页面层级。结构未知或损坏时保留平面页面/元件并在报告说明，不猜测修复。
支持原生存储的椭圆/矢量曲线与复合轮廓、RP11省略空文本的图形，以及受限可编辑多行文本框。
椭圆与矢量使用保存的实际控制点。原版描边位移、端帽/箭头、像素对齐、完整生成类型与自动尺寸仍未复现。
多行文本框要求自动换行、非只读、无提示/提交绑定；初始文字含表达式分隔符时暂跳过。
文本框和多行文本框的预览/离线 Text changed 在输入时触发，同值通知和失焦不重复触发。
预览左侧页面列表支持滚动，可切换多页面工程中位于列表末端的页面。
图片只恢复原文件内通过校验的静态 PNG 与等比例矩形，可随工程保存并离线导出。
裁剪、九宫格、SVG、方向元数据、滤镜和交互换图不恢复。
自动尺寸元件仅保留存储矩形，不重新计算原版布局。报告列出跳过项、未知样式及来源。
已恢复明确保存的文字边距和垂直对齐；自动行距使用浏览器字体默认值，精确字体度量仍待原版对照。
已恢复受限的原生事件树、IF/ELSE、文本条件、无动画显隐和页面跳转；任一环节未知则整事件跳过。
Required Fields 可运行空值提示、焦点隐藏提示及成功跳转；UX 有 6 个页面链接可用。
导入条件标为 Native comparison，保持原版布尔字符串比较（例如 false 与空字符串相等）。
Tab Menu 支持完整两标签切换：选中组、独立蓝色样式、两状态内容及适应内容尺寸。
选择事件包括 Selected changed、Selected、Unselected；普通选择组与 Radio group 分开。
单选框支持指针与键盘选择，程序 Set selected 与用户点击按不同事件路径执行。
Fit to content 在预览/导出按当前状态可见子内容重算；编辑画布保留初始矩形，Resize 关闭 fit。
Quick Win 已恢复六个单选框及其组；目标面板含自动文字尺寸，相关交互仍跳过。
面板/中继器的 Set selected 容器传播、完整外观、复杂目标和组件仍未恢复；不写回原文件。零恢复时保留当前工程。

Interactions > Rotate：设置 By / To、方向、锚点、局部 X/Y 偏移、动画和时间。可选单个元件或同层组合，Rotated 事件可执行后续动作。播放中的变化不改工程初值；重复器各行与内部框架独立播放。
实验性原生导入恢复 3 条完整旋转交互；普通元件及已验证 Layer 子集支持 Move/Resize/Rotate 动画组合，完整原生生成行为与原版画面对照仍未完成。

本软件为独立重建中的开发版本，尚未达到 Axure RP 11 全功能等价。
Input type 支持 Text、Password、Email、Number、Phone、URL、Search、File、Date、Month、Time；切换保留设计文本。
预览和离线 HTML 使用浏览器输入值规则：非法数字/日期显示为空，Email/URL 自动处理首尾 ASCII 空白。
File 仅本地选择，不上传，也不把已选文件保存进工程；Set Text 空串可清除，不能用文字指定文件。File 不支持 Hint 或 Read only 限制。
Maximum length 仅约束文本、密码、邮箱、电话、网址和搜索输入；日期、月份、时间、数字及文件遵循浏览器控件行为。
原生库新增恢复一个 Phone 字段；导入仍为只读子集，不代表完整 .rp/.rplib 互通。
Style > Form properties 设置 Read only、Maximum length、Submit button；长度留空不限，0 禁止输入，Set Text 不截断。
回车按下阻止换行，松开触发绑定元件；同一中继器内提交定位当前行，不广播到其他中继器。
Interactions > Set focus 聚焦首个目标实例，Select text 选中文字；Focus/Blur 同步执行，Wait 尾段延后。
原生容器恢复新增四个实际只读输入；非零原生提交绑定与完整 Focus 事件仍按报告跳过。
完整 .rp 双向兼容、云端协作、复杂动画/样式及部分高级控件尚未实现。
本发布目录不包含 Axure 官方程序、资源或反编译内容。

空数据状态：有数据变为空时，符合原内部计数条件会执行一次 Item loaded 和模板 Loaded，不创建占位行。初始空表、重复空刷新、分页最后一页清空不触发。
可在 Item loaded 用 [[if(This.itemCount == 0, "No results", "Rows available")]] 设置外部提示。模板 Loaded 使用 This.Repeater 的计数。
无目标 Item 访问或无有效行的列访问保留 [[...]] 字面片段；普通目标的 Item.valid=false，缺叶元信息按受限表达式的 undefined 处理。
同步修改正在刷新的同一数据集会跳过，Wait 后可恢复数据；Wait保留无效Item，并在离开页面后取消。
外部模板动作只作用于当前显示的实例，每个目标独立计算 TargetItem；隐藏源数据仍可通过数据行选择器更新。
这些行为已按原函数边界取证，完整原型浏览器/原版界面、STO类型转换和嵌套空事件仍未完成对照。

共享视图：View set选择项目集合，New view set新建，Share page views把当前页面视图转为共享集合（旧max-width工程先点Use view sizes）。共用集合的页面共享尺寸/父级，各页控件覆盖独立。Manage view sets支持改名；删除集合前先切走或解绑引用它的页面。
状态效果：选中命名视图后，在Interactions > Style effects编辑该视图的效果；Use inherited effects恢复父级。空本地集合会阻断全部继承效果，普通布局样式仍沿父级合并。
运行控制：Set adaptive view指定Auto/Base/命名视图；固定视图不随窗口变化，Auto恢复尺寸选择。该动作终止当前case后续动作，后续独立IF仍执行。页面Adaptive view changed在实际换视图时触发，初次Named视图事件在Loaded之后、首批ItemLoaded之前。播放器下拉选择仅作用于当前页面，导航后恢复Auto。

Style > Layout 选择 Vertical / Horizontal；Wrap 按固定项目数换列或换行，H/V gap 分别控制两方向间距。Legacy 保留旧工程行为。
模板内 Resize this item 可设置本行宽高；宽高不勾选则保留，0 可折叠该方向。Item Resized 在布局更新后执行，与当前名义尺寸完全相同时不触发，普通刷新重置行尺寸。
Fit item to content 在子控件移动、尺寸、显隐和状态切换后适配；显式行 resize 不关闭 fit。固定文字修改不触发适配，固定面板、非活动状态和尺寸不变的面板阻断向上传播。
新建中继器默认纵向、零间距、内容自适应、透明无边框；模板尺寸由本应用模板决定，旧文件不迁移。
Style 支持四边独立边框与中继器四边 padding。采用 border-box；行尺寸变化保留已验证的边框累加，刷新复位。
This/Target 的 x/y/width/height/left/right/top/bottom 读取当前相对父容器几何，忽略旋转/阴影。行事件 This 指该行。
Item.Repeater 几何在首次读取时缓存，同次刷新共享，Wait 与菜单延续该快照；下次刷新换新对象。
原版默认 box-sizing 未完整证实；content-box、阴影、动画、自动文字尺寸和原版自适应行尺寸差异尚未复现。

显示缩放适配：边框和外框采用浏览器实际计算值；CSS赋值与表达式几何缓存分开保存，保留原函数尺寸舍入行为。

小数行尺寸和多行推移按浏览器实际读回处理；刷新还原初始尺寸。极小浮点差异可能使看似相同的请求再触发一次 Item Resized，与已验证的原函数行为一致。

Libraries > Path 新建路径；Style > Vector path 点击示意图节点或下拉选择，可修改节点与曲线控制点、增加/删除节点、建立子路径和闭合轮廓。
坐标采用元件尺寸百分比，缩放会调整整条路径，描边宽度维持像素单位；可选择非零或奇偶填充。
P 或 Ctrl+Shift+P 启用钢笔：单击布点、拖动创建曲点；点击首点闭合，双击或 Esc 完成开放路径。
Shift 约束控制柄为水平/垂直，Alt 独立调整一侧；完成一条路径只产生一次撤销记录。
选中矢量后用 Edit points 或 Ctrl+Alt+P，也可双击路径边缘进入节点编辑；拖动锚点/控制柄、点击边缘插点。
1 设置尖点，2 设置曲点，双击节点切换，Delete 删除节点；Done editing points 退出。每次拖动可独立撤销/重做。
节点提交按曲线实际范围重算外框并重新归一化；控制柄仍可超出外框。位置和尺寸只写当前视图，路径在各视图共享；Affect all views 不改变节点提交范围。旋转角度和文字自动适配标志保持原值。
已有普通矩形/椭圆不迁移；持有矢量路径的元件可使用路径节点编辑。严格验证并带有原生参数的矩形/胶囊形可另用圆角与边框控件；其他路径保留原始几何。尚不支持布尔运算与弧命令。

应用内置 Google Roboto 十二款和 Open Sans 十款字体；使用这些字体的离线 HTML 同时嵌入相应字形，包括表格、菜单、树节点和内联框架中的内容，不需要联网或安装系统字体。
Roboto 和此处保留的 Open Sans 1.10 均按 Apache 2.0 许可提供，详情见随包 THIRD_PARTY_NOTICES.txt。其他字体仍依赖运行环境中可用的字体。文字自动适应布局与原版像素一致性尚未完成；内嵌字体不会更改导入的字号和矩形。

圆角：属性面板 Radius 与 Rounded corners 分别控制统一半径和四角开关；两者独立继承，支持当前/所有视图、状态效果和 SetStyle。旧独立四角半径保留为扩展。已证原生矩形参数可导入、编辑和离线预览；缺少这些参数的旧矢量快照保持原路径，原版像素一致性尚未验证。

胶囊形：新增对原版合并重合端点的严格识别。真实样本 28 条路径通过验证，其中 18 个元件可完整导入；8 个仍受父级 fit 面板解析限制，2 个仍在未恢复的 Repeater 模板内。调整尺寸会按原始半径重新计算。极端初始/交互绘制差异和原版像素对照仍未完成。

Move 与 Set size：Interactions 中可按顺序添加多个目标，设置局部元件表达式、动画、时长、尺寸锚点及移动边界。Move 支持直线/弧线，普通元件可组合移动、尺寸和旋转动画。旧数字动作须点击 Add animation and expressions 后才转换。
拖拽：Drag Start、Drag、Drag Drop 与四方向 Swipe 可配合 With drag、水平/垂直拖动和返回拖动前位置；预览及离线 HTML 支持鼠标、触摸、中继器独立行和嵌套框架。关闭预览、切页或删除拖动行会结束该手势。
特殊目标包括下方/右侧元件与 This repeater item。Layer 的作者缩放与 pin、固定面板及独立状态尺寸、跨父容器拖动和完整原生表达式编译仍有限制；原版界面与像素一致性尚未完成。真实表单库新增恢复六个完整手风琴事件（十八个 Move 动作及十二个关联动作）；导入报告仍会列出未恢复内容。

参数矩形的节点编辑使用当前尺寸、统一半径及四角开关生成的轮廓，画布锚点与数值属性一致。仅进入、退出、取消或拖回原位不会改写工程。实际编辑会转为自定义路径，圆角等样式保留但不再重建路径；即使恢复矩形外观，也保持自定义身份。一次撤销恢复原参数形状。局部样式保持，当前视图外框随节点变化重算；连续编辑保留所选节点。
隐藏部分边框或使用旧独立四角半径的参数形状暂不开放节点编辑；恢复四边可见和统一半径后可继续。自定义路径和无需重建的旧路径仍可编辑。越界拖点现重算外框；普通节点编辑保留文字自动适配设置。孤立节点可继续编辑；退化轮廓不扩大有效曲线的外框，节点数据仍保留。原版画面与完整交互对照仍未完成。
