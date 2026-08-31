# Apple Liquid Glass —— 材质原理与规则

> Phase 0 研究笔记。抓取日期 **2026-08-31**。
> 每条结论标注来源 URL。凡是没有找到原文出处的推论，一律显式标注「**推论**」。
> Apple 文档站 `/documentation/` 路径加 `.md` 后缀可拿到纯 Markdown 全文（实测有效）；
> `design/human-interface-guidelines/` 无 `.md` 版本，需用浏览器读渲染后页面
> （实测必须等 JS 渲染完成，否则只拿到导航空壳）。

## 1. 材质定位：控件与导航层，不是内容层

- > "This material forms a distinct functional layer for controls and navigation elements."
  — <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md>
- > "Liquid Glass applies to the topmost layer of the interface, where you define your navigation."
  — 同上
- > "**Don't use Liquid Glass in the content layer.** Liquid Glass works best when it provides a clear distinction between interactive elements and content, and including it in the content layer can result in unnecessary complexity and a confusing visual hierarchy."
  — <https://developer.apple.com/design/human-interface-guidelines/materials>

### 1.1 唯一的例外（PROJECT_SPEC 未提及，重要）

> "An exception to this is for controls in the content layer with a transient interactive element like sliders and toggles; in these cases, **the element takes on a Liquid Glass appearance to emphasize its interactivity when a person activates it**."
— <https://developer.apple.com/design/human-interface-guidelines/materials>

**这句话比 PROJECT_SPEC §2 的描述更强。** SPEC 说指示器「静止时保持中等强度，交互时上扬」；
Apple 的原文是内容层控件的 knob **在被激活时才「takes on」玻璃外观**。配合 adopting 文档：

> "For controls like sliders and toggles, the knob transforms into Liquid Glass during interaction."
— <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md>

→ 结论：**内容层里的 Slider / Switch，其 knob 静止态应当接近实心（iOS 的白色 knob + 落影），
只在按下/拖动时才切到强玻璃。** 导航层里的指示器（tab bar 选中胶囊、segmented 选中块）
则可以常驻玻璃。这是两类不同的 Layer I，PROJECT_SPEC 的分层速查表把它们混为一谈了。
详见 `STATUS.md` 质疑 #2。

## 2. 光学属性

> "Liquid Glass is a material that **blurs content behind it, reflects color and light of surrounding content, and reacts to touch and pointer interactions in real time**."
— <https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views.md>

`glassEffect(_:in:)` 的行为被明确拆成两半：

> "When you use this effect, the system:
> - Renders a shape anchored behind a view with the Liquid Glass material.
> - **Applies the foreground effects of Liquid Glass over a view.**"
— <https://developer.apple.com/documentation/SwiftUI/View/glassEffect(_:in:).md>

**「foreground effects」是 PROJECT_SPEC 完全没有覆盖的一半。** SPEC 把玻璃当成纯 backdrop 处理
（`backdrop-filter` + 描边 + 高光），但 Apple 明确说材质还会在内容**之上**再施加一层前景效果。
对应 HIG 的 vibrancy 概念（见 §6）。

## 3. 两个变体

| 变体 | 声明 | 文档描述 |
|---|---|---|
| `regular` | `static var regular: Glass { get }` | "The regular variant of the Liquid Glass material." |
| `clear` | `static var clear: Glass { get }` | "The clear variant of glass." |

来源：<https://developer.apple.com/documentation/SwiftUI/Glass/regular.md> ·
<https://developer.apple.com/documentation/SwiftUI/Glass/clear.md>

HIG 给出了选用规则和一个**具体数值**：

> "The **regular** variant blurs and **adjusts the luminosity** of background content to maintain legibility of text and other foreground elements. … Most system components use this variant. Use the regular variant when background content might create legibility issues, or when components have a significant amount of text, such as alerts, sidebars, or popovers."

> "**Only use clear Liquid Glass for components that appear over visually rich backgrounds.**"

> "If the underlying content is bright, consider adding a **dark dimming layer of 35% opacity**."

