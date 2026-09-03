# 组件清单与分层

> Phase 0 研究笔记。抓取日期 **2026-08-31**。
> 来源：<https://ui.shadcn.com/docs/components>
> **实测组件总数：64 个**（与 PROJECT_SPEC §10 写的 64 一致）。

## 0. 清单核对结果

PROJECT_SPEC §10 的 P0–P3 分层**恰好覆盖 64 个组件，无遗漏**：

| 层 | SPEC 列出的组件数（展开合写项后） |
|---|---|
| P0 | 14（SPEC 写「11 个」，因为把 Tabs/Segmented、Sheet/Drawer、Dialog/AlertDialog、Toggle/ToggleGroup 合并计数） |
| P1 | 14 |
| P2 | 16 |
| P3 | 20 |
| **合计** | **64** ✅ |

**发现的两处 SPEC 笔误：**

1. `AlertDialog` 在 **P0 和 P3 中重复出现**。按 P0 处理（它是 UIAlertController 的直接对应物）。
2. P0 写「11 个」但实际列了 14 个组件名。**P0 的真实工作量是 14 个组件**，
   排期时按 14 算，不要按 11 算。

## 1. 分层标记说明

- **B** = Layer B 磨砂底座
- **I** = Layer I 强玻璃指示器
- **B+I** = 两层都有（本库最核心的形态）
- **内容层** = 不用 Liquid Glass。依据 Apple 原文
  > "Don't use Liquid Glass in the content layer."
  这类组件改用**标准材质**（ultraThin / thin / regular / thick，见 `apple-liquid-glass.md` §7）或纯不透明。
- **I(瞬时)** = 静止态接近实心，**仅在激活时**才变成 Liquid Glass。依据：
  > "An exception to this is for controls in the content layer with a transient interactive element
  > like sliders and toggles; in these cases, the element takes on a Liquid Glass appearance
  > to emphasize its interactivity **when a person activates it**."
  → **这是 PROJECT_SPEC §2 分层速查表漏掉的一档**，Slider / Switch 属于这一类，
  不能和 tab bar 选中胶囊用同一套「常驻玻璃」处理。

---

## 2. P0 —— 14 个（Apple 有直接对应物）

| # | 组件 | Apple 对应 | 分层 | 备注 |
|---|---|---|---|---|
| 1 | **Tabs** | UISegmentedControl / SwiftUI `Picker(.segmented)` | **B + I** | **第一个做**。凹槽=B，选中块=I。分层最纯粹的样本 |
| 2 | **Slider** | UISlider / SwiftUI `Slider` | **B + I(瞬时)** | 轨道=B；knob 静止接近实心白，**拖动时才转强玻璃** |
| 3 | **Switch** | UISwitch / SwiftUI `Toggle` | **B + I(瞬时)** | 同上。尺寸 51×31pt 是 `[待核实]`，见 `apple-metrics.md` §7 |
| 4 | **Button** | UIButton `.glass()` / `.prominentGlass()` / `.clearGlass()` / `.prominentClearGlass()` | 静止 B，按下 I | **variant 命名对齐 UIKit 的四象限**（clear × prominent），不要自创 |
| 5 | **Sheet** | UISheetPresentationController | **B**（面板）+ I（grabber） | detents：large / medium(≈半高)；展开到全高时转更不透明 |
| 6 | **Drawer** | 同上（iOS 底部 sheet） | **B** + I（grabber） | 与 Sheet 共用一套 detent / grabber 实现 |
| 7 | **Dialog** | UIAlertController（alert 样式） | **B** | 面板；无指示器。regular 变体（文字多） |
| 8 | **Alert Dialog** | UIAlertController | **B** | 同上。**SPEC 里 P0/P3 重复，归 P0** |
| 9 | **Select** | UIPickerView / UIMenu | **B**（弹层）+ I（高亮项） | 移动端形态待定，见 `STATUS.md` 质疑 #1 |
| 10 | **Dropdown Menu** | UIMenu | **B** + I（高亮项） | iOS 26 的菜单项带图标 |
| 11 | **Popover** | UIPopoverPresentationController | **B** | regular 变体 |
| 12 | **Toggle** | 无 1:1 对应；接近 UIButton 的选中态 | 静止 B，选中 I | |
| 13 | **Toggle Group** | UISegmentedControl（多选形态） | **B + I** | 与 Tabs 共用底层 |
| 14 | **Card** | Grouped list section | **内容层** | ⚠️ **不许堆玻璃**。用标准材质或不透明。SPEC 自己也这么要求 |

