/**
 * P2 收尾批（DataTable / Command）的行为回归。
 *
 * 这一批**几乎没有几何可钉** —— 两个组件的外观都是借来的：
 *
 *   DataTable  外观全部来自已实测的 `<Table>`（那边已经有测试钉着）
 *              → 这里只钉**行为**：排序三态、选择、分页、无障碍
 *   Command    Apple 资源里结构上不可能有（Spotlight 是系统级的）
 *              → 只钉行为与「搜索框结构取自 macOS」那几条
 */

import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const HARNESS = pathToFileURL(resolve('apps/www/dev/final-demo.html')).href;

async function open(page: Page, only?: string, theme = 'light') {
  const q = new URLSearchParams({ theme, tier: 'a', ...(only ? { only } : {}) });
  await page.goto(`${HARNESS}?${q}`);
  await page.waitForFunction(() => (window as { __ready?: boolean }).__ready === true);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const names = (page: Page) =>
  page.locator('[data-slot="table-row"][data-row] td:nth-child(1)').allTextContents();

/* ══════════════════════════════════════════════════════════════════════
   DataTable
   ══════════════════════════════════════════════════════════════════════ */

test.describe('DataTable', () => {
  test('❗一句玻璃都没有 —— 与 <Table> 同，SPEC §2 明令', async ({ page }) => {
    await open(page, 'data-table');
    const n = await page.evaluate(
      () => document.querySelectorAll('[data-testid="row-data-table"] .lg-surface').length,
    );
    expect(n).toBe(0);
  });

  test('排序是**三态循环**：升 → 降 → 回到原始顺序', async ({ page }) => {
    /**
     * ⚠️ 第三态是本库对 macOS 的**刻意偏离**（那边是两态）。
     * 理由：一旦排过就再也回不到原始顺序，而原始顺序往往本身有意义。
     */
    await open(page, 'data-table');
    const original = await names(page);
    expect(original[0], 'harness 里的原始顺序').toBe('Keynote.app');

    const head = page.locator('[data-slot="data-table-sort"][data-slot]').first();
    await head.click();
    const asc = await names(page);
    expect(asc, '升序').toEqual([...original].sort());
    await expect(page.locator('th[data-column="name"]')).toHaveAttribute('aria-sort', 'ascending');

    await head.click();
    const desc = await names(page);
    expect(desc, '降序').toEqual([...original].sort().reverse());
    await expect(page.locator('th[data-column="name"]')).toHaveAttribute('aria-sort', 'descending');

    await head.click();
    expect(await names(page), '第三下回到原始顺序').toEqual(original);
    await expect(page.locator('th[data-column="name"]')).not.toHaveAttribute('aria-sort', /.*/);
  });

  test('数字列按数值排，不是按字符串排', async ({ page }) => {
    /**
     * 这条防的是最经典的一个 bug：把 812 / 2 / 14 当字符串排会得到 14 < 2 < 812。
     */
    await open(page, 'data-table');
    await page.locator('th[data-column="size"] [data-slot="data-table-sort"]').click();
    const sizes = await page
      .locator('[data-slot="table-row"][data-row] td:nth-child(3)')
      .allTextContents();
    expect(sizes).toEqual(['2 MB', '3 MB', '14 MB', '156 MB', '812 MB']);
  });

  test('❗不可排序的列**不渲染按钮** —— 否则读屏会读出一个按不动的按钮', async ({ page }) => {
    await open(page, 'data-table');
    expect(
      await page.locator('th[data-column="kind"] [data-slot="data-table-sort"]').count(),
    ).toBe(0);
    expect(
      await page.locator('th[data-column="name"] [data-slot="data-table-sort"]').count(),
    ).toBe(1);
  });

  test('排序不改调用方传进来的数组（先复制再排）', async ({ page }) => {
    /**
     * `Array.prototype.sort` 是原地的。直接排会改掉 props 里的数组，
     * 而 React 看不出引用变了 —— 症状是「排一次之后再也回不到原始顺序」。
     * 上一条测试的第三态能过，就是这条成立的证据；这里再从 DOM 侧独立验一次。
     */
    await open(page, 'data-table');
    const before = await names(page);
    const head = page.locator('[data-slot="data-table-sort"]').first();
    await head.click();
    await head.click();
    await head.click();
    expect(await names(page)).toEqual(before);
  });

  /**
   * ⚠️ 这一组一律用 `[data-select-all]` / `[data-select-row]` 选中，**不是 data-slot**。
   *
   * `Checkbox` 在展开 props **之后**设了自己的 `data-slot="checkbox"`，
   * 调用方再传一个会被静默吃掉。本仓库这一族的坑踩到第六次了 ——
   * 第一版就是这么写的，两条测试直接找不到元素。
   */
  test('行选择：全选 / 部分选中 / 全不选', async ({ page }) => {
    await open(page, 'data-table-select');
    const all = page.locator('[data-select-all]');
    await expect(all).toHaveAttribute('data-state', 'unchecked');

    // 勾一行 → 全选框进 indeterminate
    await page.locator('[data-select-row]').first().click();
    await expect(all, '本页部分选中 = indeterminate（横杠那一态）').toHaveAttribute(
      'data-state',
      'indeterminate',
    );

    await all.click();
    await expect(all).toHaveAttribute('data-state', 'checked');
    const checked = await page
      .locator('[data-select-row][data-state="checked"]')
      .count();
    expect(checked, '本页 3 行全选').toBe(3);

    await all.click();
    await expect(all).toHaveAttribute('data-state', 'unchecked');
  });

  test('分页：每页 3 行，翻页后内容真的换了', async ({ page }) => {
    await open(page, 'data-table-select');
    expect(await names(page)).toHaveLength(3);
    const first = await names(page);

    // 分页用的是 iOS Page Control（圆点），不是 Web 分页条
    const dots = page.locator('[data-slot="pagination-dot"]');
    expect(await dots.count(), '5 行 / 每页 3 → 2 页').toBe(2);
    await dots.nth(1).click();
    const second = await names(page);
    expect(second).not.toEqual(first);
    expect(second, '最后一页只剩 2 行').toHaveLength(2);
  });

  test('跨页选择不会丢：翻回来还选着', async ({ page }) => {
    await open(page, 'data-table-select');
    await page.locator('[data-select-row]').first().click();
    const dots = page.locator('[data-slot="pagination-dot"]');
    await dots.nth(1).click();
    await dots.nth(0).click();
    await expect(
      page.locator('[data-select-row]').first(),
    ).toHaveAttribute('data-state', 'checked');
  });

  test('空数据时给出提示，且 colSpan 铺满整行', async ({ page }) => {
    /**
     * ⚠️ 这条第一版写成了「查一下 `[data-slot=data-table]` 在不在」——
     * 名字说的是空态，断言的却是「组件渲染了」，**根本没走到那条分支**。
     * harness 里补了一个 `data={[]}` 的实例，现在是真的在测空态。
     */
    await open(page, 'data-table-empty');
    const cell = page.locator('[data-empty]');
    await expect(cell).toBeVisible();
    await expect(cell).toHaveText('没有数据');
    expect(
      await cell.evaluate((el) => Number(el.getAttribute('colspan'))),
      '要铺满整行，否则空态会挤在第一列',
    ).toBe(3);
    expect(await page.locator('[data-slot="table-row"][data-row]').count()).toBe(0);
  });

  test('表格有可访问名称（caption）', async ({ page }) => {
    await open(page, 'data-table');
    await expect(page.locator('caption')).toHaveText('文件列表');
  });
});

/* ══════════════════════════════════════════════════════════════════════
   Command
   ══════════════════════════════════════════════════════════════════════ */

test.describe('Command', () => {
  test('打开后焦点落在输入框上，而不是面板', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    await expect(page.locator('[data-slot="command-input"]')).toBeFocused();
  });

  test('面板是玻璃（Layer B），搜索框与项不是', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    const panel = page.locator('[data-slot="command-content"] .lg-surface');
    await expect(panel).toBeVisible();
    expect(await panel.getAttribute('data-layer')).toBe('elevated');
    expect(
      await page.locator('[data-slot="command-search"]').evaluate((el) =>
        el.classList.contains('lg-surface'),
      ),
    ).toBe(false);
  });

  test('❗焦点始终留在输入框上 —— 靠 aria-activedescendant 指高亮项', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    const input = page.locator('[data-slot="command-input"]');
    await page.keyboard.press('ArrowDown');
    await expect(input, '焦点不能离开输入框').toBeFocused();
    const id = await input.getAttribute('aria-activedescendant');
    expect(id).toBeTruthy();
    await expect(page.locator(`[id="${id}"]`)).toHaveAttribute('data-active', 'true');
  });

  test('方向键跳过禁用项', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    const input = page.locator('[data-slot="command-input"]');
    // 列表顺序：新建 / 打开 / 撤销 / **重做(禁用)** / 设置
    for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowDown');
    const id = await input.getAttribute('aria-activedescendant');
    expect(id, '第 4 项是禁用的，必须被跳过').not.toContain('redo');
  });

  test('分组按**首次出现**的顺序，不按字母序', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    const labels = await page.locator('[data-slot="command-group-label"]').allTextContents();
    expect(labels, '调用方给的顺序通常本身有意义').toEqual(['文件', '编辑', '应用']);
  });

  test('搜索：命中 label 与 keywords；无匹配给提示', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    const input = page.locator('[data-slot="command-input"]');

    await input.fill('撤销');
    await expect(page.locator('[data-slot="command-item"]')).toHaveCount(1);

    // keywords 里写了 create，label 里没有
    await input.fill('create');
    await expect(page.locator('[data-slot="command-item"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="command-item"]').first()).toContainText('新建文稿');

    await input.fill('zzz');
    await expect(page.locator('[data-slot="command-item"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="command-empty"]')).toBeVisible();
  });

  test('Enter 执行并关闭；Escape 关闭', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    await page.locator('[data-slot="command-input"]').fill('撤销');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-slot="command-content"]')).toHaveCount(0);
    await expect(page.getByTestId('cmd-last')).toHaveText('撤销');

    await page.getByTestId('cmd-open').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-slot="command-content"]')).toHaveCount(0);
  });

  test('重开时清空上次的查询词', async ({ page }) => {
    /** 留着会让人以为是结果，不是残留。 */
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    await page.locator('[data-slot="command-input"]').fill('撤销');
    await page.keyboard.press('Escape');
    await page.getByTestId('cmd-open').click();
    await expect(page.locator('[data-slot="command-input"]')).toHaveValue('');
  });

  test('清除按钮：有字才出现，点了就清空', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    await expect(page.locator('[data-slot="command-clear"]')).toHaveCount(0);
    await page.locator('[data-slot="command-input"]').fill('打开');
    await expect(page.locator('[data-slot="command-clear"]')).toBeVisible();
    await page.locator('[data-slot="command-clear"]').click();
    await expect(page.locator('[data-slot="command-input"]')).toHaveValue('');
  });

  test('搜索框结构取自 macOS：放大镜在前、光标是蓝的', async ({ page }) => {
    await open(page, 'command');
    await page.getByTestId('cmd-open').click();
    const m = await page.locator('[data-slot="command-search"]').evaluate((el) => {
      const kids = [...el.children];
      const input = el.querySelector('[data-slot="command-input"]')!;
      const probe = document.createElement('span');
      probe.style.color = getComputedStyle(document.documentElement)
        .getPropertyValue('--lg-blue')
        .trim();
      document.body.appendChild(probe);
      const blue = getComputedStyle(probe).color;
      probe.remove();
      return {
        firstSlot: kids[0]?.getAttribute('data-slot'),
        caret: getComputedStyle(input).caretColor,
        blue,
      };
    });
    expect(m.firstSlot, '[实测] macOS 的放大镜在最前面').toBe('command-search-icon');
    expect(m.caret, '[实测] macOS 的搜索光标是 #0088ff —— 这里走 --lg-blue').toBe(m.blue);
  });
});
