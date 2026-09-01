# Web 端折射方案与三级降级

> Phase 0 研究笔记。测试日期 **2026-08-31**。
> 验证页：[`optics-smoketest.html`](./optics-smoketest.html)（可直接用浏览器打开）。

## 0. 一句话结论（先看这个）

**`feImage` 位移贴图方案在 Chromium 上是可用的，Tier A 架构成立。**
我最初测出的「完全无效」是**我自己的写法有误**，不是浏览器不支持。
根因已定位并验证，见 §3.6。两条硬性实现约束：

1. **承载滤镜的 `<svg>` 必须有非零的 `width` / `height` *属性*。**
   `width="0" height="0"` 属性会让 `feImage` **完全不产出任何内容**。
   —— PROJECT_SPEC §5.2 建议的全局 defs 容器写法正好踩中这个坑，**必须改**。
   （CSS 上写 `width:0;height:0` 隐藏是**安全的**，只要属性非零。已验证。）
2. **`feImage` 上的百分比尺寸按「宿主 `<svg>` 的视口」解析，不是按被滤镜作用的元素。**
   所以不要写 `width="100%"`，要写**绝对用户单位**，值 = 目标元素的实际像素尺寸。

`backdrop-filter: url(#f)` 本身完全正常（`feGaussianBlur`、`feTurbulence` 位移均已验证）。

> ⚠️ 上述修复配方在 **Chromium 148（内嵌面板）** 上验证。用户的 **Chrome 151** 已确认
> 失败基线（V1 写法）与我这边完全一致，因此配方大概率可迁移，
> 但 Phase 1 开工时应在 Chrome 151 上再跑一次 [`feimage-fix.html`](./feimage-fix.html) 确认。

---

## 1. 测试环境

| 项 | 值 |
|---|---|
**环境 1（我跑的）**

| 项 | 值 |
|---|---|
| UA | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/1.40609.0 Chrome/148.0.7778.280 Safari/537.36 MSIX` |
| 引擎 | Chromium **148.0.7778.280** |
| 宿主 | Claude Code 内嵌浏览器面板 |

**环境 2（用户跑的，2026-08-31 复测）**

| 项 | 值 |
|---|---|
| UA | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36` |
| 引擎 | Chrome **151**（stock，非内嵌面板） |

**两个环境结论完全一致：**

| 测试 | Chromium 148（面板） | Chrome 151（stock） |
|---|---|---|
| feImage 酸性测试 | ❌ FAIL | ❌ **FAIL** |
| feTurbulence 位移（对照组） | ✅ PASS | ✅ **PASS** |
| `corner-shape: squircle` | ✅ PASS | ✅ **PASS** |
| `-webkit-backdrop-filter` 的 `CSS.supports` | false | **false** |

→ **`feImage` 的失败不是内嵌面板的安全限制，在正常 Chrome 上同样复现。**
（原先记在这里的「可能是面板限制」的怀疑**已被排除**。）

> ⚠️ Safari（Tier B）与 Firefox（Tier C）的结论目前全部是
> `[推定]`，来自文档与既有社区经验，**没有一条是我在真机上跑出来的**。
> PROJECT_SPEC Phase 1 的验收要求「Safari 下…Firefox 下…」，那一步必须在有这两个浏览器的机器上补做。

## 2. 特性检测实测结果 `[实测]`

在 Chromium 148 上用 `CSS.supports()` 逐条跑：

| 判据 | 结果 |
|---|---|
| `backdrop-filter: blur(10px)` | ✅ true |
| `-webkit-backdrop-filter: blur(10px)` | ❌ **false** |
| `backdrop-filter: url(#x)` | ✅ true |
| `-webkit-backdrop-filter: url(#x)` | ❌ false |
| `filter: url(#x)` | ✅ true |
| `corner-shape: squircle` | ✅ **true** |
| `color-mix(in oklch, …)` | ✅ true |
| `oklch()` | ✅ true |
| `rgb(from red r g b)`（相对颜色） | ✅ true |
| `anchor-name` | ✅ true |
| `container-type: inline-size` | ✅ true |
| `CSS.paintWorklet`（Houdini） | ✅ true |

**两条对 PROJECT_SPEC 的直接修正：**

