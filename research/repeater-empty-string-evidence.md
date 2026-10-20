# Axure RP 11 零行 Item 的字符串求值与目标绑定

日期：2026-10-13。接续 [零行生命周期证据](repeater-empty-evidence.md)。只执行已提取官方 JavaScript 的指定原函数；没有启动原版 GUI、原型浏览器、完整模块或表达式编译器。本报告没有修改产品代码。

**确定结论：stringLiteral 按每个 `[[...]]` 捕获 STO 求值异常，只保留失败的那一段；其它段仍替换。SetText 暂设每个目标实例后求参数，正常路径在调用 setter 前恢复旧目标；SetVariable 不自行设置或清除目标；addRow 求列值时目标是 repeater 容器，尚无新增行。** 无效元信息的强制类型转换依赖原编译器产生的 STO 注解，本报告不把合成注解当作原版编译器产物。

## 来源、复现与覆盖

目标 Axure RP 11.0.0.4150，包 SHA-256 `f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0`；REA 提取证据 `ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7`。原目录 `V`：

```text
C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure
```

| 文件 | SHA-256 |
|---|---|
| expr.js | `530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6` |
| sto.js | `c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6` |
| variables.js | `91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188` |
| doc.js | `986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1` |
| repeater.js | `d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b` |
| action.js | `c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3` |

[probe-repeater-empty-strings.mjs](scripts/probe-repeater-empty-strings.mjs) 先校验上述 6 个 SHA，再运行 25 项断言；VM 禁止动态字符串/wasm 代码生成，单次求值限 1 秒。[JSON](repeater-empty-string-evidence.json) 保存完整结果、18 段源码、行号、执行范围及 mock 清单。复现：

```powershell
node research/scripts/probe-repeater-empty-strings.mjs
```

本次结果 `pass:true, experiments:25, files:6, excerpts:18`。探针 SHA-256 `676ed1efa85c2368727757d97919173ffdf25c2d91e5c771f13929813d81ce02`；JSON SHA-256 `ded60bd850d5c872666a7b0b963db103d30640c9d58d19fa62e1004d468ffc90`。

原函数包括 `_substituteSTOs`、`evaluateExpr`、STO var/item/propCall 与 casts、variable provider、fcall、目标枚举、getItemInfo/setDisplayProps/getData/hasData/addItem。数据和 script-parent 映射使用确定 fixture，rich-text setter 是记录 sink；表单 setter 和变量 setter 实际运行。**所有表达式 AST 都是显式合成输入**，除独立类型敏感性实验外不带 computedType/desiredType。执行这些原函数证明的是给定 AST 的运行时合同，不证明原编译器会为任何输入文字生成相同 AST。

## 1. 失败范围与字符串处理

`expr.js:204–232`：先求 localVariables（207–209），再用一次 `String.replace` 遍历所有匹配（214）。每次取一个 STO，`sto:'error'` 直接保留当前 match（215–216）；仅 `evaluateSTO` 在 try/catch 内（217–220）。结果：

| 探针输入 | 输出/行为 |
|---|---|
| `[[Good]]:[[Item.index]]:[[Good]]`，Good=`OK`，Item 父对象缺失 | `OK:[[Item.index]]:OK` |
| 中间 STO 明确为 `error` | 仅保留对应 `[[broken]]` |
| 首片段结果是字面 `[[Item.index]]` | 插入后不再解释；后面的独立片段仍正常求值 |
| localVariables 的表达式 handler 不存在 | 抛出 TypeError，不是字符串回退 |
| stos 长度不足，当前 STO 为 undefined | 215–216 在 try 外，抛 TypeError |

`expr.js:760–764` 的 evaluateExpr 没有额外总 catch。不能把本合同泛化为“所有表达式错误都返回原文”。换行不会被该正则的 `.*?` 跨行匹配；复杂嵌套方括号的编译不在本次范围。

`expr.js:223–232` 有非标量返回路径：整串只有一个表达式且结果为 Object 时可能直接返回该对象；多片段结果按 replace 的返回值规则拼接。`SetWidgetRichText` 在 316–321 再调用 ToString；addRow 不做同样的统一文本转换。因此“字符串表达式总是返回 string”不成立。

