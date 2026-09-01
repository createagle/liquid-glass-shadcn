# 项目状态

**当前阶段：Phase 3 进行中 —— Tabs 是第一个 P0 组件，§14 checklist 12 项过 8**
Phase 0（研究，部分）· Phase 1（光学引擎）· Phase 2（Token 体系）均已完成
未开始：Phase 4 · Phase 6 · Phase 7
最后更新：2026-08-31

---

## 0. 可读性地板 —— 元素级明暗自适应的实测与落地（2026-08-31）

### 0.1 起因

上一轮补做的对比度审计查出 **14 个测点里 11 个未达 WCAG AA**，最差 1.00:1
（文字与背景完全同色，肉眼不可见）。当时归因为「元素级明暗自适应未实现」。

### 0.2 做法：先用数据选方案，不凭直觉

新建 `packages/glass-core/debug/adaptive-fixture.html`（六个候选并排）与
`scripts/adaptive-probe.mjs`（差分测量），在档位 0 × 6 种最不利背景 ×
明暗两主题下逐一实测。

### 0.3 结果推翻了我自己 Phase 0 的判断

| 候选 | 全场最差 | 结论 |
|---|---|---|
| C3 `mix-blend-mode: difference` | **1.04:1** | ❌ 原理性失败 |
| C0 基线（当时的实现） | 1.16:1 | ❌ |
| C4 元素级翻转**文字色** | 1.32:1 | ❌ 高方差背景上反而更差 |
| C1 alpha 地板 | 1.47:1 | 方向对，值不够 |
| C2 亮度钳制 | 1.47:1 | 暗色 primary 拿到全场唯一通过 4.52 ✓ |

**两条被证伪的直觉（别再试）：**

1. `difference` 混合做自动反色 —— 它保证 **RGB 差**，不保证**亮度差**。
   中灰上白字反色成 `#7F7F7F`，亮度几乎不变，字消失。
   ⚠️ 这条正是我在 `optics-web.md` §6 写的「最值得先试的一条」，**判断是错的**，已在该文件更正。
2. 元素级翻转**文字颜色** —— 一个元素底下可以同时有纯黑和纯白（棋盘格、照片），
   单一极性必然顾此失彼。实测在 checker 背景上比不自适应还差。

**成立的结论：** 玻璃把背景合成为 `C = a·F + (1-a)·B`，`C` 的**值域宽度恒为 `(1-a)`**，
与背景无关。所以能否保证对比度**只由不透明度决定**。
自适应要自适应的对象是**不透明度**，不是文字颜色 —— 这也正是 Apple 文档的说法
（"more opaque in larger elements ... to preserve legibility over complex backgrounds"）。

### 0.4 落地

新增 `packages/glass-core/src/a11y/legibility.ts`：把地板值**解出来**而不是拍脑袋，
`GlassProvider` 新增 `legibility` prop（`guaranteed` 默认 / `adaptive` / `off`）。
`contrast-audit.mjs` 直接 `import` 这个 TS 源（Node 24 原生剥离类型），
保证 CI 校验的地板与运行时用的是**同一份代码**，不会漂移。

### 0.5 顺带修掉的一个测量器 bug

旧审计按**整个矩形包围盒**取样，而玻璃面是圆角 —— 靠近圆角的文字，其包围盒的角
会落在圆角外，采到页面背景。它把 `base-inline/secondary` 误报成 1:1。
现改为「差分找出字形像素 → 只在这些像素上按 WCAG 口径合成指定文字色」，
两个问题一起解决。共享实现在 `scripts/lib/contrast.mjs`。

⚠️ **因此基线数字换过一次量具**，新旧数值不可直接比较，已重设基线。

### 0.6 结果

| | 修前 | 修后 |
|---|---|---|
| 未达 AA 的测点 | **11 / 14** | **0 / 14** |
| `base/primary` | 1.62 | **5.48** |
| `base/secondary` | 1.21 | **4.57** |
| `base-inline/secondary` | 1.00 | **4.57** |
| `indicator/primary` | 2.52 | **10.32** |
| `elevated/secondary` | 1.43 | **6.17** |

### 0.7 代价与偏离（必须讲清楚）

1. **「最通透」档不再通透** —— 档位 0 的底座 alpha 从 0.34/0.22 抬到 **0.664/0.640**。
   这是 §13（「不可协商」）与 §8（档位 0 = 最通透）的取舍，§13 优先。
   需要真·通透时用 `legibility="off"`，由使用者自担可读性。
2. **偏离 Apple 的 secondaryLabel** —— Apple 原值 `#3C3C43 @ 60%` 压在纯白上是
   **3.44:1**，本身就不过 AA，且任何材质不透明度都救不回来。本库把 secondary 的
   alpha 抬到 **0.99**。这是一处明确的、有记录的偏离。

### 0.8 后续补完（同日）

#### 元素级探针落地

新增 `a11y/backdrop-probe.ts` + `a11y/use-adaptive-alpha.ts`，
`GlassSurface` 在 `legibility="adaptive"` 下真的去探测背后的实际背景。

做法是**从 DOM 推**（`elementsFromPoint` 拿元素栈 → 逐层合成背景色），
不是读像素 —— Web 上读不到 `backdrop-filter` 合成后的结果。
因此只对纯色背景可靠；碰到渐变/图片/视频/`opacity`/`filter` 一律判「测不出」
并**回落到 `guaranteed`**。这是故意的保守：宁可牺牲通透度，不可牺牲可读性。

`scripts/backdrop-probe-test.mjs` 是回归闸门，实测结果：

| 场景 | alpha | 说明 |
|---|---|---|
| 纯黑背景 + 暗色主题 | **0.220** | 保持原始档位，完全通透 |
| 深灰 `#1c1c1e` + 暗色主题 | **0.220** | 同上 |
| 中灰 `#808080` + 暗色主题 | **0.220** | 反直觉但正确：暗底座把 128 压到 104，白字 5.55:1 |
| 纯白背景 + 暗色主题 | 0.640 | 该抬时抬到地板 |
| 纯白背景 + 亮色主题 | **0.340** | 保持通透 |
| 纯黑背景 + 亮色主题 | 0.664 | 抬到地板 |
| 渐变（测不出） | — | 回落 `guaranteed` |

**收益：暗色 UI 压在暗色内容上这个最常见的场景，通透度完全拿回来了。**

#### 着色标签

剩余 2 个测点（`tint-blue` / `tint-red`）修复。查根因时发现问题**根本不在玻璃**：

> **iOS 系统色当正文，压在纯白上全部不过 AA。**
> 蓝 4.02、红 3.55、绿 2.22、橙 2.20、黄 1.51 —— 换任何浅色底都一样。

这与 secondaryLabel 是同一类问题：忠实复刻 Apple 与 §13 不相容。
按 Apple 自己的指引（「把颜色加在**背景**上，不要加在文字/符号上」）处理：

- `--lg-blue` 等**保持真实系统色**，用于填充 / 背景
- 新增 `--lg-on-glass-*` 一套，**仅用于压在玻璃上的文字**，由
  `deriveOnGlassLabel()` 解出，`scripts/derived-colors.mjs` 在 CI 里钉住不漂移

⚠️ **代价很直观：派生色褪得厉害**（暗色蓝 `#0a84ff` → `#dfefff`）。
但这不是玻璃造成的 —— 那就是「AA 合规的 iOS 蓝文字」在任何浅色面上的样子。

### 0.9 未达成

- 🟡 **探针只对纯色背景有效。** 渐变、图片、视频、canvas 一律回落 `guaranteed`。
  这是 Web 平台限制（读不到合成后的像素），不是实现偷懒，但意味着
  **在图片背景上 `adaptive` 等于 `guaranteed`** —— 而那恰恰是最想省透明度的场景。
- 🟡 探针不监听任意 DOM 变动（MutationObserver 太贵），
  只在挂载 / 滚动 / 尺寸变化时重算。背景内容原地变色不会触发重算。
- 🟡 `--lg-on-glass-*` 是按 `guaranteed` 的最不利底座解的。
  `legibility="off"` 下底座可能更透，那时这套色**不保证达标**。
- 🟡 内容层材质只修了 `ultrathin`（其余三档本来就在地板之上）。
- 🟡 Safari / Firefox 仍未测。

---

## 0.2 Phase 3 · Tabs / Segmented —— §14 逐条自查

第一个 P0 组件。当时 **12 项过 8**；其中 hover/active 与 `contrast: more` 两项
已在下一批（Slider + Switch）随手补齐，现为 **12 项过 10**。
下面的表格已就地更新，未过的两项保留原样。

### 技术前置：底座挖洞（optics-web §3.8 的「未解决 🔴」）

`backdrop-filter` 作用于元素背后**已绘制的全部内容**，包含父级底座模糊后的
结果 —— 嵌在底座里的指示器因此永远看不到清晰背景，与 SPEC §2 的要求相反。

四种写法实测（判据：沿水平线的像素标准差）：

| 写法 | 洞外 σ | 洞内 σ | 结论 |
|---|---|---|---|
| A 不挖洞（对照） | 0.5 | 0.5 | 全模糊 |
| B mask 直接挖在玻璃上 | 0.5 | 127.5 | 清晰，**但底色也被挖掉** ✗ |
| C 模糊放子层 + mask | 0.8 | 89.0 | 清晰且底色保留 ✓ |
| **D 子层 + clip-path** | 0.8 | 89.0 | 同 C，**且支持圆角洞** ✓✓ |

选 D（指示器是胶囊，直角洞不够用）。实现在 `surface/punch.ts` +
`GlassSurface` 的 `punch` prop。

### 顺带修掉两个光学缺陷（影响所有 Layer I 组件）

1. **折射量原先是绝对像素**，在 85×54 上意味着边缘位移 ±90px，超过元素宽度。
   改为按短边比例。**教训：光学参数只在一个尺寸上标定，等于没标定。**
2. **衰减轮廓原先是矩形**（线性梯度铺满 + 模糊圆角矩形压中心），
   位移场是「剪切」而非径向透镜，色散在单侧堆成蓝边。
   改为中性灰基底 + 径向剖面遮罩，位移向量成为 `A(r)×(x−cx, y−cy)`，天然对称。

详见 `optics-web.md` §3.9，三阶段对照图 `screenshots/refraction-progress.png`。

### §14 逐条

| 验收项 | 结论 |
|---|---|
| light / dark 各自独立调过 | ✅ 走各自的 token 块，18 个变体已渲染 |
| 材质档位 0/1/2/3 正常可读 | ✅ 三档已渲染 + 对比度审计覆盖 |
| Tier A/B/C 三条路径完整 | ✅ B/C 各自是完整设计，不是坏掉的版本 |
| Layer B / Layer I 分层正确 | ✅ 底座不折射；指示器有可见色散（挖洞后成立） |
| 交互态齐全，用 spring 预设 | ✅ **已补齐**（见 §0.3）—— hover 高亮 + 按下时指示器上扬，全走 spring |
| 移动端下拉类改 Drawer | ➖ 不适用（Tabs 不是下拉类） |
| 三种无障碍偏好正确降级 | ✅ **已补齐**（见 §0.3）—— `contrast: more` 现有 5 条测试，且抓出一个真 bug |
| WCAG AA 对比度检查通过 | ✅ CI 全绿（组件测点尚未接入夹具，见下） |
| registry item + 干净工程冒烟 | ✅ `shadcn add @glass/tabs` 在 CI 的干净 Next 工程里通过 |
| 文档页 Preview/Code/Fidelity/API | ❌ **未做** —— 文档站是 Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ 含尺寸表与 [实测] 标注及其两条限制 |
| Playwright 视觉回归快照 | ⚠️ **部分** —— 19 张已录，但**只有 win32 基线**，CI 不跑 |

### 未过的项，原因

- 🟡 **视觉快照只有 win32 基线。** 平台相关，Linux 基线需在 Linux 环境录一次。
- 🔴 **文档页未做** —— 属 Phase 6，不在本阶段范围。

### 另一个遗留

折射改成径向场后变温和了，**Tier A 与 Tier B 在常规尺寸下不易区分**，
而 SPEC §2 要求指示器「必须有可见色散」。强度档位可能要上调，
但**在拿到 iOS 真机截图之前不调** —— 没有基准的调参就是来回瞎试。

---

## 0.3 Phase 3 · Slider + Switch —— §14 逐条自查（2026-09-01）

第二批 P0 组件。**Slider 12 项过 10、Switch 12 项过 10**，未过项在末尾列出。

这一批最有价值的产出不是组件本身，而是**第一次真正做出了 Fidelity 并排对照图** ——
它当场抓出两个我自己看渲染结果时没意识到的缺陷。

### 🔴 与 PROJECT_SPEC 的冲突：Switch 的尺寸（需要你裁决）

PROJECT_SPEC §10 把「UISwitch **51×31pt**，knob 直径 **27pt**」列在
「**已核实**可直接使用的 Apple 度量」里。

Phase 0 在 iOS 27 官方设计资源上实测到的是：

| 项 | SPEC 原值 | iOS 27 实测 |
|---|---|---|
| 轨道 | 51 × 31 pt | **64 × 28 pt** |
| Knob | 直径 27 pt 圆形 | **38 × 24 pt 胶囊** |

两者不可能同时成立：**直径 27pt 的圆塞不进 28pt 高的轨道**。
51×31 是 Liquid Glass 之前的 UIKit 旧版度量。

**处置：组件按实测值实现，并在源码顶部用 ⚠️⚠️ 显式标注这是一处偏离。**
我没有擅自改 PROJECT_SPEC —— 它是唯一规格来源，改它是你的决定。
需要的话我可以提一个只改这一行的补丁。

### Fidelity 对照图（`apps/www/public/fidelity/compare-*.png`）

参考图是 Apple Design Resources 的 **Figma 渲染图，1× 导出，不是真机截图**。
Switch 那张是这次新取的（节点 `12740:33924`）。

⚠️ 顺带发现：**Tabs 那批放进 `public/fidelity/` 的其实只有我们自己的渲染图，
没有 Apple 那一侧** —— 任务卡要的「并排对照」当时并没有真正做到。这次补上了格式。

**对照图抓到的两个真实缺陷：**

1. **knob 是透明的，轨道颜色直接透出来。** Slider 上表现为一条蓝杠横穿 knob 中间，
   Switch 上表现为整个 knob 发绿。Apple 两处都是**白色实体**。
2. 因此新增 token `--lg-knob-fill`（白 86% / 暗色 90% / 高对比 96%）。
   **它与 `--lg-material-indicator`（Tabs 指示器，纯透明）刻意不同** ——
   Tab 指示器是浮在磨砂板上的透镜，slider/switch 的 knob 是一个白色实体。

保留半透明而不是做成纯白，依据是 Apple 原文
*"the knob transforms into Liquid Glass during interaction."* 与 SPEC §2
「静止态弱、交互态强」：静止态白 86% 读起来是白的，按下 / 拖动时这层白降到 45%，
折射与色散显形。**「静止态该白到什么程度」是推定值**，需要真机截图才能定。

### 修掉的两个真 bug

**1. 🔴 高对比下的描边加强是死代码。**

`:root[data-glass-contrast='more'] { --lg-stroke-strength: 1.8 }` 从来没生效过 ——
GlassProvider 会按材质档位把同一个变量以**内联样式**写到 `<html>` 上（档位 0.34 时是
1.006），内联样式优先级高于任何选择器。
一个变量两个所有者，CSS 那个永远输。

改法：拆成两个变量，`--lg-stroke-strength`（档位，JS 拥有）×
`--lg-stroke-boost`（无障碍偏好，CSS 拥有）。
**是新写的 `contrast: more` 测试把它测出来的** —— 只查 `data-glass-contrast` 属性
不会发现，必须一路查到 `box-shadow` 的计算值。

**2. 🟡 `defaultChecked` 的 Switch 首屏会自己滑一段。**

选中态初值原本从 `false` 起步、再由 MutationObserver 纠正，于是挂载后
knob 从关闭位弹到开启位。改为直接从 props 推初值（`checked ?? defaultChecked ?? false`）。
测试量到的是加载 150ms 后 knob 停在 x=18 而不是 24。

