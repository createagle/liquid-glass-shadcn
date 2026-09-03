# Apple 度量表

> Phase 0 研究笔记。抓取日期 **2026-08-31**。
>
> **可信度标注规则（严格执行 PROJECT_SPEC §1.5 / §15.7）**
>
> - `[官方]` —— HIG 或 Apple 开发者文档正文里**明确写出的数值**，附出处 URL。
> - `[官方示例]` —— 出现在 Apple 官方**代码示例**里的数值。它是能跑的真实值，
>   但 Apple 并未声明它是规范值，**不能当设计规范用**。
> - `[实测]` —— 我从真机截图 / Figma 资源量出的，注明测量方法。
> - `[推定]` —— 无来源，我的估计。
> - `[待核实]` —— 社区广泛流传但我在本次研究中**没有找到 Apple 出处**的值。
>   **这一类不许当成 `[官方]` 使用。**
>
> **2026-08-31 更新：`[实测]` 一档已有数据。**
> 来源是 Figma 文件 *iOS and iPadOS 27 (Community)*（fileKey `ojEQo0rKaQ5ioARo0CO0pf`），
> 覆盖 Tab Bar / Switch / Slider / Sheet / Alert / Menu 的尺寸，见 §7。
>
> ⚠️ 但**两项限制仍在**，§7 开头详述：
> (a) 该文件是 **iOS 27**，PROJECT_SPEC 的基准是 **iOS 26**；
> (b) 标题带 "(Community)"，**发布者是否为 Apple 未经验证**。
> 在澄清前，§7 的值一律标 `[实测]` 而非 `[官方]`。
>
> ⚠️ **光学参数仍然全部缺失。** Figma 里的玻璃是静态近似，
> 拿不到折射 / 色散数据 —— 那部分只能靠 iOS 真机截图，见 `STATUS.md` 阻塞项。

---

## 1. 触控与命中区域

| 项 | 值 | 可信度 | 出处 |
|---|---|---|---|
| 最小命中区域（通用） | **44 × 44 pt** | `[官方]` | > "a button needs a hit region of at least 44x44 pt" — <https://developer.apple.com/design/human-interface-guidelines/buttons> |
| 最小命中区域（visionOS） | **60 × 60 pt** | `[官方]` | 同上，> "in visionOS, 60x60 pt" |

## 2. 材质数值

| 项 | 值 | 可信度 | 出处 |
|---|---|---|---|
| clear 变体在**亮背景**上的调暗层 | **黑色 35% 不透明度** | `[官方]` | > "If the underlying content is bright, consider adding a dark dimming layer of 35% opacity." — <https://developer.apple.com/design/human-interface-guidelines/materials> |
| clear 变体调暗层（API 文档示例） | `.black.opacity(0.3)` | `[官方示例]` | <https://developer.apple.com/documentation/SwiftUI/Glass/clear.md> |
| clear 变体在**足够暗**的背景上 | **不需要调暗层** | `[官方]` | > "If the underlying content is sufficiently dark, or if you use standard media playback controls from AVKit that provide their own dimming layer, you don't need to apply a dimming layer." |
| 内容层标准材质档数 | **4 档**：ultraThin / thin / regular / thick | `[官方]` | > "iOS and iPadOS continue to provide four standard materials — ultra-thin, thin, regular (default), and thick" — 同上 |
| Liquid Glass 材质档位滑杆的档数与映射 | —— | **无官方数值** | Apple 只说 "people can choose a preferred look for Liquid Glass in their device's settings"，未公布档数。PROJECT_SPEC §8 的「4 档 + 连续插值」全属 `[推定]` |

## 3. 形状

| 项 | 值 | 可信度 | 出处 |
|---|---|---|---|
| `glassEffect()` 默认形状 | **Capsule** | `[官方]` | > "SwiftUI uses the `regular` variant by default along with a `Capsule` shape." — <https://developer.apple.com/documentation/SwiftUI/View/glassEffect(_:in:).md> |
| 圆角矩形示例圆角 | `16.0` | `[官方示例]` | `.glassEffect(in: .rect(cornerRadius: 16.0))` — <https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views.md> |
| 同心角「最小半径」示例 | `.concentric(minimum: 12.0)` | `[官方示例]` | <https://developer.apple.com/documentation/SwiftUI/ConcentricRectangle.md> |
| 固定角示例 | `.fixed(24.0)` | `[官方示例]` | 同上（Notes 格式面板的上圆角） |
| 同心角在远离容器角时 | **半径可能算成 0（变方角）** | `[官方]` | > "the corner radius the system calculates may be zero. When that happens, the corner is square." |

## 4. GlassEffectContainer 的 spacing

| 项 | 值 | 可信度 | 出处 |
|---|---|---|---|
| 融合/形变示例 spacing | `40.0`（容器与内部 HStack 同为 40.0） | `[官方示例]` | <https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views.md> |
| union 示例 spacing | `20.0` | `[官方示例]` | 同上 |
| 示例中的玻璃块尺寸 | `80 × 80`，符号字号 `36` | `[官方示例]` | 同上 |
| spacing 与融合的关系 | **spacing 越大，越早开始融合** | `[官方]`（定性，无数值） | <https://developer.apple.com/documentation/SwiftUI/GlassEffectContainer.md> |

> 可推出的规则 `[推定]`：`spacing ≈ 相邻玻璃块间距`时，静止态刚好不融合；
> `spacing > 布局间距`时静止态即融合。Apple 原文佐证了后半句。

## 5. Sheet / Drawer

