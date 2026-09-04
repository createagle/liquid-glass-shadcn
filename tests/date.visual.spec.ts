/**
 * P2 第四批（Calendar / DatePicker / Combobox）视觉回归。
 *
 * ⚠️ **快照是平台相关的，这个 project 默认不在 CI 跑。**理由见 playwright.config.ts。
 *
 * ⚠️ **所有日期在 harness 里写死**（今天 = 2026-04-01，选中 = 2026-04-12）。
 *    不写死的话这一组会在过日期的那一晚自己红掉，而且看起来像随机失败 ——
 *    STATUS 里「产物陈旧会伪装成 flaky」的同族。
 *
 * 只有 DatePicker 的弹层与 Combobox 的列表是玻璃，所以只有它们跑三档 Tier；
 * Calendar 是内容层（**资源自证**：Inline 变体就是纯白的），跑三档只是存三遍同一张图。
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/date-demo.html')).href;

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
  test(`calendar · ${theme}`, async ({ page }) => {
    await open(page, 'calendar', theme);
    await expect(page.getByTestId('row-calendar')).toHaveScreenshot(
      `date-calendar-${theme}.png`,
      SHOT,
    );
  });

  /*
   * 四种日期格状态一张图：今天（8 号蓝）、选中（12 号黑底白字）、
   * 禁用（周末）、Null（非本月留空）。
   * **选中态是黑底白字而不是主题蓝** —— 这条反直觉的事实靠这张图守着。
   */
  test(`calendar 状态 · ${theme}`, async ({ page }) => {
    await open(page, 'calendar-states', theme);
    await expect(page.getByTestId('row-calendar-states')).toHaveScreenshot(
      `date-calendar-states-${theme}.png`,
      SHOT,
    );
  });

  test(`date-picker 合起来 · ${theme}`, async ({ page }) => {
    await open(page, 'date-picker', theme);
    await expect(page.getByTestId('row-date-picker')).toHaveScreenshot(
      `date-picker-closed-${theme}.png`,
      SHOT,
    );
  });

  /*
   * 面板是 Portal 出去的 —— 拍**整页**，不是拍某个盒子。
   * 背景用渐变：弹层是玻璃，压在分组底色上看不出材质。
   */
  test(`date-picker 展开 · ${theme}`, async ({ page }) => {
    await open(page, 'date-picker', theme, 'a', 'gradient');
    await page.locator('[data-slot="date-picker-trigger"]').click();
    await expect(
      page.locator('[data-slot="popover-content"] [data-slot="calendar-grid"]'),
    ).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`date-picker-open-${theme}.png`, SHOT);
  });

  test(`combobox · ${theme}`, async ({ page }) => {
    await open(page, 'combobox', theme);
    await expect(page.getByTestId('row-combobox')).toHaveScreenshot(
      `date-combobox-${theme}.png`,
      SHOT,
    );
  });

  test(`combobox 展开 · ${theme}`, async ({ page }) => {
    await open(page, 'combobox', theme, 'a', 'gradient');
    await page.locator('[data-slot="combobox-input"]').first().click();
    await expect(page.locator('[data-slot="combobox-list-surface"]')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`date-combobox-open-${theme}.png`, SHOT);
  });
}

/* 玻璃的那两处跑降级路径 —— Tier B 丢折射、Tier C 丢模糊 */
for (const tier of ['b', 'c']) {
  test(`date-picker 展开 · tier ${tier}`, async ({ page }) => {
    await open(page, 'date-picker', 'light', tier, 'gradient');
    await page.locator('[data-slot="date-picker-trigger"]').click();
    await expect(
      page.locator('[data-slot="popover-content"] [data-slot="calendar-grid"]'),
    ).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`date-picker-open-tier${tier}.png`, SHOT);
  });
}