1. **不要用 `-webkit-backdrop-filter` 做特性检测的 key。** Chromium 148 对带前缀写法的
   `CSS.supports()` 返回 false，尽管无前缀写法完全可用。检测必须只查无前缀形式，
   带前缀的写法只在**输出 CSS** 时作为 Safari 兼容补充。
2. **`corner-shape` 已经原生落地** —— 见 §5，这让 PROJECT_SPEC §6 的 squircle 方案过时了。

## 3. 折射（Tier A）实测

### 3.1 测试矩阵与结果

在同一张高频黑白竖条纹背景上，逐个隔离测试 `[实测]`：

| # | 配置 | 结果 |
|---|---|---|
| T1 | `backdrop-filter: url(#f)`，`f` = 单个 `feGaussianBlur` | ✅ **生效** —— 条纹被模糊成灰 |
| T4 | `backdrop-filter: url(#f)`，`f` = `feTurbulence` → `feDisplacementMap` | ✅ **生效** —— 强烈的波浪状扭曲，非常明显 |
| T3 | `backdrop-filter: url(#f)`，`f` = `feImage`(data: URI) → `feDisplacementMap` | ❌ **完全无效** —— 与对照组像素级一致 |
| — | `filter: url(#f)`（同一个 T3 滤镜）作用在普通元素上 | ❌ **元素整体消失**（滤镜输出为空） |
| T6 | `backdrop-filter`，`feImage href="#内部元素id"` → `feDisplacementMap` | ❌ 完全无效 |
| T7 | `backdrop-filter`，**只有** `feImage href="#内部元素id"`（酸性测试） | ❌ 完全无效 —— 本该整块画成红/蓝贴图，实际毫无变化 |

**T7 是判定性的**：如果 `feImage` 正常工作，那一块区域应当被贴图的红蓝渐变整个覆盖。
它没有。所以 `feImage` 在这个构建里**产出为空**，无论 href 指向 `data:` URI 还是文档内 `#id`。

### 3.2 排除了「异步加载时序」这个可能

我做了显式排查：把同一个 data URI 先用 `new Image()` 预加载
（返回 `loaded 300x52`，**加载是成功的**），再清空并重设 `href`，强制合成层刷新，等待 1.5 s
后重新截图 —— 结果不变。**不是时序问题。**

### 3.3 Phase 1 开工前必须复测的清单

| 要复测的 | 状态 / 为什么 |
|---|---|
| ~~stock Chrome / Edge 上重跑 T3 / T7~~ | ✅ **已完成**：Chrome 151 结果与面板一致，排除了「面板安全限制」这一解释 |
| ~~`feimage-matrix.html` 的 6 个变体判读~~ | ✅ **已完成**，根因定位见 §3.6 |
| ~~若 6 个变体全 FAIL → 放弃 SVG 滤镜路线~~ | ✅ **不适用** —— 路线成立，§3.4 的备选方案 2/3/4 全部**暂不需要** |
| 在 Chrome 151 上跑一次 `feimage-fix.html` | 🟡 低风险确认。修复配方是在 Chromium 148 面板上验证的；失败基线两边一致，故预期可迁移 |
| Safari 26 上 `backdrop-filter: url()` | PROJECT_SPEC 断言 Safari 不支持 `url()` 引用；未实测 |
| Firefox 上 `backdrop-filter` | PROJECT_SPEC 断言 Firefox 默认不支持；Firefox 早已默认开启 `backdrop-filter`，**这条断言很可能已经过时**，见 §4 |

### 3.4 如果 `feImage` 确实不可用 —— 替代方案排序

按我的推荐顺序（均为 `[推定]`，未实测）：

1. **把位移贴图变成一张真正的位图，用 `<img>`/canvas 生成后经 `feImage` 以外的路径喂给滤镜。**
   SVG 滤镜里除 `feImage` 外没有第二个「引入外部图像」的原语 —— 所以这条实际上等价于
   「必须修好 `feImage`」。**如果 `feImage` 死了，SVG 滤镜路线整体就死了。** 这点要认清。
