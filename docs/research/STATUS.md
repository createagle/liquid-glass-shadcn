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

## 0.52 Phase 3 · Select —— §14 逐条自查（2026-09-02）

**12 项过 10。P0 组件全部交付完毕。**

这一批做出来的东西不多（结构与 DropdownMenu 高度同构），**查出来的东西很多** ——
两个已经上线的真缺陷，都是做 Select 的过程中被逼出来的。

### 缺陷一：挖洞一直偏着一个内边距

DropdownMenu 那一批量到了「高亮项内通道差 29 vs 面板 2」，据此宣布
「Layer I 第一次真的看得见色散」。**那个结论没错，但洞的位置一直是错的。**

洞的坐标是拿 `panelRef.getBoundingClientRect()` 当基准算的，而那个 ref 挂在
**装内容的 div** 上 —— 它在面板 10/16 的内边距**里面**。实测：

| | 项相对面板 | 洞相对面板 |
|---|---|---|
| 修复前 | x 16…234，y 127…167 | x **0…218**，y **117…157** |
| 修复后 | x 16…234，y 127…167 | x 16…234，y 127…167 |

**偏了 (16, 10)。** 为什么一直没被发现：

- 偏了之后洞与项仍有 ~90% 重叠，「条纹清晰度翻倍」照样成立 —— 光学结论是对的；
- 视觉快照的容差是 `maxDiffPixelRatio: 0.01`，而这批快照的背景是**平滑渐变**，
  渐变上折射本来就看不出来，挪 16px 改变不了多少像素；
- 没有任何断言检查过「洞的坐标 = 项的坐标」。

现在有了：`select.behavior.spec.ts` 里那条**逐像素对齐**的断言，
从 DOM 直接比 `clip-path` 解出来的洞与项的 `getBoundingClientRect()`，容差 1px。
这比像素统计强 —— 它是确定性的，能进 CI。

### 缺陷二：入场动画那一帧量到的尺寸，永远不会自愈

Select 一打开，Radix 会**立刻**把当前选中项设成高亮 —— 正好撞在面板
scale 0.94 → 1 的入场动画中间。`GlassSurface` 用 `getBoundingClientRect()`
量自己的尺寸去生成 `clip-path` 的外框，而那个 API 量的是**变换后**的盒子：

    外框量到 238.1 × 209.6，真实布局是 250 × 220

外框短了一截，面板右下角的模糊被裁掉。更麻烦的是 **ResizeObserver 不会因为
transform 变化再触发一次** —— 错了就一直错着，不会自愈。

改成读 `ResizeObserver` 的 `borderBoxSize`（布局尺寸，与 transform 无关，
且是亚像素精度），首帧用 `offsetWidth/Height` 兜底。

两件事一起收进了 `@glass/core` 新导出的 `measurePunch(surface, target, radius)`：
基准取 `.lg-surface` 本体、并用 `offsetWidth` 反解缩放除回去。
DropdownMenu 与 Select 现在共用它。

### 缺陷三：亮色下**所有**浮层面板既没描边也没落影

写「prefers-contrast: more 下描边加强」这条测试时，两次读到的 `box-shadow`
都是 `none`。查下来是 token 的写法问题：

```css
--lg-glow: none;                       /* light：用落影分离层级 */

.lg-surface[data-layer='elevated'] {
  box-shadow: inset …, inset …, var(--lg-shadow), var(--lg-glow);
}
```

`none` 单独用是合法的，**出现在逗号列表里就是无效值** —— 整条声明被丢弃，
`box-shadow` 退回 initial 的 `none`。于是**亮色**下 Dialog / Sheet / Popover /
DropdownMenu / Select 五个 elevated 面板全都没有描边、没有落影；
**暗色**下一切正常（那边 `--lg-glow` 是个真的阴影值）。

改成零尺寸全透明的 `0 0 0 rgb(0 0 0 / 0)`，并在冒烟工作流里加了一道
`--lg-glow` 不许是 `none` 的闸。

> **这里有个更值得记的事实：13 张涉及亮色 elevated 面板的视觉快照，一张都没红。**
> 250×220 的面板上，上下各一条 1px 内描边只占 **0.9%**，正好在
> `maxDiffPixelRatio: 0.01` 的容差之内；落影画在元素框之外，
> 按元素截图根本截不到。
> **快照回归抓不到 1px 的描边** —— 这类问题只能靠计算值断言或像素统计。
> 修复后用 `--update-snapshots=all` 重录，**31 张基线真的变了**。

### 挖洞对齐的像素证据

6px 黑白条纹背景、Tier A、亮色。取高亮项内**文字带以上**的一条横带
（避开字形），统计相邻像素亮度差均值（越大 = 条纹越清晰）：

| 采样区 | 清晰度 |
|---|---|
| **洞内（高亮项内）** | **3.68** |
| 上一项（未高亮，同样的带） | 0.20 |
| 下一项（未高亮，同样的带） | 0.18 |
| 项左侧的面板内边距 | 0.00 |

洞内比相邻项**高约 19 倍**，左侧内边距为 0 —— 洞没有溢出到项的外面。

> 项**右侧**的内边距带读到 2.4，一开始以为是洞溢出。换到**未高亮的行**再量，
> 同一位置读到 2.5 —— 与高亮无关，是面板右缘本身的渲染差异。
> 原因没查，记在这里，不当成洞的问题。

### 新量到的 Apple 数据：菜单项内部的前导布局

之前只量到「项 = 218×40」。这次拆开 `Item` 实例（节点 `12740:24194`）：

| 项 | 值 |
|---|---|
| `Leading` 框在 218 项内 | x = **6**，宽 204 |
| `Symbol`（前导图标） | **28 × 20** |
| 图标与标签间距 | **8**（Label 块 x=36 − 图标宽 28） |
| 标签在项内起点 | **42**（面板内 58） |

三个 Item 实例逐项一致，全是 `[实测]`。

> ⚠️ **对勾画在这一列、以及对勾用 label 色，两条都是 `[推定]`。**
> 参考图是静态的 Edit Menu，**没有任何选中态可量**。
> 取 Symbol 列的依据是 UIKit（`UIAction.state == .on` 的对勾占 image 槽位），
> 那是行为知识，不是这份设计文件里的数据。**列的尺寸是实测，对勾的位置是推定。**

> 顺带暴露一处已有差异：**DropdownMenu 没有图标槽**，标签直接从面板内边距起（16），
> 与这一列不对齐。参考图里每一项都有图标，所以「没有图标时标签靠哪」
> 这份文件答不了。未改 DropdownMenu，记为已知差异。

### 还上了 DropdownMenu 欠的两条债

| 债 | 状态 |
|---|---|
| 移动路径的 typeahead | ✅ **还上了** —— 1s 缓冲、同字母循环、多字前缀、空格留给「选中」，5 条测试 |
| 三种无障碍偏好的单独测试 | ✅ **还上了** —— reduced-transparency（面板 + 高亮项各一条）、prefers-contrast、reduced-motion |

> ⚠️ DropdownMenu **自己**的这两条仍然欠着。Select 还的是 Select 的。

### 选中 ≠ 高亮

同一项上可以同时有两种状态，本库把它们分开处理：

| | 语义 | 表现 |
|---|---|---|
| **选中** | 持久状态 | 前导列的对勾。**不给玻璃** |
| **高亮** | 瞬时的键盘/指针焦点 | Layer I 强玻璃 + 挖洞 |

图标列**永远占位**（选中与否都是 28+8），否则标签会横跳 —— 有测试钉住
（五项的标签左缘全部 = 42）。

### 同一个组件里两处 Layer I，处理**相反**

`press-legibility.mjs` 为此各加了一个测点，6px 条纹背景：

| 位置 | 补底色？ | 静止 → 按下/高亮 |
|---|---|---|
| 菜单里的**高亮项** | ❌ 不补 | 17.78 → **17.78:1** |
| **触发器**按下 | ✅ 必须补 | 15.46 → **7.83:1** |

理由不同，不是不一致：高亮项**叠在面板材质之上**，面板底色仍在标签背后；
触发器**自己就是**那层底座，α 归零标签就没背景了（Button 当年掉到 1.92:1）。

### 两条路径的不对称（与 DropdownMenu **结论不同**）

| | 桌面 | 移动 |
|---|---|---|
| 原语 | Radix Select | 本库 Sheet + 自写 `role=listbox` |
| 触发器语义 | `role=combobox` + `aria-haspopup=listbox` | Dialog 触发器 + 我们补的 `role=combobox`，`aria-haspopup=dialog` |
| **可访问名称** | **一致，都是 title** | **一致** |
| typeahead | Radix 自带 | ✅ 自己写的 |
| 高亮项 | Layer I（折射 + 挖洞） | 无 |
| `name` / `required` 表单提交 | ✅ Radix 接出隐藏 input | ❌ **没有** |

> 名称这一条**与 DropdownMenu 相反**：那边两条路径的名称不同，
> 因为 WAI-ARIA 的 menu 模式要求菜单由触发器命名；
> Select 的 Content 是 listbox，Radix 不会自动命名，两边都落到 `title`。
> **别把上一批的结论照搬过来。**
>
> `aria-haspopup=dialog` 不是将就 —— WAI-ARIA 1.2 的 combobox 明确允许这个取值。

### 移动路径的一个机关：Drawer 关着时触发器怎么显示当前值

Sheet 关着时 `SelectItem` 根本没渲染，触发器无从知道 `size` 该显示成 `Size`。
解法与 Radix Select 内部一样：关闭时把 children 渲染进一个**游离的
DocumentFragment**，项照常跑注册 effect，但不出现在文档里。有测试钉住
（触发器显示 "Date Modified"，同时 `[data-slot=select-item]` 在文档里计数为 0）。

### Fidelity 对照图：**这一批没有，而且不该有**

参考图里只有 Edit Menu，**没有任何带选中态的菜单**。面板本身的几何与
DropdownMenu 完全同源，已经在 `compare-menu.png` 里比过了。
再做一张只会是同一张图换个标题 —— 不做，理由记在这里。

### §14 逐条

| 验收项 | Select |
|---|---|
| light / dark 各自独立调过 | ✅ 各录 5 张快照（含触发器与未选中态） |
| 材质档位 0/1/2/3 正常可读 | 🟡 只录了默认档 0.34 —— 面板与 Popover 同一层材质，那边录了 0/0.34/1 |
| Tier A/B/C 三条路径完整 | ✅ 各录快照；高亮项只有 Tier A 走 SVG 折射 |
| Layer B / Layer I 分层正确 | ✅ **面板磨砂不折射 + 高亮项折射 + 挖洞逐像素对齐（新增断言）** |
| 交互态齐全，用 spring 预设 | ✅ 高亮 / 选中 / 禁用 / 触发器按下；过渡一律 `transitionFor()` |
| 移动端下拉类改 Drawer | ✅ 有测试；`responsive={false}` 逃生口也有 |
| 三种无障碍偏好正确降级 | ✅ **本组件三条各有测试**（透明度两条、对比度、动效） |
| WCAG AA 对比度检查通过 | ✅ 高亮项 17.78:1、触发器按下 7.83:1（条纹背景） |
| registry item + 干净工程冒烟 | ✅ 已加进冒烟工作流，另加了 `--lg-glow` 的闸 |
| 文档页 Preview/Code/Fidelity/API | ❌ Phase 6 |
| `// APPLE REFERENCE:` + 可信度标注 | ✅ 新测值与推定值分开写清楚了 |
| Playwright 视觉回归快照 | ⚠️ 16 张，只有 win32 基线 |

### 未过的项

🔴 **`name` / `required` 只在桌面路径生效。** 移动路径是自己接的 listbox，
没有隐藏 input。需要提交表单时得自己受控。已写进 registry 的 docs。

🔴 **未交付**：多选、可搜索、分组的粘性标题、ScrollUp/ScrollDownButton
（选项超高时视口本身可滚，但没有那两个箭头按钮）。

🟡 面板圆角仍是 `[推定]` 22；对勾的位置与颜色是 `[推定]`；材质档位只录了默认档。

🟡 **DropdownMenu 的图标槽仍然没有** —— 这批量到了 28+8 的图标列，
但没有回头改 DropdownMenu（那属于另一批的活）。

### 测试增量

| 文件 | 数量 | 进 CI |
|---|---|---|
| `tests/select.behavior.spec.ts` | **38** | ✅ |
| `scripts/press-legibility.mjs` | 40 → **48** 个测点 | ✅ |
| `tests/select.visual.spec.ts` | 16 张 | ❌ 平台相关 |
| 重录的旧基线（缺陷二、三的后果） | **31** 张 | ❌ 平台相关 |

本机全绿：typecheck ×2 · registry 静态检查（14 文件）· 派生色漂移 · 探针契约 ·
对比度审计 1512 采样 · 交互态可读性 **48** 测点 · 行为回归 **213** 项 · 视觉 **149** 项。

---

## 0.6 Phase 6 第一批 · 文档站骨架 —— 自查（2026-09-02）

任务卡的优先级里，这一批交付 **1–3**（组件页模板 · API 自动生成 · 全局顶栏），
外加原本排在第 6 位的 `/view/[name]`（因为组件页要链接到它）。
**4（Fidelity 页）、5（首页 Hero）、6 的其余部分、7（Materials / Optics）没做**，
页面上逐条写着缺口，不做「即将上线」的空壳。

### 站点长什么样

- `app/(site)/` 带顶栏与侧栏，`app/view/` 刻意在路由组之外 —— `/view/[name]`
  是给截图和 iframe 用的，除了 Provider 什么都不套。
- 顶栏是一块 Layer B 底座，压在整页的彩色底纹上；三个控件（材质滑杆、
  渲染路径、明暗）**用的是本库自己的 Slider / Tabs / Switch**。
- 侧栏是本库的 `Card` + `CardRow`，也就是 iOS 的分组列表。
- 12 个组件页 + 首页 + Docs 首页 + 安装页 + 12 条 `/view` 路由，共 **29 个静态页**。

### 页面上几乎没有手写内容

| 这一段 | 来自 |
|---|---|
| 标题 / 描述 / 依赖 / 安装命令 | `registry.json` —— **发给用户的同一份** |
| Preview | 示例文件默认导出的组件，真的渲染出来 |
| Code | **同一个文件的源码原文** |
| props 表 / 默认值 / 继承说明 | 组件的 TS 类型与 JSDoc |
| 尺寸常量 + 可信度标注 | 组件源码里的 `as const` 对象与它们的注释 |
| APPLE REFERENCE | 组件文件头那段注释 |

手写的只有一行：分层归属（抄自 PROJECT_SPEC §2 的速查表）。

**Code 与磁盘上的示例文件逐字相同**这条有测试钉住 —— 手写一份说明、
渲染另一份代码是 Preview/Code 模式最常见的退化方式。

### API 生成器：刻意不摊平继承

`react-docgen-typescript` 这类通用工具会把 `extends React.ComponentProps<'button'>`
**整个摊平**，于是 API 表里出现 300 多个 DOM 属性，组件自己那两三个真正需要
说明的 prop 反而被淹没。所以这里只取**接口自己声明的成员**，继承部分写成一行人话：

> ↳ 继承 `<button>` 的原生属性（已排除 onDrag、onDragStart、…）

默认值从组件函数的**解构参数**里读（`variant = 'glass'`），不是手抄的。

### 意外收获：把「有没有裸数字」变成了可检查的量

生成器顺手统计了「JSDoc 里没有 `[官方]/[实测]/[推定]/[待核实]` 标注的尺寸常量」。
第一次跑出来：**90 个里有 29 个没有**。

查下来不是真的缺依据 —— Tabs / Slider / Switch / Button / Dialog / Toggle
这批早期组件把出处写在**文件头**，逐键的 JSDoc 里只写了「iOS 27 实测」这样的
散文，没用方括号标记。后来的组件（Card 起）才统一成方括号。

