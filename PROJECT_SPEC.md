# Liquid Glass UI —— PROJECT_SPEC

## 0. 角色与目标

你是一名同时精通 **Apple 平台设计语言** 和 **现代 React 组件库工程** 的资深工程师。

你要从零构建一个名为 **Liquid Glass UI** 的开源组件库：以 Apple iOS 26 / macOS 26 的 **Liquid Glass** 设计语言为唯一视觉基准，用 Web 技术尽可能高保真地复刻，并以 **shadcn registry** 的形式分发组件源码。

这不是"加一层毛玻璃背景"的项目。**成功的判据是：把你的组件截图和 iOS 真机截图并排放，外行看不出哪个是网页。**

---

## 1. 强制第一阶段：研究（不允许跳过）

在写下第一行组件代码之前，你必须完成文献研究并产出 `docs/research/` 下的笔记。**没有这一步就开始写代码，等同于任务失败。**

### 1.1 Apple 官方文档（必读）

Apple 开发者文档站是 JS 渲染的，直接抓 HTML 会得到空壳。**在 `/documentation/` 路径的 URL 后面加 `.md` 可以拿到纯 Markdown 全文**，请用这个方式抓取：

| 文档 | 抓取地址 |
|---|---|
| Liquid Glass 总览 | `https://developer.apple.com/documentation/technologyoverviews/liquid-glass.md` |
| Adopting Liquid Glass（信息量最大，必读） | `https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass.md` |
| Applying Liquid Glass to custom views | `https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views.md` |
| Glass 类型 / regular / clear / tint / interactive | `https://developer.apple.com/documentation/SwiftUI/Glass.md` |
| `glassEffect(_:in:)` | `https://developer.apple.com/documentation/SwiftUI/View/glassEffect(_:in:).md` |
| GlassEffectContainer | `https://developer.apple.com/documentation/SwiftUI/GlassEffectContainer.md` |
| UIGlassEffect | `https://developer.apple.com/documentation/UIKit/UIGlassEffect.md` |

（上表中的 URL 我都已实测可访问。带括号和冒号的 symbol 页面若抓取失败，把 `(` `)` `:` 做 URL 编码后重试。）

HIG（`developer.apple.com/design/human-interface-guidelines/...`）没有 `.md` 版本，需要用浏览器工具读取渲染后的页面。至少覆盖这几页：`materials`、`buttons`、`sliders`、`toggles`、`segmented-controls`、`tab-bars`、`sheets`、`menus`、`toolbars`、`color`、`typography`、`layout`、`accessibility`。

WWDC25 视频文字稿（`developer.apple.com/videos/play/wwdc2025/<id>/`，Transcript 标签页）：`219`（Meet Liquid Glass，最核心）、`356`、`323`、`284`、`310`。

### 1.2 已经从官方文档中确认的关键结论（写代码时必须体现）

这些是我已经核实过的原文要点，直接作为约束：

- Liquid Glass **是"控件与导航"这一层的专属材质**，不是内容层的材质。原文：*"This material forms a distinct functional layer for controls and navigation elements."* → 你的 Card、Table、List 等内容型组件**不应该**顶着强玻璃效果。
- **Avoid overusing.** 原文：*"Liquid Glass seeks to bring attention to the underlying content, and overusing this material in multiple custom controls can provide a subpar user experience by distracting from that content."*
- **不要玻璃叠玻璃。** 原文：*"avoid overcrowding or layering Liquid Glass elements on top of each other."*
- 控件在**交互时**才活过来。原文：*"For controls like sliders and toggles, the knob transforms into Liquid Glass during interaction."* → 静止态弱、交互态强，这是核心节奏。
- 两个变体：`Glass.regular`（默认，自适应背景，保证可读性）与 `Glass.clear`（更通透，仅用于背后内容本身对比度足够的场景）。可组合 `.tint(_:)` 表达 prominence，`.interactive()` 让自定义控件获得与系统按钮一致的触摸反馈。
- `GlassEffectContainer(spacing:)` 让多个玻璃形状在靠近时**融合（blend）**、在增删时**形变（morph）**；配合 `glassEffectID(_:in:)` + `GlassEffectTransition.matchedGeometry` / `.materialize`。这是 Liquid Glass 最具辨识度的动效，Web 端必须找到等价实现。
- 滚动边缘效果（scroll edge effect）：内容滚到控件下方时，系统会遮蔽内容以保证控件可读性。这是**保证可读性的兜底手段**，Web 端要自己实现。
- 形状同心（concentric）：子元素圆角要与容器圆角同心，不是随便取值。
- 无障碍：Reduce Transparency / Reduce Motion / Increase Contrast 会移除或改变效果，必须逐项测试。