2. **改用 `feTurbulence` + `feComponentTransfer` 合成近似透镜场。** 已证实 `feTurbulence`
   在 `backdrop-filter` 中可用。用 `baseFrequency` 极低 + `feComponentTransfer` 的
   `type="table"` 把噪声重映射成接近径向的梯度。**能做出畸变，但很难做出干净的「中心零位移、
   边缘强推挤」的透镜场** —— 保真度会明显低于贴图方案。
3. **放弃 SVG 滤镜，改用 WebGL / WebGPU 把背景抓取后自绘。**
   保真度最高、可控性最强，代价是：需要把背后的 DOM 光栅化（`html2canvas` 类方案不可靠）
   或限定「玻璃只叠在已知的图片/视频/canvas 之上」。
   → **这会改变整个库的适用范围**，是产品决策不是技术决策，需要你拍板。
4. **接受 Tier A 退化 = Tier B**，即全平台都用「多层 `inset box-shadow` 模拟透镜 +
   渐变边框模拟色散」。诚实但会丢掉 PROJECT_SPEC 最看重的卖点。
   PROJECT_SPEC §15 第 3 条明令「指示器不做色散就不许交付」—— 若走这条路，那条禁令需要你重新裁定。

### 3.6 根因定位与修复配方 `[实测]` ⭐

用 [`feimage-matrix.html`](./feimage-matrix.html)（6 变体）与
[`feimage-fix.html`](./feimage-fix.html)（6 变体）做正交实验，结果如下。

**矩阵一：变什么才让它出图**

| 变体 | 宿主 svg 尺寸**属性** | href 写法 | 图源 | 结果 |
|---|---|---|---|---|
| V1 | `0 × 0` | `href` | SVG | ❌ 完全无输出 |
| V2 | `0 × 0` | `xlink:href` | SVG | ❌ 完全无输出 |
| V3 | `0 × 0` | 两个都设 | SVG | ❌ 完全无输出 |
| V4 | `0 × 0` | 两个都设 | **PNG** | ❌ 完全无输出 |
| V5 | **`400 × 120`** | 两个都设 | PNG | ⚠️ **出图，但只覆盖左侧 400px** |
| V6 | **`400 × 120`** | 两个都设 | SVG | ⚠️ **出图，但只覆盖左侧 400px** |

→ 结论 1：**`href` vs `xlink:href` 无关**（V3 照样失败）。
→ 结论 2：**PNG vs SVG 图源无关**（V4 照样失败）。
→ 结论 3：**唯一的决定因素是宿主 `<svg>` 的尺寸属性。** `0 × 0` ⇒ 零输出。
→ 结论 4：覆盖宽度 400px **恰好等于宿主 svg 的宽度**，而不是目标元素的宽度
（目标带宽约 1900px）。此时 `feImage` 写的是 `width="100%"` ——
**说明百分比是按宿主 svg 视口解析的。**

**矩阵二：验证修复配方（6 条带用 6 种不同颜色，便于逐条判读）**

| 变体 | 宿主属性 | 宿主 CSS | feImage 尺寸 | 结果 |
|---|---|---|---|---|
| W1 | `1600 × 88` | 移出视口 | `100%` | ✅ 整幅铺满 |
| W2 | **`10 × 10`** | 移出视口 | **绝对值 1600 / 88** | ✅ 整幅铺满 |
| W3 | `1600 × 88` | 移出视口 | 绝对值 | ✅ 整幅铺满 |
| W4 | `1600 × 88` | `visibility:hidden` | 绝对值 | ✅ 整幅铺满 |
| W5 | `1600 × 88` | `opacity:0` | 绝对值 | ✅ 整幅铺满 |
| W6 | `1600 × 88` | **`width:0;height:0`** | 绝对值 | ✅ 整幅铺满 |

→ 结论 5：**W2 说明宿主不必和目标同尺寸** —— 只要属性非零（10×10 即可），
再给 `feImage` 写绝对用户单位，就能画出任意大小。
→ 结论 6：**W6 说明用 CSS 把宿主压成 0 是安全的** —— 出问题的是**属性**不是 CSS 盒子。
→ 结论 7：`visibility:hidden` / `opacity:0` / 移出视口 三种隐藏方式都不影响滤镜资源解析。

**给 `@glass/core` 滤镜工厂的实现约束（Phase 1 直接照做）**

