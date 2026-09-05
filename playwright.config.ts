import { defineConfig, devices } from '@playwright/test';

/**
 * 测试分成两个 project，因为它们的**可移植性完全不同**：
 *
 *   behavior  几何、DOM、a11y 语义、降级分支 —— 断言的是确定性事实，
 *             哪个平台跑都一样。
 *
 *   visual    截图比对 —— 快照是**平台相关**的。已实测：Windows（有 GPU）
 *             与 Linux CI（headless 软件光栅）的 blur 渲染不一致，
 *             同一测点对比度能差 0.5（见 STATUS.md §0.5）。
 *
 * 两个 project 现在**都在 CI 跑**（2026-09-05 起）。
 * 做法不是「让两个平台渲染一致」（做不到），而是**各录各的基线**：
 * Playwright 按平台给快照加后缀，`*-win32.png` 与 `*-linux.png` 共存，
 * 本机比对本机那套，CI 比对 Linux 那套，互不干扰。
 *
 * Linux 基线由 `.github/workflows/visual-baseline.yml` 的 record 模式在
 * **ubuntu-24.04**（写死，不用 latest）上录出。镜像或浏览器一换就要重录 ——
 * 那是一次有意识的动作，见那个文件的注释。
 */
export default defineConfig({
  testDir: './tests',
  // 文档站的测试要先构建再起服务，单独一个 config（playwright.docs.config.ts）
  testIgnore: ['docs/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 },
  projects: [
    { name: 'behavior', testMatch: /.*\.behavior\.spec\.ts/ },
    { name: 'visual', testMatch: /.*\.visual\.spec\.ts/ },
  ],
});