> **P0 的 Fidelity 对照图目前一张都没有** —— 因为 Phase 0 没有 iOS 真机截图。
> 见 `STATUS.md` 阻塞项 #1。

## 3. P1 —— 14 个（高频、能体现材质）

| # | 组件 | Apple 对应 | 分层 |
|---|---|---|---|
| 15 | **Input** | UITextField | ~~**B**（iOS 26 输入框是玻璃控件）~~ → **内容层**（见下方修订） |
| 16 | **Input Group** | UITextField + 附件视图 | **B** |
| 17 | **Textarea** | UITextView | 内容层 / 弱 B |
| 18 | **Checkbox** | 无 iOS 对应（iOS 用 checkmark 行）；macOS NSButton checkbox | **B + I(瞬时)** |
| 19 | **Radio Group** | 无 iOS 对应；macOS NSButton radio | **B + I(瞬时)** |
| 20 | **Label** | 无 Apple 控件对应，属排版 | 内容层 |
| 21 | **Field** | SwiftUI Form row | 内容层 |
| 22 | **Tooltip** | macOS tooltip（> "the system displays a tooltip after people hover over a button"） | **B** |
| 23 | **Toast** | 无直接对应；接近系统通知横幅 | **B** |
| 24 | **Badge** | 无直接对应；接近 UIBadge / 列表附件 | 内容层（小尺寸玻璃看不出效果） |
| 25 | **Avatar** | 无 Apple 控件对应 | 内容层 |
| 26 | **Separator** | UITableView separator | 内容层（用 `separator` / `opaqueSeparator` 色） |
| 27 | **Skeleton** | 无 Apple 对应 | 内容层 |
| 28 | **Progress** | UIProgressView | **B**（轨道）+ 填充段 |

> ⚠️ **第 15 行的分层判断已被实测推翻（2026-09-03）。**
>
> 逐像素量过官方资源里那四行 Text Field（节点 `12740:33850`，
> 脚本 `scripts/measure-textfield.mjs`，记录见 `apple-metrics.md` §8.3）：
> **iOS 的表单文本框没有自己的框** —— 没有描边、没有填充、没有玻璃，
> 就是分组列表里的一行，行与行靠 1pt 分隔线分开。
>
> 「输入框是玻璃控件」成立的是**搜索栏**那个场景，不是表单行。
> 本库因此给 Input 两个 variant，并把哪个有依据写在组件头部：
> `list` 有实测依据，`field`（独立成框的玻璃胶囊）**没有任何 Apple 参考**。
>
> 同一条修订也适用于第 17 行的 Textarea —— 而且更糟：
> **资源里连多行输入的样例都没有**，它多行特有的几何全是 `[推定]`。

## 4. P2 —— 16 个（结构与数据类，材质克制）

| # | 组件 | Apple 对应 | 分层 |
|---|---|---|---|
| 29 | **Accordion** | 无直接对应；接近 grouped list 可折叠 section | **内容层** |
| 30 | **Collapsible** | 同上 | **内容层** |
| 31 | **Scroll Area** | UIScrollView | 内容层 + **滚动边缘效果** |
| 32 | **Table** | UITableView / lists-and-tables | **内容层**（⚠️ 明令禁止堆玻璃） |
| 33 | **Data Table** | 同上 | **内容层** |
| 34 | **Pagination** | 无 iOS 对应；接近 UIPageControl | **B** |
| 35 | **Breadcrumb** | 无 iOS 对应；macOS path control | 内容层 |
| 36 | **Navigation Menu** | UINavigationBar / 菜单栏 | **B**（导航层，玻璃合法） |
| 37 | **Menubar** | iPadOS 新增的 menu bar | **B + I**（高亮项） |
| 38 | **Context Menu** | UIContextMenuInteraction | **B + I** |
| 39 | **Command** | 无 iOS 对应；接近 Spotlight | **B + I**（高亮项） |
| 40 | **Combobox** | UIPickerView + 搜索 | **B + I** |
| 41 | **Calendar** | UICalendarView | 内容层 + **I(瞬时)**（选中日期） |
| 42 | **Date Picker** | UIDatePicker | **B + I** |
| 43 | **Sidebar** | HIG sidebars（**导航层，明确点名**） | **B**，且> "more opaque in larger elements like sidebars" |
| 44 | **Resizable** | NSSplitView / UISplitViewController | 内容层（分隔条可用弱 B） |