### 🔴 冒烟测试抓到的第二个真问题：`asChild` 在别人工程里会被改写坏

第一次推上去时 **Registry 安装冒烟测试红了**，干净 Next 工程的 `next build` 报：

```
src/components/ui/switch.tsx(267,30): error TS2322:
  Property 'render' does not exist on type '… SwitchThumbProps …'
```

原因在 shadcn CLI 里（`dist/chunk-*.js`）：

```js
if (!config.style?.startsWith("base-")) return sourceFile;
// …把 <X asChild><Y/></X> 改写成 <X render={<Y/>} />
```

目标工程的 style 以 `base-` 开头时（**`shadcn init -d` 现在的默认值**），
`asChild` 会被自动改写成 Base UI 的 `render` prop。而本库组件用的是
`@radix-ui/react-*`，改写后直接类型不通过。

**这一类问题本机 100% 发现不了** —— 本地 typecheck 查的是改写*前*的源码。

处置两条：
1. Switch 去掉 `asChild`，把 motion 包到外层、Thumb 放里层，效果一样。
2. 新增 `scripts/registry-lint.mjs`，静态禁掉 registry 组件里的 `asChild`，
   接进「组件行为回归」workflow（秒级失败，不用等冒烟测试跑几分钟）。
   规则文件里写明了这条规则是怎么来的。

⚠️ 这只堵住了**已知的**那一个改写。shadcn 的 add 还有别的 transform
（RSC 指令、import 重写等），**能覆盖它们的只有冒烟测试本身**。

### 一个会坑到使用者的陷阱

`.lg-surface` 自己声明了 `position: relative`。Tailwind 的 `absolute` 能不能盖住它，
**取决于 CSS 的 @layer 顺序**：

- registry 安装时，optics 在 `@layer components` 里 → 工具类赢 ✅
- 直接 `<link>` 引 `theme.css` 时，它是无层的 → 工具类输 ❌

验证台走的是后一条路径，所以第一版 Slider 的轨道量出来是 **250×0**。
组件里改成内联样式定位，两种情况下都对。这条已写进两个组件的注释。

### 挖洞：Switch 挖，Slider 不挖

条纹背景下的实测证据：`screenshots/controls-zoom-light-stripes.png`
（knob 内条纹清晰、洞外糊成一片，且边缘有可见彩边），
以及 Tier A / Tier B 的同位对照
`controls-zoom-switch-off.png` vs `controls-zoom-switch-off-tierb.png`。


| | knob | 轨道 | 重叠 | 处置 |
|---|---|---|---|---|
| Switch | 24 高 | 28 高 | 几乎完全 | **挖** —— 不挖就是「两层磨砂叠加」，§2 明确反对 |
| Slider | 24 高 | 6 高 | 约 25% 面积，且在中心 | **不挖** —— 径向位移场在中心近乎为零，买不到可见收益，却要在拖动的每一帧重算 clip-path |

Switch 的洞用 motion 的 `onUpdate` **逐帧**跟着 knob 走，而不是按 checked 跳到终点 ——
后者会让洞在 knob 还在路上时就已经到位，中途露出一块不该清晰的背景。
洞比 knob 每边多挖 1.5px，避免按下放大时四周露出模糊环。

### §14 逐条

| 验收项 | Slider | Switch |
|---|---|---|
| light / dark 各自独立调过 | ✅ | ✅ |
| 材质档位 0/1/2/3 正常可读 | ✅ 四档各录了快照 | ✅ 四档各录了快照 |
| Tier A/B/C 三条路径完整 | ✅ | ✅ |
| Layer B / Layer I 分层正确 | ✅ 轨道不折射，测试断言 backdrop 无 `url(` | ✅ 同左，且挖洞 |
| 交互态齐全，用 spring 预设 | ✅ hover / active / focus / disabled，全走 `transitionFor()` | ✅ 同左 |
| 移动端下拉类改 Drawer | ➖ 不适用 | ➖ 不适用 |
| 三种无障碍偏好正确降级 | ✅ reduced-motion + `contrast: more` 有测试；reduced-transparency 走 tier c 路径 | ✅ 同左 |
| WCAG AA 对比度检查通过 | ✅ CI 全绿（组件测点仍未接入夹具） | ✅ 同左 |
| registry item + 干净工程冒烟 | ✅ 已加进冒烟工作流 | ✅ 已加进冒烟工作流 |
| 文档页 Preview/Code/Fidelity/API | ❌ Phase 6 | ❌ Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ 含尺寸表、两条可信度限制、包围盒不可信告警 | ✅ 且含与 SPEC 冲突的显式标注 |
| Playwright 视觉回归快照 | ⚠️ 13 张已录，只有 win32 基线 | ⚠️ 13 张已录，只有 win32 基线 |

### 未过的项

- 🟡 **视觉快照只有 win32 基线**（与 Tabs 同因，平台相关）
- 🔴 **文档页未做** —— Phase 6
- 🟡 **Slider 的刻度点（ticks）未实现** —— 实测 218×4，对照图里能看到 Apple 有、我们没有
- 🟡 **knob 白度未经真机校准**（`--lg-knob-fill` 是推定值）

### 顺带做的

- **补齐 Tabs 的 hover / active**：未选中项 hover 出高亮（`--lg-fill-quaternary`，
  motion + spring）；按下选中项时指示器 `pressed` 上扬。
  原本还写了「未选中项按下加深」的分支，测试发现它是**死代码** ——
  Radix 在 `pointerdown` 就完成选中，不存在「按下但仍未选中」的阶段，遂删掉。
- **给 `apps/www` 补了 tsconfig**：registry 里的组件源码此前**从未被类型检查过**
  （不在 glass-core 的 tsconfig 范围内，而 apps/www 没有自己的）。补上后立刻查出
  两个 `exactOptionalPropertyTypes` 错误。
- **本地 `shadcn` CLI 修复**：工作区把 `zod` 解析成 3.24.1，而
  `@modelcontextprotocol/sdk` 要求 `^3.25.28`，CLI 一启动就
  `ERR_PACKAGE_PATH_NOT_EXPORTED: './v3'`。加了 `overrides: zod: ^3.25.76`。
  CI 用的是 `npx shadcn@latest`（独立解析），**不受影响，也没被这个问题掩盖过**。

### 测试增量

| 文件 | 数量 | 进 CI |
|---|---|---|
| `tests/controls.behavior.spec.ts` | 23 | ✅ |
| `tests/contrast-pref.behavior.spec.ts` | 5 | ✅ |
| `tests/tabs.behavior.spec.ts`（新增交互态） | +4 | ✅ |
| `tests/controls.visual.spec.ts` | 26 张快照 | ❌ 平台相关 |

本机全绿：typecheck ×2 · on-glass 漂移 · 探针契约 · 对比度审计（1512 次采样）· 行为回归 45 项 · 视觉 45 项。

---

## 0.4 Phase 3 · Button —— §14 逐条自查（2026-09-01）

第三批 P0 组件，只交付 Button 一个。**12 项过 10。**

这一批最重要的产出是**发现并修掉了一个可读性缺陷，而它只在高频背景上出现** ——
普通截图、静止态审计、人眼检查全都发现不了。

### 🔴 PROJECT_SPEC §2 与 §13 在 Button 上直接冲突

SPEC §2 的分层速查表对 Button 的规定与所有其他控件都不同：

> | Button | 静止：底座；按下：**升级为 Layer I** | 按下态 |

照做之后实测标签对比度：

| 背景 | 静止 | 按下 |
|---|---|---|
| 平滑渐变 | 15.46:1 | 13.03:1 ✅ |
| **6px 黑白条纹** | 15.46:1 | **1.92:1** 🔴 |

**根因不是折射，是 α 归零。** `.lg-surface[data-layer='indicator']` 的
`background-color` 是 `transparent`，而 `a11y/legibility.ts` 的整套地板保证
建立在 `C = a·F + (1−a)·B` 上 —— α 变成 0，保证就不存在了。
（knob 上没这个问题：knob 不承载文字。）

**处置：升级到 Layer I 时用一层 `rgb(var(--lg-base-color) / var(--lg-base-alpha))`
把材质补回来。** 折射仍在这一层背后跑（背景不再被底座模糊、高光变强、
亮度饱和上扬），「变成玻璃」的观感保住，α 回到地板值。

修完：条纹 + 按下 **1.92 → 7.83:1**。SPEC §2 与 §13 同时满足，不用二选一。

### 新增 CI 关卡：`scripts/press-legibility.mjs`

`contrast-audit.mjs` 审的是**静止态**，结构上查不出「某个状态把 α 变成 0」。
新脚本专门量交互态，且**必须在高频背景上量** —— 平滑背景下同一个 bug
只表现为 15.46 → 13.03，完全正常。

18 个测点，顺带把**同类结构**一起查了：

| 测点 | 渐变 | 条纹 | 结论 |
|---|---|---|---|
| Button glass 静止 / 按下 | 14.78 / 10.10 | 14.88 / 7.83 | ✅ |
| Button prominent 静止 / 按下 | 4.60 / 6.38 | 同左 | ✅ 实心不透明，与背景无关 |
| Button plain | 2.71 | 10.78 | **不判定** —— 见下 |
| **Tabs 选中项标签**（也压在 Layer I 上） | 15.51 | 12.29 | ✅ 没事 |

> Tabs 之所以没事：指示器是**叠在底座材质上面**的，底座的底色仍在标签背后。
> Button 翻车是因为按钮**自己就是**那层底座 —— 换了 layer 就什么都不剩。
> 这一条是先推理、后用同一把尺子验证的，不是假设。

> ⚠️ **`plain` 变体不提供可读性地板**，且这是它的定义决定的：borderless 按钮
> 没有材质，压在任意背景上与一段裸文字无异，本库给不了保证（iOS 同理）。
> 脚本**照常量它、照常打印**（渐变背景上 2.71:1，不过 AA），只是不判定 ——
> 让这个事实可见，而不是从检查里消失。组件的 JSDoc 里也写明了。

### 实心按钮：白字压在真实 systemBlue 上不过 AA

| 色 | 白字对比度 | 解出的填充 | 解后 |
|---|---|---|---|
| systemBlue `#007aff` | **4.02** | `#0071eb` | 4.60 |
| systemRed `#ff3b30` | **3.55** | `#dc332a` | 4.62 |

新增 `deriveProminentFill()`，与 `deriveOnGlassLabel()` 方向相反（那边调文字、
这边调背景），同样接进 `scripts/derived-colors.mjs`（由 `on-glass-colors.mjs`
改名而来）在 CI 里钉住漂移。

**一个值得记下来的坑：标签极性不能让算法自己挑。**
最初写成「取对比度更高的那一极」，结果 systemBlue 被判成**黑字**（5.23:1，
白字只有 4.02）—— 数学上确实更优，但 iOS 的蓝色实心按钮明明是白字（参考图为证）。
极性属于设计语言，必须由有参考图的调用方决定；函数只负责在给定极性下求解。

**另一条实测：实心填充必须完全不透明。** 试过让它半透明以透出玻璃，
但即使只有 8% 透明度，压在纯白背景上白标签也会掉到 4.08:1。所以
prominent / destructive 按下时不升级 Layer I，反馈改用压暗 + 缩放
（压暗只让白标签对比度**升高**，任何状态下都安全 —— 实测 4.60 → 6.38 印证）。

### 参考图与几何

这次先拿参考图、再写代码（上一批的教训）：

| 项 | 值 | 依据 |
|---|---|---|
| 按钮高 | **48 pt** | 工具栏节点 `12740:24071`（79×48 与 168×48）与 Alert §7.6 **两处独立印证** |
| 水平内边距 | **12 pt** | 79 宽的按钮里字形 55 宽且居中：(79−55)/2 |
| 标签 | **17 pt** | 字形框高 20，对应 SF body |
| 形状 | 胶囊 | `[官方]` glassEffect() 默认 Capsule |

字重按**设计语言**取而不是按视觉凑：工具栏玻璃按钮 = body regular 400，
实心 CTA = headline semibold 600（两张参考图各自为证）。
刻意**不**为了让回退字体看起来像 SF 而调整 —— 那在装了 SF 的系统上反而会错。

Fidelity 对照图的裁剪偏移也是**量出来的**：在参考图里找蓝色按钮的包围盒反推
帧在画布中的位置（水平 24、垂直 22），不是目测。
（顺带踩到：Tailwind preflight 的 `img{max-width:100%}` 会把按原始尺寸显示的
参考图压回容器宽度，裁出来是一片空白。）

### §14 逐条

| 验收项 | 结论 |
|---|---|
| light / dark 各自独立调过 | ✅ 实心填充在两个主题下各自解一次 |
| 材质档位 0/1/2/3 正常可读 | ✅ glass 变体四档各录快照 + 对比度审计 |
| Tier A/B/C 三条路径完整 | ✅ 只有 A 的按下态走 SVG 折射，有测试 |
| Layer B / Layer I 分层正确 | ✅ 静止 base、按下 indicator，且补回材质保住地板 |
| 交互态齐全，用 spring 预设 | ✅ hover / active / focus / disabled，全走 `transitionFor()` |
| 移动端下拉类改 Drawer | ➖ 不适用 |
| 三种无障碍偏好正确降级 | ✅ `contrast: more` 与 reduced-motion 有测试；reduced-transparency 走 tier c |
| WCAG AA 对比度检查通过 | ✅ 静止态审计 + **新增的交互态检查**（`plain` 例外，已标注） |
| registry item + 干净工程冒烟 | ✅ 已加进冒烟工作流 |
| 文档页 Preview/Code/Fidelity/API | ❌ Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ 含两处独立印证的说明与两条刻意偏离 |
| Playwright 视觉回归快照 | ⚠️ 19 张已录，只有 win32 基线 |

### 未过的项

- 🟡 **视觉快照只有 win32 基线**（与前两批同因）
- 🔴 **文档页未做** —— Phase 6
- 🟡 **`plain` 变体没有可读性地板** —— 由其定义决定，已在组件与脚本里标注，
  但它确实是一个「本库交付了、却不能给 AA 保证」的东西

### 测试增量

| 文件 | 数量 | 进 CI |
|---|---|---|
| `tests/button.behavior.spec.ts` | 16 | ✅ |
| `scripts/press-legibility.mjs` | 18 个测点 | ✅（接进对比度审计 workflow） |
| `tests/button.visual.spec.ts` | 19 张快照 | ❌ 平台相关 |

本机全绿：typecheck ×2 · registry 静态检查 · 派生色漂移 · 探针契约 ·
对比度审计 1512 次采样 · 交互态可读性 18 测点 · 行为回归 61 项 · 视觉 64 项。

---

## 0.45 Phase 3 · Dialog + Toggle —— §14 逐条自查（2026-09-01）

第四批 P0 组件。**Dialog 12 项过 10、Toggle 12 项过 9。**

### Dialog：几何全部量到了

节点 `12740:24495`，参考图 `screenshots/ios27-alert.png`（450×920，1px = 1pt）。

| 项 | 值 | 来源 |
|---|---|---|
| 面板宽 | 300 | 元数据 |
| **圆角** | **34** | **拟合** —— 见下 |
| 内边距 | 14 | 元数据 |
| 正文块再内缩 | 8 | 元数据 |
| 标题 → 正文 | 10 | 元数据 |
| 正文块 → 按钮区 | 24 | 元数据 |
| 按钮 | 132×48，间距 8 | 元数据（132+8+132 = 272 = 300−28 ✅ 自洽） |
| 标题 / 正文 | 均 17pt，行高 22 | 像素实测 |

**圆角是拟合出来的，不是目测。** 元数据里没有圆角。做法：沿面板左缘逐行找
「第一个亮度 ≥ 225 的像素」得到内缩曲线，再用 `inset(dy) = r − √(r²−(r−dy)²)`
最小二乘拟合 —— **34 个采样点，均方误差 0.35**，同时拟合出的左边界 x=85
与元数据预测分毫不差（这条顺带印证了之前推的帧偏移 24）。