补齐之后 **90 / 90 全部带标注**，并在 CI 里钉死（`docs.yml` 会读生成物里的
`stats.unlabelled`，不为 0 就 fail）。组件页上那张「尺寸常量与可信度」表
因此每一行都有徽章 —— 这是本库区别于普通 UI 库最直观的一页。

### 做站点时抓出来的三个真缺陷

#### 一、Tabs 从第一天起就在无限重渲染

`TabsTrigger` 里同步洞位置的 effect 依赖**整个 ctx**，而 `Tabs` 的 ctx memo
依赖 `punch`，那个 effect 又会 `setPunch` —— 闭环：

    set → ctx 换新 → effect 重跑 → 再 set → ……

控制台刷 `Maximum update depth exceeded`，而**画面完全正常**（每次算出来的
洞位置都一样）。代价是 MutationObserver 与 ResizeObserver **每帧被拆掉重建**。

已有的测试一条都抓不到它：行为测试断言 DOM 与几何（值是对的）、
视觉快照比像素（画面是对的）、**没有任何一条看过控制台**。

修法两层：
- `@glass/core` 新增 `usePunchState()` —— setter 在**值没变时不重渲染**
  （0.01px 容差，避开 `getBoundingClientRect()` 的浮点噪声）；
- effect 的依赖从 `ctx` 收窄到 `setPunch`（引用稳定）。

Tabs / DropdownMenu / Select 三处挖洞全部换过来了。

#### 二、`@glass/core` 的两个 hook 模块漏了 `'use client'`

`use-glass-filter.ts` 与 `preferences.ts` 导出的全是 hook，但没有指令。
后果：**任何从服务端组件 `import '@glass/core'` 的人都构建失败** ——
barrel 会把它们一起拖进 RSC 图。本库自己的文档站 `app/layout.tsx` 第一个撞上。

> 值得记的是 **Turbopack 不报，webpack 才报**。Next 16 默认 Turbopack，
> 我是切到 `--webpack` 排查 CSS 问题时顺带看见的。

#### 三、Slider 的 `aria-label` 落在了 Root 上，读不出来

`role="slider"` 在 Radix 里是 **Thumb** 承担的，Root 只是容器。
`<Slider aria-label="音量" />` 这种最自然的写法，透传给 Root 之后
屏幕阅读器读到的是一个**没有名字的滑杆**，而调用方看不出任何异常
（本库自己的示例文件就是这么写的）。改成把 `aria-label` / `aria-labelledby`
摘出来转挂到 Thumb。

### 新增的测试

| 文件 | 内容 | 进 CI |
|---|---|---|
| `tests/console.behavior.spec.ts` | **10 个验证台，控制台必须零 error / warning** | ✅ components.yml |
| `tests/docs/site.spec.ts` | 站点 15 条（见下） | ✅ docs.yml（新建） |

站点那 15 条里，值得单独说的：

- **顶栏三个控件真的影响全站** —— 不只查变量，还查绘制：
  拉材质滑杆之后读 `.lg-surface` 的 `background-color` 必须变；
  切到 Tier C 之后 `backdrop-filter` 必须是 `none`。
- **Code 那一半与磁盘上的示例文件逐字相同**。
- **每一行尺寸常量都必须有可信度徽章**（逐行遍历，不是抽查）。
- **首屏不闪**：拆成两个确定性断言 —— 内联脚本在 `</head>` 之前、
  且存了 `lg:theme=dark` 之后页面确实是暗色。
  > 试过两种更"直接"的写法（第一个 rAF 里读、body 插入时读），**都偶发失败**：
  > 前者 rAF 可能在文档还没解析到 `<head>` 时就烧掉一帧，后者 `addInitScript`
  > 跑得比 `documentElement` 还早、观察器根本装不上。
  > 那是测试的时序假设不成立，不是产品的问题 —— 记在测试注释里。

### 一处妥协，写清楚

防闪烁脚本是 `<head>` 里的**裸 `<script>`**，这会让 Next 在开发模式下打一条
「Scripts inside React components are never executed when rendering on the client」。
换 `next/script` 的 `beforeInteractive` 试过：**警告照旧**（它内部也是渲染一个
script 标签），而注入位置反而从 `<head>` 掉到了 `<body>` 开头 —— 那正是可能
闪一下的位置。所以保留裸标签，把这条警告放进站点测试的白名单，并写明原因。

### §14 的那一项

「文档页含 Preview/Code、Examples、Fidelity 对照、自动生成的 API 表」——
这是 11 个组件**全都没过**的唯一一项。本批之后：

| 子项 | 状态 |
|---|---|
| Preview / Code | ✅ |
| 安装命令（CLI / 手动） | ✅ |
| 自动生成的 API 表 | ✅ |
| Examples（多个变体） | 🟡 **每个组件只有 1 个示例** —— 模板支持多个，内容没填 |
| Fidelity 对照 | ❌ 没做 |

所以这一项仍然**不算过**，只能算「过了一半多」。不四舍五入。

### 未做的（任务卡原文照抄）

🔴 **首页 Hero**：规格要的是「一个完全可交互的 iOS 风格界面（tab bar +
segmented + slider 全部是活的）」。现在只是普通落地页。
🔴 **Fidelity 标签页**（任务卡第 4 位）—— 对照图早就生成在 `public/fidelity/` 下了，
缺的是「并排 + 逐条差异说明」那一页。
🔴 **⌘K 命令面板**、**Themes / Playground**（能导出 CSS 变量片段的那个）。
🔴 **Docs 章节只有 Introduction 与 Installation。**
Theming / Dark Mode / CLI / Registry 四页没有；
**Materials 与 Optics 两页也没有** —— 任务卡说这两页是本库与其他
「毛玻璃 UI 库」的分水岭，要写透，所以不糊弄，留到下一批。
🟡 **代码块没有语法高亮。** 加高亮库会引入一套与本库无关的配色表，
而 §15.4 禁止裸色值 —— 要么另建一套 token（超出本批范围），要么就是一堆硬编码颜色。
现在用等宽 + 本库的标签色层级。

### 顺带的两处结构决策

- `apps/www/tsconfig.json` **刻意不再把 `@glass/core` 映射到源码**，让它走
  `package.json` 的 exports → `dist`。文档站与类型检查吃到的因此是
  **发布出去的那个表面**。代价是 build / typecheck 前要先构建包，两个脚本里串好了。
  （验证台不受影响 —— `dev:build` 的 esbuild alias 仍指向源码。）
- 文档站的测试单独一个 config（`playwright.docs.config.ts`），因为它要先
  `next build` 再 `next start`。混进主 config 会让秒级的组件回归每次白等一次构建。

---

## 0.61 Phase 6 第二批 · Fidelity 页 + Examples + ⌘K —— 自查（2026-09-02）

任务卡优先级里的 **4（Fidelity 标签页）**与 **6（⌘K 命令面板）**，
外加把上一批记为 🟡 的 **Examples 补齐**。
**5（首页 Hero）与 7（Materials / Optics）仍然没做。**

### §14 的「文档页」那一项，这一批真的过了

| 子项 | 上一批 | 现在 |
|---|---|---|
| Preview / Code | ✅ | ✅ |
| 安装命令（CLI / 手动） | ✅ | ✅ |
| 自动生成的 API 表 | ✅ | ✅ |
| Examples（多个变体） | 🟡 每个组件只有 1 个 | ✅ **每个组件 2 个**，有测试逐个验 |
| Fidelity 对照 | ❌ | ✅ 8 张图 + 差异说明；没有图的 4 个说清楚了为什么 |

所以 11 个组件的 §14 成绩这一批之后各 **+1**。

### Fidelity：图和说明来自同一处

对照图本来就是从 `dev/fidelity.html` 渲染出来的
（`scripts/fidelity-sheets.mjs`）。这一批新加的 `scripts/generate-fidelity.mjs`
把**同一个页面里那段 `.note`** 也抽出来，转成本库 `RichText` 认的
`**粗体**` / `` `代码` ``，站点直接渲染。文档站不另写一份 ——
改了图忘了改文档，读者看到的差异说明就是错的。

顺带解决一个显示问题：整张 `compare-*.png` 里**包含**那段说明，
直接贴到页面上会让同一段话并排出现两遍。所以截图脚本现在出两版：

| 文件 | 用途 |
|---|---|
| `compare-*.png` | 整张（标题 + 两栏 + 说明）。贴到 STATUS / issue / 聊天里自带上下文 |
| `compare-*-cols.png` | 只有两栏。文档站用这一版，说明由页面单独渲染（可选中、可搜索、跟主题走） |

### 新增一张对照：Tabs —— 旗舰组件此前竟然没有

Tabs 是本库的第一个组件，也是「Layer B + Layer I + 挖洞」这套东西的原型，
但它一直**没有对照图**（Phase 3 那会儿只录了 tier × 档位的九宫格矩阵）。这一批补上了。

参考图的背景色与尺寸是**量出来的**，不是目测配的：四角与四边取样全是
`rgb(103 103 103)`，画布 402×97，底座在 y=11…74（top 12、高 62）、x 从 20 起。

这张图顺带**独立验证了同心圆角公式**：外半径 31 − 内缩 4 = 内半径 27，
与 `concentricRadius(31, 4)` 的输出一致 —— 此前那个公式只有 Apple 的定性描述作依据。

**它也把一个欠了很久的缺口摆到了明面上**：参考图右边那个 62×62 的
Search 独立胶囊，本库没有。「主胶囊 + 分离尾随胶囊」的布局能力
Phase 0 的度量笔记里就记成了实现要求，至今没做 —— 对照图里如实留空，
不用一个假方块糊上去。

### 没有对照图的四个组件，逐个说清楚为什么

「暂无对照图」是最省事也最没用的写法。这四条是人写的，而且代码里
**刻意不给默认文案** —— 缺一条，页面上就是一句「还没写清楚为什么」：

| 组件 | 原因 |
|---|---|
| Toggle | 没有属于它自己的 Apple 参考图；几何全部继承 Button，选中态沿用 Tabs 指示器 |
| Popover | **圆角是唯一一个量不出来的几何**（拟合不收敛）。连几何都对不齐，并排图只会给人「已经比过了」的错觉 |
| Select | 参考图里没有任何带选中态的菜单；面板与 DropdownMenu 同源，那张已经比过了 |
| ResponsiveOverlay | 行为原语，没有自己的外观 |

有测试钉住这四条**必须出现各自的原因**，且**不许出现「暂无」**。

### Examples：每个第二示例都要教会一件事

不是换个颜色再摆一遍。12 个新示例，每个对应一条组件里真实存在的决策：

- `slider-range` —— 双 knob，顺带说明 `aria-label` 会挂到**每一个** knob 上，
  两个读出来是同一个名字（Radix 的既有限制，本库不做猜测）
- `button-sizes` —— sm 44 是 HIG 的最小触控目标 `[官方]`，不是随手取的
- `card-variants` —— 三个变体**没有一个是玻璃**（§15 #9：材质属于控件层）
- `dropdown-menu-desktop` / `responsive-overlay-escape` —— §9 点名要求的逃生口
- `switch-in-list` —— Switch 真正的落脚点是分组列表行，iOS 里几乎从不单独出现

### ⌘K：三十行，不引 cmdk

shadcn 生态的 Command 底层是 `cmdk`，它自带一套 `[cmdk-*]` 的结构与样式约定。
塞进本库会有两套并行的结构钩子（`data-slot` 与 `cmdk-*`），而这个面板要的
一共三件事：过滤、上下键、回车跳转。自己接比引一个依赖再和它较劲便宜。

面板本身是本库的 `Dialog`，结果列表是 `Card` + `CardRow`，高亮项是
`GlassSurface` 的 Layer I —— §12 要求「搜索面板必须用本库组件搭建」，这条落实了。

**搜索能力的边界写在面板底部**：按标题与描述做的子串匹配，不搜正文、
没有模糊匹配。「看起来像全文搜索」是这类面板最容易造成的误解，
有一条测试专门钉这句话必须在。

### 又踩了一次 data-slot 覆盖

`<DialogContent data-slot="command-palette">` —— `DialogContent` 在展开 props
**之前**设了 `data-slot="dialog-content"`，外面再给一个直接把它顶掉，
结果是面板不再带 `dialog-content` 这个钩子。测试当场红了
（「面板是本库的 Dialog 搭的」那条查不到 elevated 材质）。

**这是同一个坑的第四次**：SheetClose、ResponsiveOverlay、DropdownMenu 都踩过，
每次的解法都是另起一个属性（`data-sheet-close` / `data-responsive-overlay` /
`data-dropdown-menu`），这次是 `data-command-palette`。
组件里那几条注释写得很清楚，但**只有写组件的人会读到** ——
调用方（这次是文档站自己）看不到。这大概说明该有一条 lint 规则。记着，没做。

### 测试增量

| 文件 | 内容 |
|---|---|
| `tests/docs/site.spec.ts` | 15 → **23** 条 |

新增的 8 条：Fidelity 三条（图 + 说明同源、必须先声明「不是真机截图」、
没有图的要说原因且不许写「暂无」）、Examples 一条（逐个组件验第二个示例存在）、
⌘K 四条（开关/过滤/跳转、面板确实是本库组件搭的、Esc、边界说明必须在）。

### 一个反复咬人的操作陷阱（记给自己）

`playwright.docs.config.ts` 的 `reuseExistingServer: !CI` 会复用 4200 端口上
**任何**已在跑的服务。改了代码之后如果上一轮的 `next start` 还活着，
测试与截图吃到的都是旧构建 —— 这一批因此误判过三次
（一次以为 CSS 没编译、一次以为页面 500、一次以为 `-cols` 图没生效）。
本地跑之前先杀掉 4200。CI 上不存在这个问题（`reuseExistingServer` 为 false）。

### 未做的

🔴 **首页 Hero** —— 规格要的是「一个完全可交互的 iOS 风格界面
（tab bar + segmented + slider 全部是活的）」。现在仍是普通落地页。
🔴 **Materials 与 Optics 两页** —— 任务卡说这两页是本库与其他
「毛玻璃 UI 库」的分水岭，要写透。**下一批就做这两件。**
🔴 Themes / Playground；Theming / Dark Mode / CLI / Registry 四页。
🟡 代码块仍无语法高亮（理由见 `components/code-block.tsx`）。
🟡 ⌘K 是子串匹配，不是全文搜索（面板上写着）。
🟡 命令面板里的高亮项**没有挖洞** —— Dialog 面板没有为它开这个口子，
所以那一处的折射看到的是被面板模糊过的背景。属于已知差异，不是漏做：
挖洞需要面板配合，那是组件 API 的事。

---

## 0.62 Phase 6 第三批 · Materials 与 Optics —— 自查（2026-09-02）

任务卡第 7 项：「Docs 章节：Materials（讲 Layer B vs Layer I）和 Optics（讲三级降级）
**要写透** —— 这两页是本库和其他『毛玻璃 UI 库』的分水岭」。

「写透」的口径定成：**每个论断旁边都能自己按一下看到**。所以两页各带活演示，
而且默认落在 **6px 黑白条纹**背景上 —— 折射与色散在平滑渐变上本来就看不出来，
只给渐变的演示等于什么都没演示。

### 两页各写了什么

**Materials**：两种材质不是两个强度（活的并排对照，可切三种背景）·
PROJECT_SPEC §2 分层速查表 · 挖洞（**开关是活的**，条纹下一眼可见差别）+
四种写法的 σ 实测对照 · **α=0 陷阱**（滑杆实时算最不利背景下的对比度）·
可读性地板的推导。

**Optics**：三级降级（**三档同屏渲染**）· `CSS.supports` 说 true 不代表滤镜真的
产出内容 · 位移量必须按短边比例（−180 在 85×54 上等于 ±90px）· 径向场 vs 矩形衰减 ·
性能红线 8（**如实标注这是推定值，没做过帧率实测**）· 三种无障碍偏好 ·
**光学至今没有真机基准**。