```html
<!-- 全局唯一的 defs 容器：属性非零，CSS 压成 0 -->
<svg width="10" height="10" aria-hidden="true"
     style="position:fixed;width:0;height:0;pointer-events:none">
  <defs>
    <!-- 每个尺寸一个 filter，id = lg-{w}x{h}x{r}x{bw} -->
    <filter id="lg-320x44x22x0.07" color-interpolation-filters="sRGB"
            x="0%" y="0%" width="100%" height="100%">
      <!-- 绝对用户单位，值 = 目标元素实际像素尺寸；贴图也按该尺寸生成 -->
      <feImage href="data:image/png;base64,…" x="0" y="0"
               width="320" height="44" preserveAspectRatio="none" result="map"/>
      <!-- …三通道 feDisplacementMap / feColorMatrix / feBlend… -->
    </filter>
  </defs>
</svg>
```

- ❌ **不要**给容器写 `width="0" height="0"` 属性 —— 这正是 PROJECT_SPEC §5.2 的原文建议，是错的。
- ❌ **不要**在 `feImage` 上用百分比尺寸。
- ✅ 每个尺寸生成独立 filter + 独立贴图 —— 这与 PROJECT_SPEC §5.2 已有的
  「按尺寸生成并缓存，key = `w×h×radius×borderWidth`」**天然吻合**，不增加复杂度。
- ✅ 贴图用 canvas 导出 PNG 或 SVG data URI 均可（V4/V6 证明图源格式无关）。

### 3.5 React Bits `GlassSurface` 源码核实结果

读了 `src/content/Components/GlassSurface/GlassSurface.jsx`
（<https://raw.githubusercontent.com/DavidHDev/react-bits/main/src/content/Components/GlassSurface/GlassSurface.jsx>）。
**PROJECT_SPEC §1.3 对它的描述有一处事实错误：**

> SPEC 原文：「水平黑→红线性渐变 与 **垂直黑→绿线性渐变** 以 difference 混合」

实际源码里第二条渐变是 **蓝色**，不是绿色：

```html
<linearGradient id="{redGradId}"  x1="100%" y1="0%" x2="0%" y2="0%">
  <stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/>
</linearGradient>
<linearGradient id="{blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
  <stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/>
</linearGradient>
```

贴图的实际通道构成因此是：**R = 水平渐变，B = 垂直渐变，G = 只有中心那块灰色模糊方块**
（中心方块是 `hsl(0 0% {brightness}% / {opacity})`，无彩色，所以 R=G=B 都有贡献）。

而默认 props 是 `xChannel='R', yChannel='G'` ——
**`yChannel='G'` 采样的通道里几乎没有垂直梯度，只有中心那团灰。**
这意味着上游默认参数下的纵向位移基本是退化的。若要还原「透镜」，正确的默认应当是
**`yChannel='B'`**。我的验证页用的就是 `xChannelSelector="R" yChannelSelector="B"`。

滤镜链（源码原样）：

```html
<filter id="{filterId}" colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
  <feImage x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>
  <feDisplacementMap in="SourceGraphic" in2="map" id="redchannel"   result="dispRed"/>
  <feColorMatrix in="dispRed"   type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
  <feDisplacementMap in="SourceGraphic" in2="map" id="greenchannel" result="dispGreen"/>
  <feColorMatrix in="dispGreen" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green"/>
  <feDisplacementMap in="SourceGraphic" in2="map" id="bluechannel"  result="dispBlue"/>
  <feColorMatrix in="dispBlue"  type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue"/>
  <feBlend in="red" in2="green" mode="screen" result="rg"/>
  <feBlend in="rg"  in2="blue"  mode="screen" result="output"/>
  <feGaussianBlur stdDeviation="0.7"/>
</filter>
```

三个 `feDisplacementMap` 的 `scale` / `xChannelSelector` / `yChannelSelector`
**不在 JSX 里**，是运行时通过 ref 命令式写上去的（`scale = distortionScale + {red,green,blue}Offset`）。
所以照抄 JSX 是跑不起来的，必须补上这段命令式赋值 —— PROJECT_SPEC 引用其 props 签名时没提这点。