> ✅ 拟合值 34 与 `primitive.css` 里既有的 `--lg-radius-xl` / `--lg-radius-continuous`
> （34px）撞上了 —— 那个值是 Phase 1 定的，这次是完全独立的来源。

**标题与正文的字号是量墨迹高度确定的**：两者都是 13px 高，也就是**同一个字号**。
看参考图会觉得正文更小，那是字重与颜色造成的错觉。行高 22 由两行正文的
基线间距（27−4）读出。

**一处与经典 iOS Alert 的明显差别：文字左对齐，不是居中。** 按参考图走。

### 禁用 asChild 带来的两处 API 差异

`asChild` 在本库是禁用的（shadcn 会在 base-* style 的工程里把它改写成 Base UI 的
`render` prop，见 §0.3）。这在 Dialog 上第一次产生了**面向用户的 API 后果**：

- `<DialogClose asChild><Button/></DialogClose>` 这个 shadcn 生态的惯用写法用不了。
  改成 **`DialogClose` 直接渲染本库的 Button**，接受全部 Button props：
  `<DialogClose variant="glass">Cancel</DialogClose>`。
  于是 Dialog 多了一条 `registryDependencies: @glass/button`。
- `DialogTrigger` 保持 Radix 原生 button，没法把任意元素提升成触发器。
  已在 registry 的 docs 字段里写明。

### 退场动画：Radix 会立刻卸载，必须自己接管开关态

Radix 关闭时同步卸载 Content，退场动画根本来不及播。解法是
`forceMount` + `AnimatePresence`，而这要求知道当前开关状态 —— Radix 不对外暴露。
所以 `Dialog` 自己维护了一份（受控 / 非受控两条路径都覆盖），
用它驱动 `AnimatePresence`。测试里有一条专门盯这个：
**关闭指令发出后元素必须还在**，跑完动画才消失。

### Toggle：没有 Apple 参考图，如实说

在 iOS 27 资源里找过 —— Edit Menu（`12740:24157`）是 Cut/Copy/Paste，
不是格式化开关；文件里没有单独的 Toggle 组件页。

**所以不编造尺寸**：几何**全部继承自 Button**（那边是两处独立节点实测的），
选中态的材质沿用 **Tabs 指示器**（Layer I）。
测试里因此有一组「与 Button 逐项相同」的断言 —— 高度、内边距、圆角、字号
挨个比对**同一页面上的 Button**，将来 Button 的实测值改了而 Toggle 没跟上，立刻会红。

**Toggle 是本库唯一不走 Radix 的交互组件。** 按下要做 spring 缩放就得让 motion
拥有那个 button 元素，而把 Radix 的 Root 换成 motion 元素只能靠 asChild。
Radix Toggle 提供的恰好是可以照抄的一小段（`aria-pressed`、`data-state`、
点击翻转、受控/非受控），props 名与输出属性都保持一致，迁移不用改调用处。
**这个理由不适用于焦点管理或弹层定位那类东西，别推广。**

### 又一次撞上 Layer I 的 α=0 陷阱

Toggle 的**选中态**用 Layer I，而它是带标签的 —— 与 Button 的按下态是同一个坑
（`background-color: transparent` 让材质不透明度归零，可读性地板随之消失）。
组件里补了材质层，并把它加进了 `press-legibility.mjs` 的测点。

顺带把 Dialog 的标题与正文也纳入该脚本。现在 24 个测点：

| 测点 | 渐变 | 条纹 |
|---|---|---|
| Toggle 选中态 | 17.73 | **11.67** ✅ |
| Dialog 标题 | 17.93 | 16.52 ✅ |
| Dialog 正文（次级标签色） | 8.72 | 8.38 ✅ |

### 测试抓到的两个真问题

**1. `data-slot` 被顶掉。** `DialogClose` 原本写了 `data-slot="dialog-close"`，
而 Button 在展开 props **之前**设 `data-slot="button"` —— 后写的把它顶掉了，
样式与测试赖以定位的结构钩子直接断掉（选择器一个都匹配不到）。
改成用 `data-dialog-close` 标记，不碰 `data-slot`。

**2. `flex-1` 与 Button 自带的 `shrink-0` 打架。** 按钮区原本用
`flex [&>*]:flex-1`，实测按钮宽 74 而不是 132 —— 两个工具类都在 utilities 层，
谁赢取决于生成顺序。改用 **grid 等分**（`grid-flow-col auto-cols-fr`），
轨道尺寸不受 flex-shrink 影响。

**顺带又踩了一次 `dev:css` 没重跑。** 新加的 grid 工具类没被生成，
量出来仍是旧值 —— 与当初指示器量出 40×0 是同一个坑。
（`pnpm dev` 现在会先跑 `dev:css` + `dev:build`，见 §0.6。）

### Fidelity

新增 `scripts/fidelity-sheets.mjs`，把之前一次性的临时脚本固化成构建步骤，
四张对照图一起出。Dialog 那张要**分两趟**：弹窗是 portal + fixed 的，塞不进
对照页的栏里，所以先把**真实运行的组件**单独截一张再引进去 ——
不是照着尺寸另画一遍（那样会和组件悄悄漂移）。

对照图里 Dialog 的高度对不上，原因是**参考图那一版带一个 Text Field**
（307 高里有 123 是输入框），本库还没有 Input 组件。已在图注里写明，
可比的是宽度、圆角、内边距、排版与按钮。

### §14 逐条

| 验收项 | Dialog | Toggle |
|---|---|---|
| light / dark 各自独立调过 | ✅ | ✅ |
| 材质档位 0/1/2/3 正常可读 | ✅ 四档各录快照 | ✅ 材质走 Tabs 指示器那套 |
| Tier A/B/C 三条路径完整 | ✅ | ✅ 只有 A 走 SVG 折射，有测试 |
| Layer B / Layer I 分层正确 | ✅ 只有面板，无 Layer I（§2 如此规定），有测试断言 | ✅ 选中 = Layer I + 材质补偿 |
| 交互态齐全，用 spring 预设 | ✅ 入场/退场/遮罩全走 `transitionFor()` | ✅ hover / active / focus / disabled |
| 移动端下拉类改 Drawer | 🟡 **未做** —— Dialog 属于下拉/浮层类，SPEC §9 要求移动端切 Drawer，那是 Phase 4 | ➖ 不适用 |
| 三种无障碍偏好正确降级 | ✅ reduced-motion 有测试（150ms 内消失） | ✅ 沿用既有分支 |
| WCAG AA 对比度检查通过 | ✅ 标题 / 正文都进了交互态可读性脚本 | ✅ 选中态进了同一脚本 |
| registry item + 干净工程冒烟 | ✅ 已加进冒烟工作流 | ✅ 已加进冒烟工作流 |
| 文档页 Preview/Code/Fidelity/API | ❌ Phase 6 | ❌ Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ 含拟合方法与自洽校验 | ✅ **明确写了「本组件没有独立参考图」** |
| Playwright 视觉回归快照 | ⚠️ 12 张，只有 win32 基线 | ⚠️ 2 张，只有 win32 基线 |

### 未过的项

- 🔴 **文档页未做** —— Phase 6（两个组件都是）
- 🟡 **视觉快照只有 win32 基线** —— 与前几批同因
- ~~🟡 **Dialog 的移动端 Drawer 路径未做**~~ —— **这条判断是错的，已在 §0.48 更正。**
  SPEC §9 限定的是「从触发点弹出浮层」的那一类（Select / DropdownMenu / Popover …），
  **Dialog 不在其中**；iOS 的 `UIAlertController` 用 `.alert` 样式时在 iPhone 上
  同样是居中弹窗。Dialog 保持居中是对的，不是欠账。
- 🟡 **Toggle 没有 Apple 参考图** —— 几何有来源（继承 Button）但来源不是 Apple
  的 Toggle 本身；ToggleGroup 未交付。

### 测试增量

| 文件 | 数量 | 进 CI |
|---|---|---|
| `tests/dialog.behavior.spec.ts` | 16 | ✅ |
| `tests/toggle.behavior.spec.ts` | 12 | ✅ |
| `scripts/press-legibility.mjs` | 18 → **24** 个测点 | ✅ |
| `tests/dialog.visual.spec.ts` + Toggle 快照 | 14 张 | ❌ 平台相关 |

本机全绿：typecheck ×2 · registry 静态检查 · 派生色漂移 · 探针契约 ·
对比度审计 1512 采样 · 交互态可读性 24 测点 · 行为回归 **89** 项 · 视觉 **78** 项。

---

## 0.47 Phase 3 · Card —— §14 逐条自查（2026-09-01）

第五批 P0 组件，只有一个。**12 项过 9，另有 2 项按规格不适用。**

### 先说清楚这个组件是什么

PROJECT_SPEC §10 把 Card 的 Apple 对应物写死为 **grouped list section**，
不是「一个圆角盒子」。所以本组件的基准是 iOS 设置页里那种
「白区块压在灰底上、里面若干行、行间一条内缩的细线」。

**它没有玻璃，将来也不该加。** §2 的分层速查表里 Card 那一行是
「两者都不用」，§15 第 9 条明令禁止在内容型组件上堆玻璃，
依据是 Apple 的 "This material forms a distinct functional layer for
controls and navigation elements."

### 几何：从三块列表量出来，圆角这次做到了亚像素

在 iOS 27 资源里找到三块名字就叫 **Grouped List** 的 frame：

| 节点 | 内容 | 用途 |
|---|---|---|
| `12740:33850` | 4 行 Text Field | 渲染整屏，量圆角与底色 |
| `12740:33923` | 2 行 Switch | 渲染整屏，独立复核 + Fidelity 对照 |
| `12740:33898` | 3 行 Slider | 只取元数据，交叉验证行高 |

| 项 | 值 | 三块是否一致 |
|---|---|---|
| 区块宽 | 370（= 402 − 2×16） | ✅ |
| 行高 | **52** | ✅ 三种行类型全是 52 |
| 行内左右内缩 | 16（内容框 338，两侧对称） | ✅ |
| 分隔线 | 1pt，两侧各内缩 16，#e6e6e6 | ✅ |
| 区块底色 | #ffffff，**alpha 通道 255** | ✅ |
| 页面底色 | #f2f2f7 | ✅ |

**圆角 = 26。** 方法比 Dialog 那次更细：背景 #f2f2f7 与前景 #ffffff 的蓝通道
只差 8，于是每个像素的覆盖率 `α = (B − 247)/8`，逐行求和得到**亚像素**内缩量，
再对 `inset(dy) = r − √(r²−(r−dy)²)` 做最小二乘，并丢掉最靠边的 1–2 行
（那两行是纯抗锯齿，系统性偏大）。

| 来源 | 拟合半径 | RMSE |
|---|---|---|
| `ios27-list-screen.png` | **26.27** | **0.12 px**（19 个采样点） |
| `ios27-grouped-list-rows.png` | 26.33 | 0.69 px（受行内文字干扰） |

固定半径复算：26 → 0.215，27 → 0.384，25 → 0.716。两参数拟合（半径 + 常数偏移）
给出偏移 0.03，说明测量没有系统性平移。**取 26。**

26 不在既有阶梯（8/14/22/34）上，所以单开了 `--lg-radius-card`，
没有硬塞进阶梯把阶梯搞脏。

### 两次「对上了」

1. **页面底色实测 #f2f2f7，与 Phase 1 就定好的 `--lg-gray-6-light` 逐位相同。**
   两条互不相关的来源撞在一起，算是对那个 token 的一次独立印证。
2. **`shadcn.css` 里 `--card` 原本硬写着 `#ffffff`**（dark 是 `var(--lg-gray-6)`），
   恰好就是这次量到的值。已改成指向 `--lg-card-fill` —— 别名层不该自己持有值，
   现在两边不可能再漂开。

### 一处不能合并的地方

分组列表的分隔线实测 **#e6e6e6（压白底 = 黑 9.8%）**，而既有的 `--lg-separator`
是 0.29，压白底算出来是 #c6c6c7 —— **淡得多**。同一份资源里两者就是不同的粗细，
合并成一个 token 会把量到的事实抹掉。所以新开 `--lg-list-separator`。

### 顺手修掉一个 reduced-transparency 的真缺陷

`theme.css` 的 `@media (prefers-reduced-transparency: reduce)` 里，
`.lg-content` 原来只被摘掉了 `backdrop-filter`，**底色仍然是半透明的**
（regular 档亮色是白 78%）。结果是最糟的组合：**既没有模糊把背景压平，
又还能看见背景。** 现在落到 `--lg-card-fill`（实测的不透明分组底色）。

这条以前没被发现，是因为 `.lg-content` 在本次之前**没有任何组件用**。

### 顺手补上一道 CI 闸：`public/r` 也会漂

重新 build registry 时发现 `public/r/dialog.json` 与 `registry/glass/ui/dialog.tsx`
**不一致**（一处注释里的章节号）。原因是那批交付里改了 .tsx 之后没重新 build。

已有的漂移闸只盯 `registry/glass/registry.json`（从 CSS 生成的 theme item），
**漏掉了 `public/r/*.json`** —— 而那一层装的正是**组件源码的副本**，
用户 `shadcn add` 拿到的就是它。改了源码忘了 build，仓库里挂着的就是旧源码，
不会有任何报错。CI 每次都现 build，所以冒烟测试一直是绿的，掩盖了这个问题。

已加第二道闸：`shadcn build` 之后检查 `git status --porcelain apps/www/public/r`。

### 新的测试能力：Playwright 测不了的偏好，CDP 能测

`prefers-reduced-transparency` Playwright 没有开关，此前 Tabs 的测试是
「改 tier=c 去走同一条路径」——**近似，不是真的**。这次发现
`Emulation.setEmulatedMedia` 能塞任意 media feature：

```js
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
});
```

实测 `matchMedia()` 真的翻转，Provider 自己读媒体查询的那条链路也一起被测到。
Card 的降级测试用的就是这条。

> 🟡 **其余组件还没迁过去。** Tabs 那条近似测试仍在原地 ——
> 这是一条**已知的、可以补的**债，不是做不到。

### 与 Apple 参考图的差异（Fidelity）

`public/fidelity/compare-card.png`。**这张比前四张更值得看**：前四张里左边的
白底行是对照台自己画的，只是给被测组件一个 iOS 的落脚点；这一张里
**那块白底就是被测组件本身**，圆角、行高、分隔线、内缩全部可比。

量化过的唯一差异是字体：同一串 "Switch is on" 的墨迹
**高度两边都是 13px**（说明 17pt 取对了），宽度 89 vs 86 —— 差 3px（3.4%），
起始位置两边都是区块内 17px。

### §14 逐条

| 验收项 | Card |
|---|---|
| light / dark 各自独立调过 | ✅ 暗色是 #000 底 + #1c1c1e 区块，有测试断言不是反色 |
| 材质档位 0/1/2/3 正常可读 | ➖ **不适用** —— 档位滑杆调的是玻璃材质，内容层不吃那组变量 |
| Tier A/B/C 三条路径完整 | ✅ 只有 `material` 变体有区别（A/B 模糊、C 转厚实色），三档各录快照 |
| Layer B / Layer I 分层正确 | ➖ **不适用** —— §2 规定 Card 两者都不用。有测试断言卡片内**一个 `.lg-surface` 都没有** |
| 交互态齐全，用 spring 预设 | ✅ 可点的行 hover / press / focus / disabled，走 `transitionFor()` |
| 移动端下拉类改 Drawer | ➖ 不适用（不是浮层类） |
| 三种无障碍偏好正确降级 | ✅ 三条全有测试，其中 reduced-transparency 是**真模拟**（CDP） |
| WCAG AA 对比度检查通过 | ✅ grouped 21.00 / material 15.08（条纹 16.36）；`plain` 不判定，理由同 Button |
| registry item + 干净工程冒烟 | ✅ 已加进冒烟工作流，并额外断言三个新 token 落地 |
| 文档页 Preview/Code/Fidelity/API | ❌ Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ 含拟合方法、三块列表的交叉验证、暗色未实测的明确标注 |
| Playwright 视觉回归快照 | ⚠️ 15 张，只有 win32 基线 |