### 1.3 Web 端实现参考

- **React Bits `GlassSurface`** —— 折射效果的主要参考实现。读源码：
  `https://github.com/DavidHDev/react-bits` → `src/content/Components/GlassSurface/GlassSurface.jsx` + `GlassSurface.css`
  其 props 签名（作为你的参数命名与默认值起点）：
  ```
  width=200, height=80, borderRadius=20, borderWidth=0.07,
  brightness=50, opacity=0.93, blur=11, displace=0,
  backgroundOpacity=0, saturation=1, distortionScale=-180,
  redOffset=0, greenOffset=10, blueOffset=20,
  xChannel='R', yChannel='G', mixBlendMode='difference'
  ```
  核心机制：**运行时生成一张 SVG 位移贴图**（水平黑→红线性渐变 与 垂直黑→绿线性渐变 以 `difference` 混合，中心再叠一个模糊的黑色圆角矩形使中心零位移）→ 用 `feDisplacementMap` 以 `xChannel/yChannel` 采样 → **对 R/G/B 三个通道分别用略微不同的 scale 做三次位移，再用 `feColorMatrix` 隔离通道、`feBlend screen` 合并**，从而产生边缘色散（chromatic aberration）→ 最后通过 `backdrop-filter: url(#filterId)` 作用到元素背后的真实 DOM 上。
- 补充参考（用于交叉验证与降级方案）：
  - `https://kube.io/blog/liquid-glass-css-svg/`（原理讲解最清楚）
  - `https://github.com/PallavAg/liquid-glass-web-react`（跨浏览器折射）
  - MDN `feDisplacementMap`：`https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap`

### 1.4 shadcn registry 文档（必读）

- `https://ui.shadcn.com/docs/registry`（总览）
- `https://ui.shadcn.com/docs/registry/getting-started`
- `https://ui.shadcn.com/docs/registry/registry-json`
- `https://ui.shadcn.com/docs/registry/registry-item-json`
- `https://ui.shadcn.com/docs/registry/api-reference`
- `https://ui.shadcn.com/docs/changelog/2026-05-registry-include`（`include` 字段与 registry 校验）
- 模板仓库：`https://github.com/shadcn-ui/registry-template`

### 1.5 研究产出物

`docs/research/` 下必须有：

- `apple-liquid-glass.md` —— 材质原理、regular/clear 差异、明暗自适应机制、动效规则、无障碍降级要求，**每条结论标注来源 URL**。
- `apple-metrics.md` —— 组件尺寸/圆角/间距/字号表。**每个数值必须标注可信度**：`[官方]`（HIG 或 Apple Design Resources 明确写出）/ `[实测]`（你从真机截图或 Figma 资源量出，注明方法）/ `[推定]`（无来源，你的估计）。**严禁把推定值伪装成官方值。**
- `optics-web.md` —— Web 折射方案对比、三级降级策略、各浏览器实测结论。
- `screenshots/` —— 你用于比对的 iOS 参考截图，按组件命名。

---

## 2. 核心设计判断（本项目最重要的一条，凌驾于其他所有规则）

**Liquid Glass 不是均匀铺开的材质，而是一套分层系统。绝大多数"Liquid Glass 组件库"失败，都是因为把整个组件做成了同一种玻璃。**

观察 iOS 的 tab bar、segmented control、slider，你会看到**两个截然不同的材质层**：

### Layer B —— 底座 / 容器（Base，磨砂）

tab bar 的整条胶囊、segmented control 的整个凹槽、slider 的整条轨道。

- 视觉特征：**接近磨砂玻璃（frosted），不是液态玻璃。** 它的首要职责是**可读性**，不是炫技。
- 几乎**没有**可见的折射畸变、没有色散彩边、没有强镜面高光。
- 实现：`backdrop-filter: blur() saturate()` + 一层半透明 tint 底色 + 一根 hairline 描边（内描边亮、外描边暗）+ 一层克制的落影。
- **禁止对底座使用 SVG `feDisplacementMap`。** 底座扭曲会直接毁掉其上文字的可读性。

### Layer I —— 指示器 / 把手（Indicator，强液态玻璃）

tab bar 的选中态胶囊、segmented control 的选中块、slider 的 knob、switch 的 knob。