| 项 | 值 | 可信度 | 出处 |
|---|---|---|---|
| `large` detent | 完全展开的高度 | `[官方]` | > "large is the height of a fully expanded sheet" — <https://developer.apple.com/design/human-interface-guidelines/sheets> |
| `medium` detent | **约为完全展开高度的一半** | `[官方]`（定性） | > "medium is about half of the fully expanded height" |
| 自定义 detent | 支持一个或多个自定义值 | `[官方]` | > "Sheets can have one or more custom detent values." |
| 默认支持的 detent | **自动支持 large** | `[官方]` | > "Sheets automatically support the large detent." |
| grabber | 顶边的小横条；**点按可在 detent 间循环**；支持 VoiceOver | `[官方]` | 同上，> "they can also tap it to cycle through the detents" |
| 半屏 sheet | 从屏幕边缘**内缩**，让内容从下方透出 | `[官方]`（定性） | <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md> |
| 半屏展开到全高时 | **转为更不透明的外观** | `[官方]`（定性） | 同上 |
| sheet 圆角具体数值 | —— | **无官方数值** | 文档只说 "an increased corner radius"，没给数字 |

> **实现要求（`[官方]`，非数值但是硬约束）**：
> - 必须支持下滑关闭：> "People expect to swipe vertically to dismiss a sheet instead of tapping a dismiss button."
> - 有未保存修改时下滑，要用 action sheet 让用户确认。
> - 一次只显示一个 sheet：> "Display only one sheet at a time from the main interface."

## 6. 排版（Dynamic Type，SF Pro）

PROJECT_SPEC §10 把这组值列为「已核实可直接使用」。
**我在本次研究中没有找到 Apple 的出处**（HIG typography 页未读）。
因此整组降级为 `[待核实]`：

| Style | pt | 可信度 |
|---|---|---|
| largeTitle | 34 | `[待核实]` |
| title1 | 28 | `[待核实]` |
| title2 | 22 | `[待核实]` |
| title3 | 20 | `[待核实]` |
| headline | 17 semibold | `[待核实]` |
| body | 17 | `[待核实]` |
| callout | 16 | `[待核实]` |
| subheadline | 15 | `[待核实]` |
| footnote | 13 | `[待核实]` |
| caption1 | 12 | `[待核实]` |
| caption2 | 11 | `[待核实]` |

> 这些是社区长期通行的 iOS 默认（Large）字号，很可能是对的，
> 但在读过 <https://developer.apple.com/design/human-interface-guidelines/typography> 之前，
> **不许在代码注释里标 `[官方]`**。

## 7. 控件尺寸

**数据来源**：Figma 文件 *iOS and iPadOS 27 (Community)*，fileKey `ojEQo0rKaQ5ioARo0CO0pf`，
2026-08-31 经 Figma MCP 读取。渲染图存于 `docs/research/screenshots/`。

**测量方法**：该文件的 iPhone 示例帧为 **402 × 874**，正好是 iPhone 16 Pro 的**逻辑点尺寸**，
故 Figma 中的坐标与尺寸**即 pt，无需换算**。下表数值直接取自节点的 x/y/width/height；
标「像素实测」的另经 `scripts/lib/png.mjs` 解码渲染 PNG、逐像素扫描求边界得到。

> ⚠️ **两条必须先说清楚的前提，未澄清前不得升级本节可信度：**
>
> 1. **这是 iOS 27，不是 iOS 26。** PROJECT_SPEC 的基准是 iOS 26。Liquid Glass 在 26 引入、
>    27 继续演进，控件尺寸**可能已与 26 不同**。本节数值只能声称「iOS 27 实测」，
>    **不得当作 iOS 26 的官方值使用**。
> 2. **文件标题带 "(Community)"。** Apple 确实官方向 Figma Community 发布设计资源，
>    但仅凭 MCP 读到的数据**无法验证作者是不是 Apple**。需在 Figma 中确认发布者；
>    若非 Apple 官方发布，本节全部降级为 `[待核实]`。
>
> 因此本节一律标 `[实测]`（我确实量到了），**一律不标 `[官方]`**。

### 7.1 屏幕与全局

| 项 | 值 | 可信度 |
|---|---|---|
| 示例帧（iPhone 16 Pro 逻辑尺寸） | **402 × 874 pt** | `[实测]` |
| 状态栏高 | **62 pt** | `[实测]` |
| Home Indicator 区 | **402 × 34 pt**（y = 840） | `[实测]` |
| 内容区左右边距 | **16 pt** | `[实测]` |
| 导航栏控件行高 | **44 pt**（与 `[官方]` 最小命中区域一致） | `[实测]` |
| 顶部工具栏（含大标题+副标题） | **125 pt**；仅控件行 **54 pt** | `[实测]` |
| Scroll Edge Effect（顶部渐隐区） | **402 × 116 pt** | `[实测]` |

### 7.2 Tab Bar（iOS 26+ 浮动式）—— 本库 Tabs 的基准

节点 `12740:24081`，渲染图 `screenshots/ios27-tabbar.png`。

| 项 | 值 | 可信度 |
|---|---|---|
| Tab Bar 容器 | 402 × 95 pt | `[实测]` |
| **玻璃底座 BG（Layer B）** | **244 × 62 pt** | `[实测]` |
| 按钮组（BG 内） | 236 × 54 pt | `[实测]` |
| **底座 → 按钮组内缩** | **4 pt（四周）** | `[实测]` |
| 单个 Tab（Layer I 指示器） | **120 × 54 pt** | `[实测]` |
| Search 独立胶囊 | **62 × 62 pt**（内含 54 × 54 按钮，同样 4 pt 内缩） | `[实测]` |
| 左右边距 | **21 pt**（对称） | `[实测]` |
| 形状 | 胶囊 → 外半径 **31**、内半径 **27** | `[实测]`（由高度推得，胶囊经渲染图确认） |