最后那一节是这一页最重要的：一个讲光学的页面如果不写这件事，
就是在拿推定值冒充实测值。有一条测试钉住它必须出现。

### 做「三档同屏」时挖出一个**真的上线过**的 CSS 缺陷

第一版三格长得**一模一样**。查下来两层原因：

**第一层（演示写错了）**：三档是 CSS 的**后代选择器**
（`[data-glass-tier='b'] .lg-surface[...]`），在中间套一个 div 写属性能命中；
但 **Tier A 的折射是 JS 注入的内联样式**，优先级高于任何 CSS，属性盖不住它。
为此给 `GlassSurface` 加了 `refraction` prop —— 只关掉 JS 注入的那一层，
把表现交还给 CSS 分支。**这不是 tier 覆写**，注释里写清楚了两件事都要做。

**第二层（库里真的有 bug）**：改完之后 Tier B 那一格仍然错。查打包产物发现：

```css
/* 源码 */
[data-glass-tier='b'] .lg-surface[data-layer='indicator'] {
  backdrop-filter: blur(1px) …;
  -webkit-backdrop-filter: blur(1px) …;
}
/* Lightning CSS 打包之后 */
[data-glass-tier=b] .lg-surface[data-layer=indicator]{-webkit-backdrop-filter:blur(1px)…}
```

**标准属性被吃掉了。** Lightning CSS（Next 的 CSS 管线）看得懂两者是同一个属性，
遇到手写的一对**只保留后面那条** —— 而源码里前缀写在后面。
Chromium 不把 `-webkit-backdrop-filter` 当标准属性的别名，
于是 **Tier B 的指示器规则在真实构建里根本没生效**，悄悄退回了 Tier A 的兜底值。

> **为什么一直没被发现**：验证台走的是 `@tailwindcss/cli`，**不压缩**，
> 所以 `tabs.visual.spec.ts` 里那些 `tier b` 快照一直是对的。
> 只有走真实构建管线才会现形 —— 这正是 registry-lint 当初为之而建的
> 「本机看不出来、装到别人工程里才炸」那一类。

修法是把 **`-webkit-` 一律写在标准属性之前**（optics.css 7 处、theme.css 2 处），
被保留的就变成标准属性。加了一条从 CSSOM 读打包产物的回归测试。

顺带修了第三处：Tier C 原先**没有**显式清 `backdrop-filter`。
全局场景下无所谓（`<html>` 只有一档），但局部覆盖时 Tier A 的规则同样命中，
C 那一格还带着 A 的提亮与饱和。补上之后特意让特异度与 A/B **相等**
（三个 `data-layer` 逐个写），否则还是压不住。

### §14 与这一批无关，但站点的完成度前进了一格

任务卡 7 项里现在完成 1 · 2 · 3 · 4 · 6 · 7，只剩 **5（首页 Hero）**。

### 测试增量

`tests/docs/site.spec.ts` 23 → **31** 条。新增 6 条（另 2 条是把两页并入控制台检查）：

- 两页在侧栏与 ⌘K 里都能找到
- Materials 的演示**是活的**：分层对照两种材质都在；挖洞开关关掉后 `data-punched` 消失
- α 滑杆拉到 0 时页面明确报「不过 AA」，拉到 1 报「过 WCAG AA」
- **三档同屏渲染而且真的不一样**：A 含 `url(`、B 含 `blur(1px)` 且不含 `url(`、C 是 `none`
- **Tier B 的标准属性没有被压缩器吃掉**（直接读 CSSOM）
- Optics 必须出现「没有真机基准」与「全是 [推定]」

### 三个测试自身的坑，记下来

1. **原生 `<input type=range>` 上 `fill()` 不触发 React 的 onChange** ——
   得取 `HTMLInputElement.prototype` 的 value setter 手动设值再派发 `input` 事件。
2. **折射滤镜是异步创建的**（量完尺寸才 acquire），断言 `url(` 要用 `expect.poll`。
3. **`[data-punched]` 一次找到三个** —— 那一节里 Tabs 与 Switch 自己也会挖洞。
   给演示加了 `data-lab="punch-stage"` 限定范围。

### 未做的

🔴 **首页 Hero** —— 任务卡第 5 位，规格要的是「一个完全可交互的 iOS 风格界面
（tab bar + segmented + slider 全部是活的）」。**这是任务卡里唯一剩下的一项。**
🔴 Themes / Playground（实时调档位并导出 CSS 变量片段）。
🔴 Theming / Dark Mode / CLI / Registry 四页。
🟡 代码块仍无语法高亮。
🟡 `refraction` prop 是为文档站加的 —— 业务代码不需要它，注释里写明了。
   它**不写** `data-glass-tier`，调用方仍要自己在祖先上加属性，API 谈不上优雅。

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

## 0.63 Phase 6 第四批 · 首页 Hero —— 自查（2026-09-03）

任务卡第 5 项：「首页 Hero：一个**完全可交互**的 iOS 风格界面
（tab bar + segmented + slider 全部是活的）」。做完这一项，Phase 6 的 7 项走完。

### 做成了什么

`apps/www/components/hero-phone.tsx` —— 一台 402×668 的「手机」，**没有一张截图**。
三个 tab、一个分段控件、两个滑杆、两个开关全是本库组件，而且都**真的改变屏幕上的东西**：

| 控件 | 真的做了什么 |
|---|---|
| Tab Bar（Tabs, 62pt） | 切换三个面板：资料库 / 设置 / 相册 |
| 分段控件（同一个 Tabs, 32pt） | **真的过滤**下面的封面网格（8 → 5 → 3），不是换个高亮 |
| 亮度滑杆 | **真的把整块屏幕压暗**，连玻璃一起 —— 就像调背光 |
| 音量滑杆 | 读数跟随 |
| 「大字体」开关 | **真的把这块屏幕的根字号** 17 → 19 |
| 无线局域网开关 | 下一行的「网络」跟着变 Glass-5G / 未连接 |
| 上下滚动 | 内容真的从悬浮 Tab Bar 底下穿过去 —— 玻璃的正题 |

### 一个走错又走回来的决定：Hero 不铺壁纸

第一版在屏幕底下铺了张壁纸，想让玻璃有东西可折射。**错了两次**：

1. iOS 里 Tab Bar 折射的是**滚动的 App 内容**，不是壁纸 —— 壁纸只在主屏可见。
2. 内容文字直接压在壁纸上，换成诊断用的 6px 黑白条纹时**必然过不了 AA**。
   在一个把「最不利背景下仍满足 AA」写进 §13 的库的首页上摆一个反例，
   比少一个炫技演示糟糕得多。

改成：底是 App 底色（`--lg-grouped-bg`），高频内容由**封面网格**提供 ——
那层 2px 斜纹就是为了让折射有边缘可扭。想在条纹上看光学，Materials / Optics 有演示台。

### 顺手补上了 §13 里唯一一条**完全没实现**的要求

「滚动边缘效果」此前只存在于研究笔记里 —— 因为在 Hero 之前，
**这个项目里就没有过「内容从固定栏底下滚过去」的场景**。

新增 `@glass/core` 的 `<GlassScrollEdge>` + `useScrollEdge`：

- **方向按 Apple，不按 SPEC 的字面写法。** SPEC §13 写「栏底自动增加不透明度」——
  作用在**栏自身**上；Apple 说的是模糊并降低**背后内容**的不透明度。
  前者会把栏本身变浑、玻璃感随之丢失；后者栏一点不变。分歧早在
  `apple-liquid-glass.md` §11 记过，这次按 Apple 实现。
- 强度由 CSS 变量 `--lg-edge-progress` 驱动，**滚动时直接写 DOM，不走 React state** ——
  这条效果唯一要改的只是两个 opacity，没必要每帧重渲染整棵内容子树。
- `scrollRef` 是 **callback ref**：Radix 默认卸载未选中面板，切一次 tab 就换一个滚动容器，
  RefObject 的赋值不触发 effect，监听会挂在已经离开文档的旧元素上。
- Tier C / `reduced-transparency` 下没有 backdrop-filter 可用，
  **雾要加浓来补**（×1.28，`[推定]`）—— 这条效果的职责是可读性，不能跟着降级一起消失。
- soft / hard 两档对应 `ScrollEdgeEffectStyle`。⚠️ Apple 只给了两个**名字**，
  高度 / 模糊半径 / 雾浓度**全是 `[推定]`**。

### Hero 挖出四个**真上线**的库级缺陷

一台把顶栏、Preview/Code、Tab Bar、分段四组玻璃摞在一屏上的手机，
一上去就把四个此前没人发现的问题同时顶了出来。**四个都不是 Hero 自己的问题。**

**一、`layoutId` 是全树共享的命名空间。**
Tabs 写死 `layoutId="lg-tabs-indicator"`，于是一页上只要有两组 Tabs，
motion 就把它们的指示器当成**同一个元素**。首页实测：四组 Tabs 的指示器
`getBoundingClientRect()` 报出来是**同一个 rect**。
→ 改成 `React.useId()` 每实例一个。

> **为什么一直没被发现**：视觉回归是**逐个示例单独渲染**的（`/view/[name]` 一屏一个组件），
> 永远不会有第二组 Tabs 在场。**又一次「隔离渲染看不见组合问题」**——
> 与 §0.62 的「验证台不走真实构建管线」是同一类盲区的两个面。

**二、`.lg-surface` 是无层规则，工具类**永远**盖不过它。**
级联层的规则是「**无层的声明胜过任何有层的声明**」，与特异度、源码顺序无关；
而 Tailwind v4 的工具类在 `@layer utilities` 里。于是 `.lg-surface` 上的
`position` / `border-radius` / `color` / `isolation` 这四个属性，
用 `className="absolute"`、`rounded-none`、`text-white` 去改**全部静默失效** ——
没有报错、没有警告，看起来就像类名写错了。
Hero 把 Tab Bar 定到屏幕底部时踩到：class 列表里明明有 `absolute`，computed 还是 `relative`。
→ 把 `.lg-surface` 基础规则放进 `@layer components`。材质规则仍然无层，那是故意的。

> 有意思的是：**registry 那条路早就是对的**。`generate-theme-item.mjs` 一直把
> `.lg-surface` 归到 `@layer components`，注释写得清清楚楚「让用户的工具类能盖过它们」。
> 漏的只有**直接 `@import '@glass/core/theme.css'` 的那条路** —— 也就是文档站自己走的那条。
> 吃自己的狗粮吃出来的。

> 🔻 **更正（2026-09-03，做 Phase 7 第一批时查 blame 发现）。**
>
> 上面写的「此前没人发现」**不准确**。`slider.tsx` 里早在 Phase 3
> （提交 `73c506c`）就有一段注释把这件事说清楚了：
>
> > 定位走内联样式，不用 Tailwind 的 `absolute inset-0`：`.lg-surface` 自己声明了
> > `position: relative`，工具类能不能盖住它取决于 CSS 的 `@layer` 顺序 ——
> > registry 安装时 optics 在 `@layer components` 里（工具类赢），
> > 而直接 `<link>` 引 theme.css 时它是无层的（工具类输）。内联样式两种情况下都对。
>
> 也就是说：**这个坑早就被踩到、被理解、被局部绕过了，但从来没被修在源头，
> 也没写进任何调用方看得到的地方**（STATUS 没记、文档没写、别的组件不知道）。
> Tabs 因为没有同样的绕法，Hero 一用就撞上。
>
> 这比「没人发现」更值得记：**一个人在一个文件里绕过去的坑，对整个库来说等于没修。**
> 与 `data-slot` 覆盖踩四次是同一类问题 —— 组件内部的注释只有写组件的人读得到。

**三、超限降级是**单向门**：一瞬间超编就永久掉档。**
`useGlassFilter` 在活跃折射实例达到红线时拒绝新实例、退回 Tier B —— 但拒绝路径
直接 `return` 了，之后它的依赖再没变过，**effect 永远不会重跑**。
整页早就回到 8 个以内，它还停在 Tier B，只有刷新才好。
→ 两条回来的路：一次性延迟重检（盖本次提交内部的瞬时超编 —— 这种情形下
**拒绝就是最后一个事件**，光订阅是叫不醒的）+ 订阅 `onFilterReleased`（盖之后真的腾出名额）。

**四、游离子树在偷折射名额。**
Select 为了在关闭状态下也拿得到 value→label 映射，会把子树 createPortal 到一个
**游离的 DocumentFragment** 里。那棵子树的 effect 照跑、ResizeObserver 照报 —— 报 0×0，
而 `quantize(0)` 是 1，于是每个隐形实例都**真的申请了滤镜、真的占着 §5.2 的名额**，
却永远不会被画出来。

实测（`activeFilterCount()` / 页面上的指示器数）：

```
/                        8 / 7      差 1 = 页面上 1 个 Select
/docs/components/select  8 / 6      差 2 = 页面上 2 个 Select
```

首页 Hero 的 Tab Bar 胶囊被挤下 Tier A，根因就在这儿。
→ 判据是**零面积**，不建滤镜。

> 第一版写成「短边 < 8px 就跳过」，**立刻被 `sheet.behavior.spec.ts` 打红** ——
> Sheet 的抓手是 36×5 的货真价实的 Layer I。库里确实存在极扁的强玻璃，
> 尺寸阈值是错的判据，零面积才是。

### §5.2 的红线：首页现在正好卡在 8 上

修完第四条之后逐 tab 实测（Tier A，`count / 页面指示器数`）：

```
资料库   7 / 7   off 0        顶栏 3 + Preview·Code 1 + Tab Bar 1 + 分段 1 + 音量 1
设置     8 / 8   off 0        顶栏 3 + Preview·Code 1 + Tab Bar 1 + 亮度 1 + 开关 2
相册     5 / 5   off 0        顶栏 3 + Preview·Code 1 + Tab Bar 1
```

**「设置」那一屏正好是 8，一点余量没有。** 这个余裕还是靠 Radix 默认卸载
未选中面板换来的，不是设计出来的。site.spec.ts 有一条断言逐 tab 检查
首页不出现 `data-refraction="off"` —— 越线的那天由 CI 说，
而不是由用户在某个屏幕上看出来「那个胶囊怎么跟旁边的不一样」。

⚠️ 另外必须说清楚：**红线 8 这个数字本身是 `[推定]`。**
Apple 只说了「限制同屏数量」，没有给任何上限。

### 🔴 顺带发现、**没有修**的一件事

**`/docs/components/slider` 这一页真的超编了**：9 个实例要折射，只批了 8 个，
**有 1 个 knob 一直在 Tier B**，而且是**在我动手之前就这样**。

没修，因为修法要么是删示例（把文档做差），要么是给预算加上「只算视口内的」
（IntersectionObserver，滚动时容易抖，是 Phase 7 量级的改动）。
如实记在这儿，不假装没看见。

### §14 对照（这一批交付的是页面，不是组件；逐条对 Hero 用到的组合）

| 项 | 结论 |
|---|---|
| light / dark 各自调过 | ✅ 全走 token，无裸色值 |
| 材质档位 0/1/2/3 | ✅ 顶栏滑杆对 Hero 同样生效 |
| Tier A / B / C | ✅ 三档都有；`GlassScrollEdge` 在 C 档改用加浓的雾 |
| Layer B / Layer I 分层 | ✅ Tab Bar 底座磨砂 + 挖洞，指示器折射 |
| 交互态齐全、用 spring 预设 | ✅ 复用组件自身的实现 |
| 移动端 | ✅ 窄屏纵向堆叠；手机本体固定 402pt |
| 三种无障碍偏好 | ✅ 新原语的 reduced-transparency 分支单独写了 |
| WCAG AA | ✅ 1512 次采样全绿；**且正因为这条把壁纸方案否掉了** |
| registry item | ➖ 不适用，Hero 是站点组合不是发布组件 |
| 文档页四件套 | ➖ 同上 |
| `// APPLE REFERENCE:` + 可信度 | ✅ `scroll-edge.tsx` 有；`DEVICE` 逐条标了 `[实测]`/`[推定]`/`[非官方·版面需要]` |
| 视觉回归快照 | 🔴 **没录。** Hero 是个活界面（layout 动画 + 滚动），快照会天天飘；
现在靠 8 条行为断言钉住「它是活的」。这一条是**明确未达成**，不是不适用。 |

