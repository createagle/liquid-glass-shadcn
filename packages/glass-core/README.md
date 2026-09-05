# @createagle/glass-core

**Liquid Glass UI** 的光学引擎 —— 位移贴图 / 滤镜工厂 / 能力分级 / Provider / 材质 token。

以 Apple iOS 26 / macOS 26 的 Liquid Glass 设计语言为唯一视觉基准。
组件源码通过 [shadcn registry](https://createagle.github.io/liquid-glass-shadcn/docs/installation/)
分发，**这个包只管光学**：它不导出任何 UI 组件。

- 文档站：<https://createagle.github.io/liquid-glass-shadcn/>
- 仓库：<https://github.com/createagle/liquid-glass-shadcn>

## 安装

```bash
pnpm add @createagle/glass-core
```

```css
@import 'tailwindcss';
@import '@createagle/glass-core/theme.css';
```

```tsx
import { glassSsrScript } from '@createagle/glass-core';

// 根布局的 <head> 里，避免首屏闪一下暗色/材质
<script dangerouslySetInnerHTML={{ __html: glassSsrScript() }} />;
```

## 它解决的问题

不是「加一层毛玻璃背景」。核心判断是 **Liquid Glass 是一套分层系统**，不是一种均匀材质：

- **Layer B（磨砂底座）** —— tab bar 整条胶囊、segmented 凹槽、slider 轨道。
  职责是可读性，几乎无折射畸变。**禁止对底座使用 `feDisplacementMap`。**
- **Layer I（强玻璃指示器）** —— 选中胶囊、knob。透镜畸变 + 可见色散 + 镜面高光。
- **内容层** —— Card / Table / List 等**不用**玻璃。
  依据 Apple 原文：*"Don't use Liquid Glass in the content layer."*

## 三档能力降级

浏览器对 `backdrop-filter: url(#svg)` 的支持差得很远，所以引擎在运行时探测能力并分档：

| Tier | 折射 | 说明 |
|---|---|---|
| A | SVG 位移贴图，有色散 | 完整效果 |
| B | 仅 `blur()` + 饱和度 | 无畸变，材质仍在 |
| C | 不透明底 + 描边 | 连模糊都不做，靠不透明度保可读性 |

档位可被 `prefers-reduced-transparency` / `prefers-contrast` 强制下拉 ——
可读性优先于观感，这一条不可协商。

## Token

四层结构（primitive → semantic → shadcn 兼容层），亮/暗 × 常规/高对比共四套。
入口是 `@createagle/glass-core/theme.css`，也可以按层单独引：

```
@createagle/glass-core/primitive.css   原始值（系统色、圆角阶梯、折射常量）
@createagle/glass-core/semantic.css    语义层（标签色、材质、派生的 AA 安全色）
@createagle/glass-core/shadcn.css      映射到 shadcn 既有 token 名
@createagle/glass-core/optics.css      .lg-surface 的渲染路径与三档降级
```

> **有色文字压在玻璃上的那一套是解出来的，不是手调的。**
> 真实系统色当标签色时对比度只有 1.8:1 上下，
> `--lg-on-glass-*` 由算法压到 AA 之上，CI 里有脚本钉住漂移。

## 尺寸与颜色的可信度标注

本项目所有几何与色值都标注来源：`[官方]` / `[实测]` / `[推定]` / `[待核实]`，
严禁把推定值伪装成官方值。测量记录见仓库的
[`docs/research/apple-metrics.md`](https://github.com/createagle/liquid-glass-shadcn/blob/main/docs/research/apple-metrics.md)。

举一个例子：强调蓝**不是**常被引用的 systemBlue `#007AFF` ——
四份互相独立的实测都指向 `#0088ff`，那是 Liquid Glass 一代的值。

## 状态

早期版本。API 可能变动。
进度、缺口与已知问题见
[`docs/research/STATUS.md`](https://github.com/createagle/liquid-glass-shadcn/blob/main/docs/research/STATUS.md)。