> ✅ **这条独立验证了同心圆角公式。**
> 外半径 31 − 内缩 4 = 内半径 27，与 `packages/glass-core/src/shape/concentric.ts`
> 的 `concentricRadius(31, 4)` 输出一致。此前该公式只有 Apple 的定性描述作依据。

> 📌 **Search 是独立胶囊，不在主底座内。** 这与 PROJECT_SPEC 把 Tab Bar 当成单一容器的
> 隐含假设不符，Phase 3 实现 Tabs 时需支持「主胶囊 + 分离尾随胶囊」的布局。

### 7.3 Switch —— 推翻 PROJECT_SPEC 标注为「已核实」的值

节点 `I12740:33924;550:50638;526:49260`，
渲染图 `screenshots/ios27-switch.png`（父节点 `12740:33924`，1× 导出，370×52）。

| 项 | iOS 27 实测 | PROJECT_SPEC 原值 | 结论 |
|---|---|---|---|
| 轨道 | **64 × 28 pt** | 51 × 31 pt | ❌ **原值错误** |
| Knob | **38 × 24 pt（胶囊，非圆）** | 直径 27 pt 圆形 | ❌ **原值错误**（形状也错） |
| Knob 内缩 | **2 pt**（上下左右） | —— | 新增 |
| Knob 行程 | **22 pt**（x 从 2 到 24） | —— | 新增 |

原值 51 × 31 是 **UIKit 旧版**度量，本文件此前已标 `[待核实]`；现有实测数据，
**该行应从 PROJECT_SPEC 中移除或改写**，不能继续以「已核实」呈现。

### 7.4 Slider

节点 `12740:33899`，渲染图 `screenshots/ios27-sliders.png`。

| 项 | 值 | 可信度 |
|---|---|---|
| 列表行高 | **52 pt**（含 1 pt 分隔线） | `[实测]` |
| 轨道 | **250 × 6 pt** | `[实测]`（高度经像素实测复核） |
| **Knob** | **38 × 24 pt（胶囊）** | `[实测]`（**像素实测**） |
| Ticks（刻度条） | 218 × 4 pt | `[实测]` |
| 轨道未填充色 | `rgb(228 228 228)` | `[实测]`（像素采样，见下方色彩告警） |
| 轨道已填充色 | `rgb(0 136 255)` | `[实测]`（像素采样，见下方色彩告警） |

> ⚠️ **Figma 节点包围盒在此处不可信。** Knob 实例的 `width` 报为 **1.11pt**，
> 但渲染图显示它是宽胶囊。包围盒塌缩了，视觉内容溢出盒外。
> **凡涉及 Knob 一律以像素实测为准**，不要采信节点 width。
>
> ⚠️ **颜色告警：** `rgb(0 136 255)` ≠ 常引用的 systemBlue `#007AFF`。
> 差异方向与 Display P3 → sRGB 转换一致，但我**没有验证**这是色彩管理造成的还是
> Apple 真的改了色值。**本项不得据以修改 token**，需另行核实。

> ✅ **交叉印证：Switch 与 Slider 的 knob 都是 38 × 24 pt。**
> 两处独立节点得到同一尺寸，说明 iOS 27 存在**统一的 Knob 组件**。
> 这是本次测量中可信度最高的一条。

### 7.5 Sheet（浮动式）

节点 `12740:24130`（内层面板 `I12740:24130;10525:1635`），
渲染图 `screenshots/ios27-sheet.png`（整屏 402×874，1px = 1pt）。

| 项 | 值 | 可信度 |
|---|---|---|
| 左右边距 | **6 pt**（宽 390 = 402 − 12） | `[实测]` |
| 底部边距 | **6 pt**（874 − 409 − 459 = 6） | `[实测]` |
| **圆角** | **34 pt** | `[实测]` —— 见下方拟合；**只量到上面两个角** |
| **抓手（grabber）** | **58 × 4 pt**，水平居中 | `[实测]` —— 元数据与像素扫描**逐位吻合** |
| 抓手占位区高 | **16 pt**（抓手在其中 y = 5） | `[实测]` |
| 抓手颜色 | 灰度 **197**，压在面板底色 248 上 → **黑 20%** | `[实测]` |
| Sheet 内工具栏高 | 54 pt | `[实测]` |
| 面板底色（Figma 近似） | #f8f8f8，上下边缘各有一道白色内高光 | `[实测]` |
| medium 档高度 | **459 / 874 = 0.525** | `[实测]` —— 与 HIG「about half」相符 |
| large 档高度 | —— | **未取得**，参考图只给了一个档位 |

**圆角怎么量的**（2026-09-01 补测，此前本行写的是「仍未取得」）：

面板外面有一圈落影，按颜色阈值找边会量到影子。改成沿每行找**亮度最低点**
（那条 1px 暗轮廓线就是面板边缘），再对 `inset(dy) = r − √(r²−(r−dy)²)`
做最小二乘：

| | 值 |
|---|---|
| 拟合半径 | **34.08** |
| RMSE | **0.376 px**（28 个采样点） |
| 固定半径复算 | 34 → 0.379 · 32 → 1.175 · 36 → 1.116 |

> ✅ **34 与 `--lg-radius-xl` 第三次撞上。** 前两次分别是 Phase 1 定 token 时
> 和 Alert（§7.6）的轮廓拟合。三处独立来源同值，可以认为 34 就是 iOS
> 大圆角容器的那个数。
>
> ⚠️ **下面两个角没量到。** 它们紧贴设备圆角边框与落影，同一套方法得到的是
> 噪声（拟合 r≈60、RMSE 2.5，显然在量影子）。本库实现四角同取 34，
> **下两角属于 `[推定]`（按对称）**。