### 本批测试增量

```
站点测试   31 → 39   （+6 条 Hero，+2 条上面第一、二两个缺陷的回归）
组件测试   372 → 372（数量不变，但 tabs / optics.css 改动后全绿）
```

---

## 0.70 Phase 7 第一批 · 表单四件（Input / Textarea / Label / Field）—— 自查（2026-09-03）

任务卡要求「每批 4–6 个组件，一批一交付」，并且每批要汇报
**哪个最难还原、做了什么妥协、哪些地方没到 Apple 的水准**。

选这四个是因为它们**共用同一份参考图**：iOS 27 资源节点 `12740:33850`，
一个四行文本框的 Grouped List。P1 里剩下的 Checkbox / Radio 刻意没进这一批 ——
它们在 inventory 里就标着「无 iOS 对应」（是 macOS 控件），
硬凑进来会让整批的可信度被两个全 `[推定]` 的组件稀释。

### 先说这一批最重要的产出：**一条被实测推翻的分层判断**

新写了 `scripts/measure-textfield.mjs`，把那张参考图逐像素量了一遍。结论：

> ⚠️⚠️ **iOS 的表单文本框没有自己的框。**
> 没有描边、没有填充、**没有玻璃** —— 就是分组列表里的一行，行与行靠 1pt 分隔线分开。

而 `component-inventory.md` 把 Input 标的是「**B**（iOS 26 输入框是玻璃控件）」。
**这条在表单场景里是错的。** 玻璃输入框确实存在，但那是**搜索栏**那个场景。
已在 inventory 就地划掉并写明修订，apple-metrics 新增 §8.3。

量到的数值（全部 `[实测]`）：

```
区块 370 · 行高 52 · 文字左内缩 16 · 分隔线 1pt 宽 338 #e6e6e6
值 #000000 · 占位符 #c5c5c7 · 光标 2×23 #0088ff · 清除按钮 18×18 右内缩 17
```

行高 52 与分隔线内缩 16 **与 §8.2 那三块列表逐位一致** —— 四块互不相关的列表
给出同一组数，这是目前可信度最高的一组几何。

### 一处**明知故犯**的不还原

**占位符颜色。** 实测 #c5c5c7 压白底只有 **1.72:1** —— 连大字的 3:1 都够不到。
PROJECT_SPEC §13 把「最不利背景下仍满足 AA」写成不可协商，而占位符是文本。
本库改用 `--lg-label-secondary`。实测值原样留在组件头部与 §8.3 里，不抹掉。

这是本项目第一次出现「Apple 的值本身过不了自己定的无障碍线」。
处理原则记在这儿：**地板优先，偏离要写在能被看见的地方**（组件头部 + 文档页 + 研究笔记三处）。

### 一处反过来**印证了既有 token** 的巧合

清除按钮的圆底实测 #c5c5c7。而 `--lg-label-tertiary` 是 `rgb(60 60 67 / .3)`，
压白底 = 255 − 0.3 × (255 − 60) = 196.5 → **#c4c4c5**，与实测只差 1/255。
**没有新造 token**，直接用它 —— 而这个吻合度反过来说明 label-tertiary 的取值是对的。
（fill 家族最浓的一档只有 0.2，压出来 #d8d8d9，肉眼可辨地偏浅。）

### 妥协：给每个组件开了一个**没有依据**的 variant

shadcn 用户期待的 Input 是一个独立成框的控件。只提供「不画框」的那一支，
装到别人工程里第一眼就是坏的。所以两个 variant 并存，
**但把哪个有依据写死在组件头部、registry description、文档页三处**：

| variant | 依据 |
|---|---|
| `list` | **有实测**。放进 `<Card>` 就是 iOS 表单 |
| `field` | **无参考**。高度取 HIG 的 44pt 最小触控目标，圆角取半高做胶囊，全 `[推定]` |

Textarea 更糟一档：**资源里连多行输入的样例都没有**。
与 Input 共享的部分沿用实测，多行特有的（最小高度、行高、竖向内边距）全 `[推定]`。

### 最难的一个：**Field**，而且难点不在像素

Field 没有可量的几何 —— iOS 把说明文字放在 **Section footer** 里，
行内并不带说明，「标签 + 控件 + 说明 + 错误」这种四段式行在参考图里根本不存在。

它的价值全在**接线**：`id` / `aria-describedby` / `aria-invalid` 三样自动接对。
两个实现细节值得记：

1. **describedby 由子节点登记，不是无条件拼接。** 无条件拼的话，
   没渲染 `<FieldDescription>` 时 aria-describedby 会指向一个**不存在的元素**——
   屏幕阅读器对悬空引用多数是静默跳过，于是「读不出说明」在测试里完全看不出来。
2. **`FieldError` 带 `role="alert"`。** 点提交时焦点还在按钮上，
   aria-describedby 只有焦点落到控件上才会被读到 —— 光靠它是**听不见**的。

对应的回归断言写了 6 条，包括「切回来之后错误 id 要从 describedby 里**摘掉**」——
只加不减是这类实现最常见的漏洞。

### 踩到的两个坑

**一、判据写成了尺寸阈值，把 Sheet 的抓手误伤了。**（这条其实属于 0.63，
但在这一批里第二次遇到同一类问题，记在这儿备查：**「小」不等于「不存在」**。）

**二、`dev:build` 不重建 CSS，视觉基线被陈的 tailwind.css 污染了。**
录基线时 `dev/tailwind.css` 还是新组件出现之前构建的，
`has-[input:disabled]:opacity-60` 这类**只有新组件用到的工具类根本没生成**——
禁用态的输入框因此录成了一张错的图，之后跑全量套件就红 4 条。
表现像 flaky，实际是**产物陈旧**。

> `dev:build`（esbuild）与 `dev:css`（tailwind）是两个独立脚本，
> 根目录的 `pnpm dev` 会串起来跑，但单独跑 `dev:build` 不会。
> **已改成 `dev:build` 先跑 `dev:css`**，把这个坑堵死。
> 重录之后连跑两遍全量视觉套件，165 条稳定通过。

### §14 逐条

| 项 | Input | Textarea | Label | Field |
|---|---|---|---|---|
| light / dark 各自调过 | ✅ | ✅ | ✅ | ✅ |
| 材质档位 0/1/2/3 | ✅ field 变体跑了 0 与 1 两个端点 | ✅ | ➖ 内容层不吃 | ➖ 内容层不吃 |
| Tier A / B / C | ✅ 三档都有快照 | ✅ | ➖ | ➖ |
| Layer B / Layer I 分层 | ✅ **list 不画框**有断言钉住 | ✅ | ➖ 内容层 | ➖ 内容层 |
| 交互态齐全 | ✅ focus / disabled / invalid / clear | ✅ | ✅ peer-disabled | ✅ |
| 移动端下拉类 | ➖ 不适用 | ➖ | ➖ | ➖ |
| 三种无障碍偏好 | ✅ reduced-transparency 有断言 | ✅ | ✅ | ✅ |
| WCAG AA | ✅ 1512 采样全绿；**占位符是主动偏离，见上** | ✅ | ✅ | ✅ |
| registry item + 冒烟 | ✅ | ✅ | ✅ | ✅ |
| 文档页四件套 | ✅ | ✅ | ✅ | ✅ |
| APPLE REFERENCE + 可信度 | ✅ | ✅ | ✅ | ✅ 明写「没有可量的几何」 |
| 视觉回归快照 | ✅ 16 张 | ✅ | ✅（并在 wiring 那张里） | ✅ |

### 我认为还没达到 Apple 水准的地方

1. **`field` 变体就是我编的。** 高度 44 是 HIG 的触控下限而不是设计值，
   圆角取半高是照搬搜索栏的印象。它看起来合理，但**没有任何东西能证明它对**。
2. **聚焦态没有还原。** 参考图里聚焦行只多了一根蓝光标，
   而本库的 field 变体加了一圈 ring —— 那是 Web 的惯例，不是 iOS 的做法。
   §13 要求焦点环在玻璃上清晰可见，两者冲突时选了无障碍。
3. **清除按钮的 × 是画的**，笔画粗细与叉的大小比例是目测的 `[推定]`。
4. **暗色下的一切都没有参考。** 与 §8.2 一样，那几块列表在资源里只有亮色。

### 本批增量

```
组件      14 → 18（+ input / textarea / label / field）
示例      24 → 32
行为测试  223 → 244（+21）
视觉快照  149 → 165（+16）
尺寸常量  90 → 108，全部带可信度标注
研究      apple-metrics 新增 §8.3；inventory 第 15 行标注修订
工具      scripts/measure-textfield.mjs（可重跑的逐像素测量）
```

---

## 0.71 Phase 7 第二批 · 小件五个（Progress / Badge / Separator / Skeleton / Avatar）—— 自查（2026-09-03）

清单里**连续的第 24–28 行**。选这五个是因为它们凑成一个能被检验的论点：

> PROJECT_SPEC §2「材质属于控件层」—— 这一批里**只有 Progress 该有玻璃**，
> 其余四个哪怕看起来「可以加一点」都不加。

`small.behavior.spec.ts` 第一组断言就是逐个确认「谁是玻璃、谁不是」，
因为这是后续维护中最容易被悄悄破坏的一条。

### 这一批最重要的产出：**一条被自己的实测推翻的分层理由**

清单给 Badge 写的理由是「小尺寸玻璃看不出效果」。这句话一直是**断言**。
新写了 `scripts/small-glass.mjs` 把它变成**数**：同一块 Layer I 玻璃、同一张背景、
同一个尺寸，**只把 SVG 折射开/关**各截一张图比差值 —— 其余一切（材质底色、描边、
镜面高光、模糊）两边完全一致，所以差值里剩下的就是折射本身。

12 档尺寸 × 2 种背景，结果**不支持那句话**：

| | 条纹背景 meanΔ | 渐变背景 meanΔ | 相差 |
|---|---|---|---|
| 徽章 44×20 | **19.5**/255 | 2.8/255 | **6.9 倍** |
| Tabs 指示器 229×104 | **93.9**/255 | 2.8/255 | **33.5 倍** |
| 最小 35×16 → 最大 440×200 的放大作用 | **10.3 倍** | 仅 **1.8 倍** | |

**35×16 那么小的一块玻璃压在条纹上照样看得出在扭。** 小不等于看不见。

> **真正的变量是背景里有没有高频内容，尺寸只是放大器。**
> 背后有边缘时越大越明显；背后是平滑渐变时，从最小扫到最大也只从 2.8 爬到 5.0。

分层结论（内容层）**没变，但理由必须换**：
1. 这些小件通常压在**页面底色或卡片**上 —— 那是平滑的，折射几乎无从发挥；
2. §5.2 的同屏折射预算只有 8 个（该数字本身是 `[推定]`），花在这里收益为负。

反过来也成立，而且更值得记：
**Tabs 指示器、Sheet 抓手之所以真的看得出玻璃，是因为它们底下压着滚动的内容 ——
不是因为它们够大。** 这也解释了为什么首页 Hero 必须让内容从 Tab Bar 底下穿过去。

已在 `component-inventory.md` 加「修订二」、`badge.tsx` 头部改写理由。

### 一个「有对应物但没有图」的组件：Progress

`UIProgressView` 是真实存在的 Apple 控件，但**资源里一个样例都没有** ——
那三条水平轨道是 Slider（每条都带 knob）。所以轨道几何与两个颜色是
**从 Slider 借来的**：对 Slider 是 `[实测]`，对 Progress 只能算 `[推定 · 借自实测]`。

轨道定成 Layer B 的依据也说清楚了：**是为了和自家 Slider 一致**，
不是因为参考图证明了轨道是玻璃 —— 参考图里轨道压在白色列表上，
那个尺寸下磨砂与浅灰实色看不出区别（这一点正好被上面那张表印证）。

### 踩到的两个坑

**一、`motion` 的无限循环让视觉回归**做不了**。**
不定态进度条第一版用 `motion` 做条纹平移，10 张 Progress 快照**全部超时**。
原因：Playwright 截图前会 disable CSS animations，但它停不了 rAF 往内联样式上写值 ——
元素永远达不到「连续两帧一样」，`toHaveScreenshot` 直接放弃。

> 改成 CSS 关键帧（`lg-progress-march`，放在 optics.css，与骨架屏的微光并排）之后
> 18 张快照一次通过。**一条永不停止的装饰性循环本来就不该每帧过一次 React/motion**，
> 这次只是被测试逼着做对了。顺带 Progress 的 registry item 去掉了 `motion` 依赖。

**二、`exactOptionalPropertyTypes` 会把常见调用姿势挡在门外。**
`src?: string` 在这个 flag 下不接受 `string | undefined` ——
而 `<Avatar src={user.avatarUrl} />` 里 `avatarUrl` 天然可能是 undefined，
调用方得写成 `{...(url ? { src: url } : {})}`。
已把 `src` / `alt` 显式写成 `?: string | undefined` 并注明原因。
**这类问题只有真的去用组件才会暴露**，写组件时看不出来。

### 一处对旧结论的**更正**（查 blame 发现）

§0.63 里我把「`.lg-surface` 无层导致工具类失效」写成了「此前没人发现」。
**不准确**：`slider.tsx` 早在 Phase 3（`73c506c`）就有一段注释把这件事说清楚了，
并且用内联样式局部绕过了。已在 §0.63 就地更正。

> 更值得记的是更正后的版本：**一个人在一个文件里绕过去的坑，对整个库来说等于没修。**
> 与 `data-slot` 覆盖踩四次同类 —— 组件内部的注释只有写组件的人读得到。

### §14 逐条

| 项 | Progress | Badge | Separator | Skeleton | Avatar |
|---|---|---|---|---|---|
| light / dark 各自调过 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 材质档位 0/1/2/3 | ✅ 跑了 0 与 1 两端点 | ➖ 内容层不吃 | ➖ | ➖ | ➖ |
| Tier A / B / C | ✅ 三档快照 | ➖ | ➖ | ➖ | ➖ |
| Layer B / Layer I 分层 | ✅ 轨道 B，不折射 | ✅ **断言不是玻璃** | ✅ 同左 | ✅ 同左 | ✅ 同左 |
| 交互态齐全 | ➖ 非交互控件 | ➖ | ➖ | ➖ | ✅ 图失败回退 |
| 移动端下拉类 | ➖ | ➖ | ➖ | ➖ | ➖ |
| 三种无障碍偏好 | ✅ reduced-motion 静止 | ✅ | ✅ | ✅ **整层不渲染** | ✅ |
| WCAG AA | ✅ 1512 采样全绿 | ✅ | ✅ | ✅ | ✅ |
| registry item + 冒烟 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 文档页四件套 | ✅ | ✅ | ✅ | ✅ | ✅ |
| APPLE REFERENCE + 可信度 | ✅ 明写「借自 Slider」 | ✅ 明写理由被推翻 | ✅ 两色并存的理由 | ✅ 明写「Apple 没这东西」 | ✅ 同左 |
| 视觉回归快照 | ✅ 10 张 | ✅ 2 张 | ✅ 2 张 | ✅ 2 张 | ✅ 2 张 |

### 我认为还没达到 Apple 水准的地方

1. **Progress 的一切都是借来的。** 轨道高度、两个颜色、圆角全部来自 Slider。
   如果 iOS 的进度条其实比滑杆细（历史上 UIProgressView 是 2pt），这批就是错的 ——
   **没有图可以证伪，也没有图可以证实**。
2. **不定态的斜条纹是我编的。** iOS 的不定态是什么样，资源里没有。
   周期 12px、时长 900ms 全是 `[推定]`。
