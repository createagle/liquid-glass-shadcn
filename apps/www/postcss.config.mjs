/**
 * Tailwind v4 走 PostCSS 插件。
 *
 * 验证台那边用的是 `@tailwindcss/cli`（`pnpm --filter www dev:css`），
 * 引擎是同一个，只是入口不同：验证台是独立 HTML，文档站是 Next 的 CSS 管线。
 */
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
