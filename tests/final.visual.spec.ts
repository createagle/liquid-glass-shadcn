/**
 * P2 收尾批（DataTable / Command）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * DataTable 是内容层（与 `<Table>` 同，一句玻璃都没有），只拍分组底色；
 * Command 的面板是玻璃，压在渐变上才看得出材质，并且跑三档 Tier。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/final-demo.html')).href;

async function open(page: Page, only: string, theme: string, tier = 'a', bg = 'grouped') {
  const q = new URLSearchParams({ only, theme, tier, tint: '0.34', bg });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(300);
}

const SHOT = { maxDiffPixelRatio: 0.01 } as const;

for (const theme of ['light', 'dark']) {
  test(`data-table · ${theme}`, async ({ page }) => {
    await open(page, 'data-table', theme);
    await expect(page.getByTestId('row-data-table')).toHaveScreenshot(
      `final-data-table-${theme}.png`,
      SHOT,
    );
  });

  /* 排序后：表头转 Bold + 指示器出现（几何来自 §11.4，已实测） */
  test(`data-table 排序 · ${theme}`, async ({ page }) => {
    await open(page, 'data-table', theme);
    await page.locator('[data-slot="data-table-sort"]').first().click();
    await page.waitForTimeout(200);
    await expect(page.getByTestId('row-data-table')).toHaveScreenshot(
      `final-data-table-sorted-${theme}.png`,
      SHOT,
    );
  });

  /* 选择 + 分页：全选框的 indeterminate 一态也在这张图里 */
  test(`data-table 选择 · ${theme}`, async ({ page }) => {
    await open(page, 'data-table-select', theme);
    await page.locator('[data-select-row]').first().click();
    await page.waitForTimeout(200);
    await expect(page.getByTestId('row-data-table-select')).toHaveScreenshot(
      `final-data-table-select-${theme}.png`,
      SHOT,
    );
  });

  test(`data-table 空态 · ${theme}`, async ({ page }) => {
    await open(page, 'data-table-empty', theme);
    await expect(page.getByTestId('row-data-table-empty')).toHaveScreenshot(
      `final-data-table-empty-${theme}.png`,
      SHOT,
    );
  });

  /*
   * Command 拍**整页** —— 面板是 Portal 出去的，还带一层全屏压暗。
   * 背景用渐变：面板是玻璃，压在分组底色上看不出材质。
   */
  test(`command · ${theme}`, async ({ page }) => {
    await open(page, 'command', theme, 'a', 'gradient');
    await page.getByTestId('cmd-open').click();
    await expect(page.locator('[data-slot="command-input"]')).toBeFocused();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`final-command-${theme}.png`, SHOT);
  });

  test(`command 过滤后 · ${theme}`, async ({ page }) => {
    await open(page, 'command', theme, 'a', 'gradient');
    await page.getByTestId('cmd-open').click();
    await page.locator('[data-slot="command-input"]').fill('打开');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`final-command-filtered-${theme}.png`, SHOT);
  });
}

/* 玻璃那一处跑降级路径 */
for (const tier of ['b', 'c']) {
  test(`command · tier ${tier}`, async ({ page }) => {
    await open(page, 'command', 'light', tier, 'gradient');
    await page.getByTestId('cmd-open').click();
    await expect(page.locator('[data-slot="command-input"]')).toBeFocused();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`final-command-tier${tier}.png`, SHOT);
  });
}
