# 原生内联文字编辑：窄范围静态追踪

本次定位到了带有原始编译器名称的文字编辑命令钩子，但**没有证明 Escape 是提交还是取消，也没有证明失焦/画布外点击与 Enter/Ctrl+Enter 的提交规则**。这些行为当前应作为本产品明确约定，不应据本报告声称原版等价。

只读取已保留的 `AxureRP11.dll` metadata/CIL，SHA-256 `dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7`。未加载或执行该DLL，未重新启动原版GUI。未改动已冻结的parser/importer/产品代码。原始静态文件和辅助脚本SHA见 [inline-text-native-evidence.json](inline-text-native-evidence.json)。

## 可直接确认的钩子

`inline-text-native-metadata.ps1` 只查询 `RichTextEdit|InlineText|TextEdit|CancelEdit|CommitEdit|EndEdit|BeginEdit|StopEdit|StartEdit`，保留命中的类型/方法签名及嵌套父类型。大部分正式方法名已混淆，编译器生成lambda还保留以下名称：

| 名称 | token | 已确认内容 |
|---|---:|---|
| `<DoCommandInTextEditMode>b__0` | 100665110 | 父类型`W30.M3m`；0x21..0x2C读取命令的键值，0x47..0x5A将捕获的`keyData`按AxKeys做Object.Equals |
| `<ShowTextEditorForNode>b__0` | 100672211 | 父类型`DBA0.aBAm`；只确认名称/签名，未把node命名推断成画布富文本 |
| `<GetTextEdit>b__2_0` / `<GetTextEdit>b__1` | 100686841 /100686845 | 父类型`djCv.ljCy`；只确认metadata，没有将其当作提交事件 |
| `CellsTextEdit` | type33557584 | 父类型`Axure.DocumentModel.Objects.Table`；表格特定类型，不能代替通用内联编辑规则 |

对第一个lambda做限定类型/token的CIL引用查询后得到：

1. `M3m.AR5` token100665030，在IL0x29创建该lambda，读取本类`jcV`命令集合并调用泛型筛选函数。证据文件 `inline-text-native-command-xrefs.json`、`inline-text-native-command-cil.json`。
2. `M3m.bRt` token100665029，在IL0x1DA调用AR5，后续0x21D调用`qRH`。它读取事件键并设置事件标记，属于命令分派路径；调用链本身不证明文档提交。
3. `qRH` token100665031依次调用`wR1`100665032、`URI`100665033、`QR3`100665034、`KRR`100665036。前三者继续按命令组传给`yRg`。当前没有闭合到富文本的原文档修改或撤销事务。
4. bRt若干分支调用`XIXq`100664859（0x13F、0x200、0x25F）。XIXq再调用`ORz`100664865及构造`hSZd.pSZq(true)`传给N38。ORz涉及弱引用目标和UtcNow；这些指令不足以给XIXq贴“提交/取消文字”标签。

所有数值均为原始IL偏移，不依赖将混淆方法重新命名后的伪代码。无法解释的控制流/模块常量没有被执行或假设。

## 避免错误解读键编号

`inline-text-native-key-enum.json` 确认 `Axure.Constants.AxKeys`：Enter/Return=6、Escape=13、Control=131072、Shift=65536。它不是Windows虚拟键码。不能把任意IL常量13直接解释为Enter，或27直接解释为Escape；必须以参数类型和此枚举的位组合为依据。

## 当前未知及最小产品合同

| 问题 | 本次结论 |
|---|---|
| Escape提交、取消或仅退出编辑模式 | 未证明 |
| Enter插入段落，Ctrl+Enter提交 | 未证明 |
| outside pointerdown / lost focus提交 | 未证明 |
| 点击浮动工具栏是否保持编辑会话 | 未证明 |
| 单次事务/undo分组以及取消是否回滚全部run格式 | 未证明 |

本产品可以实现并测试自身的“Enter换行、特定操作提交/取消”约定；文档与测试需要称为产品行为。后续若继续原版静态调查，应先找到画布真正的文字编辑控制器及事件注册入口，再追踪结束回调到文档事务；本次不为该未知继续扩大反编译范围。