3. **Skeleton 整个组件都没有 Apple 依据。** Apple 的加载态是转菊花。
   它进这个库纯粹因为 shadcn 生态里常用 —— 这一点写在组件头部，没有粉饰。
4. **Avatar 的尺寸阶梯（24/32/40/56）是照着常见做法定的**，不是量出来的。

### 本批增量

```
组件      18 → 23（+ progress / badge / separator / skeleton / avatar）
示例      32 → 42
行为测试  244 → 264（+20）
视觉快照  165 → 183（+18）
工具      scripts/small-glass.mjs（折射可见度扫描，12 档 × 2 背景）
          apps/www/dev/scale-demo.*（配套实验台）
研究      inventory 第 24 行加「修订二」；STATUS §0.63 就地更正
```

---

## 0.72 Phase 7 第三批 · Tooltip / Toast / InputGroup —— 自查（2026-09-03）

这一批的共同点，和前两批正好相反：**三个都几乎没有 Apple 依据**。

| | Apple 那边有什么 |
|---|---|
| Tooltip | **一句 HIG 原文**，没有图。iOS 27 资源里没有 tooltip（触屏没有 hover） |
| Toast | **什么都没有**。清单写的「接近系统通知横幅」——系统横幅是系统级的，App 画不出来 |
| InputGroup | 只有**一个附件样例**：清除按钮 18×18、右内缩 17（已实测） |

所以这一批的行为测试里**一条几何断言都没有**。钉住推定值只会把它们固化成「标准」，
而这个库最不该干的就是这件事。17 条断言全部是**行为与无障碍语义** ——
那些才有对错。

### 挖出一个真的库级缺陷：`GlassSurface` 会**静默吞掉**调用方的属性

InputGroup 把自己声明成 `ComponentProps<'div'>`、把 props 透传给 GlassSurface，
结果测试里 `[data-slot="input-group"]` 数出来是 **0**。

根因：`GlassSurface` 只解构它认识的那几个 prop，**没有 `...rest`**，
多余的 `id` / `data-*` / `aria-*` / `onClick` 全部被丢掉。
而 **JSX 的展开不做多余属性检查**，TypeScript 一声不吭。

> 这与仓库里踩过四次的 `data-slot` 覆盖是同一家族，但更隐蔽：
> 那边是被**覆盖**（值不对，至少还看得见），这边是被**吞掉**（属性压根不存在）。

已修：`GlassSurfaceProps` 改成继承宿主元素属性，函数收 `...rest` 并**展开在最前面**
（后面那些 data-* 是组件自己的状态契约，不能让调用方覆盖）。

顺带承认另一半：**`data-slot="input-group"` 我本来就忘了写**。
透传修好之后属性才落得上，两件事都要做对才行。

### 一处被禁用的 API 逼出来的设计（以及它的代价）

shadcn 生态里 tooltip 的标准写法是 `<TooltipTrigger asChild><Button/></TooltipTrigger>`。
而 `asChild` 在本库是被 lint 拦住的 —— `shadcn add` 在 base-* style 的工程里
会把它改写成 Base UI 的 `render` prop，与 @radix-ui/react-* 不兼容
（2026-09-01 由 Switch 在安装冒烟测试里真的撞出来过，§0.3）。

一度想给这一处开白名单。**不行** —— 开了就等于把那个 bug 放回来，
lint 规则不是形式主义，它拦的是真事故。

改成本库既有的解法（与 `DialogClose` 同一个思路）：**触发器自己就是那个按钮**。
一个 button，语义干净，键盘只有一个停靠点，还顺手多了一条回归断言
（「触发器里不该再有 button」）。

**代价如实记着**：拿不到本库 `<Button>` 的外观（variant / size）。
Button 没有把样式计算导出来，硬抄一份必然漂移 —— 需要按钮外观时只能自己传 className。
这是**能力缺口，不是疏忽**，写在组件头部和 registry 的 docs 字段里。

### 为什么 Toast 用 Radix 而不是自己写

一个能用的 toast 要处理：live region 的正确用法、计时器在 hover/focus 时暂停、
指针滑动关闭、窗口失焦时不计时、F8 跳到通知区、多条时的焦点顺序。
**这些全是无障碍语义，自己写十有八九是错的。**
本库负责的是它的皮，不是它的行为 —— 与 Dialog / Select 同一个分工。

两个刻意的选择：

- **通知区放在底部**，不是 iOS 系统横幅的顶部。顶部是系统的地盘，
  App 自己的临时消息压在状态栏/导航栏上会挡住系统信息。**这是选择，不是还原。**
- **destructive 只换描边，不换材质。** 红底白字在最通透的档位下会被背景稀释成粉色，
  白字直接掉出 AA。描边 + 正常标签色两边都稳。

### 三处**我自己写错的测试前提**（都不是组件的问题）

1. **tooltip 移开鼠标后立刻断言「没了」** —— Radix 有 grace area，气泡还有离场过程。
   改成按 Escape：那是**有明确契约**的路径。
2. **断言两条 toast 的底色逐位相同** —— 量出来 0.773 vs 0.78。
   那不是 bug，是 §13 的**逐元素自适应可读性**：两条在渐变背景上位置不同，
   各自探测到的最不利底色不同。断言改成「RGB 三通道相同 + alpha 差 < 0.05」。
3. **`getByLabel('密码')`** 把「显示密码」那个按钮也算进来了 —— 要 `exact`。

> 值得记的是第 2 条：**测试红了先问「是组件错了还是我对它的预期错了」**。
> 这次是预期错了，而且错得有信息量 —— 它证明自适应可读性真的在逐元素工作。

### §14 逐条

| 项 | Tooltip | Toast | InputGroup |
|---|---|---|---|
| light / dark 各自调过 | ✅ | ✅ | ✅ |
| 材质档位 0/1/2/3 | ➖ 气泡不吃档位 | ➖ | ✅ 跑了 0 与 1 两端点 |
| Tier A / B / C | ✅ 三档快照 | ✅ | ✅ |
| Layer B / Layer I 分层 | ✅ elevated，**不折射** | ✅ elevated | ✅ **整组只有一块玻璃** |
| 交互态齐全 | ✅ hover / focus / Escape | ✅ 暂停 / 滑动 / 关闭 | ✅ 附件按下 / 禁用 / invalid |
| 移动端 | 🔴 **触屏上根本不可达** —— 见下 | ✅ 滑动关闭 | ✅ |
| 三种无障碍偏好 | ✅ | ✅ reduced-motion 只留透明度 | ✅ |
| WCAG AA | ✅ 1512 采样全绿 | ✅ | ✅ |
| registry item + 冒烟 | ✅ | ✅ | ✅ |
| 文档页四件套 | ✅ | ✅ | ✅ |
| APPLE REFERENCE + 可信度 | ✅ 明写「只有一句话」 | ✅ 明写「什么都没有」 | ✅ 明写借自哪里 |
| 视觉回归快照 | ✅ 6 张 | ✅ 6 张 | ✅ 10 张 |

### 我认为还没达到 Apple 水准的地方

1. **Tooltip 在触屏上是不可达的**，而本库的基准是 iOS。
   这不是实现缺陷，是这个组件形态本身与移动端的冲突 ——
   所以组件头部、registry docs、示例三处都写着
   「**tooltip 里的信息永远不能是唯一的信息来源**」。
   但它仍然是这一批里最不像 Apple 的东西。
2. **Toast 的一切都是我定的。** 圆角 22、停留 5000ms、滑动阈值、堆叠间距 ——
   没有任何东西能证实或证伪。
3. **Toast 的堆叠没有做「叠牌」效果**（iOS 通知中心那种后面几张露出边缘）。
   Radix 不提供，自己做要接管全部定位。**没做，如实记着。**
4. **InputGroup 的高度 44 沿用 Input 的 field 变体，而那一支本来就是推定的** ——
   等于推定值之上再叠一层推定。

### 本批增量

```
组件      23 → 26（+ tooltip / toast / input-group）
示例      42 → 48
行为测试  264 → 281（+17）
视觉快照  183 → 205（+22）
尺寸常量  119 → 137，全部带可信度标注
依赖      +@radix-ui/react-tooltip、+@radix-ui/react-toast
核心      GlassSurface 现在会透传宿主元素属性（修了静默吞属性的缺陷）
样式      optics.css 新增 .lg-toast 的入场/离场/滑动关闭三组动画
```

---

## 0.73 Phase 7 收尾 · Checkbox / Radio Group —— 自查（2026-09-03）

前一批（§0.72）在 §10 里把这两个组件列成「卡在一个该由人拍板的问题上」，
给了三条路，其中第一条是「先找 macOS 参考」。

**参考找到了，而且比预期的多。** 所以那个二选一不必做了 ——
但代价是它同时推翻了两处已经写进库里的判断。

### 一、怎么拿到的 —— 一次「枚举不完整」的教训

macOS 27 的 Figma 文件（fileKey `dRTOe4ObAK8UGqW9CBoJPM`）先后试过：

| 试法 | 结果 |
|---|---|
| `get_metadata`（不带 nodeId） | **只返回一页 "Cover"** |
| `list_file_components_for_code_connect` | 要企业席位 |
| `get_variable_defs` | `{}` |
| WebFetch figma.com | 403 |

四条路全断，一度判断「只能由人工给节点链接」，并且**真的去问了**。

真正能用的是 **`use_figma`** —— 它执行 Figma Plugin API 的 JavaScript。
`figma.root.children` 一次列出**全部 39 个页面**，`Toggles` / `Tooltips` /
`Text Fields` 都在里面。

> **值得记的不是「有个更强的工具」，而是判断链条哪里断了。**
> `get_metadata` 返回一页封面，我把它读成了「这个文件里只有封面」。
> 实际含义只是「这个接口在这个文件上只看得到一页」。
> **一个不完整的枚举返回空，不构成「不存在」的证据。**
> 之前 iOS 那边能直取 `12740:*`，靠的是别处得来的节点号，不是这个列表给的 ——
> 这条线索当时就在手边，没去想。

### 二、推翻之一：**Apple 自己的复选框没有玻璃**

清单第 18、19 行原来标 `B + I(瞬时)`。36 个变体
（`Active` × `State` × `Selection`，明暗两套）全部导出后：

**一个都没有**模糊、折射、色散或高光描边。未选中是 `#000000 @ 0.10` 的
16×16 squircle，选中是一块实心 `#0088ff`。

这不是「资源没画」—— 同一份文件里的 Tooltip 确确实实带着
`BACKGROUND_BLUR 20 + 60` 和半透明填充。同一个 kit、同一批作者，
该有玻璃的地方有，这里没有。

改成内容层，理由两条，第二条是独立成立的：

1. Apple 就是这么做的；
2. **复选框最常见的用法是一组十几个。** 若每个都是一个折射实例，
   一屏就撞穿 §5.2 的 8 个预算 —— Apple 的选择与那条红线自洽。

记在 `component-inventory.md`「修订三」。验证台里有三条
「`.lg-surface` 计数为 0」的断言守着它，否则下一个人「顺手加点材质」
就能把这条结论悄悄推翻。

### 三、推翻之二：**上一批 Tooltip 的几何条条都错**

§0.72 写的是「只有一句 HIG 原文，没有任何图，几何全部 `[推定]`」。
那句话没错，**错的是「iOS 资源里没有 ⇒ 拿不到参考」这个推论** ——
它默认了世上只有一份资源。

| 项 | 实测 | 上一批的推定 |
|---|---|---|
| 内边距 | 上 3 / 右 6 / 下 2 / 左 6（**上下不对称**） | 上下 6 / 左右 10 |
| 字号 / 行高 | **11 / 13** | 13 / — |
| 圆角 | **0** | 8 |

前两条已按实测改。**圆角刻意不采用**：本库所有浮层都有圆角，
且 macOS 的 tooltip 底几乎不透（`#ececec @ 0.88`）而本库是真半透明 +
背景模糊，直角处的模糊边缘会明显锯齿。这是一处写明了的偏离，不是没量到。

「圆角 0」反直觉，所以做了两次独立确认：节点属性四角都读作 0；
逐像素量渲染图，面板左上角 `(0,0)` 的亮度就是本体色 **239**，
没有任何过渡像素（若半径是 2，该点必然接近白）。
缩略图上看着像圆角，是那圈 `#000000 @ 0.40 / blur 2` 紧贴阴影造成的错觉。

### 四、顺带解掉 §9 未决问题 #4 的一半

macOS 27 量到的控件强调色是 `#0088ff`（亮）/ `#0091ff`（暗），
与 iOS 那边量到的 `rgb(0 136 255)` **逐位相同**。
两份互相独立的资源给出同一个值 —— 说明这不是某一份文件的色彩管理误差，
`#0088ff` 就是 Liquid Glass 一代的强调蓝，`#007AFF` 是上一代的值。

### 五、挖出三个真缺陷，两个不在新代码里

**1. `.lg-surface` 之外，Tailwind 的 `shadow-*` 也会静默吞掉值。**

焦点环第一版写的是 `focus-visible:shadow-(--lg-checkbox-ring)`，
类**生成了**、变量**也对**、`:focus-visible` **也命中**，
但 `getComputedStyle().boxShadow` 是六条全透明的零阴影。

原因：`shadow-*` 是个复合工具类，它把值塞进自己的
`--tw-shadow` / `--tw-shadow-color` 机制里重新组装，
而我那个变量里带着 `inset` 和另一个 `var()`，被那套机制拆没了。
改成属性型任意值 `focus-visible:[box-shadow:var(--lg-checkbox-ring)]` 才对。

> 与 §0.63 那次 `.lg-surface` 未分层是同一族：
> **「类名在 DOM 上」不等于「样式生效了」。**

**2. Radix 的单选组方向键**不选中**（上游行为，本库补了）。**

ARIA APG 要求 radiogroup 的选中状态随焦点移动，Radix 也是这么设计的
（`RadioGroupItemTrigger` 的 `onFocus` 里就写着
`if (isArrowKeyPressedRef.current) ref.current?.click()`）。
但在 `@radix-ui/react-radio-group 1.4.7` + React 19 下**它不生效**：
焦点确实移动、roving tabindex 也跟着变，`aria-checked` 一个都不动。

排查记着，免得下次重走：

- **不是事件顺序** —— 打点看到 `document` 的 keydown 早于 focusin，
  也就是那个标志位在 `onFocus` 跑时确实已经是 true；
- **不是本库这层 `<label>`** —— 专门加了一组无标签的对照
  （验证台的 `rg-bare`），表现完全一样。

本库在 Root 上补了这件事，走的正是 Radix 想做的那条路（点一下刚获焦的那项），
用 click 而不是自己改 value，受控/非受控都成立；只在 `aria-checked="false"`
时才点，将来上游修好会自动不动手。

> 这与「无障碍语义归 Radix 管」并不矛盾。分工的意思是不重写它，
> **不是它错了也照抄**。键盘用户选不中是实打实的缺陷。

**3. Tooltip 的气泡本体**从来没有被视觉回归拍到过**。**

`overlay2.visual.spec.ts` 拍的是 `[data-testid^="row-"]`，
而 `TooltipContent` 是 `Portal` 送到 body 下面的 —— 根本不在那个盒子里。
验证台里明明放了一个 `open` 的 tooltip，还注着「视觉回归要拍到气泡本体」。

**是这次改动把它暴露出来的**：按实测把内边距与字号全改了一遍，
那 6 张 tooltip 快照**一张都没动**。已补 `overlay2-tooltip-bubble-{light,dark}`。

> 又一次同类：**注释声称覆盖了，不等于真的覆盖了。**
> 这个仓库里这条已经出现第四次（dev 不走真实构建、`dev:build` 不重建 CSS、
> 可信度门禁只在 CI、workaround 只活在 `slider.tsx`）。

**4. `playwright.docs.config.ts` 的 `reuseExistingServer` 会静默换掉被测对象。**

