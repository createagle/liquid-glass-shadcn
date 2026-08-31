# Liquid Glass UI

以 Apple iOS 26 / macOS 26 的 **Liquid Glass** 设计语言为唯一视觉基准的 React 组件库。
光学引擎作为 npm 包分发，组件源码通过 **shadcn registry** 分发。

> **当前状态：Phase 0 / 1 / 2 / 5 已完成（研究 · 光学引擎 · Token 体系 · Registry 分发）。**
> Phase 3（P0 组件）待开始。
> 尚无 UI 组件 —— 这是刻意的，按 Phase 顺序推进。
> 进度、缺口与阻塞项见 [`docs/research/STATUS.md`](docs/research/STATUS.md)。

## 这是什么

不是「加一层毛玻璃背景」的项目。核心判断是 **Liquid Glass 是一套分层系统**，不是一种均匀材质：

- **Layer B（磨砂底座）** —— tab bar 整条胶囊、segmented 凹槽、slider 轨道。
  职责是可读性，几乎无折射畸变。**禁止对底座使用 `feDisplacementMap`。**
- **Layer I（强玻璃指示器）** —— 选中胶囊、knob。透镜畸变 + 可见色散 + 镜面高光。
- **内容层** —— Card / Table / List 等**不用**玻璃。
  依据 Apple 原文：*"Don't use Liquid Glass in the content layer."*

实测结论：64 个 shadcn 组件里，**只有 25 个（39%）应该带玻璃**，其余 61% 属内容层。
详见 [`component-inventory.md`](docs/research/component-inventory.md)。

## 仓库结构

```
PROJECT_SPEC.md            唯一规格来源（任何实现决策与之冲突时以它为准）
CLAUDE.md                  给 Claude 的约束入口
LIQUID_GLASS_UI_PROMPT.md  原始提示词，含 Phase 0–7 任务卡（只读）
docs/research/             Phase 0 研究笔记 + 光学验证页
packages/glass-core/       @glass/core 光学引擎（npm 包，不进 registry）
apps/www/                  Next.js 文档站 + registry 托管
  └── registry/glass/      组件源码的 source of truth
```

## 开发

```bash
pnpm install
```

> ⚠️ shadcn CLI 请用 `npx --yes shadcn@latest`，**不要用 `pnpm dlx`**
> —— 后者在本环境中因 zod 解析冲突崩溃，详见
> [`shadcn-registry.md`](docs/research/shadcn-registry.md) §0.1。

## 光学调试台

```bash
start packages/glass-core/debug/index.html
```

纯 HTML，不依赖 Next.js / React。14 个滤镜参数全部可拖拽，
可实时切换 Tier A/B/C、明暗、材质档位与背景图案，并导出标定参数。
**注意**：需要先构建调试包（仓库已附带产物，改了 `src/` 后要重跑）：

```bash
pnpm --filter @glass/core debug:build
```

## Token 速查页

```bash
start packages/glass-core/debug/tokens.html
```

全色板、**4 档材质 × 明暗 = 8 宫格**、内容层标准材质、圆角与 squircle 对比、
同心圆角算例，以及 shadcn token 覆盖核对表（33 / 33）。

## 第三方 shadcn 组件兼容性

class 字符串取自官方 registry 真实源码，用真实 Tailwind v4 编译本库 token：

```bash
cd packages/glass-core && npm run compat:build
```

然后打开 `packages/glass-core/debug/shadcn-compat/index.html`（明暗两栏并排）。

---

`docs/research/` 下另有三个 Phase 0 的实验页（`optics-smoketest` / `feimage-matrix` /
`feimage-fix`），记录了 `feImage` 那两条硬性约束是怎么定位出来的。

## Registry

```bash
cd apps/www
node scripts/generate-theme-item.mjs   # 从 CSS 源生成 theme item
npx shadcn@latest registry validate registry.json
npx shadcn@latest build                # 产物 → public/r/
```

安装方式（**命名空间是主推方式，也是硬性前提** ——
带 `registryDependencies` 的 item 必须走它，裸名会被解析到 shadcn 官方 registry）：

```bash
npx shadcn@latest add @glass/glass-providers
```

`.github/workflows/registry-smoke.yml` 会在干净的 Next.js 工程里实测两种安装方式并构建。

## 阶段纪律

按 `LIQUID_GLASS_UI_PROMPT.md` 第二部分的任务卡逐个 Phase 推进，不跨 Phase 抢跑。
每个 Phase 结束时逐条对照验收 checklist 自查，并诚实列出未达成项。
