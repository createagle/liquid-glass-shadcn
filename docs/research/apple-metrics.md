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
> ⚠️ **本文件目前没有任何一条 `[实测]`。**
> 原因：本次 Phase 0 没有 iOS 真机截图，也没有下载 Apple Design Resources。
> PROJECT_SPEC §10 要求「其余尺寸由你在 Phase 0 中测量确定」—— **这一项没有完成**，
> 见 `STATUS.md` 的缺口清单。

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

| 项 | PROJECT_SPEC 的值 | 可信度 | 说明 |
|---|---|---|---|
| UISwitch | 51 × 31 pt，knob 直径 27 pt | `[待核实]` | 这是长期流传的 **UIKit 旧版**度量。iOS 26 明确改过控件尺寸（见下），**很可能已经不准**。 |
| 其他控件（Slider 轨道高、Segmented 高度、Tab bar 高度、指示器 inset…） | —— | **全部缺失** | PROJECT_SPEC 要求 Phase 0 测量确定，**未完成** |

**iOS 26 明确说控件尺寸变了：**

> "**Review updates to control appearance and dimensions.** If you use standard controls from system frameworks and **don't hard-code their layout metrics**, your app adopts changes to shapes and sizes automatically…"
> "Controls also feature **an option for an extra-large size**, allowing more space for labels and accents."
> "The shape of the hardware informs the curvature of controls, so many controls adopt **rounder forms**."

— <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md>

> ⚠️ **这是本文件最大的风险点。** PROJECT_SPEC 的 P0 验收要求「像素级对齐」，
> 但我们现在**没有一个 iOS 26 控件的可信尺寸**。
> 继续做下去只有两条路：(a) 你提供 iOS 26 真机截图 / Apple Design Resources 让我实测；
> (b) 全部标 `[推定]` 并明确告知用户本库是「风格还原」而非「尺寸还原」。
> 建议 (a)。见 `STATUS.md` 阻塞项 #1。

## 8. 列表 / 表单

| 项 | 值 | 可信度 | 出处 |
|---|---|---|---|
| 行高与内边距 | **比 iOS 18 更大**（无数值） | `[官方]`（定性） | > "organizational components like lists, tables, and forms have a larger row height and padding" |
| Section 圆角 | **增大，与全系控件曲率匹配**（无数值） | `[官方]`（定性） | > "Sections have an increased corner radius to match the curvature of controls across the system." |
| Section header 大小写 | **title-style，不再全大写** | `[官方]` | > "section headers no longer render entirely in capital letters" |

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

## 10. 汇总：本文件的完成度

| PROJECT_SPEC §1.5 要求 | 状态 |
|---|---|
| 组件尺寸 / 圆角 / 间距 / 字号表 | ❌ **大面积缺失**，只有触控目标一项是 `[官方]` |
| 每个数值标注可信度 | ✅ 已做，且新增了 `[待核实]` 一档以免把社区值伪装成官方值 |
| 严禁把推定值伪装成官方值 | ✅ 遵守；并主动把 PROJECT_SPEC 声称「已核实」的两组值
（Dynamic Type、UISwitch 尺寸）**降级**为 `[待核实]` |
