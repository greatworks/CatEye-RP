# RP11 图片资源：受限恢复证据

只读取官方分发样例和 PE 元数据/CIL，不加载或执行原厂 DLL，也不调用原厂图像渲染代码。已实现可审计的静态 PNG 子集；没有完成原版图片渲染差分。

## 直接观察

- 九个分发文件共有 101 个 `Axure:DiagramObject:ImageBox` 对象：59 个本地 `.png` Stream、4 个空扩展名但 PNG 签名的 Stream、5 个 `.svg` Stream、28 个仅 `Hash="VectorImage"` 的值、5 个没有本地 IMAGE。见 `samples/image-mapping-evidence.json`。90 个直接出现在当前读取的 Page/PanelState 成员列表，不能将对象总数都计成页面元件。
- 对象的 `MyStyle` 引用同包 `Axure:Style`；PropList 的 DOAName 低 28 位为 27。`metadata-PName.json` 明确将 27 命名为 IMAGE。
- IMAGE 值包含 `Stream`、`Extension`、`Hash`；Stream 是对象值标签 4 的长度前缀字节流，offset 指**解压后的对象包**内偏移。恢复从同一次不可变容器读取取得该范围并重新核对 SHA-256，没有读取 thumbnail、外部路径或网络。
- 原始 Hash 字符串仅作为来源保存，未认定其摘要算法；程序独立计算 SHA-256。同图多次使用可能有不同 Stream offset，不依赖原 Hash 替换内容。
- ImageBox 明确保存 `fit-to-image` 与 `PreserveCornersRectangle`。`metadata-ImageRepeat.json` 确认 None=0、Repeat=1、RepeatX=2、RepeatY=3、StretchCover=4、StretchContain=5、Stretch=6。`imagebox-cil.json` 记录 FitToImage、PreserveCornersRect、SrcRects/DestRects 和图像滤镜相关方法的存在，但不构成完整算法理解。
- 本产品采用 `object-fit:contain`，故首版仅接受像素与保存矩形宽高比一致的对象；即使 1 像素差异可能来自原程序舍入，也不猜测补齐。

## 已验证结果

| 文件 | 文件 SHA-256 | 图片元件 / 独立资源 | 全部顶层元件 / 跳过 |
|---|---|---:|---:|
| Quick Win.rp | `04bd8925f26c78263b26a0ec108b779939b174e69da0ee2acf3b4ed1c09cc051` | 2 / 1 | 25 / 17 |
| UX Prototyping.rp | `1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72` | 2 / 1 | 98 / 55 |

Quick Win 资源为 1200×900 PNG、15,232 字节、SHA-256 `12212b85d5f88d3b5a83ceccddfb912750c8f5d2cbc49552585dc2701d8dc178`；第一个元件 `1692d71a9d2546569a08639d4188151c` 保存 `(100,305,600,450)`，Stream 位于包 `c6428b5a8ae84f939ae7fb9ac0cddb61/package` 偏移 46,910。第二个对象内容相同，仍独立核验字节。

UX 资源为 1064×912 PNG、21,063 字节、SHA-256 `b879d0524ee695756c6eab1e0bdd40b4ef540cc44b169dc8e6de146beec2af36`；元件 `a655d035d5ed4d2cbbf4620feb4ae50a` 和 `b8b5e5fda5fe445fa1b5deaa74031af2` 各保存 532×456 矩形。完整来源、位置和拒绝原因见 `samples/image-recovery-summary.json`。

其余官方样例计数不变：Required fields 6/1、Tab menu 2/1。11 文件审计执行实际容器→对象→语义→纯模型转换→serialize/parseDocument；Icons 的 920 页仍因上限拒绝。

## 实现边界