## 2. Item 不是单一读取路径

**元信息**：`variables.js:62–63` 的 Item 返回有效 `eventInfo.item`，否则返回当前 TargetItem；TargetItem 从 targetElement 重新取得。`doc.js:328–345` 对普通非行控件返回 `{valid:false}`，对无目标不产生 Item 对象。这里的 absent 指没有 `eventInfo.item`，与 srcElement 整体缺失不是同一条件；探针保留一个合法 source ID。

**列值**：`sto.js:116–125` 的 `item` handler 不按 Item.valid 分支。Item.Column 先调用 hasData（`repeater.js:1312–1316`）；其 1313 行首先要求 source ID 带行后缀，之后才查父 repeater 与 schema。有则读 source，没则读 target。TargetItem.Column 总是读 target。

**零行源本体 `r` 是关键例外**：`_getItemIdFromElementId('r')` 在 `repeater.js:1513–1517` 返回 `''`，所以 `hasData('r','Name')` 已在 1313 返回 false，根本不执行后面的 schema 检查。即使 `doc.js:669–670` 的 scriptIdToRepeaterId 映射 `r → r`，且 `r.props` 含 Name，也不改变结果。故零行回调的 Item.Name 可回退到另一 repeater 的实际目标行；不能仅凭源 schema 含 Name 就强制读无行的源本体。

| 条件 | 原函数结果 |
|---|---|
| 无目标，Item 父对象不存在，再访问 `.valid` / `.index` | propCall 在 `sto.js:159` 访问 undefined，当前片段保留 |
| 普通非行目标，Item 为 `{valid:false}`，读 `.valid` | false 原始值 |
| 普通非行目标，读缺失叶 `.index` | undefined 原始值；不抛错，随后转换依赖 STO 注解 |
| 普通非行目标，读 `.repeater.datacount` | 中间父 `.repeater` 缺失，后一级访问抛错，当前片段保留 |
| 实际行存在，但已声明列的 cell 省略 | `repeater.js:1301` 默认 `{text:''}`，普通文本读取为空串 |
| 实际行不存在、或 target 为非行容器/外部控件，显式 item STO 读任意列名 | `row[propName]` 前没有 row，抛错，当前片段保留 |
| 源 schema 含列，但源 row 已删除且本 frame 无 delete-map 缓存 | 仍选源，读取抛错；不自动转到有效目标行 |
| 源 schema 不含列，target 实际行存在但该 cell 无值 | 显式 item STO 转 target 后得到空文本 |

未知列名是否会被原编译器识别为 item STO、propCall 或编译错误，没有本次编译产物证据；表中“schema 不含列”的结论明确针对给定 item STO。已声明列的空 cell 与不存在的 row 不能混为一类。

独立类型敏感性探针对普通非行目标的 `.index` 分别手工指定未注解/string/bool/int，得到 `undefined`/`undefined`/`false`/`NaN`；**这只是证明输出依赖注解，不是原版任一表达式的编译结果**。没有父对象的 `.index` 在上述几种最终 cast 下均在 cast 前抛错；仍保留当前片段。嵌套节点自身的任意强制转换组合未覆盖。

## 3. SetText、SetVariable、addRow 的目标绑定

### SetText

`action.js:370–378` 的 setFunction 进入表达式 block。`expr.js:127–179` fcall 保存 oldTarget，先求 pathLiteral，再对每个目标临时设置 targetElement，逐个计算后续参数（135–144）。所有参数求完后先恢复 oldTarget（166–167），才倒序调用 setter（170–179）。两个 target 的参数可各用自己的行数据；setter 倒序执行不代表数据求值也是倒序。

原目标枚举 `doc.js:221–244`：没有源/目标同行 ID 时，模板控件枚举目标 repeater 实际 item IDs；零行返回空列表，不会虚构实例。

两个相同字符串分别在 source Item `{valid:false}` 与没有 Item 的 frame 下验证。前一组探针实际使用 `srcElement:'r'`、`item:getItemInfo('r')`、parent 映射 `r:'r'`，源 dataset 的 `props:['Name']`；后一组使用 `srcElement:'outside'` 且不设 item。前一组不是把 outside 当作零行源，已覆盖上述 hasData 首 guard：

