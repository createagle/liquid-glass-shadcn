/**
 * 文档站 —— PROJECT_SPEC §12 / Phase 6 任务卡的验收。
 *
 * 跑法：`pnpm test:docs`（会先 `next build` 再 `next start`，测的是**生产构建**）。
 *
 * 这一份盯的是四件在别处测不到的事：
 *   1. **顶栏三个全局控件真的影响全站**（任务卡的验收原文）
 *   2. **首屏不闪** —— 而且是按「第一次绘制之前」来判，不是加载完了再看
 *   3. **Code 那一半与磁盘上的示例文件逐字相同** —— 这是 Preview/Code 模式的全部意义
 *   4. **API 表确实是生成的**，且每个尺寸常量都带可信度标注
 */

import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = (page: Page) => page.locator('html');

/* ── 全局控件（任务卡验收：「顶栏三个全局控件生效并影响全站」）────────── */

test.describe('顶栏三个全局控件', () => {
  test('明暗切换改的是 <html> 上的主题属性，且落盘', async ({ page }) => {
    await page.goto('/');
    const before = await html(page).getAttribute('data-glass-theme');
    await page.getByRole('switch', { name: '切换暗色模式' }).click();
    await expect(html(page)).not.toHaveAttribute('data-glass-theme', before!);
    // 刷新之后仍然是切过去的那个 —— 说明写进了 localStorage
    const after = await html(page).getAttribute('data-glass-theme');
    await page.reload();
    await expect(html(page)).toHaveAttribute('data-glass-theme', after!);
  });

  test('材质滑杆改 --lg-tint，且底座的 alpha 真的跟着变', async ({ page }) => {
    await page.goto('/');
    const alphaOf = () =>
      page.evaluate(() => {
        const el = document.querySelector('.lg-surface[data-layer="base"]') as HTMLElement;
        return getComputedStyle(el).backgroundColor;
      });
    const slider = page.getByRole('slider', { name: '材质档位' });
    await slider.focus();
    // 只查变量会漏掉「变量改了但绘制没跟上」那一类坑（semantic.css 里为此重写过一整套）
    const dim = await alphaOf();
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    expect(await alphaOf()).not.toBe(dim);
    const tint = await html(page).getAttribute('data-glass-tint');
    expect(Number(tint)).toBeGreaterThan(0);
  });

  test('Tier 强制切换改 data-glass-tier，且 C 档下折射真的没了', async ({ page }) => {
    await page.goto('/docs/components/select');
    await page.getByRole('tab', { name: 'C', exact: true }).click();
    await expect(html(page)).toHaveAttribute('data-glass-tier', 'c');
    const filter = await page.evaluate(() => {
      const el = document.querySelector('.lg-surface[data-layer="base"]') as HTMLElement;
      return getComputedStyle(el).backdropFilter;
    });
    // Tier C 是实色路径 —— 不允许有任何 backdrop-filter
    expect(filter).toBe('none');
    await page.getByRole('tab', { name: '自动' }).click();
    await expect(html(page)).not.toHaveAttribute('data-glass-tier', 'c');
  });
});

/* ── 首屏不闪 ────────────────────────────────────────────────────────── */