- 视觉特征：**这里才是真正的 Liquid Glass，而且要做得比你以为的更强烈。**
- 必须同时具备：
  1. **透镜畸变（lensing）** —— 背后的内容在指示器边缘被明显推挤/放大，中心区域近乎不失真。
  2. **色散（chromatic aberration）** —— 边缘出现可见的彩虹色边（截图中肉眼可辨的红/青/紫描边）。这是最强的"真玻璃"信号，**不做色散就不像 Apple**。
  3. **镜面高光（specular highlight）** —— 沿上缘/受光侧的一道细亮弧，用多层 `inset box-shadow` + 遮罩渐变实现。
  4. **边缘提亮 + 中心通透** —— 中心几乎不额外模糊。
- 关键实现要点：**指示器区域看到的背景应当比底座区域更"清晰"，而不是更模糊。** 它是"玻璃透镜浮在磨砂板上"，不是"两层磨砂叠加"。
  - 浏览器的 `backdrop-filter` 作用于元素背后**已绘制的全部内容**（包含父级 backdrop-filter 的结果）。若指示器直接嵌在底座内并再加一次 blur，模糊会叠加，视觉立刻塌掉。
  - 因此：指示器**不再叠加 blur**（或 ≤2px），只叠加 displacement 折射 + 高光 + 提亮/加深。若必须拿到"未被底座模糊过"的原始背景，采用「底座背景由伪元素承载 + 指示器提升到独立层叠上下文」的结构，并在 `docs/research/optics-web.md` 中记录你的实测结论。

### 交互态才点亮

静止时指示器保持中等强度；**按下/拖动时**折射强度、色散偏移、高光亮度、缩放同时上扬（对应 Apple 的 *"the knob transforms into Liquid Glass during interaction"*）。松手回落用 spring 而非 ease。

### 分层速查表

| 组件 | Layer B（磨砂底座） | Layer I（强玻璃） |
|---|---|---|
| Tabs / Segmented | 整条凹槽 | 选中指示器 |
| Slider | 轨道 + 已填充段 | knob（拖动时强度拉满） |
| Switch | 轨道 | knob |
| Tab Bar / Toolbar / Dock | 整条栏 | 选中项胶囊、按下的按钮 |
| Select / Dropdown / Popover | 弹层面板 | 高亮项（hover/focus） |
| Sheet / Drawer | 面板 | grabber 抓手 |
| Dialog | 面板 | —— |
| Button | 静止：底座；按下：升级为 Layer I | 按下态 |
| Card / Table / List / Accordion | **两者都不用**（内容层，用不透明或极弱材质） | —— |

---

## 3. 技术栈（固定，不要替换）

| 领域 | 选型 |
|---|---|
| 框架 | React 19 + TypeScript（strict） |
| 无障碍原语 | Radix UI（与 shadcn 保持一致） |
| 样式 | Tailwind CSS v4（CSS-first `@theme` 配置，不用 `tailwind.config.js`） |
| 动画 | Motion（`motion/react`，即原 Framer Motion） |
| 变体 | `class-variance-authority` + `tailwind-merge` + `clsx` |
| 文档站 | Next.js（App Router）+ Fumadocs 或自建 MDX 管线 |
| 分发 | shadcn registry（`registry.json` + `public/r/*.json`） |
| 包管理 | pnpm workspace |
| 测试 | Vitest + Testing Library + Playwright（含视觉回归） |

**注意**：`framer-motion` 已更名为 `motion`，导入路径是 `motion/react`。不要用旧包名。

---

## 4. 仓库结构

```
liquid-glass-ui/
├── apps/
│   └── www/                      # Next.js 文档站 + registry 托管
│       ├── app/                  # App Router
│       ├── content/docs/         # MDX 文档
│       ├── registry/
│       │   ├── glass/            # 组件源码（registry 的 source of truth）
│       │   │   ├── ui/           # button.tsx, slider.tsx, ...
│       │   │   ├── lib/          # utils, hooks
│       │   │   └── blocks/       # 组合示例
│       │   └── index.ts
│       ├── public/r/             # shadcn build 产物（*.json）
│       └── registry.json
├── packages/
│   └── glass-core/               # @createagle/glass-core —— 光学引擎（发 npm）
│       └── src/
│           ├── filter/           # SVG 位移贴图生成 + 滤镜工厂
│           ├── tiers/            # 三级能力检测与降级
│           ├── provider/         # GlassProvider（材质档位 / 主题 / 无障碍）
│           └── tokens/           # CSS 变量定义
├── docs/research/                # Phase 0 研究笔记
└── PROJECT_SPEC.md
```

**分发拆两层**（明确决策，不要合并）：
- **光学引擎 = npm 包 `@createagle/glass-core`** —— 滤镜生成、能力检测、Provider、token CSS。用户 `pnpm add @createagle/glass-core` 安装，不进 registry。
- **组件皮肤 = shadcn registry** —— 每个组件的 tsx 源码通过 `shadcn add` 落到用户项目里，可自由修改。组件的 `dependencies` 里声明 `@createagle/glass-core`。