### 未过的项

- 🔴 **文档页未做** —— Phase 6
- 🟡 **视觉快照只有 win32 基线** —— 与前几批同因
- 🟡 **暗色三个颜色 token 没有实测。** iOS 27 资源里这三块 Grouped List 只有亮色版，
  没找到暗色。`--lg-grouped-bg` / `--lg-card-fill` 是 `[待核实 · 社区通行值]`，
  `--lg-list-separator` 的暗色是 `[推定]` —— 已在 semantic.css 就地标注，
  **没有伪装成实测**。
- 🟡 **Section header / footer 没量到。** 三块列表都没有 header，
  所以 `CardDescription` 的字号标的是 `[待核实]`（社区通行的 subheadline 15pt）。
- 🟡 **`plain` 变体不提供可读性地板** —— 按定义就没有底，与 Button 的 `plain` 同因。
  实测渐变背景上 4.23:1（脚本照常量出来并打印，但不判定）。

### 测试增量

| 文件 | 数量 | 进 CI |
|---|---|---|
| `tests/card.behavior.spec.ts` | 19 | ✅ |
| `scripts/press-legibility.mjs` | 24 → **30** 个测点 | ✅ |
| `tests/card.visual.spec.ts` | 15 张 | ❌ 平台相关 |

本机全绿：typecheck ×2 · registry 静态检查 · 派生色漂移 · 探针契约 ·
对比度审计 1512 采样 · 交互态可读性 **30** 测点 · 行为回归 **108** 项 · 视觉 **93** 项。

---

## 0.48 Phase 4 起步 · Sheet / Drawer —— §14 逐条自查（2026-09-01）

**12 项过 9，1 项明确未达标，2 项不适用。**

### 为什么先做 Sheet，而不是先做 ResponsiveOverlay

Phase 4 的任务卡是「实现 `<ResponsiveOverlay>` 原语，并把 Phase 3 的
Select / DropdownMenu / Popover 迁移过去」。但那三个组件**还不存在** ——
它们正是我上一批建议推迟的四个浮层类之一。也就是说卡片写的迁移步骤
目前没有东西可迁。

而 ResponsiveOverlay 的移动端那条路径**就是 Drawer**。所以顺序倒过来：
先把 Drawer 做扎实（它本身也是 P0 清单里的 Sheet/Drawer），
下一批再把 ResponsiveOverlay 连同 Popover / Select / DropdownMenu 一起做 ——
那时它才有真实的桌面端消费者，不必凭空造一个。

### 🔴 一处要更正我自己写的东西

§0.45 里我把「Dialog 的移动端 Drawer 路径未做」记成了**未完成项**，
理由写的是「SPEC §9 要求下拉/浮层类在移动端切 Drawer」。**这条判断是错的。**

SPEC §9 的原文限定是「Select、DropdownMenu、Combobox、ContextMenu、Menubar、
NavigationMenu、DatePicker、Popover 等所有**从触发点弹出浮层**的组件」——
**Dialog / AlertDialog 不在其中**，它也不从触发点弹出。iOS 自己的
`UIAlertController` 用 `.alert` 样式时在 iPhone 上同样是居中弹窗，
只有 `.actionSheet` 才从底部出来。

所以 Dialog 保持居中是**对的**，不是欠账。已知缺口少一项。

### 补上了 apple-metrics 里空着的那一格

§7.5 的圆角一栏此前写的是「仍未取得」。这次量到了。

面板外面有一圈落影，按颜色阈值找边会量到影子（试过，拟合出 r≈60、RMSE 2.5，
一眼假）。改成沿每行找**亮度最低点** —— 那条 1px 暗轮廓线才是面板边缘 ——
再做圆弧最小二乘：

| | 值 |
|---|---|
| 拟合半径 | **34.08** |
| RMSE | **0.376 px**（28 个采样点） |
| 固定半径复算 | 34 → 0.379 · 32 → 1.175 · 36 → 1.116 |

> ✅ **34 与 `--lg-radius-xl` 第三次撞上。** 前两次是 Phase 1 定 token 时、
> 与 Alert 的轮廓拟合。三处独立来源同值。

同时确认了一件让人放心的事：**抓手的元数据与像素扫描逐位吻合** ——
元数据说 58×4 位于面板内 (166, 5)，像素扫出来是 x 172…229、y 414…417，
面板在 x=6/y=409，减一减正好。抓手灰度中位 197 压在面板底色 248 上，
反推黑色 20.6%，取 `--lg-grabber-fill: rgb(0 0 0 / 0.2)`（回算 198，差 1/255）。

### ⚠️ 一条明确没达标的：4pt 高的 Layer I

SPEC §2 给 Sheet 的分层是 `面板 | grabber 抓手`，也就是**抓手是 Layer I**。
§14 要求 Layer I「有可见色散」。

**抓手只有 4pt 高，色散在这个尺度上看不出来** —— 本库最强档的色散偏移也就
1–2px 量级，压在一条 4px 的横条上就是一片糊。抓手仍然走 indicator 层
（规格如此，Tier A 下确实挂着 SVG 折射，有测试钉住），
但「可见色散」这一条**没达标，不假装达标**。视觉快照里专门存了一张
抓手特写（`sheet-grabber-zoom`），将来真要改这条，那张图会说话。

顺带：抓手是 α=0 的 indicator 层，与 Button 按下态、Toggle 选中态是同一个陷阱 ——
不补底色就是一条隐形的横条。补了 `--lg-grabber-fill`，有测试卡住 α > 0.1。

### 手势：速度投影，以及一条差点长期偶发的测试

甩动关闭不是「拖过某个距离」，而是**把松手瞬间的速度外推 200ms，用落点判档**。
只看位移的话，快速小幅度的甩动会被判成「没动」，手感很木。

这条的测试踩了个坑值得记：**它一度只在机器空闲时通过。**
速度 = 位移 / 采样间隔，而 `page.mouse.move()` 逐步下发时每一步都是一次
CDP 往返 —— 单 worker 下实测 v ≈ 760 px/s 很稳，并行跑测试时往返被拉长，
v 掉到 500 的阈值以下就误判。同一手势实测在 **679–1227 px/s** 之间抖。

最后的做法是三条一起上：
1. 指针序列改在**页面内按 rAF 派发**，采样间隔与测试进程负载无关；
2. 视口加高到 1400 —— 「速度够快」与「位移必须小于阈值」是一对矛盾约束，
   视口越矮余量越小；
3. 这条用 **Tier C** —— 速度按帧间隔算，而并行时最贵的正是 Tier A 的
   backdrop-filter + SVG 折射，帧一慢速度就假性偏低。甩动判定与渲染路径无关。

改完 `--repeat-each=5` 全绿，全量套件连跑两遍也全绿。

### 做的时候被视觉快照抓到的两个真问题

**1. footer 被推出屏幕。** 面板按**最高档**渲染再往下位移（改 height 会重排，
拖起来会卡），于是低档位时面板底部有一截在屏幕外 —— 内容若按面板全高排版，
`SheetFooter` 就落到可视区之外（实测视口 734、medium 档下 footer 的 y 是 **953**）。
修法是给内容加一条跟着位移走的 `padding-bottom`，把屏幕外那一截让出来，
内容始终按**可见高度**排版。iOS 的 sheet 在 medium 档下也是这个行为
（它是真的变矮，不是被裁掉）。已写成回归测试。

**2. 一打开就有一道焦点环套在抓手上。** Radix 默认把焦点给第一个可聚焦元素，
而那正是抓手 —— 一条 4pt 的横条上套着蓝框，视觉快照里当场看见。
而且屏幕阅读器先读到的是「调整面板高度」而不是标题。
改成 `onOpenAutoFocus` 里聚焦面板本身（Radix 给了 tabIndex=-1）。

还有一个是**写验证台时**撞出来的：`<SheetClose><Button/></SheetClose>` 会变成
button 套 button（无效 HTML，React 直接报 hydration 错）。原因还是禁用 asChild ——
与 Dialog 同一个约束。`SheetClose` 因此也改成**直接渲染本库的 Button**，
两个组件的写法就此统一。

### §14 逐条

| 验收项 | Sheet |
|---|---|
| light / dark 各自独立调过 | ✅ 各录 6 张快照 |
| 材质档位 0/1/2/3 正常可读 | ✅ 录了 0 / 0.34 / 1；0.67 没单独录（档位是连续插值，没有分段行为） |
| Tier A/B/C 三条路径完整 | ✅ 各录快照；抓手只有 Tier A 走 SVG 折射，有测试 |
| Layer B / Layer I 分层正确 | 🟡 **分层对了，「可见色散」没达标** —— 抓手 4pt 高，色散在这个尺度上看不出来 |
| 交互态齐全，用 spring 预设 | ✅ 拖拽 / 甩动 / 换档 / 回弹 / 焦点，全走 `transitionFor()` |
| 移动端下拉类改 Drawer | ➖ 它**就是** Drawer。ResponsiveOverlay 下一批 |
| 三种无障碍偏好正确降级 | ✅ 三条全有测试；reduced-transparency 用 CDP **真模拟** |
| WCAG AA 对比度检查通过 | ✅ 标题 17.54 / 正文 8.36（条纹 16.67 / 8.46） |
| registry item + 干净工程冒烟 | ✅ 已加进冒烟工作流，并断言 `--lg-grabber-fill` 落地 |
| 文档页 Preview/Code/Fidelity/API | ❌ Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ 含拟合方法、四个角哪两个是推定的、档位哪一档没量到 |
| Playwright 视觉回归快照 | ⚠️ 13 张，只有 win32 基线 |

### 未过的项

- 🔴 **文档页未做** —— Phase 6
- 🔴 **抓手的「可见色散」没达标** —— 见上，4pt 高的物理限制，不是没做
- 🟡 **视觉快照只有 win32 基线**
- 🟡 **large 档没有实测依据。** 参考图只给了一个档位（0.525，与 HIG 的
  「about half」相符）。`0.94` 是 `[推定]`，只为在顶部留出一点背后页面。
- 🟡 **下面两个角的圆角是推定的**（按对称）—— 参考图里它们紧贴设备边框与落影
- 🟡 **正文区不参与拖拽。** sheet 里通常有可滚动内容，「手指下滑」该滚内容还是拖面板
  需要一套滚动协调，那套没做。默认只有抓手区与标题区能起手拖拽，内容不滚动时可以传
  `dragFrom="sheet"` 打开整片拖拽。**这是已知的未完成，不是设计选择。**
- 🟡 **ResponsiveOverlay 本体还没有。** Phase 4 的核心原语要等下一批与
  Popover / Select / DropdownMenu 一起落地。本批只把它的移动端那条路径
  （Drawer）和判定用的 `useIsCompact()` 做好了。

### 顺带修的 core 缺陷

`useMediaQuery` 的 `subscribe` / `getSnapshot` 是工厂函数，每次 render 都返回新闭包 ——
React 认为订阅源变了，于是**每一次 render 都退订再重订**一遍。行为没错（store 在模块级），
但四个偏好查询乘以每次 render 纯属白烧。改成按 query 缓存函数身份。

### 测试增量

| 文件 | 数量 | 进 CI |
|---|---|---|
| `tests/sheet.behavior.spec.ts` | 23 | ✅ |
| `scripts/press-legibility.mjs` | 30 → **34** 个测点 | ✅ |
| `tests/sheet.visual.spec.ts` | 13 张 | ❌ 平台相关 |

本机全绿：typecheck ×2 · registry 静态检查 · 派生色漂移 · 探针契约 ·
对比度审计 1512 采样 · 交互态可读性 **34** 测点 · 行为回归 **131** 项 · 视觉 **106** 项。

---

## 0.49 Phase 4 落地 · Popover + ResponsiveOverlay —— §14 自查（2026-09-01）

**Popover 12 项过 9（2 项不适用）；ResponsiveOverlay 是原语，单独一套判据。**

### ResponsiveOverlay：Phase 4 的正题

任务卡的三条重点全部落地并有测试钉住：

| 卡片要求 | 落地 |
|---|---|
| 用 `useSyncExternalStore` 订阅 matchMedia | ✅ `useIsCompact()` 在 core 里（Sheet 那批加的），SSR 快照返回 `false` |
| 判定 `(max-width:768px) \|\| (pointer:coarse)` | ✅ **两条各有一个测试** —— 宽视口 + `hasTouch` 也走 Drawer |
| `responsive={false}` 逃生口 | ✅ 窄视口下仍留在桌面路径，有测试 |
| 焦点陷阱与还原在两条路径下都过测试 | ✅ Esc 关闭 + 焦点还给触发器，两条路径各跑一遍 |

**最花心思的是「无障碍不能退化」这条。** 两条路径底层是两个不同的 Radix 原语，
默认行为并不一致 —— 最扎眼的是可访问名称：Radix Dialog（Sheet 走它）**要求**必须有
Title，Popover 则不要求。于是 `title` 在本原语里是**必填**的：移动路径下渲染成
`SheetTitle` 并真的显示出来（iOS 的 action sheet 也有标题），桌面路径下落到
`aria-label`。测试断言两条路径读出来的名称一样。

**一处如实说明的代价：** 切换视口档位会**把子树整个重挂**（两条路径是两棵不同的
Radix 树）。跨过 768 或指针类型变化才会发生，属于罕见事件。换成「同一棵树里换渲染」
要么得放弃 Radix 原语，要么得把两套 aria 接线自己实现一遍 —— 那才是真会退化的做法。

### CI 抓到一条本机测不出来的东西：两条路径的**模态性本来就不同**

「两条路径的触发器都带 aria-expanded 且跟随开关」这条测试**本机全绿、CI 上红**，
报的是「打开之后 `getByRole` 找不到触发器」。

查下来不是 bug，是**语义差异**：移动路径的 Drawer 是**模态**的，Radix Dialog 打开时
会把页面其余部分从无障碍树里摘掉（aria-hidden）；桌面路径的 Popover 默认非模态，
触发器还在树里。**两边都对** —— 底部 Drawer 本来就该是模态的（iOS 的 action sheet
也是），锚定浮层本来就不该是。

本机之所以绿，是因为断言跑在 Radix 挂上 aria-hidden 之前 —— 一条**潜伏的时序竞态**，
在慢一点的机器上才现形。

改法不是把断言放松，而是**把这件事拆成两条**：
1. `aria-expanded` 跟随开关 —— 打开后改用 DOM 选择器断言（属性确实在元素上）；
2. 单开一条测试**钉住模态性差异本身**（桌面在树里 / 移动不在）。

顺带把「等价」的边界说清楚了：**等价的是「可访问名称、Esc、焦点还原」，不是模态性。**

### Popover：一次**失败的**圆角测量，如实记下来

前几个组件的圆角都是从参考图轮廓拟合出来的，残差都很小
（Card 26 / RMSE 0.12，Sheet 34 / RMSE 0.38，Alert 34 / MSE 0.35）。
**菜单这次不收敛：**

| 模型 | 结果 | RMSE |
|---|---|---|
| 圆弧（亮度最低点找边） | r = 20.5 ~ 25.5 | **1.5 ~ 2.2 px** |
| 圆弧（覆盖率求亚像素） | r = 25.5 | 2.18 px |
| 自由超椭圆 `(r, n)` | n=3 → r=29.4；**n=4 → r=37.6** | 1.25 px（两者一样） |

超椭圆把残差压到 1.25，但 **r 与 n 强烈互换 —— 半径不可辨识**。

根因想明白了：Card / Sheet 的边缘两侧都是接近实色的区域，"覆盖率 = 归一化亮度"
成立；而菜单面板是**半透明玻璃压在中灰背景上**，外面有落影、里面还有一道亮描边，
边缘根本不是干净的两色台阶。

> **所以圆角取 `--lg-radius-lg`（22）并标 `[推定]`** —— 圆弧拟合的落点集中在 20–25。
> 组件注释、apple-metrics §7.7、registry 描述、Fidelity 图注**四处都写明了这是推定值**。
> 测试里那条 `border-radius === 22px` 钉的是**实现不漂**，不是在断言 Apple 就是 22。