其浏览器检测逻辑是 **UA 嗅探**（判断 Safari / Firefox）+ `backdrop-filter` 支持检查，
与 PROJECT_SPEC §5.1「不要用 UA 做主判据」冲突 —— 我们按 SPEC 走特性检测，这点不照抄上游。

### 3.7 Phase 1 视觉标定结果 `[实测]`

标定环境：Chromium 148，调试页 `packages/glass-core/debug/index.html`，
背景用高频彩色条纹（判读折射与色散最灵敏的图案）。

**⚠️ 重要限制：本次标定没有 iOS 参考截图。**
PROJECT_SPEC Phase 1 任务卡要求「用 iOS 截图作为基准，反复调参」——
这一步**没有做到**。实际做的是「调到三个特征肉眼明确可见」，
不是「调到与 iOS 一致」。因此下面这组默认值属于 `[实测]`（我确实测出来的效果），
但**不是** `[官方]`，也不代表与 Apple 一致。见 STATUS.md 阻塞项 #1。

**最终固化的默认值**

| 参数 | 起点（React Bits） | 标定后 | 改动理由 |
|---|---|---|---|
| `borderWidth` | 0.07 | **0.18** | 0.07 的透镜带太窄，中心零位移区几乎占满整个元素，边缘推挤看不出来 |
| `blur`（中心块） | 11 | **6** | 11 把透镜边界糊得过散，降到 6 后边界利落、更像玻璃而非雾 |
| `distortionScale` | −180 | **−180** | 保持 |
| `greenOffset` | 10 | **18** | 拉开通道差值，色散彩边才肉眼可辨 |
| `blueOffset` | 20 | **38** | 同上 |
| `postBlur` | 0.7 | **0.3** | 0.7 会把好不容易做出的彩边又抹掉 |
| `yChannel` | `G` | **`B`** | 见 §3.5 —— 绿通道里没有垂直梯度 |

对应的 token 阶梯：

```css
--lg-refract-1: -110;  --lg-refract-2: -180;  --lg-refract-3: -260;
--lg-disperse-1: 19;   --lg-disperse-2: 38;   --lg-disperse-3: 58;
```

**三个特征的达成情况**

| 特征 | 结论 |
|---|---|
| 透镜畸变（lensing） | ✅ **非常明显**。独立指示器（knob）上，背后条纹在边缘被强烈推挤/旋绕，中心相对平直 |
| 色散（chromatic aberration） | ✅ 可见。三通道 scale 差值 0 / 18 / 38 时边缘出现可辨的彩色分离 |
| 镜面高光（specular highlight） | ✅ 上缘一道细亮弧，由多层 `inset box-shadow` 实现 |

**三档渲染路径实测（均在 Chromium 上强制切换验证）**

| Tier | 观感 |
|---|---|
| A | 完整折射 + 色散 + 高光，效果最强 |
| B | 无真折射，但微模糊 + 提亮 + 渐变彩边构成一个**完整、可交付**的设计，不像坏掉 |
| C | 半透明渐变 + 亮上缘，结构与可读性完全正确，只是没有玻璃感 |

> Tier B / C 是在 Chromium 上**强制切档**看的，**不是**在真的 Safari / Firefox 上跑的。
> PROJECT_SPEC Phase 1 验收要求的「Safari 下…Firefox 下…」仍未完成。

### 3.8 未解决：嵌套指示器的模糊叠加 🔴

调试页上能清楚看到：**独立的指示器（knob）折射效果极好，
但嵌在磨砂底座内部的指示器（segmented 的选中块）效果被明显削弱。**

原因正是 PROJECT_SPEC §2 预警过的：`backdrop-filter` 作用于元素背后**已绘制的全部内容**，
包含父级底座 blur 的结果。指示器因此永远看到「已经被底座模糊过」的背景，
不可能比底座更清晰 —— 而 SPEC 要求的恰恰是「指示器区域看到的背景比底座更清晰」。

**这在 CSS 里没有纯声明式的解法**：只要底座画在指示器后面，它就属于指示器的 backdrop。
可行方向（按推荐度）：