必须满足：准确 ImageBox 类型、本地明确且覆盖的 IMAGE/位置/尺寸；唯一匹配的默认/基础样式缓存；自动尺寸与 fit-to-image=false；PreserveCornersRectangle 四项零；未选中、未禁用、无错误状态；无重复、非零圆角/旋转/滤镜或非恒等变换，边框宽度零；PNG 字节可靠且保存矩形等比例。未知阴影等外观仍保留 `styleRecovery.unknown` 与 provenance，不能称为视觉等价。

PNG 验证依据 [W3C PNG 第三版](https://www.w3.org/TR/png-3/)，实现受限子集：签名、IHDR/PLTE/tRNS/IDAT/IEND 顺序和大小、CRC、标准颜色/位深组合、非交错、像素尺寸、zlib 精确解压长度和扫描行过滤器编号。仅额外接受有界 sRGB/pHYs；EXIF、动画、压缩文本、ICC、未知块拒绝。这不是完整像素解码器或所有合法 PNG 的兼容性声明。

当前跳过 JPEG/GIF/WebP、SVG、VectorImage Hash、继承/缺少 Stream、EXIF 方向/未知元数据、裁剪/九宫格、非等比例或自动尺寸、圆角裁切、滤镜、旋转/变换、状态换图及错误资源。失败对象保留 imageRecovery.reason，转换报告显示 widget-skipped。

应用原有限制为单 imageSrc 8 MiB 字符、文档 20 MiB；worker 为 128 MiB 输入、256 MiB old heap、30 秒、20 MiB JSON IPC。新增更紧限制：单图 4 MiB 原始字节、累计 data URL 8 MiB、每维 8192、总像素 8 Mi、解压扫描行 32 MiB、4096 块。语义阶段超限不输出 data URL 并报告；纯转换阶段累计超限中止整个导入，不返回误导性部分计数。

接口仍为 recoveryVersion=1。ImageBox 新增 `typeCandidate.type="image"`、`imageRecovery`。成功状态 `validated-embedded-png` 包含 `mime,width,height,sha256,decodedBytes,source,mapping,dataUrl`；失败状态 `unsupported-image` 包含 reason/可用来源。纯转换仅接受严格 `data:image/png;base64,`，复核头部尺寸、来源摘要字段和字节数；不接受 URL/SVG。`embedded-image-recovery` 报告去掉 dataUrl，避免重复复制图片。无新运行依赖或第四个解析模块。

## 验证

```powershell
node --test research/scripts/read-rp-container.test.mjs research/scripts/read-rp-objects.test.mjs research/scripts/read-rp-appearance.test.mjs research/scripts/read-rp-images.test.mjs research/scripts/synthetic-rp-fixture.test.mjs
npx vitest run tests/import-rp.test.ts
node research/scripts/audit-rp-imports.mjs '<已提取的 Axure RP 11 目录>'
```

44/44 Node、22/22 importer 测试及最终 npm run typecheck 通过。新增覆盖独立 RGBA PNG、截断/CRC/追加脚本/SVG、像素/解压上限、未知过滤器、EXIF/APNG/未知块、资源越界/摘要错误、累计预算、比例/fit/保留角/状态/滤镜拒绝及两个固定哈希真实 RP 的读取和模型保存回读。

最终 Windows 便携 EXE 已执行 `scripts/smoke-rp-images.mjs`：两份官方样例经真实文件读取、Worker、IPC、解析和转换，保存并重开 `.rea.json` 后各保留 2 张原字节 PNG；编辑器、预览与实际 `file://` 导出均解码出预期像素尺寸，未请求 HTTP。只替换 OS 文件选择器返回值，未跳过业务处理。截图 `artifacts/rp-image-preview.png` 已检查图片可见；页面仍有冻结文字矩形等已知差异，不能从图片成功显示推断整页视觉等价。原版 Axure 的图片渲染差分仍未完成。

官方样例、CIL、证据 JSON 仅留 research；产品只读取用户主动导入的文件，发布包继续只包含自写解析器，不包含原厂素材/DLL/实现。