> **📌 修订（2026-09-05）：包名 `@glass/core` → `@createagle/glass-core`。**
>
> npm 上的 `@glass` scope 拿不到 —— scoped 包要求拥有同名的组织或用户，
> 而可用的 scope 是 `@createagle`。这是**外部约束，不是设计变更**：
> 「分发拆两层」这个决策本身一个字没改。
> 已发布 `@createagle/glass-core@0.1.0`（MIT），CI 的安装冒烟测试走真实 npm 路径。
>
> ⚠️ 注意别把两个 `@` 前缀混为一谈：shadcn registry 的**命名空间**仍是 `@glass`
> （用户 `components.json` 里的一个 key → URL 模板），与 npm scope 无关。
> 经过见 STATUS §0.84 / §0.85。

---

## 5. 光学引擎规格（`@createagle/glass-core`）

### 5.1 三级能力降级

运行时检测一次，把结果写到 `<html data-glass-tier="a|b|c">`，所有 CSS 用属性选择器分支。**不要用 UA 字符串做主判据**，UA 只作兜底。

| Tier | 判据 | 效果 |
|---|---|---|
| **A** | `CSS.supports('backdrop-filter', 'url(#x)')` 为 true（Chromium 系） | 完整方案：SVG `feDisplacementMap` 折射 + R/G/B 三通道色散 + 高光 + 融合形变 |
| **B** | 支持 `backdrop-filter: blur()` 但不支持 `url()` 引用（Safari 系） | 无真折射：用 `blur + saturate + brightness` + 多层 `inset box-shadow` 模拟边缘透镜 + `conic/linear-gradient` 边框模拟色散彩边 + 伪元素高光 |
| **C** | 不支持 `backdrop-filter`（含 Firefox 默认配置） | 半透明纯色 + 描边 + 渐变高光，保证结构与可读性完全正确，只是没有玻璃感 |

**Tier B 和 C 不是"坏掉的版本"**，它们必须各自看起来是完成度很高的设计。文档站要能手动强制切 tier 以便审查。

### 5.2 滤镜工厂

- 位移贴图**按尺寸生成并缓存**（key = `w×h×radius×borderWidth`），用 `ResizeObserver` 监听变化。相同尺寸的多个实例共享同一个 `<filter>` 定义。
- 全局只维护**一个** `<svg>` defs 容器（`position:fixed; width:0; height:0; pointer-events:none`），所有滤镜挂在里面，避免每个组件塞一个 SVG。
- 暴露 `useGlassFilter({ width, height, radius, intensity })` hook，返回 `filterId` 与就绪状态。
- **性能红线**：单屏同时激活的 Tier-A 折射实例 **≤ 8 个**；超出时自动降到 Tier B 渲染路径，并在 dev 模式 `console.warn`。滚动/拖动过程中用 `will-change` 与节流，禁止每帧重建滤镜。

### 5.3 融合与形变（对应 GlassEffectContainer）

实现 `<GlassContainer spacing={n}>` + 子元素 `glassId`：
- 子元素间距 ≤ `spacing` 时，两个玻璃形状的轮廓**融合**（用 SVG `feGaussianBlur` + `feColorMatrix` 的 gooey filter 技术实现"液态粘连"）。
- 增删子元素时用 Motion 的 `layoutId` 做 matched-geometry 形变；距离超过 `spacing` 时退化为 `materialize`（缩放+透明度）过渡。

### 5.4 动效映射（SwiftUI spring → Motion）

SwiftUI 的三个预设可以直接映射到 Motion 的 `duration + bounce` spring：

| SwiftUI | Motion 参数 | 用途 |
|---|---|---|
| `.smooth` | `{ type: 'spring', duration: 0.5, bounce: 0 }` | 材质淡入淡出、透明度 |
| `.snappy` | `{ type: 'spring', duration: 0.5, bounce: 0.15 }` | **默认**：指示器移动、选中态切换 |
| `.bouncy` | `{ type: 'spring', duration: 0.5, bounce: 0.3 }` | 弹出、抓手回弹 |

把这三个导出为 `springs.smooth / snappy / bouncy`，**全库禁止硬编码 `stiffness`/`damping` 数字**，也禁止用 `ease-in-out` 之类的贝塞尔曲线做主要状态过渡。

---

## 6. Token 体系（三层，严格分层）

Tailwind v4 的 `@theme` + CSS 变量。**组件里禁止出现魔法数字和裸色值。**