1. **底座挖洞**：底座的模糊背景放在伪元素上，用 `mask` 在指示器所在矩形处挖一个洞，
   让指示器直接看到未被模糊的页面背景。洞要随指示器移动 —— 需要把指示器位置同步给底座。
   **这是唯一能真正达成 SPEC 要求的做法。**
2. 降低底座 blur，靠指示器的提亮/折射制造相对清晰感（妥协方案，观感不到位）。
3. 底座与指示器做成兄弟节点，底座只画在指示器**周围**（用四段拼出轨道）。

工作量属于组件层而非原语层，**建议放到 Phase 3 做 Tabs/Segmented 时一并解决**，
因为挖洞的位置正是由具体组件的选中态决定的。
Phase 1 的原语已经把两种用法都支持了（独立指示器现在就是对的）。

### 3.9 位移贴图改为径向场（2026-09-01）

做 Tabs 时 Tier A 露出一个明显伪影：指示器上有一道生硬的深色闭合曲线，
折射区域是个不贴合胶囊的团块。分两步查清并修掉。

#### 第一步：折射量必须按元素尺寸缩放

`distortionScale` 原先是绝对像素（档位 -110 / -180 / -260），
在 85×54 的指示器上意味着**边缘位移 ±90px —— 超过元素本身宽度**，
边缘于是采样到完全无关的远处内容。

绝对值从原理上就不成立：同一套参数要同时服务 24px 的 Slider knob
与 390px 宽的 Sheet。改为**短边的比例** `{-0.45, -0.7, -1.0}`，
色散偏移改为相对 `|distortionScale|` 的比例。

⚠️ 这个缺陷此前没暴露，因为 Phase 1 只在调试页的**一个尺寸**上标定过。
**教训：光学参数只在一个尺寸上标定，等于没标定。**

#### 第二步：衰减必须是径向的，不能是矩形的

改完比例后仍残留一道**单色蓝竖线**贴在右缘。根因不是参数而是构造：

原贴图把线性梯度**铺满全图**，再用一块**模糊的圆角矩形**把中心压回中性。
于是衰减轮廓是**矩形**的 —— 位移场是「剪切」而非径向透镜，各方向不对称，
色散在某一侧堆积成单色边。

改为：中性灰基底（零位移）+ 线性梯度用**径向剖面遮罩**。
位移向量因此是 `A(r) × (x−cx, y−cy)`，方向严格指向外，**天然对称**。

两处附带修正：
- 基底从**黑色**改为中性灰。黑色在 `feDisplacementMap` 里等于最大负位移，
  未被梯度覆盖的区域（如圆角外）会整片剧烈偏移。
- 两条梯度的合并从 `difference` 改为 `screen`。中性灰基底上 difference 会反相。

对照图：`screenshots/refraction-progress.png`（原始 → 按尺寸缩放 → 径向场）。

#### 遗留

径向场消除了伪影，但折射也变温和了 —— **Tier A 与 Tier B 在常规尺寸下
不易区分**，而 PROJECT_SPEC §2 要求指示器「必须有可见色散」。
放大能看到对称彩边，小尺寸下偏弱。强度档位可能需要上调，
但**在拿到 iOS 真机截图之前不做**：没有基准的调参就是来回瞎试。

## 4. 三级降级方案（修订版）

PROJECT_SPEC §5.1 的分级判据需要两处修订：

| Tier | PROJECT_SPEC 原判据 | 修订后判据 | 说明 |
|---|---|---|---|
| **A** | `CSS.supports('backdrop-filter','url(#x)')` | 同左，**但必须再加一次运行时「贴图真的生效了吗」的探针** | 因为 §3.1 证明了 `supports()` 返回 true 不代表滤镜真的产出内容。建议：首帧在离屏做一次 1×1 的位移探测，读回像素判定，结果缓存到 `sessionStorage` |
| **B** | 「支持 blur 但不支持 url()（Safari 系）」 | 同左 | 未实测，保持 |
| **C** | 「不支持 backdrop-filter（**含 Firefox 默认配置**）」 | **删掉「含 Firefox」这句** | Firefox 自 103 起默认开启 `backdrop-filter`。把 Firefox 一律打到 Tier C 会让它拿到明显劣于实际能力的效果。Firefox 更可能是 **Tier B**。**待实测确认。** |