— 三条均出自 <https://developer.apple.com/design/human-interface-guidelines/materials>

`clear` 的 API 文档重复了这条要求：

> "When using clear glass, ensure content remains legible by adding a dimming layer or other treatment beneath the glass."

配套示例是 `.glassEffect(.clear).background(.black.opacity(0.3))`
— <https://developer.apple.com/documentation/SwiftUI/Glass/clear.md>

> ⚠️ API 示例用 `0.3`、HIG 用 `35%`，两处不一致。取 HIG 的 **35%** 作为默认
> （HIG 是设计规范的权威），并在 token 里留一个可调变量。

## 4. 修饰符 API（用于对齐我们的参数命名）

```swift
nonisolated func glassEffect(_ glass: Glass = .regular,
                             in shape: some Shape = DefaultGlassEffectShape()) -> some View
func tint(_ color: Color?) -> Glass
func interactive(_ isEnabled: Bool = true) -> Glass
```

- 默认形状是 **Capsule**：> "SwiftUI uses the `regular` variant by default along with a `Capsule` shape."
  — <https://developer.apple.com/documentation/SwiftUI/View/glassEffect(_:in:).md>
- `interactive()`：> "Add `interactive(_:)` to custom components to make them react to touch and pointer interactions. This applies the same responsive and fluid reactions that `glass` provides to standard buttons."
  — <https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views.md>
- 全部 API 的 availability 均为 **iOS / iPadOS / macCatalyst / macOS / tvOS / watchOS 26.0+**。

> **对我们的影响**：默认形状是 Capsule 而不是圆角矩形，PROJECT_SPEC 没写默认形状。
> `<GlassSurface>` 的 `shape` prop 默认值应当是 `capsule`。

## 5. 颜色：玻璃本身没有颜色

> "**By default, Liquid Glass has no inherent color, and instead takes on colors from the content directly behind it.** You can apply color to some Liquid Glass elements, giving them the appearance of colored or stained glass. This is useful for drawing emphasis to a specific control, like a primary call to action, and is the approach the system uses for prominent button styling."
— <https://developer.apple.com/design/human-interface-guidelines/color>

同页另外三条关键规则（PROJECT_SPEC 均未覆盖）：

1. **元素级明暗自适应**
   > "For smaller elements like toolbars and tab bars, the system can adapt Liquid Glass **between a light and dark appearance in response to the underlying content**. By default, symbols and text on these elements follow a monochromatic color scheme, becoming darker when the underlying content is light, and lighter when it's dark."
2. **尺寸影响不透明度**
   > "Liquid Glass appears **more opaque in larger elements like sidebars** to preserve legibility over complex backgrounds and accommodate richer content on the material's surface."
3. **着色要克制**
   > "Apply color sparingly … To emphasize primary actions, apply color to the **background** rather than to symbols or text. … **Refrain from adding color to the background of multiple controls.**"

> **对我们的影响（大）**：第 1 条是元素级、随背景内容变化的局部明暗反转，
> 与 PROJECT_SPEC §7 的全局 `.dark` class 策略是**两套正交机制**。Web 端要做到需要采样元素背后的
> 背景亮度。这是本库能否「看起来像 iOS」的关键之一，也是最大的实现风险之一。见 `optics-web.md` §6。

## 6. Vibrancy（PROJECT_SPEC 的 alpha 标签色是简化近似）

> "**Help ensure legibility by using vibrant colors on top of materials.** When you use system-defined vibrant colors, you don't need to worry about colors seeming too dark, bright, saturated, or low contrast in different contexts. Regardless of the material you choose, use vibrant colors on top of it."
— <https://developer.apple.com/design/human-interface-guidelines/materials>

iOS / iPadOS 定义的 vibrancy 级别：

- 标签：`UIVibrancyEffectStyle.label`（默认）/ `.secondaryLabel` / `.tertiaryLabel` / `.quaternaryLabel`
- 填充：`.fill`（默认）/ `.secondaryFill` / `.tertiaryFill`
- 分隔线：单一级别
- > "In general, **avoid using quaternary on top of the thin and ultraThin materials, because the contrast is too low.**"

