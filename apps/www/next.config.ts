import type { NextConfig } from 'next';

/**
 * `typedRoutes` 打开是刻意的：组件页的链接是从 registry.json 拼出来的，
 * 拼错了要在编译期就红，而不是上线后 404。
 * （代价是拼接出来的字符串要显式断言 —— 见 site-sidebar.tsx。）
 */

/**
 * ── GitHub Pages 用的两个开关 ──────────────────────────────────────────
 *
 * 都走环境变量，**默认全关** —— 本地 `next dev` / `next start` 与
 * `pnpm test:docs` 因此完全不受影响（docs 测试跑的是生产构建 + `next start`，
 * 而 `output: 'export'` 下没有 `next start` 可跑）。
 *
 *   NEXT_PUBLIC_BASE_PATH=/liquid-glass-shadcn   项目页不在域名根上
 *   NEXT_OUTPUT_EXPORT=1                          导出纯静态到 out/
 *
 * ⚠️ basePath 打开之后，**只有 `<Link>` 和 Next 自己的资源会自动带前缀**。
 * 裸 `<a href="/…">`、`window.open('/…')`、`fetch('/…')` 一律不会 ——
 * 它们在本地全对、上了 Pages 全 404，而且本地怎么测都测不出来。
 * 所以 `scripts/check-export-links.mjs` 会在导出后扫一遍产物里的
 * `href=` / `src=`，发现没带前缀的绝对路径就 fail（Pages workflow 里跑）。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const isExport = process.env.NEXT_OUTPUT_EXPORT === '1';

const config: NextConfig = {
  typedRoutes: true,
  ...(basePath ? { basePath } : {}),
  ...(isExport
    ? {
        output: 'export' as const,
        /* 导出成 `docs/materials/index.html` 而不是 `docs/materials.html`：
           静态托管对后者的处理各家不一样，前者没有歧义。 */
        trailingSlash: true,
        /* 站里没用 next/image（Fidelity 的对照图刻意用原生 <img>，
           理由见 components/fidelity-sheet.tsx），这条只是把优化器彻底关掉。 */
        images: { unoptimized: true },
      }
    : {}),
};

export default config;