test('暗色首屏不闪 —— 内联脚本在 <head> 里，且真的生效', async ({ page, request }) => {
  /**
   * 拆成两个确定性的断言，合起来就是「不会闪」：
   *
   *   1. 那段内联脚本出现在 `<head>` 里、在 `<body>` 之前。
   *      它是**同步**脚本，浏览器不可能在执行它之前绘制 body 里的内容 ——
   *      这一半是文档结构的静态性质，不依赖任何时序。
   *   2. 存了 `lg:theme=dark` 之后，页面确实是暗色的（属性 + class 都对）。
   *
   * ⚠️ 试过更"直接"的写法：在第一个 rAF 里、或在 body 被插入时读属性。
   *    两种都**偶发失败** —— 前者 rAF 可能在文档还没解析到 <head> 时就烧掉一帧，
   *    后者 addInitScript 跑得比 documentElement 还早，观察器根本装不上。
   *    那些是测试的时序假设不成立，不是产品的问题；换成上面这对断言。
   */
  const html = await (await request.get('/')).text();
  const scriptAt = html.indexOf('lg:theme');
  const headEnd = html.indexOf('</head>');
  const bodyAt = html.indexOf('<body');
  expect(scriptAt, '页面里应当有那段防闪烁脚本').toBeGreaterThan(0);
  expect(scriptAt, '脚本必须在 </head> 之前').toBeLessThan(headEnd);
  expect(headEnd, '<head> 必须在 <body> 之前结束').toBeLessThan(bodyAt);

  await page.addInitScript(() => {
    try {
      localStorage.setItem('lg:theme', 'dark');
    } catch {
      /* 隐私模式：忽略 */
    }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-glass-theme', 'dark');
  await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/);
});

/* ── Preview / Code ──────────────────────────────────────────────────── */

test('Code 那一半与磁盘上的示例文件逐字相同', async ({ page }) => {
  /**
   * Preview/Code 模式唯一的意义就是「你看到的和你复制走的是同一份」。
   * 手写一份说明文档、渲染另一份代码，是这个模式最常见的退化方式。
   */
  await page.goto('/docs/components/button');
  // 组件页上不止一个 ComponentPreview（「预览」区 + 「示例」区），限定到第一个
  const preview = page.locator('#preview');
  await preview.getByRole('tab', { name: '代码' }).click();
  const shown = (await preview.locator('pre code').first().innerText()).trim();
  const onDisk = readFileSync(
    resolve('apps/www/registry/glass/examples/button-variants.tsx'),
    'utf8',
  ).trim();
  expect(shown).toBe(onDisk);
});

test('Preview 里渲染的是真组件，不是截图', async ({ page }) => {
  await page.goto('/docs/components/button');
  // 限定在「预览」小节里的活动面板 —— 页面上还有安装命令那一组 Tabs，
  // 它的代码块里也有一个复制按钮（本库的 Button）
  const buttons = page.locator(
    '#preview [data-slot="tabs-content"][data-state="active"] [data-slot="button"]',
  );
  await expect(buttons).toHaveCount(5);
  // 真组件才会有材质层
  await expect(buttons.first().locator('.lg-surface')).toHaveCount(1);
});

/* ── API 表是生成的 ─────────────────────────────────────────────────── */

test.describe('API Reference', () => {
  test('props 表来自 TS 类型（含默认值与继承说明）', async ({ page }) => {
    await page.goto('/docs/components/button');
    const api = page.locator('#api');
    await expect(api).toContainText('GlassButtonProps');
    await expect(api).toContainText('variant');
    // 默认值是从组件函数的解构参数里读的，不是手写的
    await expect(api).toContainText("'glass'");
    // 继承不摊平，写成一行人话
    await expect(api).toContainText('继承 <button> 的原生属性');
  });

  test('尺寸常量表**每一行**都带可信度标注', async ({ page }) => {
    /**
     * 这是本库的核心纪律：数字必须能说出出处（PROJECT_SPEC §15）。
     * 生成脚本会统计「没有标注的常量」，这里把它钉成 0。
     */
    await page.goto('/docs/components/select');
    const rows = page.locator('#geometry tbody tr');
    const n = await rows.count();
    expect(n).toBeGreaterThan(10);
    for (let i = 0; i < n; i++) {
      const badges = rows.nth(i).locator('span', { hasText: /^(官方|实测|推定|待核实)$/ });
      await expect(badges.first(), `第 ${i + 1} 行缺可信度标注`).toBeVisible();
    }
  });

  test('APPLE REFERENCE 是从源码文件头搬过来的', async ({ page }) => {
    await page.goto('/docs/components/select');
    await expect(page.locator('#apple-reference')).toContainText('APPLE REFERENCE');
    await expect(page.locator('#apple-reference')).toContainText('SwiftUI `Picker`');
  });
});

/* ── 站点结构 ────────────────────────────────────────────────────────── */

test('每个 registry 组件都有文档页入口', async ({ page }) => {
  /**
   * 侧栏是从 registry.json 生成的，所以这条真正防的是反过来的漏洞：
   * 组件发了、页面 404。逐个点开太慢，这里只验清单一致 + 抽查一页能开。
   */
  const registry = JSON.parse(readFileSync(resolve('apps/www/registry.json'), 'utf8')) as {
    items: { name: string; type: string; title: string }[];
  };
  const ui = registry.items.filter((i) => i.type === 'registry:ui');
  await page.goto('/docs');
  for (const item of ui) {
    await expect(
      page.getByRole('link', { name: item.title, exact: true }),
      `侧栏缺少 ${item.name}`,
    ).toHaveCount(1);
  }
});

test('/view/[name] 没有站点装饰 —— 截图与 iframe 用的就是它', async ({ page }) => {
  await page.goto('/view/select-demo');
  await expect(page.locator('[data-slot="select-trigger"]')).toHaveCount(1);
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('nav')).toHaveCount(0);
});


/* ── Fidelity（PROJECT_SPEC §12 里标着「本库独有」的那一节）───────────── */