**Vibrancy 不是 alpha。** 它是依赖背景的混合效果，会把背后的光和色「拉」到前景文字上。
PROJECT_SPEC §6 用带 alpha 的 `#3C3C43 60%` 之类近似它 —— 这是可接受的一级近似，
但必须承认它不是 vibrancy。Web 端更接近的做法见 `optics-web.md` §7。

## 7. 标准材质（内容层的材质系统，PROJECT_SPEC 完全没提）

> "In addition to Liquid Glass, iOS and iPadOS continue to provide **four standard materials — ultra-thin, thin, regular (default), and thick** — which you can use in the content layer to help create visual distinction."

> "Thicker materials, which are more opaque, can provide better contrast for text and other elements with fine features. Thinner materials, which are more translucent, can help people retain their context by providing a visible reminder of the content that's in the background."

— <https://developer.apple.com/design/human-interface-guidelines/materials>

> **对我们的影响**：PROJECT_SPEC 说内容型组件「用不透明或极弱材质」，方向对但过于笼统。
> 正确做法是给内容层一套独立的 4 档标准材质 token
> （`--lg-material-ultrathin / thin / regular / thick`），与 Layer B / Layer I 并列，
> 而不是「随便调低透明度」。

## 8. 不要滥用、不要叠加

> "**Avoid overusing Liquid Glass effects.** If you apply Liquid Glass effects to a custom control, do so sparingly. Liquid Glass seeks to bring attention to the underlying content, and overusing this material in multiple custom controls can provide a subpar user experience by distracting from that content. **Limit these effects to the most important functional elements in your app.**"

> "**Check for crowding or overlapping of controls.** Prefer to use standard spacing metrics instead of overriding them, and **avoid overcrowding or layering Liquid Glass elements on top of each other**."

— 均出自 <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md>

## 9. 融合与形变（GlassEffectContainer）

- > "A view that combines multiple Liquid Glass shapes into a single shape that can morph individual shapes into one another."
- > "Configure how shapes interact with one another by customizing the default spacing value of the container. As shapes near one another, their paths start to blend into one another. **The higher the spacing, the sooner blending begins as the shapes approach each other.**"
  — <https://developer.apple.com/documentation/SwiftUI/GlassEffectContainer.md>
- > "A spacing value on the container that's **larger than the spacing of an interior `HStack`, `VStack`, or other layout container** causes Liquid Glass effects to **blend together at rest** because the views are too close to each other."
- > "The `glassEffect(_:in:)` modifier captures the content to send to the container to render. **Apply the `glassEffect(_:in:)` modifier after other modifiers that affect the appearance of the view.**"
  — <https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views.md>

### 9.1 转场类型

- `glassEffectID(_:in:)` + `Namespace` 关联身份。
- 默认转场：**位于容器 spacing 之内**的增删用 `GlassEffectTransition.matchedGeometry`。
- **超出 spacing** 的增删用 `.materialize` + `withAnimation(_:_:)`。
- > "The system applies **more than opacity changes** with the available transition types."
- > "The `glassEffectID(_:in:)` and `glassEffectTransition(_:)` modifiers **only affect their content during view hierarchy transitions or animations**."

### 9.2 `glassEffectUnion(id:namespace:)` —— PROJECT_SPEC 遗漏的第三种组合方式

> "In some cases, you want the geometries of multiple views to contribute to a single Liquid Glass effect capsule, **even when your content is at rest**. Use the `glassEffectUnion(id:namespace:)` modifier to specify that a view contributes to a unified effect with a particular ID. This combines all effects with a similar shape, Liquid Glass effect, and ID into a single shape with the applied Liquid Glass material."

→ 这正是 toolbar「分组共享一个背景」的实现机制。我们的 `<GlassContainer>` 需要**三种**模式，
不是两种：**blend（靠近自动融合）/ union（静止即合并为一体）/ morph（增删时形变）**。

## 10. 性能