```
Layer 1 —— Primitive（原始值，与语义无关）
  --lg-blur-{1..5}            模糊阶梯
  --lg-sat-{1..3}             饱和度阶梯
  --lg-refract-{1..3}         折射强度阶梯
  --lg-disperse-{1..3}        色散偏移阶梯
  --lg-ios-blue / -green / -red / ...        iOS 系统色
  --lg-gray-{1..6}            iOS systemGray 家族
  --lg-radius-{sm,md,lg,xl,continuous}

Layer 2 —— Semantic（材质与角色）
  --lg-material-base          Layer B 磨砂底座
  --lg-material-indicator     Layer I 强玻璃指示器
  --lg-material-elevated      弹层 / sheet
  --lg-label-{primary,secondary,tertiary,quaternary}
  --lg-separator / --lg-separator-opaque
  --lg-fill-{primary..quaternary}

Layer 3 —— shadcn 兼容层（映射到 shadcn 既有 token 名，保证 CLI 生态兼容）
  --background --foreground --card --card-foreground
  --popover --popover-foreground --primary --primary-foreground
  --secondary --muted --accent --destructive --border --input --ring --radius
```

**Layer 3 必须完整覆盖 shadcn 的全部 token 名**，否则第三方 shadcn 组件装进来会样式崩坏。第三层是对第二层的**别名映射**，不是独立定义。

### iOS 系统色（已核实，直接用）

| Token | Light | Dark |
|---|---|---|
| blue | `#007AFF` | `#0A84FF` |
| green | `#34C759` | `#30D158` |
| red | `#FF3B30` | `#FF453A` |
| orange | `#FF9500` | `#FF9F0A` |
| yellow | `#FFCC00` | `#FFD60A` |
| pink | `#FF2D55` | `#FF375F` |
| purple | `#AF52DE` | `#BF5AF2` |
| indigo | `#5856D6` | `#5E5CE6` |
| teal | `#30B0C7` | `#40C8E0` |
| gray | `#8E8E93` | `#8E8E93` |
| gray2 | `#AEAEB2` | `#636366` |
| gray3 | `#C7C7CC` | `#48484A` |
| gray4 | `#D1D1D6` | `#3A3A3C` |
| gray5 | `#E5E5EA` | `#2C2C2E` |
| gray6 | `#F2F2F7` | `#1C1C1E` |

标签色（含透明度，注意是 alpha 而非实色）：

| Token | Light | Dark |
|---|---|---|
| label | `#000000` 100% | `#FFFFFF` 100% |
| secondaryLabel | `#3C3C43` 60% | `#EBEBF5` 60% |
| tertiaryLabel | `#3C3C43` 30% | `#EBEBF5` 30% |
| quaternaryLabel | `#3C3C43` 18% | `#EBEBF5` 16% |
| separator | `#3C3C43` 29% | `#545458` 65% |
| opaqueSeparator | `#C6C6C8` | `#38383A` |

**这些标签色必须用带 alpha 的形式**，因为它们要透出下面的玻璃材质 —— 换成实色会立刻失去 iOS 的观感。

### 圆角：连续曲率（squircle）

Apple 用的是连续曲率圆角，CSS 的 `border-radius` 是普通圆弧，两者在大圆角时肉眼可辨。方案：
- 默认用 `border-radius` 近似（小圆角场景差异不可见）。
- 对大圆角容器（Sheet、Dialog、Card、Tab Bar）提供 `--lg-radius-continuous`，用 SVG path 或 `paint()` worklet 生成 squircle 遮罩；不支持时回退 `border-radius`。
- **同心圆角**：子元素圆角 = 父元素圆角 − 父子间距。写成工具函数 `concentricRadius(parentRadius, inset)`，不要手填数字。

---

## 7. 明暗模式（硬性要求）

**每个组件都必须在 light / dark 下分别调过，不允许"暗色 = 亮色降透明度"这种偷懒做法。**

玻璃在明暗下的物理表现本来就不同：

| 维度 | Light | Dark |
|---|---|---|
| 底座 tint | 白色系，alpha 较高（~0.6–0.75） | 黑/深灰系，alpha 略低（~0.4–0.6） |
| 描边 | 上缘白色高光更强、下缘深色阴影弱 | 上缘白色高光弱且更冷、整体描边偏亮 |
| 镜面高光 | 白色，低不透明度（易过曝） | 白色，高不透明度（是主要的"玻璃"信号） |
| 折射强度 | 略低（浅背景下畸变太显脏） | 略高（深背景下畸变更好看且不伤可读性） |
| 色散 | 偏冷（青/蓝边更明显） | 偏暖 + 更饱和（红/紫边更明显） |
| 阴影 | 有明显落影，色相偏冷 | 落影极弱甚至无，改用**外发光**分离层级 |