Tier A 的「真的生效」探针是本节最重要的产出：
**光有 `CSS.supports` 是不够的**，这是我这次实测最直接的教训。

## 5. Squircle：PROJECT_SPEC §6 的方案已经过时 `[实测]`

PROJECT_SPEC §6 写的是「用 SVG path 或 `paint()` worklet 生成 squircle 遮罩；不支持时回退 `border-radius`」。

**实测：Chromium 148 原生支持 CSS `corner-shape`。**

- `CSS.supports('corner-shape','squircle')` → `true`
- `getComputedStyle(el).cornerShape` → `"squircle"`（值被真实解析并保留）
- 视觉验证：两个 132×132、同为 `border-radius: 38px` 的方块并排，
  左边加 `corner-shape: squircle`，右边不加 —— **肉眼差异非常明显**，
  左边是 Apple 那种连续曲率的扁平角，右边是标准圆弧角。

→ **修订建议**：squircle 走 `border-radius: N; corner-shape: squircle;` 两行 CSS，
`@supports (corner-shape: squircle)` 做渐进增强，不支持时自然退回普通圆角。
**不需要 SVG path，也不需要 Houdini paint worklet。** 这为 Phase 2 省掉一整块复杂度。

（注意 `corner-shape` 目前基本只有 Chromium 有；Safari / Firefox 会走回退分支，这是可接受的
—— 大圆角上的曲率差异属于「锦上添花」，不影响可用性。）

## 6. 元素级明暗自适应（最大的未解难题）

`apple-liquid-glass.md` §5 记录了 Apple 的原文：toolbar / tab bar 这类元素会
**根据背后内容在亮/暗外观之间自动切换**，其上的符号与文字随之反色。

Web 端没有现成 API。可能的路子（全部 `[推定]`，均未实测）：

1. **`backdrop-filter` 链上做极端降采样**：`blur(60px) grayscale(1) contrast(0)` 得到一块
   近似「平均亮度」的色块，再用 `mix-blend-mode: difference` / `luminosity` 让前景文字自动反色。
   **纯 CSS，无需 JS 采样，性能好。** 我认为这是最值得先试的一条。
2. **`IntersectionObserver` + 采样背后元素的计算背景色**：只在背景是纯色/渐变时可靠，
   背景是图片/视频就失效。
3. **画一份低分辨率的背景快照到 canvas 再读像素**：最准，但跨源图片会污染 canvas，
   且开销大、难以实时。

**建议在 Phase 1 的调试页里把方案 1 单独做一个开关来验证**，因为它同时也能解决
`clear` 变体的「35% 调暗层」是否需要自适应的问题。

---

### 6.1 实测结果（2026-08-31）—— ⚠️ 上面这条建议是**错的**

按上面写的做了：`packages/glass-core/debug/adaptive-fixture.html` 六个候选并排，
`scripts/adaptive-probe.mjs` 差分测量，档位 0 × 6 种最不利背景 × 明暗两主题。

**结论一：方案 1（`mix-blend-mode: difference`）实测最差 —— 1.04:1，是全场倒数第一。**

原因是我当时的判断有一个硬错误：**difference 保证的是 RGB 差值，不是亮度差值。**
中灰 `#808080` 上白字 difference 出 `#7F7F7F`，RGB 差了 128，亮度几乎没变，
字直接消失。WCAG 判的是亮度对比，所以这条路从原理上就不成立，不是调参能救的。

**这条建议作废。** 不要再试 difference/exclusion 这类混合模式做自动反色。

**结论二：元素级翻转「文字颜色」也救不了 AA。**

候选 C4（按背景亮度翻转文字色）在亮色主题黑背景上确实把 2.53 抬到 5.07，
但在暗色主题的 checker / saturated 背景上**反而比不自适应更差**（4.02 → 3.11）。
原因是**一个元素底下可以同时有纯黑和纯白**（棋盘格、照片），
单一极性决策必然顾此失彼。

**结论三：能保证 AA 的只有材质不透明度。**

玻璃把背景合成为 `C = a·F + (1-a)·B`，其中 `C` 的**值域宽度恒为 `(1-a)`**，
与 `B` 是什么无关。也就是说 —— 能否保证对比度**只由 `a` 决定**。
这也正是 Apple 的说法：

