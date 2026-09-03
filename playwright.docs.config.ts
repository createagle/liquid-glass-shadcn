import { defineConfig, devices } from '@playwright/test';

/**
 * 文档站的测试**单独一个 config**，不和组件测试混在一起。
 *
 * 理由：它需要先构建再起服务（`next build` + `next start`，一分钟起步），
 * 而 `playwright.config.ts` 里那两个 project 是秒级的。把 webServer 写进
 * 主 config 会让每次跑组件回归都白等一次构建 —— Playwright 的 webServer
 * 是全局的，没法只绑给某一个 project。
 *
 *   pnpm test:docs
 */
export default defineConfig({
  testDir: './tests/docs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    deviceScaleFactor: 2,
    baseURL: 'http://localhost:4200',
  },
  webServer: {
    /**
     * 测的是**生产构建**，不是 dev server。
     * dev 模式下 React 会双调用、Next 会插一堆调试脚本，
     * 「控制台是干净的」这类断言在 dev 下没有意义。
     */
    command: 'pnpm --filter www build && pnpm --filter www start',
    url: 'http://localhost:4200',
    /**
     * ⚠️ **本地复用现有服务是个陷阱，踩过一次（2026-09-03）。**
     *
     * `pnpm docs`（= `next dev`）监听的也是 4200。它开着的时候，
     * 这里不会去构建生产版本，而是**直接连上那个 dev server** ——
     * 于是上面那段注释里说的「dev 下这些断言没有意义」正好成立：
     * Materials 页的 α 滑杆那条断言就这么稳定地红了 5/5 次，
     * 看起来像 flaky，实际是在测另一个东西。
     *
     * 跑 `pnpm test:docs` 之前先把本地 dev server 停掉。
     */
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