实现：`class` 策略（`.dark`）+ 同时响应 `prefers-color-scheme`。所有材质 token 在 `:root` 和 `.dark` 下**各自独立定义完整一套**，不用 `filter: invert` 之类的取巧手段。

---

## 8. 材质档位（对应 iOS 的「透明 ↔ 色调」滑杆）

iOS 设置里有一条滑杆，说明文字是：*"'透明' 更通透，'色调' 可增加不透明度，提升内容和控制项的对比度"*。这个能力必须实现。

- API：`<GlassProvider tint={0..1}>`，同时在 `<html>` 上写 `data-glass-tint`。
- 内部映射 **4 个语义档位**（`clear` / `default` / `tinted` / `solid`），但**支持连续取值**：CSS 变量在档位之间线性插值，滑动时材质连续变化而非跳变。
- 档位影响的量（只影响 **Layer B 底座**，不影响 Layer I 指示器的折射强度 —— 这点很关键，指示器始终保持玻璃感）：

| 档位 | 底座 alpha | 底座 blur | saturate | 描边对比 |
|---|---|---|---|---|
| 0 `clear` | 最低 | 最低 | 最高 | 最弱 |
| 1 `default` | 基准 | 基准 | 基准 | 基准 |
| 2 `tinted` | 提高 | 提高 | 降低 | 增强 |
| 3 `solid` | 接近不透明 | 高 | 最低 | 最强 |

- 持久化到 `localStorage`，SSR 时用内联脚本在首屏前写好属性，避免闪烁（和 dark mode 同一套机制）。
- **文档站必须把这条滑杆做成全局控件放在顶栏**，让访客实时改变整站材质 —— 这是最好的能力展示。
- 加分项：把这条滑杆本身做成组件库的招牌 demo。参考 iOS 的做法 —— 滑杆在最左端时**滑块自身**是通透的玻璃（能看到折射彩边），滑到右端时滑块变成不透明纯白。**控件自己演示自己**。

---

## 9. 移动端：下拉类交互一律改为底部 Drawer（硬性要求）

Select、DropdownMenu、Combobox、ContextMenu、Menubar、NavigationMenu、DatePicker、Popover 等所有"从触发点弹出浮层"的组件，在移动端**必须**改为从底部滑出的 Drawer（对应 iOS 的 action sheet / 底部选择器）。

### 实现：`<ResponsiveOverlay>` 原语

- 统一 API：桌面端渲染 Radix 的 Popover/Select/DropdownMenu，移动端渲染 Drawer。**外部调用方式完全一致**，切换对使用者透明。
- 判定：`matchMedia('(max-width: 768px)') || matchMedia('(pointer: coarse)')`。用 `useSyncExternalStore` 订阅，**避免 SSR hydration mismatch**（不要用 `useEffect` + `useState` 的经典错误写法，首帧会闪）。
- Drawer 行为必须齐全：拖拽把手（grabber）、snap points / detents（对应 iOS 的 `.medium` / `.large`）、下拉关闭、速度感应的甩动关闭、背景遮罩渐变、背后页面轻微缩放并后退（iOS 的层叠效果）、滚动锁定、safe-area inset 适配（`env(safe-area-inset-bottom)`）。
- **无障碍不能因为换了渲染方式而退化**：焦点陷阱、`aria-modal`、Escape 关闭、返回时焦点还原、屏幕阅读器读出的角色与状态，桌面和移动两条路径必须都过测试。
- 提供 `responsive={false}` 逃生口，允许消费方强制桌面行为。

---

## 10. 组件清单与优先级

**目标是覆盖 shadcn/ui 的全部组件**，但按下面的优先级推进，P0 必须做到像素级对齐才能进入 P1。

### P0 —— Apple 有直接对应物，是本库的立身之本（11 个）

`Button`、`Switch`（UISwitch）、`Slider`（UISlider）、`Tabs`/`Segmented`（UISegmentedControl）、`Sheet`/`Drawer`（UISheetPresentationController）、`Dialog`/`AlertDialog`（UIAlertController）、`Select`、`DropdownMenu`（UIMenu）、`Popover`、`Toggle`/`ToggleGroup`、`Card`（grouped list section）

> P0 每个组件都必须有 **iOS 真机截图 vs 组件截图的并排比对图**，放进文档站的 "Fidelity" 标签页。

### P1 —— 高频且能明显体现材质（14 个）