> "Liquid Glass appears **more opaque in larger elements like sidebars** to preserve
>  legibility over complex backgrounds."

所以「元素级自适应」要自适应的对象是**不透明度**，不是文字颜色。
实现见 `packages/glass-core/src/a11y/legibility.ts`。

**结论四：解出来的地板值**（含 2% 渲染余量，目标 4.6:1）

| | 底座 alpha 地板 | 原档位 0 的值 |
|---|---|---|
| 亮色 | **0.664** | 0.34 |
| 暗色 | **0.640** | 0.22 |
| 内容层 ultrathin（亮） | **0.461** | 0.44 |
| 内容层 ultrathin（暗） | **0.608** | 0.50 |

代价要讲清楚：**「最通透」档现在有 64–66% 不透明度**，不再是名义上的通透。
这是 PROJECT_SPEC §13（标题写明「不可协商」）与 §8（档位 0 = 最通透）
之间的取舍，§13 优先。需要真·通透时用 `GlassProvider` 的 `legibility` prop 降级。

**结论五：Apple 的 secondaryLabel 本身就不过 AA。**

`#3C3C43 @ 60%` 压在纯白上是 **3.44:1**，且**任何材质不透明度都救不回来**
（alpha = 1 时也只有 3.44）。所以「忠实复刻 Apple 标签色」与「§13 所有文本过 AA」
不能同时成立。本库据 §13 的「不可协商」判定 AA 优先，把 secondary 的 alpha
抬到 0.99 —— **这是本库对 Apple 的一处明确偏离**，记录在此备查。

## 7. Vibrancy 的 Web 近似

Apple 的 vibrancy 是依赖背景的混合，不是 alpha（见 `apple-liquid-glass.md` §6）。

- **一级近似（PROJECT_SPEC 现在的做法）**：带 alpha 的实色标签色。简单、可预测、SSR 友好。
- **二级近似 `[推定]`**：`color: <label>; mix-blend-mode: overlay|luminosity` 叠在材质上。
  更接近真实观感，但会与 `backdrop-filter` 的层叠上下文打架，且在 Tier C 下要能干净关掉。

**建议**：Phase 2 先落一级近似（保证对比度可控、CI 可测），
把二级近似做成 `--lg-vibrancy: on|off` 的可选增强，Phase 7 再评估。
**不要在 P0 阶段引入 `mix-blend-mode`** —— 它会让 WCAG 对比度的自动检查变得不可判定。

## 8. 层叠：指示器不能比底座更模糊（PROJECT_SPEC §2 的关键论断，已部分验证）

PROJECT_SPEC 断言：`backdrop-filter` 作用于元素背后**已绘制的全部内容**，
所以指示器嵌在底座内再加 blur 会造成模糊叠加。

**验证页上的观察 `[实测]`**：把指示器直接放进 `.base` 内部时，
指示器区域看到的背景**确实**已经是被底座模糊过的结果 —— 它不可能比底座更清晰。
这印证了 SPEC 的判断。

→ 因此 SPEC 提出的结构（「底座背景由伪元素承载 + 指示器提升到独立层叠上下文」）是必要的，
Phase 1 必须把这个结构作为 `<GlassSurface>` 的基础布局，而不是事后补救。
具体实现与实测结论待 Phase 1 补写到本节。

## 9. 待办

- [x] ~~在 stock Chrome / Edge 复测 `feImage`~~ → 已完成，根因见 §3.6，**Phase 1 已解除阻塞**
- [ ] 在 Chrome 151 上确认 §3.6 的修复配方（低风险）
- [ ] Safari 26 / Firefox 实测，落实 Tier B / C 的真实判据
- [ ] Tier A 的「滤镜真的生效」运行时探针，写出来并实测
- [ ] §6 方案 1（`grayscale+contrast+difference` 自适应反色）做原型验证
- [ ] 位移贴图的缓存 key 与 `ResizeObserver` 节流策略，实测重建开销
- [ ] 单屏折射实例数与掉帧的关系实测 → 用来替换 PROJECT_SPEC §5.2 里 `[推定]` 的「≤ 8 个」