### 7.6 Alert（Dialog）

节点 `12740:24495`。

| 项 | 值 | 可信度 |
|---|---|---|
| 宽度 | **300 pt** | `[实测]` |
| 内边距 | **14 pt**（四周） | `[实测]` |
| 正文块内再内缩 | 8 pt | `[实测]` |
| **按钮高** | **48 pt** | `[实测]` |
| 并排按钮宽 / 间距 | 132 pt / **8 pt**（132 + 8 + 132 = 272） | `[实测]` |

### 7.7 Menu（Popover / Select / DropdownMenu）

节点 `12740:24185`（Edit Menu），渲染图 `screenshots/ios27-menu.png`
（346×434 —— 节点 250×338 四周各带 48 的落影余量，1px = 1pt）。

| 项 | 值 | 可信度 |
|---|---|---|
| 菜单宽 | **250 pt** | `[实测]` |
| **菜单项高** | **40 pt**（带副标题的为 60 pt） | `[实测]` |
| 菜单项左右内缩 | **16 pt**（内容宽 218） | `[实测]` |
| 上下内边距 | **10 pt**（338 − 66 − 262 = 10，与顶部对称） | `[实测]` |
| 分隔区高 | **21 pt** | `[实测]` |
| 分隔线本体 | **1 pt，位于分隔区顶端 +2**，左右各内缩 **24**（宽 202） | `[实测]` —— 两条分隔线**独立复核一致** |
| 分隔线颜色 | 灰度 **182**，压在面板 207 上 | `[实测]` |
| Quick Actions 行 | 56 pt 高；3 项各 72.67 pt，间距 6 pt | `[实测]` |
| **圆角** | —— | ❌ **量不出来**，见下 |

#### 菜单项**内部**的前导布局（2026-09-02 补测）

上表只量到「项 = 218×40」这一层。这次拆开了 `Item` 实例
（`12740:24194` → 子节点 `Leading` / `Symbol` / `Label and Subtitle`），
三个 Item 实例（40 高两个、60 高一个）**逐项一致**：

| 项 | 值 | 可信度 |
|---|---|---|
| `Leading` 框在 218 项内的位置 | x = **6**，宽 204 | `[实测]` —— 项内再内缩 6 |
| `Symbol`（前导图标） | **28 × 20**，在 Leading 内 x=0 | `[实测]` |
| `Label` 块在 Leading 内 | x = **36** → 图标与标签间距 **8** | `[实测]` |
| 标签在项内的起点 | 6 + 28 + 8 = **42**（面板内 16+42 = 58） | `[实测]`（推算，两端都是实测） |
| `Shortcuts`（尾随快捷键区） | 29 × 20，位于项内 x=153 —— 参考图里 **hidden** | `[实测]`，但本库未实现 |

> ⚠️ **参考图里每一项都有图标。**「没有图标时标签靠到哪里」这个文件答不了 ——
> UIKit 的行为是「菜单里只要有一项带图标，全部对齐到图标列」，
> 但那是行为知识，不是本文件的实测。本库 DropdownMenu 目前**没有图标槽**，
> 标签直接从面板内边距起（16），与这一列不对齐 —— 已知差异，见 STATUS。
>
> ⚠️ **Select 的对勾画在 `Symbol` 这一列是 `[推定]`。** 参考图是静态的 Edit Menu，
> 里面没有任何「选中态」可量。取这一列的依据是 UIKit：`UIAction` 的
> `state == .on` 时对勾占的正是 image 槽位。
> **列的尺寸是实测，对勾的位置是推定，不要混着引用。**
> 对勾的颜色（取 label 色）同样是 `[推定]`。

**圆角为什么没量出来**（2026-09-01 尝试）

Card（26，RMSE 0.12）与 Sheet（34，RMSE 0.38）都是从轮廓拟合出来的，同一套方法
用在菜单上**不收敛**：

| 模型 | 结果 | RMSE |
|---|---|---|
| 圆弧（亮度最低点找边） | r = 20.5 ~ 25.5 | **1.5 ~ 2.2 px** |
| 圆弧（覆盖率求亚像素） | r = 25.5 | 2.18 px |
| 自由超椭圆 `(r, n)` | n=3 → r=29.4；**n=4 → r=37.6** | 1.25 px（两者一样） |

超椭圆把残差压到 1.25 但 **r 与 n 强烈互换** —— 半径不可辨识。

根因是这块面板是**半透明玻璃压在中灰背景上**：外面有落影、里面还有一道亮描边，
边缘不是干净的两色台阶，"覆盖率 = 归一化亮度" 的前提不成立。
Card / Sheet 能量准是因为它们的边缘两侧都是接近实色的区域。

> **本库取 `--lg-radius-lg`（22px）并标 `[推定]`** —— 圆弧拟合的落点集中在 20–25，
> 22 在带内。**不要把它当实测值引用。**
>
> 顺带一个观察（不是结论）：残差呈系统性偏向 —— 小 dy 处实测比圆弧更贴边、
> 大 dy 处又拖得更远，这正是**连续曲率（squircle）**的特征。
> 组件因此开了 `continuous`。

### 7.8 材质组件命名法（重要）

菜单底板在文件中的图层名是 **`Liquid Glass - Regular - Medium`**，其内部正好分解为两层：

| 子层 | 推测职责 |
|---|---|
| `Fill + Shadow` | 底色 + 投影 |
| `Glass Effect` | 玻璃光学层 |