收尾跑全量时，Materials 页那条「α 滑杆拉到 0 应当报不过 AA」红了，
单独重跑**稳定红 5/5**，看着像 flaky。

真因：docs 那套测的是**生产构建**（`next build && next start`，端口 4200），
而 `reuseExistingServer: !CI` 在本地为真 —— 我为了看新组件文档页
开着的 `pnpm docs`（`next dev`）也在 4200。于是测试直接连上了那个 dev server。
配置里本来就写着「dev 模式下 React 双调用、Next 插调试脚本，
这类断言没有意义」—— 那句话应验了，只是没人想到会以这种方式应验。

停掉 dev server 后 39/39 全过。已在配置里把这个坑写进注释。

> 这条和上面三条是同一个病：**验证跑的到底是哪个东西，得能一眼看出来。**
> 而这次它甚至不是「没覆盖」，是**覆盖到了别的东西上**，更难发现。

### 六、三处**我自己写错的测试前提**（都不是组件的问题）

1. **`if (event.defaultPrevented) return`** —— 整段成了死代码。
   插桩量出来：进到本处理器时它**已经是 true**。
   Radix 的 Slot 合并顺序是「先 slot 后 child」，RovingFocusGroup 的
   keydown 排在前面，而它对方向键一律 `preventDefault`（挡页面滚动）。
   在那个位置上这个标志位恒为 true，不携带任何信息。
2. **keydown 里 `requestAnimationFrame` 之后读 `document.activeElement`**
   —— 那一帧焦点**还停在原来那一项**上。RovingFocusGroup 移动焦点比一帧更晚。
   最终不猜时机，改成监听焦点事件本身。
3. **读颜色 / 阴影读早了**（两条测试各中一次）。
   `__ready` 是在 `queueMicrotask` 里置位的，早于 Provider 挂载后
   「把系统偏好写到 `<html>`」的 effect；属性一翻，值要沿 150ms 过渡爬过去。
   高对比那条期望 0.34、量到 0.14；焦点环那条量到 `0.0325px`。
   而且第一次「修」的时候等待条件写成「不再是全透明」—— 过渡一起步就满足了，
   仍然读在半路。必须等它**不再变化**（连续 5 帧同值）。

> 第 3 条与 §0.72 的第 2 条是同一个教训的第二次出现：
> **测试红了先问「是组件错了还是我对它的预期错了」。**
> 这次两次都是预期错了。

**外加一次不是测试、是我操作的错。** 为了看新组件的文档页，起了一个 dev 预览
挂在 4200 上没关，随后跑 `test:docs` 时那个服务被 webServer 复用了 ——
而 docs 测试测的是**生产构建**（dev 下 React 双调用、Next 插调试脚本，
「控制台是干净的」这类断言在 dev 下没有意义）。
于是「α 滑杆拉到 0」那条稳定失败 5/5，看起来像是我改坏了什么。

`playwright.docs.config.ts` 里**早就写着**「本地复用现有服务是个陷阱，
踩过一次（2026-09-03）」。同一天踩了第二次。
关掉预览服务后 39/39 全绿。

> 记这一条不是为了自责，是因为它与本节第 5 点第 3 条是同一个形状：
> **一个只写在某一处的告诫，对不看那一处的人等于不存在。**

### §14 逐条

| 项 | Checkbox | Radio Group |
|---|---|---|
| light / dark 各自调过 | ✅ | ✅ |
| 材质档位 0/1/2/3 | ➖ **没有玻璃，这一维不存在** | ➖ 同 |
| Tier A / B / C | ➖ 同上 —— 换成跑**背景频率**（条纹 / 分组底） | ➖ 同 |
| Layer B / Layer I 分层 | ✅ 内容层，且有三条「玻璃计数为 0」断言 | ✅ 同 |
| 交互态齐全 | ✅ 未选 / 已选 / 半选 × idle / 按下 / 禁用 | ✅ 未选 / 已选 × 三档 |
| 移动端 | ✅ 命中区撑到 44×44（视觉仍 16） | ✅ 同 |
| 三种无障碍偏好 | ✅ 高对比另开了一套 token | ✅ 同 |
| WCAG AA | ✅ 1512 采样全绿 | ✅ |
| registry item + 冒烟 | ✅ 已加进安装冒烟的组件清单与 token 断言 | ✅ |
| 文档页四件套 | ✅ | ✅ |
| APPLE REFERENCE + 可信度 | ✅ 163 个常量全部带标注 | ✅ |
| 视觉回归快照 | ✅ 6 张（含焦点环、高对比） | ✅ 2 张 |

### 我认为还没达到 Apple 水准的地方

1. **squircle 只是近似。** 实测 `cornerSmoothing 0.6`，而 CSS 的
   `corner-shape` 要 Chrome 139+，不能依赖。现在是把半径乘一个 >1 的系数，
   视觉上更饱满 —— 但**不是**超椭圆。要真做需要自绘路径。
2. **按下态明暗不对称。** 实测是「亮色每通道减 25、暗色每通道加 20」，
   都朝离背景更远的方向走。CSS 没有 LINEAR_BURN / LINEAR_DODGE，
   现在只近似了亮色一侧；暗色一侧应当变亮而实际变暗。
3. **强调色差半档。** 实测 `#0088ff`，本库用 `--lg-accent-fill`（`#0071eb`）。
   一致性优先，但那确实不是 Apple 的那个蓝。
4. **`Active=False`（窗口失焦）整个维度没有实现。** Web 没有这个概念，
   资源里那 18 个变体就此作废 —— 不是缺陷，但确实是「资源里有、库里没有」。
5. **组内行距 14 的依据比别的弱**：它取自样例区的排布（行距 30 − 控件 16），
   不是规格标注。标了 `[实测]`，但限定语必须跟着。

### 本批增量

```
组件      26 → 28（+ checkbox / radio-group）
示例      48 → 52
行为测试  281 → 305（+24）
视觉快照  205 → 217（+10 新组件，+2 补上 tooltip 气泡）
尺寸常量  137 → 163，全部带可信度标注
依赖      +@radix-ui/react-checkbox、+@radix-ui/react-radio-group
token     新增 --lg-toggle-fill / -pressed / -disabled（明暗 + 高对比共四套）
修正      tooltip 的内边距与字号改为实测值；registry-smoke 纳入两个新组件
```

---

## 0.74 P2 第一批 · Accordion / Collapsible / ScrollArea / Table —— 自查（2026-09-04）

P1 收尾时说「macOS 资源解锁之后有几件旧事可以重做」，这一批就是第一次兑现：
四个组件**全部有 macOS 27 实测依据**，不是硬做出来的。

### 一、这一批的特殊之处：要分清「零件实测」与「拼法自定」

前几批的组件大多有成品参照物。这一批有两个**没有**：

| 组件 | 资源里有什么 | 于是 |
|---|---|---|
| Collapsible | 完整的 Disclosure Button（五档尺寸 × 三档状态 × 明暗） | 触发器全实测 |
| **Accordion** | **只有零件** —— Disclosure Button + 一个空的 Group Box | 零件实测，**拼法全是 `[推定]`** |
| ScrollArea | 完整的 Scrollbar（竖 / 横 × 三档比例） | 滚动条全实测 |
| Table | 完整的 NSTableView（表头 / 行 / 三档行色 / 五级缩进） | 几何全实测 |

> Accordion 那一行是这批里最容易糊弄过去的地方。
> 「Apple 有 Disclosure Button，所以我的手风琴是实测的」——**这句话不成立**。
> Group Box 在资源里就是一个空的圆角矩形，里面什么都没画：
> 项与项之间怎么分、标题行多高、内容区内缩多少，一条依据都没有。
> 组件头部把这两半分开列了。

### 二、推翻之三、之四

**修订五：Accordion 的「无直接对应」说得太满。** Apple 确实没有这个控件，
但有两个能量的零件。正确的说法是「零件实测 + 拼法自定」，
而不是一句「没有对应物，全部推定」—— 后者会把有依据的那一半也一起否掉。

**修订六：Table 的 Apple 对应写混了两样东西。** 清单原文是
「UITableView / lists-and-tables」。但 iOS 的 UITableView **就是分组列表**
（本库的 `Card`，行高 52、圆角 26，早就实测过了）；
而带列、可排序表头、交替行的**数据表格，iOS 上根本没有**。

这不是文字游戏，有实践后果：照着「UITableView」去找 `Table` 的人，
会拿到一个 macOS 密度的数据表格。组件头部与 registry docs 两处都写了
「要 iOS 列表请用 Card」。

### 三、一个没法照搬的东西：SF Symbols 字形

资源里的人字形（`chevron.down` / `.up`）和表格的排序指示器，
存的都是**私有区码位**（U+10018x 一带）。那些码位只有装了带 SF Symbols 的
SF Pro 才有字形 —— **在绝大多数浏览器里是豆腐块**。

一个组件库把自己的展开指示器押在「用户装了 Apple 的字体」上，不能接受。
所以这两处都自己画了 SVG，并且**明确标成 `[推定]`**：
与 Checkbox 的对勾不同，那边资源里真的有 `vectorPaths` 可以逐点取，
这边没有 —— 只有「是个 chevron、朝下 / 朝上、随字号缩放」是有依据的。

### 四、挖出三个真缺陷，两个是我自己写的

**1. 竖向滚动条的滑块被 `flex-1` 撑满了整条轨道。**

Radix 用内联样式给滑块设**次轴**尺寸（竖向条设 height），主轴那一维交给
`flex-1` 撑满。我给竖向条也写了 `flex-col`，主轴方向就反了 ——
`flex: 1 1 0%` 把内联 height 覆盖掉，量出来滑块高 **154**，
正好是整条轨道，看上去就像「滚动条不会动」。

> 对照 shadcn 的实现：它的 ScrollBar 竖向时**没有** `flex-col`，
> 所以 `flex-1` 撑的是宽度，height 正常生效。抄错的是我。
> 现在有一条断言钉着「滑块长度 < 轨道 × 0.9」。

**2. 边缘效果的默认高度在容器里太厚。**

`GlassScrollEdge` 的默认 72px 是给**整屏**的栏设计的。
放进一个 160px 高的滚动容器，实测盖掉了 **45%** 的可视区域。
ScrollArea 另给了一个 40 的默认值（同样 `[推定]`），并暴露 `edgeHeight`。

**3. 滚动条默认档位在触屏上等于永不显示。**

Radix 默认 `type="hover"`。触屏没有 hover —— 那一档等于滚动条永远不出现。
改成 `scroll`（对应 macOS 系统设置里「显示滚动条：滚动时」）。
顺带一提这也是可测性问题：`hover` 下滚动条**根本不进 DOM**，写不了回归。

### 五、两处**我自己写错的测试前提**

1. **两条动效测试都取了 `.first()`，而第一项是「初始就展开」的。**
   Radix 对这种项会内联一句 `animation-name: none`（避免挂载即播动画）。
   于是 reduced-motion 那条量到 `none`，**假阳性通过**；
   正常动效那条也量到 `none`，红了 —— 反而是它把上面那条的假阳性暴露出来的。
   两条都改成盯**闭合**的那一项，才真的有区分力。

2. **验证台里有两张表（default / compact），`tr` 的 testid 撞了。**
   Playwright 的 strict mode 直接报「resolved to 2 elements」。
   这是好事：宽松匹配会静默地量错一张表。

> 另外还有一处不是错、但值得记：Group Box 的等效底色 `0.015`，
> Chromium 会舍成 `0.016`。断言不能逐字比字符串，要比数值。

### §14 逐条

| 项 | Collapsible | Accordion | ScrollArea | Table |
|---|---|---|---|---|
| light / dark 各自调过 | ✅ | ✅ | ✅ | ✅ |
| 材质档位 0/1/2/3 | ➖ 没有玻璃 | ➖ | ➖ 滚动条没有 | ➖ |
| Tier A / B / C | ➖ | ➖ | ✅ **边缘效果跑了 A / C 两端点** | ➖ |
| Layer B / Layer I 分层 | ✅ 内容层，有计数断言 | ✅ 同 | ✅ 只有边缘带是 core 的玻璃 | ✅ **SPEC 明令禁止，有断言** |
| 交互态齐全 | ✅ 开 / 合 / 按下 / 禁用 | ✅ 单开 / 多开 / 禁用 | ✅ 三档 type / 滚动位置 | ✅ 交替 / 选中失焦 / 选中有焦点 / 排序 |
| 移动端 | ✅ 命中区补到 44 | ✅ 标题行 44 | ⚠️ 见下 | ⚠️ 见下 |
| 三种无障碍偏好 | ✅ | ✅ 高度动画在 reduced 下整个去掉 | ✅ 高对比下滑块加深 | ✅ 高对比下交替行加深 |
| WCAG AA | ✅ 1512 采样全绿 | ✅ | ✅ | ✅ 选中蓝配白字 5.29:1 |
| registry item + 冒烟 | ✅ 已加进安装冒烟 | ✅ | ✅ | ✅ |
| 文档页四件套 | ✅ | ✅ | ✅ | ✅ |
| APPLE REFERENCE + 可信度 | ✅ 196 个常量全部带标注 | ✅ | ✅ | ✅ |
| 视觉回归快照 | ✅ 2 张 | ✅ 2 张 | ✅ 6 张（含边缘效果 A/C） | ✅ 4 张 |

### 我认为还没达到 Apple 水准的地方

1. **人字形与排序指示器是我画的，不是 Apple 的。** 见第三节。
   这是这一批里最明显的一处「看起来对但没有依据」。
2. **ScrollArea 的滚动条在触屏上仍然只是装饰。** iOS 的滚动指示器是系统画的，
   Web 上拿不到；`type="scroll"` 至少让它在滚动时出现，但触屏用户仍然
   不能拖它 —— Radix 支持拖，只是 6px 宽的滑块在手指下几乎点不中。
   **没有为触屏放宽滑块**，因为那就不是实测值了。如实记着。
3. **Table 的默认行高 32 是我定的。** 20 才是实测值。
   在「还原 macOS」和「触屏能用」之间只能选一个，选了后者并标了 `[推定]`。
4. **Accordion 的项间分隔线沿用 iOS 分组列表的做法**（最后一项不画），
   而区块底是 macOS 的 Group Box —— 两个来源混在一起。
   这是没有依据时的取舍，不是还原。
5. **`Active=False`（窗口失焦）整个维度仍然没有实现**，与 Checkbox 那批同因。
   Table 那边把它挪用到「表格自己失焦」上 —— 语义相近，**不是同一件事**。

### 本批增量

```
组件      28 → 32（+ collapsible / accordion / scroll-area / table）
示例      52 → 60
行为测试  305 → 332（+27）
视觉快照  217 → 231（+14）
尺寸常量  163 → 196，全部带可信度标注
依赖      +@radix-ui/react-{accordion,collapsible,scroll-area}
token     新增 disclosure 三档、scrollbar 滑块、表格四项、groupbox 底
          （明暗 + 高对比共四套；⚠️ 其中暗色的 scrollbar 与表格**全部是推定**）
样式      optics.css 新增 .lg-collapsible-content 的展开/收起动画
```

---

## 0.75 三个旧推定值被推翻 —— 靠「读属性」而不是「拟合像素」（2026-09-04）

为 P2 第二批去 iOS 文件取 Page Control / Context Menu 的路上，
顺手把三个挂了很久的 `[推定]` 换成了实测。**方法只有一句话：
Figma 节点上的 `cornerRadius` 是个属性，直接读就有。**

| 组件 | 原值 | 实测 | 当年为什么没拿到 |
|---|---|---|---|
| DropdownMenu 面板 | `[推定]` 22 | **34** | 圆弧最小二乘 RMSE 1.5–2.2px，超椭圆里 r 与 n 互换 → 判为「不可辨识」 |
| Popover 面板 | `[推定]` 22 | **38** | 同上；§0.52 写着「唯一一个量不出来的几何」 |
| Sheet 下两角 | `[推定]` 34（按对称） | **58** | 拟合出 r≈60、RMSE 2.5，**被判成「在量影子」丢掉了** |