> "**Combine custom Liquid Glass effects to improve rendering performance.** If you apply these effects to custom elements, make sure to combine them using a `GlassEffectContainer`, which helps optimize performance while fluidly morphing Liquid Glass shapes into each other."

> "Creating too many Liquid Glass effect containers and applying too many effects to views outside of containers **can degrade performance. Limit the use of Liquid Glass effects onscreen at the same time.**"

Apple **没有给出具体数量上限**。PROJECT_SPEC §5.2 的「单屏 Tier-A 折射实例 ≤ 8 个」属于 `[推定]`，
不要在文档里把它写成 Apple 的建议。

## 11. 滚动边缘效果

> "**Optimize for legibility when content scrolls beneath controls.** Scroll views offer a scroll edge effect that helps maintain sufficient legibility and contrast for controls by **obscuring content that scrolls beneath them**. System bars like toolbars adopt this behavior by default."
— <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md>

> "Scroll edge effects further enhance legibility by **blurring and reducing the opacity of background content**."
— <https://developer.apple.com/design/human-interface-guidelines/materials>

API：`scrollEdgeEffectStyle(_ style: ScrollEdgeEffectStyle?, for edges: Edge.Set)`，
> "By default, a scroll view renders an automatic edge effect."

文档示例用 `.hard`：

```swift
ScrollView {
    LazyVStack { ForEach(data) { item in RowView(item) } }
}
.scrollEdgeEffectStyle(.hard, for: .all)
```

— <https://developer.apple.com/documentation/SwiftUI/View/scrollEdgeEffectStyle(_:for:).md>

> ⚠️ **注意方向**：Apple 说的是**模糊并降低背后内容的不透明度**，
> 而 PROJECT_SPEC §13 写的是「栏底自动增加不透明度」。两者视觉结果相近但实现不同：
> 前者作用在**背景内容**上（soft / hard 两档遮罩），后者作用在**栏自身**上。按 Apple 的方向实现。

## 12. 同心圆角（`ConcentricRectangle`）

> "A rounded corner of a rectangle is *concentric* relative to the container shape's adjacent corner when the corner's radius **shares a common center** with the containing shape's rounded corner radius."

> "`ConcentricRectangle` automatically calculates each corner's radius relative to the container shape, so your view adapts correctly across devices and sizes **without hard-coded values**."

> "When your `ConcentricRectangle`'s corners are **far away** from the containing shape's corners, such as the top corners in this example, **the corner radius the system calculates may be zero**. When that happens, the corner is square."

— <https://developer.apple.com/documentation/SwiftUI/ConcentricRectangle.md>

角样式枚举 `Edge.Corner.Style`：`concentric` / `concentric(minimum:)` / `fixed(_:)` / 方角。
容器形状由 `containerShape(_:)` 提供；容器不符合 `RoundedRectangularShape` 时
退化为 `ContainerRelativeShape`。

> **对 PROJECT_SPEC §6 的修正**：`concentricRadius(parentRadius, inset) = parentRadius - inset`
> 只是「同心」在单一内缩场景下的特例，方向正确但不完整。真正的模型是**逐角**解析，
> 且距离容器角太远时半径应当归零（而不是继续用 parent − inset 算出一个不该存在的圆角）。
> 我们的工具函数需要 `concentric(minimum:)` 的等价物，并且要接受「容器形状」而不只是一个数字。

## 13. 无障碍与降级

> "Translucency and fluid morphing animations contribute to the look and feel of Liquid Glass, but can adapt to people's needs. For example, people can **choose a preferred look for Liquid Glass in their device's settings**, or turn on accessibility settings that **reduce transparency or motion** in the interface. These settings can remove or modify certain effects."
— <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md>

> "The appearance of these variants can differ in response to certain system settings, like if people choose a preferred look for Liquid Glass in their device's settings, or turn on accessibility settings that **reduce transparency or increase contrast** in the interface."
— <https://developer.apple.com/design/human-interface-guidelines/materials>