> ✅ 这与本库 Layer B / Layer I 之外的**层内分解**一致：底色与光学是两层，不是一层。
>
> ⚠️ `Regular` 与 SwiftUI 的 `Glass.regular` 对得上；`Medium` 的语义（尺寸？海拔？）
> **未知**，不要臆测。PROJECT_SPEC §8 的「4 档材质滑杆」仍然**没有**得到本文件支持。

> ❌ **本节不提供任何光学参数。** Figma 里的玻璃是静态近似（位图/模糊叠加），
> 不含真实折射与色散数据。`--lg-refract-*` / `--lg-disperse-*` 的标定
> **仍然只能靠 iOS 真机截图**，见 `STATUS.md` 阻塞项。

## 8. 列表 / 表单

### 8.1 HIG 的定性结论（无数值）

| 项 | 值 | 可信度 | 出处 |
|---|---|---|---|
| 行高与内边距 | **比 iOS 18 更大**（无数值） | `[官方]`（定性） | > "organizational components like lists, tables, and forms have a larger row height and padding" |
| Section 圆角 | **增大，与全系控件曲率匹配**（无数值） | `[官方]`（定性） | > "Sections have an increased corner radius to match the curvature of controls across the system." |
| Section header 大小写 | **title-style，不再全大写** | `[官方]` | > "section headers no longer render entirely in capital letters" |

### 8.2 Grouped List —— 数值（2026-09-01 补测）

> HIG 只说「圆角增大了」，没给数。下面这组是从 iOS 27 资源里量出来的，
> 是本库 Card 的基准（PROJECT_SPEC §10 把 Card 的 Apple 对应物定为 grouped list section）。

数据来自**三块互不相关**的 Grouped List：

| 节点 | 内容 | 渲染图 |
|---|---|---|
| `12740:33850` | 4 行 Text Field | `screenshots/ios27-list-screen.png`（整屏 402×874） |
| `12740:33923` | 2 行 Switch | `screenshots/ios27-grouped-list-rows.png`（整屏 402×874） |
| `12740:33898` | 3 行 Slider | 仅取元数据 |

| 项 | 值 | 可信度 | 测量方法 |
|---|---|---|---|
| 区块宽 | **370 pt** | `[实测]` | 402 的屏减两侧各 16；三块一致 |
| **区块圆角** | **26 pt** | `[实测]` | 见下方「圆角怎么量的」 |
| 行高 | **52 pt** | `[实测]` | 三块、三种行类型（文本框 / 开关 / 滑杆）全是 52 |
| 行内左右内缩 | **16 pt** | `[实测]` | 行内容框 x=16 width=338；370−16−338=16，两侧对称 |
| 分隔线 | **1 pt，两侧各内缩 16**（宽 338） | `[实测]` | 像素扫描，位于每行的下边缘 |
| 分隔线颜色 | **#e6e6e6**（压白底 = 黑 9.8%） | `[实测]` | 逐像素读取 |
| 区块底色 | **#ffffff，alpha 通道 255** | `[实测]` | 完全不透明，不是半透明材质 |
| 页面底色 | **#f2f2f7** | `[实测]` | 与 PROJECT_SPEC 既有的 `--lg-gray-6-light` **逐位相同** |
| 区块与内容区顶端的间距 | **10 pt** | `[实测]` | Grouped List 在 Content Area 内 y=10 |
| 行标签字号 | **17 pt** | `[实测]` | 墨迹高 13px，与 Alert 的标题/正文（§7.6）同一字号 |

> ⚠️ **分隔线不要和 `--lg-separator` 合并。** 后者是 iOS 通用分隔线的社区通行值
> （light 0.29，`[待核实]`），压在白底上算出来是 #c6c6c7；而分组列表实测是 #e6e6e6，
> **淡得多**。同一份资源里两者就是不同的粗细，合并会把量到的事实抹掉。
>
> ⚠️ **暗色版没找到。** 这三块列表在资源里只有亮色。`--lg-grouped-bg` /
> `--lg-card-fill` / `--lg-list-separator` 的暗色取值全部是
> `[待核实 · 社区通行值]` 或 `[推定]`，已在 semantic.css 就地标注。

**圆角怎么量的**（与 Alert 的 34 同一套方法，但这次做到了亚像素）：

1. 背景 #f2f2f7、前景 #ffffff，蓝通道差 8 —— 于是每个像素的覆盖率
   `α = (B − 247) / 8`，逐行求和即得该行的**亚像素**内缩量；
2. 对 `inset(dy) = r − √(r² − (r−dy)²)` 做最小二乘；
3. 丢掉最靠边的 1–2 行（纯抗锯齿，系统性偏大）。

| 来源 | 拟合半径 | RMSE |
|---|---|---|
| `ios27-list-screen.png` | 26.27 | **0.12 px**（19 个采样点） |
| `ios27-grouped-list-rows.png` | 26.33 | 0.69 px（受行内文字干扰） |

固定半径复算：r=26 的 RMSE 0.215，r=27 是 0.384，r=25 是 0.716 —— **取 26**。
两参数拟合（半径 + 常数偏移）给出偏移 0.03，说明测量没有系统性平移。

26 不在既有圆角阶梯（8/14/22/34）上，故单开 `--lg-radius-card`，没有硬塞进阶梯。

**仍然缺的**：Section header / footer 的字号与间距 —— 资源里这三块都没有 header，
没量到就是没量到，Card 组件里对应的 `CardDescription` 字号标的是 `[待核实]`。

### 8.3 Text Field —— 数值（2026-09-03 补测）