三处都曾认真拟合过，两处失败、一处把对的答案扔了。而这三个数在节点属性上
一直摆着 —— 当年量这个菜单用的就是同一个节点 `12740:24185`。

### 两条教训，第二条更值钱

1. **拟合失败不等于数据拿不到。** 渲染图是信息**已经损失过**的产物
   （半透明玻璃压在中灰上，外有落影内有亮描边，边界不是干净台阶）。
   在损失过的产物上做更精巧的反演，不如换一个没损失的接口。
   与 §0.73 那条「`get_metadata` 只回一页不等于文件里只有一页」同形。

2. **把异常值判成噪声之前，先问「如果它是真的，能不能解释得通」。**
   Sheet 下两角拟合出 **60**，离真值 58 只差 2。当年的判断是「噪声」——
   但 58 是有意义的：sheet 左右各内缩 6，与设备圆角**同心**，
   `concentricRadius(64, 6) = 58`。只要把那个「噪声」代进本库自己的同心公式
   算一下就会发现。**工具箱里已经有验算它的东西了，没去用。**

> 顺带纠正一处事实认定：Sheet 的四个角**不同值**（上 34、下 58），
> 下两角要贴着屏幕圆角走。原来「四角同取 34」是错的，不只是不精确。

### 一处如实记下的测试盲区

改完之后 **231 张视觉快照一张都没动**，而行为测试立刻红了三条。
也就是说：**`maxDiffPixelRatio: 0.01` 足以吞掉一个 12–16px 的圆角变化**
（250px 宽的面板上，四个角受影响的像素约占 0.5%）。

没有为此收紧容差 —— 那个容差是用来吸收字体与抗锯齿差异的，收紧会让整套快照变脆。
**真正的回归防线放在行为测试里**：三条断言现在钉的是
`border-radius` 的**确切计算值**（含四角分别断言），比像素比对更强也更好读。
但「视觉回归覆盖了圆角」这句话是不成立的，记在这里。

---

## 0.76 P2 第二批 · Pagination / Breadcrumb / ContextMenu / Resizable —— 自查（2026-09-04）

**这一批是「两有两无」，而选批次本身就是这次的一条方法**：
上一批收尾时我建议的是 `Pagination / Breadcrumb / Resizable / Navigation Menu`。
动手前先去两份资源里查了一遍，结果改了：

| 组件 | 查到什么 | 决定 |
|---|---|---|
| Pagination | iOS 有完整的 **Page Controls** 页（3 变体 + 6 档指示器） | 做，几何全实测 |
| Context Menu | iOS 有 **Contextual Menus** 页 + 一个 Dimming Overlay | **换进来**（原计划没有） |
| Breadcrumb | 两份资源**都没有**，macOS 连 Path Controls 页都不存在 | 做，但全部 `[推定]` |
| Resizable | macOS 那张 Split View 是**布局稿**，中间没有分隔条元素 | 做，分隔条全 `[推定]` |
| ~~Navigation Menu~~ | 有依据，但组件体量大 | **换出去**，让位给能复用现有菜单材质的 Context Menu |

> **先查资源再定批次**，比先定批次再去凑依据强。
> 上一批那句「建议下一批做 X」是在没查之前写的，照着做会白做半批。

### 一、Context Menu 是这批最划算的一个 —— 因为它几乎不需要新几何

量出来 Context Menu 的菜单项是 **218 × 40**，与 §7.6 从 Edit Menu
（另一个互不相关的节点）量到的**逐位相同**；面板宽同为 250，分隔区同为 21。

所以本组件**直接 `import { MENU_GEOMETRY }`**，而不是抄一份数字过来。
将来那边修正了，这边自动跟着走 —— 事实上**这次就发生了**：
同一天把菜单面板圆角从推定的 22 改成实测的 34（§0.75），
Context Menu 什么都没改就跟着对了。

唯一属于它自己的是**背景压暗层**：`#000000 @ 0.23`，实测，**没有模糊**。
「没有模糊」是量出来的，不是漏看 —— 那个节点的 effects 是空的。
直觉上 iOS 好像会虚化背景，资源里就是一层纯色。照做。

### 二、两个「没有依据」的组件，怎么做才算诚实

Breadcrumb 与 Resizable 在两份资源里都查无此物。做法与 Skeleton / Toast 一致：

1. **每个数字标 `[推定]`**，一个不漏；
2. **写明借自哪里** —— 字号 17 借自 Card 行标签、行高 44 取 HIG 触控下限、
   分隔线 1px 与 Separator 同源。这样它至少与库里其它组件自洽，
   而不是各拍各的脑袋；
3. **借来的实测值不因为借了就变成实测值**，这句话写进了组件头部；
4. **明确列出不做什么**：Breadcrumb **不实现自动折叠**
   （折叠阈值、折几级、点开是什么，四个连环推定），
   Resizable 的分隔条**不上玻璃**（1px 宽，模糊看不出来，白占折射预算）。

### 三、一处不得不违反 HIG，写在明面上

Resizable 的分隔条命中区只有 **8pt**，够不到 HIG 的 44 ——
一条 44pt 宽的分隔条会吃掉两侧内容，而它视觉上只有 1px。

代偿两条，都落实了：**键盘路径始终可用**（分隔条可聚焦、方向键调整，有测试钉），
以及在 registry docs 里写明**布局不应该依赖用户去拖它**。
这是本库第一次明确写下「这里做不到 44，以下是替代路径」。

### 四、三个真缺陷，全部来自上游 API 的变化或约束

**1. Radix 的 `Portal` 只接受单个元素子节点。**

第一版把压暗层和 `Content` 塞进了同一个 `Portal`，右键**毫无反应** ——
控制台抛的是 `Primitive.div failed to slot onto its children`。
Radix 的 Portal 内部是 `<Primitive.div asChild>`。

改成两个 Portal 之后又冒出第二个问题：Radix 只替 `Content` 做挂载/卸载，
裸 `div` 它不管 —— 菜单没开时压暗层也一直挂着。
最后在 Root 上接 `onOpenChange` 自己存了一份 open。

**2. `react-resizable-panels` v4 换了一整套 API。**

`PanelGroup → Group`、`PanelResizeHandle → Separator`、`direction → orientation`，
而且不再输出 `data-panel-group-direction`（改读 `aria-orientation`，
语义还是反的：竖向组里的分隔条自己是 `horizontal`）。
**shadcn 官方那份 resizable.tsx 还是 v3 的写法，照抄直接编译不过。**

**3. v4 会覆盖调用方传的 `data-testid`。**

它内部用 `data-testid={id}` 标自己生成的 id（`_r_0_` 这种），写在展开之后。
实测：传 `rz-group` 进去，DOM 上是 `_r_0_`。

> 这与本仓库踩过五次的 `data-slot` 覆盖是同一家族，**只是这次覆盖方是上游**。
> 所以 Resizable 的测试与样式一律靠 `data-slot` 选中，
> 并把这条写进了组件头部与 registry docs。

### 五、一处我自己写的布局 bug

把手（那个小横条）第一版留在流里，结果**分隔线被撑成 3px**：
分隔条是 flex 项且 `flex-basis: 1px`，但 flex 项的 `min-width` 默认是 `auto`，
3px 宽的把手成了最小内容宽。改成绝对定位。
现在有一条断言钉着「分隔线 1px，且把手必须是 absolute」。

### §14 逐条

| 项 | Pagination | Breadcrumb | ContextMenu | Resizable |
|---|---|---|---|---|
| light / dark 各自调过 | ✅ | ✅ | ✅ | ✅ |
| 材质档位 0/1/2/3 | ➖ 容器是 Ultrathin，不吃档位 | ➖ 无玻璃 | ➖ 与 DropdownMenu 同 | ➖ 无玻璃 |
| Tier A / B / C | ✅ 三档快照 | ➖ | ✅ tier c 单独一张 | ➖ |
| Layer B / Layer I 分层 | ✅ 容器是玻璃，有断言 | ✅ 内容层 | ✅ B + I | ✅ 分隔条**不上玻璃**，有断言 |
| 交互态齐全 | ✅ 指示器 / 可点两种模式 | ✅ hover / focus | ✅ 右键 / Esc / 点外面 / 方向键 | ✅ 拖 / 聚焦 / 键盘 |
| 移动端 | ⚠️ 见下第 2 条 | ✅ 每级 ≥44 高 | ✅ 长按由 Radix 提供 | 🔴 **8pt 拖不动**，见第三节 |
| 三种无障碍偏好 | ✅ | ✅ | ✅ | ✅ |
| WCAG AA | ✅ 1512 采样全绿 | ✅ | ✅ | ✅ |
| registry item + 冒烟 | ✅ | ✅ | ✅ | ✅ |
| 文档页四件套 | ✅ | ✅ | ✅ | ✅ |
| APPLE REFERENCE + 可信度 | ✅ 215 个常量全部带标注 | ✅ 明写「两份资源都没有」 | ✅ | ✅ 明写「只有布局稿」 |
| 视觉回归快照 | ✅ 6 张（含三档 Tier） | ✅ 2 张 | ✅ 3 张（整页拍，含压暗层） | ✅ 2 张 |

### 我认为还没达到 Apple 水准的地方

1. **Context Menu 的 Quick Actions 那一排没有做。** 值全部实测并记在 §12.2
   （整排 56 高、单项 72.67 宽 / 圆角 20、标签 SF Pro Medium 12、破坏性 `#ff383c`），
   但**本批没实现**。那是 iOS 上下文菜单最有辨识度的一半，缺了它就只是个普通菜单。
2. **Pagination 在触屏上仍然点不准单个点。** 8pt 点、16pt 节距，
   命中区只能往竖直方向撑。Apple 的做法是把整条当左右分区处理，
   本库**没有实现那个分区行为** —— 只做了「点哪个点跳哪页」。
3. **Resizable 的分隔条触屏上基本不可用**（8pt）。有键盘路径兜底，
   但那对触屏用户等于没有。这是这一批唯一一处 §14「移动端」判红的。
4. **Breadcrumb 与 Resizable 的每一个数字都是我定的。** 不是「量不准」，
   是**根本没有可量的东西**。

### 本批增量

```
组件      32 → 36（+ pagination / breadcrumb / context-menu / resizable）
示例      60 → 68
行为测试  332 → 352（+20）
视觉快照  231 → 244（+13）
尺寸常量  196 → 215，全部带可信度标注
依赖      +@radix-ui/react-context-menu、+react-resizable-panels
token     **没有新增** —— Pagination 的两个点色正好落在既有 label token 上
```

---

## 0.77 P2 第三批 · Sidebar / Menubar / Navigation Menu —— 自查（2026-09-04）

**这一批只有一件真正重要的事：HIG 里那句单独点名侧栏的规则，第一次有了数字。**

清单第 43 行从 Phase 0 起就抄着这句话：

> Liquid Glass … is more opaque in larger elements like sidebars.

一年来它一直只是一句引文 —— **HIG 只给了一句话，没给数字**，所以库里一处都没实现过。
这次去 iOS 27 资源里读节点属性（`10472:45236`，Sidebar 的 `BG`），拿到了：

| | 覆盖层不透明度 | 背景模糊 |
|---|---|---|
| Page Control（§12.1，控件层，Ultrathin） | `#ffffff@0.070` + `#ffffff@0.030` ≈ **0.10** | `r=100` |
| **Sidebar**（导航层，大面积） | **0.92** | `r=80` |

差九倍。那句话是字面属实的。

### 一、❗ 顺手推出来的第二条结论是**反的**，这条更值钱

「面积越大 → 糊得越狠」听起来天经地义。**资源否掉了它**：侧栏的模糊是 80，
比控件层的 100 **还小**。变的只有不透明度。

所以本批**只改了不透明度，没有动模糊**，并且专门写了一条断言钉住
「两块玻璃的 `backdrop-filter` 必须完全一致」——
将来有人顺手把 blur 一起调大，测试立刻红。

> 这与 §0.75 那条教训是同一族：**推论再自然，也要回去看一眼数据。**
> 上次是「拟合失败 ≠ 数据拿不到」，这次是「说得通 ≠ 是真的」。

### 二、落地时踩的坑：加数加错了对象，侧栏变成纯白板

第一版写的是 `--lg-base-alpha + 0.3`，理由是「默认档 0.62 + 0.3 = 0.92，正好命中实测」。

**0.62 是 CSS 兜底值，不是运行时的值。** GlassProvider 写下去的
`--lg-base-alpha` 是**加过可读性地板**的 **0.7341**，再 +0.3 = 1.034，
被 `min(1)` 夹成 **1.0** —— 侧栏一点玻璃都不剩，量出来就是 `rgb(255,255,255)`。

改成对**美学值**加成、再对地板取 `max`：

```css
min(1, max(var(--lg-base-alpha), calc(var(--lg-base-alpha-raw) + var(--lg-large-boost))))
```

默认档命中 **0.92**（实测值），滑杆推上去时侧栏跟着变厚，且永远不会比
可读性要求更透。测试直接钉死 0.92，并额外钉一条 `< 1`（被夹成不透明就不是玻璃了）。

> **教训：CSS 文件里的兜底值不等于运行时的值。** 这个仓库里
> `--lg-base-alpha` 有三个来源（CSS 兜底 / SSR 脚本 / Provider 内联样式），
> 拿其中一个去推算另一个，就会得出一个「算起来对、跑起来错」的数。

### 三、Menubar：实测**推翻**了清单自己的分层结论

清单第 37 行写的是 `**B + I**（高亮项）`。iPadOS 菜单栏（`5413:10006`）
四个变体的 `fills` / `effects` / `strokes` **全是空的** ——
**条本身不是玻璃**，它直接压在壁纸或内容上。

有材质的只有展开中的那一项（`#767680 @ 0.12` + 投影 0/2/16 的 8% 黑）与弹出的面板。

所以本库默认渲染一条**透明**的菜单栏，并留了一个显式的 `surface` prop
给「必须自己撑出可读性」的场景 —— prop 的文档、示例、registry 说明三处
都写明**那是本库的扩展，不是 iPadOS 的做法**。

有一条测试专门钉「条本身不是玻璃」。**这是防回归，不是防偏差** ——
将来有人觉得「菜单栏怎么能没有底」顺手加一块，它会立刻红。

### 四、又一次撞上既有 token —— 这次是第三处独立佐证

| 实测 | 命中的 token | 差 |
|---|---|---|
| 侧栏搜索框 `#787880 @ 0.16` | `--lg-fill-secondary` | **逐位相同** |
| 菜单栏展开项 `#767680 @ 0.12` | `--lg-fill-tertiary` | R/G 各差 2 |

加上 §10 的 `#0088ff`，这是第三次看到
**Apple 的 `#787880` / `#0088ff` 基色在导出时有 ±2 的色彩管理漂移**。
本批因此**没有新增任何颜色 token**（与 Pagination 那批一样）。

### 五、三个真缺陷，两个来自上游

- **`NavigationMenuViewportImpl` 把 `children` 解构掉扔了。**
  第一版把 `<GlassSurface>` 写在 `<Viewport>` 里面，它**一声不响地消失**，
  控制台一个字都没有。这与本仓库踩过五次的 `data-slot` 覆盖是同一家族：
  上游把调用方传的东西吃掉了 —— 那边是被覆盖（值不对，还看得见），
  这边是被吞掉（元素压根不出现）。
  改成 Viewport 的**兄弟节点** + 自管 `open`（关掉时要把还在投影的那块玻璃摘走），
  并有一条测试专门钉住玻璃真的在。

- **Radix 的 `Dialog.Portal` 只接受单个元素子节点**（上一批 ContextMenu 已记过）。
  这次绕开了，写法直接抄 dialog.tsx —— motion 元素**嵌在** Radix 部件里面，
  不用 `asChild` 顶替。第一版随手写了 `asChild`，被 `registry-lint` 当场拦下。
  **那条 lint 规则这次真的省了事**，不是摆设。