test.describe('Fidelity 对照', () => {
  test('有对照图的组件：图 + 差异说明都在，且说明与 fidelity.html 同源', async ({ page }) => {
    await page.goto('/docs/components/tabs');
    const fid = page.locator('#fidelity');
    await expect(fid.locator('img')).toHaveCount(1);
    await expect(fid.locator('img')).toHaveAttribute('src', /compare-tabs-cols\.png$/);
    // 差异说明是从 dev/fidelity.html 的 .note 抽出来的，不是页面另写的
    const html = readFileSync(resolve('apps/www/dev/fidelity.html'), 'utf8');
    expect(html, '这句话应当来自 fidelity.html').toContain('Search 独立胶囊');
    await expect(fid).toContainText('Search 独立胶囊');
    await expect(fid).toContainText('至今没做');
  });

  test('页面上必须先声明「左边不是真机截图」', async ({ page }) => {
    /**
     * 这不是免责声明，是这一整节该怎么读的前提：
     * Figma 静态稿画不出折射与色散，所以材质本来就不可比。
     * 少了这句话，读者会把「右边有色散、左边没有」当成还原度问题。
     */
    await page.goto('/docs/components/switch');
    await expect(page.locator('#fidelity')).toContainText('不是真机截图');
  });

  test('没有对照图的组件：说清楚为什么，不是「暂无」', async ({ page }) => {
    for (const [slug, phrase] of [
      ['toggle', '没有属于 Toggle 自己的 Apple 参考图'],
      ['popover', '轮廓拟合不收敛'],
      ['select', '参考图里没有任何带选中态的菜单'],
      ['responsive-overlay', '行为原语'],
    ] as const) {
      await page.goto('/docs/components/' + slug);
      await expect(page.locator('#fidelity'), slug).toContainText(phrase);
      await expect(page.locator('#fidelity'), slug + ' 不该出现敷衍文案').not.toContainText('暂无');
    }
  });
});

/* ── Examples ────────────────────────────────────────────────────────── */

test('每个组件都不止一个示例（§14 的 Examples 那一条）', async ({ page }) => {
  const registry = JSON.parse(readFileSync(resolve('apps/www/registry.json'), 'utf8')) as {
    items: { name: string; type: string }[];
  };
  const ui = registry.items.filter((i) => i.type === 'registry:ui');
  for (const item of ui) {
    await page.goto('/docs/components/' + item.name);
    await expect(page.locator('#preview'), item.name).toHaveCount(1);
    await expect(
      page.locator('#examples [data-slot="tabs"]'),
      item.name + ' 缺第二个示例',
    ).not.toHaveCount(0);
  }
});

/* ── ⌘K ──────────────────────────────────────────────────────────────── */

test.describe('⌘K 命令面板', () => {
  test('Ctrl/⌘+K 打开，输入能过滤，↵ 跳转', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const input = page.getByRole('combobox', { name: '搜索组件与文档' });
    await expect(input).toBeFocused();
    await input.fill('select');
    const options = page.getByRole('option');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText('Select');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/docs\/components\/select$/);
  });

  test('面板是本库的 Dialog + Card 搭的（§12：搜索面板也要吃自己的狗粮）', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-command-palette]')).toHaveCount(1);
    // 面板本体是 Dialog 的 elevated 材质
    await expect(
      page.locator('[data-slot="dialog-content"] .lg-surface[data-layer="elevated"]'),
    ).toHaveCount(1);
    // 高亮项是 Layer I —— 与菜单项同一层材质
    await expect(
      page.locator('[role="option"] .lg-surface[data-layer="indicator"]').first(),
    ).toHaveCount(1);
  });

  test('Esc 关闭', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-command-palette]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-command-palette]')).toHaveCount(0);
  });

  test('如实说明搜索能力的边界', async ({ page }) => {
    // 「像全文搜索」是这类面板最容易造成的误解，面板底部必须写清楚
    await page.goto('/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-command-palette]')).toContainText('不是全文搜索');
  });
});

/* ── 控制台 ──────────────────────────────────────────────────────────── */

/**
 * 允许通过的噪音。**每一条都要写清楚为什么它不是 bug。**
 */
const ALLOW: { re: RegExp; why: string }[] = [
  {
    re: /Encountered a script tag while rendering React component/,
    why:
      '首屏防闪烁的内联脚本。它必须在 <head> 里同步执行（要赶在 <body> 被解析出来之前），' +
      '而 Next 不喜欢 React 树里出现 <script>。换 next/script 试过：警告照旧，' +
      '注入位置反而掉到 body 开头。见 app/layout.tsx 的注释。',
  },
];

for (const path of ['/', '/docs', '/docs/installation', '/docs/components/select']) {
  test(`控制台无 error / warning：${path}`, async ({ page }) => {
    const noise: string[] = [];
    page.on('console', (m) => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      if (ALLOW.some((a) => a.re.test(m.text()))) return;
      noise.push(`[${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => noise.push(`[pageerror] ${e.message}`));
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    expect([...new Set(noise.map((s) => s.slice(0, 160)))]).toEqual([]);
  });
}