顺带一个观察（不是结论）：残差呈系统性偏向 —— 小 dy 处实测比圆弧更贴边、大 dy 处又
拖得更远，这正是**连续曲率（squircle）**的特征。组件因此开了 `continuous`。

### 量到的东西

| 项 | 值 |
|---|---|
| 面板宽 | **250**（节点元数据） |
| 上下内边距 | **10**（338 − 66 − 262 = 10，与顶部对称） |
| 左右内边距 | **16**（由菜单项 x=16 / 宽 218 反推） |
| 分隔线 | **1pt，位于分隔区顶端 +2，左右各内缩 24（宽 202）** —— 两条分隔线独立复核一致 |
| 分隔线颜色 | 灰度 182，压在面板 207 上 |

### 一条差点写反的测试

第一版写的是「Tier A 的面板应当有 `url(` 折射」，当场红了。
**Tier A 是「折射可用」，不是「所有玻璃都折射」** —— SPEC §2 的 Layer B 定义就是
**磨砂底座，不折射**，折射只挂在 `layer="indicator"` 上。Popover 的面板是 elevated，
属于 Layer B，三档下都只有 blur + saturate。测试改成断言这件事，注释写明了理由。

### §14 逐条

| 验收项 | Popover |
|---|---|
| light / dark 各自独立调过 | ✅ 各录 5 张快照 |
| 材质档位 0/1/2/3 正常可读 | ✅ 录了 0 / 0.34 / 1 |
| Tier A/B/C 三条路径完整 | ✅ 各录快照，且有「任何 Tier 下都不折射」的测试 |
| Layer B / Layer I 分层正确 | 🟡 **面板对了；Layer I 不在本组件** —— §2 给的 Layer I 是「高亮项」，Popover 里没有「项」，下一批随 Select / DropdownMenu 落地 |
| 交互态齐全，用 spring 预设 | 🟡 开关走 `transitionFor()`；hover / active 属于「项」，同上 |
| 移动端下拉类改 Drawer | ✅ **由 ResponsiveOverlay 提供**，两条路径各有测试；Popover 自身不做，组件与 registry 文档都写明了 |
| 三种无障碍偏好正确降级 | ✅ 三条全有测试；reduced-transparency 用 CDP 真模拟 |
| WCAG AA 对比度检查通过 | ✅ 面板内文字 17.10（条纹 17.94）—— 弹层**没有遮罩兜底**，比 Dialog 更接近最坏情况 |
| registry item + 干净工程冒烟 | ✅ 两个 item 都已加进冒烟工作流 |
| 文档页 Preview/Code/Fidelity/API | ❌ Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ **含拟合失败的完整记录**，没有把推定值伪装成实测 |
| Playwright 视觉回归快照 | ⚠️ 15 张，只有 win32 基线 |

### 未过的项

- 🔴 **文档页未做** —— Phase 6
- 🔴 **圆角是推定值**，理由见上；要定下来需要 iOS 真机截图或 Figma 的 cornerRadius 字段
- 🟡 **视觉快照只有 win32 基线**
- 🟡 **Layer I（高亮项）与项级交互态尚未落地** —— 下一批随 Select / DropdownMenu
- 🟡 **SSR 那条只有推理，没有实测。** `useSyncExternalStore` 的 server snapshot 保证了
  首帧走桌面路径且不产生 hydration mismatch，但本仓库的验证台是纯客户端渲染，
  **测不到真正的 SSR**。registry 冒烟测试里那个干净 Next 工程倒是能做这件事，
  目前只跑了 `next build`，没跑起来验证首屏 —— 这是一条可以补的债。
- 🟡 **切换档位会重挂子树**（见上），已在组件与 registry 文档中写明。

### 测试增量

| 文件 | 数量 | 进 CI |
|---|---|---|
| `tests/popover.behavior.spec.ts` | 14 | ✅ |
| `tests/responsive-overlay.behavior.spec.ts` | 12 | ✅ |
| `scripts/press-legibility.mjs` | 34 → **36** 个测点 | ✅ |
| `tests/overlay.visual.spec.ts` | 15 张 | ❌ 平台相关 |

本机全绿：typecheck ×2 · registry 静态检查 · 派生色漂移 · 探针契约 ·
对比度审计 1512 采样 · 交互态可读性 **36** 测点 · 行为回归 **157** 项 · 视觉 **121** 项。

---

## 0.51 Phase 3 · DropdownMenu —— §14 逐条自查（2026-09-02）

**12 项过 10。** P0 只剩 Select 一个。

### Layer I 第一次真的看得见色散 —— 有数字

Sheet 的抓手那条我记成了「没达标」：Layer I 要求可见色散，而 4pt 高的横条上
色散偏移（1–2px 量级）根本看不出来。菜单的高亮项是 **218×40**，尺度够了。

判据不能靠肉眼。做法：把高亮项压在 **6px 黑白条纹**上截特写，逐像素统计
**通道差**（无色散时 R=G=B，有色散时三个通道的边缘错开，会出现彩边）：

| 采样区 | 最大通道差 | 亮度 σ（条纹清晰度） |
|---|---|---|
| **高亮项内**（Layer I + 挖洞） | **29** | **34.7** |
| 同一面板、未高亮（上方） | 2 | 18.4 |
| 同一面板、未高亮（下方） | 2 | 17.0 |

- **色散：29 vs 2，差 14.5 倍** —— 这一条这次是真的达标了。
- **挖洞：条纹清晰度 34.7 vs 17–18，约 2 倍** —— 洞里看到的是没被面板模糊过的
  背景，正是 Tabs 那批做挖洞时要的效果。

> 平滑渐变上这两件事**都看不出来**，所以特写存了两张（gradient / stripes），
> 判读只看条纹那张。全库的光学诊断一直是这个口径。

### 移动端那条路径是**我们自己接的线**，说清楚不对称在哪

两条路径的实现不对称，这一点写进了组件注释、registry 文档和测试：

| | 桌面 | 移动 |
|---|---|---|
| 原语 | `@radix-ui/react-dropdown-menu` | 本库 `<Sheet>` + 自己写的 `role=menu` |
| 方向键 / Home / End | Radix | 自己写的，有测试 |
| **typeahead（首字母跳转）** | Radix 有 | ❌ **没有** |
| 可访问名称 | 由**触发器**命名（WAI-ARIA menu 模式） | 由 Drawer 的**可见标题**命名 |
| 高亮项 | Layer I（折射 + 色散 + 挖洞） | 无 —— Drawer 里没有悬停这一说 |

**为什么不能两边都用 Radix**：Radix 的 `DropdownMenu.Content` 自带 popper 定位、
必须挂在自己的 Portal 里，塞不进 Sheet 的面板；而 Sheet 的档位、拖拽、甩动关闭
又是 SPEC §9 点名要求的。二者只能取其一。

typeahead 这条**写成了测试**（按 `d` 之后焦点不动）。它钉的是**已知缺口**：
哪天补上了这条会红，那正是提醒去改文档与本节的时机。

可访问名称不一致这件事，与上一批发现的「模态性差异」是同一类：
**等价的是「能用键盘走完、能 Esc、焦点还得回去」，不是每个属性都一样。**

### CI 又抓到一帧：换项的一瞬间「谁都没高亮」

挖洞那条测试**本机全绿、CI 上红**，报的是 `getComputedStyle(null)`。

原因是 Radix 换高亮项时会**先摘掉旧项**的 `data-highlighted`、再给新项挂上 ——
中间存在一帧谁都没高亮。我的 observer 在那一帧就把洞收掉了，
于是 `.lg-punch-layer` 短暂消失，测试正好读到 null。

这不只是测试的问题：**洞会跟着闪一下**，快机器上看不见而已。
两边都改了：
- 组件：清洞推迟一帧，下一帧确认真的没人高亮才收；
- 测试：读取容忍元素不在，不假设它一定存在。

### 一个坑踩了两次：`useEffect` + ref 装不上监听器

挖洞的 observer 和移动端的方向键监听，第一版都写成
`useEffect(() => { const el = ref.current; if (!el) return; ... }, [deps])`。

**两处都失灵**，原因相同：浮层是 Portal 里的东西，effect 第一次跑的时候
`ref.current` 还是 null；而 ref 的赋值**不会触发 effect 重跑** —— 监听器永远装不上。
`data-punched` 一直是 null，移动端按方向键毫无反应。

改法：
- 挖洞 → **回调 ref**（节点挂上/卸下时各跑一次，天然对齐生命周期）
- 方向键 → 直接用 `onKeyDown` 属性，根本不需要手动 addEventListener

两处都在注释里写明了原因，免得下次又这么写。

### 顺带修正一处对照图的说法

Fidelity 图里菜单项从「对照台自己摆的占位」换成了**真组件**。
换完发现右边比左边**矮 20pt**，查下来不是行高错了：参考图里
"Paste and Match Style" 那一项**折成两行**（前面的 SF Symbols 图标占掉了宽度，
项高 60），本库没有图标所以一行放得下（项高 40）。图注里改成了这个说法，
原来那句「两边总高一致」已经不成立，删掉了。

### §14 逐条

| 验收项 | DropdownMenu |
|---|---|
| light / dark 各自独立调过 | ✅ 各录 5 张快照 |
| 材质档位 0/1/2/3 正常可读 | 🟡 只录了默认档 0.34 —— 面板与 Popover 同一层材质，那边录了 0/0.34/1 |
| Tier A/B/C 三条路径完整 | ✅ 各录快照；高亮项只有 Tier A 走 SVG 折射，有测试 |
| Layer B / Layer I 分层正确 | ✅ **面板磨砂不折射 + 高亮项折射且色散可见（29 vs 2）+ 挖洞（σ 34.7 vs 17）** |
| 交互态齐全，用 spring 预设 | ✅ 高亮 / 禁用 / 破坏性；过渡走 `transitionFor()` |
| 移动端下拉类改 Drawer | ✅ 有测试；`responsive={false}` 逃生口也有 |
| 三种无障碍偏好正确降级 | 🟡 reduced-motion 走 spring 预设、contrast 走 token，但**这三条没给 DropdownMenu 单独写测试**（Popover / Sheet 那两套覆盖了同一条材质路径） |
| WCAG AA 对比度检查通过 | ✅ 高亮项标签 17.94:1（条纹同值）—— 与 Tabs 同理，不需要补底色 |
| registry item + 干净工程冒烟 | ✅ 已加进冒烟工作流 |
| 文档页 Preview/Code/Fidelity/API | ❌ Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ 含圆角是推定值的完整说明 |
| Playwright 视觉回归快照 | ⚠️ 12 张，只有 win32 基线 |

### 未过的项

- 🔴 **文档页未做** —— Phase 6
- 🔴 **移动路径没有 typeahead** —— 见上，已写成测试钉住
- 🔴 **CheckboxItem / RadioItem / Sub（子菜单）/ Shortcut 未交付** ——
  shadcn 的 DropdownMenu 有这些槽位，本批只做了 Root / Trigger / Content /
  Item / Separator / Label / Group。
- 🟡 **面板圆角仍是推定值 22**（拟合不收敛，见 §0.49）
- 🟡 **材质档位只录了默认档**；三种无障碍偏好没给本组件单独写测试
- 🟡 **视觉快照只有 win32 基线**

### 测试增量

| 文件 | 数量 | 进 CI |
|---|---|---|
| `tests/dropdown-menu.behavior.spec.ts` | 18 | ✅ |
| `scripts/press-legibility.mjs` | 36 → **40** 个测点 | ✅ |
| `tests/dropdown-menu.visual.spec.ts` | 12 张 | ❌ 平台相关 |

本机全绿：typecheck ×2 · registry 静态检查 · 派生色漂移 · 探针契约 ·
对比度审计 1512 采样 · 交互态可读性 **40** 测点 · 行为回归 **175** 项 · 视觉 **133** 项。

---

## 0.5 CI 第一次真跑（2026-09-01）—— 抓出 4 个真实故障

仓库此前**没有远程**，两个 workflow 从建好起一次都没执行过。
配上 `github.com/createagle/liquid-glass-shadcn` 后第一次真跑，
连续挂了四轮，每一轮都是真问题，没有一个是配置噪音：

| # | 故障 | 根因 |
|---|---|---|
| 1 | `Multiple versions of pnpm specified` | workflow 写了 `version: 11`，`package.json` 又有 `packageManager` —— action 拒绝在两处指定时继续 |
| 2 | `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` 的 `allowBuilds` 块留着**没填完的占位符**（`set this to true or false`），等于没配。pnpm 11 下这是**失败**不是警告 |
| 3 | registry 生成物漂移 | 多行 CSS 值被塞进 JSON **字符串值内部**，`.gitattributes` 管不了字符串内容里的回车符 → Windows 生成 CRLF、Linux 生成 LF，同源产出两种结果 |
| 4 | 5 个对比度测点未达 AA | **本机的数字是乐观的**，见下 |

### 最有价值的一条：本机测不出真实的最坏情况

本机（Windows，有 GPU）最差组合一直是 `tiera/white`；
Linux CI（headless，软件光栅）却是 `tierb/checker`，同一测点 4.57 → 4.01。

tier 是无关变量（Tier B 的 base 层与 Tier A 完全相同），真正的驱动是
**高频棋盘格 + 平台**：软件光栅下 `blur()` 没把棋盘抹平那么多，
背景亮度跨度更大。

**CI 那个才是要认的数** —— 没有 GPU 加速的真实用户会遇到同样的渲染。
据此把 `AA_TARGET_WITH_MARGIN` 从 4.6 重新标定到 **5.6**（实测/理论 ≈ 0.82）。

⚠️ 这个值是**实测标定**的，不是推导的。纯 alpha 合成模型没有涵盖
inset 描边高光与平台 blur 差异。**改动模型 / 描边 / 档位表之后必须让 CI
重跑一遍重新标定，本机数据不能作为依据。**

连带查出一个真 bug：`worstBaseUnderFloor()` 用的是未加余量的地板常量，
运行时用的却是加了余量的版本。用错会高估最不利底座亮度 ——
提余量后暗色 9 个系统色一度全部塌成纯白且仍达不到目标。

### 现状

| | 值 |
|---|---|
| 底座地板 | light **0.734** / dark **0.696** |
| 内容层 ultrathin | 0.52 / 0.67 |
| CI 上 14 个测点 | **全部达标**，最紧 `elevated/secondary` 5.23:1 |
| 两个 workflow | ✅ 全绿 |

**教训：没跑过的 CI 等于没有 CI。** 这四个故障任何一个都不会在本机暴露。

### 🟡 CI 偶发：已加固，7 次连续通过，但根因仍未证实

全绿之后，一个**只改文档**的提交上审计红了一次，重跑即通过 —— 非确定性。

失败时：`dark / 档位 0.34 / Tier b / mid`，背后像素 `rgb(111,111,112)`。

**一个能排除一半可能的硬约束：** 若渲染用的 alpha 真是设定的 0.696，
反解所需的背景值是 **319**，超出 0–255 —— 也就是说**任何背景都产生不出
那个像素**，只能是渲染时的 alpha 不对（反推约 0.155）。

#### 被证伪的假说

「截到了 `background-color 240ms` 过渡的中间态」。
故意注入 10 秒过渡后守卫没触发、数字也没变 —— 夹具在内联 script 里设变量，
发生在**首次绘制之前**，元素根本没有「旧值」可过渡。

#### 复现尝试（全部失败）

只跑那一个组合，4 种渲染配置 × 4 次：
默认 / `--disable-gpu` / SwiftShader 软件光栅 / `--single-process`，
结果无一例外都是 `rgb(53 53 56)`，与模型完全一致。

#### 现在的处置

1. **连拍稳定截图** —— 连拍两张一致才采信，最多重试 5 次，5 次都不稳定则显式报错。
   针对「撕裂 / 尚未完成合成的帧」，这是排除其他可能后最合理的解释。
2. **失败时记录夹具计算值** —— 下次再红时一条日志就能定方向：
   - 夹具计算值 = 0.696 但像素对不上 → 渲染/截图问题
   - 夹具计算值本身就不对 → CSS/JS 问题