**「preferred look for Liquid Glass in their device's settings」正是 PROJECT_SPEC §8 材质档位滑杆的官方依据。**
但 Apple 文档没有公布这条滑杆的档数或数值映射 → 我们的 4 档 + 连续插值属于 `[推定]`。

颜色侧的硬性要求：

> "If you define a custom color, make sure to supply light and dark variants, **and an increased contrast option for each variant** that provides a significantly higher amount of visual differentiation. **Even if your app ships in a single appearance mode, provide both light and dark colors to support Liquid Glass adaptivity in these contexts.**"
— <https://developer.apple.com/design/human-interface-guidelines/color>

→ 即 token 体系需要 **light / dark × 常规 / 高对比 = 4 套**，而不是 PROJECT_SPEC §7 说的 2 套。

## 14. 其他会影响组件设计、但 PROJECT_SPEC 未提及的点

来源均为 <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md>，除非另注。

1. **Action sheet 不再从底部弹出**
   > "An action sheet **originates from the element that initiates the action, instead of from the bottom edge of the display**. When active, an action sheet also lets people interact with other parts of the interface."

   → 与 PROJECT_SPEC §9「移动端下拉类一律改底部 Drawer」直接冲突。见 `STATUS.md` 质疑 #1。
2. **半屏 sheet 展开到全高时会变得更不透明**
   > "half sheets are inset from the edge of the display to allow content to peek through from beneath them. When a half sheet expands to full height, it **transitions to a more opaque appearance** to help maintain focus on the task."
3. **Toolbar 分组共享背景**，用 `ToolbarSpacer` / `SpacerSizing.fixed` 分隔；
   > "For consistency, **don't mix text and icons across items that share a background**."
4. **Tab bar 可随滚动最小化**：`.tabBarMinimizeBehavior(.onScrollDown)`。
5. **列表 / 表单**：行高与内边距变大，section 圆角变大；
   > "section headers **no longer render entirely in capital letters**" → 采用 title-style 大小写。
6. **控件新增 extra-large 尺寸**：> "Controls also feature an option for an extra-large size, allowing more space for labels and accents."
7. **背景延伸效果** `backgroundExtensionEffect()`：镜像相邻内容并模糊，
   制造内容延伸到 sidebar / inspector 之下的错觉。
8. **形状来自硬件**：> "The shape of the hardware informs the curvature of controls, so many controls adopt rounder forms to elegantly nestle into the corners of windows and displays."
9. **按钮样式**：SwiftUI `.glass` / `.glassProminent` / `.glass(_:)`；
   UIKit `glass()` / `prominentGlass()` / `clearGlass()` / `prominentClearGlass()`
   → UIKit 侧存在 **clear × prominent 的四象限组合**，我们的 Button variant 应当对齐这四种，
   而不是自创命名。
10. **`UIDesignRequiresCompatibility`** Info.plist key 可让 App 保持旧外观
    —— 说明 Apple 自己也认为这是破坏性视觉变更。

## 15. 未完成 / 未核实（Phase 0 的已知缺口）

- [ ] **WWDC25 视频文字稿（219 / 356 / 323 / 284 / 310）未读。**
      219 "Meet Liquid Glass" 是 PROJECT_SPEC 点名最核心的一份，需用浏览器打开 Transcript 标签页。
- [ ] HIG 只读了 `materials` / `color` / `sheets` / `buttons` 四页；
      `sliders` / `toggles` / `segmented-controls` / `tab-bars` / `menus` / `toolbars` /
      `typography` / `layout` / `accessibility` 未读。
- [ ] Apple Design Resources（Figma / Sketch 源文件）未下载
      → 这是 `apple-metrics.md` 里大量数值只能标 `[推定]` 的直接原因。
- [ ] `UIGlassEffect` 的属性列表（style / tintColor / isInteractive）未拿到：
      `.md` 版本只输出 Overview 与 Relationships，**不含 Topics 成员列表**。
      需逐个符号页抓取，或改用浏览器读渲染页。
- [ ] `GlassEffectTransition` / `DefaultGlassEffectShape` 的完整定义未抓。