`Input`、`InputGroup`、`Textarea`、`Checkbox`、`RadioGroup`、`Label`、`Field`、`Tooltip`、`Toast`、`Badge`、`Avatar`、`Separator`、`Skeleton`、`Progress`

### P2 —— 结构与数据类，材质用得克制（16 个）

`Accordion`、`Collapsible`、`ScrollArea`、`Table`、`DataTable`、`Pagination`、`Breadcrumb`、`NavigationMenu`、`Menubar`、`ContextMenu`、`Command`、`Combobox`、`Calendar`、`DatePicker`、`Sidebar`、`Resizable`

### P3 —— 补齐与扩展

`Alert`、`AlertDialog`、`AspectRatio`、`ButtonGroup`、`Carousel`、`Chart`、`Empty`、`HoverCard`、`InputOTP`、`Item`、`Kbd`、`NativeSelect`、`Spinner`、`Typography`、`Direction`、`Marker`，以及 shadcn 新增的 AI 对话原语 `Attachment` / `Bubble` / `Message` / `MessageScroller` / `Questionnaire`。

> 我在写这份提示词时实测 `https://ui.shadcn.com/docs/components` 的清单是 **64 个组件**。shadcn 组件集在持续增加，**以你在 Phase 0 抓到的当时清单为准，不要照抄本文档**。抓到后逐个归入 P0–P3，并对每个组件标注对应的 Apple 控件（没有对应物的写「无 Apple 对应，按内容层处理」）。

### Apple 对照要求

**每个组件在实现前，先写一段 `// APPLE REFERENCE:` 注释**，说明：对应哪个 Apple 控件、参考了哪张截图/哪份文档、哪些尺寸是 `[官方]`/`[实测]`/`[推定]`、哪几处刻意偏离了 Apple（以及为什么）。

已核实可直接使用的 Apple 度量：
- 最小触控目标 **44×44pt**
- UISwitch **51×31pt**，knob 直径 **27pt**
- Dynamic Type 基准（SF Pro）：`largeTitle 34` / `title1 28` / `title2 22` / `title3 20` / `headline 17 semibold` / `body 17` / `callout 16` / `subheadline 15` / `footnote 13` / `caption1 12` / `caption2 11`

**其余尺寸（各类圆角、内边距、指示器 inset 等）由你在 Phase 0 中测量确定，并在 `apple-metrics.md` 标注可信度。宁可标 `[推定]` 也不要编造成 `[官方]`。**

---

## 11. shadcn Registry 分发

### 11.1 结构

- 根 `registry.json`：`$schema: https://ui.shadcn.com/schema/registry.json`，字段 `name` / `homepage` / `items`，组件多时用 `include` 拆分成多个子文件。
- 每个 item：`name` / `type` / `title` / `description` / `files[]` / `dependencies` / `registryDependencies` / `cssVars` / `css`。
- item 类型分配：
  - `registry:ui` —— 组件本体
  - `registry:lib` —— `cn()` 等工具
  - `registry:hook` —— `useIsMobile`、`useGlassFilter` 等
  - `registry:theme` —— **完整的 token 层**（三层变量 + light/dark + 材质档位），必须能单独 `add`
  - `registry:block` —— 组合示例（tab bar、settings 面板、播放器等）
- **`cssVars` / `css` 字段是本项目的关键**：组件装进用户项目时，必须自动注入它依赖的玻璃 token 与 keyframes，不能要求用户手动复制 CSS。
- 所有组件 `dependencies` 中声明 `@createagle/glass-core`，`registryDependencies` 指向本库内部的 `theme` / `lib` / `hook` item。

### 11.2 构建与安装

- 构建：`pnpm dlx shadcn@latest build`（新版命令可能有变，以 `shadcn --help` 实测为准），产物落在 `apps/www/public/r/*.json`。
- 直链安装：`pnpm dlx shadcn@latest add https://<域名>/r/button.json`
- 命名空间安装（**主推**，文档首页要展示这种）：用户在 `components.json` 加
  ```json
  { "registries": { "@glass": "https://<域名>/r/{name}.json" } }
  ```
  然后 `pnpm dlx shadcn@latest add @glass/button`
- CI 必须包含：`registry.json` schema 校验 + 对每个 item 做**真实安装冒烟测试**（在临时的干净 Next.js 工程里 `add` 并构建通过）。**没有跑通这个测试就不算完成。**

---

## 12. 文档站（Next.js，结构参考 shadcn 官网）

站点结构对齐 `ui.shadcn.com`：