3. 关掉夹具的 transition/animation + 静止态守卫（无害加固，非针对性修复）。

#### 证据强度（不要高估）

加固后 **7 次连续通过**（1 次 push + 6 次重跑同一提交）。
但原始故障只观察到 **1 次**，基础故障率未知 —— 7 次通过与
「故障率本来就低于 1/7」并不矛盾。**这是一致的证据，不是证明。**

暂时可以把审计当闸门用，但**再红一次就要先看夹具计算值**，
不要默认它是偶发。
---

## 0.6 `pnpm dev` 从写下起就是坏的（2026-09-01）

根 `dev` 脚本是 `pnpm --filter www dev`，而 **apps/www 没有 `dev` 脚本** ——
文档站是 Phase 6，还没开始建。所以这条命令一直报
`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`，只是此前没人跑过，也就没暴露。

**没有去补一个 Next.js dev server**（那是 Phase 6 的活）。现在能看的东西是
`apps/www/dev/` 下的几个验证台，于是让 `dev` 伺服它们：
新增 `scripts/serve-dev.mjs`，`/` 给一个带说明的入口列表。

两个要点：

- **服务根必须是仓库根**而不是 `apps/www` —— 验证台引用了
  `../../../packages/glass-core/src/tokens/theme.css`。
- `dev` 先跑 `dev:css` + `dev:build` 再起服务。**这一步不是可选的**：
  验证台的 `.js` 与 `tailwind.css` 都是产物且不入库，忘了重跑就会对着上一次的
  结果做判断（这个坑在 §0.2 和 §0.45 各踩过一次）。

写这个文件时还把一个未定义的变量留在请求处理器里，**整个进程直接退出** ——
表现成 `preview_start` 报成功、浏览器却还显示着上个进程的缓存页面。
现在处理器包了 `try/catch`，这类错误报 500，服务继续活着。

Phase 6 真正建起文档站之后，`dev` 应当改回指向 Next.js，`serve-dev.mjs` 可以删掉。

---

## 1. 补做：WCAG AA 对比度自动检查（PROJECT_SPEC §13）

### 1.1 做法

`scripts/contrast-audit.mjs` + `packages/glass-core/debug/contrast-fixture.html`。

**真的去截图、真的读像素**，不是按 CSS 变量算。理由：玻璃的有效背景是
`backdrop-filter: blur() saturate()` 把半透明底座合成到任意内容上的结果，
光看变量算不出人眼实际看到的那个颜色 —— SPEC 原文也明确要求「对截图做采样检测」。

拿「文字背后的颜色」的办法是渲染两次：

1. 正常渲染 → `getComputedStyle` 拿文字颜色（**含 alpha**）与包围盒
2. 把待测文字 `visibility:hidden`（保留布局）后截图
   → 包围盒范围内的像素就是文字背后的真实合成结果

再把文字色合成到每个背景像素上，逐像素算对比度，**取最差的那个像素**
—— 这就是 SPEC 说的「最不利背景」的落地。标签色多数带 alpha
（如 `rgb(235 235 245 / 0.6)`），不做合成会显著高估对比度。

覆盖面：**2 主题 × 3 档位 × 3 Tier × 6 背景 = 108 个组合 × 14 个测点 = 1512 次采样**。
背景集合刻意包含两个极端（纯黑 / 纯白）——
亮色主题文字是黑的，暗背景最不利；暗色主题文字是白的，亮背景最不利。
另加高频棋盘（模糊也抹不平）与高饱和渐变。

PNG 解码是自己写的（`scripts/lib/png.mjs`，约 100 行），不引 sharp / pngjs：
这脚本要在 CI 跑，多一个原生依赖就多一份装不上的风险，而我们只需要
「8 位、非隔行」这一种情况。

### 1.2 结果：查出一类真实违规 🔴

> ⏱️ **本节是历史记录（修复前的状态）。** 当前结果见 §0：11 项已降到 2 项。
> 本节末尾把根因判为「元素级明暗自适应未实现」，
> **这个判断后来被 §0 的实测推翻** —— 真正的解法是自适应**不透明度**，
> 不是自适应文字颜色。保留原文以便追溯推理过程。

**11 / 14 个测点在「暗色主题 + 亮背景」下达不到 AA。** 最差的几个：

| 测点 | 对比度 | 阈值 | 最差组合 |
|---|---|---|---|
| `base-inline/secondary` | **1.00** | 4.5 | dark / 白背景 |
| `base/tint-red` | **1.00** | 4.5 | dark / photo |
| `base/tint-blue` | 1.13 | 4.5 | dark / 白背景 |
| `base/secondary` | 1.21 | 4.5 | dark / 白背景 |
| `base/primary` | 1.62 | 4.5 | dark / 白背景 |
| `indicator/primary` | 2.52 | 4.5 | dark / 白背景 |
| `content-ultrathin/primary` | 3.32 | 4.5 | dark / 白背景 |

已截图人工复核，**不是工具误报**：暗色主题下底座是 `rgb(20 20 24)` @ alpha 0.22，
压在白背景上合成出来是浅灰（约 rgb 203），白字压上去几乎不可读，
次级标签基本隐形。

**根因就是 Phase 0 记下的头号缺口：元素级明暗自适应未实现。**
Apple 的玻璃会按背后内容自动在亮/暗外观间切换，文字随之反色
（`apple-liquid-glass.md` §5）；我们只有全局主题。
这个缺口以前只是文字描述，现在**有了硬数字**。

顺带说明：Apple 对 `clear` 变体给过官方缓解手段 —— 亮背景下加黑色 35% 调暗层
（`apple-metrics.md` §2，标注为 `[官方]`）。我算过，单靠它把 1.62 抬到约 3.7，
仍不足 4.5，所以**没有半吊子地加上去**。真正的解法还是元素级自适应。

### 1.3 CI 怎么接：棘轮基线

不能让 CI 永远红着被忽略，也不能悄悄放宽阈值。用棘轮：

- **已达 AA 的测点** → 按 AA 卡死，之后再也不许掉下去
- **未达 AA 的测点** → 按当前实测值卡死，只许变好，变差就 fail

基线在 `scripts/contrast-baseline.json`，**是「不许更糟」，不是豁免**。

已实测验证这道闸门真的有效，不是摆设：故意把 `--lg-label-primary` 改成中灰后

```
content-regular/primary  对比度 1.75:1 < 4.5:1（基线 8.98，曾达 AA，现在掉了）
content-thick/primary    对比度 2.48:1 < 4.5:1（基线 14.52，曾达 AA，现在掉了）
→ 退出码 1
```

还原后退出码回到 0。

`.github/workflows/contrast.yml` 每次 PR 跑。修好某个测点后需要人工执行
`--update-baseline` 并提交，避免 CI 自动收紧或放宽掩盖真实变化。

### 1.4 已知局限

| 局限 | 说明 |
|---|---|
| 只测夹具，不测真实组件 | 组件还没有（Phase 3 未开始）。夹具覆盖了 base / indicator / elevated / 四档内容层 / 着色标签，等组件出来要把它们接进去 |
| 取最差单像素，可能偏严 | 边缘抗锯齿或 inset 高光可能贡献极端像素。目前**故意保持严格**，宁可误报也不漏报；若发现确实噪声主导，再改成低分位数并说明理由 |
| 未覆盖 hover / focus / pressed 态 | 交互态的材质会变强，需要单独测点 |
| 未覆盖 `prefers-contrast: more` | 该档位下描边与标签色都会变，应当单独跑一轮 |

---

## 2. Phase 5 验收自查（Registry 分发）

> 注意：Phase 3 尚未开始，**目前没有 UI 组件可接入**。
> 本阶段做的是把**已完成的东西**（token 体系 + Provider + cn 工具）接入 registry，
> 并把整条分发管线真正打通、跑通验证 —— 等 P0 组件出来直接往里加 item 即可。

### 2.1 任务卡要求的 6 项

| # | 要求 | 结论 |
|---|---|---|
| 1 | 写 registry.json，组件多就用 `include` 拆文件 | ✅ 根 `apps/www/registry.json` + `include` 指向 `registry/glass/registry.json`。校验：**2 个文件 3 个 item** |
| 2 | 每个 item 配好 files / dependencies / registryDependencies / cssVars / css | ✅ 全部配齐并实测生效，详见 §2.3 |
| 3 | 单独的 `registry:theme` item | ✅ `theme`，**由脚本从 CSS 源单向生成**（见下） |
| 4 | 跑通 build，产物落 `apps/www/public/r/` | ✅ `theme.json` / `utils.json` / `glass-providers.json` / `registry.json` |
| 5 | 干净 Next.js 工程实测两种安装 | ✅ **两种都实测通过**，见 §2.2 |
| 6 | 写成 CI job | ⚠️ **已写但从未运行过** —— 仓库已 `git init` 并完成初始提交，但**没有远程**，workflow 无法触发。见 §2.5 |

**theme item 是生成的，不是手写的。** `apps/www/scripts/generate-theme-item.mjs`
从 `packages/glass-core/src/tokens/*.css` 解析：

```
:root { … }                            → cssVars.light   （146 项）
:root[data-glass-theme='dark'], .dark  → cssVars.dark     （75 项）
@theme inline { … }                    → cssVars.theme    （50 项）
其余规则                                → css @layer base 2 条 / @layer components 27 条
```

手写一份 JSON 必然与 CSS 漂移，而且漂移了不会报错 —— 用户装到项目里拿到旧值也没人知道。
CI 里加了一步 `git status --porcelain` 断言，生成物与源不同步就直接 fail。

### 2.2 两种安装方式的实测结果

环境：`create-next-app@latest`（Next.js 16.3.3）+ `shadcn init -d`，全新工程，**未手动补任何 CSS**。

| 方式 | 命令 | 结果 |
|---|---|---|
| 直链 | `shadcn add http://localhost:4180/r/utils.json` | ✅ 文件按我们的内容原样落地 |
| 命名空间（主推） | `components.json` 配 `@glass` → `shadcn add @glass/glass-providers` | ✅ 传递解析出 `@glass/theme`，注入 CSS + 落地组件 |

安装后目标工程的验证：

- `globals.css` 从 shadcn init 的原始体积涨到 **644 行**，
  `--lg-refract-2` / `--lg-label-primary` / `--lg-material-base` / `--lg-content-thick` 等
  token 与 **22 处 `.lg-surface` 渲染路径**全部注入
- `npm run build` **通过**（含 TypeScript 检查）
- 运行时实测：`tier = a`（检测 + 运行时探针都生效）、`refractionEnabled = true`、
  `concentricRadius(26,7) = 19`
- **shadcn 官方 Button 的 default 变体渲染成 iOS 蓝**（`#0A84FF`）而不是 shadcn 默认的近黑色
  —— 这证明 Layer 3 真的在驱动第三方组件
- 材质档位切换端到端生效：点「档位 solid」后 `--lg-base-alpha` 从 `0.4436` → `0.94`，
  `data-glass-tint-step` → `solid`，并写入 localStorage

### 2.3 这一步抓到的三个问题

**A. 🔴 `registryDependencies` 里的裸名会解析到 shadcn 自己的 registry**

`"registryDependencies": ["theme"]` 安装时报：

```
The item at https://ui.shadcn.com/r/styles/base-nova/theme.json was not found.
```

裸名是 shadcn 官方 registry 的保留空间。要引用**本库**的 item 必须写命名空间形式
`"@glass/theme"`。改完立刻通过。

→ 副作用：这意味着**消费方必须配好 `@glass` 命名空间**，纯直链安装带
`registryDependencies` 的 item 会失败。SPEC §11.2 本来就把命名空间列为主推方式，
但文档里要写清楚这是**硬性前提**，不是可选项。

**B. 🔴 SSR hydration 不匹配（React #418）**

冒烟工程一跑起来控制台就报 React #418。根因在 `GlassProvider`：
首次渲染时读了 `localStorage`、做了 tier 检测、看了 `prefers-color-scheme` ——
这三样服务端都拿不到，于是首帧客户端与服务端产出不一致。

修法（已实现）：**首帧一律用服务端也能算出的值**（不读存储、tier 先当 `'c'`、
theme 用 `defaultTheme`），真实值放到挂载后的 effect 里补。
这不会造成可见闪烁 —— `glassSsrScript()` 已经在首次绘制前把属性写到 `<html>` 上，
CSS 从第一帧就是对的；React state 只是随后追上来供 JS 分支使用。

**「内联脚本负责首屏，React 负责挂载后」** —— 这个分工现在写进注释了。
修复后控制台**完全干净**，且渲染结果不变。

> PROJECT_SPEC §9 早就点名要求「避免 SSR hydration mismatch」，
> 但它是针对 ResponsiveOverlay 说的。实际上 Provider 才是第一个踩雷的地方。

**C. 🟡 shadcn 会把不认识的 cssVars 自动塞进 `@theme inline`**

我们的 `cssVars.light` 有 146 项（大量 `--lg-*` 原始值）。
shadcn 合并时会给每一项在 `@theme inline` 里补一条映射，于是产生了
**90 条自引用**如 `--lg-ring: var(--lg-ring)`。

实测**不影响渲染**（后面的 `:root` 声明会覆盖它们，页面表现完全正确），
但产出的 `globals.css` 很脏。属于已知瑕疵，未修复。
可能的改法是只把 Layer 3 放 cssVars、Layer 1/2 走 `css` 字段，
但那样用户就改不动底层 token 了 —— 是个需要权衡的设计决策，留给 Phase 6 再定。

### 2.4 `@glass/core` 还没发布到 npm

theme item 声明了 `dependencies: ["@glass/core"]`，`shadcn add` 会真的执行
`npm install @glass/core` → 404，安装在依赖这一步就中止，**CSS 一行都不会写**。

为了让冒烟测试覆盖**真实的依赖安装路径**而不是绕过它，写了
`scripts/npm-registry-shim.mjs`：`npm pack` 出 tarball，起一个最小 npm registry
只服务这一个包，消费端用 `.npmrc` 的 `@glass:registry=` 指过去。
包元数据直接从 tarball 里的 `package.json` 读，不手写（纯 Node 解包，不外调 `tar`
—— Windows 上 GNU tar 会把 `C:\…` 当远程主机）。

**@glass/core 正式发布后这个脚本可以删掉。**

### 2.5 未达成 / 已知缺口

| 缺口 | 严重度 |
|---|---|
| **CI job 写了但从未运行过** —— 已有本地 git 仓库，但没有远程，workflow 无法触发。验收要求的「CI job 存在并通过」只做到了「存在」 | 🔴 高 |
| `@glass/core` 未发布 npm，真实用户现在装不了 | 🔴 高 |
| 目前只有 3 个 item（theme / utils / glass-providers），**没有 UI 组件** —— 等 Phase 3 | 🟡 中（阶段顺序使然） |
| `@theme inline` 里的 90 条自引用噪音（§1.3 C） | 🟡 中 |
| 冒烟测试只覆盖 npm，未测 pnpm / yarn 消费方 | 🟢 低 |
| registry 的 `homepage` 还是占位域名 | 🟢 低 |

---

## 3. Phase 2 验收自查（Token 体系）

### 3.1 任务卡要求的 6 项

| # | 要求 | 结论 |
|---|---|---|
| 1 | 三层 token 全量定义，light / dark 各自独立完整一套 | ✅ **超额完成**：`primitive.css` / `semantic.css` / `shadcn.css`，并做了 **4 套**（light · dark · light+高对比 · dark+高对比），依据是 Apple 要求「每个变体都要再提供 increased-contrast 选项」 |
| 2 | Layer 3 覆盖 shadcn 全部 token 名（**去官网核对，别凭记忆**） | ✅ **通过 33 / 33**。核对发现两处与旧认知不同，见 §2.3 |
| 3 | 材质档位 0..1 连续插值 → 4 个语义档，只影响 Layer B | ✅ **通过**，8 宫格已验证四档递进正确，指示器折射不随档位变化 |
| 4 | localStorage 持久化 + SSR 内联脚本防闪烁 | ⚠️ **部分通过**：`ssr-script.ts` 已实现且主题 / 档位 / tier 共用一套机制，**但没有真实 SSR 环境验证过**（还没有 Next.js 应用）。「无暗色闪烁」这条验收**未验证** |
| 5 | squircle 方案 + `concentricRadius()` | ✅ **通过** `shape/concentric.ts`。squircle 走原生 `corner-shape`，速查页上与普通圆角并排对比可见差异 |
| 6 | token 速查页 + 8 宫格材质表 | ✅ **通过** `debug/tokens.html`：全色板 + 8 宫格 + 内容层材质 + 圆角 + 同心圆角算例 + shadcn 覆盖核对表 |

