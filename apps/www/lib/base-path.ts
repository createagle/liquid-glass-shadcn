/**
 * 站点前缀。
 *
 * 部署在 GitHub Pages 的**项目页**上时，站点挂在 `/<repo>/` 下面，
 * next.config.ts 会打开 `basePath`。本地开发与 `pnpm test:docs` 下它是空的。
 *
 * ⚠️ **Next 的 basePath 只管 `<Link>` 和它自己发出的资源。**
 * 裸 `<a href="/…">`、`<img src="/…">`、`window.open('/…')`、`fetch('/…')`
 * 一个都不带前缀 —— 而且本地 basePath 为空，这些路径在本机全是对的，
 * 只有部署之后才 404。所以凡是**不经过 `<Link>`** 的站内绝对路径，
 * 都要过一遍 `withBase()`。
 *
 * 忘了也不会没人管：`scripts/check-export-links.mjs` 会在导出后扫产物里的
 * href / src，发现没带前缀的绝对路径就让构建失败（Pages workflow 里跑）。
 * 它第一次跑就抓到了 8 张 Fidelity 对照图 —— 那些 `<img>` 是刻意不走
 * next/image 的（逐像素对照，见 components/fidelity-sheet.tsx）。
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** 给站内**绝对**路径补前缀；相对路径与外链原样返回。 */
export function withBase(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return `${BASE_PATH}${path}`;
}
