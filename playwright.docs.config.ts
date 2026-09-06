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
     * ⚠️ **不复用现有服务 —— 这条被踩过两次。**
     *
     * 2026-09-03：`pnpm docs`（`next dev`）也监听 4200，复用它等于在 dev 模式下
     * 跑「控制台必须干净」这类断言，Materials 页那条稳定红了 5/5 次。
     *
     * 2026-09-06：这次是**上一轮 test:docs 留下的 `next start`**。
     * 它跑得好好的，只是伺服的是**上一次的构建产物** —— 于是新改的组件根本没进去，
     * 47 条里只跑起 32 条，其余在超时。看起来像测试挂了，实际是在测旧代码。
     *
     * 两次的形态是同一个：**「有个服务在那儿」不等于「它是对的那个」。**
     * 所以干脆每次都自己构建自己起。代价是本地跑一轮多等一分钟左右，
     * 换掉一个会让人误判的失败模式，值。
     */
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
