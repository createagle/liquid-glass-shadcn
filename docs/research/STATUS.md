# 项目状态

**当前阶段：Phase 5（Registry 分发）已完成 · 可读性地板 + 元素级探针 · CI 已接上远程并全绿**
Phase 0（研究，部分）· Phase 1（光学引擎）· Phase 2（Token 体系）均已完成
未开始：Phase 3（P0 组件，**尺寸阻塞已解除**，光学标定仍缺真机截图）· Phase 4 · Phase 6 · Phase 7
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
  `deriveOnGlassLabel()` 解出，`scripts/on-glass-colors.mjs` 在 CI 里钉住不漂移

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

## 10. 下一步

**Phase 0 / 1 / 2 / 5 已完成。分发管线已经打通，等组件往里填。**

下一步应当是 **Phase 3（P0 组件，14 个）**，但它有两件事要先解决：

1. 🔴 **阻塞项 #1：没有 iOS 26 参考截图。** P0 验收要求「像素级对齐」+ 每个组件一张
   Fidelity 并排对照图，没有参考图就交付不了。需要你提供，或者授权改口径
   （明示本库是「风格还原」而非「尺寸还原」）。
2. 🔴 **`optics-web.md` §3.8 的嵌套指示器问题。** Tabs / Segmented 是 P0 的第一个组件，
   也正是这个问题最严重的场景 —— 指示器嵌在磨砂底座里，折射被底座的模糊吃掉。
   建议做 Tabs 时一并实现「底座挖洞」。

**对比度审计已补做**（§1），并且查出了一类真实违规：暗色主题 + 亮背景下
11/14 个测点达不到 AA。根因是元素级明暗自适应未实现 —— 这条以前只是文字描述，
现在有了硬数字，已用棘轮基线盯住，只许变好。

另外两件不阻塞但迟早要做的：

- **配好远程并推上去**（本地仓库与初始提交已完成），否则 Phase 5 写好的 CI job 永远不会跑
  —— 「CI job 存在并通过」这条验收目前只做到了「存在」。
- **发布 `@glass/core` 到 npm**，否则真实用户装不了 registry item
  （现在靠本地 npm shim 才能跑通冒烟测试）。
