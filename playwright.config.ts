import { defineConfig, devices } from '@playwright/test';

/**
 * 测试分成两个 project，因为它们的**可移植性完全不同**：
 *
 *   behavior  几何、DOM、a11y 语义、降级分支 —— 断言的是确定性事实，
 *             哪个平台跑都一样。**CI 跑这个。**
 *
 *   visual    截图比对 —— 快照是**平台相关**的。已实测：Windows（有 GPU）
 *             与 Linux CI（headless 软件光栅）的 blur 渲染不一致，
 *             同一测点对比度能差 0.5（见 STATUS.md §0.5）。
 *             本机生成的基线推上去 CI 必红，所以**默认不在 CI 跑**。
 *
 * 视觉回归要在 CI 上真正发挥作用，需要在 Linux 环境生成一次基线。
 * 在那之前它只是本地工具，这一点在 STATUS 里如实标注，不装作已完成。
 */
export default defineConfig({
  testDir: './tests',
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