> 节点 `12740:33850`，渲染图 `screenshots/ios27-list-screen.png`（整屏 402×874）。
> 一个 Grouped List，**四行文本框**，四种状态：
> 占位符（未聚焦）/ 聚焦空态（有光标）/ 有值 + 光标 + 清除按钮 / 有值（未聚焦）。
> 逐像素测量脚本：`scripts/measure-textfield.mjs`（可重跑）。

**先说结论，这条比任何数值都重要：**

> ⚠️⚠️ **iOS 的表单文本框没有自己的框。**
> 没有描边、没有填充、**没有玻璃** —— 它就是分组列表里的一行，行与行靠 1pt 分隔线分开。
> 四行从头到尾没有出现任何属于输入框自己的边界。
>
> 所以 `component-inventory.md` 把 Input 标成「**B**（iOS 26 输入框是玻璃控件）」，
> 在**表单场景里是错的**。玻璃输入框确实存在，但那是**搜索栏**那个场景。
> 已在 inventory 就地标注修订。

| 项 | 值 | 可信度 | 测量方法 |
|---|---|---|---|
| 区块宽 | **370 pt** | `[实测]` | 402 的屏减两侧各 16；与 §8.2 的三块列表一致 |
| 行高 | **52 pt** | `[实测]` | 三条分隔线间距 52、52，首条距顶 52、末条距底 52 |
| 文字左内缩 | **16 pt** | `[实测]` | 有值行墨迹起于 x=32，区块左边界 x=16 |
| 分隔线 | **1 pt，宽 338（两侧各内缩 16）** | `[实测]` | 与 §8.2 的开关列表逐位一致 |
| 分隔线色 | **#e6e6e6**（压白底） | `[实测]` | 三条同色 |
| 值颜色 | **#000000** | `[实测]` | 逐像素最深墨迹 |
| **占位符颜色** | **#c5c5c7** | `[实测]` | 同上，取占位符那一行 |
| 光标 | **2 × 23 pt，#0088ff** | `[实测]` | 聚焦空态那一行整行只有它，直接量包围盒 |
| 清除按钮 | **18 × 18 pt，右内缩 17** | `[实测]` | 有值行右侧那个圆 |
| 清除按钮圆底 | **#c5c5c7**，× 为白 | `[实测]` | 与占位符同色，应当是同一个语义色 |

**两条从数值里读出来的东西：**

**一、占位符颜色过不了 WCAG AA，而且差得很远。**
#c5c5c7 压在白底上是 **1.72:1** —— 连大字的 3:1 都够不到，
离 PROJECT_SPEC §13 要求的正文 4.5:1 更远。
本库**刻意不还原**这一条，改用 `--lg-label-secondary`。
§13 的可读性地板写着「不可协商」，而占位符是文本。实测值留在表里，不抹掉。

**二、清除按钮的圆底反过来印证了 `--lg-label-tertiary` 的取值。**
该 token 是 `rgb(60 60 67 / .3)`，压白底 = 255 − 0.3 × (255 − 60) = 196.5 → **#c4c4c5**，
与实测的 #c5c5c7 只差 1/255。**没有新造 token**，直接用它。
（fill 家族最浓的一档只有 0.2，压出来 #d8d8d9，明显偏浅 —— 用错家族会看得出来。）

**仍然缺的**：
- **多行输入（UITextView）一个样例都没有。** 翻遍这份资源只有单行 Text Field。
  Textarea 里多行特有的几何（最小高度、行高、竖向内边距）因此**全部是 `[推定]`**。
- **「标签 + 控件 + 说明 + 错误」这种四段式表单行不存在。** iOS 把说明放在
  Section footer 里，行内不带说明。Field 组件的字号与间距也就没有依据，同样全是 `[推定]`。
- 暗色版同样没有（与 §8.2 一样）。

## 9. 颜色

PROJECT_SPEC §6 列出的 iOS 系统色与标签色表（`#007AFF` / `#0A84FF` 等）
**在本次研究中未逐个核对**。更重要的是 Apple 的明确警告：

> "**Avoid hard-coding system color values in your app.** Documented color values are for your reference during the app design process. **The actual color values may fluctuate from release to release**, based on a variety of environmental variables. Use APIs like `Color` to apply system colors."
— <https://developer.apple.com/design/human-interface-guidelines/color>

> **对我们的影响**：Web 端没有系统色 API，硬编码是唯一选择 —— 这没问题。
> 但必须：
> 1. 把这组值标成 `[待核实 · 社区通行值]` 而不是 PROJECT_SPEC 说的「已核实，直接用」；
> 2. 在文档站的 Theming 页**明确写出**「这些取值是对 iOS 系统色的近似，
>    Apple 保留随版本调整的权利」；
> 3. 全部走 token，便于将来一处更新。

**新增的硬性要求（`[官方]`，PROJECT_SPEC §7 未覆盖）：**

> "If you define a custom color, make sure to supply light and dark variants, **and an increased contrast option for each variant**…"

→ token 需要 **light / dark × 常规 / 高对比 = 4 套**，不是 2 套。

## 10. macOS 27 —— Checkbox / Radio / 焦点环 / Tooltip

**数据来源**：Figma 文件 *macOS 27 (Community)*，fileKey `dRTOe4ObAK8UGqW9CBoJPM`。
与 §7 相同的两条可信度前提照旧适用（版本号是 27 而非 SPEC 基准的 26；
文件标题带 "(Community)"），所以下面一律标 **`[实测]`，不升格为 `[官方]`**。

### 10.1 取得方式 —— 一次「枚举不完整」的教训

