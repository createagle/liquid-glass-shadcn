# CLAUDE.md

阅读并严格遵守 ./PROJECT_SPEC.md。任何实现决策与之冲突时，以 PROJECT_SPEC.md 为准。

## 项目

Liquid Glass UI —— 以 Apple iOS 26 / macOS 26 的 Liquid Glass 设计语言为唯一视觉基准的
React 组件库，通过 shadcn registry 分发组件源码，光学引擎作为独立 npm 包分发。

## 仓库

- `PROJECT_SPEC.md` —— 唯一规格来源（源自 `LIQUID_GLASS_UI_PROMPT.md` 第一部分）
- `LIQUID_GLASS_UI_PROMPT.md` —— 原始提示词，含第二部分的 Phase 0–7 任务卡（**只读，不要修改**）
- `docs/research/` —— Phase 0 研究笔记
- `packages/glass-core/` —— `@glass/core` 光学引擎（npm 包，不进 registry）
- `apps/www/` —— Next.js 文档站 + registry 托管；`apps/www/registry/glass/` 是组件源码的 source of truth

## 阶段纪律

按 `LIQUID_GLASS_UI_PROMPT.md` 第二部分的任务卡逐个 Phase 推进，**不要跨 Phase 抢跑**。
每个 Phase 结束时逐条对照该 Phase 的验收 checklist 与 PROJECT_SPEC 第 14 节自查，
并诚实列出未达成项 —— 不要输出"全部完成 ✅"式结论。

当前阶段状态记录在 `docs/research/STATUS.md`。

## 高频约束速查（详见 PROJECT_SPEC 第 2、15 节）

- 分层：Layer B（磨砂底座，禁用 `feDisplacementMap`）vs Layer I（强玻璃指示器，必须有可见色散）
- 内容型组件（Card/Table/List/Accordion）不堆玻璃 —— 材质属于控件层
- 组件内禁止魔法数字与裸色值，一律走 token
- 状态过渡一律用 `springs.smooth/snappy/bouncy` 预设，禁止硬编码 stiffness/damping 与贝塞尔曲线
- 尺寸数值必须标注 `[官方]` / `[实测]` / `[推定]`，严禁把推定值伪装成官方值
- 动画库导入路径是 `motion/react`，不是 `framer-motion`