- **首页** —— Hero 用一个真实可交互的 iOS 风格界面（tab bar + segmented + slider 全部是活的），下面是安装命令。
- **Docs** —— Introduction / Installation / Theming / Dark Mode / Materials（讲 Layer B vs Layer I）/ Optics（讲三级降级）/ CLI / Registry
- **Components** —— 每个组件一页，左侧导航 + 右侧目录（TOC），页内结构：
  - 顶部 **Preview / Code 切换**（shadcn 的 `ComponentPreview` 模式）
  - 安装命令（CLI / Manual 两个 tab）
  - Usage 代码
  - **Examples** —— 多个变体独立可交互
  - **Fidelity**（本库独有）—— iOS 真机截图与组件的并排对照 + 差异说明
  - **API Reference** —— props 表格（从 TS 类型自动生成，不要手写）
- **Themes / Playground** —— 实时调材质档位、明暗、tier、色相，并导出 CSS 变量片段。
- **全局顶栏必须常驻**：明暗切换 + 材质档位滑杆 + Tier 强制切换（开发者可见）。
- 站点自身必须**吃自己的狗粮**：文档站的导航、侧边栏、搜索面板、代码块工具栏全部用本库组件搭建。

其他要求：`⌘K` 命令面板搜索、代码块一键复制、暗色模式无闪烁（内联脚本）、每个 demo 支持独立全屏预览路由（`/view/[name]`，便于截图和 iframe 嵌入）。

---

## 13. 无障碍与降级（不可协商）

- `prefers-reduced-transparency` → 全部材质切到 `solid` 档位，移除 backdrop-filter 与折射。
- `prefers-reduced-motion` → 移除形变/融合动画，保留 ≤120ms 的透明度过渡；`GlassContainer` 的 gooey 融合关闭。
- `prefers-contrast: more` → 提高描边对比、把标签色升到实色、加强分隔线。
- **对比度**：所有文本在**材质档位 0（最通透）+ 最不利背景**下仍需满足 WCAG AA（正文 4.5:1，大字 3:1）。这是最容易翻车的地方 —— 写一个自动化检查脚本，在 CI 里对每个组件的截图做采样检测，不通过就 fail。
- 实现"滚动边缘效果"：内容滚到固定栏下方时，栏底自动增加不透明度/加一层渐变遮罩，保证栏内文字始终可读。
- 键盘可达性、焦点可见环（用 `--ring`，在玻璃上必须清晰可见）、Radix 的 a11y 语义不得被样式覆盖破坏。

---

## 14. 验收标准（Definition of Done）

一个组件只有全部满足才算完成：

- [ ] light / dark 两套样式各自独立调过，不是简单反色
- [ ] 材质档位 0/1/2/3 下都正常且可读
- [ ] Tier A / B / C 三条渲染路径都完成，且 B、C 各自看起来是完整设计
- [ ] Layer B 与 Layer I 分层正确（底座磨砂、指示器强玻璃且有可见色散）
- [ ] 交互态（hover / active / focus / disabled）齐全，用 spring 预设而非硬编码曲线
- [ ] 移动端：若是下拉类组件，已切换为底部 Drawer 且 a11y 未退化
- [ ] `reduced-transparency` / `reduced-motion` / `contrast: more` 三种偏好下均正确降级
- [ ] WCAG AA 对比度自动检查通过
- [ ] registry item 已定义，且在干净工程里 `shadcn add` 冒烟测试通过
- [ ] 文档页含 Preview/Code、Examples、Fidelity 对照、自动生成的 API 表
- [ ] 有 `// APPLE REFERENCE:` 注释，数值可信度已标注
- [ ] Playwright 视觉回归快照已录入

---

## 15. 明令禁止

1. ❌ 把整个组件做成同一种玻璃 —— 必须区分 Layer B / Layer I。
2. ❌ 对底座使用 `feDisplacementMap`。
3. ❌ 指示器不做色散就交付 —— 那是毛玻璃，不是液态玻璃。
4. ❌ 组件里出现魔法数字或裸色值 —— 一律走 token。
5. ❌ 用 `filter: invert()` 之类的手段生成暗色主题。
6. ❌ 用 `ease-in-out` 之类的贝塞尔曲线做状态过渡 —— 用 spring 预设。
7. ❌ 把推定的尺寸标注成 `[官方]`。
8. ❌ 跳过 Phase 0 研究直接写代码。
9. ❌ 在内容型组件（Table、List、Card 正文区）上堆玻璃 —— 违反 Apple 的"材质属于控件层"原则。
10. ❌ 移动端下拉类组件仍然用浮层弹出。
11. ❌ 声明"完成"但没跑过 registry 安装冒烟测试。
12. ❌ 一次性提交几十个组件的巨型 PR —— 按 Phase 走，每个 Phase 可独立验收。