先后试过：`get_metadata` 不带 nodeId（**只返回一页 "Cover"**）、
`list_file_components_for_code_connect`（要企业席位）、
`get_variable_defs`（返回 `{}`）、对 figma.com 发 WebFetch（403）。
四条路全断，一度判断「只能由人工提供节点链接」。

真正能用的是 **`use_figma`** —— 它执行的是 Figma Plugin API 的 JavaScript。
`figma.root.children` 一次就列出了**全部 39 个页面**：

```
131:8996 Cover        207:14470 Toggles       207:14500 Text Fields
207:14477 Forms       207:14503 Tooltips      207:14483 Popovers   …
```

> **教训（与 STATUS §0.63 是同一类）**：
> `get_metadata` 的「顶层页面列表」在这两个 Apple 社区文件上**只返回封面一页**，
> 是不完整的。iOS 那边之所以能直取 `12740:*`，靠的是别处得来的节点号，
> 不是这个列表给的。
> **一个不完整的枚举返回空，不等于文件里没有东西。**
> 换一个能力更强的接口（能跑代码的那个）比继续追问人要链接有效得多。

### 10.2 Checkbox / Radio —— 几何

节点：`497:3757`（Toggles - Checkboxes）、`121:12141`（Toggles - Radio Buttons）。
各 **18 个变体** = `Active`(True/False) × `State`(Idle/Clicked/Disabled) × `Selection`(On/Off/Mixed)。

| 项 | 值 | 可信度 | 备注 |
|---|---|---|---|
| 控件方框 | **16 × 16** | `[实测]` | 两者相同 |
| Checkbox 圆角 | **5.5**，`cornerSmoothing 0.6` | `[实测]` | **squircle**，不是普通圆角 |
| Radio 圆角 | 圆（r=8 / r=100） | `[实测]` | |
| 控件↔标签间距 | **3** | `[实测]` | auto-layout `itemSpacing`；标签左沿恒在 x=19 = 16+3 |
| 对勾字形 | **9.31 × 8.93** @ (3.34, 3.53) | `[实测]` | 矢量，非字体 |
| Mixed 横杠 | **6.5 × 2** @ (4.75, 7)，全圆角 | `[实测]` | |
| Radio 圆点 | **4.8 × 4.8** @ (5.6, 5.6) | `[实测]` | = 控件的 30% |
| 标签 | **SF Pro Medium 13 / 行高 16 / 字距 0** | `[实测]` | 注意是 **Medium**，不是 Regular |

> **Radio 也有 Mixed 变体。** 单选按钮不该有「部分选中」——
> 这是这份 kit 复用同一套变体矩阵的产物，不是 macOS 的真实状态。
> 本库的 RadioGroup **不实现 mixed**。

### 10.3 Checkbox / Radio —— 配色矩阵

`Active=False` 是「窗口失焦」态（蓝色退化成灰）。**Web 没有窗口焦点概念，本库忽略这一维**，
只取 `Active=True`。

**Light**

| State | 未选中底 | 选中底 | 字形 | 标签 |
|---|---|---|---|---|
| Idle | `#000000 @ 0.10` | `#0088ff` | `#ffffff` | `#000000 @ 0.85` |
| Clicked | `#000000 @ 0.19` | `#0088ff` + `#e6e6e6` LINEAR_BURN | `#ffffff` | `#000000 @ 0.85` |
| Disabled | `#000000 @ 0.05` | 组不透明度 0.45 ×（`#0088ff` + `#f2f2f2` LINEAR_BURN） | `#ffffff @ 0.50` | `#000000 @ 0.25` |

**Dark**

| State | 未选中底 | 选中底 | 字形 | 标签 |
|---|---|---|---|---|
| Idle | `#ffffff @ 0.10` | `#0091ff` + `#0d0d0d` LINEAR_DODGE | `#ffffff` | `#ffffff @ 0.85` |
| Clicked | `#ffffff @ 0.19` | `#0091ff` + `#141414` LINEAR_DODGE | `#ffffff` | `#ffffff @ 0.85` |
| Disabled | `#ffffff @ 0.05` | 组不透明度 0.45 ×（`#0091ff` + `#0d0d0d @ 0.45` LINEAR_DODGE） | `#ffffff @ 0.50` | `#ffffff @ 0.25` |

**混合模式算出来的等效实色**（LINEAR_BURN = `a+b−255`，LINEAR_DODGE = `a+b`，逐通道钳位）：

| | Idle | Clicked |
|---|---|---|
| Light | `#0088ff` | `#006fe6`（−25/通道） |
| Dark | `#0d9eff`（+13） | `#14a5ff`（+20） |

> 方向是反的但都对：亮色下按下**变暗**，暗色下按下**变亮** ——
> 两边都是朝「离背景更远」的方向走。

> ⚠️ **kit 自身的两处不一致**，如实记着，不要当成规律：
> 1. 暗色样例区里未选中的 disabled 底，有的写 `#ffffff@0.05`、有的写 `#ffffff@0.03`；
> 2. `Active=False, Clicked, On` 的 checkbox 底是两层填充（`#000000@0.06` + `@0.13`），
>    而同状态的 radio 是单层 `#000000@0.19`。

### 10.4 焦点环 `[实测]`

节点 `479:5498`（Light）/ `4336:13801`（Dark），取自 **Text Fields** 页
（Toggles 的变体矩阵里**没有** Focused 这一维 —— 焦点环是 AppKit 画的，不在组件里）。

```
INNER_SHADOW  #0088ff  blur 0  spread 1      ← 形状内 1px
DROP_SHADOW   #0088ff  blur 0  spread 3.5    ← 形状外 3.5px
```

两条都是**硬边**（blur = 0），明暗两套**同色**。等效 CSS：