| 本次 target | Item 与 TargetItem 的结果（未注解合成 AST） |
|---|---|
| 外部普通控件 | `.valid`=`false`；`.index`=`undefined`；列片段保留 |
| 其它 repeater 第 1 行 Name=Alpha | `.valid`=`true`，`.index`=`1`，Name=`Alpha`，缺 cell=`''` |
| 其它 repeater 第 2 行 Name=Beta | `.valid`=`true`，`.index`=`2`，Name=`Beta`，缺 cell=`''` |

### SetVariable

`expr.js:285–287` 只写变量；fcall 的首参 globalVariableLiteral（182–184）不产生 path targets。它不新增 target，也不清除继承 target。

**正常同事件前序 SetText 不会把自己的 target 泄露给后序 SetVariable。** 两项连续调用探针验证：旧 target 不存在时后续变量表达式恢复无目标语义；旧 target 为 outside 时，SetText 临时操作其它 repeater 后后续变量仍使用 outside。产品仅在当次参数解析中传 action target、正常完成不写回 EventFrame，符合此路径。

边界是 fcall 的 143/152 行在 undefined 参数时提前 return，或参数求值直接抛错：这些路径没有 finally，会绕过目标恢复。本次有界标量 stringLiteral 正常路径不需要仿造这个异常状态泄露；不得将“始终恢复”扩展到所有畸形 AST。

### addRow 列值

`action.js:1793–1808` 找 repeater、检查 refresh guard、deepCopy 原列定义后调用 addItem。`repeater.js:1342–1362` 设置 `data=true`、保存旧目标并设 `targetElement=repeaterId`，逐列求 literal，恢复旧目标后才将 row push 到 dataset，最后 data=false。

因此无效/缺少 Item 的 source 对 addRow 列文本：`.valid` 取 false，缺叶 metadata 仍依赖编译类型，Item/TargetItem 的列访问均因目标容器不是实际 row 而保留对应 `[[...]]`。它们不会指向“正在创建的新行”。有有效 source 且 schema 含 Name 时 Item.Name 可读 source；TargetItem.Name 仍没有目标 row。

data=true 还改变 column 返回类型：已声明空 cell 默认对象 `{text:''}` 没有 `type:'text'`，`repeater.js:1304` 保留对象。探针的单独 `[[Item.Empty]]` 通过 expr 的纯对象返回路径，最终新增 cell 为 `{text:''}`；带前后文字、多片段、图片/链接对象或生成 cast 的行为不能由普通文本空串外推。

## 4. 可忠实实施的有界子集与未知

建议把下面部分作为明确有证据的字符串参数行为，适用于产品自己的表达式 AST；不是宣称恢复原版完整编译器：

1. 每个匹配独立求值；求值异常保留该匹配原文，继续其它匹配；不递归解释新插入的 `[[...]]`。
2. 明确区分无 Item 对象、无效 `{valid:false}`、有效 row、缺叶 undefined、缺父访问错误；不把它们全部转空串或 0。
3. Item 元信息的 source-invalid → target 回退，和 Item.Column 的 source-schema → target 回退分别实现。SetText 使用当次目标行；变量使用已有 frame 目标；addRow 使用目标 repeater 容器。
4. 普通文本列仅在实际 row 存在时允许缺 cell 为空；没有实际 row 的任意 item 列访问应抛给当前片段的回退处理。
5. 对原 STO 编译类型未知的无效叶值，保留“产品子集转换规则”说明，不能以本探针合成 bool/int/string 的差异结果选一个并声称原生全面一致。
6. 单一对象/Date/图片/链接/富文本表达式、localVariables 失败、畸形 AST、完整原版编译、嵌套/master scope、无 DOM 模板目标 setter、条件 AST 的失败策略仍不在本次兼容证明内。

本报告的 25 项原函数隔离实验验证所列运行时边界；没有产品浏览器或原厂生成原型的差分验证。本轮的生产代码只读复核另行反馈给 root，不改变上述来源结论。