- **折叠后的侧栏宽度是 0，但里面的按钮仍然可以 Tab 到**（我自己的 bug）。
  焦点会跑进一块看不见的区域，读屏还会照读不误。加了 `inert`；
  不能用 `hidden`，那样宽度动画就没有东西可过渡了。

### 六、刻意的偏离，逐条写下来

- **紧凑视口不走 SPEC §9 的底部 Drawer。** §9 说的是「从触发点弹出的浮层」，
  侧栏不属于那一类 —— 它是一块导航区域，iOS 自己在紧凑宽度下的行为是
  `UISplitViewController` 的 `.overlay`：**从前缘滑出的覆盖层**。
  用 Radix Dialog 实现（焦点陷阱 / Escape / 滚动锁由它提供），
  **没有**复用本库的 `<Sheet>`（那是带档位的底部面板，没有 `side` 的概念）。

- **不采用 macOS 侧栏的三档行高**（Small 24 / Medium 32 / Large 36）。
  基准是 iOS，那边行高就是单一的 44 = HIG 最小触控目标；
  macOS 的三档全在 44 以下，是鼠标语境的产物。**看过了，选择不用。**

- **与 shadcn 的 API 差异**：本库把 `SidebarMenu > SidebarMenuItem > SidebarMenuButton`
  三层合成一层 `<SidebarItem>`，并且没有做 rail / inset / cookie 持久化 / 全局快捷键。
  那些都不来自 Apple 资源，是 shadcn 自己的产品决定。

### 七、🔴 欠着的，如实列

- **`NavigationMenu` 没有移动端 Drawer 路径。** SPEC §9 **点名**了它，
  但 Radix 的 `Viewport` 定位与 `<Sheet>` 的档位面板没法共存
  （与 DropdownMenu 那次同一个冲突，那边的解法是自己接线，这里没做）。
  **这是本批唯一一个欠着 §9 的组件。**
- **没有实现侧栏的 `SATURATION` 层**（把背景去饱和到 15%）。本库的控件玻璃是
  `saturate(1.7)`，**方向正好相反**。理由：覆盖层已经 0.92 不透明，背后只剩 8%
  透出来，去饱和是二阶效应；而落成 CSS 就得自己挑一个 `saturate()` 数值 —— 那是编的。
  **测到了，没做，不假装。**
- **没有实现 `Active=False`（窗口失焦）那一档 0.97。** Web 上没有干净的对应概念。
- **没有接 `NavigationMenu.Indicator`**（面板上方那个小箭头）。Popover 的箭头
  上一批刚量到（56×13，材质 Thick），那是**有实测**的形状；这里随手放一个
  尺寸不同的箭头只会自相矛盾。

### 八、顺手修掉的一处旧显示 bug

`EDITORIAL` 里的 `layerB` / `layerI` 写着 `**重点**` 与 `` `代码` ``，
但组件页把它们**直接插进 JSX**，星号与反引号**原样露在页面上** ——
Table 那页的「\*\*明令禁止\*\*」就这样露了一路。改走 `RichText`，一次修好所有页。
（`description` 早就走 RichText 了，`layerB` 是漏的那一个。）

### 九、验证

| 项 | 结果 |
|---|---|
| 行为测试 | **375 通过**（+23） |
| 视觉快照 | **258 通过**（+14，含一张材质对照图） |
| 文档站测试 | **39 通过**，且三个新页**都进了控制台零告警名单** |
| 对比度审计 | 108 组合 × 14 测点 = **1512 采样全达标** |
| registry-lint | 107 个文件通过（`asChild` 那条真的拦下了一次） |
| `shadcn registry validate` | 39 项 / 2 文件，有效 |
| typecheck | 干净 |
| 尺寸常量 | **247 个，全部带可信度标注，0 个没有** |

组件 36 → **39**，示例 68 → **74**。

> ⚠️ 那张**材质对照快照**（同一块渐变上，左控件层、右侧栏）是本批唯一一张
> 真有信息量的图 —— 「更不透明」肉眼可见与否全靠它。
> 侧栏本身没有 Fidelity 对照图：资源里的侧栏是画布上一列孤立行，
> 而这个组件的全部看点恰恰是**它压在什么上面**。

### 十、P2 还剩 5 个

`Data Table` / `Command` / `Combobox` / `Calendar` / `Date Picker`。

**下一批建议先量 `507:24680 Date and Time Pickers`** —— iOS 有一整页，
`Calendar` 与 `Date Picker` 是同一份资源里的两个形态，一起做能共用几何，
与这次 `Menubar` + `NavigationMenu` 共用面板是同一个道理。

`Command` / `Combobox` 两份资源里大概率都没有（`Command` 接近 Spotlight，
那是系统级的，设计资源里不会有）；`Data Table` 复用已完成的 `Table`。
**照例：先量再定。** 这已经是连续第三批证明那样更省事。

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

> ⚠️ **上面这张树是 Phase 1 / 2 时期的快照，早就落后了**（2026-09-03 标注）。
> 下面那句「尚未写任何 UI 组件」在写下时是对的，现在**已经不成立** ——
> P0 与 P1 共 28 个组件都已交付。
>
> 不在这里重画整棵树，是因为它会与每一批的 §0.5x–0.7x 自查重复，
> 而那些才是逐批更新的。**当前口径一律看最后一节 §0.7x**，
> 组件与示例的权威清单是 `apps/www/registry.json` 与 `registry/glass/examples/`。

~~**尚未写任何 UI 组件** —— Phase 1 / 2 都不产出组件，符合任务卡要求。~~
`@glass/core` 的光学引擎与 token 体系均已实现，见 §1、§2。

---

## 10. 下一步（2026-09-03 更新）

**Phase 0 / 1 / 2 / 5 已完成；Phase 3 的 P0 组件 11 / 11 全部交付；
Phase 4 的核心原语已落地；Phase 6 的任务卡 7 项全部完成；
Phase 7 已交付三批（表单四件 + 小件五个 + overlay 三个），
**P1 14 个里做完 12 个，只剩 Checkbox / Radio Group**。**

| 已交付 | §14 成绩 |
|---|---|
| Tabs / Segmented · Slider · Switch · Button · Dialog | 各 12 项过 **11** |
| Toggle | 12 项过 10 |
| Card | 12 项过 10（另 2 项不适用） |
| Sheet / Drawer | 12 项过 10（1 项明确未达标、2 项不适用） |
| Popover | 12 项过 10（2 项不适用 —— Layer I 属于菜单项） |
| DropdownMenu · Select | 各 12 项过 **11** |
| **ResponsiveOverlay**（Phase 4 原语） | 任务卡四条重点全部落地并有测试 |
| **文档站**（Phase 6 四批） | 任务卡 7 项 **全部** |
| **Input · Textarea · Label · Field**（Phase 7 第一批） | 见 §0.70 的逐条表；`field` 变体明确标注无参考 |
| **Progress · Badge · Separator · Skeleton · Avatar**（第二批） | 见 §0.71；五个里只有 Progress 有玻璃，且它的几何全是借来的 |
| **Tooltip · Toast · InputGroup**（第三批） | 见 §0.72；三个都几乎没有 Apple 依据，所以**一条几何断言都没写** |

### Phase 6 收尾状态

任务卡 7 项走完了。**但「文档站做完了」不等于「PROJECT_SPEC §12 写的都有了」** ——
§12 列的页面比任务卡多，下面这些**不在任务卡的 7 项里**，也就都还欠着：

- 🔴 **Themes / Playground** —— 实时调档位并导出 CSS 变量片段
- 🔴 **Theming / Dark Mode / CLI / Registry** 四页 Docs
- 🟡 代码块没有语法高亮（理由见 `components/code-block.tsx` 文件头）
- 🔴 **Hero 没有视觉回归快照** —— 它是个活界面（layout 动画 + 滚动），
  快照会天天飘。现在靠 8 条行为断言钉住「它是活的」，这是明确未达成，不是不适用。

按阶段纪律，下一步继续 **Phase 7**。

### P1 的 14 个**全部做完了**

Checkbox / Radio Group 在 §0.73 交付。上一版这里列的三条路
（先找 macOS 参考 / 接受没有依据 / 干脆不做）**不必选了** ——
走的是第一条，macOS 27 的设计资源拿到了，两个组件的几何全部实测。

> 顺带把上一批 Tooltip 的推定几何也换成了实测，
> 并且补上了「气泡本体从来没被快照拍到」这个洞。详见 §0.73。

**P2 的头四个已交付**（§0.74）：`Collapsible` / `Accordion` / `Scroll Area` / `Table`。
四个全部有 macOS 27 实测依据，Scroll Area 也如预期复用了 Hero 那批的滚动边缘效果。

**P2 第二批已交付**（§0.76）：`Pagination` / `Breadcrumb` / `ContextMenu` / `Resizable`。
原计划里的 `Navigation Menu` 换成了 `Context Menu` —— 动手前先查资源，
发现后者能复用已有的菜单材质，而且 iOS 有完整参考。

**P2 第三批已交付**（§0.77）：`Sidebar` / `Menubar` / `Navigation Menu`。
上一批那句「Sidebar 体量很大，可能要单独占一批」判断对了一半 ——
它确实是三个里最大的，但真正花时间的不是体量，是**材质**：
HIG 那句「大元素的玻璃更不透明」终于量到了数（**0.92**，控件层只有 0.10），
落成了 `@glass/core` 的 `<GlassSurface scale="large">`。
❗ 同一次测量还否掉了一条想当然的推论：**模糊反而更小**（80 < 100）。

> 上一批的建议里 `Data Table` 也在名单上，最后**没做** ——
> 三个导航件已经把一批填满了，硬塞第四个只会让每一个都做浅。

**P2 还剩 5 个。** `Data Table` / `Command` / `Combobox` / `Calendar` / `Date Picker`。

下一批建议**先量 `507:24680 Date and Time Pickers`**：iOS 有一整页，
`Calendar` 与 `Date Picker` 是同一份资源里的两个形态，一起做能共用几何 ——
与这一批 `Menubar` + `NavigationMenu` 共用面板是同一个道理。
`Command` / `Combobox` 大概率两份资源都没有（`Command` 接近 Spotlight，
那是**系统级**的，设计资源里不会有）；`Data Table` 复用已完成的 `Table`。

**照例：先量再定。** 这已经是连续第三批证明那样更省事。

### macOS 资源解锁之后，有几件旧事可以重做了

拿到 macOS 27 文件（39 个页面）之后，下面这些原本标着「没有依据」的
可以去量了 —— 按价值排：

| 组件 | macOS 页面 | 现状 |
|---|---|---|
| **Popover** | `207:14483 Popovers`（含 `COMPONENT_SET` 1460×1200） | §0.52 记着「圆角是唯一量不出来的几何」，轮廓拟合不收敛 |
| **Field / 表单行** | `207:14477 Forms`（含亮/暗两个样例区） | §8.3 记着「四段式表单行不存在」，Field 的字号与间距全是推定 |
| ~~**Table**~~ | ~~`207:14499 Lists and Tables`~~ | ✅ **已完成**，见 §0.74 与 apple-metrics §11.4 |
| **Progress** | `207:14486 Progress Indicators` | §0.71 记着它的几何「全是借来的」 |
| **Toolbar / Sidebar** | `207:14501` / `207:14495` | apple-metrics §12 列为「仍缺」；Sidebar 是 P2 第 43 项 |

⚠️ 但要先想清楚一件事：**macOS 的度量能不能直接用在以 iOS 为基准的库里。**
Checkbox / Radio 没有这个问题（iOS 压根没有这两个控件）。
Popover / Table 两边都有，尺寸大概率不同 —— 拿 macOS 的值去改一个
iOS 基准的组件，需要单独说明理由，不能顺手就换。

### 长期挂着的三件事（一件都没动）

- **发布 `@glass/core` 到 npm** —— 否则真实用户装不了 registry item。
  冒烟测试目前靠本地 shim 顶着，安装页上如实写了这一条。
- **在 Linux 环境录一次视觉基线** —— 视觉回归只有 win32 基线，CI 里刻意不跑。
- **补一条真正的 SSR 验证** —— 缺的仍是「无 hydration mismatch」的显式断言。

### 新欠下的一件（0.63 记过，这里再点一次）

🔴 **`/docs/components/slider` 真的超编**：9 个实例要折射、只批了 8 个，
有 1 个 knob 一直在 Tier B —— 而且在 Hero 之前就这样，只是从来没人量过。
没修：修法要么删示例（把文档做差），要么给预算加上「只算视口内的」
（IntersectionObserver，滚动时容易抖，Phase 7 量级）。

### 到目前为止最值得记的五条

**一、快照回归有一块结构性盲区，而且是两个面。**
1px 内描边在 250×220 的面板上只占 0.9%，正好在 `maxDiffPixelRatio: 0.01` 之内；
挖洞偏 16px 在平滑渐变背景上几乎不改变像素。**这是「看不清」那一面。**
另一面是**「看不到」**：视觉回归逐个示例单独渲染，一屏一个组件，
于是**任何只在组合时才出现的问题都不在取景框里** ——
Tabs 的 `layoutId` 全局冲突就是这么活到今天的，首页一放上 Hero 立刻现形。

**二、没有任何测试看过控制台。** Tabs 从第一天起就在无限重渲染 ——
几何对、像素对、控制台在刷屏，三套测试一条都没红。

**三、验证台不走真实构建管线，会漏掉一整类问题。**
Tier B 的 `backdrop-filter` 被 Lightning CSS 吃掉了标准属性，
而验证台用的是未压缩 CSS，`tier b` 的视觉快照一直是绿的。
**只有真的 `next build` 一次才会现形。** 现在 `docs.yml` 每次 push 都做这件事。

**四、`data-slot` 覆盖已经踩了四次。** SheetClose、ResponsiveOverlay、
DropdownMenu、命令面板，每次解法都一样（另起一个属性），每次都是测试红了才发现。
组件里的注释只有写组件的人读得到，**调用方看不到** —— 该有一条 lint 规则。记着，没做。

**五、产物陈旧会伪装成 flaky。** 视觉基线是对着**新组件出现之前**构建的
`dev/tailwind.css` 录的，只有新组件用到的工具类根本没生成 ——
禁用态录成了一张错的图，之后全量跑就红 4 条，看起来像随机失败。
`dev:build`（esbuild）与 `dev:css`（tailwind）本来是两个独立脚本，
已改成前者先跑后者。**「重跑一遍看看」是错的反应，先确认产物是不是新的。**

**六、「组件对」不等于「库对」。** 0.63 挖出的四个缺陷全都不是组件本身的 bug：
`layoutId` 是命名空间冲突、级联层是打包边界、超限降级是状态机单向门、
游离子树是生命周期。**它们只在把东西摞起来用的时候才存在** ——
而这个仓库直到有了一个真界面才第一次那么用。

### 仍然没有的东西

🔴 **iOS 真机截图。** 几何这边已经推到能推的极限了 —— Tab Bar / Switch / Slider /
Alert / Menu / Button / Grouped List / Sheet / 菜单项内部布局都有实测，
而 **Popover 的圆角就是没量出来**（半透明玻璃压在中灰背景上，轮廓拟合不收敛）。

光学则**始终没有基准**：折射强度、色散偏移、镜面高光、knob 与抓手静止态该白到什么程度，
至今全是 `[推定]`，也是 Tier A 与 Tier B 至今无法真正区分开的原因。
**滚动边缘效果的三个参数（高度 / 模糊半径 / 雾浓度）加入了这份名单** ——
Apple 只给了 `.soft` / `.hard` 两个名字，一个数字都没有。

> 文档站现在把这件事**写在了 Optics 页的一整节里**，标题就叫
> 「必须说清楚：光学参数至今没有真机基准」，并有一条测试钉住它必须在。
> 组件页的「尺寸常量与可信度」表里，橙色的「推定」徽章有多少个一眼能数出来。