```css
box-shadow: inset 0 0 0 1px #0088ff, 0 0 0 3.5px #0088ff;
```

承载它的那个 Frame 填充是 `#ffffff` MULTIPLY（亮）/ `#000000` SCREEN（暗）——
两者都是恒等运算，即**填充本身不可见，只有两条阴影在画**。是 kit 的一个技巧。

### 10.5 Tooltip `[实测]` —— 推翻了本库现有的全部推定值

节点 `0:2793`（Tooltips 页）。Phase 7 第三批做 Tooltip 时写的是
「只有一句 HIG 原文，几何全部 `[推定]`」—— **现在有图了，且量出来的值几乎条条不同。**

| 项 | 实测 | 本库原推定 | 差 |
|---|---|---|---|
| 内边距 | **上 3 / 右 6 / 下 2 / 左 6** | 上下 6 / 左右 10 | 上下窄一半，且**上下不对称** |
| 圆角 | **0** | 8 | 完全不同 |
| 字号 / 行高 | **11 / 13** | 13 / — | 小一号 |
| 字重 | **SF Pro Medium** | 继承 | |
| 尺寸（"Tooltip" 一词） | 49 × 18 | — | |

**圆角 = 0 这一条做了两次独立确认**，因为反直觉：

1. 节点属性 `cornerRadius: 0`，四角分别读也都是 0；
2. 逐像素量渲染图（`scripts/` 同款 PNG 解码）：面板左上角 `(0,0)` 的亮度就是
   面板本体色 **239**，没有任何过渡像素。若半径哪怕是 2，该点必然接近白。

缩略图上看着像圆角，是那圈 `#000000 @ 0.40 / blur 2` 的紧贴阴影造成的错觉。

**材质**（这是本次最有价值的部分 —— macOS tooltip **确实是玻璃**）：

| | Light | Dark |
|---|---|---|
| 面板填充 | `#333333` LINEAR_DODGE + `#ececec @ 0.88` | `#000000 @ 0.50` |
| 背景模糊 | 外层 20 + 内层 60 | 同 |
| 描边 | `#ffffff @ 0.00` 0.6px inside（**不可见**） | `#ffffff @ 0.15` 0.6px inside |
| 落影 | `0 2 8 #000000@0.20` + `0 0 2 #000000@0.40` | 同 |
| 标签 | `#1a1a1a` | `#f5f5f5` |

> **反算核对**：白底上 `255 + 0x33` 钳位到 255，再 `236×0.88 + 255×0.12 = 238.3`。
> 实测面板中心亮度 **239**。模型对上了，说明这几个填充的解析没读错。


## 11. 汇总：本文件的完成度

| PROJECT_SPEC §1.5 要求 | 状态 |
|---|---|
| 组件尺寸 / 圆角 / 间距表 | 🟡 **部分完成**。Tab Bar / Switch / Slider / Sheet / Alert / Menu 已有 `[实测]`（§7），Button 亦有（工具栏节点与 Alert 两处互相印证），Grouped List 已有（§8.2），Checkbox / Radio / 焦点环 / Tooltip 已有（§10，macOS 27）；Popover / Stepper / Toolbar 变体、以及 Section header / footer **仍缺** |
| 字号表（Dynamic Type） | ❌ **仍全部 `[待核实]`**，本次未取得来源 |
| 每个数值标注可信度 | ✅ 已做，且新增了 `[待核实]` 一档以免把社区值伪装成官方值 |
| 严禁把推定值伪装成官方值 | ✅ 遵守。本次进一步**没有**把 iOS 27 Figma 的值升格为 `[官方]`，理由见 §7 开头两条前提 |

### 已确认的 PROJECT_SPEC 错误（需修订 SPEC）

| 位置 | SPEC 原文 | 实测 | 处理 |
|---|---|---|---|
| §10 控件尺寸 | UISwitch **51 × 31 pt，knob 圆形直径 27 pt**，标注为「已核实」 | **64 × 28 pt，knob 胶囊 38 × 24 pt** | ❗**待修订**，见 §7.3 |

### 本次新增的未决问题

| # | 问题 | 影响 |
|---|---|---|
| 1 | iOS 27 Figma 文件的发布者是否为 Apple？ | 决定 §7 能否升级为 `[官方]` |
| 2 | iOS 27 与 SPEC 基准 iOS 26 的尺寸差异有多大？ | 决定 §7 能否直接用作实现基准 |
| 3 | Sheet 圆角具体数值仍未取得 | Phase 4 ResponsiveOverlay 需要 |
| 4 | `rgb(0 136 255)` vs `#007AFF` 的差异是色彩管理还是真实改值？ | 决定是否动 `--lg-blue` token |
| 5 | 材质命名 `Liquid Glass - Regular - **Medium**` 中 Medium 的语义 | 关系到 §8 材质档位模型 |
| 6 | macOS 27 的 16pt 控件方框，在触屏语境下该放大多少？ | 见 §10.2；本库只扩命中区不改视觉尺寸，是**推定**的取舍 |
| 7 | Tooltip 圆角 0 是 macOS 的现状，还是这份 kit 画漏了？ | 见 §10.5；两次独立确认了「kit 里就是 0」，但没有真机截图佐证 |

> **§10 顺带解答了 #4 的一半**：macOS 27 的控件强调色量到的是 `#0088ff`（亮）/ `#0091ff`（暗），
> 与 iOS 那边量到的 `rgb(0 136 255)` **逐位相同**。
> 两份互相独立的资源给出同一个值，说明这不是某一份文件的色彩管理误差 ——
> `#0088ff` 就是 Liquid Glass 一代的强调蓝，`#007AFF` 是上一代的值。