> **Sidebar 有一条专属规则**：Apple 明说大元素（sidebar）的玻璃**更不透明**。
> 不能和 tab bar 用同一组 alpha。

## 5. P3 —— 20 个（补齐与扩展）

| # | 组件 | Apple 对应 | 分层 |
|---|---|---|---|
| 45 | **Alert** | 无（内联提示条，非 UIAlertController） | 内容层 |
| 46 | **Aspect Ratio** | 无 Apple 对应，纯布局工具 | 无材质 |
| 47 | **Button Group** | **toolbar 分组共享背景** | **B**（整组一个底座）+ I（按下项） |
| 48 | **Carousel** | 无直接对应；接近 UIPageViewController | 内容层 |
| 49 | **Chart** | 无 Apple 控件对应（Swift Charts 属内容） | 内容层 |
| 50 | **Empty** | 无 Apple 对应 | 内容层 |
| 51 | **Hover Card** | macOS hover 浮层 | **B** |
| 52 | **Input OTP** | UITextField（oneTimeCode） | **B** |
| 53 | **Item** | 无 Apple 对应，列表行原语 | 内容层 |
| 54 | **Kbd** | 无 Apple 对应 | 内容层 |
| 55 | **Native Select** | 原生 `<select>` | 由 UA 决定，**不套材质** |
| 56 | **Spinner** | UIActivityIndicatorView | 内容层 |
| 57 | **Typography** | HIG typography | 无材质，纯 token |
| 58 | **Direction** | 无 Apple 对应（RTL 工具） | 无材质 |
| 59 | **Marker** | 无 Apple 对应 | 内容层 |
| 60 | **Attachment** | 无 Apple 对应（AI 原语） | 内容层 |
| 61 | **Bubble** | 接近 Messages 气泡 | 内容层 |
| 62 | **Message** | 同上 | 内容层 |
| 63 | **Message Scroller** | 同上 + 滚动边缘效果 | 内容层 |
| 64 | **Questionnaire** | 无 Apple 对应（AI 原语） | 内容层 |

> `Button Group` 值得从 P3 提前：它对应 Apple 明确讲过的
> **toolbar 分组共享背景**机制（`ToolbarSpacer` / `glassEffectUnion`），
> 是 `<GlassContainer>` 的 union 模式最直接的使用场景。
> **建议移到 P1**，理由见 `STATUS.md` 建议 #3。

## 6. 分层统计

| 分层 | 数量 | 占比 |
|---|---|---|
| 含 Liquid Glass（B / I / B+I） | 25 | 39% |
| 纯内容层 / 无材质 | 39 | 61% |

> **这个比例本身就是对 PROJECT_SPEC 的一条重要印证**：
> 一个「Liquid Glass 组件库」里，**六成组件根本不该有玻璃**。
> Apple 的 "Avoid overusing" 与 "Don't use Liquid Glass in the content layer"
> 决定了这一点。文档站的 Materials 页应当**直接把这张统计放上去** ——
> 它是本库与其他「毛玻璃 UI 库」最直观的分水岭。

## 7. 未完成

- [ ] 每个组件的 `// APPLE REFERENCE:` 注释块（PROJECT_SPEC §10 要求）需在实现时逐个补写
- [ ] 组件对应的 Apple 控件里，有多个只是我按经验对上的
      （Checkbox / Radio / Pagination / Command 等），**未经 HIG 逐页核实** → 标为待核实
- [ ] shadcn 组件集会持续增加，Phase 7 开始前应重新抓一次清单并 diff