### 3.2 自查项：第三方 shadcn 组件

✅ **通过，而且抓到了一个真 bug。**

做法不是「肉眼看着像」：`debug/shadcn-compat/` 里的 class 字符串是用
`npx shadcn@latest view @shadcn/button @shadcn/card @shadcn/dialog`
从官方 registry 取的**真实源码**，一字未改；再用**真实的 Tailwind v4.3.3** 编译我们的 token 层。
明暗两栏并排，button 全部 variant / card / dialog / chart / sidebar / ring 均正常渲染。

复现：
```bash
cd packages/glass-core && npm run compat:build
# 然后用浏览器打开 debug/shadcn-compat/index.html
```

### 3.3 这一步抓到的两类问题

**A. 🔴 CSS 自定义属性的 `var()` 在「声明处」求值 —— 别名层必须每个主题块重写一遍**

第一次跑验证页，暗色栏几乎全黑不可读。原因不是配色，是分层写法本身错了：

```css
:root { --foreground: var(--lg-label-primary); }   /* 用 root 的黑色算定了 */
.dark { --lg-label-primary: white; }               /* 这里改了没用 */
```

`--foreground` 在 `:root` 上就已经把 `var()` 求值成黑色，后代继承到的是**算好的黑色**，
不会因为进了 `.dark` 上下文而重算。shadcn 官方模板不会踩到，是因为它在两个块里都写
**字面量**颜色，没有 var 间接层。

本库既然要做「Layer 3 别名映射 Layer 2」，就必须付这个代价：**别名层要在每个主题块里完整重写。**
同一个坑还影响了 `--lg-material-base` / `--lg-material-elevated` / `--lg-ring`（dark 下不更新），
以及高对比下的 `--lg-stroke-*`（不会变强）。四处已全部修复并在文件里写明原因。

> 这条值得单独记下来：它是**静默失效**，CSS 不报错，只有并排对比才看得出来。
> 后续任何「A 层引用 B 层变量」的新 token，都要检查是否在所有主题块里重写过。

**B. 🟡 shadcn 的 `dark:` 变体需要 `@custom-variant`**

shadcn 组件里大量使用 `dark:bg-input/30` 这类工具类。它们依赖
`@custom-variant dark (&:is(.dark *));` 才会挂到 `.dark` 祖先类上。
不写这条，第三方组件的 `dark:*` 会退回 Tailwind 默认的 `prefers-color-scheme`，
与本库的 class 策略脱节。已加进 `shadcn.css`。

### 3.4 核对 shadcn token 清单时的两处发现

1. **`--destructive-foreground` 已不存在。** 当前 button 的 destructive 变体写的是
   `bg-destructive text-white`，不再引用配对的 foreground。
   本库仍然定义它（兼容还在引用的第三方组件），但标注为兼容性保留。
2. `@theme inline` 的圆角阶梯是 **sm / md / lg / xl / 2xl / 3xl / 4xl 七档**，不是四档。

—— 这两条正是任务卡强调「别凭记忆」的原因。

### 3.5 未达成 / 已知缺口

| 缺口 | 严重度 |
|---|---|
| 「无暗色闪烁」未验证 —— 没有真实 SSR 环境，`ssr-script.ts` 只是逻辑正确 | 🟡 中，Phase 6 建文档站时补 |
| 内容层 4 档标准材质的 alpha 取值是 `[推定]`，没有 iOS 参考 | 🟡 中 |
| ~~WCAG AA 对比度自动检查脚本尚未写~~ | ✅ **已补做**，见 §2 |
| `pnpm exec` 在本机因构建脚本告警失败，需用 `npm run` 或直接调二进制 | 🟢 低，已在脚本里绕开 |

### 3.6 构建状态

```
tsc --noEmit                 ✅
tsc → dist/                  ✅
esbuild 调试包               ✅
tailwindcss v4.3.3 编译      ✅ 38KB，--primary: var(--lg-blue)、.dark 变体均正确产出
shadcn token 覆盖            ✅ 33 / 33
```

---

## 4. Phase 1 验收自查（光学引擎 `@glass/core`）

### 4.1 任务卡要求的 6 项产出

| # | 产出 | 结论 |
|---|---|---|
| 1 | 位移贴图生成器 + 滤镜工厂（尺寸缓存 / 全局单例 defs / ResizeObserver） | ✅ **通过** `filter/displacement-map.ts`、`filter/filter-factory.ts`、`filter/use-glass-filter.ts`。缓存 key = `w×h×radius×borderWidth×...`，引用计数管理生命周期，尺寸量化到 2px 避免抖动重建 |
| 2 | 三级 tier 检测（特性检测优先，UA 兜底），写 `<html data-glass-tier>` | ✅ **通过** `tiers/detect.ts`。**额外加了运行时像素探针**（见 §4.4） |
| 3 | `<GlassProvider>`：主题 / 材质档位 0..1 连续 / tier 覆写 / 无障碍偏好订阅 | ✅ **通过** `provider/`。偏好一律走 `useSyncExternalStore`；档位在 4 个语义档之间线性插值且**只影响 Layer B** |
| 4 | `<GlassSurface layer="base｜indicator｜elevated">` | ✅ **通过** `surface/glass-surface.tsx` |
| 5 | `springs` 预设（smooth / snappy / bouncy） | ✅ **通过** `motion/springs.ts`，另附 `reducedMotionTransition` |
| 6 | 纯 HTML 调试页（不依赖 Next.js），全部滤镜参数为滑杆 | ⚠️ **部分通过** `packages/glass-core/debug/index.html`，零 React 依赖，14 个参数全部可拖拽 + tier / 主题 / 档位 / 背景切换 + 贴图预览 + 参数导出。**但背景不是「一张高对比度的彩色照片」，是程序生成的多层渐变**（我没有可用的图片素材） |

### 4.2 视觉标定

⚠️ **部分通过。** 三个特征（透镜畸变 / 色散彩边 / 镜面高光）在 Chromium 上**都肉眼明确可见**，
参数已固化为 `--lg-refract-*` / `--lg-disperse-*` 的默认值。

**但任务卡要求的「用 iOS 截图作为基准」没有做到** —— 没有参考图，
实际标定目标退化成「三个特征清晰可见」而不是「与 iOS 一致」。
标定表见 `optics-web.md` §3.7。

### 4.3 任务卡的四条验收

| 验收项 | 结论 |
|---|---|
| 调试页在 Chrome 下能看到明确的色散彩边和背景畸变 | ✅ **通过**（独立指示器上非常明显） |
| Safari（Tier B）下看起来仍然是完整设计 | ❌ **未验证** —— 无 Safari 环境。只在 Chromium 上**强制切到 Tier B** 看过，观感是完整设计 |
| Firefox（Tier C）下结构与可读性完全正确 | ❌ **未验证** —— 无 Firefox 环境。同上，强制切档观感正确 |
| 三个 tier 可手动强制切换 | ✅ **通过** |

### 4.4 我做了但任务卡没要求的事

1. **Tier A 的运行时像素探针**（`probeFeImage`）。理由：Phase 0 的教训是
   `CSS.supports` 返回 true 但滤镜静默无输出。只靠特性检测会把这类浏览器误判为 Tier A。
   探针结果缓存到 `sessionStorage`。
   ⚠️ 已知局限：它验证的是 **SVG 光栅化路径**的 feImage，与 `backdrop-filter` 合成路径
   不完全等价（后者无法从 JS 读回像素）。真正的护栏是按正确写法构造滤镜。
2. **`data-refraction="off"` 降级样式**：折射未就绪或超过性能红线时，
   指示器借用 Tier B 的处理，而不是变成一块空白。
3. **squircle 用原生 `corner-shape`**（质疑 #3 的落地）。
4. `optics.css` 里 light / dark **各自独立完整定义**了折射/色散缩放、高光强度、
   落影 vs 外发光 —— 对应 PROJECT_SPEC §7 的明暗差异表，不是简单反色。

### 4.5 未达成 / 已知缺口

| 缺口 | 严重度 |
|---|---|
| **嵌套指示器的模糊叠加**：独立 knob 折射极好，但嵌在磨砂底座内的选中块效果被明显削弱。CSS 无纯声明式解法，需「底座挖洞」。详见 `optics-web.md` §3.8 | 🔴 高 —— Tabs/Segmented 是本库门面，建议 Phase 3 一并解决 |
| Safari / Firefox 未真机验证 | 🟡 中 |
| 视觉标定无 iOS 基准 | 🟡 中 |
| 调试页背景是程序生成渐变，不是真实照片 | 🟢 低 |
| 性能红线 8 仍是 SPEC 的 `[推定]` 值，未用掉帧数据替换 | 🟢 低 |
| 未写单元测试（Vitest 尚未接入） | 🟡 中 |

### 4.6 构建状态

```
pnpm install            ✅（8 个包）
tsc --noEmit            ✅ 无错误（strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes）
tsc 构建 → dist/        ✅
esbuild 调试包 11.4kb   ✅
```

---

## 5. Phase 0 验收自查


PROJECT_SPEC / 任务卡要求的验收项，逐条对照：

| 验收项 | 结论 | 说明 |
|---|---|---|
| 四份笔记存在 | ✅ **通过** | `apple-liquid-glass.md` / `apple-metrics.md` / `optics-web.md` / `shadcn-registry.md` |
| 组件清单存在并分层 | ✅ **通过** | `component-inventory.md`，64 个全覆盖，逐个标了 Apple 对应物与分层 |
| `apple-liquid-glass.md` 每条结论标来源 URL | ✅ **通过** | |
| `apple-metrics.md` 数值都带可信度标注 | ⚠️ **部分通过（2026-08-31 显著改善）** | 标注做了，并新增 `[待核实]` 一档。**已有 `[实测]` 数据**：经 Figma MCP 读取 iOS/iPadOS 27 设计文件，量出 Tab Bar / Switch / Slider / Sheet / Alert / Menu 尺寸（`apple-metrics.md` §7）。**仍缺**：字号表、Button / Popover / Stepper 尺寸、全部光学参数 |
| `optics-web.md` 三级降级 + 各浏览器实测 | ⚠️ **部分通过** | Chromium 148 + Chrome 151 两个环境实测，折射根因已定位（§3.6）。**Safari / Firefox 一次都没跑过** |
| `screenshots/` 存放比对用 iOS 参考截图 | ⚠️ **部分通过** | 已存入 Figma 官方渲染图 `ios27-tabbar.png` / `ios27-sliders.png`。**但这不是真机截图** —— Figma 里的玻璃是静态近似，不能用于光学标定 |
| 向你汇报 (a)(b)(c) | ✅ **通过** | (a) 见 §6，(b) 见 §7，(c) 见 `component-inventory.md` |

**结论：Phase 0 仍不算完成，但阻塞面积缩小了一半。**

2026-08-31 你提供了 iOS/iPadOS 27 的 Figma 设计文件，**「尺寸」这一半的阻塞已解除**：

- ✅ 拿到 6 类控件的 pt 级实测尺寸（示例帧 402×874 即 iPhone 16 Pro 逻辑尺寸，无需换算）
- ✅ **独立验证了同心圆角公式**：Tab Bar 外半径 31 − 内缩 4 = 内半径 27，与 `concentricRadius()` 输出一致
- ✅ **查出 PROJECT_SPEC 一处实锤错误**：UISwitch 不是 51×31 / 圆形 knob 27，而是 **64×28 / 胶囊 knob 38×24**
- ✅ 交叉印证：Switch 与 Slider 的 knob 同为 **38×24 pt**，说明 iOS 27 有统一 Knob 组件

**「光学」这一半仍然阻塞**（原阻塞项 #1 的剩余部分）：
Figma 里的玻璃是静态近似（材质组件分解为 `Fill + Shadow` + `Glass Effect` 两层位图效果），
**不含折射与色散数据**。`--lg-refract-*` / `--lg-disperse-*` 至今仍是我调出来的、
没有基准的值。要标定仍需 **iOS 真机截图**（玻璃压在复杂背景上，明暗各一）。

**两个新的待澄清前提**（未澄清前 `apple-metrics.md` §7 不得升格为 `[官方]`）：

1. 该文件是 **iOS 27**，PROJECT_SPEC 基准是 **iOS 26**，尺寸可能已变
2. 文件标题带 "(Community)"，**发布者是否为 Apple 未经验证**

次要缺口：Safari / Firefox 无环境可测（阻塞项 #4）。

> 原先列为头号阻塞的「feImage 不可用」**已查明是写法问题并修复**，Tier A 架构成立，
> Phase 1 可以开工。见质疑 #2 与 `optics-web.md` §3.6。

---

## 6. (a) 从 Apple 文档读到、但 PROJECT_SPEC 没提到的重要约束

按重要性排序。完整原文与出处见 `apple-liquid-glass.md`。

1. **元素级明暗自适应。** toolbar / tab bar 会根据背后内容在亮/暗外观间自动切换，
   其上的符号文字随之反色。这与 SPEC §7 的全局 `.dark` 是两套正交机制。
   Web 端没有现成 API —— **这是能否「像 iOS」的关键，也是最大的实现风险。**（`optics-web.md` §6）
2. **玻璃有「前景效果」，不只是 backdrop。** `glassEffect` 文档明说它做两件事：
   在视图后面画材质形状，**并在视图之上施加前景效果**。SPEC 只处理了 backdrop 那一半。
3. **内容层有独立的 4 档标准材质**（ultraThin / thin / regular / thick）。
   SPEC 说内容组件「用不透明或极弱材质」，方向对但太粗 —— 应当给内容层一套并列的 token。
4. **Slider / Switch 的 knob 是「瞬时玻璃」**，静止态不该常驻玻璃感，
   与 tab bar 选中胶囊不是同一类。SPEC 的分层速查表把两者混在一起了。
5. **clear 变体有官方数值**：亮背景下加**黑色 35%** 调暗层。这是全篇唯一的官方材质数值。
6. **玻璃默认无色**，颜色来自背后内容；着色只给主行动，且「不要给多个控件的背景都着色」。
7. **`glassEffectUnion`** —— 静止态就把多个形状合并成一体（toolbar 分组共享背景的机制）。
   我们的 `<GlassContainer>` 需要 **blend / union / morph 三种**模式，SPEC 只设计了两种。
8. **同心圆角远离容器角时半径应归零**，且有 `concentric(minimum:)`。
   SPEC 的 `parentRadius − inset` 只是特例。
9. **高对比度是独立维度**：官方要求 light/dark **各自**再提供 increased-contrast 变体
   → token 是 **4 套**不是 2 套。
10. **滚动边缘效果的作用对象是「背后的内容」**（模糊 + 降不透明度），
    不是 SPEC 说的「栏自身增加不透明度」。
11. **Action sheet 改为从触发元素弹出**，不再从屏幕底边 —— 见 §3 质疑 #1。
12. 杂项：控件新增 extra-large 尺寸；section header 不再全大写；
    列表行高/圆角变大；`backgroundExtensionEffect()`；tab bar 可随滚动最小化；
    `UIDesignRequiresCompatibility` 逃生开关。

---

## 7. (b) 我认为 PROJECT_SPEC 判断有误或有风险的地方

任务卡要求「直说，不要附和」。以下按严重程度排序。

### 质疑 #1 —— §9「移动端下拉类一律改底部 Drawer」与 iOS 26 的实际方向相反 ⚪️ 已否决

> **2026-08-31 用户拍板：维持 SPEC 原方案，一律底部 Drawer。本条不再执行，保留仅作记录。**

SPEC 的理由是「对应 iOS 的 action sheet / 底部选择器」。但 iOS 26 恰恰改掉了这个行为：

> "An action sheet **originates from the element that initiates the action, instead of from the bottom edge of the display**. When active, an action sheet also lets people interact with other parts of the interface."

也就是说：**SPEC 把一条已经被 Apple 废弃的 iOS 旧行为，写成了硬性要求。**
而且「让人能继续与界面其他部分交互」与 SPEC 要求的「焦点陷阱 + `aria-modal` + 背景遮罩 + 页面后退缩放」
是直接矛盾的 —— 那是**模态** sheet 的行为，不是 action sheet 的。

**建议**：把 `<ResponsiveOverlay>` 的移动端策略按语义拆开：

- **菜单类**（DropdownMenu / ContextMenu / Menubar）→ 锚定在触发元素、非模态，贴合 iOS 26
- **选择类**（Select / Combobox / DatePicker）→ 底部 Drawer（iOS 的选择器确实仍在底部）
- **纯浮层**（Popover / HoverCard）→ 锚定弹出

这仍然保留了 SPEC 想要的移动端体验，但不会把菜单错误地做成模态抽屉。
**这条需要你拍板**，因为它改动的是 SPEC 的硬性要求。

### 质疑 #2 —— §5.2 的全局 SVG defs 容器写法是错的（会让 Tier A 完全失效）🔴

> **本条已从「架构可能报废」收敛为「一处具体写法要改」。原始排查过程保留在下方。**

PROJECT_SPEC §5.2 原文建议全局 defs 容器写成
`position:fixed; width:0; height:0; pointer-events:none`。

**实测：宿主 `<svg>` 的 `width` / `height` *属性*为 0 时，`feImage` 完全不产出任何内容**，
整个折射链静默失效（不报错，只是没效果）。这正是我最初测出「feImage 不可用」的原因。

**修正**（完整实验矩阵与推荐写法见 `optics-web.md` §3.6）：

1. 容器 `<svg>` 的 **属性**必须非零（`width="10" height="10"` 就够）；
   用 **CSS** `width:0;height:0` 隐藏是安全的 —— 出问题的是属性，不是 CSS 盒子。
2. `feImage` 上**不要用百分比尺寸** —— 百分比按宿主 svg 的视口解析，不是按目标元素。
   要写绝对用户单位，值 = 目标元素实际像素尺寸。

好消息：第 2 条与 SPEC §5.2 已有的「按尺寸生成并缓存滤镜」天然吻合，不增加复杂度。

**Tier A 架构成立，Phase 1 解除阻塞。**

<details>
<summary>原始排查过程（点开）</summary>

### 原：§5 的 Tier A 架构建立在一个我实测失败的技术上 🔴

SPEC §1.3 / §5 把 Tier A 建立在 React Bits `GlassSurface` 的 `feImage` 位移贴图方案上。
**我在 Chromium 148 上实测：`feImage` 产出为空**，无论 href 指向 `data:` URI 还是文档内 `#id`；
同一个滤镜作为普通 `filter:` 使用时，元素直接整个消失（输出为空）。
排除了异步加载时序（预加载确认图片本身能解码）。

同时确认：`backdrop-filter: url(#f)` 本身**是好的**（`feGaussianBlur` 正常），
`feTurbulence` → `feDisplacementMap` 在 `backdrop-filter` 里**也完全正常**。
所以问题被精确隔离在 `feImage` 一个原语上。

**已在 stock Chrome 151 上复测：结果一致（feImage FAIL、turbulence PASS、squircle PASS）。**
所以不是内嵌面板的安全限制。

**但结论尚未定死。** `feImage` 有几个已知的写法陷阱（`xlink:href` 命名空间、
宿主 `<svg>` 尺寸为 0、SVG 图 vs PNG 位图），我最初用的写法可能本身就是错的。
已建 `feimage-matrix.html` 排 6 个变体逐个测，**初步观察到有变体渲染出了内容** ——
极可能是写法问题而非浏览器不支持。**在这 6 个变体判读出来之前，不要动架构。**

**结果：6 个变体中 V5 / V6 出图，定位到宿主 `<svg>` 尺寸属性是唯一变量；
再用 `feimage-fix.html` 的 6 个变体验证修复配方，全部通过。**
备选方案（turbulence 近似 / WebGL 自绘 / 退化为 Tier B）**全部不需要了**。

</details>

### 质疑 #3 —— §6 的 squircle 方案已经过时 🟡

SPEC 要求「用 SVG path 或 `paint()` worklet 生成 squircle 遮罩」。
**实测 Chromium 148 已原生支持 CSS `corner-shape: squircle`**，
`getComputedStyle` 能读回 `"squircle"`，并排对比肉眼差异明显。

→ 两行 CSS + `@supports` 渐进增强即可，**不需要 SVG path，也不需要 Houdini**。
这能为 Phase 2 省掉一整块复杂度。建议直接改 SPEC。

### 质疑 #4 —— §5.1 把 Firefox 一律划到 Tier C，很可能是错的 🟡

SPEC 原文：「不支持 `backdrop-filter`（**含 Firefox 默认配置**）」。
Firefox 自 103 起已默认开启 `backdrop-filter`。把它一律打到「半透明纯色、无玻璃感」
会让 Firefox 用户拿到明显低于其实际能力的效果。**Firefox 更可能属于 Tier B。**
（我没有 Firefox 可测，这条是基于发布记录的判断，需实测确认。）

### 质疑 #5 —— 只靠 `CSS.supports` 分 tier 是不够的 🟡

这是质疑 #2 的直接教训：`CSS.supports('backdrop-filter','url(#x)')` 返回 `true`，
但滤镜实际不产出任何东西。**能力检测必须加一道「真的生效了吗」的运行时像素探针**，
否则 Tier A 会把一批实际渲染失败的浏览器判成「完整方案」，用户看到的是纯透明块。

另：**不要用 `-webkit-backdrop-filter` 做检测 key** ——
Chromium 148 对带前缀写法的 `CSS.supports()` 返回 `false`，尽管无前缀完全可用。

### 质疑 #6 —— §11.2 的构建命令跑不起来 🟡

SPEC 规定 `pnpm dlx shadcn@latest build`。**实测崩溃**
（`pnpm dlx` 给 `@modelcontextprotocol/sdk` 装了不兼容的 zod，`ERR_PACKAGE_PATH_NOT_EXPORTED`）。
`npx --yes shadcn@latest` 同机完全正常。

→ 改用 `npx`，或把 shadcn 作为 devDependency 后 `pnpm exec shadcn build`（推荐，可锁版本）。
另外好消息：CLI 自带 `shadcn registry validate`，SPEC 要求的 CI schema 校验不用自己写。

### 质疑 #7 —— §6 声称「已核实」的两组数值，我核不动 🟡

- **iOS 系统色表**：Apple 明确写着
  > "**Avoid hard-coding system color values in your app.** … The actual color values **may fluctuate from release to release**."

  Web 端硬编码是唯一选择，这没问题；但不能标成「已核实，直接用」。
  应标 `[待核实 · 社区通行值]`，并在文档站 Theming 页写明这是近似。
- **UISwitch 51×31pt / knob 27pt**：这是 UIKit 旧版度量。iOS 26 明确说了控件尺寸有变更
  （"Review updates to control appearance and dimensions"、新增 extra-large 尺寸、
  "many controls adopt rounder forms"）。**这个值很可能已经不准。**

### 质疑 #8 —— §5.2「单屏 Tier-A 折射实例 ≤ 8 个」没有依据 🟢

Apple 只定性说了「限制同屏数量」，**没有给任何数字**。
8 这个值是 SPEC 自己的推定。不要在文档里写成 Apple 的建议，
应当在 Phase 1 用实测掉帧数据替换掉它。

### 质疑 #9 —— P0 的工作量被低估 🟢

SPEC 写「P0 11 个」，但实际列了 14 个组件名（Tabs/Segmented、Sheet/Drawer、
Dialog/AlertDialog、Toggle/ToggleGroup 都是合并计数）。
另外 `AlertDialog` 在 P0 和 P3 中重复出现。**排期按 14 个算。**

### 建议 #10 —— `Button Group` 应从 P3 提到 P1 🟢

它对应 Apple 明确讲过的 **toolbar 分组共享背景**机制
（`ToolbarSpacer` + `glassEffectUnion`），是 `<GlassContainer>` union 模式最直接的使用场景。
放在 P3 会导致 union 模式迟迟得不到真实验证。

---

## 8. 阻塞项（需要你决定或提供材料）

| # | 阻塞项 | 影响 | 需要你做什么 |
|---|---|---|---|
| 1 | **没有 iOS 26 参考截图 / Apple Design Resources** | `apple-metrics.md` 大面积空白；P0 的「像素级对齐」与 Fidelity 对照图**做不了** | 提供 iOS 26 真机截图（tab bar / segmented / slider / switch / sheet 各一张），或授权我按 `[推定]` 做并在文档里明示本库是「风格还原」而非「尺寸还原」 |
| ~~2~~ | ~~**`feImage` 到底是不可用，还是我写法不对**~~ | ~~决定 Tier A 的整个架构~~ | ✅ **已解除**：是写法问题，根因与修复配方见 `optics-web.md` §3.6。Tier A 成立 |
| ~~3~~ | ~~**质疑 #1：移动端下拉策略**~~ | ~~改动 SPEC 的硬性要求~~ | ✅ **已决策（2026-08-31，用户拍板）：维持 SPEC §9 原方案，移动端下拉类一律底部 Drawer。** 质疑 #1 不再执行，`<ResponsiveOverlay>` 按 SPEC 原样实现 |
| 4 | **无 Safari / Firefox 环境** | Tier B / C 全是推定 | 提供可测环境，或接受这两档在 Phase 1 只做「实现但未验证」 |

---

## 9. 已完成的产出

```
PROJECT_SPEC.md                     ← 提示词第一部分，逐字提取
CLAUDE.md                           ← 指向 PROJECT_SPEC 的约束文件
LIQUID_GLASS_UI_PROMPT.md           ← 原始提示词（含 Phase 0–7 任务卡，只读）
pnpm-workspace.yaml / package.json / tsconfig.base.json / .gitignore
apps/www/                           ← ✅ Phase 5 registry 分发
  ├── registry.json                 根注册表（include 拆文件）
  ├── registry/glass/
  │     ├── registry.json           ✅ 由脚本从 CSS 源生成的 theme item
  │     └── lib/                    utils.ts · glass-providers.tsx
  ├── public/r/                     ✅ build 产物（4 个 json）
  └── scripts/
        ├── generate-theme-item.mjs 单向生成，CI 断言不漂移
        └── serve-registry.mjs      本地静态服务
.github/workflows/registry-smoke.yml ✅ 冒烟 CI（已写，未运行过）
scripts/npm-registry-shim.mjs        最小 npm registry（@glass/core 发布后可删）
scripts/contrast-audit.mjs           ✅ WCAG AA 对比度审计（截图采样 + 棘轮基线）
scripts/contrast-baseline.json       棘轮基线：不许更糟，非豁免
scripts/lib/png.mjs                  自写 PNG 解码，避免 CI 引原生依赖
packages/glass-core/debug/contrast-fixture.html  审计夹具（含最不利背景集）
.github/workflows/contrast.yml       ✅ 对比度 CI
packages/glass-core/                ← ✅ Phase 1 已实现
  ├── src/filter/                   displacement-map / filter-factory / use-glass-filter
  ├── src/tiers/detect.ts           三级检测 + 运行时探针
  ├── src/provider/                 GlassProvider / preferences / ssr-script
  ├── src/surface/glass-surface.tsx GlassSurface 原语
  ├── src/motion/springs.ts         smooth / snappy / bouncy
  ├── src/shape/concentric.ts       同心圆角 + squircle 能力检测
  ├── src/tokens/                   ✅ Phase 2 三层 token
  │     ├── primitive.css           Layer 1 原始值
  │     ├── semantic.css            Layer 2 材质与角色（4 套：明暗 × 常规/高对比）
  │     ├── shadcn.css              Layer 3 别名映射 + @theme inline（33/33 覆盖）
  │     ├── optics.css              三档渲染路径
  │     └── theme.css               唯一入口
  └── debug/
        ├── index.html              光学调试台（14 个参数滑杆）
        ├── tokens.html             ✅ Token 速查页（含 8 宫格材质表）
        └── shadcn-compat/          ✅ 第三方 shadcn 组件兼容性验证（真实 Tailwind v4 编译）
docs/research/
  ├── apple-liquid-glass.md         ← 材质原理、变体、动效、无障碍，逐条带 URL
  ├── apple-metrics.md              ← 度量表（大面积缺失，已诚实标注）
  ├── optics-web.md                 ← 折射实测、三级降级修订、squircle 结论
  ├── shadcn-registry.md            ← registry 字段全表 + CLI 实测
  ├── component-inventory.md        ← 64 个组件分层 + Apple 对应
  ├── optics-smoketest.html         ← 光学诊断页（3 项，已在 Chrome 151 复测完成）
  ├── feimage-matrix.html           ← feImage 6 变体矩阵（已判读，定位根因）
  ├── feimage-fix.html              ← 修复配方验证（6 变体全通过）
  ├── STATUS.md                     ← 本文件
  └── screenshots/                  ← ⚠️ 空的
```

**尚未写任何 UI 组件** —— Phase 1 / 2 都不产出组件，符合任务卡要求。
`@glass/core` 的光学引擎与 token 体系均已实现，见 §1、§2。

---

## 10. 下一步（2026-09-02 更新）

**Phase 0 / 1 / 2 / 5 已完成；Phase 3 交付 10 / 11；Phase 4 的核心原语已落地。**

| 已交付 | §14 成绩 |
|---|---|
| Tabs / Segmented · Slider · Switch · Button · Dialog | 各 12 项过 10 |
| Toggle | 12 项过 9 |
| Card | 12 项过 9（另 2 项不适用） |
| Sheet / Drawer | 12 项过 9（1 项明确未达标、2 项不适用） |
| Popover | 12 项过 9（2 项不适用 —— Layer I 属于菜单项） |
| DropdownMenu | 12 项过 10 |
| **ResponsiveOverlay**（Phase 4 原语） | 任务卡四条重点全部落地并有测试 |

**P0 只剩 Select 一个。**

### 下一批：Select

结构与 DropdownMenu 高度相似，路已经趟平了：桌面 Radix Select、
移动端 Sheet + 自己接的 `role=listbox`。要多做的是**选中态**——
`role="option"` + `aria-selected`、选中项的对勾、以及「当前值」回填触发器。

DropdownMenu 那批留下的两条债，Select 要么一起还、要么明确同样欠着：
typeahead（移动路径）与三种无障碍偏好的单独测试。

### 长期挂着的三件事

- **发布 `@glass/core` 到 npm** —— 否则真实用户装不了 registry item。
- **在 Linux 环境录一次视觉基线** —— 视觉回归目前只有 win32 基线，CI 里刻意不跑。
- **补一条真正的 SSR 验证** —— 冒烟测试里那个干净 Next 工程目前只跑 `next build`。
  ResponsiveOverlay 的「SSR 首帧走桌面路径、无 hydration mismatch」只有推理没有实测。

### 仍然没有的东西

🔴 **iOS 真机截图。** 几何这边已经推到能推的极限了 —— Tab Bar / Switch / Slider /
Alert / Menu / Button / Grouped List / Sheet 都有实测，而 **Popover 的圆角就是没量出来**
（半透明玻璃压在中灰背景上，轮廓拟合不收敛）。

光学则**始终没有基准**：折射强度、色散偏移、镜面高光、knob 与抓手静止态该白到什么程度，
至今全是 `[推定]`，也是 Tier A 与 Tier B 至今无法真正区分开的原因。
这一批第一次给出了色散的**相对**证据（高亮项内通道差 29 vs 面板 2），
但「29 是不是对的」仍然无从校准。
